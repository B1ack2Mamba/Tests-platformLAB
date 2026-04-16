import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCommercialEvaluation } from "@/lib/commercialEvaluation";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";
import { isEvaluationPackage, isPackageAccessible, type EvaluationPackage } from "@/lib/commercialGoals";
import { parseProjectSummary } from "@/lib/projectRoutingMeta";

const EVALUATION_CACHE_VERSION = "v2-light-ai-plus";

type CachedRow = {
  evaluation: any;
  cache_key: string;
  built_at: string | null;
  status: string | null;
  error_message: string | null;
};

function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function buildCacheKey(input: any) {
  return crypto.createHash("sha256").update(stableStringify(input)).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const requestedModeRaw = typeof req.query.mode === "string" ? req.query.mode : "";
  const requestedMode = isEvaluationPackage(requestedModeRaw) ? (requestedModeRaw as EvaluationPackage) : null;
  const customRequest = typeof req.query.custom_request === "string" ? req.query.custom_request.trim() : "";
  const fitEnabled = typeof req.query.fit_enabled === "string" ? req.query.fit_enabled === "1" : false;
  const fitRequest = typeof req.query.fit_request === "string" ? req.query.fit_request.trim() : "";
  const fitProfileId = typeof req.query.fit_profile_id === "string" ? req.query.fit_profile_id.trim() : "";
  const refresh = typeof req.query.refresh === "string" ? req.query.refresh === "1" : false;
  if (!id) return res.status(400).json({ ok: false, error: "id is required" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { data, error } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        title,
        goal,
        package_mode,
        unlocked_package_mode,
        target_role,
        summary,
        commercial_people(full_name, email, current_position, notes),
        commercial_project_tests(test_slug),
        commercial_project_attempts(id, test_slug, test_title, result, created_at, updated_at)
      `)
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });

    const parsedSummary = parseProjectSummary((data as any).summary);
    const attempts = (((data as any).commercial_project_attempts || []) as Array<any>).map((item) => ({
      id: String(item?.id || ""),
      test_slug: String(item?.test_slug || ""),
      test_title: item?.test_title ? String(item.test_title) : null,
      result: item?.result ?? null,
      created_at: item?.created_at ? String(item.created_at) : null,
      updated_at: item?.updated_at ? String(item.updated_at) : null,
    }));
    const tests = ((data as any).commercial_project_tests || []) as Array<any>;
    const completed = new Set(attempts.map((item) => item.test_slug)).size;
    const total = tests.length;
    const fully_done = total > 0 && completed >= total;

    const unlockedMode = ((data as any).unlocked_package_mode || null) as EvaluationPackage | null;
    const modeToBuild = requestedMode || unlockedMode;

    if (!modeToBuild) {
      return res.status(200).json({ ok: true, fully_done, completed, total, evaluation: null, unlocked_package_mode: unlockedMode, cached: false });
    }

    if (!isPackageAccessible(unlockedMode, modeToBuild)) {
      return res.status(403).json({ ok: false, error: "Этот уровень результата ещё не открыт" });
    }

    const slugs = Array.from(new Set(attempts.map((item) => String(item.test_slug || "")).filter(Boolean)));
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

    const cacheKey = buildCacheKey({
      version: EVALUATION_CACHE_VERSION,
      mode: modeToBuild,
      project: {
        id: (data as any).id,
        title: (data as any).title,
        goal: (data as any).goal,
        target_role: (data as any).target_role || null,
        package_mode: (data as any).package_mode || null,
        unlocked_package_mode: unlockedMode,
        summary: (data as any).summary || null,
        person_name: (data as any).commercial_people?.full_name || null,
        person_email: (data as any).commercial_people?.email || null,
        current_position: (data as any).commercial_people?.current_position || null,
        notes: (data as any).commercial_people?.notes || null,
        routing_meta: parsedSummary.meta || null,
      },
      attempts: attempts.map((item) => ({
        id: item.id,
        slug: item.test_slug,
        title: item.test_title,
        created_at: item.created_at,
        updated_at: item.updated_at,
        result: item.result,
      })),
      options: {
        customRequest: customRequest || null,
        fitEnabled,
        fitRequest: fitEnabled ? fitRequest || null : null,
        fitProfileId: fitEnabled ? fitProfileId || null : null,
      },
    });

    if (!refresh) {
      const { data: cached, error: cachedErr } = await authed.supabaseAdmin
        .from("commercial_project_evaluation_cache")
        .select("evaluation,cache_key,built_at,status,error_message")
        .eq("project_id", id)
        .eq("package_mode", modeToBuild)
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (!cachedErr && cached?.evaluation && cached.status === "ready") {
        return res.status(200).json({
          ok: true,
          fully_done,
          completed,
          total,
          evaluation: cached.evaluation,
          unlocked_package_mode: unlockedMode,
          cached: true,
          built_at: cached.built_at,
        });
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
        includeCompetencyBodies: false,
      }
    );

    await authed.supabaseAdmin.from("commercial_project_evaluation_cache").upsert(
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

    return res.status(200).json({
      ok: true,
      fully_done,
      completed,
      total,
      evaluation,
      unlocked_package_mode: unlockedMode,
      cached: false,
      built_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось собрать оценку" });
  }
}
