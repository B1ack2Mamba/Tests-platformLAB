import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";
import type { EvaluationPackage } from "@/lib/commercialGoals";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  const fitProfileId = typeof req.query.fit_profile_id === "string" ? req.query.fit_profile_id.trim() : "";
  const fitRequest = typeof req.query.fit_request === "string" ? req.query.fit_request.trim() : "";
  const includeRegistry = typeof req.query.include_registry === "string" ? req.query.include_registry !== "0" : true;
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
        commercial_people(full_name, email, current_position, notes),
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
        commercial_people(full_name, email, current_position, notes),
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

    const attempts = ((data as any).commercial_project_attempts || []) as Array<any>;
    const analysis = await buildCandidateRegistryAnalysis({
      project: {
        id: (data as any).id,
        title: (data as any).title,
        goal: (data as any).goal,
        package_mode: ((data as any).unlocked_package_mode || (data as any).package_mode || null) as EvaluationPackage | null,
        target_role: (data as any).target_role || null,
        registry_comment: (data as any).registry_comment || null,
        person_name: (data as any).commercial_people?.full_name || null,
        person_email: (data as any).commercial_people?.email || null,
        current_position: (data as any).commercial_people?.current_position || null,
        notes: (data as any).commercial_people?.notes || null,
      },
      attempts,
      fitProfileId: fitProfileId || null,
      fitRequest: fitRequest || null,
      includeRegistry,
    });

    return res.status(200).json({ ok: true, analysis });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось собрать анализ кандидата" });
  }
}
