import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCommercialEvaluation } from "@/lib/commercialEvaluation";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";
import { isEvaluationPackage, isPackageAccessible, type EvaluationPackage } from "@/lib/commercialGoals";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const requestedModeRaw = typeof req.query.mode === "string" ? req.query.mode : "";
  const requestedMode = isEvaluationPackage(requestedModeRaw) ? (requestedModeRaw as EvaluationPackage) : null;
  const customRequest = typeof req.query.custom_request === "string" ? req.query.custom_request.trim() : "";
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
        commercial_people(full_name),
        commercial_project_tests(test_slug),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `)
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });

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

    const evaluation = await buildCommercialEvaluation(
      {
        title: (data as any).title,
        goal: (data as any).goal,
        package_mode: modeToBuild,
        target_role: (data as any).target_role || null,
        person_name: (data as any).commercial_people?.full_name || null,
      },
      attempts,
      modeToBuild,
      {
        interpretationKeysBySlug: keysBySlug,
        aiPlusRequest: customRequest || null,
      }
    );

    return res.status(200).json({ ok: true, fully_done, completed, total, evaluation, unlocked_package_mode: unlockedMode });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось собрать оценку" });
  }
}
