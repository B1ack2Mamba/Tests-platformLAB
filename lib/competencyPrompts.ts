import { COMPETENCY_ROUTES, getCompetencyRoutes, type CompetencyRoute } from "@/lib/competencyRouter";

export type CompetencyPromptRow = {
  competency_id: string;
  competency_name: string;
  competency_cluster: string;
  system_prompt: string;
  prompt_template: string;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
};

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
] as const;

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
    "Формат ответа:",
    "1. Вердикт по компетенции — 2–3 предложения.",
    "2. Что подтверждает компетенцию — 3–5 коротких буллетов.",
    "3. Что ограничивает / риски — 2–4 коротких буллета.",
    "4. Практический вывод для цели / роли / ожиданий — 2–3 коротких буллета.",
    "Пиши по-русски. Не используй markdown-решётки. Не выдумывай шкалы и не делай выводов без опоры на тесты.",
  ].join("\n");
}

export function buildDefaultCompetencyPromptRows(): CompetencyPromptRow[] {
  return COMPETENCY_ROUTES.map((route, index) => ({
    competency_id: route.id,
    competency_name: route.name,
    competency_cluster: route.cluster,
    system_prompt: DEFAULT_COMPETENCY_SYSTEM_PROMPT,
    prompt_template: getDefaultCompetencyPromptTemplate(route),
    notes: null,
    sort_order: index + 1,
    is_active: true,
  }));
}


const LEGACY_DEFAULT_NOTE_RE = /^Базовый AI-шаблон для компетенции/u;

export function normalizePracticalExperience(value: unknown) {
  const text = normalizePromptText(value);
  if (!text) return "";
  return LEGACY_DEFAULT_NOTE_RE.test(text) ? "" : text;
}

export function getDefaultCompetencyPromptRowById(id: string | null | undefined): CompetencyPromptRow | null {
  if (!id) return null;
  return buildDefaultCompetencyPromptRows().find((item) => item.competency_id === id) || null;
}

export function getCompetencyRouteOrNull(id: string | null | undefined) {
  if (!id) return null;
  return getCompetencyRoutes([id])[0] || null;
}

export function normalizePromptText(value: unknown) {
  return String(value || "").replace(/\r/g, "").trim();
}

export function renderPromptTemplate(template: string, variables: Record<string, string>) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}
