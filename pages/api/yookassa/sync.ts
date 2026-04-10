import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { activateWorkspaceSubscription } from "@/lib/serverCommercialSubscriptions";
import {
  findWalletLedgerByRef,
  getProviderAmountKopeksFromPayment,
  getYooKassaPaidAt,
  isYooKassaAmountMismatch,
  normalizeYooKassaTopupStatus,
  parseRequestedAmountKopeksFromMetadata,
  patchYooKassaTopupSafe,
  upsertYooKassaTopupSafe,
} from "@/lib/yookassaGuard";

type Resp =
  | {
      ok: true;
      checked: number;
      credited: number;
      updated: number;
      skipped?: boolean;
      status?: string;
      reason?: string;
      expected_amount_kopeks?: number | null;
      actual_amount_kopeks?: number;
    }
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

  const providerStatus = String(payment?.status || "").trim();
  const metadata = payment?.metadata || {};
  const kind = String(metadata?.kind || "wallet_topup").trim();
  const userId = String(metadata?.user_id || "").trim();
  if (!userId || userId !== currentUserId) {
    return res.status(403).json({ ok: false, error: "Payment does not belong to current user" });
  }

  const providerAmountKopeks = getProviderAmountKopeksFromPayment(payment);
  const requestedAmountKopeks = parseRequestedAmountKopeksFromMetadata(metadata);
  const mismatchDetected = isYooKassaAmountMismatch(requestedAmountKopeks, providerAmountKopeks);
  const normalizedStatus = normalizeYooKassaTopupStatus(providerStatus);
  const paidAtIso = normalizedStatus === "paid" ? getYooKassaPaidAt(payment) || new Date().toISOString() : null;

  if (kind === "wallet_topup") {
    await upsertYooKassaTopupSafe(supabaseAdmin, {
      payment_id: paymentId,
      user_id: userId,
      amount_kopeks: providerAmountKopeks || requestedAmountKopeks || 0,
      requested_amount_kopeks: requestedAmountKopeks,
      provider_amount_kopeks: providerAmountKopeks || null,
      mismatch_detected: mismatchDetected,
      status: normalizedStatus,
      paid_at: paidAtIso,
      metadata: {
        kind,
        requested_amount_kopeks: requestedAmountKopeks ? String(requestedAmountKopeks) : "",
        provider_amount_kopeks: providerAmountKopeks ? String(providerAmountKopeks) : "",
      },
      last_error: mismatchDetected ? "provider amount does not match requested amount" : null,
    });
  }

  if (normalizedStatus !== "paid") {
    return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, status: normalizedStatus, skipped: true });
  }

  if (providerAmountKopeks <= 0) {
    await patchYooKassaTopupSafe(supabaseAdmin, paymentId, {
      status: normalizedStatus,
      paid_at: paidAtIso,
      last_error: "provider amount is empty or invalid",
    });
    return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, skipped: true, status: normalizedStatus, reason: "bad_amount" });
  }

  if (mismatchDetected) {
    await patchYooKassaTopupSafe(supabaseAdmin, paymentId, {
      status: normalizedStatus,
      paid_at: paidAtIso,
      provider_amount_kopeks: providerAmountKopeks,
      requested_amount_kopeks: requestedAmountKopeks,
      mismatch_detected: true,
      last_error: "provider amount does not match requested amount",
    });
    return res.status(200).json({
      ok: true,
      checked: 1,
      credited: 0,
      updated: 1,
      skipped: true,
      status: normalizedStatus,
      reason: "amount_mismatch",
      expected_amount_kopeks: requestedAmountKopeks,
      actual_amount_kopeks: providerAmountKopeks,
    });
  }

  if (kind === "commercial_subscription") {
    const workspaceId = String(metadata?.workspace_id || "").trim();
    const planKey = String(metadata?.plan_key || "").trim();
    const planTitle = String(metadata?.plan_title || planKey || "Месячный тариф").trim();
    const projectsLimit = toPositiveInt(metadata?.projects_limit, 0);
    const durationDays = toPositiveInt(metadata?.duration_days, 30);
    if (!workspaceId || !planKey || !projectsLimit || providerAmountKopeks <= 0) {
      return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, skipped: true, status: normalizedStatus });
    }

    try {
      await activateWorkspaceSubscription(supabaseAdmin, {
        workspaceId,
        userId,
        paymentId,
        planKey,
        planTitle,
        amountKopeks: providerAmountKopeks,
        projectsLimit,
        durationDays,
      });
    } catch (error: any) {
      const msg = error?.message || "Failed to activate subscription";
      if (!/duplicate|unique/i.test(msg)) {
        return res.status(500).json({ ok: false, error: msg });
      }
    }

    return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 1, status: normalizedStatus });
  }

  if (kind === "wallet_topup") {
    const ledgerRef = `yookassa:${paymentId}`;

    try {
      const { error } = await supabaseAdmin.rpc("credit_wallet_idempotent", {
        p_user_id: userId,
        p_amount_kopeks: providerAmountKopeks,
        p_reason: "topup",
        p_ref: ledgerRef,
      });

      if (error && !/duplicate key|unique constraint/i.test(error.message || "")) {
        const msg = error.message || "credit_wallet error";
        console.error("[yookassa:sync] credit_wallet_idempotent failed", { paymentId, userId, msg });
        await patchYooKassaTopupSafe(supabaseAdmin, paymentId, {
          status: normalizedStatus,
          paid_at: paidAtIso,
          provider_amount_kopeks: providerAmountKopeks,
          requested_amount_kopeks: requestedAmountKopeks,
          mismatch_detected: false,
          last_error: msg,
        });
        return res.status(500).json({ ok: false, error: msg });
      }

      const ledgerRow = await findWalletLedgerByRef(supabaseAdmin, userId, ledgerRef);
      if (!ledgerRow) {
        const msg = "Payment marked as paid but wallet ledger row is missing";
        console.error("[yookassa:sync] ledger row missing after credit", { paymentId, userId, providerAmountKopeks });
        await patchYooKassaTopupSafe(supabaseAdmin, paymentId, {
          status: normalizedStatus,
          paid_at: paidAtIso,
          provider_amount_kopeks: providerAmountKopeks,
          requested_amount_kopeks: requestedAmountKopeks,
          mismatch_detected: false,
          last_error: msg,
        });
        return res.status(500).json({ ok: false, error: msg });
      }

      await patchYooKassaTopupSafe(supabaseAdmin, paymentId, {
        status: normalizedStatus,
        paid_at: paidAtIso,
        amount_kopeks: providerAmountKopeks,
        provider_amount_kopeks: providerAmountKopeks,
        requested_amount_kopeks: requestedAmountKopeks,
        mismatch_detected: false,
        last_error: null,
      });

      return res.status(200).json({ ok: true, checked: 1, credited: 1, updated: 1, status: normalizedStatus });
    } catch (error: any) {
      const msg = error?.message || "credit_wallet error";
      console.error("[yookassa:sync] unexpected reconciliation error", { paymentId, userId, msg });
      await patchYooKassaTopupSafe(supabaseAdmin, paymentId, {
        status: normalizedStatus,
        paid_at: paidAtIso,
        provider_amount_kopeks: providerAmountKopeks,
        requested_amount_kopeks: requestedAmountKopeks,
        mismatch_detected: false,
        last_error: msg,
      });
      return res.status(500).json({ ok: false, error: msg });
    }
  }

  return res.status(200).json({ ok: true, checked: 1, credited: 0, updated: 0, skipped: true, status: normalizedStatus });
}
