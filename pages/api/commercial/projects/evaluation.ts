import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "crypto";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import { buildCommercialEvaluation } from "@/lib/commercialEvaluation";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";
import { isEvaluationPackage, isPackageAccessible, type EvaluationPackage } from "@/lib/commercialGoals";
import { parseProjectSummary } from "@/lib/projectRoutingMeta";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";
import { canUseIncompleteProjectResults } from "@/lib/incompleteProjectAccess";

const MAX_BATCH_SIZE = 3;
const EVALUATION_CACHE_VERSION = "commercial-evaluation-cache-v1";

export const config = {
  maxDuration: 300,
};

function normalizeForHash(value: any): any {
  if (Array.isArray(value)) return value.map((item) => normalizeForHash(item));
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = normalizeForHash(value[key]);
      return acc;
    }, {});
}

function hashJson(value: any) {
  return createHash("sha256").update(JSON.stringify(normalizeForHash(value))).digest("hex");
}

function isEvaluationCacheUnavailable(error: any) {
  const message = String(error?.message || error?.details || error?.hint || "");
  return /commercial_project_evaluation_cache|schema cache|relation .* does not exist|could not find/i.test(message);
}

function buildEvaluationCacheKey(args: {
  project: any;
  attempts: Array<any>;
  tests: Array<any>;
  mode: EvaluationPackage;
  stage: string;
  batchStart: number;
  batchSize: number;
  customRequest: string;
  fitEnabled: boolean;
  fitRequest: string;
  fitProfileId: string;
  keysBySlug: Record<string, any>;
  routingMeta: any;
}) {
  return hashJson({
    version: EVALUATION_CACHE_VERSION,
    mode: args.mode,
    stage: args.stage,
    batchStart: args.stage === "tests" ? args.batchStart : 0,
    batchSize: args.stage === "tests" ? args.batchSize : 0,
    customRequest: args.customRequest.trim(),
    fitEnabled: args.fitEnabled,
    fitRequest: args.fitRequest.trim(),
    fitProfileId: args.fitProfileId.trim(),
    project: {
      id: args.project?.id,
      title: args.project?.title,
      goal: args.project?.goal,
      target_role: args.project?.target_role,
      package_mode: args.project?.package_mode,
      unlocked_package_mode: args.project?.unlocked_package_mode,
      registry_comment: args.project?.registry_comment,
      summary: args.project?.summary,
      person: args.project?.commercial_people || null,
      routing_meta: args.routingMeta || null,
    },
    tests: args.tests.map((item) => ({
      test_slug: item?.test_slug,
      test_title: item?.test_title,
      sort_order: item?.sort_order,
    })),
    attempts: args.attempts.map((item) => ({
      test_slug: item?.test_slug,
      test_title: item?.test_title,
      created_at: item?.created_at,
      result: item?.result,
    })),
    keysBySlug: args.keysBySlug,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const requestedModeRaw = typeof req.query.mode === "string" ? req.query.mode : "";
  const requestedMode = isEvaluationPackage(requestedModeRaw) ? (requestedModeRaw as EvaluationPackage) : null;
  const customRequest = typeof req.query.custom_request === "string" ? req.query.custom_request.trim() : "";
  const fitEnabled = typeof req.query.fit_enabled === "string" ? req.query.fit_enabled === "1" : false;
  const fitRequest = typeof req.query.fit_request === "string" ? req.query.fit_request.trim() : "";
  const fitProfileId = typeof req.query.fit_profile_id === "string" ? req.query.fit_profile_id.trim() : "";
  const stageRaw = typeof req.query.stage === "string" ? req.query.stage.trim() : "summary";
  const stage = stageRaw === "tests" || stageRaw === "competencies" || stageRaw === "full" ? stageRaw : "summary";
  const batchStartRaw = typeof req.query.batch_start === "string" ? Number(req.query.batch_start) : 0;
  const batchSizeRaw = typeof req.query.batch_size === "string" ? Number(req.query.batch_size) : 2;
  const batchStart = Number.isFinite(batchStartRaw) ? Math.max(0, Math.trunc(batchStartRaw)) : 0;
  const batchSize = Number.isFinite(batchSizeRaw) ? Math.max(1, Math.min(MAX_BATCH_SIZE, Math.trunc(batchSizeRaw))) : 2;
  if (!id) return res.status(400).json({ ok: false, error: "id is required" });

  try {
    const access = await canAccessCommercialProject(authed.supabaseAdmin, authed.user, id);
    if (!access.found) return res.status(404).json({ ok: false, request_id: requestId, error: "Проект не найден" });
    if (!access.allowed) return res.status(403).json({ ok: false, request_id: requestId, error: "Нет доступа к проекту" });
    const baseSelect = `
        id,
        title,
        goal,
        package_mode,
        unlocked_package_mode,
        target_role,
        summary,
        commercial_people(full_name, email, current_position, notes),
        commercial_project_tests(test_slug),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `;
    const initialProject = await authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        title,
        goal,
        package_mode,
        unlocked_package_mode,
        target_role,
        registry_comment,
        summary,
        commercial_people(full_name, email, current_position, notes),
        commercial_project_tests(test_slug),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `)
      .eq("id", id)
      .maybeSingle();
    let data: any = initialProject.data;
    let error: any = initialProject.error;
    if (isRegistrySchemaMissing(error)) {
      const fallback = await authed.supabaseAdmin
        .from("commercial_projects")
        .select(baseSelect)
        .eq("id", id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });

    const parsedSummary = parseProjectSummary((data as any).summary);

    const attempts = ((data as any).commercial_project_attempts || []) as Array<any>;
    const tests = ((data as any).commercial_project_tests || []) as Array<any>;
    const completed = new Set(attempts.map((item) => item.test_slug)).size;
    const total = tests.length;
    const fully_done = total > 0 && completed >= total;
    const partial_results_allowed = canUseIncompleteProjectResults(authed.user.email, completed, total);

    const unlockedMode = ((data as any).unlocked_package_mode || null) as EvaluationPackage | null;
    const modeToBuild = requestedMode || unlockedMode;

    if (!modeToBuild) {
      return res.status(200).json({ ok: true, request_id: requestId, fully_done, completed, total, partial_results_allowed, evaluation: null, unlocked_package_mode: unlockedMode });
    }

    if (!isPackageAccessible(unlockedMode, modeToBuild)) {
      return res.status(403).json({ ok: false, error: "Этот уровень результата ещё не открыт" });
    }

    const totalBatches = stage === "tests" ? Math.ceil(attempts.length / Math.max(1, batchSize)) : 1;
    const currentBatch = stage === "tests" ? Math.floor(Math.max(0, batchStart) / Math.max(1, batchSize)) + 1 : 1;
    const hasMore = stage === "tests" ? Math.max(0, batchStart) + Math.max(1, batchSize) < attempts.length : false;

    const needsInterpretationKeys =
      stage === "tests" ||
      stage === "full" ||
      (modeToBuild === "premium_ai_plus" && (stage === "summary" || stage === "competencies"));
    const slugs = needsInterpretationKeys
      ? Array.from(new Set(attempts.map((item) => String(item.test_slug || "")).filter(Boolean)))
      : [];
    const keysBySlug: Record<string, any> = {};
    if (slugs.length) {
      const { data: keyRows, error: keyErr } = await authed.supabaseAdmin
        .from("test_interpretations")
        .select("test_slug,content")
        .in("test_slug", slugs);
      if (!keyErr) {
        for (const row of keyRows || []) {
          keysBySlug[String((row as any).test_slug)] = (row as any).content;
        }
      }
      for (const slug of slugs) {
        if (!(slug in keysBySlug) && DEFAULT_TEST_INTERPRETATIONS[slug]) {
          keysBySlug[slug] = DEFAULT_TEST_INTERPRETATIONS[slug];
        }
      }
    }

    const cacheKey = buildEvaluationCacheKey({
      project: data,
      attempts,
      tests,
      mode: modeToBuild,
      stage,
      batchStart,
      batchSize,
      customRequest,
      fitEnabled,
      fitRequest,
      fitProfileId,
      keysBySlug,
      routingMeta: parsedSummary.meta,
    });
    const forceRefresh =
      req.query.refresh === "1" ||
      req.query.force_refresh === "1" ||
      req.query.no_cache === "1";

    if (!forceRefresh) {
      const cached = await authed.supabaseAdmin
        .from("commercial_project_evaluation_cache")
        .select("evaluation,built_at")
        .eq("project_id", id)
        .eq("package_mode", modeToBuild)
        .eq("cache_key", cacheKey)
        .eq("status", "ready")
        .maybeSingle();

      if (!cached.error && cached.data?.evaluation) {
        return res.status(200).json({
          ok: true,
          request_id: requestId,
          fully_done,
          completed,
          total,
          partial_results_allowed,
          evaluation: cached.data.evaluation,
          unlocked_package_mode: unlockedMode,
          stage,
          has_more: hasMore,
          batch: { current: currentBatch, total: totalBatches },
          cached: true,
          cached_at: (cached.data as any).built_at || null,
        });
      }
      if (cached.error && !isEvaluationCacheUnavailable(cached.error)) {
        logApiError("commercial.projects.evaluation.cache_read", requestId, cached.error, { project_id: id, stage, mode: modeToBuild });
      }
    }

    const evaluation = await buildCommercialEvaluation(
      {
        title: (data as any).title,
        goal: (data as any).goal,
        package_mode: modeToBuild,
        target_role: (data as any).target_role || null,
        person_name: (data as any).commercial_people?.full_name || null,
        person_email: (data as any).commercial_people?.email || null,
        current_position: (data as any).commercial_people?.current_position || null,
        notes: (data as any).commercial_people?.notes || null,
        registry_comment: (data as any).registry_comment || null,
        routing_meta: parsedSummary.meta,
      },
      attempts,
      modeToBuild,
      {
        interpretationKeysBySlug: keysBySlug,
        aiPlusRequest: customRequest || null,
        fitEnabled,
        fitRequest: fitRequest || null,
        fitProfileId: fitProfileId || null,
        stage,
        batchStart,
        batchSize,
      }
    );

    const cacheWrite = await authed.supabaseAdmin
      .from("commercial_project_evaluation_cache")
      .upsert(
        {
          project_id: id,
          package_mode: modeToBuild,
          cache_key: cacheKey,
          evaluation,
          status: "ready",
          error_message: null,
          built_at: new Date().toISOString(),
        },
        { onConflict: "project_id,package_mode,cache_key" }
      );
    if (cacheWrite.error && !isEvaluationCacheUnavailable(cacheWrite.error)) {
      logApiError("commercial.projects.evaluation.cache_write", requestId, cacheWrite.error, { project_id: id, stage, mode: modeToBuild });
    }

    return res.status(200).json({ ok: true, request_id: requestId, fully_done, completed, total, partial_results_allowed, evaluation, unlocked_package_mode: unlockedMode, stage, has_more: hasMore, batch: { current: currentBatch, total: totalBatches }, cached: false });
  } catch (error: any) {
    logApiError("commercial.projects.evaluation", requestId, error, { project_id: id, stage, mode: requestedMode || null });
    return res.status(400).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось собрать оценку" });
  }
}
