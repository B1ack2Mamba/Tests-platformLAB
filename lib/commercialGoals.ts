export const ASSESSMENT_GOAL_KEYS = [
  "role_fit",
  "general_assessment",
  "motivation",
  "management_potential",
  "team_interaction",
  "leadership",
  "self_organization",
  "learning_agility",
  "emotional_regulation",
  "communication_influence",
] as const;

export type AssessmentGoal = (typeof ASSESSMENT_GOAL_KEYS)[number];
export type EvaluationPackage = "basic" | "premium" | "premium_ai_plus";

type GoalTestWeights = Partial<Record<string, number>>;

export type GoalDefinition = {
  key: AssessmentGoal;
  title: string;
  shortTitle: string;
  description: string;
  outcomes: string[];
  recommended: string[];
};

const TEST_PRIORITY_FALLBACK = [
  "16pf-a",
  "belbin",
  "emin",
  "usk",
  "situational-guidance",
  "motivation-cards",
  "time-management",
  "learning-typology",
  "negotiation-style",
  "color-types",
  "16pf-b",
] as const;

const GOAL_TEST_WEIGHTS: Record<AssessmentGoal, GoalTestWeights> = {
  role_fit: {
    "16pf-a": 10,
    belbin: 5,
    usk: 10,
    emin: 6,
    "situational-guidance": 10,
    "negotiation-style": 10,
    "motivation-cards": 10,
    "time-management": 8,
    "color-types": 10,
    "learning-typology": 3,
    "16pf-b": 10,
  },
  general_assessment: {
    "16pf-a": 10,
    usk: 9,
    emin: 8,
    belbin: 7,
    "motivation-cards": 6,
    "time-management": 6,
    "learning-typology": 5,
    "color-types": 6,
    "situational-guidance": 5,
    "negotiation-style": 6,
    "16pf-b": 2,
  },
  motivation: {
    "motivation-cards": 10,
    usk: 8,
    emin: 7,
    "16pf-a": 6,
    "time-management": 5,
    "color-types": 6,
    "learning-typology": 4,
    belbin: 3,
    "situational-guidance": 3,
    "16pf-b": 2,
  },
  management_potential: {
    "situational-guidance": 10,
    "16pf-a": 8,
    emin: 8,
    belbin: 7,
    usk: 7,
    "negotiation-style": 8,
    "time-management": 6,
    "motivation-cards": 6,
    "color-types": 6,
    "learning-typology": 3,
    "16pf-b": 2,
  },
  team_interaction: {
    belbin: 10,
    emin: 8,
    "16pf-a": 7,
    usk: 6,
    "color-types": 6,
    "situational-guidance": 5,
    "negotiation-style": 8,
    "motivation-cards": 6,
    "learning-typology": 3,
    "time-management": 3,
    "16pf-b": 2,
  },
  leadership: {
    "situational-guidance": 10,
    "16pf-a": 8,
    belbin: 8,
    emin: 7,
    "negotiation-style": 8,
    usk: 6,
    "color-types": 6,
    "motivation-cards": 6,
    "time-management": 4,
    "learning-typology": 3,
    "16pf-b": 2,
  },
  self_organization: {
    "time-management": 10,
    usk: 9,
    "16pf-a": 7,
    emin: 5,
    "motivation-cards": 5,
    "learning-typology": 4,
    "situational-guidance": 4,
    belbin: 3,
    "color-types": 6,
    "16pf-b": 2,
  },
  learning_agility: {
    "learning-typology": 10,
    "16pf-a": 7,
    "time-management": 6,
    "motivation-cards": 6,
    usk: 5,
    emin: 5,
    "color-types": 6,
    belbin: 3,
    "situational-guidance": 3,
    "16pf-b": 2,
  },
  emotional_regulation: {
    emin: 10,
    usk: 8,
    "16pf-a": 7,
    "motivation-cards": 6,
    "time-management": 5,
    "color-types": 4,
    belbin: 3,
    "situational-guidance": 3,
    "learning-typology": 3,
    "negotiation-style": 4,
    "16pf-b": 2,
  },
  communication_influence: {
    emin: 9,
    "16pf-a": 8,
    "negotiation-style": 10,
    belbin: 7,
    "situational-guidance": 6,
    "color-types": 6,
    usk: 5,
    "motivation-cards": 4,
    "learning-typology": 3,
    "time-management": 3,
    "16pf-b": 2,
  },
};

const GOAL_RECOMMENDED_OVERRIDES: Partial<Record<AssessmentGoal, string[]>> = {
  role_fit: ["16pf-a", "belbin", "usk", "emin", "situational-guidance", "negotiation-style", "motivation-cards", "time-management", "color-types", "16pf-b"],
  general_assessment: ["16pf-a", "usk", "motivation-cards", "color-types", "negotiation-style"],
  motivation: ["motivation-cards", "usk", "color-types"],
  management_potential: [
    "situational-guidance",
    "16pf-a",
    "usk",
    "time-management",
    "motivation-cards",
    "color-types",
    "negotiation-style",
  ],
  team_interaction: ["belbin", "emin", "usk", "color-types", "motivation-cards"],
  leadership: ["situational-guidance", "16pf-a", "usk", "color-types", "motivation-cards", "negotiation-style"],
  self_organization: ["time-management", "usk", "16pf-a", "color-types"],
  learning_agility: ["learning-typology", "motivation-cards", "color-types"],
  emotional_regulation: ["emin", "usk", "16pf-a", "motivation-cards"],
  communication_influence: ["emin", "16pf-a", "color-types", "negotiation-style"],
};

function scoreGoalTest(goal: AssessmentGoal, slug: string) {
  return GOAL_TEST_WEIGHTS[goal]?.[slug] ?? 0;
}

function sortSlugsByGoal(goal: AssessmentGoal, slugs: string[]) {
  const fallbackOrder = new Map(TEST_PRIORITY_FALLBACK.map((slug, index) => [slug, index]));
  return [...new Set(slugs)]
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDelta = scoreGoalTest(goal, b) - scoreGoalTest(goal, a);
      if (scoreDelta !== 0) return scoreDelta;
      const fallbackDelta = (fallbackOrder.get(a as any) ?? 999) - (fallbackOrder.get(b as any) ?? 999);
      if (fallbackDelta !== 0) return fallbackDelta;
      return a.localeCompare(b, "ru");
    });
}

function defaultScoredSlugs(goal: AssessmentGoal) {
  return sortSlugsByGoal(goal, Object.keys(GOAL_TEST_WEIGHTS[goal] || {})).filter((slug) => scoreGoalTest(goal, slug) > 0);
}

export function isAssessmentGoal(value: unknown): value is AssessmentGoal {
  return typeof value === "string" && (ASSESSMENT_GOAL_KEYS as readonly string[]).includes(value);
}

export function getGoalRecommendedTests(goal: AssessmentGoal, availableSlugs?: string[]) {
  const availableSet = availableSlugs?.length ? new Set(availableSlugs) : null;
  const override = GOAL_RECOMMENDED_OVERRIDES[goal];
  if (override?.length) {
    return override.filter((slug) => scoreGoalTest(goal, slug) > 0 && (!availableSet || availableSet.has(slug)));
  }
  const basis = availableSlugs?.length ? availableSlugs : defaultScoredSlugs(goal);
  return sortSlugsByGoal(goal, basis).filter((slug) => scoreGoalTest(goal, slug) >= 6).slice(0, 5);
}

export function getGoalAdditionalTests(goal: AssessmentGoal, availableSlugs?: string[]) {
  const basis = availableSlugs?.length ? availableSlugs : defaultScoredSlugs(goal);
  const recommended = new Set(getGoalRecommendedTests(goal, availableSlugs));
  return sortSlugsByGoal(goal, basis).filter((slug) => !recommended.has(slug) && scoreGoalTest(goal, slug) > 0);
}

export function getGoalWeight(goal: AssessmentGoal, slug: string) {
  return scoreGoalTest(goal, slug);
}

export const COMMERCIAL_GOALS: GoalDefinition[] = [
  {
    key: "role_fit",
    title: "Подбор на должность и оценка соответствия роли",
    shortTitle: "Подбор на должность",
    description: "Собрать профиль под конкретную роль, увидеть риски назначения и понять, какие задачи человеку подходят лучше всего.",
    outcomes: [
      "соответствие роли и контексту работы",
      "сильные стороны и риски назначения",
      "рекомендации руководителю по адаптации",
    ],
    recommended: getGoalRecommendedTests("role_fit"),
  },
  {
    key: "general_assessment",
    title: "Общая оценка личности и рабочего профиля",
    shortTitle: "Общая оценка",
    description: "Получить цельный срез по стилю поведения, устойчивости, взаимодействию и общей рабочей собранности сотрудника.",
    outcomes: [
      "рабочий профиль сотрудника",
      "поведение под нагрузкой",
      "сильные и слабые стороны в повседневной работе",
    ],
    recommended: getGoalRecommendedTests("general_assessment"),
  },
  {
    key: "motivation",
    title: "Мотивация и вовлечённость",
    shortTitle: "Мотивация",
    description: "Понять, что реально двигает человеком, что его демотивирует и как удерживать включённость без лишнего давления.",
    outcomes: [
      "ведущие мотиваторы",
      "демотиваторы и риск выгорания",
      "управленческие рекомендации по удержанию",
    ],
    recommended: getGoalRecommendedTests("motivation"),
  },
  {
    key: "management_potential",
    title: "Управленческий потенциал",
    shortTitle: "Управленческий потенциал",
    description: "Проверить, насколько человек готов брать на себя координацию, управленческие решения и ответственность за других.",
    outcomes: [
      "готовность к управленческой роли",
      "сильные и слабые стороны как руководителя",
      "точки роста перед повышением",
    ],
    recommended: getGoalRecommendedTests("management_potential"),
  },
  {
    key: "team_interaction",
    title: "Командное взаимодействие",
    shortTitle: "Командная роль",
    description: "Понять, как человек встраивается в команду, где усиливает группу, а где может создавать трение.",
    outcomes: [
      "командная роль и стиль взаимодействия",
      "риск конфликтов и перекосов",
      "рекомендации по составу команды",
    ],
    recommended: getGoalRecommendedTests("team_interaction"),
  },
  {
    key: "leadership",
    title: "Лидерство и влияние",
    shortTitle: "Лидерство",
    description: "Проверить лидерский стиль, способность вести людей за собой и степень влияния в рабочих ситуациях.",
    outcomes: [
      "лидерский стиль",
      "способ влияния на команду",
      "риск давления, хаоса или пассивности",
    ],
    recommended: getGoalRecommendedTests("leadership"),
  },
  {
    key: "self_organization",
    title: "Самоорганизация и тайм-менеджмент",
    shortTitle: "Самоорганизация",
    description: "Оценить, насколько человек умеет держать ритм, управлять временем, доводить задачи и сохранять собранность.",
    outcomes: [
      "стиль управления временем",
      "уровень самоконтроля и дисциплины",
      "риски срыва сроков и перегруза",
    ],
    recommended: getGoalRecommendedTests("self_organization"),
  },
  {
    key: "learning_agility",
    title: "Обучаемость и стиль освоения",
    shortTitle: "Обучаемость",
    description: "Понять, как человек учится, как быстрее осваивает новое и какой формат развития для него реально рабочий.",
    outcomes: [
      "преобладающий стиль обучения",
      "скорость включения в новое",
      "рекомендации по обучению и адаптации",
    ],
    recommended: getGoalRecommendedTests("learning_agility"),
  },
  {
    key: "emotional_regulation",
    title: "Эмоциональная устойчивость и регуляция",
    shortTitle: "Эмоциональная устойчивость",
    description: "Проверить, как человек держит себя под давлением, насколько умеет регулировать эмоции и сохранять рабочий тонус.",
    outcomes: [
      "устойчивость к напряжению",
      "саморегуляция в стрессе",
      "риски эмоционального срыва или накопления напряжения",
    ],
    recommended: getGoalRecommendedTests("emotional_regulation"),
  },
  {
    key: "communication_influence",
    title: "Коммуникация и влияние",
    shortTitle: "Коммуникация",
    description: "Оценить, как человек выстраивает контакт, передаёт смысл, убеждает и влияет на собеседника в рабочих задачах.",
    outcomes: [
      "стиль коммуникации",
      "качество контакта и влияния",
      "риски недопонимания и перегибов во взаимодействии",
    ],
    recommended: getGoalRecommendedTests("communication_influence"),
  },
];

export const EVALUATION_PACKAGES: Array<{
  key: EvaluationPackage;
  title: string;
  shortTitle: string;
  note?: string;
  description: string;
  bullets: string[];
  helpText?: string;
  priceRub: number;
}> = [
  {
    key: "basic",
    title: "База",
    shortTitle: "База",
    note: "для профессионалов",
    description: "Итоговые результаты тестов.",
    bullets: ["итоговые результаты тестов"],
    priceRub: 500,
  },
  {
    key: "premium",
    title: "Премиум",
    shortTitle: "Премиум",
    note: "для специалистов",
    description: "Результаты тестов + индивидуальная интерпретация результатов каждого теста.",
    bullets: ["результаты тестов", "индивидуальная интерпретация каждого теста"],
    helpText:
      "Нейросеть не принимает кадровых решений и не определяет судьбу человека. Здесь она используется как сложный аналитический инструмент: обрабатывает большие сочетания результатов через алгоритмические матрицы и промпты, составленные Еленой Ждановой на основе более чем 25 лет практики.",
    priceRub: 1500,
  },
  {
    key: "premium_ai_plus",
    title: "Премиум AI+",
    shortTitle: "Премиум AI+",
    description: "Составление индивидуального профиля на основе всех пройденных тестов, индекс соответствия.",
    bullets: [
      "индивидуальный профиль по всем тестам",
      "индекс соответствия по выбранной цели",
      "рекомендации по развитию и руководителю",
    ],
    helpText:
      "Премиум AI+ не заменяет профессиональное решение специалиста. Он собирает интегральный профиль по всем пройденным тестам, рассчитывает индекс соответствия выбранной цели и формирует рекомендации как вспомогательный аналитический слой для более точного экспертного вывода.",
    priceRub: 3000,
  },
];

export function getGoalDefinition(goal: AssessmentGoal | string | null | undefined): GoalDefinition | null {
  return COMMERCIAL_GOALS.find((item) => item.key === goal) || null;
}

export function isEvaluationPackage(value: unknown): value is EvaluationPackage {
  return value === "basic" || value === "premium" || value === "premium_ai_plus";
}

export function getEvaluationPackageDefinition(value: EvaluationPackage | string | null | undefined) {
  return EVALUATION_PACKAGES.find((item) => item.key === value) || null;
}

export function getEvaluationPackageRank(value: EvaluationPackage | string | null | undefined): number {
  switch (value) {
    case "basic":
      return 1;
    case "premium":
      return 2;
    case "premium_ai_plus":
      return 3;
    default:
      return 0;
  }
}

export function isPackageAccessible(
  unlocked: EvaluationPackage | string | null | undefined,
  requested: EvaluationPackage | string | null | undefined
) {
  return getEvaluationPackageRank(unlocked) >= getEvaluationPackageRank(requested);
}

export function getEvaluationPackagePriceRub(value: EvaluationPackage | string | null | undefined) {
  return getEvaluationPackageDefinition(value)?.priceRub ?? 0;
}

export function getUpgradePriceRub(
  current: EvaluationPackage | string | null | undefined,
  target: EvaluationPackage | string | null | undefined
) {
  return Math.max(0, getEvaluationPackagePriceRub(target) - getEvaluationPackagePriceRub(current));
}
