import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import {
  getUpgradePriceRub,
  getEvaluationPackageRank,
  isEvaluationPackage,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import { isTestUnlimitedEmail } from "@/lib/testWallet";

function normalizePackage(value: unknown): EvaluationPackage | null {
  return isEvaluationPackage(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  if (req.method !== "GET") return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const projectId = String(req.query?.id || "").trim();
  const targetMode = normalizePackage(req.query?.package_mode);
  if (!projectId) return res.status(400).json({ ok: false, request_id: requestId, error: "id is required" });
  if (!targetMode) return res.status(400).json({ ok: false, request_id: requestId, error: "Некорректный режим оценки" });

  try {
    const access = await canAccessCommercialProject(authed.supabaseAdmin, authed.user, projectId);
    if (!access.found) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!access.allowed) return res.status(403).json({ ok: false, request_id: requestId, error: "Нет доступа к проекту" });
    const { data: project, error } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        workspace_id,
        unlocked_package_mode,
        commercial_project_tests(test_slug),
        commercial_project_attempts(test_slug)
      `)
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw error;
    if (!project) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });

    const currentMode = ((project as any).unlocked_package_mode || null) as EvaluationPackage | null;
    const currentRank = getEvaluationPackageRank(currentMode);
    const targetRank = getEvaluationPackageRank(targetMode);
    const tests = ((project as any).commercial_project_tests || []) as Array<any>;
    const attempts = ((project as any).commercial_project_attempts || []) as Array<any>;
    const completed = new Set(attempts.map((item) => item.test_slug)).size;
    const fullyDone = tests.length > 0 && completed >= tests.length;
    const upgradePriceRub = getUpgradePriceRub(currentMode, targetMode);
    const isUnlimited = isTestUnlimitedEmail(authed.user.email);

    let reason = "Пакет можно открыть.";
    let canUnlock = targetRank > currentRank && fullyDone;

    if (targetRank <= currentRank) {
      canUnlock = false;
      reason = "Пакет уже открыт или выбран не более высокий уровень.";
    } else if (!fullyDone) {
      canUnlock = false;
      reason = "Открыть уровень результата можно только после завершения всех тестов.";
    } else if (isUnlimited) {
      reason = "Аккаунт в unlimited-режиме: списание не потребуется.";
    }

    const { data: existingCoverage } = upgradePriceRub > 0
      ? await authed.supabaseAdmin
          .from("commercial_workspace_subscription_projects")
          .select("subscription_id")
          .eq("project_id", projectId)
          .maybeSingle()
      : { data: null as any };

    return res.status(200).json({
      ok: true,
      request_id: requestId,
      project_id: projectId,
      current_package_mode: currentMode,
      target_package_mode: targetMode,
      current_rank: currentRank,
      target_rank: targetRank,
      tests_total: tests.length,
      attempts_completed: completed,
      fully_done: fullyDone,
      can_unlock: canUnlock,
      upgrade_price_rub: upgradePriceRub,
      unlimited: isUnlimited,
      has_subscription_coverage: Boolean(existingCoverage?.subscription_id),
      reason,
    });
  } catch (error: any) {
    logApiError("commercial.projects.unlock-access", requestId, error, { project_id: projectId, package_mode: targetMode });
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось проверить доступ к пакету" });
  }
}
