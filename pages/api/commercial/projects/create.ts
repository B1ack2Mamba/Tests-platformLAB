import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import {
  getGoalDefinition,
  isAssessmentGoal,
  isEvaluationPackage,
  type AssessmentGoal,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import {
  getClosestGoalForCompetencies,
  getCompetencyLongLabel,
  getCompetencyShortLabel,
  isRoutingMode,
  normalizeCompetencyIds,
  type RoutingMode,
} from "@/lib/competencyRouter";
import { encodeProjectSummary } from "@/lib/projectRoutingMeta";
import { getTestDisplayTitle } from "@/lib/testTitles";

function normalizeGoal(value: any): AssessmentGoal | null {
  return isAssessmentGoal(value) ? value : null;
}

function normalizePackage(value: any): EvaluationPackage {
  return isEvaluationPackage(value) ? value : "basic";
}

function normalizeRoutingMode(value: any): RoutingMode {
  return isRoutingMode(value) ? value : "goal";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const requestedGoal = normalizeGoal(body.goal);
  const packageMode = normalizePackage(body.package_mode);
  const routingMode = normalizeRoutingMode(body.selection_mode || body.routing_mode);
  const competencyIds = normalizeCompetencyIds(body.selected_competency_ids);
  const personName = String(body.person_name || "").trim();
  const personEmail = String(body.person_email || "").trim() || null;
  const currentPosition = String(body.current_position || "").trim() || null;
  const targetRole = String(body.target_role || "").trim() || null;
  const notes = String(body.notes || "").trim() || null;
  const manualTests: string[] = Array.isArray(body.tests)
    ? Array.from(new Set<string>(body.tests.map((item: any) => String(item || "").trim()).filter(Boolean)))
    : [];

  let goal: AssessmentGoal | null = requestedGoal;
  if (routingMode === "competency") {
    if (!competencyIds.length) {
      return res.status(400).json({ ok: false, error: "Выбери хотя бы одну компетенцию" });
    }
    goal = requestedGoal || getClosestGoalForCompetencies(competencyIds) || "general_assessment";
  }

  if (!goal) return res.status(400).json({ ok: false, error: "Не выбрана цель оценки" });
  if (!personName) return res.status(400).json({ ok: false, error: "Укажи имя и фамилию" });

  const definition = getGoalDefinition(goal);
  if (!definition) return res.status(400).json({ ok: false, error: "Цель оценки не распознана" });

  const selectionLabel = routingMode === "competency" ? getCompetencyShortLabel(competencyIds) : definition.shortTitle;
  const projectTitle = routingMode === "competency"
    ? `${selectionLabel} · ${personName}`
    : `${definition.shortTitle} · ${personName}`;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const testsToUse = manualTests;
    if (!testsToUse.length) {
      return res.status(400).json({ ok: false, error: "Нужно выбрать хотя бы один тест" });
    }

    const summaryText = routingMode === "competency"
      ? [
          "Режим проекта: оценка по компетенциям.",
          `Выбрано: ${getCompetencyLongLabel(competencyIds)}.`,
          `Аналитическая опора внутри системы: ${definition.shortTitle}.`,
          targetRole ? `Будущая предполагаемая должность: ${targetRole}.` : null,
          notes ? `Контекст специалиста: ${notes}` : null,
        ].filter(Boolean).join(" ")
      : [
          `Цель проекта: ${definition.shortTitle}.`,
          definition.description,
          targetRole ? `Будущая предполагаемая должность: ${targetRole}.` : null,
          notes ? `Контекст специалиста: ${notes}` : null,
        ].filter(Boolean).join(" ");

    const encodedSummary = encodeProjectSummary(summaryText, {
      version: 1,
      mode: routingMode,
      goal,
      competencyIds: routingMode === "competency" ? competencyIds : [],
      selectionLabel,
    });

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
        summary: encodedSummary,
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
        test_title: getTestDisplayTitle(slug, match?.title),
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
