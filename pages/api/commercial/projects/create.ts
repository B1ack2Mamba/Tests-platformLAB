import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { chargeWallet } from "@/lib/serverWallet";
import { getActiveWorkspaceSubscription } from "@/lib/serverWorkspaceSubscription";
import {
  getEvaluationPackagePriceRub,
  getGoalDefinition,
  isAssessmentGoal,
  type AssessmentGoal,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";
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

function normalizeRoutingMode(value: any): RoutingMode {
  return isRoutingMode(value) ? value : "goal";
}

const PROJECT_CREATION_PACKAGE: EvaluationPackage = "premium_ai_plus";
const PROJECT_CREATION_PRICE_RUB = getEvaluationPackagePriceRub(PROJECT_CREATION_PACKAGE);
const PROJECT_CREATION_PRICE_KOPEKS = PROJECT_CREATION_PRICE_RUB * 100;

async function getWalletBalanceKopeks(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("balance_kopeks")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Number((data as any)?.balance_kopeks ?? 0);
}

function paymentRequiredPayload(balanceKopeks: number, activeSubscription: any = null) {
  return {
    ok: false,
    payment_required: true,
    reason: "project_creation_payment_required",
    error: `Для создания проекта нужен активный тариф или ${PROJECT_CREATION_PRICE_RUB.toLocaleString("ru-RU")} ₽ на балансе.`,
    price_rub: PROJECT_CREATION_PRICE_RUB,
    price_kopeks: PROJECT_CREATION_PRICE_KOPEKS,
    balance_kopeks: balanceKopeks,
    active_subscription: activeSubscription,
  };
}

async function cleanupCreatedProject(supabaseAdmin: any, params: { workspaceId: string; projectId?: string | null; personId?: string | null }) {
  const { workspaceId, projectId, personId } = params;
  if (projectId) {
    await supabaseAdmin.from("commercial_projects").delete().eq("id", projectId).eq("workspace_id", workspaceId);
  }
  if (personId) {
    await supabaseAdmin.from("commercial_people").delete().eq("id", personId).eq("workspace_id", workspaceId);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const requestedGoal = normalizeGoal(body.goal);
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

    const isUnlimited = isTestUnlimitedEmail(authed.user.email);
    const activeSubscription = isUnlimited
      ? null
      : await getActiveWorkspaceSubscription(authed.supabaseAdmin, workspace.workspace_id);
    const hasSubscriptionProject = Boolean(activeSubscription && activeSubscription.projects_remaining > 0);
    const balanceBeforeKopeks = isUnlimited
      ? TEST_UNLIMITED_BALANCE_KOPEKS
      : await getWalletBalanceKopeks(authed.supabaseAdmin, authed.user.id);

    if (!isUnlimited && !hasSubscriptionProject && balanceBeforeKopeks < PROJECT_CREATION_PRICE_KOPEKS) {
      return res.status(402).json(paymentRequiredPayload(balanceBeforeKopeks, activeSubscription));
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
        package_mode: PROJECT_CREATION_PACKAGE,
        title: projectTitle,
        target_role: targetRole,
        summary: encodedSummary,
        status: "draft",
        unlocked_package_mode: PROJECT_CREATION_PACKAGE,
        unlocked_package_paid_at: new Date().toISOString(),
        unlocked_package_price_kopeks: 0,
      })
      .select("id, invite_token")
      .single();

    if (projectError) {
      await cleanupCreatedProject(authed.supabaseAdmin, {
        workspaceId: workspace.workspace_id,
        personId: (person as any).id,
      });
      throw projectError;
    }

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
    if (projectTestsError) {
      await cleanupCreatedProject(authed.supabaseAdmin, {
        workspaceId: workspace.workspace_id,
        projectId: (project as any).id,
        personId: (person as any).id,
      });
      throw projectTestsError;
    }

    let balanceKopeks: number | null = isUnlimited ? TEST_UNLIMITED_BALANCE_KOPEKS : balanceBeforeKopeks;
    let billedBySubscription = false;
    let subscriptionRemaining: number | null = null;

    if (!isUnlimited && hasSubscriptionProject) {
      const { data: consumeData, error: consumeError } = await authed.supabaseAdmin.rpc("consume_commercial_workspace_subscription", {
        p_workspace_id: workspace.workspace_id,
        p_project_id: (project as any).id,
      });

      if (consumeError) {
        await cleanupCreatedProject(authed.supabaseAdmin, {
          workspaceId: workspace.workspace_id,
          projectId: (project as any).id,
          personId: (person as any).id,
        });
        throw consumeError;
      }

      if ((consumeData as any)?.ok && ((consumeData as any)?.applied || (consumeData as any)?.already)) {
        billedBySubscription = true;
        subscriptionRemaining = Number((consumeData as any)?.remaining ?? activeSubscription?.projects_remaining ?? 0);
      }
    }

    if (!isUnlimited && !billedBySubscription) {
      try {
        const debitData = await chargeWallet(authed.supabaseAdmin, {
          userId: authed.user.id,
          amountKopeks: PROJECT_CREATION_PRICE_KOPEKS,
          reason: "commercial_project_creation",
          ref: `commercial-project-create:${(project as any).id}:${PROJECT_CREATION_PACKAGE}`,
        });
        balanceKopeks = Number(debitData.balance_kopeks ?? 0);
      } catch {
        await cleanupCreatedProject(authed.supabaseAdmin, {
          workspaceId: workspace.workspace_id,
          projectId: (project as any).id,
          personId: (person as any).id,
        });
        const latestBalance = await getWalletBalanceKopeks(authed.supabaseAdmin, authed.user.id).catch(() => balanceBeforeKopeks);
        return res.status(402).json(paymentRequiredPayload(latestBalance, activeSubscription));
      }
    }

    const { error: unlockError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .update({
        unlocked_package_mode: PROJECT_CREATION_PACKAGE,
        unlocked_package_paid_at: new Date().toISOString(),
        unlocked_package_price_kopeks: isUnlimited || billedBySubscription ? 0 : PROJECT_CREATION_PRICE_KOPEKS,
      })
      .eq("id", (project as any).id)
      .eq("workspace_id", workspace.workspace_id);

    if (unlockError) throw unlockError;

    return res.status(200).json({
      ok: true,
      project_id: (project as any).id,
      invite_token: (project as any).invite_token || null,
      package_mode: PROJECT_CREATION_PACKAGE,
      charged_rub: isUnlimited || billedBySubscription ? 0 : PROJECT_CREATION_PRICE_RUB,
      balance_kopeks: balanceKopeks,
      used_subscription: billedBySubscription,
      subscription_remaining: subscriptionRemaining,
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось создать проект" });
  }
}
