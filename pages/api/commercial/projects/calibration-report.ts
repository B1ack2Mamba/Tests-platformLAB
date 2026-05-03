import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";
import {
  buildCalibrationReport,
  compareAnalysisWithBenchmark,
  type ManualCalibrationBenchmark,
} from "@/lib/candidateAnalysis/calibration";
import type { EvaluationPackage } from "@/lib/commercialGoals";

function arrayOfStrings(value: any) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function asObjectOrEmpty(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rowToBenchmark(row: any): ManualCalibrationBenchmark {
  return {
    id: row.id || null,
    projectId: row.project_id || null,
    benchmarkLabel: row.benchmark_label || null,
    fitProfileId: row.fit_profile_id || null,
    fitRequest: row.fit_request || null,
    manualBaselineIndex: row.manual_baseline_index ?? null,
    manualCalibratedIndex: row.manual_calibrated_index ?? null,
    manualDomains: asObjectOrEmpty(row.manual_domains),
    manualCompetencies: asObjectOrEmpty(row.manual_competencies),
    expectedProfileType: row.expected_profile_type || null,
    manualRank: row.manual_rank || null,
    expertNotes: row.expert_notes || null,
    correctionNotes: row.correction_notes || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const requestedProjectIds = arrayOfStrings(body.project_ids).slice(0, 50);
  const onlyActive = body.only_active !== false;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);

    let casesQuery = authed.supabaseAdmin
      .from("commercial_candidate_calibration_cases")
      .select("*")
      .eq("workspace_id", workspace.workspace_id)
      .order("updated_at", { ascending: false });

    if (onlyActive) casesQuery = casesQuery.eq("is_active", true);
    if (requestedProjectIds.length) casesQuery = casesQuery.in("project_id", requestedProjectIds);

    const { data: cases, error: casesError } = await casesQuery;
    if (casesError) throw casesError;

    const rows = (cases || []) as Array<any>;
    const projectIds = Array.from(new Set(rows.map((item) => String(item.project_id)).filter(Boolean)));
    if (!projectIds.length) return res.status(200).json({ ok: true, ...buildCalibrationReport([]) });

    const { data: projects, error: projectsError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select(`
        id,
        title,
        goal,
        package_mode,
        unlocked_package_mode,
        target_role,
        registry_comment,
        commercial_people(full_name, email, current_position, notes),
        commercial_project_attempts(test_slug, test_title, result, created_at)
      `)
      .eq("workspace_id", workspace.workspace_id)
      .in("id", projectIds);
    if (projectsError) throw projectsError;

    const projectMap = new Map(((projects || []) as Array<any>).map((project) => [String(project.id), project]));
    const comparisons = [];

    for (const row of rows) {
      const project = projectMap.get(String(row.project_id));
      if (!project) continue;
      const analysis = await buildCandidateRegistryAnalysis({
        project: {
          id: project.id,
          title: project.title,
          goal: project.goal,
          package_mode: (project.unlocked_package_mode || project.package_mode || null) as EvaluationPackage | null,
          target_role: project.target_role || null,
          registry_comment: project.registry_comment || null,
          person_name: project.commercial_people?.full_name || null,
          person_email: project.commercial_people?.email || null,
          current_position: project.commercial_people?.current_position || null,
          notes: project.commercial_people?.notes || null,
        },
        attempts: project.commercial_project_attempts || [],
        fitProfileId: row.fit_profile_id || null,
        fitRequest: row.fit_request || null,
        includeRegistry: true,
      });
      comparisons.push(compareAnalysisWithBenchmark(analysis, rowToBenchmark(row)));
    }

    return res.status(200).json({ ok: true, ...buildCalibrationReport(comparisons) });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось собрать calibration report" });
  }
}
