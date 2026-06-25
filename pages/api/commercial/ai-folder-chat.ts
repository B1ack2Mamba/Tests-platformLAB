import type { NextApiRequest, NextApiResponse } from "next";
import { createHash, randomUUID } from "crypto";
import { setNoStore } from "@/lib/apiHardening";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { canAccessCommercialProject } from "@/lib/commercialProjectAccess";
import { chargeWallet } from "@/lib/serverWallet";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";
import { getGoalDefinition } from "@/lib/commercialGoals";
import { getTestDisplayTitle } from "@/lib/testTitles";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";

type AiProvider = "openai" | "deepseek";
type AiMode = "message" | "folder_analysis" | "project_message";
type AiContextScope = "folder" | "loose" | "none";
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProjectCompetencySummary = {
  id: string;
  name: string;
  cluster: string;
  score: number;
  level: string;
};

type ProjectContextSummary = {
  projectId: string;
  title: string;
  name: string;
  goalTitle: string;
  targetRole: string | null;
  currentPosition: string | null;
  testsCount: number;
  attemptsCount: number;
  completedTests: number;
  isComplete: boolean;
  missingTests: string[];
  index: number | null;
  baselineIndex: number | null;
  strengths: string[];
  risks: string[];
  questions: string[];
  competencies: ProjectCompetencySummary[];
  summary: string;
};

type ProjectContextDetail = "folder" | "project";
type ProjectContextOptions = {
  detail?: ProjectContextDetail;
  blockMax?: number;
};

const OPENAI_MODELS = ["gpt-5.4-mini", "gpt-5.5"];
const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_MAX_OUTPUT_TOKENS = 11776;
const MAX_CONTEXT_CHARS = 46000;
const INCOMPLETE_AI_ANALYSIS_EMAILS = new Set(["jdanova_2002@mail.ru"]);

const SYSTEM_PROMPT = [
  "Ты AI-аналитик платформы оценки персонала «Лаборатория кадров».",
  "Отвечай по-русски, спокойно, структурно и практично.",
  "Анализируй только переданные данные выбранной папки или выбранного проекта. Если контекст не выбран, отвечай как общий AI-аналитик и не выдумывай результаты кандидатов.",
  "По умолчанию в контекст попадают полностью завершенные проекты. Если пользователь отдельно подтвердил предварительный анализ, могут попасть незавершенные проекты с уже пройденными тестами: обязательно помечай такие выводы как предварительные и не делай выводов по отсутствующим тестам.",
  "Не выдумывай результаты, тесты и факты. Разделяй подтвержденные наблюдения и гипотезы.",
  "Не ставь медицинские диагнозы. Пиши понятным языком для специалиста, который принимает кадровое решение.",
  "Не используй Markdown-разметку, жирное выделение, заголовки с решетками, маркеры списков, декоративные линии, эмодзи и таблицы. Пиши обычными деловыми предложениями, простыми абзацами и короткими заголовками без спецсимволов.",
].join(" ");

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "2mb",
    },
  },
  maxDuration: 300,
};

function cleanMessages(input: any): ChatMessage[] {
  const raw = Array.isArray(input) ? input : [];
  return raw
    .map((item: any): ChatMessage => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: String(item?.content || "").trim(),
    }))
    .filter((item) => item.content)
    .slice(-10);
}

function compactText(input: any, max = 2400) {
  const text = String(input || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}\n[текст сокращен]` : text;
}

function safeJson(input: any, max = 1600) {
  try {
    return compactText(JSON.stringify(input, null, 2), max);
  } catch {
    return "";
  }
}

function rubToKopeks(rub: number) {
  return rub * 100;
}

function canUseIncompleteAiAnalysis(email?: string | null) {
  return INCOMPLETE_AI_ANALYSIS_EMAILS.has(String(email || "").trim().toLowerCase());
}

function getPriceKopeks(provider: AiProvider, model: string, mode: AiMode) {
  if (mode === "message") {
    if (provider === "deepseek") return rubToKopeks(model === "deepseek-v4-pro" ? 20 : 10);
    return rubToKopeks(model === "gpt-5.4-mini" ? 30 : 50);
  }

  if (provider === "deepseek") {
    const base = mode === "folder_analysis" ? 500 : 200;
    return rubToKopeks(model === "deepseek-v4-pro" ? base * 2 : base);
  }

  if (model === "gpt-5.4-mini") {
    if (mode === "folder_analysis") return rubToKopeks(1000);
    if (mode === "project_message") return rubToKopeks(350);
  }

  if (mode === "folder_analysis") return rubToKopeks(2000);
  if (mode === "project_message") return rubToKopeks(500);
  return rubToKopeks(50);
}

function normalizeDeepseekBaseUrl(input?: string) {
  return String(input || "https://api.deepseek.com")
    .trim()
    .replace(/\/$/, "")
    .replace(/\/chat\/completions$/i, "");
}

function extractOpenAIText(json: any): string {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const output = Array.isArray(json?.output) ? json.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.content === "string") chunks.push(part.content);
    }
  }
  return chunks.join("").trim();
}

function extractDeepseekText(json: any): string {
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
  }
  return "";
}

function transcriptForOpenAI(messages: ChatMessage[]) {
  return messages.map((item) => `${item.role === "assistant" ? "Ассистент" : "Пользователь"}:\n${item.content}`).join("\n\n");
}

async function callOpenAI(args: { model: string; messages: ChatMessage[]; maxOutputTokens: number }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("На сервере не настроен OPENAI_API_KEY.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: args.model,
      instructions: SYSTEM_PROMPT,
      input: transcriptForOpenAI(args.messages),
      max_output_tokens: args.maxOutputTokens,
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error?.message || `OpenAI вернул ошибку ${response.status}`);
  if (json?.status === "incomplete" || json?.incomplete_details?.reason) {
    throw new Error("Ответ не поместился в лимит. Уменьшите задачу или повторите короче.");
  }
  const text = extractOpenAIText(json);
  if (!text) throw new Error("OpenAI ответил без текста.");
  return text;
}

async function callDeepseek(args: { model: string; messages: ChatMessage[]; maxOutputTokens: number }) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("На сервере не настроен DEEPSEEK_API_KEY.");
  const base = normalizeDeepseekBaseUrl(process.env.DEEPSEEK_BASE_URL);

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...args.messages],
      max_tokens: args.maxOutputTokens,
      temperature: 0.25,
    }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error?.message || `DeepSeek вернул ошибку ${response.status}`);
  if (json?.choices?.[0]?.finish_reason === "length") {
    throw new Error("Ответ не поместился в лимит. Уменьшите задачу или повторите короче.");
  }
  const text = extractDeepseekText(json);
  if (!text) throw new Error("DeepSeek ответил без текста.");
  return text;
}

async function getWalletBalance(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("balance_kopeks")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Number((data as any)?.balance_kopeks ?? 0);
}

async function loadFolder(auth: NonNullable<Awaited<ReturnType<typeof requireUser>>>, workspaceId: string, folderId: string) {
  const { data, error } = await auth.supabaseAdmin
    .from("commercial_project_folders")
    .select("id, name, icon_key, workspace_id")
    .eq("workspace_id", workspaceId)
    .eq("id", folderId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

function getProjectProgress(row: any) {
  const tests = Array.isArray(row?.commercial_project_tests) ? row.commercial_project_tests : [];
  const attempts = Array.isArray(row?.commercial_project_attempts) ? row.commercial_project_attempts : [];
  const completedSlugs = new Set(attempts.map((attempt: any) => String(attempt?.test_slug || "")).filter(Boolean));
  const missingTests = tests
    .filter((test: any) => !completedSlugs.has(String(test?.test_slug || "")))
    .map((test: any) => getTestDisplayTitle(test?.test_slug, test?.test_title))
    .filter(Boolean);
  const total = tests.length;
  const completed = Math.min(completedSlugs.size, total || completedSlugs.size);
  return {
    total,
    completed,
    attemptsCount: attempts.length,
    missingTests,
    isComplete: total > 0 && completedSlugs.size >= total,
    isPartial: total > 0 && completedSlugs.size > 0 && completedSlugs.size < total,
  };
}

function getProjectsForAi(rows: any[], includeIncomplete: boolean) {
  return rows.filter((row) => {
    const progress = getProjectProgress(row);
    return progress.isComplete || (includeIncomplete && progress.isPartial);
  });
}

function getIncompleteProjectWarnings(rows: any[]) {
  return rows
    .map((row) => {
      const progress = getProjectProgress(row);
      if (!progress.isPartial) return null;
      return {
        id: String(row?.id || ""),
        name: getProjectName(row),
        completed: progress.completed,
        total: progress.total,
        missing_tests: progress.missingTests,
      };
    })
    .filter(Boolean);
}

async function loadProjects(
  auth: NonNullable<Awaited<ReturnType<typeof requireUser>>>,
  workspaceId: string,
  scope: AiContextScope,
  folderId?: string | null,
  projectId?: string | null,
  includeIncomplete = false
) {
  const selectWithRegistry = `
    id,
    title,
    goal,
    package_mode,
    unlocked_package_mode,
    target_role,
    registry_comment,
    status,
    summary,
    folder_id,
    created_at,
    updated_at,
    registry_comment_updated_at,
    commercial_people(id, full_name, email, current_position, notes, updated_at),
    commercial_project_tests(test_slug, test_title, sort_order),
    commercial_project_attempts(test_slug, test_title, result, created_at, updated_at)
  `;
  const selectBase = `
    id,
    title,
    goal,
    package_mode,
    unlocked_package_mode,
    target_role,
    status,
    summary,
    folder_id,
    created_at,
    updated_at,
    registry_comment_updated_at,
    commercial_people(id, full_name, email, current_position, notes, updated_at),
    commercial_project_tests(test_slug, test_title, sort_order),
    commercial_project_attempts(test_slug, test_title, result, created_at, updated_at)
  `;

  const makeQuery = (select: string) => {
    let query = auth.supabaseAdmin
      .from("commercial_projects")
      .select(select)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (projectId) query = query.eq("id", projectId);
    if (scope === "folder") query = query.eq("folder_id", folderId);
    else query = query.is("folder_id", null);

    return query.limit(30);
  };

  let result = await makeQuery(selectWithRegistry);
  if (isRegistrySchemaMissing(result.error)) result = await makeQuery(selectBase);
  if (result.error) throw result.error;
  return getProjectsForAi((result.data || []) as any[], includeIncomplete);
}

function stableString(value: any) {
  return JSON.stringify(value);
}

function getProjectName(row: any) {
  return row?.commercial_people?.full_name || row?.title || "Проект";
}

function computeContextSignature(args: {
  scope: AiContextScope;
  folderId?: string | null;
  projectId?: string | null;
  projects: any[];
}) {
  const normalized = args.projects
    .map((row) => ({
      id: row?.id || "",
      title: row?.title || "",
      goal: row?.goal || "",
      target_role: row?.target_role || "",
      status: row?.status || "",
      folder_id: row?.folder_id || "",
      created_at: row?.created_at || "",
      updated_at: row?.updated_at || "",
      registry_comment_updated_at: row?.registry_comment_updated_at || "",
      person: {
        id: row?.commercial_people?.id || "",
        full_name: row?.commercial_people?.full_name || "",
        email: row?.commercial_people?.email || "",
        current_position: row?.commercial_people?.current_position || "",
        notes: row?.commercial_people?.notes || "",
        updated_at: row?.commercial_people?.updated_at || "",
      },
      tests: (Array.isArray(row?.commercial_project_tests) ? row.commercial_project_tests : [])
        .map((test: any) => ({
          slug: String(test?.test_slug || ""),
          order: Number(test?.sort_order || 0),
        }))
        .sort((a: any, b: any) => `${a.slug}:${a.order}`.localeCompare(`${b.slug}:${b.order}`)),
      attempts: (Array.isArray(row?.commercial_project_attempts) ? row.commercial_project_attempts : [])
        .map((attempt: any) => ({
          slug: String(attempt?.test_slug || ""),
          created_at: attempt?.created_at || "",
          updated_at: attempt?.updated_at || "",
        }))
        .sort((a: any, b: any) => `${a.slug}:${a.created_at}`.localeCompare(`${b.slug}:${b.created_at}`)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return createHash("sha256")
    .update(stableString({ scope: args.scope, folderId: args.folderId || null, projectId: args.projectId || null, projects: normalized }))
    .digest("hex");
}

function summarizeAttempt(attempt: any, options: { jsonMax?: number; textMax?: number } = {}) {
  const title = getTestDisplayTitle(attempt?.test_slug, attempt?.test_title);
  const result = attempt?.result || {};
  const jsonMax = options.jsonMax ?? 900;
  const textMax = options.textMax ?? 1000;
  const direct = [
    result?.summary,
    result?.result_label,
    result?.label,
    result?.profile,
    result?.interpretation,
    result?.description,
    result?.text,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
  return `${title}: ${compactText(direct || safeJson(result, jsonMax), textMax)}`;
}

async function buildProjectContext(row: any, fitRequest: string, options: ProjectContextOptions = {}) {
  const detail = options.detail || "project";
  const folderBrief = detail === "folder";
  const blockMax = options.blockMax ?? (folderBrief ? 1600 : 6000);
  const person = row?.commercial_people || {};
  const tests = Array.isArray(row?.commercial_project_tests) ? row.commercial_project_tests : [];
  const attempts = Array.isArray(row?.commercial_project_attempts) ? row.commercial_project_attempts : [];
  const progress = getProjectProgress(row);
  const goalTitle = getGoalDefinition(row?.goal)?.title || row?.goal || "цель не указана";
  const project = {
    id: row?.id,
    title: row?.title || "Проект",
    goal: row?.goal || "",
    package_mode: row?.unlocked_package_mode || row?.package_mode || null,
    target_role: row?.target_role || null,
    registry_comment: row?.registry_comment || null,
    person_name: person?.full_name || null,
    person_email: person?.email || null,
    current_position: person?.current_position || null,
    notes: person?.notes || null,
  };

  let analysis: Awaited<ReturnType<typeof buildCandidateRegistryAnalysis>> | null = null;
  try {
    analysis = await buildCandidateRegistryAnalysis({
      project,
      attempts,
      fitRequest: fitRequest || project.target_role || null,
      includeRegistry: true,
    });
  } catch {
    analysis = null;
  }

  const competencies: ProjectCompetencySummary[] = analysis
    ? analysis.calibrated.competencies.map((item) => ({
        id: item.id,
        name: item.name,
        cluster: item.cluster,
        score: item.score,
        level: item.level,
      }))
    : [];
  const topCompetencies = competencies.slice().sort((a, b) => b.score - a.score).slice(0, folderBrief ? 5 : 8);
  const lowCompetencies = competencies.slice().sort((a, b) => a.score - b.score).slice(0, folderBrief ? 3 : 5);
  const summary: ProjectContextSummary = {
    projectId: String(row?.id || ""),
    title: project.title,
    name: project.person_name || project.title,
    goalTitle,
    targetRole: project.target_role,
    currentPosition: person?.current_position || null,
    testsCount: tests.length,
    attemptsCount: attempts.length,
    completedTests: progress.completed,
    isComplete: progress.isComplete,
    missingTests: progress.missingTests,
    index: analysis?.calibrated.index ?? null,
    baselineIndex: analysis?.baseline.index ?? null,
    strengths: analysis?.calibrated.strengths.slice(0, folderBrief ? 3 : 6) || [],
    risks: analysis?.calibrated.risks.slice(0, folderBrief ? 3 : 6) || [],
    questions: analysis?.calibrated.interviewQuestions.slice(0, folderBrief ? 3 : 6) || [],
    competencies,
    summary: analysis?.summary || "",
  };

  const block = compactText(
    [
      `Проект: ${summary.title}`,
      `Человек: ${summary.name}`,
      `Цель оценки: ${summary.goalTitle}`,
      summary.targetRole ? `Целевая роль: ${summary.targetRole}` : "",
      summary.currentPosition ? `Текущая должность: ${summary.currentPosition}` : "",
      `Назначено тестов: ${summary.testsCount}; пройдено разных тестов: ${summary.completedTests}; попыток с результатами: ${summary.attemptsCount}.`,
      !summary.isComplete
        ? `ВНИМАНИЕ: проект не завершен, анализ предварительный. Не хватает тестов: ${summary.missingTests.join(", ") || "не указаны"}.`
        : "",
      tests.length
        ? `Назначенные тесты: ${tests
            .map((test: any) => getTestDisplayTitle(test?.test_slug, test?.test_title))
            .slice(0, folderBrief ? 8 : 12)
            .join(", ")}`
        : "",
      analysis
        ? [
            `Итоговый индекс: ${analysis.calibrated.index}/100; базовый индекс: ${analysis.baseline.index}/100; изменение: ${analysis.delta.index}.`,
            `Сильные стороны: ${summary.strengths.join("; ") || "не выделены"}.`,
            `Риски: ${summary.risks.join("; ") || "не выделены"}.`,
            topCompetencies.length ? `Сильные компетенции: ${topCompetencies.map((item) => `${item.name}: ${item.score}/100`).join("; ")}.` : "",
            lowCompetencies.length ? `Зоны внимания: ${lowCompetencies.map((item) => `${item.name}: ${item.score}/100`).join("; ")}.` : "",
            `Краткий вывод: ${analysis.summary}`,
          ].join("\n")
        : "",
      attempts.length && !folderBrief ? `Краткие результаты тестов:\n${attempts.slice(0, 10).map((attempt: any) => summarizeAttempt(attempt)).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    blockMax
  );

  return { block, summary };
}

function scoreLabel(score: number | null) {
  if (score == null) return "Недостаточно данных";
  if (score >= 82) return "Очень сильное соответствие";
  if (score >= 70) return "Хорошее соответствие";
  if (score >= 58) return "Можно рассматривать";
  return "Нужна дополнительная проверка";
}

function buildInsightSchema(mode: AiMode, contextLabel: string, projectSummaries: ProjectContextSummary[], focusRequest: string) {
  if (mode === "message") return null;
  if (mode === "project_message") {
    const person = projectSummaries[0];
    if (!person) return null;
    const top = person.competencies.slice().sort((a, b) => b.score - a.score).slice(0, 8);
    const low = person.competencies.slice().sort((a, b) => a.score - b.score).slice(0, 5);
    return {
      type: "person",
      title: person.name,
      subtitle: person.targetRole || person.goalTitle,
      summary: person.summary || scoreLabel(person.index),
      focus: focusRequest || person.targetRole || "",
      person: {
        project_id: person.projectId,
        name: person.name,
        score: person.index,
        verdict: scoreLabel(person.index),
        strengths: person.strengths,
        risks: person.risks,
        questions: person.questions,
        top_competencies: top,
        low_competencies: low,
      },
    };
  }

  const ranked = projectSummaries
    .slice()
    .sort((a, b) => (b.index ?? -1) - (a.index ?? -1));
  const competencyMap = new Map<string, { id: string; name: string; cluster: string; entries: Array<{ project_id: string; name: string; score: number }> }>();
  for (const project of projectSummaries) {
    for (const competency of project.competencies) {
      const current = competencyMap.get(competency.id) || {
        id: competency.id,
        name: competency.name,
        cluster: competency.cluster,
        entries: [],
      };
      current.entries.push({ project_id: project.projectId, name: project.name, score: competency.score });
      competencyMap.set(competency.id, current);
    }
  }

  const competencyLeaders = Array.from(competencyMap.values())
    .map((item) => {
      const top = item.entries.slice().sort((a, b) => b.score - a.score).slice(0, 3);
      return {
        id: item.id,
        name: item.name,
        cluster: item.cluster,
        leader_name: top[0]?.name || "",
        leader_score: top[0]?.score ?? null,
        top,
      };
    })
    .sort((a, b) => (b.leader_score ?? -1) - (a.leader_score ?? -1))
    .slice(0, 12);

  return {
    type: "folder",
    title: contextLabel,
    subtitle: focusRequest ? `Фокус: ${focusRequest}` : "Сравнение проектов в выбранном контексте",
    summary: ranked[0]
      ? `Лидер по текущей модели оценки: ${ranked[0].name} (${ranked[0].index}/100). Схема показывает, кто сильнее по ключевым компетенциям и кто лучше подходит под заданный запрос.`
      : "Недостаточно данных для сравнения.",
    focus: focusRequest,
    ranking: ranked.slice(0, 30).map((item, index) => ({
      project_id: item.projectId,
      name: item.name,
      score: item.index,
      place: index + 1,
      verdict: scoreLabel(item.index),
      reason: item.strengths[0] || item.summary || "",
    })),
    competency_leaders: competencyLeaders,
  };
}

async function buildAnalysisContext(args: {
  auth: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
  workspaceId: string;
  scope: AiContextScope;
  folderId: string;
  projectId?: string | null;
  fitRequest: string;
  includeIncompleteProjects: boolean;
  incompleteAnalysisConsent: boolean;
}) {
  if (args.scope === "none") {
    return {
      folder: { id: "none", name: "Обычное сообщение", icon_key: null, workspace_id: args.workspaceId },
      projects: [],
      projectSummaries: [],
      incompleteProjects: [],
      signature: "",
      context: [
        "Контекст: не выбрана папка или отдельный кандидат.",
        "В этом режиме нельзя ссылаться на результаты конкретных людей, тестов или проектов, если пользователь не написал их вручную.",
        "Отвечай как AI-аналитик по общим вопросам оценки персонала, интерпретации результатов и работе с платформой.",
      ].join("\n"),
    };
  }

  const folder =
    args.scope === "folder"
      ? await loadFolder(args.auth, args.workspaceId, args.folderId)
      : { id: "loose", name: "Готовые проекты без папки", icon_key: null, workspace_id: args.workspaceId };
  if (!folder) throw new Error("Папка не найдена.");

  if (args.projectId) {
    const access = await canAccessCommercialProject(args.auth.supabaseAdmin, args.auth.user, args.projectId);
    if (!access.found) throw new Error("Проект не найден.");
    if (!access.allowed) throw new Error("Нет доступа к проекту.");
  }

  const projects = await loadProjects(
    args.auth,
    args.workspaceId,
    args.scope,
    args.scope === "folder" ? args.folderId : null,
    args.projectId || null,
    args.includeIncompleteProjects
  );
  const incompleteProjects = getIncompleteProjectWarnings(projects);
  if (incompleteProjects.length && !args.incompleteAnalysisConsent) {
    throw new Error("В выбранном контексте есть кандидаты с незавершенными тестами. Подтвердите предварительный анализ, чтобы AI использовал только уже пройденные результаты.");
  }
  if (!projects.length) {
    throw new Error(
      args.projectId
        ? (args.includeIncompleteProjects
            ? "Выбранный проект еще не имеет пройденных тестов или не входит в выбранный контекст."
            : "Выбранный проект еще не завершен или не входит в выбранный контекст.")
        : (args.includeIncompleteProjects
            ? "В выбранном контексте нет проектов с результатами для анализа."
            : "В выбранном контексте нет полностью завершенных проектов.")
    );
  }

  const useFolderBriefs = args.scope === "folder" && !args.projectId;
  const folderBlockMax = useFolderBriefs
    ? Math.max(900, Math.min(2200, Math.floor((MAX_CONTEXT_CHARS - 6000) / Math.max(projects.length, 1))))
    : 6000;
  const contexts = await Promise.all(projects.map((row) => buildProjectContext(row, args.fitRequest, {
    detail: useFolderBriefs ? "folder" : "project",
    blockMax: folderBlockMax,
  })));
  const roster = contexts.map((item, index) => {
    const summary = item.summary;
    const score = summary.index == null ? "н/д" : `${summary.index}/100`;
    return `${index + 1}. ${summary.name}: индекс ${score}; тесты ${summary.completedTests}/${summary.testsCount}; роль: ${summary.targetRole || summary.currentPosition || "не указана"}`;
  });
  const context = compactText(
    [
      `Контекст: ${folder.name}`,
      incompleteProjects.length
        ? `В анализе проектов: ${projects.length}. Незавершенных с предварительным выводом: ${incompleteProjects.length}.`
        : `В анализе полностью завершенные проекты: ${projects.length}`,
      `Обязательный список людей для персональных выводов (${contexts.length}):`,
      roster.join("\n"),
      incompleteProjects.length
        ? `Предупреждение: по незавершенным проектам используй только уже пройденные тесты. Не хватает: ${incompleteProjects.map((item: any) => `${item.name} (${item.completed}/${item.total})`).join("; ")}.`
        : "",
      "",
      contexts.map((item, index) => `--- Проект ${index + 1} ---\n${item.block}`).join("\n\n"),
    ].join("\n"),
    MAX_CONTEXT_CHARS
  );

  return {
    folder,
    projects,
    projectSummaries: contexts.map((item) => item.summary),
    incompleteProjects,
    signature: computeContextSignature({ scope: args.scope, folderId: args.scope === "folder" ? args.folderId : null, projectId: args.projectId || null, projects }),
    context,
  };
}

async function buildFollowUpContext(args: {
  auth: NonNullable<Awaited<ReturnType<typeof requireUser>>>;
  workspaceId: string;
  scope: AiContextScope;
  folderId: string;
  projectId?: string | null;
  expectedSignature: string;
  includeIncompleteProjects: boolean;
  incompleteAnalysisConsent: boolean;
}) {
  if (args.scope === "none") {
    return {
      folder: { id: "none", name: "Обычное сообщение", icon_key: null, workspace_id: args.workspaceId },
      projects: [],
      projectSummaries: [],
      incompleteProjects: [],
      signature: "",
      context: "Контекст проектов не выбран. Отвечай на общий вопрос без ссылок на конкретные результаты кандидатов.",
    };
  }

  const folder =
    args.scope === "folder"
      ? await loadFolder(args.auth, args.workspaceId, args.folderId)
      : { id: "loose", name: "Готовые проекты без папки", icon_key: null, workspace_id: args.workspaceId };
  if (!folder) throw new Error("Папка не найдена.");

  if (args.projectId) {
    const access = await canAccessCommercialProject(args.auth.supabaseAdmin, args.auth.user, args.projectId);
    if (!access.found) throw new Error("Проект не найден.");
    if (!access.allowed) throw new Error("Нет доступа к проекту.");
  }

  const projects = await loadProjects(
    args.auth,
    args.workspaceId,
    args.scope,
    args.scope === "folder" ? args.folderId : null,
    args.projectId || null,
    args.includeIncompleteProjects
  );
  const incompleteProjects = getIncompleteProjectWarnings(projects);
  if (incompleteProjects.length && !args.incompleteAnalysisConsent) {
    throw new Error("Этот чат был начат с незавершенными проектами. Подтвердите предварительный анализ, чтобы продолжить.");
  }
  if (!projects.length) {
    throw new Error(
      args.projectId
        ? "Выбранный проект изменился или больше не входит в выбранный контекст."
        : (args.includeIncompleteProjects
            ? "Состав папки изменился или в ней нет проектов с результатами для анализа."
            : "Состав папки изменился или в ней нет полностью завершенных проектов.")
    );
  }

  const signature = computeContextSignature({ scope: args.scope, folderId: args.scope === "folder" ? args.folderId : null, projectId: args.projectId || null, projects });
  if (!args.expectedSignature || args.expectedSignature !== signature) {
    throw new Error("Данные изменились после предыдущего анализа. Запустите анализ заново, чтобы продолжить без риска старых выводов.");
  }

  return {
    folder,
    projects,
    projectSummaries: projects.map((row) => ({ projectId: row?.id || "", name: getProjectName(row) })) as any[],
    incompleteProjects,
    signature,
    context: [
      `Контекст уже был проанализирован в этом чате: ${folder.name}.`,
      args.projectId ? `Выбранный человек: ${getProjectName(projects[0])}.` : `Состав контекста не изменился: ${projects.length} проектов.`,
      incompleteProjects.length ? "Часть проектов была проанализирована предварительно, потому что тесты пройдены не полностью." : "",
      "Используй историю этого чата и предыдущий анализ. Не пересчитывай папку или человека заново и не добавляй новые оценки, если их нет в истории.",
    ].join("\n"),
  };
}

function buildUserPrompt(mode: AiMode, contextLabel: string, projectName: string | null, message: string) {
  const task = message.trim();
  if (mode === "folder_analysis") {
    return task || `Сделай компактный анализ контекста «${contextLabel}»: общий вывод, затем 3-4 коротких предложения по каждому человеку, затем рейтинг и практические рекомендации.`;
  }
  if (mode === "project_message") {
    return task || `Разбери выбранный проект «${projectName || "человек"}»: сильные стороны, риски, вопросы для уточнения и что важно учитывать специалисту.`;
  }
  return task;
}

function buildMessages(args: {
  mode: AiMode;
  history: ChatMessage[];
  context: string;
  contextLabel: string;
  projectName: string | null;
  projectCount: number;
  message: string;
}) {
  const task = buildUserPrompt(args.mode, args.contextLabel, args.projectName, args.message);
  const modeText =
    args.mode === "folder_analysis"
      ? "Компактный анализ выбранной папки. Главная задача — не длинный общий текст, а короткий персональный вывод по каждому человеку без пропусков."
      : args.mode === "project_message"
        ? "Персональное сообщение по одному выбранному проекту-человеку. В конце дай короткие выводы для персональной карты."
        : "Обычное сообщение. Если это продолжение анализа, используй историю чата и не пересчитывай папку или человека заново.";
  const folderRules = args.mode === "folder_analysis"
    ? [
        "Правила ответа для анализа папки.",
        `В контексте ${args.projectCount} человек. В разделе по людям перечисли ровно ${args.projectCount} человек: всех из обязательного списка, без пропусков.`,
        "Сначала дай общий вывод по папке в 3-5 коротких деловых предложениях.",
        `Затем сделай раздел «Кратко по каждому человеку (${args.projectCount}/${args.projectCount})».`,
        "Для каждого человека дай 3-4 коротких предложения: общий профиль, сильные стороны, риски или зоны внимания, практическая рекомендация.",
        "Не растягивай абзацы. Один человек: один короткий блок 3-4 предложения.",
        "Если данных по человеку меньше, прямо напиши, что вывод предварительный, но все равно включи этого человека в список.",
        "Рейтинг, лидеров и рекомендации давай только после персонального раздела, чтобы персональные выводы не обрезались.",
        "Не используй декоративную разметку, жирное выделение, маркеры списков, таблицы и эмодзи. Нужны только деловые предложения и обычные знаки препинания.",
      ].join("\n")
    : "";

  return [
    ...args.history,
    {
      role: "user" as const,
      content: [
        `Режим: ${modeText}`,
        "",
        "Контекст данных:",
        args.context,
        "",
        ...(folderRules ? [folderRules, ""] : []),
        "Задача пользователя:",
        task,
      ].join("\n"),
    },
  ];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setNoStore(res);
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const auth = await requireUser(req, res, { requireEmail: true });
  if (!auth) return;

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const provider = String(body.provider || "openai") as AiProvider;
  const model = String(body.model || DEFAULT_OPENAI_MODEL).trim();
  const contextScope: AiContextScope = body.context_scope === "loose" ? "loose" : body.context_scope === "none" ? "none" : "folder";
  const requestedMode = String(body.mode || "").trim();
  const folderId = String(body.folder_id || "").trim();
  const projectId = String(body.project_id || "").trim();
  const message = String(body.message || "").trim();
  const expectedSignature = String(body.expected_context_signature || "").trim();
  const incompleteAnalysisAllowed = canUseIncompleteAiAnalysis(auth.user.email);
  const includeIncompleteProjects = incompleteAnalysisAllowed && contextScope !== "none";
  const incompleteAnalysisConsent = incompleteAnalysisAllowed;
  const mode: AiMode =
    requestedMode === "message"
      ? "message"
      : requestedMode === "project_message" && projectId
        ? "project_message"
        : contextScope === "folder"
          ? "folder_analysis"
          : contextScope === "loose"
            ? "project_message"
            : "message";
  const maxOutputTokens = Math.min(mode === "message" ? 3000 : 12000, Math.max(256, Number(body.max_output_tokens || (mode === "message" ? 3000 : DEFAULT_MAX_OUTPUT_TOKENS))));
  const history = cleanMessages(body.history);

  if (provider !== "openai" && provider !== "deepseek") return res.status(400).json({ ok: false, error: "Неизвестный провайдер AI." });
  if (provider === "openai" && !OPENAI_MODELS.includes(model)) return res.status(400).json({ ok: false, error: "Неизвестная модель OpenAI." });
  if (provider === "deepseek" && !DEEPSEEK_MODELS.includes(model)) return res.status(400).json({ ok: false, error: "Неизвестная модель DeepSeek." });
  if (mode === "folder_analysis" && contextScope !== "folder") return res.status(400).json({ ok: false, error: "Для анализа папки выберите папку." });
  if (mode === "project_message" && contextScope !== "folder" && contextScope !== "loose") return res.status(400).json({ ok: false, error: "Для персонального анализа выберите готовый проект." });
  if (mode === "message" && contextScope !== "none" && !expectedSignature) return res.status(400).json({ ok: false, error: "Обычное сообщение по папке или человеку доступно после анализа в этом же чате." });
  if (contextScope === "folder" && !folderId) return res.status(400).json({ ok: false, error: "Выберите папку для анализа." });
  if (mode === "message" && !message) return res.status(400).json({ ok: false, error: "Напишите вопрос." });
  if (mode === "project_message" && !projectId) return res.status(400).json({ ok: false, error: "Выберите проект-человека для персонального сообщения." });

  try {
    const workspace = await ensureWorkspaceForUser(auth.supabaseAdmin, auth.user);
    const unlimited = isTestUnlimitedEmail(auth.user.email);
    const priceKopeks = getPriceKopeks(provider, model, mode);
    const balanceBefore = unlimited ? TEST_UNLIMITED_BALANCE_KOPEKS : await getWalletBalance(auth.supabaseAdmin, auth.user.id);

    if (!unlimited && balanceBefore < priceKopeks) {
      return res.status(402).json({
        ok: false,
        error: `Недостаточно средств на балансе. Нужно ${Math.floor(priceKopeks / 100)} ₽.`,
        price_kopeks: priceKopeks,
        balance_kopeks: balanceBefore,
      });
    }

    const contextPayload =
      mode === "message"
        ? await buildFollowUpContext({
            auth,
            workspaceId: workspace.workspace_id,
            scope: contextScope,
            folderId,
            projectId: projectId || null,
            expectedSignature,
            includeIncompleteProjects,
            incompleteAnalysisConsent,
          })
        : await buildAnalysisContext({
            auth,
            workspaceId: workspace.workspace_id,
            scope: contextScope,
            folderId,
            projectId: mode === "project_message" ? projectId : null,
            fitRequest: message,
            includeIncompleteProjects,
            incompleteAnalysisConsent,
          });
    const projectName = contextPayload.projectSummaries[0]?.name || null;
    const messages = buildMessages({
      mode,
      history,
      context: contextPayload.context,
      contextLabel: contextPayload.folder.name,
      projectName,
      projectCount: contextPayload.projects.length,
      message,
    });
    const text =
      provider === "openai"
        ? await callOpenAI({ model, messages, maxOutputTokens })
        : await callDeepseek({ model, messages, maxOutputTokens });
    const insight = buildInsightSchema(mode, contextPayload.folder.name, contextPayload.projectSummaries, message);

    const charge = unlimited
      ? { balance_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS, charged_kopeks: 0, source: "fallback" as const }
      : await chargeWallet(auth.supabaseAdmin, {
          userId: auth.user.id,
          amountKopeks: priceKopeks,
          reason: "commercial_ai_folder_chat",
          ref: `commercial-ai-folder-chat:${auth.user.id}:${mode}:${randomUUID()}`,
        });

    const responseContextLabel = mode === "project_message" && projectName
      ? `${contextPayload.folder.name} · ${projectName}`
      : contextPayload.folder.name;

    return res.status(200).json({
      ok: true,
      provider,
      model,
      mode,
      context_scope: contextScope,
      text,
      insight,
      folder: contextScope === "folder" ? { id: contextPayload.folder.id, name: contextPayload.folder.name } : null,
      context_label: responseContextLabel,
      project: mode === "project_message" ? { id: contextPayload.projects[0]?.id || projectId, name: projectName } : null,
      context_signature: contextPayload.signature,
      incomplete_projects: contextPayload.incompleteProjects,
      analysis_warning: contextPayload.incompleteProjects.length ? "Часть выводов предварительная: в контексте есть проекты с незавершенными тестами." : null,
      price_kopeks: priceKopeks,
      charged_kopeks: charge.charged_kopeks,
      balance_kopeks: charge.balance_kopeks,
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось выполнить AI-анализ." });
  }
}
