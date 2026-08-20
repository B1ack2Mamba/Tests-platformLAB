import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import { isPackageAccessible } from "@/lib/commercialGoals";
import { canUseIncompleteProjectResults } from "@/lib/incompleteProjectAccess";
import { isTestUnlimitedEmail } from "@/lib/testWallet";
import {
  getCommercialAiPlusRefreshAccess,
  reserveCommercialAiPlusRefresh,
} from "@/lib/serverCommercialAiRefresh";
import { AI_PLUS_REFRESH_PRICE_KOPEKS } from "@/lib/commercialAiRefresh";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  const projectId = String(req.method === "GET" ? req.query.project_id || "" : req.body?.project_id || "").trim();
  if (!projectId) return res.status(400).json({ ok: false, request_id: requestId, error: "project_id is required" });

  try {
    const access = await canAccessCommercialProject(authed.supabaseAdmin, authed.user, projectId);
    if (!access.found) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!access.allowed) return res.status(403).json({ ok: false, request_id: requestId, error: "Нет доступа к проекту" });

    const { data: project, error: projectError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select("id,workspace_id,unlocked_package_mode,commercial_project_tests(test_slug),commercial_project_attempts(test_slug)")
      .eq("id", projectId)
      .eq("workspace_id", access.project!.workspace_id)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!isPackageAccessible((project as any).unlocked_package_mode || null, "premium_ai_plus")) {
      return res.status(400).json({ ok: false, request_id: requestId, error: "Сначала откройте полный анализ Премиум AI+" });
    }

    const tests = ((project as any).commercial_project_tests || []) as Array<{ test_slug?: string }>;
    const attempts = ((project as any).commercial_project_attempts || []) as Array<{ test_slug?: string }>;
    const completed = new Set(attempts.map((item) => item.test_slug).filter(Boolean)).size;
    const resultsReady = tests.length > 0 && (completed >= tests.length || canUseIncompleteProjectResults(authed.user.email, completed, tests.length));
    if (!resultsReady) {
      return res.status(400).json({ ok: false, request_id: requestId, error: "Обновление доступно после завершения всех тестов" });
    }

    const params = {
      workspaceId: access.project!.workspace_id,
      projectId,
      userId: authed.user.id,
      unlimited: isTestUnlimitedEmail(authed.user.email),
    };

    if (req.method === "GET") {
      const status = await getCommercialAiPlusRefreshAccess(authed.supabaseAdmin, params);
      return res.status(200).json({ ...status, request_id: requestId });
    }

    const operationKey = String(req.body?.operation_key || "").trim();
    try {
      const reservation = await reserveCommercialAiPlusRefresh(authed.supabaseAdmin, { ...params, operationKey });
      return res.status(200).json({ ...reservation, request_id: requestId });
    } catch (reservationError: any) {
      const message = String(reservationError?.message || "");
      if (/insufficient|недостаточно|не хватает/iu.test(message)) {
        const { data: wallet } = await authed.supabaseAdmin
          .from("wallets")
          .select("balance_kopeks")
          .eq("user_id", authed.user.id)
          .maybeSingle();
        return res.status(402).json({
          ok: false,
          request_id: requestId,
          code: "INSUFFICIENT_BALANCE",
          error: "На балансе недостаточно средств для обновления анализа",
          balance_kopeks: Number((wallet as any)?.balance_kopeks ?? 0),
          price_kopeks: AI_PLUS_REFRESH_PRICE_KOPEKS,
        });
      }
      throw reservationError;
    }
  } catch (error: any) {
    logApiError("commercial.projects.ai_plus_refresh", requestId, error, { project_id: projectId, method: req.method });
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось подготовить обновление анализа" });
  }
}
