export type AssessmentGoal = "role_fit" | "general_assessment" | "motivation";
export type EvaluationPackage = "basic" | "premium" | "premium_ai_plus";

export type GoalDefinition = {
  key: AssessmentGoal;
  title: string;
  shortTitle: string;
  description: string;
  outcomes: string[];
  recommended: string[];
};

export const COMMERCIAL_GOALS: GoalDefinition[] = [
  {
    key: "role_fit",
    title: "Подбор должности и оценка соответствия роли",
    shortTitle: "Подбор на должность",
    description:
      "Понять, подходит ли человек на конкретную должность, или какая роль раскрывает его сильнее всего.",
    outcomes: [
      "соответствие должности",
      "сильные и слабые стороны для роли",
      "риски назначения и точки развития",
    ],
    recommended: ["16pf-a", "belbin", "usk", "emin", "situational-guidance"],
  },
  {
    key: "general_assessment",
    title: "Общая оценка сотрудника",
    shortTitle: "Общая оценка",
    description:
      "Получить цельный рабочий профиль сотрудника: стиль поведения, саморегуляция, взаимодействие, риски и потенциал.",
    outcomes: [
      "рабочий профиль сотрудника",
      "поведение под нагрузкой",
      "рекомендации руководителю и HR",
    ],
    recommended: ["16pf-a", "belbin", "emin", "usk", "time-management"],
  },
  {
    key: "motivation",
    title: "Мотивация сотрудника",
    shortTitle: "Мотивация",
    description:
      "Понять, что реально двигает человеком, что его демотивирует и как им управлять без потери вовлечённости.",
    outcomes: [
      "ведущие мотиваторы",
      "демотиваторы и риск выгорания",
      "управленческий ключ и рекомендации по удержанию",
    ],
    recommended: ["motivation-cards", "usk", "emin", "16pf-a"],
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
    title: "Премиум AI",
    shortTitle: "Премиум AI",
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

export function getGoalRecommendedTests(goal: AssessmentGoal): string[] {
  const definition = getGoalDefinition(goal);
  return definition ? [...definition.recommended] : [];
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
