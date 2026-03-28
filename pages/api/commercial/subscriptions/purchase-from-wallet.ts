import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getMonthlyPlanDefinition, isMonthlyPlanKey } from "@/lib/commercialSubscriptions";
import { chargeWallet } from "@/lib/serverWallet";
import { activateWorkspaceSubscription } from "@/lib/serverCommercialSubscriptions";

type OkResp = {
  ok: true;
  payment_id: string;
  charged_kopeks: number;
  balance_kopeks: number;
};

type ErrResp = { ok: false; error: string };

function normalizeWalletError(error: unknown) {
  const message = String((error as any)?.message || error || "");
  if (!message) return "Не удалось купить тариф с баланса";
  if (/insufficient balance/i.test(message)) {
    return "Недостаточно средств на балансе кошелька для покупки тарифа.";
  }
  return message;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<OkResp | ErrResp>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const rawPlanKey = String(req.body?.plan_key || "").trim();
  if (!isMonthlyPlanKey(rawPlanKey)) {
    return res.status(400).json({ ok: false, error: "Некорректный тариф" });
  }

  const plan = getMonthlyPlanDefinition(rawPlanKey);
  if (!plan) return res.status(400).json({ ok: false, error: "Тариф не найден" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const amountKopeks = Math.round(plan.monthlyPriceRub * 100);
    const paymentId = `wallet-sub:${workspace.workspace_id}:${plan.key}:${crypto.randomUUID()}`;

    const charge = await chargeWallet(authed.supabaseAdmin, {
      userId: authed.user.id,
      amountKopeks,
      reason: "commercial_subscription",
      ref: paymentId,
    });

    await activateWorkspaceSubscription(authed.supabaseAdmin, {
      workspaceId: workspace.workspace_id,
      userId: authed.user.id,
      paymentId,
      planKey: plan.key,
      planTitle: plan.title,
      amountKopeks,
      projectsLimit: plan.projectsLimit,
      durationDays: plan.durationDays,
    });

    return res.status(200).json({
      ok: true,
      payment_id: paymentId,
      charged_kopeks: charge.charged_kopeks,
      balance_kopeks: charge.balance_kopeks,
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: normalizeWalletError(error) });
  }
}
