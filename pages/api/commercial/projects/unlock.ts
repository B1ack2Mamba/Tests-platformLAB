import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { chargeWallet } from "@/lib/serverWallet";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import {
  getEvaluationPackagePriceRub,
  getEvaluationPackageRank,
  getUpgradePriceRub,
  isEvaluationPackage,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";

function normalizePackage(value: unknown): EvaluationPackage | null {
  return isEvaluationPackage(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const projectId = String(req.body?.project_id || "").trim();
  const targetMode = normalizePackage(req.body?.package_mode);
  if (!projectId) return res.status(400).json({ ok: false, error: "project_id is required" });
  if (!targetMode) return res.status(400).json({ ok: false, error: "Некорректный режим оценки" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { data: project, error } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        workspace_id,
        unlocked_package_mode,
        commercial_project_tests(test_slug),
        commercial_project_attempts(test_slug)
      `)
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw error;
    if (!project) return res.status(404).json({ ok: false, error: "Проект не найден" });

    const currentMode = ((project as any).unlocked_package_mode || null) as EvaluationPackage | null;
    const currentRank = getEvaluationPackageRank(currentMode);
    const targetRank = getEvaluationPackageRank(targetMode);
    if (targetRank <= currentRank) {
      return res.status(200).json({
        ok: true,
        package_mode: currentMode,
        charged_rub: 0,
        balance_kopeks: null,
      });
    }

    const tests = ((project as any).commercial_project_tests || []) as Array<any>;
    const attempts = ((project as any).commercial_project_attempts || []) as Array<any>;
    const completed = new Set(attempts.map((item) => item.test_slug)).size;
    const fullyDone = tests.length > 0 && completed >= tests.length;
    if (!fullyDone) {
      return res.status(400).json({ ok: false, error: "Открыть уровень результата можно только после завершения всех тестов" });
    }

    const chargeRub = getUpgradePriceRub(currentMode, targetMode);
    const chargeKopeks = chargeRub * 100;
    let balanceKopeks: number | null = null;
    const isUnlimited = isTestUnlimitedEmail(authed.user.email);
    let billedBySubscription = false;
    let subscriptionRemaining: number | null = null;

    if (chargeKopeks > 0 && !isUnlimited) {
      const { data: existingCoverage } = await authed.supabaseAdmin
        .from("commercial_workspace_subscription_projects")
        .select("subscription_id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (existingCoverage?.subscription_id) {
        billedBySubscription = true;
      } else {
        const { data: consumeData, error: consumeError } = await authed.supabaseAdmin.rpc("consume_commercial_workspace_subscription", {
          p_workspace_id: workspace.workspace_id,
          p_project_id: projectId,
        });

        if (consumeError) {
          throw consumeError;
        }

        if ((consumeData as any)?.ok && ((consumeData as any)?.applied || (consumeData as any)?.already)) {
          billedBySubscription = true;
          subscriptionRemaining = Number((consumeData as any)?.remaining ?? 0);
        }
      }
    }

    if (chargeKopeks > 0 && !isUnlimited && !billedBySubscription) {
      const ref = `commercial-evaluation:${projectId}:${targetMode}`;
      try {
        const debitData = await chargeWallet(authed.supabaseAdmin, {
          userId: authed.user.id,
          amountKopeks: chargeKopeks,
          reason: "commercial_project_evaluation_unlock",
          ref,
        });
        balanceKopeks = Number(debitData.balance_kopeks ?? 0);
      } catch (debitError: any) {
        return res.status(400).json({ ok: false, error: debitError?.message || "Не удалось списать оплату" });
      }
    }

    const { error: updateError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .update({
        unlocked_package_mode: targetMode,
        unlocked_package_paid_at: new Date().toISOString(),
        unlocked_package_price_kopeks: billedBySubscription ? 0 : getEvaluationPackagePriceRub(targetMode) * 100,
      })
      .eq("id", projectId)
      .eq("workspace_id", workspace.workspace_id);

    if (updateError) throw updateError;

    if (isUnlimited) {
      balanceKopeks = TEST_UNLIMITED_BALANCE_KOPEKS;
    } else if (balanceKopeks == null) {
      const { data: wallet } = await authed.supabaseAdmin
        .from("wallets")
        .select("balance_kopeks")
        .eq("user_id", authed.user.id)
        .maybeSingle();
      balanceKopeks = Number((wallet as any)?.balance_kopeks ?? 0);
    }

    return res.status(200).json({
      ok: true,
      package_mode: targetMode,
      charged_rub: billedBySubscription ? 0 : chargeRub,
      balance_kopeks: balanceKopeks,
      used_subscription: billedBySubscription,
      subscription_remaining: subscriptionRemaining,
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || "Не удалось открыть уровень оценки" });
  }
}
