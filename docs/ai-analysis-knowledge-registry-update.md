# База AI-анализа результатов тестов

Сгенерировано: 2026-05-02T18:44:16.882Z

Этот файл собирает в одном месте все основные prompt-ы и источники данных, которые участвуют в полном AI-анализе результатов тестов в проекте.

## 1. Где запускается AI-анализ
- API входа: `pages/api/commercial/projects/evaluation.ts`
- Основная логика сборки: `lib/commercialEvaluation.ts`
- Базовые competency prompts: `lib/competencyPrompts.ts`
- Загрузка живых prompts из Supabase: `lib/serverCompetencyPrompts.ts`
- Методическая книга компетенций: `data/competency-calibration/completed-workbook.json`

### API-обвязка
```ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
```

## 2. Главные prompt-ы общего AI-анализа
### Общий summary prompt (`buildAiPlusPrompt`)
```ts
async function buildAiPlusPrompt(args: {
  project: ProjectLike;
  attempts: AttemptLike[];
  premiumByTest: Array<{ title: string; body: string }>;
  competencySignals: CompetencySignal[];
  fitRequest?: string | null;
  fitProfileId?: string | null;
}) {
  const { project, attempts, premiumByTest, competencySignals, fitRequest, fitProfileId } = args;
  const testsBlock = (premiumByTest.length ? premiumByTest : attempts.map((attempt) => ({
    title: attempt.test_title || attempt.test_slug,
    body: formatTopRows(attempt.result),
  }))).map((item, index) => [
    `${index + 1}. ${item.title}`,
    trimText(cleanText(item.body), 1600),
  ].join("\n")).join("\n\n---\n\n");

  const competencyBlock = competencySignals.map((item) => `${item.title}: ${item.status}; ${item.short}`).join("\n");

  return [
    "Собери общий профессиональный отчёт для специалиста по оценке персонала.",
    `Цель оценки: ${goalLabel(project.goal)}.`,
    project.person_name ? `Участник: ${project.person_name}.` : "",
    project.current_position ? `Текущая позиция: ${project.current_position}.` : "",
    project.target_role ? `Целевая роль: ${project.target_role}.` : "",
    project.notes ? `Заметки специалиста: ${trimText(project.notes, 900)}` : "",
    fitProfileId ? `Ролевая матрица: ${(await getServerFitProfileById(fitProfileId))?.label || fitProfileId}.` : "",
    fitRequest ? `Индекс соответствия нужен относительно запроса: ${fitRequest}.` : "",
    "",
    "Короткие сигналы по фокусу оценки:",
    competencyBlock,
    "",
    "Материалы по пройденным тестам и их интерпретационным пакетам:",
    testsBlock,
    "",
    "Требования к ответу:",
    "- Пиши по-русски, без воды.",
    "- Никаких markdown-решёток и таблиц.",
    "- Опирайся на материалы интерпретации каждого теста и собирай по ним общую картину.",
    "- Не пересказывай каждый тест подряд, а собирай повторяющиеся сигналы, плюсы, минусы и риски.",
    "- Верни ответ строго в блоках с этими заголовками:",
    "Общий вывод",
    "Сильные стороны",
    "Минусы и ограничения",
    "Риски",
    "Что особенно важно для цели оценки",
  ].filter(Boolean).join("\n");
}
```

### Follow-up prompt для дополнительного запроса (`buildAiPlusFollowupPrompt`)
```ts
async function buildAiPlusFollowupPrompt(args: {
  project: ProjectLike;
  attempts: AttemptLike[];
  premiumByTest: Array<{ title: string; body: string }>;
  competencySignals: CompetencySignal[];
  customRequest: string;
  fitRequest?: string | null;
  fitProfileId?: string | null;
}) {
  const { project, attempts, premiumByTest, competencySignals, customRequest, fitRequest, fitProfileId } = args;
  const basePrompt = await buildAiPlusPrompt({
    project,
    attempts,
    premiumByTest,
    competencySignals,
    fitRequest,
    fitProfileId,
  });

  return [
    basePrompt,
    "",
    `Дополнительный запрос специалиста: ${customRequest}.`,
    "",
    "Сделай отдельное дополнение к уже существующему общему профилю.",
    "Не переписывай весь итог заново и не повторяй уже сказанное без необходимости.",
    "Дай отдельный прикладной блок по этому запросу.",
    "Структура ответа:",
    "1. Что видно по запросу",
    "2. На чём это основано в данных",
    "3. Практический вывод для руководителя / HR",
    "4. Что здесь остаётся гипотезой",
    "Если данных недостаточно, скажи это прямо и не додумывай.",
  ].join("\n");
}
```

### Prompt для интерпретации одного теста (`buildPremiumPrompt`)
```ts
function buildPremiumPrompt(args: {
  project: ProjectLike;
  attempt: AttemptLike;
  keys: any;
}) {
  const { project, attempt, keys } = args;

  if (isHerzbergMotivationResult(attempt.result, attempt.test_title || attempt.test_slug)) {
    return buildHerzbergPrompt({
      testTitle: attempt.test_title || attempt.test_slug,
      result: attempt.result,
      audience: "staff",
    });
  }

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
```

### Prompt для компетенции (`buildCompetencyAiDetail`)
```ts
async function buildCompetencyAiDetail(args: {
  project: ProjectLike;
  route: CompetencyRoute;
  signal: CompetencySignal;
  relevantAttempts: AttemptLike[];
  premiumByTest: Array<{ title: string; body: string }>;
  profileContext: string;
  overallReport?: string;
  customRequest?: string | null;
  fitRequest?: string | null;
  promptConfig?: CompetencyPromptRow | null;
}) {
  const { project, route, signal, relevantAttempts, premiumByTest, profileContext, overallReport, customRequest, fitRequest, promptConfig } = args;
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
    practical_experience: compactLine(promptConfig?.notes),
    profile_context: profileContext,
    test_results_block: buildRelevantTestResultsBlock(relevantAttempts),
    premium_interpretations_block: buildRelevantPremiumBlock(relevantAttempts, premiumByTest),
    competency_evidence_packet: buildCompetencyEvidencePromptPacket(
      route.id,
      relevantAttempts.map((attempt) => attempt.test_slug)
    ),
  });

  const finalPrompt = [
    prompt,
    overallReport?.trim()
      ? `Общий интегральный отчёт по проекту:
${trimText(overallReport, 1800)}`
      : "",
    "Формат финального ответа по компетенции:",
    "- Максимум 2–3 предложения.",
    "- Сначала явно укажи уровень: низкий, средний или высокий.",
    "- Сразу поясни, что этот уровень значит в рабочем поведении и для текущей цели / роли.",
    "- Не дублируй общий отчёт и не уходи в длинные списки.",
  ].filter(Boolean).join("\n\n");

  const text = await callDeepseek(systemPrompt, finalPrompt, 900).catch(() => null);
  return text ? cleanText(text) : null;
}
```

### Prompt для индекса соответствия (`buildCorrespondenceIndex`)
```ts
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
```

## 3. Базовый competency prompt из кода
### Placeholders
```ts
export const COMPETENCY_PROMPT_PLACEHOLDERS = [
  { key: "competency_id", label: "ID компетенции" },
  { key: "competency_name", label: "Название компетенции" },
  { key: "competency_cluster", label: "Кластер компетенции" },
  { key: "competency_definition", label: "Определение компетенции" },
  { key: "competency_fit_gate", label: "Правило чтения / fit gate" },
  { key: "competency_score", label: "Скоринг компетенции 0-100" },
  { key: "competency_status", label: "Статус компетенции" },
  { key: "competency_short", label: "Короткий сигнал по компетенции" },
  { key: "project_goal_label", label: "Человеческое название цели оценки" },
  { key: "project_title", label: "Название проекта" },
  { key: "person_name", label: "Имя участника" },
  { key: "current_position", label: "Текущая должность" },
  { key: "target_role", label: "Будущая предполагаемая должность" },
  { key: "notes", label: "Заметки специалиста" },
  { key: "practical_experience", label: "Практические правила и опыт специалиста" },
  { key: "custom_request", label: "Дополнительный запрос специалиста" },
  { key: "fit_request", label: "Запрос на индекс соответствия" },
  { key: "profile_context", label: "Готовый профильный контекст" },
  { key: "test_results_block", label: "Короткие результаты релевантных тестов" },
  { key: "premium_interpretations_block", label: "Короткие AI / key-интерпретации по релевантным тестам" },
  { key: "competency_evidence_packet", label: "Методический пакет competency calibration" },
] as const;
```

### System prompt и default template
```ts
export const DEFAULT_COMPETENCY_SYSTEM_PROMPT = "Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.";

export function getDefaultCompetencyPromptTemplate(route: CompetencyRoute) {
  return [
    `Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.`,
    `Кластер: {{competency_cluster}}.`,
    `Определение: {{competency_definition}}`,
    `Правило чтения / fit gate: {{competency_fit_gate}}`,
    "",
    "Контекст проекта:",
    "- Название проекта: {{project_title}}",
    "- Цель оценки: {{project_goal_label}}",
    "- Участник: {{person_name}}",
    "- Текущая должность: {{current_position}}",
    "- Будущая предполагаемая должность: {{target_role}}",
    "- Заметки специалиста: {{notes}}",
    "- Дополнительный запрос: {{custom_request}}",
    "- Запрос на соответствие: {{fit_request}}",
    "",
    "Сводный сигнал по компетенции:",
    "- Статус: {{competency_status}}",
    "- Оценка: {{competency_score}}/100",
    "- Короткий сигнал: {{competency_short}}",
    "",
    "Контекст профиля:",
    "{{profile_context}}",
    "",
    "Результаты релевантных тестов:",
    "{{test_results_block}}",
    "",
    "Короткие интерпретации по этим тестам:",
    "{{premium_interpretations_block}}",
    "",
    "Методический пакет по компетенции:",
    "{{competency_evidence_packet}}",
    "",
    "Практические правила и поведенческие маркеры:",
    "{{practical_experience}}",
    "",
    "Формат ответа:",
    "1. Вердикт по компетенции — 2–3 предложения.",
    "2. Что подтверждает компетенцию — 3–5 коротких буллетов.",
    "3. Что ограничивает / риски — 2–4 коротких буллета.",
    "4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.",
    "Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.",
  ].join("\n");
}
```

## 4. Живые competency prompts из Supabase
Источник: supabase
Всего строк: 31

### C01 — Аналитическое мышление
- Кластер: Мышление и обучение
- Активен: да
- sort_order: 1

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Аналитическое мышление»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Считать компетенцию подтверждённой, когда минимум 2 когнитивных семейства (16PF + Belbin/learning/color) согласованно поддерживают анализ и нет явной импульсивности.
- В первую очередь опирайся на core route: 16PF, Belbin.
- Для устойчивого вывода проверь standard route: 16PF, Belbin, Типология обучения.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Аналитическое мышление». Определение: Умение разбирать ситуацию на части, сравнивать варианты, видеть причинно-следственные связи и снижать риск ошибочного решения. Rule of thumb: Считать компетенцию подтверждённой, когда минимум 2 когнитивных семейства (16PF + Belbin/learning/color) согласованно поддерживают анализ и нет явной импульсивности. Core-signals: 16PF B↑, N↑/ср, Q1↑; Belbin ME↑ или CF↑; Learning THE/OBS; Color BLUE или BLUE_GREEN. Supportive-signals: Time L/LC; USK IO/IP↑; 16PF L умеренно↑ без социальной ригидности. Contra-signals: 16PF B↓, Q1↓; чистый EXP/P без OBS/THE; RED при низком Q3 и C. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Структурирует проблему на факторы; сравнивает альтернативы по критериям; проверяет вывод фактами и не прыгает к первому решению. Интервью-проверка: Расскажите о сложном решении: какие факты сравнивали и что отбросили?; Как вы проверяете, что вывод не построен на первом впечатлении?
```

### C02 — Системное / концептуальное мышление
- Кластер: Мышление и обучение
- Активен: да
- sort_order: 2

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Системное / концептуальное мышление». Определение: Умение видеть систему целиком, строить модели, работать с абстракциями и переносить выводы на более широкий контекст. Rule of thumb: Подтверждать, если в профиле есть сочетание абстрактности + логики + хотя бы одного поведенческого сигнала (Belbin/learning/color). Core-signals: 16PF Q1↑, M↑/ср, B↑; Learning THE; Belbin ME/PL; Color BLUE или RED_BLUE. Supportive-signals: Time LC/L; 16PF N↑; Motivation E/H↑. Contra-signals: 16PF Q1↓ и M↓; доминирующий PRA без THE/OBS; чистый RED при низком B. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Видит связи между частями системы; строит объясняющую модель; переносит принцип на новые задачи без потери контекста. Интервью-проверка: Опишите систему, которую вам пришлось понять или улучшить: какие связи были ключевыми?; Как вы объясняете сложную модель человеку вне темы?
```

### C03 — Критическое суждение / качество решений
- Кластер: Мышление и обучение
- Активен: да
- sort_order: 3

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Критическое суждение / качество решений»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Сигнал силён, когда критичность сочетается с самоконтролем; голая подозрительность или критика без структуры не засчитывается.
- В первую очередь опирайся на core route: 16PF, Belbin.
- Для устойчивого вывода проверь standard route: 16PF, Belbin, Типология обучения.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Критическое суждение / качество решений». Определение: Способность не просто генерировать идеи, а проверять их на реалистичность, риски и последствия. Rule of thumb: Сигнал силён, когда критичность сочетается с самоконтролем; голая подозрительность или критика без структуры не засчитывается. Core-signals: Belbin ME↑/CF↑; Learning OBS/THE; 16PF Q3↑, G↑, L умеренно↑; USK IO/IP↑. Supportive-signals: Time L; EMIN PE↑; 16PF C↑. Contra-signals: Belbin PL/SH без ME/CF; RED + F/H↑ при Q3↓; хаотичный P/PC без L. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Заранее видит риски решения; отделяет факт от гипотезы; умеет оспаривать идею без разрушения процесса. Интервью-проверка: Когда вы остановили или изменили решение из-за риска?; Как вы отличаете полезную критичность от торможения процесса?
```

### C04 — Креативность / генерация идей
- Кластер: Мышление и обучение
- Активен: да
- sort_order: 4

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Креативность / генерация идей». Определение: Способность предлагать новые подходы, видеть нестандартные решения и не застревать только в стандартных шаблонах. Rule of thumb: Подтверждать, если новаторство поддержано и стилем мышления, и поведенческой ролью, а не только одним высоким M. Core-signals: Belbin PL↑/RI↑; 16PF M↑, Q1↑, F↑; Learning EXP; Color RED_BLUE или BLUE_GREEN. Supportive-signals: Time P/PC; Motivation E/H↑; 16PF H↑. Contra-signals: 16PF Q1↓, M↓; Belbin CW/CF при отсутствии PL/RI; чрезмерный L-only профиль. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Предлагает несколько нестандартных вариантов; соединяет разные источники идей; переводит идею в проверяемый прототип. Интервью-проверка: Приведите пример идеи, которая стала рабочим решением.; Что вы делаете, когда стандартный подход не работает?
```

### C05 — Обучаемость / learning agility
- Кластер: Мышление и обучение
- Активен: да
- sort_order: 5

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Обучаемость / learning agility»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Компетенция сильна, когда есть одновременно открытость к новому, мотивация на рост и рабочая готовность пробовать/перестраиваться.
- В первую очередь опирайся на core route: 16PF, Типология обучения.
- Для устойчивого вывода проверь standard route: 16PF, Мотивационные карты, Тайм-менеджмент, Типология обучения.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Обучаемость / learning agility». Определение: Скорость и качество освоения нового опыта, готовность менять подход и переносить новые способы в работу. Rule of thumb: Компетенция сильна, когда есть одновременно открытость к новому, мотивация на рост и рабочая готовность пробовать/перестраиваться. Core-signals: Learning EXP или смешанные профили с THE/PRA; 16PF Q1↑, B↑, H↑; Motivation E↑; Time P/PC либо LPC. Supportive-signals: Color RED/BLUE_GREEN; Belbin RI/PL; USK IO↑. Contra-signals: 16PF Q1↓; низкий мотив E; жёсткий L при низкой гибкости situational guidance. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Быстро извлекает урок из опыта; пробует новый способ и корректирует его; ищет обратную связь для улучшения. Интервью-проверка: Какая новая область далась вам быстрее всего и почему?; Как вы переносили новый навык в реальную задачу?
```

### C06 — Практическое применение знаний
- Кластер: Мышление и обучение
- Активен: да
- sort_order: 6

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Практическое применение знаний». Определение: Умение переводить идеи и обучение в конкретные действия, инструменты и рабочий результат. Rule of thumb: Подтверждать, если прикладной стиль учёбы подтверждён исполнением и самодисциплиной. Core-signals: Learning PRA↑; Belbin CW↑/SH↑; 16PF Q3↑, G↑, C↑; Time L/LP. Supportive-signals: Motivation H/F/C↑; USK IP↑. Contra-signals: PL/M/Q1 высоки при низком Q3; доминирующий THE без PRA; PC без опоры на L. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Переводит знания в шаги/инструменты; показывает результат применения; адаптирует теорию к ограничениям задачи. Интервью-проверка: Что из недавно изученного вы внедрили в работу?; Как вы понимаете, что обучение дало практический результат?
```

### C07 — Планирование и приоритизация
- Кластер: Управление собой
- Активен: да
- sort_order: 7

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Планирование и приоритизация»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Компетенция подтверждается, когда стиль времени и личностная организованность сходятся в одну сторону.
- В первую очередь опирайся на core route: 16PF, Тайм-менеджмент.
- Для устойчивого вывода проверь standard route: 16PF, УСК, Belbin, Тайм-менеджмент.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Планирование и приоритизация». Определение: Умение выстраивать порядок задач, удерживать сроки и раскладывать работу по важности/последовательности. Rule of thumb: Компетенция подтверждается, когда стиль времени и личностная организованность сходятся в одну сторону. Core-signals: Time L/LP; 16PF Q3↑, G↑; Belbin CW↑/CF↑; USK IP↑. Supportive-signals: Motivation F/C↑; 16PF C↑. Contra-signals: P/PC при низком Q3; Belbin PL/RI без CW; 16PF Q4↑ и O↑. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Выделяет главное; раскладывает работу по срокам и зависимостям; меняет план при изменении приоритетов. Интервью-проверка: Как вы выбираете, что делать первым при перегрузе?; Когда ваш план пришлось перестроить и как вы это сделали?
```

### C08 — Самоорганизация и дисциплина
- Кластер: Управление собой
- Активен: да
- sort_order: 8

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Самоорганизация и дисциплина»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Считать высокой только если внутренний контроль подтверждается и по УСК, и по поведенческим стилям.
- В первую очередь опирайся на core route: 16PF, УСК.
- Для устойчивого вывода проверь standard route: 16PF, УСК, Тайм-менеджмент.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Самоорганизация и дисциплина». Определение: Способность стабильно держать рабочий ритм, выполнять договорённости и управлять собой без внешней подгонки. Rule of thumb: Считать высокой только если внутренний контроль подтверждается и по УСК, и по поведенческим стилям. Core-signals: 16PF Q3↑, G↑, C↑; USK IO/IP↑; Time L; Belbin CW↑. Supportive-signals: Motivation C/F/H↑; Color BLUE или RED_BLUE. Contra-signals: USK IO/IP↓; Q3↓, G↓; хаотичный P/C-профиль. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Стабильно выполняет договорённости; сам контролирует ритм и качество; не требует постоянной внешней подгонки. Интервью-проверка: Как вы держите ритм работы без внешнего контроля?; Что помогает вам выполнять обещания, когда появляются отвлечения?
```

### C09 — Ориентация на результат
- Кластер: Управление собой
- Активен: да
- sort_order: 9

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Ориентация на результат». Определение: Фокус на достижении цели, завершении задачи и доведении работы до измеримого эффекта. Rule of thumb: Компетенцию засчитывать, когда драйв на достижение подтверждён хотя бы одним исполнительским контуром. Core-signals: Motivation F↑ и/или C↑; Belbin SH↑/CW↑; 16PF E↑, H↑, C↑; Color RED или RED_BLUE. Supportive-signals: USK ID/IP↑; Time L/LP; 16PF Q4 умеренно↑. Contra-signals: низкий F; высокий интерес к идеям без исполнения (PL/M↑ при Q3↓); GREEN-only без pressure signals. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Формулирует измеримый результат; доводит задачу до завершения; удерживает фокус при отвлечениях и сопротивлении. Интервью-проверка: Какой результат вы довели до конца вопреки препятствиям?; Какие метрики результата вы считали главными?
```

### C10 — Ответственность / ownership
- Кластер: Управление собой
- Активен: да
- sort_order: 10

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Ответственность / ownership»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Ownership считать подтверждённым при высокой интернальности в работе + наличии поведенческого признака ответственности.
- В первую очередь опирайся на core route: 16PF, УСК.
- Для устойчивого вывода проверь standard route: 16PF, УСК, Мотивационные карты.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Ответственность / ownership». Определение: Готовность считать себя автором результата, брать на себя последствия и не перекладывать контроль вовне. Rule of thumb: Ownership считать подтверждённым при высокой интернальности в работе + наличии поведенческого признака ответственности. Core-signals: USK IO↑, ID↑, IP↑; 16PF G↑, Q3↑; Motivation C↑; Belbin CH/CW. Supportive-signals: Color RED_BLUE или BLUE; Time L. Contra-signals: USK IO/IP↓; выраженная внешняя зависимость; IN очень высокий при низких C/VU (самообвинение вместо ownership). Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Берёт ответственность за решение; признаёт вклад своих действий; исправляет последствия вместо поиска виноватых. Интервью-проверка: Когда вы брали ответственность за ошибку или сложный результат?; Что вы делаете, если результат зависит не только от вас?
```

### C11 — Стрессоустойчивость
- Кластер: Управление собой
- Активен: да
- sort_order: 11

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Стрессоустойчивость». Определение: Способность сохранять работоспособность и адекватность под давлением, не разваливаться эмоционально и организационно. Rule of thumb: Высокой считать только при совпадении личностной устойчивости и эмоциональной регуляции. Core-signals: 16PF C↑, O↓/ср, Q4 умеренный; EMIN VU↑/VEI↑; USK IO/IP↑. Supportive-signals: Time L/LC; Color BLUE/RED_BLUE; Belbin CW/CH. Contra-signals: 16PF O↑, Q4↑, C↓; EMIN VU↓; хаотичный PC при низком Q3. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Сохраняет работоспособность под давлением; быстро восстанавливается после сбоя; не переносит напряжение на команду. Интервью-проверка: Опишите период сильного давления: что помогло сохранить эффективность?; Как вы замечаете, что стресс начинает влиять на решения?
```

### C12 — Эмоциональная осознанность
- Кластер: Управление собой
- Активен: да
- sort_order: 12

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Эмоциональная осознанность». Определение: Понимание своих состояний, причин реакций и того, как эмоции влияют на работу и взаимодействие. Rule of thumb: Компетенция опирается прежде всего на ЭМИН; остальные тесты служат модификаторами и контекстом. Core-signals: EMIN VP↑/PE↑; 16PF I↑/M умеренно↑; Learning OBS. Supportive-signals: USK IO↑; Color BLUE. Contra-signals: VP↓/PE↓; RED-only профиль без рефлексивных сигналов. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Называет свои состояния и причины; замечает триггеры реакций; понимает, как эмоции влияют на решения и контакт. Интервью-проверка: Как вы понимаете, что эмоция уже влияет на ваше решение?; Приведите пример, когда осознание состояния помогло изменить поведение.
```

### C13 — Эмоциональная саморегуляция
- Кластер: Управление собой
- Активен: да
- sort_order: 13

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Эмоциональная саморегуляция». Определение: Способность удерживать эмоции под контролем и не разрушать коммуникацию собственными реакциями. Rule of thumb: Подтверждать только если человек умеет и выдерживать себя, и не разбрасывать это на других. Core-signals: EMIN VU↑/UE↑/VE↑; 16PF C↑, O↓; USK IO↑; situational FLEX норма/высокая. Supportive-signals: Time LC/L; Color BLUE_GREEN. Contra-signals: VU↓; O↑, Q4↑; RED + S1-only + VE↓. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Берёт паузу до реакции; держит тон в сложном разговоре; возвращает себя и диалог в рабочий режим. Интервью-проверка: Что вы делаете, когда раздражение возникает в рабочем разговоре?; Как восстанавливаете контакт после эмоционального напряжения?
```

### C14 — Адаптивность / гибкость
- Кластер: Управление собой
- Активен: да
- sort_order: 14

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Адаптивность / гибкость». Определение: Умение перестраиваться под новый контекст, задачи, людей и степень готовности исполнителей. Rule of thumb: Сильна, если гибкость проявляется и в стиле лидерства, и в рабочем/учебном стиле. Core-signals: Situational FLEX↑ и ADEQ_DIAG/NEAR↑; Time P/PC/LPC; Learning EXP; 16PF Q1↑, H↑. Supportive-signals: Belbin RI/PL; Color RED_GREEN или BLUE_GREEN. Contra-signals: ADEQ_LOWER↑ или ADEQ_UPPER↑; жёсткий L при Q1↓; S1-only. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Диагностирует новый контекст; меняет стиль действий под ситуацию; не цепляется за привычную схему, если она не работает. Интервью-проверка: Когда вам пришлось резко сменить подход?; Как вы понимаете, какой стиль нужен конкретной ситуации?
```

### C15 — Независимость / автономность
- Кластер: Управление собой
- Активен: да
- sort_order: 15

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Независимость / автономность». Определение: Умение действовать без постоянной внешней опоры, удерживать собственную позицию и самостоятельные решения. Rule of thumb: Автономность подтверждать, если самостоятельность не сопровождается уходом от ответственности и кооперации. Core-signals: 16PF Q2↑, E↑, Q1↑; USK IO/IP↑; Motivation C↑; Color RED или BLUE. Supportive-signals: Learning THE/EXP; Belbin CH/ME. Contra-signals: Q2↓; сильная зависимость от климата без ownership; GREEN-only при низком E. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Сам принимает рабочие решения; отстаивает позицию аргументированно; действует без постоянного разрешения сверху. Интервью-проверка: В какой ситуации вы приняли решение без подсказки руководителя?; Как вы совмещаете самостоятельность с согласованием?
```

### C16 — Ориентация на качество
- Кластер: Управление собой
- Активен: да
- sort_order: 16

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Ориентация на качество». Определение: Внимание к стандарту, деталям, рискам ошибок и доведению продукта до приемлемого уровня. Rule of thumb: Сигнал качества высокий, когда контроль ошибок поддержан личностной аккуратностью и рабочим стилем. Core-signals: Belbin CF↑/CW↑; 16PF G↑, Q3↑, C↑; Time L; Learning OBS/THE. Supportive-signals: Color BLUE; USK IP↑. Contra-signals: EXP/P-only; 16PF Q3↓, G↓; Belbin PL/RI без CF/CW. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Заранее задаёт критерии качества; замечает ошибки и риски; доводит продукт до стандарта без лишней задержки. Интервью-проверка: Как вы задаёте стандарт качества до старта работы?; Расскажите о случае, когда вы нашли ошибку до того, как она стала проблемой.
```

### C17 — Коммуникация
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 17

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Коммуникация»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Компетенция не сводится к болтливости: нужен и контакт, и считывание собеседника.
- В первую очередь опирайся на core route: 16PF, ЭМИН.
- Для устойчивого вывода проверь standard route: 16PF, ЭМИН, Цветотипы.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Коммуникация». Определение: Способность понятно доносить смысл, поддерживать контакт и быть понятным разным людям. Rule of thumb: Компетенция не сводится к болтливости: нужен и контакт, и считывание собеседника. Core-signals: 16PF A↑, F↑, H↑; EMIN MP↑/VE↑; Color GREEN или RED_GREEN; Belbin CH/RI/TW. Supportive-signals: USK IM↑; 16PF N умеренно↑. Contra-signals: A↓, H↓; BLUE-only при низком MP; высокое N без эмпатии. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Объясняет сложное простыми словами; проверяет понимание; меняет форму сообщения под аудиторию. Интервью-проверка: Как вы проверяете, что вас поняли правильно?; Как меняете коммуникацию для разных аудиторий?
```

### C18 — Эмпатия / понимание других
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 18

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Эмпатия / понимание других». Определение: Умение замечать состояние и потребности других людей и учитывать их в рабочем контакте. Rule of thumb: Подтверждать, если межличностное понимание видно не только в одной шкале ЭМИН, но и в стилях поведения. Core-signals: EMIN MP↑/MEI↑; 16PF A↑, I↑; Belbin TW↑; Color GREEN или BLUE_GREEN. Supportive-signals: USK IM↑; situational S3. Contra-signals: MP↓; L↑ при A↓; RED_BLUE без green support. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Замечает состояние другого; задаёт уточняющие вопросы; учитывает потребности человека без потери задачи. Интервью-проверка: Как вы понимаете, что человеку нужна поддержка или другой формат разговора?; Расскажите о случае, когда учёт состояния другого изменил ваше решение.
```

### C19 — Влияние и убеждение
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 19

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Влияние и убеждение»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Высоким считать, когда человек может продавливать результат, но не сваливается в силовое продавливание и удерживает контакт.
- В первую очередь опирайся на core route: 16PF, ЭМИН, Переговорный стиль.
- Для устойчивого вывода проверь standard route: 16PF, ЭМИН, Переговорный стиль.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Влияние и убеждение». Определение: Способность добиваться согласия, менять позицию других и вести их к решению без прямого административного давления. Rule of thumb: Высоким считать, когда человек может продавливать результат, но не сваливается в силовое продавливание и удерживает контакт. Core-signals: EMIN MU↑/MEI↑; 16PF E↑, H↑, N↑; negotiation NEG_ASSERTIVE_BALANCE или A↗ + B↗; situational S2; Color RED или RED_GREEN. Supportive-signals: Belbin CH/RI/SH; Motivation B/C↑; C↗ как готовность к обмену уступками. Contra-signals: A-dominant без B/E; S1-only; MU↓; RED при VE/VU↓; D↑. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Формулирует аргументы под интересы собеседника; добивается согласия без давления; удерживает контакт при несогласии. Интервью-проверка: Как вы убеждали человека без административной власти?; Что вы делаете, когда собеседник не согласен?
```

### C20 — Дипломатичность / политическая чувствительность
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 20

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Дипломатичность / политическая чувствительность». Определение: Умение учитывать интересы сторон, действовать тактично и выбирать форму воздействия под контекст. Rule of thumb: Тактичность подтверждать, когда социальная чувствительность сочетается с партнёрскими стратегиями переговоров, а не только с внешней вежливостью. Core-signals: negotiation B↑/E↗/C↗ при D↓; EMIN MP↑/MU↑; 16PF N↑, A↑; Belbin CH/RI; Color BLUE_GREEN или RED_GREEN. Supportive-signals: Situational S2/S3; USK IM↑. Contra-signals: A-dominant без B/E; RED-only при низких MP/A; D↑ как хроническое избегание. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Учитывает скрытые интересы сторон; выбирает тактичную форму влияния; сохраняет отношения при сложных решениях. Интервью-проверка: Когда нужно было учесть интересы нескольких сторон?; Как вы выбираете момент и форму для сложного сообщения?
```

### C21 — Нетворкинг / ресурсность
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 21

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Нетворкинг / ресурсность». Определение: Способность находить людей, возможности и внешние ресурсы, быстро входить в рабочие связи. Rule of thumb: Подтверждать при сочетании социальной смелости и реального поведенческого стиля на внешние связи. Core-signals: Belbin RI↑; 16PF H↑, A↑, F↑; Color RED_GREEN или GREEN; Time P. Supportive-signals: EMIN MP/MU↑; Motivation B↑. Contra-signals: H↓, A↓; BLUE-only при низкой внешней активности; OBS-only без H. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Быстро находит нужных людей; поддерживает полезные связи; превращает контакты в возможности/ресурсы для задачи. Интервью-проверка: Как вы находите людей или ресурсы для новой задачи?; Как поддерживаете связи, чтобы они не были разовыми?
```

### C22 — Командное взаимодействие
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 22

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Командное взаимодействие»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Командность высокая, если кооперация видна и в ролях, и в способе решать разногласия.
- В первую очередь опирайся на core route: ЭМИН, Переговорный стиль, Belbin.
- Для устойчивого вывода проверь standard route: ЭМИН, Переговорный стиль, Belbin.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Командное взаимодействие». Определение: Умение встроиться в совместную работу, учитывать роли других и удерживать кооперацию без лишнего трения. Rule of thumb: Командность высокая, если кооперация видна и в ролях, и в способе решать разногласия. Core-signals: Belbin TW↑/CH↑/CW↑; EMIN MEI↑; negotiation B↑/C↗/E↗; 16PF A↑, G↑, L↓/ср. Supportive-signals: USK IM/IP↑; Color GREEN/BLUE_GREEN. Contra-signals: A-dominant; D↑; A↓, L↑, Q2↑ без green support. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Берёт свою роль в команде; согласует действия с другими; помогает снижать трение и удерживать общую цель. Интервью-проверка: Как вы определяете свою роль в новой команде?; Что делаете, когда командная работа идёт с трением?
```

### C23 — Управление конфликтом
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 23

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Управление конфликтом». Определение: Способность не только входить в острые ситуации, но и удерживать их в рабочем русле, не разрушая отношения. Rule of thumb: Управление конфликтом — это способность держать острый разговор в рабочем режиме, а не просто побеждать или избегать. Core-signals: negotiation B↑ или C↑ при D↓; EMIN VU↑, MP↑, MU↑; situational S2/S3; 16PF C↑, A↑. Supportive-signals: Belbin CH/TW; USK IM↑; Color RED_GREEN/BLUE_GREEN. Contra-signals: NEG_HARD_BARGAIN_RISK; NEG_AVOID_RISK; S1-only; E↑/RED при низком VU; L↑ и A↓. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Выводит конфликт в предметный разговор; отделяет проблему от личности; ищет рабочее соглашение после напряжения. Интервью-проверка: Опишите конфликт, который удалось вернуть в рабочее русло.; Как вы действуете, если стороны уже на эмоциях?
```

### C24 — Клиентская / партнёрская ориентация
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 24

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Клиентская / партнёрская ориентация». Определение: Фокус на понимании потребностей другой стороны, удержании доверия и качестве сервиса. Rule of thumb: Сильна, когда фокус на потребностях другой стороны не обнуляет собственные границы и качество договорённости. Core-signals: EMIN MP↑/MEI↑; negotiation B↑/E↑; Color GREEN или BLUE_GREEN; Belbin RI/TW/CH; Motivation I↑/B↑/H↑. Supportive-signals: 16PF A↑, H↑; Time C/PC; C↗ как готовность к взаимным уступкам. Contra-signals: NEG_HARD_BARGAIN_RISK; RED_BLUE при низком MP; низкий I и H; A↓. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Выясняет потребность другой стороны; удерживает доверие; предлагает решение, полезное партнёру и организации. Интервью-проверка: Как вы выясняете настоящую потребность клиента/партнёра?; Когда вам приходилось сказать партнёру «нет» и сохранить доверие?
```

### C25 — Лидерский потенциал
- Кластер: Лидерство и управление
- Активен: да
- sort_order: 25

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая должность: {{current_position}}
- Будущая предполагаемая должность: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Методический пакет по компетенции:
{{competency_evidence_packet}}

Практические правила и поведенческие маркеры:
{{practical_experience}}

Дополнительный фокус именно для компетенции «Лидерский потенциал»:
- Сначала проверь, есть ли минимум 2 независимых семейства данных и не нарушен ли fit gate: Не считать высоким по одному E или RED — нужен баланс влияния, устойчивости и управления людьми.
- В первую очередь опирайся на core route: 16PF, Ситуативное руководство.
- Для устойчивого вывода проверь standard route: 16PF, ЭМИН, Ситуативное руководство.
- Если есть сильный ограничивающий признак, не подтверждай высокий уровень автоматически.
- Если данные противоречат друг другу, прямо назови это гипотезой, а не фактом.

Формат ответа:
1. Уровень компетенции — сначала одной фразой укажи: низкий, средний или высокий.
2. Что это значит в рабочем поведении для текущей роли — 1–2 предложения.
3. Что подтверждает вывод — 2–3 коротких пункта только по реально имеющимся тестам.
4. Что ограничивает или снижает уверенность — 1–2 коротких пункта.
5. Что проверить дополнительно на интервью или в работе — 1 короткий пункт.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Лидерский потенциал». Определение: Совокупная вероятность того, что человек сможет вести за собой, удерживать цель и быть точкой опоры для других. Rule of thumb: Не считать высоким по одному E или RED — нужен баланс влияния, устойчивости и управления людьми. Core-signals: Situational FLEX↑ + S2/S3/S4; 16PF E↑, H↑, C↑, Q3↑; Belbin CH/SH/PL; EMIN MU/MP↑. Supportive-signals: USK IO/IP↑; Color RED_GREEN; negotiation NEG_ASSERTIVE_BALANCE. Contra-signals: S1-only; C↓; D↑ как уход от сложных разговоров; Q1↓ при ригидности. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Берёт направление на себя; объединяет людей вокруг цели; удерживает устойчивость и ответственность в напряжении. Интервью-проверка: Когда люди пошли за вашим решением без формального давления?; Как вы удерживаете цель, если команда тревожится или сопротивляется?
```

### C26 — Ситуативное лидерство
- Кластер: Лидерство и управление
- Активен: да
- sort_order: 26

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Ситуативное лидерство». Определение: Умение подбирать стиль управления под зрелость исполнителя и реальный контекст задачи. Rule of thumb: Подтверждать прежде всего по самому тесту situational guidance, а остальные тесты использовать как валидаторы зрелости стиля. Core-signals: FLEX↑, ADEQ_DIAG↑/ADEQ_NEAR↑; EMIN MP↑/MU↑; 16PF C↑, A↑; USK IP/IM↑. Supportive-signals: Belbin CH/TW; negotiation B↑ или NEG_ASSERTIVE_BALANCE. Contra-signals: style rigidity; MP↓; D↑; S1-only or S4-only. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Оценивает зрелость исполнителя; подбирает стиль управления; меняет степень контроля и поддержки под ситуацию. Интервью-проверка: Как вы определяете, сколько контроля нужно исполнителю?; Когда вы меняли стиль управления под человека?
```

### C27 — Делегирование
- Кластер: Лидерство и управление
- Активен: да
- sort_order: 27

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Делегирование». Определение: Готовность отдавать автономию, не перехватывая лишний контроль там, где человек уже способен справиться сам. Rule of thumb: Делегирование считать сильным только при наличии признаков доверия и контроля импульса «сделать всё самому». Core-signals: S4 и/или высокая адекватность на R4; 16PF C↑, A↑, L низко/средне; Belbin CH; USK IP↑. Supportive-signals: EMIN MP↑; negotiation B↗/C↗. Contra-signals: Q2↑ + IM↓ + D↑; CF-only; S1 микроменеджерский. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Передаёт задачу с ясным результатом; задаёт границы контроля; доверяет автономию зрелому исполнителю. Интервью-проверка: Как вы решаете, что можно делегировать?; Как контролируете задачу, не забирая автономию?
```

### C28 — Координация и организация других
- Кластер: Лидерство и управление
- Активен: да
- sort_order: 28

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Координация и организация других». Определение: Умение собирать людей вокруг общей задачи, распределять роли, удерживать темп и сопрягать вклад разных участников. Rule of thumb: Подтверждать, когда координация поддержана и ролями, и структурой, а не только напором. Core-signals: Belbin CH↑/SH↑/CW↑; 16PF E↑, G↑, Q3↑; Time L/LP; USK IP↑. Supportive-signals: Color RED_GREEN или RED_BLUE; Motivation C/F↑. Contra-signals: PL/RI без CH/CW; Q3↓; P-only chaos. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Распределяет роли и ресурсы; синхронизирует вклад участников; удерживает темп и видимость прогресса. Интервью-проверка: Как вы распределяли роли в сложной совместной задаче?; Что делаете, если вклад участников не синхронизирован?
```

### C29 — Лидерство изменений
- Кластер: Лидерство и управление
- Активен: да
- sort_order: 29

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Лидерство изменений». Определение: Способность инициировать движение, продавить новизну и провести людей через изменения без распада работы. Rule of thumb: Высоким считать, если новаторство соединено с способностью тянуть людей, а не только генерировать идеи. Core-signals: 16PF Q1↑, H↑, E↑, F↑; Belbin PL/RI/SH; Learning EXP; Color RED/RED_BLUE. Supportive-signals: Situational FLEX↑; Motivation E/F↑; Time P/PC. Contra-signals: Q1↓; rigid L-only; CF/CW-only without PL/RI. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Запускает новое направление; объясняет смысл изменений; проводит людей через сопротивление и неопределённость. Интервью-проверка: Как вы запускали изменение, которое встречало сопротивление?; Как объясняете людям смысл нового порядка?
```

### C30 — Коучинг / развитие других
- Кластер: Лидерство и управление
- Активен: да
- sort_order: 30

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Коучинг / развитие других». Определение: Способность замечать уровень человека, поддерживать рост и усиливать его без лишнего давления. Rule of thumb: Компетенция сильна, когда поддержка людей подтверждается и стилем лидерства, и эмоциональным контуром. Core-signals: Situational S3/S2; EMIN MP↑, MU↑; 16PF A↑, I↑, C↑; Belbin TW/CH. Supportive-signals: USK IM↑; negotiation B↑/E↗. Contra-signals: MP↓; A-dominant; S1-only; A↓ при H↓. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Замечает потенциал и пробелы; задаёт развивающие вопросы; поддерживает рост без лишнего давления. Интервью-проверка: Как вы понимаете, чему человеку нужно научиться?; Что вы делаете, чтобы поддержать развитие без давления?
```

### C31 — Переговорная компетентность / договороспособность
- Кластер: Коммуникация и влияние
- Активен: да
- sort_order: 31

#### system_prompt
```text
Ты помогаешь специалисту по оценке персонала коротко и предметно интерпретировать одну компетенцию на основе нескольких тестов. Никакой воды, только практический вывод по данным.
```

#### prompt_template
```text
Проанализируй компетенцию {{competency_name}} для специалиста по оценке персонала.
Кластер: {{competency_cluster}}.
Определение: {{competency_definition}}
Правило чтения / fit gate: {{competency_fit_gate}}

Контекст проекта:
- Название проекта: {{project_title}}
- Цель оценки: {{project_goal_label}}
- Участник: {{person_name}}
- Текущая позиция: {{current_position}}
- Целевая роль: {{target_role}}
- Заметки специалиста: {{notes}}
- Дополнительный запрос: {{custom_request}}
- Запрос на соответствие: {{fit_request}}

Сводный сигнал по компетенции:
- Статус: {{competency_status}}
- Оценка: {{competency_score}}/100
- Короткий сигнал: {{competency_short}}

Контекст профиля:
{{profile_context}}

Результаты релевантных тестов:
{{test_results_block}}

Короткие интерпретации по этим тестам:
{{premium_interpretations_block}}

Формат ответа:
1. Вердикт по компетенции — 2–3 предложения.
2. Что подтверждает компетенцию — 3–5 коротких буллетов.
3. Что ограничивает / риски — 2–4 коротких буллета.
4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.
Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.
```

#### notes
```text
Практическое правило для промта по компетенции «Переговорная компетентность / договороспособность». Определение: Способность удерживать свои интересы и интересы другой стороны, выбирать подходящий стиль согласования и доводить конфликт или торг до рабочего соглашения. Rule of thumb: Подтверждать, если переговорный тест показывает партнёрский или сбалансированно-ассертивный стиль, а эмоциональная и личностная модель подтверждает способность выдерживать напряжение и учитывать интересы сторон. Core-signals: negotiation NEG_WINWIN или NEG_ASSERTIVE_BALANCE; EMIN VU↑/MP↑/MU↑; 16PF A↑/ср, N↑, C↑; situational S2/S3. Supportive-signals: Belbin CH/TW/RI; USK IM/IP↑; C↗ как готовность к размену уступками. Contra-signals: NEG_HARD_BARGAIN_RISK; NEG_AVOID_RISK; NEG_OVER_ACCOMMODATION_RISK; низкие VU/MP; L↑ при A↓. Сначала проверь независимость источников: минимум 2 семейства данных. Затем раздели подтверждения на core/supportive/contra. Не подтверждай высокий уровень, если есть сильный contra или нет core-сигнала. Если данные противоречивы, прямо назови гипотезу и не выдумывай шкалы. Поведенческие маркеры для проверки: Выясняет интересы сторон; выбирает стиль согласования; доводит спор/торг до устойчивого соглашения. Интервью-проверка: Опишите переговоры, где нужно было удержать интересы обеих сторон.; Как вы отличаете уступку от рабочего соглашения?
```

## 5. Методическая база компетенций
Листы в completed workbook: Сводка, Аудит, Компетенции, Signals, Промты, Placeholders, PromptPatches, Calibration, Families, QA_Bundles, Sources, ChangeLog, Rules

### Rules
```json
[
  {
    "Правило": "Evidence first",
    "Описание": "AI-вывод должен опираться на test_results_block, premium_interpretations_block и competency_evidence_packet; контекст роли — модификатор, но не доказательство.",
    "Источник": "lib/competencyPrompts.ts; lib/commercialEvaluation.ts"
  },
  {
    "Правило": "2 independent families minimum",
    "Описание": "Не подтверждать компетенцию жёстко, если нет хотя бы 2 независимых семейств данных.",
    "Источник": "lib/competencyCalibration.ts"
  },
  {
    "Правило": "Score cap on low coverage",
    "Описание": "Если hasMinimumCoverage=false, buildCompetencySignals ограничивает score до 59.",
    "Источник": "lib/commercialEvaluation.ts"
  },
  {
    "Правило": "Status thresholds",
    "Описание": "Высокий уровень: score ≥74; средний: score ≥60; низкий: score <60. Это текущий кодовый порог, а не отдельная психометрическая норма.",
    "Источник": "lib/commercialEvaluation.ts"
  },
  {
    "Правило": "Supportive не решает исход",
    "Описание": "Supportive-сигналы усиливают вывод, но не должны в одиночку делать high verdict.",
    "Источник": "Доработка на основе Signals и prompt rules"
  },
  {
    "Правило": "Contra downgrades",
    "Описание": "Strong contra из core-семейства понижает уровень; два independent contra фиксируют низкий/предварительный verdict.",
    "Источник": "Доработка на основе Signals"
  },
  {
    "Правило": "No invented scales",
    "Описание": "Prompt прямо запрещает выдумывать шкалы и делать выводы без опоры на тесты.",
    "Источник": "lib/competencyPrompts.ts"
  },
  {
    "Правило": "Prompt notes as practical experience",
    "Описание": "commercial_competency_prompts.notes подставляется как practical_experience; туда можно переносить утверждённые правила по компетенции.",
    "Источник": "lib/serverCompetencyPrompts.ts; lib/commercialEvaluation.ts"
  }
]
```

### Families
```json
[
  {
    "Семейство": "16PF",
    "Источник": "16pf-a / 16pf-b",
    "Вопросов": "187",
    "Точность (1-5)": "5",
    "Стоимость/время (1-5)": "5",
    "Почему оставлено в роутере": "базовый каркас личности: устойчивость, доминантность, самоконтроль, openness to change, контактность",
    "Когда использовать": "нужен почти для всех решений о fit, особенно мышление, ответственность, лидерство и коммуникация",
    "Чего не доказывает в одиночку": "эмпатия, конфликт, переговоры, реальная продуктивность"
  },
  {
    "Семейство": "ЭМИН",
    "Источник": "emin",
    "Вопросов": "46",
    "Точность (1-5)": "5",
    "Стоимость/время (1-5)": "3",
    "Почему оставлено в роутере": "точно закрывает межличностное понимание, саморегуляцию и эмоциональную часть коммуникации",
    "Когда использовать": "коммуникация, эмпатия, клиентский сервис, leadership, conflict, coaching",
    "Чего не доказывает в одиночку": "аналитика, ownership, самоорганизация"
  },
  {
    "Семейство": "УСК",
    "Источник": "usk",
    "Вопросов": "44",
    "Точность (1-5)": "4",
    "Стоимость/время (1-5)": "3",
    "Почему оставлено в роутере": "хорошо показывает locus of control, ownership и субъективную ответственность",
    "Когда использовать": "ownership, самоорганизация, лидерство, практическое применение, management potential",
    "Чего не доказывает в одиночку": "эмпатия, креативность, переговоры"
  },
  {
    "Семейство": "Ситуативное руководство",
    "Источник": "situational-guidance",
    "Вопросов": "12",
    "Точность (1-5)": "5",
    "Стоимость/время (1-5)": "1",
    "Почему оставлено в роутере": "дёшево по времени и сильно бьёт в leadership, delegation, adaptability",
    "Когда использовать": "лидерство, делегирование, conflict management, coaching, management potential",
    "Чего не доказывает в одиночку": "глубинная личность, мотивация, аналитика"
  },
  {
    "Семейство": "Переговорный стиль",
    "Источник": "negotiation-style",
    "Вопросов": "30",
    "Точность (1-5)": "4",
    "Стоимость/время (1-5)": "2",
    "Почему оставлено в роутере": "даёт прямой слой по конфликту интересов: сотрудничество, компромисс, состязание, уклонение, подстройка",
    "Когда использовать": "переговоры, клиентский сервис, diplomacy, influence, conflict management, leadership",
    "Чего не доказывает в одиночку": "эмоциональная регуляция, общая личностная устойчивость, аналитика"
  },
  {
    "Семейство": "Belbin",
    "Источник": "belbin",
    "Вопросов": "7",
    "Точность (1-5)": "4",
    "Стоимость/время (1-5)": "1",
    "Почему оставлено в роутере": "очень быстрый поведенческий срез по ролям в команде",
    "Когда использовать": "teamwork, роли, coordination, critical thinking, idea generation",
    "Чего не доказывает в одиночку": "стрессоустойчивость, ownership, глубокая коммуникация"
  },
  {
    "Семейство": "Мотивационные карты",
    "Источник": "motivation-cards",
    "Вопросов": "28",
    "Точность (1-5)": "3",
    "Стоимость/время (1-5)": "2",
    "Почему оставлено в роутере": "объясняет, при каких условиях человек реально включится и будет держать темп",
    "Когда использовать": "motivation, result orientation, learning agility, role fit, retention risks",
    "Чего не доказывает в одиночку": "переговоры, аналитика, командные роли"
  },
  {
    "Семейство": "Тайм-менеджмент",
    "Источник": "time-management",
    "Вопросов": "14",
    "Точность (1-5)": "3",
    "Стоимость/время (1-5)": "1",
    "Почему оставлено в роутере": "показывает организационный стиль: линейность, параллельность, гибридность",
    "Когда использовать": "planning, self-organization, execution rhythm, adaptability",
    "Чего не доказывает в одиночку": "эмпатия, лидерство, мотивация"
  },
  {
    "Семейство": "Типология обучения",
    "Источник": "learning-typology",
    "Вопросов": "20",
    "Точность (1-5)": "3",
    "Стоимость/время (1-5)": "2",
    "Почему оставлено в роутере": "быстро добавляет слой по learning agility и способу усвоения опыта",
    "Когда использовать": "analytical/system thinking, learning agility, creativity, change leadership",
    "Чего не доказывает в одиночку": "ownership, diplomacy, conflict"
  },
  {
    "Семейство": "Цветотипы",
    "Источник": "color-types",
    "Вопросов": "6",
    "Точность (1-5)": "2",
    "Стоимость/время (1-5)": "1",
    "Почему оставлено в роутере": "лёгкий модификатор темперамента и коммуникативного стиля",
    "Когда использовать": "как дешёвый контекстный модификатор почти для любой подборки тестов",
    "Чего не доказывает в одиночку": "любой финальный verdict без других семейств"
  }
]
```

### QA_Bundles
```json
[
  {
    "Bundle ID": "B01",
    "Название bundle": "Коммуникация + эмпатия + клиентская ориентация",
    "Компетенции": "Коммуникация, Эмпатия / понимание других, Клиентская / партнёрская ориентация",
    "Рекомендуемые тесты": "ЭМИН, Переговорный стиль, 16PF, Belbin, Цветотипы, Мотивационные карты",
    "Логика маршрута": "EMIN и переговорный стиль дают основу по людям и отношениям; 16PF и Belbin подтверждают стиль контакта; color/motivation уточняют контекст сервиса.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B02",
    "Название bundle": "Управление конфликтом + дипломатичность + переговорная компетентность",
    "Компетенции": "Дипломатичность / политическая чувствительность, Управление конфликтом, Переговорная компетентность / договороспособность",
    "Рекомендуемые тесты": "Переговорный стиль, ЭМИН, Ситуативное руководство, 16PF, Belbin",
    "Логика маршрута": "Это negotiation-heavy bundle: сперва прямой переговорный тест и ЭМИН, затем situational/16PF/Belbin для проверки зрелости, гибкости и командного поведения.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B03",
    "Название bundle": "Лидерство + влияние + делегирование",
    "Компетенции": "Влияние и убеждение, Лидерский потенциал, Делегирование",
    "Рекомендуемые тесты": "Ситуативное руководство, 16PF, ЭМИН, Переговорный стиль, УСК, Belbin",
    "Логика маршрута": "Leadership bundle требует backbone по leadership style, личности, эмоциональной регуляции и ownership; переговорный стиль нужен, чтобы не спутать влияние с продавливанием.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B04",
    "Название bundle": "Аналитика + системность + критическое суждение",
    "Компетенции": "Аналитическое мышление, Системное / концептуальное мышление, Критическое суждение / качество решений",
    "Рекомендуемые тесты": "16PF, Belbin, Типология обучения, УСК, Цветотипы",
    "Логика маршрута": "16PF даёт когнитивный каркас, Belbin добавляет поведенческую роль, learning typology закрывает способ мышления, USK и color дают организационный и темпераментный контекст.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B05",
    "Название bundle": "Обучаемость + адаптивность + лидерство изменений",
    "Компетенции": "Обучаемость / learning agility, Адаптивность / гибкость, Лидерство изменений",
    "Рекомендуемые тесты": "Типология обучения, 16PF, Ситуативное руководство, Тайм-менеджмент, Мотивационные карты, Belbin",
    "Логика маршрута": "Здесь важны не только openness to change, но и готовность реально перестраивать ритм, роль и стиль воздействия.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B06",
    "Название bundle": "Планирование + самоорганизация + ownership",
    "Компетенции": "Планирование и приоритизация, Самоорганизация и дисциплина, Ответственность / ownership",
    "Рекомендуемые тесты": "УСК, 16PF, Тайм-менеджмент, Belbin, Мотивационные карты",
    "Логика маршрута": "Ownership без УСК и 16PF легко перепутать с декларируемой ответственностью; time-management нужен как фактический организационный слой.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B07",
    "Название bundle": "Командное взаимодействие + координация + коучинг",
    "Компетенции": "Командное взаимодействие, Координация и организация других, Коучинг / развитие других",
    "Рекомендуемые тесты": "Belbin, ЭМИН, Ситуативное руководство, 16PF, Переговорный стиль, Тайм-менеджмент",
    "Логика маршрута": "Belbin+EMIN объясняют взаимодействие, situational показывает развивающий стиль, negotiation проверяет способ обращения с напряжением, time-management помогает увидеть управленческую собранность.",
    "Результат прогона": "",
    "Комментарий QA": ""
  },
  {
    "Bundle ID": "B08",
    "Название bundle": "Ориентация на результат + качество + практическое применение",
    "Компетенции": "Практическое применение знаний, Ориентация на результат, Ориентация на качество",
    "Рекомендуемые тесты": "16PF, Belbin, Тайм-менеджмент, Типология обучения, Мотивационные карты",
    "Логика маршрута": "Здесь нужно соединить качество мышления, доведение до результата и мотивационную подложку, иначе можно перепутать аккуратность, скорость и реальную исполнительность.",
    "Результат прогона": "",
    "Комментарий QA": ""
  }
]
```

## 6. Источники интерпретации тестов
### Live `test_interpretations` в Supabase
```json
[
  "color-types",
  "motivation-cards",
  "negotiation-style"
]
```

### Кодовые fallback-источники
- `lib/defaultTestInterpretations.ts`
- `lib/colorTypesInterpretation.ts`
- `lib/herzbergInterpretation.ts`
- `lib/pf16InterpretationKeys.ts`

### Как тестовые материалы подмешиваются в summary
```ts
function buildPromptDrivenTestNarratives(
  project: ProjectLike,
  attempts: AttemptLike[],
  interpretationKeysBySlug: Record<string, any>
): TestNarrative[] {
  return attempts.map((attempt) => {
    const title = attempt.test_title || attempt.test_slug;
    const keys = interpretationKeysBySlug[attempt.test_slug] ?? DEFAULT_TEST_INTERPRETATIONS[attempt.test_slug] ?? null;
    return {
      slug: attempt.test_slug,
      title,
      body: [
        "Короткие показатели:",
        formatTopRows(attempt.result),
        "",
        "Опорные материалы интерпретации теста:",
        buildPromptMaterialBrief(keys),
      ].join("\n"),
    };
  });
}
```

## 7. Как живая база prompts подмешивается в runtime
```ts
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function normalizeRow(input: Partial<CompetencyPromptRow> & { competency_id: string }): CompetencyPromptRow {
  const route = getCompetencyRouteOrNull(input.competency_id);
  const fallback = buildDefaultCompetencyPromptRows().find((item) => item.competency_id === input.competency_id) || null;
  return {
    competency_id: input.competency_id,
    competency_name: normalizePromptText(input.competency_name) || route?.name || fallback?.competency_name || input.competency_id,
    competency_cluster: normalizePromptText(input.competency_cluster) || route?.cluster || fallback?.competency_cluster || "Компетенции",
    system_prompt: normalizePromptText(input.system_prompt) || fallback?.system_prompt || "",
    prompt_template: normalizePromptText(input.prompt_template) || fallback?.prompt_template || "",
    notes: normalizePracticalExperience(input.notes) || fallback?.notes || null,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : fallback?.sort_order || 999,
    is_active: input.is_active !== false,
  };
}

function sortRows(rows: CompetencyPromptRow[]) {
  return [...rows].sort((a, b) => {
    const delta = a.sort_order - b.sort_order;
    if (delta !== 0) return delta;
    return a.competency_id.localeCompare(b.competency_id, "ru");
  });
}

export async function listCompetencyPromptRows() {
  const defaults = buildDefaultCompetencyPromptRows();
  const supabase = getAdminClient();
  if (!supabase) {
    return { rows: defaults, source: "fallback" as const, tableReady: false };
  }

  const { data, error } = await supabase
    .from("commercial_competency_prompts")
    .select("competency_id, competency_name, competency_cluster, system_prompt, prompt_template, notes, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("competency_id", { ascending: true });

  if (error) {
    return { rows: defaults, source: "error" as const, tableReady: false, error: error.message };
  }

  const byId = new Map(defaults.map((item) => [item.competency_id, item]));
  for (const raw of (data || []) as Array<any>) {
    byId.set(String(raw.competency_id), normalizeRow(raw));
  }

  return { rows: sortRows(Array.from(byId.values())), source: "db" as const, tableReady: true };
}

export async function loadCompetencyPromptMap(ids?: readonly string[] | null) {
  const defaults = buildDefaultCompetencyPromptRows();
  const filteredDefaults = ids?.length ? defaults.filter((item) => ids.includes(item.competency_id)) : defaults;
  const supabase = getAdminClient();
  if (!supabase) {
    return Object.fromEntries(filteredDefaults.map((item) => [item.competency_id, item]));
  }

  let query = supabase
    .from("commercial_competency_prompts")
    .select("competency_id, competency_name, competency_cluster, system_prompt, prompt_template, notes, sort_order, is_active")
    ;

  if (ids?.length) query = query.in("competency_id", [...ids]);

  const { data, error } = await query;
  if (error) {
    return Object.fromEntries(filteredDefaults.map((item) => [item.competency_id, item]));
  }

  const map = new Map(filteredDefaults.map((item) => [item.competency_id, item]));
  for (const raw of (data || []) as Array<any>) {
    const row = normalizeRow(raw);
    map.set(row.competency_id, row);
  }
  return Object.fromEntries(Array.from(map.entries()));
}

export async function upsertCompetencyPromptRow(input: Partial<CompetencyPromptRow> & { competency_id: string; updated_by?: string | null }) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error("Server env missing for competency prompt storage");
  const payload = {
    ...normalizeRow(input),
    updated_by: input.updated_by || null,
  };
  const { error } = await supabase.from("commercial_competency_prompts").upsert(payload, { onConflict: "competency_id" });
  if (error) throw error;
  return payload;
}
```
