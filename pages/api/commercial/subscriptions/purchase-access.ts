import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getMonthlyPlanDefinition, isMonthlyPlanKey } from "@/lib/commercialSubscriptions";
import { requireUser } from "@/lib/serverAuth";
import { getActiveWorkspaceSubscription } from "@/lib/serverWorkspaceSubscription";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  if (req.method !== "GET") return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const rawPlanKey = String(req.query?.plan_key || "").trim();
  if (!isMonthlyPlanKey(rawPlanKey)) {
    return res.status(400).json({ ok: false, request_id: requestId, error: "Некорректный тариф" });
  }

  const plan = getMonthlyPlanDefinition(rawPlanKey);
  if (!plan) return res.status(400).json({ ok: false, request_id: requestId, error: "Тариф не найден" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const activeSubscription = await getActiveWorkspaceSubscription(authed.supabaseAdmin, workspace.workspace_id);
    const { data: wallet, error: walletError } = await authed.supabaseAdmin
      .from("wallets")
      .select("balance_kopeks")
      .eq("user_id", authed.user.id)
      .maybeSingle();

    if (walletError) throw walletError;

    const balanceKopeks = Number((wallet as any)?.balance_kopeks ?? 0);
    const priceKopeks = Math.round(plan.monthlyPriceRub * 100);
    const canPurchase = balanceKopeks >= priceKopeks;

    return res.status(200).json({
      ok: true,
      request_id: requestId,
      workspace,
      active_subscription: activeSubscription,
      plan: {
        key: plan.key,
        title: plan.title,
        monthly_price_rub: plan.monthlyPriceRub,
        projects_limit: plan.projectsLimit,
        effective_project_price_rub: plan.effectiveProjectPriceRub,
        duration_days: plan.durationDays,
      },
      balance_kopeks: balanceKopeks,
      price_kopeks: priceKopeks,
      can_purchase: canPurchase,
      reason: canPurchase
        ? "Средств хватает, тариф можно купить с баланса."
        : "Недостаточно средств на балансе для покупки тарифа.",
    });
  } catch (error: any) {
    logApiError("commercial.subscriptions.purchase-access", requestId, error, { plan_key: rawPlanKey });
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось проверить доступность покупки тарифа" });
  }
}
