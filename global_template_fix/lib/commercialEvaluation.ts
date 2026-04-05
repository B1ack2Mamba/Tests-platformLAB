import { aiInterpretation } from "@/lib/aiInterpretation";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";
import {
  getEvaluationPackageDefinition,
  getGoalDefinition,
  type EvaluationPackage,
  type AssessmentGoal,
} from "@/lib/commercialGoals";
import {
  getCompetenciesForGoal,
  getCompetencyRecommendedTests,
  getCompetencyRoutes,
  getCompetencyShortLabel,
  type CompetencyRoute,
} from "@/lib/competencyRouter";
import { getWeightedCompetencyLabels } from "@/lib/fitProfiles";
import { renderPromptTemplate, type CompetencyPromptRow } from "@/lib/competencyPrompts";
import { loadCompetencyPromptMap } from "@/lib/serverCompetencyPrompts";
import {
  getServerFitProfileById,
  resolveFitMatrixServer,
} from "@/lib/serverFitProfiles";
import type { ProjectRoutingMeta } from "@/lib/projectRoutingMeta";

type AttemptLike = {
  test_slug: string;
  test_title?: string | null;
  result: any;
};

type ProjectLike = {
  title: string;
  goal: string;
  package_mode?: string | null;
  person_name?: string | null;
  person_email?: string | null;
  current_position?: string | null;
  notes?: string | null;
  target_role?: string | null;
  routing_meta?: ProjectRoutingMeta | null;
};

type EvaluationSection = {
  kind: "summary" | "test" | "portrait" | "manager" | "development";
  title: string;
  body: string;
};

type BuildOptions = {
  interpretationKeysBySlug?: Record<string, any>;
  aiPlusRequest?: string | null;
  fitEnabled?: boolean;
  fitRequest?: string | null;
  fitProfileId?: string | null;
};

type CompetencySignal = {
  id: string;
  title: string;
  score: number;
  status: string;
  short: string;
  details: string;
};

function rowsFromResult(result: any) {
  return Array.isArray(result?.ranked) ? result.ranked : [];
}

function pluralizePoints(value: number) {
  const abs = Math.abs(Math.trunc(Number(value) || 0));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "балл";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "балла";
  return "баллов";
}

function genericLevelLabel(row: any) {
  const source = String(row?.level || "").toLowerCase();
  if (source.includes("высок") || source.includes("сильн") || source.includes("доминир")) return "высокий показатель";
  if (source.includes("сред") || source.includes("норм") || source.includes("умерен")) return "средний показатель";
  if (source.includes("низк") || source.includes("слаб")) return "низкий показатель";

  const percent = Number(row?.percent);
  if (Number.isFinite(percent)) {
    if (percent >= 67) return "высокий показатель";
    if (percent >= 34) return "средний показатель";
    return "низкий показатель";
  }

  return "средний показатель";
}

function formatTopRows(result: any) {
  const rows = rowsFromResult(result).slice(0, 6);
  if (!rows.length) return "Цифры сохранены. Для этого теста пока нет унифицированного короткого блока показателей.";
  return rows
    .map((row: any) => {
      const label = row.style || row.tag || "Показатель";
      const count = Number(row?.count);
      const percent = Number(row?.percent);
      const countText = Number.isFinite(count) ? `${count} ${pluralizePoints(count)}` : "—";
      const extras: string[] = [];
      if (Number.isFinite(percent)) extras.push(`${percent}%`);
      extras.push(genericLevelLabel(row));
      return `• ${label}: ${countText} (${extras.join(", ")})`;
    })
    .join("\n");
}

function getTopLabels(result: any, limit = 3) {
  const rows = rowsFromResult(result).slice(0, limit);
  return rows.map((row: any) => String(row.style || row.tag || "показатель")).filter(Boolean);
}

function extractSignal(result: any) {
  const rows = rowsFromResult(result);
  if (!rows.length) return 55;
  const values = rows.slice(0, 4).map((row: any) => {
    if (row.percent != null) return Number(row.percent);
    if (row.count != null) return Math.max(0, Math.min(100, Number(row.count) * 10));
    return 50;
  });
  return values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
}

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeJson(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function trimText(value: string | null | undefined, max = 1400) {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function cleanText(value: string) {
  return String(value || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactLine(value: string | null | undefined, fallback = "—") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function buildRelevantTestResultsBlock(attempts: AttemptLike[]) {
  if (!attempts.length) return "Нет завершённых релевантных тестов по этой компетенции.";
  return attempts
    .map((attempt, index) => [`${index + 1}. ${attempt.test_title || attempt.test_slug}`, formatTopRows(attempt.result)].join("\n"))
    .join("\n\n---\n\n");
}

function buildRelevantPremiumBlock(attempts: AttemptLike[], premiumByTest: Array<{ title: string; body: string }>) {
  const chunks = attempts
    .map((attempt) => {
      const title = attempt.test_title || attempt.test_slug;
      const premium = premiumByTest.find((item) => item.title === title);
      if (!premium?.body) return "";
      return `${title}\n${trimText(cleanText(premium.body), 700)}`;
    })
    .filter(Boolean);
  return chunks.length ? chunks.join("\n\n---\n\n") : "Дополнительных интерпретаций по релевантным тестам пока нет.";
}

async function buildCompetencyAiDetail(args: {
  project: ProjectLike;
  route: CompetencyRoute;
  signal: CompetencySignal;
  relevantAttempts: AttemptLike[];
  premiumByTest: Array<{ title: string; body: string }>;
  profileContext: string;
  customRequest?: string | null;
  fitRequest?: string | null;
  promptConfig?: CompetencyPromptRow | null;
}) {
  const { project, route, signal, relevantAttempts, premiumByTest, profileContext, customRequest, fitRequest, promptConfig } = args;
  const template = String(promptConfig?.prompt_template || "").trim();
  if (!template) return null;

  const systemPrompt = compactLine(
    promptConfig?.system_prompt,
    "Ты помогаешь специалисту по оценке персонала интерпретировать одну компетенцию по данным нескольких тестов."
  );

  const prompt = renderPromptTemplate(template, {
    competency_id: route.id,
    competency_name: route.name,
    competency_cluster: route.cluster,
    competency_definition: route.definition,
    competency_fit_gate: route.fitGate,
    competency_score: String(signal.score),
    competency_status: signal.status,
    competency_short: signal.short,
    project_goal_label: goalLabel(project.goal),
    project_title: compactLine(project.title),
    person_name: compactLine(project.person_name),
    current_position: compactLine(project.current_position),
    target_role: compactLine(project.target_role),
    notes: compactLine(project.notes),
    custom_request: compactLine(customRequest),
    fit_request: compactLine(fitRequest),
    profile_context: profileContext,
    test_results_block: buildRelevantTestResultsBlock(relevantAttempts),
    premium_interpretations_block: buildRelevantPremiumBlock(relevantAttempts, premiumByTest),
  });

  const text = await callDeepseek(systemPrompt, prompt, 900).catch(() => null);
  return text ? cleanText(text) : null;
}

function goalLabel(goal: string) {
  return getGoalDefinition(goal)?.shortTitle || "Оценка";
}

function describeStatus(score: number) {
  if (score >= 74) return { label: "Сильное совпадение", tone: "сильная опора" };
  if (score >= 60) return { label: "Рабочее совпадение", tone: "рабочая опора" };
  if (score >= 48) return { label: "Неустойчиво", tone: "смешанный сигнал" };
  return { label: "Зона риска", tone: "есть заметные ограничения" };
}

async function buildCorrespondenceIndex(
  project: ProjectLike,
  attempts: AttemptLike[],
  competencySignals: CompetencySignal[],
  fitRequest?: string | null,
  fitProfileId?: string | null
) {
  const matrix = await resolveFitMatrixServer({
    goal: project.goal as AssessmentGoal,
    fitProfileId: fitProfileId || null,
    fitRequest: fitRequest || null,
    targetRole: project.target_role || null,
  });
  const signalMap = new Map(competencySignals.map((item) => [item.id, item]));
  const weighted = Object.entries(matrix.weights)
    .map(([id, weight]) => ({ id, weight, signal: signalMap.get(id) || null }))
    .filter((item) => item.weight > 0);
  const covered = weighted.filter((item) => item.signal);
  const base = covered.length
    ? covered.reduce((sum, item) => sum + (item.signal?.score || 0) * item.weight, 0) / covered.reduce((sum, item) => sum + item.weight, 0)
    : attempts.length
    ? attempts.map((item) => extractSignal(item.result)).reduce((sum, value) => sum + value, 0) / attempts.length
    : 55;

  const criticalScores = matrix.critical.map((id) => signalMap.get(id)?.score ?? 52);
  const criticalPenalty = criticalScores.reduce((sum, value) => {
    if (value < 46) return sum + 10;
    if (value < 58) return sum + 5;
    return sum;
  }, 0);
  const coverageRatio = weighted.length ? covered.length / weighted.length : 0.55;
  const coveragePenalty = weighted.length ? Math.round((1 - coverageRatio) * 10) : 0;
  const profileBonus = matrix.matchedProfiles.length ? 3 : matrix.matchedExpectations.length ? 2 : 0;
  const testsBonus = Math.min(6, attempts.length * 1.1);
  const requestBonus = fitRequest?.trim() ? 2 : 0;
  const score = Math.round(clamp(38, base + testsBonus + profileBonus + requestBonus - criticalPenalty - coveragePenalty, 97));

  const requestedLabel = fitRequest?.trim() || project.target_role || goalLabel(project.goal);
  const title = fitRequest?.trim() ? "Индекс соответствия запросу" : "Индекс соответствия";
  const context = fitRequest?.trim()
    ? `Ориентир собран под запрос: ${fitRequest?.trim()}.`
    : project.target_role
    ? `Ориентир собран относительно роли «${project.target_role}».`
    : `Ориентир собран относительно фокуса оценки «${goalLabel(project.goal)}».`;

  const weightedCompetencies = getWeightedCompetencyLabels(matrix.weights);
  const strongest = covered
    .sort((a, b) => (b.signal?.score || 0) - (a.signal?.score || 0))
    .slice(0, 4)
    .map((item) => `${item.signal?.title} (${item.signal?.score}/100)`);
  const weakestCritical = matrix.critical
    .map((id) => signalMap.get(id))
    .filter(Boolean)
    .sort((a, b) => (a?.score || 0) - (b?.score || 0))
    .slice(0, 3)
    .map((item) => `${item?.title} (${item?.score}/100)`);

  const bodyParts = [
    `${title}: ${score}/100. ${context}`,
    `Матрица: ${matrix.label}. ${matrix.explanation.join(" ")}`,
    weightedCompetencies.length ? `Ключевые компетенции в матрице: ${weightedCompetencies.map((item) => `${item.name} ×${item.weight}`).join(", ")}.` : "",
    strongest.length ? `Что поддерживает соответствие: ${strongest.join(", ")}.` : "",
    weakestCritical.length ? `Зоны, которые сильнее всего тянут индекс вниз: ${weakestCritical.join(", ")}.` : "",
    weighted.length ? `Покрытие матрицы завершёнными сигналами: ${covered.length} из ${weighted.length}.` : "",
  ].filter(Boolean);

  return {
    score,
    title,
    body: bodyParts.join("\n\n"),
    requestedLabel,
    matrixLabel: matrix.label,
  };
}

function buildPortraitFallback(project: ProjectLike, attempts: AttemptLike[]) {
  const topTraits = attempts.flatMap((item) => getTopLabels(item.result, 2)).filter(Boolean);
  const uniqueTraits = [...new Set(topTraits)].slice(0, 6);
  const person = project.person_name || "Участник";
  const role = project.target_role ? ` для роли «${project.target_role}»` : "";
  const goalDef = getGoalDefinition(project.goal);
  const goalText = goalDef
    ? `Фокус оценки смещён на направление «${goalDef.shortTitle.toLowerCase()}»: ${goalDef.description.toLowerCase()}`
    : "Фокус оценки смещён на общий рабочий профиль и повторяющиеся паттерны поведения.";

  return [
    `${person}${role} показывает набор повторяющихся акцентов: ${uniqueTraits.length ? uniqueTraits.join(", ") : "ключевые показатели собраны, но без явного лидера"}.`,
    goalText,
    "Итоговый профиль собран как синтез между тестами: мы смотрим не на одну шкалу, а на повторяемые паттерны в нескольких методиках.",
  ].join("\n\n");
}

async function callDeepseek(system: string, prompt: string, maxTokens = 2600) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
      max_tokens: maxTokens,
    }),
  });

  const j = await r.json().catch(() => null);
  const text = j?.choices?.[0]?.message?.content;
  if (!r.ok || !text) throw new Error(j?.error?.message || `DeepSeek error (${r.status})`);
  return String(text).trim();
}

function buildPremiumPrompt(args: {
  project: ProjectLike;
  attempt: AttemptLike;
  keys: any;
}) {
  const { project, attempt, keys } = args;
  return [
    "Сделай профессиональную интерпретацию одного психометрического теста для специалиста по оценке персонала.",
    `Цель оценки: ${goalLabel(project.goal)}.`,
    project.target_role ? `Целевая роль: ${project.target_role}.` : "",
    `Тест: ${attempt.test_title || attempt.test_slug}.`,
    project.person_name ? `Участник: ${project.person_name}.` : "",
    project.current_position ? `Текущая позиция: ${project.current_position}.` : "",
    project.notes ? `Заметки специалиста: ${trimText(project.notes, 700)}.` : "",
    "",
    "Результаты теста:",
    safeJson(attempt.result),
    "",
    "Материалы интерпретации (используй их как главный источник смыслов и формулировок):",
    safeJson(keys),
    "",
    "Требования к ответу:",
    "- Пиши по-русски, без медицинских ярлыков и без избыточной теории.",
    "- Не используй markdown-решётки, только обычные подзаголовки и короткие абзацы.",
    "- Сначала дай Короткий вывод (2–4 предложения).",
    "- Затем блок Ключевые акценты (4–6 буллетов).",
    "- Затем блок Риски и ограничения (3–5 буллетов).",
    "- Затем блок Практический смысл для цели оценки (3–5 буллетов).",
    "- Опирайся на реальные показатели и материалы интерпретации, не выдумывай шкалы.",
  ].filter(Boolean).join("\n");
}

async function buildAiPlusPrompt(args: {
  project: ProjectLike;
  attempts: AttemptLike[];
  premiumByTest: Array<{ title: string; body: string }>;
  competencySignals: CompetencySignal[];
  customRequest?: string | null;
  fitRequest?: string | null;
  fitProfileId?: string | null;
}) {
  const { project, attempts, premiumByTest, competencySignals, customRequest, fitRequest, fitProfileId } = args;
  const testsBlock = attempts.map((attempt, index) => {
    const premium = premiumByTest.find((item) => item.title === (attempt.test_title || attempt.test_slug));
    return [
      `${index + 1}. ${attempt.test_title || attempt.test_slug}`,
      "Числовые результаты:",
      formatTopRows(attempt.result),
      premium?.body ? `Интерпретация по тесту:\n${trimText(cleanText(premium.body), 1200)}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  const competencyBlock = competencySignals.map((item) => `${item.title}: ${item.status}; ${item.short}`).join("\n");

  return [
    "Собери короткий синтез для специалиста по оценке персонала.",
    `Цель оценки: ${goalLabel(project.goal)}.`,
    project.person_name ? `Участник: ${project.person_name}.` : "",
    project.current_position ? `Текущая позиция: ${project.current_position}.` : "",
    project.target_role ? `Целевая роль: ${project.target_role}.` : "",
    project.notes ? `Заметки специалиста: ${trimText(project.notes, 900)}` : "",
    fitProfileId ? `Ролевая матрица: ${(await getServerFitProfileById(fitProfileId))?.label || fitProfileId}.` : "",
    fitRequest ? `Индекс соответствия нужен относительно запроса: ${fitRequest}.` : "",
    customRequest ? `Дополнительный акцент: ${customRequest}.` : "",
    "",
    "Короткие сигналы по фокусу оценки:",
    competencyBlock,
    "",
    "Материалы по пройденным тестам:",
    testsBlock,
    "",
    "Требования к ответу:",
    "- Пиши по-русски, без воды.",
    "- Никаких markdown-решёток и таблиц.",
    "- Ответ короткий и структурный: 1) общий вывод 2) сильные стороны 3) риски 4) что особенно важно с учётом профиля человека.",
    "- Не пересказывай каждый тест подробно, а собирай синтез только по сути.",
  ].filter(Boolean).join("\n");
}

async function buildPremiumInterpretation(project: ProjectLike, attempt: AttemptLike, keys: any) {
  const prompt = buildPremiumPrompt({ project, attempt, keys });
  const llmText = await callDeepseek(
    "Ты помогаешь специалисту по оценке персонала профессионально расшифровывать результаты тестов.",
    prompt,
    2200
  ).catch(() => null);
  if (llmText) return cleanText(llmText);
  return cleanText(await aiInterpretation({
    test_slug: attempt.test_slug,
    test_title: attempt.test_title || attempt.test_slug,
    result: attempt.result,
  }));
}

function buildProfileContext(project: ProjectLike) {
  const lines: string[] = [];
  if (project.current_position?.trim()) lines.push(`Текущая позиция: ${project.current_position.trim()}.`);
  if (project.target_role?.trim()) lines.push(`Целевая роль / ориентир: ${project.target_role.trim()}.`);
  if (project.notes?.trim()) lines.push(`Комментарий специалиста: ${trimText(project.notes.trim(), 420)}`);
  if (!lines.length) return "Дополнительный профиль не заполнен: анализ опирается прежде всего на результаты тестов.";
  lines.push("Эти данные используются как контекст для интерпретации, но не как самостоятельное доказательство компетенций.");
  return lines.join("\n\n");
}

function buildFocusIntro(project: ProjectLike, competencySignals: CompetencySignal[]) {
  const routingMeta = project.routing_meta;
  if (routingMeta?.mode === "competency" && routingMeta.competencyIds?.length) {
    return `Анализ собран по выбранным компетенциям: ${getCompetencyShortLabel(routingMeta.competencyIds)}. Система не пересказывает все тесты подряд, а смотрит только на те сигналы, которые действительно поддерживают выбранный набор.`;
  }

  const goal = getGoalDefinition(project.goal);
  const clusterLead = competencySignals.slice(0, 3).map((item) => item.title).join(", ");
  return `Анализ собран относительно цели «${goal?.shortTitle || project.goal}». В коротком контуре сейчас сильнее всего читаются: ${clusterLead || "рабочие и поведенческие сигналы по проекту"}.`;
}

function getFocusCompetencyIds(project: ProjectLike, attempts: AttemptLike[]) {
  const fromMeta = project.routing_meta?.mode === "competency" ? project.routing_meta.competencyIds || [] : [];
  if (fromMeta.length) return fromMeta;

  const availableSlugs = Array.from(new Set(attempts.map((item) => item.test_slug).filter(Boolean)));
  const routes = getCompetenciesForGoal(project.goal as any)
    .map((item) => {
      const relevantSlugs = getCompetencyRecommendedTests([item.id], availableSlugs, "standard");
      const overlap = relevantSlugs.filter((slug) => availableSlugs.includes(slug)).length;
      return { id: item.id, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 6)
    .map((item) => item.id);
  return routes;
}

function buildCompetencySignals(project: ProjectLike, attempts: AttemptLike[], explicitIds?: readonly string[]) {
  const availableSlugs = Array.from(new Set(attempts.map((item) => item.test_slug).filter(Boolean)));
  const focusIds = explicitIds?.length ? Array.from(explicitIds) : getFocusCompetencyIds(project, attempts);
  const routes = getCompetencyRoutes(focusIds);

  return routes.map<CompetencySignal>((route) => {
    const relevantSlugs = getCompetencyRecommendedTests([route.id], availableSlugs, "standard");
    const relevantAttempts = attempts.filter((item) => relevantSlugs.includes(item.test_slug));
    const avgSignal = relevantAttempts.length
      ? relevantAttempts.map((item) => extractSignal(item.result)).reduce((sum, value) => sum + value, 0) / relevantAttempts.length
      : 52;
    const coverageBoost = Math.min(6, relevantAttempts.length * 2);
    const score = Math.round(clamp(35, avgSignal + coverageBoost, 95));
    const statusInfo = describeStatus(score);
    const evidence = [...new Set(relevantAttempts.flatMap((item) => getTopLabels(item.result, 2)))].slice(0, 4);
    const profileLink = project.target_role?.trim() || project.current_position?.trim() || goalLabel(project.goal);
    const short = `${statusInfo.tone}; опора: ${evidence.length ? evidence.join(", ") : "данные тестов"}.`;
    const details = [
      `${statusInfo.label}: ${score}/100.`,
      `Компетенция читается через методики: ${relevantAttempts.map((item) => item.test_title || item.test_slug).join(", ") || "нет завершённых тестов из этого контура"}.`,
      evidence.length ? `Повторяющиеся сигналы: ${evidence.join(", ")}.` : "Повторяющиеся сигналы пока слабые: часть нужных методик ещё не завершена или результаты неоднозначны.",
      `Как читать для текущего запроса (${profileLink}): ${route.fitGate}`,
    ].join("\n\n");

    return {
      id: route.id,
      title: route.name,
      score,
      status: statusInfo.label,
      short,
      details,
    };
  });
}

function buildCompactIndicatorText(items: CompetencySignal[]) {
  return items
    .map((item) => `• ${item.title} — ${item.status.toLowerCase()} (${item.score}/100): ${item.short}`)
    .join("\n");
}

export async function buildCommercialEvaluation(
  project: ProjectLike,
  attempts: AttemptLike[],
  overrideMode?: EvaluationPackage | string | null,
  options?: BuildOptions
) {
  const mode = ((overrideMode || project.package_mode || "basic") as EvaluationPackage);
  const packageDef = getEvaluationPackageDefinition(mode);
  const sections: EvaluationSection[] = [];
  const complete = attempts.length > 0;

  sections.push({
    kind: "summary",
    title: packageDef?.title || mode,
    body:
      mode === "basic"
        ? "Итоговые результаты тестов."
        : mode === "premium"
        ? "Результаты тестов + индивидуальная интерпретация результатов каждого теста."
        : "Короткий профиль по цели или компетенциям, ключевые сигналы, риски и при запросе индекс соответствия.",
  });

  if (!complete) {
    sections.push({
      kind: "summary",
      title: "Оценка ещё не готова",
      body: "Дождись завершения хотя бы одного теста. Полная глубина результата появится после прохождения всех назначенных методик.",
    });
    return { mode, sections };
  }

  if (mode === "basic") {
    for (const attempt of attempts) {
      sections.push({
        kind: "test",
        title: attempt.test_title || attempt.test_slug,
        body: formatTopRows(attempt.result),
      });
    }
    return { mode, sections };
  }

  const keysBySlug = options?.interpretationKeysBySlug || {};
  const premiumByTest: Array<{ title: string; body: string }> = [];
  for (const attempt of attempts) {
    const keys = keysBySlug[attempt.test_slug] ?? DEFAULT_TEST_INTERPRETATIONS[attempt.test_slug] ?? null;
    const body = await buildPremiumInterpretation(project, attempt, keys);
    premiumByTest.push({ title: attempt.test_title || attempt.test_slug, body });
    sections.push({
      kind: "test",
      title: attempt.test_title || attempt.test_slug,
      body,
    });
  }

  if (mode === "premium_ai_plus") {
    const fitMatrix = options?.fitEnabled
      ? await resolveFitMatrixServer({
          goal: project.goal as AssessmentGoal,
          fitProfileId: options?.fitProfileId || null,
          fitRequest: options?.fitRequest || null,
          targetRole: project.target_role || null,
        })
      : null;
    const signalIds = fitMatrix ? Object.keys(fitMatrix.weights) : undefined;
    const rawCompetencySignals = buildCompetencySignals(project, attempts, signalIds);
    const competencySignals = [...rawCompetencySignals]
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    const profileContext = buildProfileContext(project);
    const synthesisPrompt = await buildAiPlusPrompt({
      project,
      attempts,
      premiumByTest,
      competencySignals,
      customRequest: options?.aiPlusRequest || null,
      fitRequest: options?.fitEnabled ? options?.fitRequest || null : null,
      fitProfileId: options?.fitEnabled ? options?.fitProfileId || null : null,
    });
    const synthesis = await callDeepseek(
      "Ты помогаешь специалисту по оценке персонала собирать краткий профессиональный профиль по данным нескольких тестов.",
      synthesisPrompt,
      1800
    ).catch(() => null);

    sections.unshift({
      kind: "portrait",
      title: "Ключевые показатели",
      body: buildCompactIndicatorText(competencySignals),
    });

    const promptMap = await loadCompetencyPromptMap(competencySignals.map((item) => item.id));
    const routeMap = new Map(getCompetencyRoutes(competencySignals.map((item) => item.id)).map((route) => [route.id, route] as const));
    const competencyBodies = await Promise.all(
      competencySignals.map(async (item) => {
        const route = routeMap.get(item.id);
        if (!route) return { item, body: `${item.status} — ${item.score}/100. ${item.short}

${item.details}` };
        const relevantSlugs = getCompetencyRecommendedTests([item.id], attempts.map((attempt) => attempt.test_slug), "standard");
        const relevantAttempts = attempts.filter((attempt) => relevantSlugs.includes(attempt.test_slug));
        const aiBody = await buildCompetencyAiDetail({
          project,
          route,
          signal: item,
          relevantAttempts,
          premiumByTest,
          profileContext,
          customRequest: options?.aiPlusRequest || null,
          fitRequest: options?.fitEnabled ? options?.fitRequest || null : null,
          promptConfig: promptMap[item.id]?.is_active === false ? null : (promptMap[item.id] || null),
        });
        return {
          item,
          body: aiBody ? `${item.status} — ${item.score}/100. ${item.short}

${aiBody}` : `${item.status} — ${item.score}/100. ${item.short}

${item.details}`,
        };
      })
    );

    for (const entry of [...competencyBodies].reverse()) {
      sections.unshift({
        kind: "development",
        title: entry.item.title,
        body: entry.body,
      });
    }

    sections.unshift({
      kind: "portrait",
      title: "Контекст профиля",
      body: profileContext,
    });

    if (options?.fitEnabled) {
      const correspondence = await buildCorrespondenceIndex(
        project,
        attempts,
        rawCompetencySignals,
        options?.fitRequest || null,
        options?.fitProfileId || null
      );
      sections.unshift({
        kind: "portrait",
        title: correspondence.title,
        body: `${correspondence.body}

Ориентир: ${correspondence.requestedLabel}.`,
      });
    }

    sections.unshift({
      kind: "portrait",
      title: "Короткий вывод",
      body: synthesis ? cleanText(synthesis) : buildPortraitFallback(project, attempts),
    });
    sections.unshift({
      kind: "summary",
      title: "Фокус анализа",
      body: buildFocusIntro(project, competencySignals),
    });
  }

  return { mode, sections };
}
