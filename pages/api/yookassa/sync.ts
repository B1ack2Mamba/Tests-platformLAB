import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { activateWorkspaceSubscription } from "@/lib/serverCommercialSubscriptions";

type Resp =
  | { ok: true; checked: number; credited: number; updated: number; skipped?: boolean; status?: string }
  | { ok: false; error: string };

type Body = { payment_id?: string };

function getBearer(req: NextApiRequest): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(String(h));
  return m?.[1] ?? null;
}

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as Body;
  const paymentId = String(body.payment_id || "").trim();
  if (!paymentId) {
    return res.status(400).json({ ok: false, error: "payment_id is required" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!url || !serviceKey || !shopId || !secretKey) {
    return res.status(500).json({ ok: false, error: "Server env missing for YooKassa sync" });
  }

  const token = getBearer(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing Authorization Bearer token" });
  }

  const supabaseAdmin = createClient(url, serviceKey);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ ok: false, error: "Invalid session" });
  }
  const currentUserId = userData.user.id;

  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  const checkResp = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    method: "GET",
    headers: { authorization: `Basic ${auth}` },
  });

  const raw = await checkResp.text();
  let payment: any = null;
  try {
    payment = JSON.parse(raw);
  } catch {}

  if (!checkResp.ok || !payment) {
    return res.status(502).json({ ok: false, error: payment?.description || raw || "Failed to verify payment" });
  }

  const status = String(payment?.status || "").trim();
  const metadata = payment?.metadata || {};
  const kind = String(metadata?.kind || "wallet_topup").trim();
  const userId = String(metadata?.user_id || "").trim();
  if (!userId || userId !== currentUserId) {
    return res.status(403).json({ ok: false, error: "Payment does not belong to current user" });
  }

  const amountStr = String(payment?.amount?.value || "").trim();
  const amountRub = Number(amountStr);
  const amountKopeks = Number.isFinite(amountRub) && amountRub > 0 ? Math.round(amountRub * 100) : 0;

  if (kind === "wallet_topup" && amountKopeks > 0) {
    await supabaseAdmin.from("yookassa_topups").upsert({
      payment_id: paymentId,
      user_id: userId,
      amount_kopeks: amountKopeks,
      status: status || "unknown",
      paid_at: status === "succeeded" ? new Date().toISOString() : null,
    });
  }

  if (status !== "succeeded") {
    return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, status, skipped: true });
  }

  if (kind === "commercial_subscription") {
    const workspaceId = String(metadata?.workspace_id || "").trim();
    const planKey = String(metadata?.plan_key || "").trim();
    const planTitle = String(metadata?.plan_title || planKey || "Месячный тариф").trim();
    const projectsLimit = toPositiveInt(metadata?.projects_limit, 0);
    const durationDays = toPositiveInt(metadata?.duration_days, 30);
    if (!workspaceId || !planKey || !projectsLimit || amountKopeks <= 0) {
      return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, skipped: true, status });
    }

    try {
      await activateWorkspaceSubscription(supabaseAdmin, {
        workspaceId,
        userId,
        paymentId,
        planKey,
        planTitle,
        amountKopeks,
        projectsLimit,
        durationDays,
      });
    } catch (error: any) {
      const msg = error?.message || "Failed to activate subscription";
      if (!/duplicate|unique/i.test(msg)) {
        return res.status(500).json({ ok: false, error: msg });
      }
    }

    return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 1, status });
  }

  if (kind === "wallet_topup") {
    if (amountKopeks <= 0) {
      return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, skipped: true, status });
    }

    const { data: creditResult, error } = await supabaseAdmin.rpc("credit_wallet_idempotent", {
      p_user_id: userId,
      p_amount_kopeks: amountKopeks,
      p_reason: "topup",
      p_ref: `yookassa:${paymentId}`,
    });

    if (error) {
      const msg = error.message || "credit_wallet error";
      if (!/duplicate key|unique constraint/i.test(msg)) {
        return res.status(500).json({ ok: false, error: msg });
      }
    }

    return res.status(200).json({ ok: true, checked: 1, credited: 1, updated: 1, status });
  }

  return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, skipped: true, status });
}
