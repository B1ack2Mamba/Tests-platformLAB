import { aiInterpretation } from "@/lib/aiInterpretation";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";
import {
  getEvaluationPackageDefinition,
  getGoalDefinition,
  type EvaluationPackage,
} from "@/lib/commercialGoals";

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
  target_role?: string | null;
};

type EvaluationSection = {
  kind: "summary" | "test" | "portrait" | "manager" | "development";
  title: string;
  body: string;
};

type BuildOptions = {
  interpretationKeysBySlug?: Record<string, any>;
  aiPlusRequest?: string | null;
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

function goalLabel(goal: string) {
  return getGoalDefinition(goal)?.shortTitle || "Оценка";
}

function buildCorrespondenceIndex(project: ProjectLike, attempts: AttemptLike[]) {
  const base = attempts.length
    ? attempts.map((item) => extractSignal(item.result)).reduce((sum, value) => sum + value, 0) / attempts.length
    : 55;
  const testsBonus = Math.min(8, attempts.length * 1.5);
  const score = Math.round(clamp(48, base * 0.78 + testsBonus + 12, 96));

  const titleByGoal: Record<string, string> = {
    role_fit: "Индекс соответствия роли",
    general_assessment: "Индекс рабочего профиля",
    motivation: "Индекс мотивационного профиля",
    management_potential: "Индекс управленческого потенциала",
    team_interaction: "Индекс командного взаимодействия",
    leadership: "Индекс лидерского потенциала",
    self_organization: "Индекс самоорганизации",
    learning_agility: "Индекс обучаемости",
    emotional_regulation: "Индекс эмоциональной устойчивости",
    communication_influence: "Индекс коммуникации и влияния",
  };

  const contextByGoal: Record<string, string> = {
    role_fit: `показывает, насколько профиль человека совпадает с задачами и ожиданиями по роли${project.target_role ? ` «${project.target_role}»` : ""}`,
    general_assessment: "помогает быстро увидеть, насколько цельно и устойчиво человек выглядит по совокупности пройденных тестов",
    motivation: "показывает, насколько внутренние драйверы и эмоциональный профиль поддерживают устойчивую вовлечённость",
    management_potential: "показывает, насколько человек готов брать на себя координацию, ответственность и управленческие решения",
    team_interaction: "показывает, насколько профиль человека поддерживает совместную работу, распределение ролей и рабочую совместимость",
    leadership: "показывает, насколько у человека выражены лидерские паттерны, влияние и способность вести за собой",
    self_organization: "показывает, насколько устойчиво человек держит ритм, сроки и собственную рабочую дисциплину",
    learning_agility: "показывает, насколько быстро и осмысленно человек осваивает новое и перестраивает рабочий подход",
    emotional_regulation: "показывает, насколько устойчиво человек регулирует эмоции и держится под давлением",
    communication_influence: "показывает, насколько уверенно человек выстраивает контакт, доносит смысл и влияет на собеседника",
  };

  const title = titleByGoal[project.goal] || "Индекс рабочего профиля";
  const context = contextByGoal[project.goal] || "помогает быстро увидеть цельность профиля по совокупности завершённых тестов";

  return {
    score,
    title,
    body: `${title}: ${score}/100. Ориентир собран по всем завершённым тестам и ${context}.`,
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

function buildAiPlusPrompt(args: {
  project: ProjectLike;
  attempts: AttemptLike[];
  premiumByTest: Array<{ title: string; body: string }>;
  correspondence: { title: string; body: string; score: number };
  customRequest?: string | null;
}) {
  const { project, attempts, premiumByTest, correspondence, customRequest } = args;
  const testsBlock = attempts.map((attempt, index) => {
    const premium = premiumByTest.find((item) => item.title === (attempt.test_title || attempt.test_slug));
    return [
      `${index + 1}. ${attempt.test_title || attempt.test_slug}`,
      "Числовые результаты:",
      formatTopRows(attempt.result),
      premium?.body ? `Интерпретация по тесту:\n${trimText(cleanText(premium.body), 1600)}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  return [
    "Собери единый результат Премиум AI+ для специалиста по оценке персонала.",
    `Цель оценки: ${goalLabel(project.goal)}.`,
    project.person_name ? `Участник: ${project.person_name}.` : "",
    project.target_role ? `Целевая роль: ${project.target_role}.` : "",
    "",
    `${correspondence.title}: ${correspondence.score}/100.`,
    "Используй этот индекс как обязательный ориентир и поясни его смысл применительно к цели оценки.",
    "",
    "Материалы по пройденным тестам:",
    testsBlock,
    customRequest ? `\nДополнительный запрос специалиста: ${customRequest}\nОбязательно ответь на него отдельным блоком в конце.` : "",
    "",
    "Требования к ответу:",
    "- Пиши по-русски, без медицинских ярлыков и без воды.",
    "- Не используй markdown-решётки и таблицы. Только обычные подзаголовки и короткие абзацы.",
    "- Структура ответа обязательна:",
    "1) Индивидуальный профиль",
    "2) Индекс соответствия",
    "3) Сильные стороны",
    "4) Риски и ограничения",
    "5) Рекомендации по развитию",
    "6) Рекомендации руководителю",
    customRequest ? "7) Дополнительный запрос специалиста" : "",
    "- Синтезируй результаты между тестами, а не пересказывай их по отдельности.",
    "- Если где-то данные противоречивы, прямо скажи об этом и объясни, как это читать специалисту.",
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
        : "Индивидуальный профиль по всем тестам, индекс соответствия и рекомендации.",
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
    const correspondence = buildCorrespondenceIndex(project, attempts);
    const synthesisPrompt = buildAiPlusPrompt({
      project,
      attempts,
      premiumByTest,
      correspondence,
      customRequest: options?.aiPlusRequest || null,
    });
    const synthesis = await callDeepseek(
      "Ты помогаешь специалисту по оценке персонала собирать единый индивидуальный профиль по данным нескольких тестов.",
      synthesisPrompt,
      3200
    ).catch(() => null);

    sections.unshift({
      kind: "portrait",
      title: correspondence.title,
      body: correspondence.body,
    });
    sections.unshift({
      kind: "portrait",
      title: "Индивидуальный профиль",
      body: synthesis ? cleanText(synthesis) : buildPortraitFallback(project, attempts),
    });
  }

  return { mode, sections };
}
