import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { activateWorkspaceSubscription } from "@/lib/serverCommercialSubscriptions";

type ErrResp = { ok: false; error: string };

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ErrResp>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res
      .status(500)
      .json({ ok: false, error: "Server env missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    return res
      .status(500)
      .json({ ok: false, error: "YooKassa is not configured: set YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY" });
  }

  const obj = req.body?.object;
  const paymentId: string | undefined = obj?.id;
  if (!paymentId) {
    return res.status(200).json({ ok: true });
  }

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
    return res
      .status(500)
      .json({ ok: false, error: payment?.description || raw || "Failed to verify payment" });
  }

  const status: string | undefined = payment?.status;
  const metadata = payment?.metadata || {};
  const kind: string = String(metadata?.kind || "wallet_topup");
  const userId: string | undefined = metadata?.user_id;
  const amountStr: string | undefined = payment?.amount?.value;

  if (status !== "succeeded") {
    if (kind === "wallet_topup" && userId && amountStr) {
      const supabaseAdmin = createClient(url, serviceKey);
      await supabaseAdmin.from("yookassa_topups").upsert({
        payment_id: paymentId,
        user_id: userId,
        amount_kopeks: Math.round(Number(amountStr) * 100),
        status: status || "unknown",
      });
    }

    return res.status(200).json({ ok: true, ignored: true, status });
  }

  if (!amountStr) {
    return res.status(200).json({ ok: true, ignored: true, reason: "missing amount" });
  }

  const amountRub = Number(amountStr);
  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    return res.status(200).json({ ok: true, ignored: true, reason: "bad amount" });
  }

  const amountKopeks = Math.round(amountRub * 100);
  const supabaseAdmin = createClient(url, serviceKey);

  if (kind === "commercial_subscription") {
    const workspaceId = String(metadata?.workspace_id || "").trim();
    const planKey = String(metadata?.plan_key || "").trim();
    const planTitle = String(metadata?.plan_title || planKey || "Месячный тариф").trim();
    const projectsLimit = toPositiveInt(metadata?.projects_limit, 0);
    const durationDays = toPositiveInt(metadata?.duration_days, 30);
    if (!workspaceId || !planKey || !projectsLimit) {
      return res.status(200).json({ ok: true, ignored: true, reason: "missing subscription metadata" });
    }

    try {
      await activateWorkspaceSubscription(supabaseAdmin, {
        workspaceId,
        userId: userId || null,
        paymentId,
        planKey,
        planTitle,
        amountKopeks,
        projectsLimit,
        durationDays,
      });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error?.message || "Failed to activate subscription" });
    }

    return res.status(200).json({ ok: true, activated: true, kind });
  }

  if (!userId) {
    return res.status(200).json({ ok: true, ignored: true, reason: "missing metadata.user_id" });
  }

  await supabaseAdmin.from("yookassa_topups").upsert({
    payment_id: paymentId,
    user_id: userId,
    amount_kopeks: amountKopeks,
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  const { data: creditResult, error } = await supabaseAdmin.rpc("credit_wallet_idempotent", {
    p_user_id: userId,
    p_amount_kopeks: amountKopeks,
    p_reason: "topup",
    p_ref: `yookassa:${paymentId}`,
  });

  if (error) {
    const msg = error.message || "credit_wallet error";
    if (/duplicate key|unique constraint/i.test(msg)) {
      return res.status(200).json({ ok: true, already: true });
    }
    return res.status(500).json({ ok: false, error: msg });
  }

  return res.status(200).json({ ok: true, credited: true });
}
