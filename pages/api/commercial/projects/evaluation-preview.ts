import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import { buildCompactEvaluationPreview } from "@/lib/commercialEvaluationPreview";
import { getEvaluationPackageDefinition, isEvaluationPackage, type EvaluationPackage } from "@/lib/commercialGoals";
import { requireUser } from "@/lib/serverAuth";

function isCacheUnavailable(error: any) {
  const message = String(error?.message || error?.details || error?.hint || "");
  return /commercial_project_evaluation_cache|schema cache|relation .* does not exist|could not find/iu.test(message);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  const projectId = typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!projectId) return res.status(400).json({ ok: false, request_id: requestId, error: "id is required" });

  try {
    const access = await canAccessCommercialProject(authed.supabaseAdmin, authed.user, projectId);
    if (!access.found) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!access.allowed) return res.status(403).json({ ok: false, request_id: requestId, error: "Нет доступа к проекту" });

    const { data: project, error: projectError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select("unlocked_package_mode")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError) throw projectError;

    const rawMode = (project as any)?.unlocked_package_mode;
    if (!isEvaluationPackage(rawMode)) {
      return res.status(200).json({ ok: true, request_id: requestId, state: "locked", preview: null });
    }
    const mode = rawMode as EvaluationPackage;

    const { data: cacheRows, error: cacheError } = await authed.supabaseAdmin
      .from("commercial_project_evaluation_cache")
      .select("evaluation,built_at")
      .eq("project_id", projectId)
      .eq("package_mode", mode)
      .eq("status", "ready")
      .order("built_at", { ascending: false })
      .limit(24);

    if (cacheError) {
      if (isCacheUnavailable(cacheError)) {
        return res.status(200).json({ ok: true, request_id: requestId, state: "empty", preview: null });
      }
      throw cacheError;
    }

    const modeTitle = getEvaluationPackageDefinition(mode)?.title || "Результат";
    for (const row of cacheRows || []) {
      const preview = buildCompactEvaluationPreview((row as any)?.evaluation, modeTitle);
      if (!preview) continue;
      return res.status(200).json({
        ok: true,
        request_id: requestId,
        state: "ready",
        preview,
        built_at: (row as any)?.built_at || null,
      });
    }

    return res.status(200).json({ ok: true, request_id: requestId, state: "empty", preview: null });
  } catch (error: any) {
    logApiError("commercial.projects.evaluation_preview", requestId, error, { project_id: projectId });
    return res.status(400).json({
      ok: false,
      request_id: requestId,
      error: error?.message || "Не удалось загрузить сохранённый результат",
    });
  }
}
