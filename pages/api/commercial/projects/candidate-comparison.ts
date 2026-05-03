import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { buildCandidateComparison } from "@/lib/candidateAnalysis/candidateComparison";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

function arrayOfStrings(value: any) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
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
  const projectIds = arrayOfStrings(body.project_ids).slice(0, 20);
  const fitProfileId = String(body.fit_profile_id || "").trim();
  const fitRequest = String(body.fit_request || "").trim();
  const includeRegistry = body.include_registry !== false;

  if (!projectIds.length) return res.status(400).json({ ok: false, error: "project_ids is required" });

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
    const initialProjects = await authed.supabaseAdmin
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
    let data: any = initialProjects.data;
    let error: any = initialProjects.error;
    if (isRegistrySchemaMissing(error)) {
      const fallback = await authed.supabaseAdmin
        .from("commercial_projects")
        .select(baseSelect)
        .eq("workspace_id", workspace.workspace_id)
        .in("id", projectIds);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const rows = ((data || []) as Array<any>).sort((a, b) => projectIds.indexOf(String(a.id)) - projectIds.indexOf(String(b.id)));
    const comparison = await buildCandidateComparison({
      candidates: rows.map((row) => ({
        project: {
          id: row.id,
          title: row.title,
          goal: row.goal,
          package_mode: row.unlocked_package_mode || row.package_mode || null,
          target_role: row.target_role || null,
          registry_comment: row.registry_comment || null,
          person_name: row.commercial_people?.full_name || null,
          person_email: row.commercial_people?.email || null,
          current_position: row.commercial_people?.current_position || null,
          notes: row.commercial_people?.notes || null,
        },
        attempts: row.commercial_project_attempts || [],
      })),
      fitProfileId: fitProfileId || null,
      fitRequest: fitRequest || null,
      includeRegistry,
    });

    return res.status(200).json({ ok: true, ...comparison });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сравнить кандидатов" });
  }
}
