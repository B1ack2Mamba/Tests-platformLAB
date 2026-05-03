import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getGoalDefinition, isAssessmentGoal, type AssessmentGoal } from "@/lib/commercialGoals";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

function normalizeGoal(value: any): AssessmentGoal | null {
  return isAssessmentGoal(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const projectId = String(body.project_id || "").trim();
  const personName = String(body.person_name || "").trim();
  const personEmailRaw = String(body.person_email ?? "").trim();
  const currentPositionRaw = String(body.current_position ?? "").trim();
  const targetRoleRaw = String(body.target_role ?? "").trim();
  const notesRaw = String(body.notes ?? "").trim();
  const registryCommentRaw = String(body.registry_comment ?? "").trim();
  const goal = normalizeGoal(body.goal);

  if (!projectId) return res.status(400).json({ ok: false, error: "project_id is required" });
  if (!goal) return res.status(400).json({ ok: false, error: "Не выбрана цель оценки" });
  if (!personName) return res.status(400).json({ ok: false, error: "Укажи имя и фамилию" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { data: project, error: projectError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .select("id, person_id, workspace_id")
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ ok: false, error: "Проект не найден" });
    if (!(project as any).person_id) return res.status(400).json({ ok: false, error: "У проекта нет участника" });

    const goalDef = getGoalDefinition(goal);
    if (!goalDef) return res.status(400).json({ ok: false, error: "Цель оценки не распознана" });

    const normalizedEmail = personEmailRaw ? personEmailRaw.toLowerCase() : null;
    const currentPosition = currentPositionRaw || null;
    const targetRole = targetRoleRaw || null;
    const notes = notesRaw || null;
    const registryComment = registryCommentRaw || null;

    const { error: personError } = await authed.supabaseAdmin
      .from("commercial_people")
      .update({
        full_name: personName,
        email: normalizedEmail,
        current_position: currentPosition,
        notes,
      })
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", (project as any).person_id);

    if (personError) throw personError;

    const title = `${goalDef.shortTitle} · ${personName}`;
    let { error: updateProjectError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .update({
        goal,
        title,
        target_role: targetRole,
        registry_comment: registryComment,
        registry_comment_updated_at: registryComment ? new Date().toISOString() : null,
        registry_comment_updated_by: registryComment ? authed.user.id : null,
      })
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", projectId);
    if (isRegistrySchemaMissing(updateProjectError)) {
      const fallback = await authed.supabaseAdmin
        .from("commercial_projects")
        .update({
          goal,
          title,
          target_role: targetRole,
        })
        .eq("workspace_id", workspace.workspace_id)
        .eq("id", projectId);
      updateProjectError = fallback.error;
    }

    if (updateProjectError) throw updateProjectError;

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось обновить проект" });
  }
}
