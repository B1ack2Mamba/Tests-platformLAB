import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCommercialEvaluation } from "@/lib/commercialEvaluation";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";
import { isEvaluationPackage, isPackageAccessible, type EvaluationPackage } from "@/lib/commercialGoals";
import { parseProjectSummary } from "@/lib/projectRoutingMeta";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

const MAX_BATCH_SIZE = 3;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
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
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id)
      .maybeSingle();
    let data: any = initialProject.data;
    let error: any = initialProject.error;
    if (isRegistrySchemaMissing(error)) {
      const fallback = await authed.supabaseAdmin
        .from("commercial_projects")
        .select(baseSelect)
        .eq("workspace_id", workspace.workspace_id)
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

    const unlockedMode = ((data as any).unlocked_package_mode || null) as EvaluationPackage | null;
    const modeToBuild = requestedMode || unlockedMode;

    if (!modeToBuild) {
      return res.status(200).json({ ok: true, fully_done, completed, total, evaluation: null, unlocked_package_mode: unlockedMode });
    }

    if (!isPackageAccessible(unlockedMode, modeToBuild)) {
      return res.status(403).json({ ok: false, error: "Этот уровень результата ещё не открыт" });
    }

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

    const totalBatches = stage === "tests" ? Math.ceil(attempts.length / Math.max(1, batchSize)) : 1;
    const currentBatch = stage === "tests" ? Math.floor(Math.max(0, batchStart) / Math.max(1, batchSize)) + 1 : 1;
    const hasMore = stage === "tests" ? Math.max(0, batchStart) + Math.max(1, batchSize) < attempts.length : false;

    return res.status(200).json({ ok: true, fully_done, completed, total, evaluation, unlocked_package_mode: unlockedMode, stage, has_more: hasMore, batch: { current: currentBatch, total: totalBatches } });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось собрать оценку" });
  }
}
