import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { encodeProjectSummary } from "@/lib/projectRoutingMeta";
import { getTestDisplayTitle } from "@/lib/testTitles";
import {
  isAssessmentGoal,
  isEvaluationPackage,
  type AssessmentGoal,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import type {
  AnyTest,
  ForcedPairTestV1,
  PairSplitTestV1,
  ColorTypesTestV1,
  USKTestV1,
  SituationalGuidanceTestV1,
  BelbinTestV1,
  EminTestV1,
  TimeManagementTestV1,
  LearningTypologyTestV1,
  PF16TestV1,
  ABC,
  Tag,
  TimeManagementTag,
  LearningTypologyChoice,
  SituationalGuidanceChoice,
  BelbinLetter,
} from "@/lib/testTypes";
import {
  scoreForcedPair,
  scorePairSplit,
  scoreColorTypes,
  scoreUSK,
  scoreSituationalGuidance,
  scoreBelbin,
  scoreEmin,
  scoreTimeManagement,
  scoreLearningTypology,
  score16PF,
  type ColorTypesAnswers,
  type BelbinAllocations,
} from "@/lib/score";

type DbTestRow = {
  slug: string | null;
  title: string | null;
  type: string | null;
  json: unknown;
  is_published?: boolean | null;
};

type DemoBody = {
  goal?: unknown;
  package_mode?: unknown;
  person_name?: unknown;
  current_position?: unknown;
  target_role?: unknown;
  include_unpublished?: unknown;
};

const DEMO_TEST_SLUGS = [
  "16pf-a",
  "negotiation-style",
  "motivation-cards",
  "belbin",
  "situational-guidance",
  "time-management",
  "learning-typology",
  "usk",
  "color-types",
  "emin",
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)] as T;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function splitTotalRandom(total: number, parts: number) {
  let remain = total;
  const out: number[] = [];
  for (let i = 0; i < parts - 1; i += 1) {
    const value = randomInt(0, remain);
    out.push(value);
    remain -= value;
  }
  out.push(remain);
  return shuffle(out);
}

function normalizeDbTest(row: DbTestRow): AnyTest | null {
  const raw = row?.json as Record<string, unknown> | null;
  const slug = String(row?.slug || raw?.slug || "").trim();
  if (!slug) return null;
  return {
    ...(raw && typeof raw === "object" ? raw : {}),
    slug,
    title: String(row?.title || raw?.title || slug),
    type: String(row?.type || raw?.type || ""),
  } as AnyTest;
}

function generateForcedPairResult(test: ForcedPairTestV1) {
  const answers = test.questions.map((q) => pickOne([q.options[0]?.tag, q.options[1]?.tag].filter(Boolean) as Tag[]));
  return scoreForcedPair(test, answers);
}

function generatePairSplitResult(test: PairSplitTestV1) {
  const answers = test.questions.map((q) => randomInt(0, Number(q.maxPoints ?? 5)));
  return scorePairSplit(test, answers);
}

function generateColorTypesResult(test: ColorTypesTestV1) {
  const abc: ABC[] = ["A", "B", "C"];
  const answers: ColorTypesAnswers = {
    q1: pickOne(abc),
    q2: pickOne(abc),
    q3: shuffle(abc),
    q4: shuffle(abc),
    q5: shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3),
    q6: shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3),
  };
  return scoreColorTypes(test, answers);
}

function generateUSKResult(test: USKTestV1) {
  const answers = test.questions.map(() => randomInt(-3, 3));
  return scoreUSK(test, answers);
}

function generateSituationalGuidanceResult(test: SituationalGuidanceTestV1) {
  const choices: SituationalGuidanceChoice[] = ["A", "B", "C", "D"];
  const answers = test.questions.map(() => pickOne(choices));
  return scoreSituationalGuidance(test, answers);
}

function generateBelbinResult(test: BelbinTestV1) {
  const letters: BelbinLetter[] = Array.isArray(test.scoring?.letters)
    ? (test.scoring.letters as BelbinLetter[])
    : ["A", "B", "C", "D", "E", "F", "G", "H"];
  const totalPerSection = Number(test.scoring?.total_per_section ?? 10);
  const allocations: BelbinAllocations = test.questions.map(() => {
    const chunks = splitTotalRandom(totalPerSection, letters.length);
    return Object.fromEntries(letters.map((letter, index) => [letter, chunks[index] ?? 0])) as Record<BelbinLetter, number>;
  });
  return scoreBelbin(test, allocations);
}

function generateEminResult(test: EminTestV1) {
  const answers = test.questions.map(() => randomInt(0, 3));
  return scoreEmin(test, answers);
}

function generateTimeManagementResult(test: TimeManagementTestV1) {
  const answers = test.questions.map((q) => pickOne(q.options.map((opt) => opt.tag) as TimeManagementTag[]));
  return scoreTimeManagement(test, answers);
}

function generateLearningTypologyResult(test: LearningTypologyTestV1) {
  const choices: LearningTypologyChoice[] = ["A", "B", "C", "D"];
  const answers = test.questions.map((q) =>
    pickOne(
      q.options
        .map((opt) => opt.code)
        .filter((code) => choices.includes(code as LearningTypologyChoice)) as LearningTypologyChoice[],
    ),
  );
  return scoreLearningTypology(test, answers);
}

function generate16PFResult(test: PF16TestV1) {
  const abc: ABC[] = ["A", "B", "C"];
  const answers = test.questions.map(() => pickOne(abc));
  return score16PF(test, {
    pf16: answers,
    gender: Math.random() > 0.5 ? "male" : "female",
    age: randomInt(19, 45),
  });
}

function buildRandomResult(test: AnyTest) {
  switch (test.slug) {
    case "negotiation-style":
      return generateForcedPairResult(test as ForcedPairTestV1);
    case "motivation-cards":
      return generatePairSplitResult(test as PairSplitTestV1);
    case "situational-guidance":
      return generateSituationalGuidanceResult(test as SituationalGuidanceTestV1);
    case "time-management":
      return generateTimeManagementResult(test as TimeManagementTestV1);
    case "usk":
      return generateUSKResult(test as USKTestV1);
    case "16pf-a":
      return generate16PFResult(test as PF16TestV1);
    case "belbin":
      return generateBelbinResult(test as BelbinTestV1);
    case "color-types":
      return generateColorTypesResult(test as ColorTypesTestV1);
    case "emin":
      return generateEminResult(test as EminTestV1);
    case "learning-typology":
      return generateLearningTypologyResult(test as LearningTypologyTestV1);
    default:
      throw new Error(`Demo generator is not implemented for slug: ${String(test.slug || "unknown")}`);
  }
}

function normalizeGoal(value: unknown): AssessmentGoal {
  return isAssessmentGoal(value) ? value : "general_assessment";
}

function normalizePackage(value: unknown): EvaluationPackage {
  return isEvaluationPackage(value) ? value : "premium_ai_plus";
}

const DEFAULT_CURRENT_POSITION = "Менеджер";
const DEFAULT_TARGET_ROLE = "Руководитель проекта";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, error: "Доступ только для администратора" });
  }

  const body: DemoBody = typeof req.body === "object" && req.body ? (req.body as DemoBody) : {};
  const goal = normalizeGoal(body.goal);
  const packageMode = normalizePackage(body.package_mode);
  const personName = String(body.person_name || "Демо-кандидат").trim() || "Демо-кандидат";
  const currentPosition = String(body.current_position || DEFAULT_CURRENT_POSITION).trim() || DEFAULT_CURRENT_POSITION;
  const targetRole = String(body.target_role || DEFAULT_TARGET_ROLE).trim() || DEFAULT_TARGET_ROLE;
  const includeUnpublished = Boolean(body.include_unpublished);

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);

    const { data: testRows, error: testsError } = await authed.supabaseAdmin
      .from("tests")
      .select("slug, title, type, json, is_published")
      .in("slug", [...DEMO_TEST_SLUGS]);

    if (testsError) throw testsError;

    const tests = DEMO_TEST_SLUGS
      .map((slug) =>
        (testRows || [])
          .filter((row: DbTestRow) => includeUnpublished || row?.is_published !== false)
          .map((row: DbTestRow) => normalizeDbTest(row))
          .filter((test: AnyTest | null): test is AnyTest => Boolean(test))
          .find((test) => test.slug === slug),
      )
      .filter((test): test is AnyTest => Boolean(test));

    if (!tests.length) {
      return res.status(400).json({ ok: false, error: "Не найдено опубликованных тестов для demo-проекта" });
    }

    const missingSlugs = DEMO_TEST_SLUGS.filter((slug) => !tests.some((test) => test.slug === slug));
    if (missingSlugs.length) {
      return res.status(400).json({
        ok: false,
        error: `В demo-наборе отсутствуют тесты: ${missingSlugs.join(", ")}`,
      });
    }

    const summaryText = [
      "Демо-проект для проверки AI-анализа по всем тестам.",
      `Цель проекта: ${goal}.`,
      `Текущая должность: ${currentPosition}.`,
      `Будущая предполагаемая должность: ${targetRole}.`,
      `Тестов в проекте: ${tests.length}.`,
    ].join(" ");

    const encodedSummary = encodeProjectSummary(summaryText, {
      version: 1,
      mode: "goal",
      goal,
      competencyIds: [],
      selectionLabel: "Demo AI",
    });

    const { data: person, error: personError } = await authed.supabaseAdmin
      .from("commercial_people")
      .insert({
        workspace_id: workspace.workspace_id,
        full_name: personName,
        current_position: currentPosition,
        notes: "Автоматически сгенерировано через админ-панель для проверки AI-анализа.",
        created_by: authed.user.id,
      })
      .select("id")
      .single();

    if (personError) throw personError;

    const projectTitle = `Demo AI · ${personName}`;
    const { data: project, error: projectError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .insert({
        workspace_id: workspace.workspace_id,
        created_by: authed.user.id,
        person_id: person.id,
        goal,
        package_mode: packageMode,
        title: projectTitle,
        target_role: targetRole,
        summary: encodedSummary,
        status: "in_progress",
      })
      .select("id, invite_token")
      .single();

    if (projectError) throw projectError;

    const projectTests = tests.map((test, index) => ({
      project_id: project.id,
      test_slug: test.slug,
      test_title: getTestDisplayTitle(test.slug, test.title),
      sort_order: index,
    }));

    const { error: projectTestsError } = await authed.supabaseAdmin.from("commercial_project_tests").insert(projectTests);
    if (projectTestsError) throw projectTestsError;

    const attempts = tests.map((test) => ({
      id: randomUUID(),
      project_id: project.id,
      test_slug: test.slug,
      test_title: getTestDisplayTitle(test.slug, test.title),
      result: buildRandomResult(test),
    }));

    const { error: attemptsError } = await authed.supabaseAdmin.from("commercial_project_attempts").insert(attempts);
    if (attemptsError) throw attemptsError;

    const { error: statusError } = await authed.supabaseAdmin
      .from("commercial_projects")
      .update({ status: "completed" })
      .eq("id", project.id);

    if (statusError) throw statusError;

    return res.status(200).json({
      ok: true,
      project_id: project.id,
      invite_token: project.invite_token || null,
      tests_count: tests.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Не удалось создать demo-проект";
    return res.status(400).json({ ok: false, error: message });
  }
}
