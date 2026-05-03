import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";
import {
  calibrationBenchmarkKey,
  compareAnalysisWithBenchmark,
  type ManualCalibrationBenchmark,
} from "@/lib/candidateAnalysis/calibration";
import type { EvaluationPackage } from "@/lib/commercialGoals";

function asIntOrNull(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
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
    manualBaselineIndex: asIntOrNull(row.manual_baseline_index),
    manualCalibratedIndex: asIntOrNull(row.manual_calibrated_index),
    manualDomains: asObjectOrEmpty(row.manual_domains),
    manualCompetencies: asObjectOrEmpty(row.manual_competencies),
    expectedProfileType: row.expected_profile_type || null,
    manualRank: row.manual_rank || null,
    expertNotes: row.expert_notes || null,
    correctionNotes: row.correction_notes || null,
  };
}

async function loadProject(authed: any, workspaceId: string, projectId: string) {
  const { data, error } = await authed.supabaseAdmin
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
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data as any | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);

    if (req.method === "GET") {
      const projectId = typeof req.query.project_id === "string" ? req.query.project_id.trim() : typeof req.query.id === "string" ? req.query.id.trim() : "";
      const fitProfileId = typeof req.query.fit_profile_id === "string" ? req.query.fit_profile_id.trim() : "";
      const fitRequest = typeof req.query.fit_request === "string" ? req.query.fit_request.trim() : "";
      const withAnalysis = String(req.query.with_analysis || "0") === "1";
      if (!projectId) return res.status(400).json({ ok: false, error: "project_id is required" });

      const { data, error } = await authed.supabaseAdmin
        .from("commercial_candidate_calibration_cases")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .eq("benchmark_key", calibrationBenchmarkKey(projectId, fitProfileId || null, fitRequest || null))
        .maybeSingle();
      if (error) throw error;

      if (!withAnalysis || !data) return res.status(200).json({ ok: true, calibration_case: data || null });

      const project = await loadProject(authed, workspace.workspace_id, projectId);
      if (!project) return res.status(404).json({ ok: false, error: "Проект не найден" });

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
        fitProfileId: fitProfileId || null,
        fitRequest: fitRequest || null,
        includeRegistry: true,
      });

      return res.status(200).json({
        ok: true,
        calibration_case: data,
        analysis,
        comparison: compareAnalysisWithBenchmark(analysis, rowToBenchmark(data)),
      });
    }

    const body = typeof req.body === "object" && req.body ? req.body : {};
    const projectId = String(body.project_id || body.id || "").trim();
    if (!projectId) return res.status(400).json({ ok: false, error: "project_id is required" });

    const project = await loadProject(authed, workspace.workspace_id, projectId);
    if (!project) return res.status(404).json({ ok: false, error: "Проект не найден" });

    const fitProfileId = String(body.fit_profile_id || "").trim() || null;
    const fitRequest = String(body.fit_request || "").trim() || null;
    const payload = {
      workspace_id: workspace.workspace_id,
      project_id: projectId,
      benchmark_key: calibrationBenchmarkKey(projectId, fitProfileId, fitRequest),
      benchmark_label: String(body.benchmark_label || "").trim() || null,
      fit_profile_id: fitProfileId,
      fit_request: fitRequest,
      manual_baseline_index: asIntOrNull(body.manual_baseline_index),
      manual_calibrated_index: asIntOrNull(body.manual_calibrated_index),
      manual_domains: asObjectOrEmpty(body.manual_domains),
      manual_competencies: asObjectOrEmpty(body.manual_competencies),
      expected_profile_type: String(body.expected_profile_type || "").trim() || null,
      manual_rank: Number.isFinite(Number(body.manual_rank)) ? Math.round(Number(body.manual_rank)) : null,
      expert_notes: String(body.expert_notes || "").trim() || null,
      correction_notes: String(body.correction_notes || "").trim() || null,
      is_active: body.is_active !== false,
      updated_by: authed.user.id,
      created_by: authed.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await authed.supabaseAdmin
      .from("commercial_candidate_calibration_cases")
      .upsert(payload, { onConflict: "workspace_id,benchmark_key" })
      .select("*")
      .single();
    if (error) throw error;

    return res.status(200).json({ ok: true, calibration_case: data });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось обработать эталонный кейс" });
  }
}
