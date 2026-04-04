import type { AssessmentGoal } from "@/lib/commercialGoals";
import { getCompetenciesForGoal, getCompetencyRoute } from "@/lib/competencyRouter";

export type FitWeightMap = Record<string, number>;

export type FitRoleProfile = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string[];
  weights: FitWeightMap;
  critical: string[];
};

export type FitExpectationTag = {
  id: string;
  label: string;
  keywords: string[];
  weights: FitWeightMap;
  critical?: string[];
};

export const FIT_ROLE_PROFILES: FitRoleProfile[] = [
  {
    id: "sales_manager",
    label: "Руководитель отдела продаж",
    shortLabel: "РОП",
    description: "Нужны влияние, переговоры, ориентация на результат, устойчивость к напряжению и способность вести людей.",
    keywords: ["руководитель отдела продаж", "роп", "sales manager", "head of sales", "директор по продаж", "руководитель продаж"],
    weights: { C19: 5, C31: 5, C24: 4, C17: 4, C09: 4, C25: 4, C23: 3, C11: 3, C28: 3 },
    critical: ["C19", "C31", "C09"]
  },
  {
    id: "sales_specialist",
    label: "Менеджер по продажам / BDM",
    shortLabel: "Продажи / BDM",
    description: "Ключевы переговоры, убеждение, контактность, клиентский фокус и настойчивость.",
    keywords: ["менеджер по продаж", "sales", "bdm", "бизнес-девелоп", "аккаунт-менеджер", "account manager"],
    weights: { C19: 5, C31: 5, C24: 4, C17: 4, C09: 4, C21: 3, C23: 3, C11: 3 },
    critical: ["C19", "C31", "C24"]
  },
  {
    id: "team_lead",
    label: "Team Lead / руководитель команды",
    shortLabel: "Team Lead",
    description: "Нужны лидерский потенциал, ситуативное управление, координация людей и саморегуляция.",
    keywords: ["team lead", "тимлид", "руководитель команды", "лид команды", "руководитель группы"],
    weights: { C25: 5, C26: 4, C28: 4, C22: 4, C30: 4, C27: 3, C13: 3, C11: 3, C10: 3 },
    critical: ["C25", "C22", "C28"]
  },
  {
    id: "project_manager",
    label: "Project Manager / руководитель проектов",
    shortLabel: "Project Manager",
    description: "Фокус на планировании, ответственности, координации, коммуникации и удержании качества под давлением.",
    keywords: ["project manager", "pm", "руководитель проекта", "менеджер проекта", "project lead"],
    weights: { C07: 5, C08: 4, C10: 4, C28: 4, C17: 4, C23: 3, C24: 3, C14: 3, C16: 3 },
    critical: ["C07", "C10", "C28"]
  },
  {
    id: "analyst",
    label: "Аналитик / исследователь",
    shortLabel: "Аналитик",
    description: "Ключевы аналитика, системность, критическое суждение, качество и дисциплина.",
    keywords: ["аналитик", "analysis", "research", "исследователь", "data analyst", "business analyst", "продуктовый аналитик"],
    weights: { C01: 5, C02: 5, C03: 4, C16: 4, C08: 3, C07: 3, C10: 3, C15: 2 },
    critical: ["C01", "C02", "C03"]
  },
  {
    id: "hr_recruiter",
    label: "HR / рекрутер / оценщик",
    shortLabel: "HR / рекрутинг",
    description: "Нужны коммуникация, эмпатия, дипломатичность, переговорность и понимание людей.",
    keywords: ["hr", "рекрутер", "рекрутинг", "оценщик", "сорсер", "подбор персонала", "талент", "talent acquisition"],
    weights: { C17: 5, C18: 5, C20: 4, C31: 4, C24: 3, C21: 3, C11: 2, C23: 2 },
    critical: ["C17", "C18", "C20"]
  },
  {
    id: "customer_success",
    label: "Customer Success / клиентский менеджер",
    shortLabel: "Customer Success",
    description: "Фокус на клиентской ориентации, отношениях, дипломатичности и спокойной работе с напряжением.",
    keywords: ["customer success", "клиентский менеджер", "сервис", "support", "аккаунтинг", "customer support", "customer care"],
    weights: { C24: 5, C18: 4, C20: 4, C17: 4, C23: 3, C31: 3, C11: 3, C08: 2 },
    critical: ["C24", "C17", "C20"]
  },
  {
    id: "operations_manager",
    label: "Операционный менеджер / администратор",
    shortLabel: "Операции",
    description: "Нужны системность, самоорганизация, ответственность, качество и устойчивость к нагрузке.",
    keywords: ["операционный", "operations", "администратор", "координатор", "office manager", "back office"],
    weights: { C07: 4, C08: 5, C10: 4, C16: 4, C28: 3, C11: 3, C14: 2, C09: 2 },
    critical: ["C08", "C10", "C16"]
  },
  {
    id: "product_manager",
    label: "Product Manager / продуктовая роль",
    shortLabel: "Product",
    description: "Ключевы аналитика, системность, коммуникация, влияние, клиентский фокус и адаптивность.",
    keywords: ["product manager", "продукт", "product owner", "продакт", "owner"],
    weights: { C01: 4, C02: 4, C03: 4, C17: 4, C19: 4, C24: 4, C14: 3, C29: 3, C04: 3 },
    critical: ["C01", "C17", "C24"]
  },
  {
    id: "entrepreneur",
    label: "Предприниматель / собственник",
    shortLabel: "Предприниматель",
    description: "Нужны автономность, результат, ownership, влияние, лидерство изменений и договороспособность.",
    keywords: ["предприниматель", "собственник", "founder", "основатель", "бизнесмен", "ceo"],
    weights: { C15: 5, C10: 5, C09: 4, C19: 4, C25: 4, C29: 4, C31: 3, C11: 3, C24: 2 },
    critical: ["C15", "C10", "C09"]
  }
];

export const FIT_EXPECTATION_TAGS: FitExpectationTag[] = [
  { id: "autonomy", label: "Самостоятельность", keywords: ["самостоятель", "автоном", "без микроменеджмента", "сам организует", "инициатив"], weights: { C15: 5, C10: 4, C08: 4, C09: 3 }, critical: ["C15", "C10"] },
  { id: "leadership", label: "Лидерство", keywords: ["лидер", "вести людей", "вести команду", "руководить", "управленчес"], weights: { C25: 5, C26: 4, C28: 4, C30: 3 }, critical: ["C25"] },
  { id: "influence", label: "Влияние и убеждение", keywords: ["влияни", "убеждени", "продажи", "продавать", "закрывать", "переговар"], weights: { C19: 5, C31: 5, C17: 3, C24: 3 }, critical: ["C19", "C31"] },
  { id: "stress", label: "Стрессоустойчивость", keywords: ["стресс", "напряж", "давлен", "срыв", "кризис"], weights: { C11: 5, C13: 4, C23: 3 }, critical: ["C11"] },
  { id: "analytics", label: "Аналитика", keywords: ["аналит", "системн", "критическ", "данные", "модел"], weights: { C01: 5, C02: 5, C03: 4 }, critical: ["C01", "C02"] },
  { id: "organization", label: "Организация", keywords: ["организац", "планиров", "приорит", "срок", "дисциплин"], weights: { C07: 5, C08: 4, C28: 4, C16: 3 }, critical: ["C07", "C08"] },
  { id: "teamwork", label: "Командное взаимодействие", keywords: ["команд", "взаимодейств", "сотруднич", "коллаборац"], weights: { C22: 5, C18: 4, C17: 4 }, critical: ["C22"] },
  { id: "client", label: "Клиентская ориентация", keywords: ["клиент", "партнер", "сервис", "customer", "отношения"], weights: { C24: 5, C18: 4, C20: 4, C17: 3 }, critical: ["C24"] },
  { id: "negotiation", label: "Переговоры", keywords: ["переговор", "договар", "согласован", "компромисс"], weights: { C31: 5, C19: 4, C20: 4, C23: 3 }, critical: ["C31"] },
  { id: "learning", label: "Обучаемость", keywords: ["обучаем", "учиться", "learning", "быстро осва", "развити"], weights: { C05: 5, C14: 4, C06: 3 }, critical: ["C05"] },
  { id: "change", label: "Изменения", keywords: ["изменени", "трансформац", "неопредел", "гибк", "адаптив"], weights: { C29: 5, C14: 4, C25: 3 }, critical: ["C14"] },
  { id: "responsibility", label: "Ответственность", keywords: ["ответствен", "ownership", "доводить", "надежност"], weights: { C10: 5, C09: 4, C08: 4 }, critical: ["C10"] },
  { id: "quality", label: "Качество", keywords: ["качество", "внимательн", "без ошибок", "точность"], weights: { C16: 5, C03: 4, C07: 3 }, critical: ["C16"] },
  { id: "empathy", label: "Эмпатия и понимание людей", keywords: ["эмпат", "понимание людей", "чувства", "слышать людей"], weights: { C18: 5, C12: 4, C20: 3 }, critical: ["C18"] },
  { id: "conflict", label: "Управление конфликтом", keywords: ["конфликт", "сложные разговоры", "напряженные переговоры", "острые ситуации"], weights: { C23: 5, C20: 4, C13: 3 }, critical: ["C23"] },
];

export type ResolvedFitMatrix = {
  label: string;
  weights: FitWeightMap;
  critical: string[];
  matchedProfiles: FitRoleProfile[];
  matchedExpectations: FitExpectationTag[];
  explanation: string[];
};

function normalizeText(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/ё/g, "е");
}

function mergeWeights(target: FitWeightMap, source: FitWeightMap, multiplier = 1) {
  for (const [id, weight] of Object.entries(source)) {
    target[id] = Math.max(target[id] || 0, Math.round(weight * multiplier));
  }
  return target;
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchesKeywords(text: string, keywords: readonly string[]) {
  return keywords.reduce((count, keyword) => (text.includes(keyword) ? count + 1 : count), 0);
}

export function getFitRoleProfiles() {
  return FIT_ROLE_PROFILES;
}

export function getFitProfileById(id: string | null | undefined) {
  if (!id) return null;
  return FIT_ROLE_PROFILES.find((item) => item.id === id) || null;
}

export function resolveFitMatrixFromConfig(
  args: {
    goal: AssessmentGoal;
    fitProfileId?: string | null;
    fitRequest?: string | null;
    targetRole?: string | null;
  },
  roleProfiles: readonly FitRoleProfile[],
  expectationTags: readonly FitExpectationTag[]
): ResolvedFitMatrix {
  const requestText = normalizeText(`${args.targetRole || ""}
${args.fitRequest || ""}`);
  const explicitProfile = args.fitProfileId ? roleProfiles.find((item) => item.id === args.fitProfileId) || null : null;

  const matchedProfiles = explicitProfile
    ? [explicitProfile]
    : roleProfiles
        .map((profile) => ({ profile, hits: matchesKeywords(requestText, profile.keywords) }))
        .filter((item) => item.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 2)
        .map((item) => item.profile);

  const matchedExpectations = expectationTags
    .map((tag) => ({ tag, hits: matchesKeywords(requestText, tag.keywords) }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 6)
    .map((item) => item.tag);

  const weights: FitWeightMap = {};
  const critical = new Set<string>();
  const explanation: string[] = [];

  for (const profile of matchedProfiles) {
    mergeWeights(weights, profile.weights, 1);
    for (const id of profile.critical) critical.add(id);
    explanation.push(`Роль: ${profile.label}.`);
  }

  for (const tag of matchedExpectations) {
    mergeWeights(weights, tag.weights, matchedProfiles.length ? 1 : 0.9);
    for (const id of tag.critical || []) critical.add(id);
    explanation.push(`Ожидание: ${tag.label}.`);
  }

  if (!Object.keys(weights).length) {
    const fallback = getCompetenciesForGoal(args.goal).slice(0, 6);
    for (const item of fallback) {
      weights[item.id] = 3;
      critical.add(item.id);
    }
    explanation.push(`Явный профиль не распознан, взят стандартный контур цели «${args.goal}».`);
  }

  const label = matchedProfiles.length
    ? matchedProfiles.map((item) => item.shortLabel).join(" + ")
    : matchedExpectations.length
    ? matchedExpectations.map((item) => item.label).slice(0, 3).join(" + ")
    : "Контур цели";

  return {
    label,
    weights,
    critical: uniqueStrings(Array.from(critical)),
    matchedProfiles,
    matchedExpectations,
    explanation,
  };
}

export function resolveFitMatrix(args: {
  goal: AssessmentGoal;
  fitProfileId?: string | null;
  fitRequest?: string | null;
  targetRole?: string | null;
}): ResolvedFitMatrix {
  return resolveFitMatrixFromConfig(args, FIT_ROLE_PROFILES, FIT_EXPECTATION_TAGS);
}

export function getWeightedCompetencyLabels(weights: FitWeightMap) {
  return Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, weight]) => ({ id, weight, name: getCompetencyRoute(id)?.name || id }));
}
