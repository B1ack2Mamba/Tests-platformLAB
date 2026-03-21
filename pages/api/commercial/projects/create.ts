import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getGoalDefinition, isEvaluationPackage, type AssessmentGoal, type EvaluationPackage } from "@/lib/commercialGoals";

function normalizeGoal(value: any): AssessmentGoal | null {
  return value === "role_fit" || value === "general_assessment" || value === "motivation" ? value : null;
}

function normalizePackage(value: any): EvaluationPackage {
  return isEvaluationPackage(value) ? value : "basic";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const goal = normalizeGoal(body.goal);
  const packageMode = normalizePackage(body.package_mode);
  const personName = String(body.person_name || "").trim();
  const personEmail = String(body.person_email || "").trim() || null;
  const currentPosition = String(body.current_position || "").trim() || null;
  const targetRole = String(body.target_role || "").trim() || null;
  const notes = String(body.notes || "").trim() || null;
  const manualTests = Array.isArray(body.tests)
    ? Array.from(new Set(body.tests.map((item: any) => String(item || "").trim()).filter(Boolean)))
    : [];

  if (!goal) return res.status(400).json({ ok: false, error: "Не выбрана цель оценки" });
  if (!personName) return res.status(400).json({ ok: false, error: "Укажи имя и фамилию" });

  const definition = getGoalDefinition(goal);
  if (!definition) return res.status(400).json({ ok: false, error: "Цель оценки не распознана" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const testsToUse = manualTests;
    if (!testsToUse.length) {
      return res.status(400).json({ ok: false, error: "Нужно выбрать хотя бы один тест" });
    }

    const { data: person, error: personError } = await authed.supabaseAdmin
      .from("commercial_people")
      .insert({
        workspace_id: workspace.workspace_id,
        full_name: personName,
        email: personEmail,
        current_position: currentPosition,
        notes,
        created_by: authed.user.id,
      })
      .select("id, full_name")
      .single();

    if (personError) throw personError;

    const projectTitle = `${definition.shortTitle} · ${personName}`;
    const { data: project, error: projectError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .insert({
        workspace_id: workspace.workspace_id,
        created_by: authed.user.id,
        person_id: (person as any).id,
        goal,
        package_mode: packageMode,
        title: projectTitle,
        target_role: targetRole,
        summary: notes || definition.description,
        status: "draft",
      })
      .select("id, invite_token")
      .single();

    if (projectError) throw projectError;

    const { data: testRows, error: testsError } = await authed.supabaseAdmin
      .from("tests")
      .select("slug, title")
      .in("slug", testsToUse);

    if (testsError) throw testsError;

    const rows = testsToUse.map((slug, index) => {
      const match = (testRows || []).find((item: any) => item.slug === slug);
      return {
        project_id: (project as any).id,
        test_slug: slug,
        test_title: match?.title || slug,
        sort_order: index,
      };
    });

    const { error: projectTestsError } = await authed.supabaseAdmin.from("commercial_project_tests").insert(rows);
    if (projectTestsError) throw projectTestsError;

    return res.status(200).json({ ok: true, project_id: (project as any).id, invite_token: (project as any).invite_token || null });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось создать проект" });
  }
}
