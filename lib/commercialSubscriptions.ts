export type MonthlyPlanKey = "monthly_30" | "monthly_50" | "monthly_100";

export type MonthlyPlanDefinition = {
  key: MonthlyPlanKey;
  title: string;
  shortTitle: string;
  monthlyPriceRub: number;
  projectsLimit: number;
  effectiveProjectPriceRub: number;
  durationDays: number;
  description: string;
};

export const MONTHLY_SUBSCRIPTION_PLANS: MonthlyPlanDefinition[] = [
  {
    key: "monthly_30",
    title: "30 проектов в месяц",
    shortTitle: "30 / месяц",
    monthlyPriceRub: 13_500,
    projectsLimit: 30,
    effectiveProjectPriceRub: 450,
    durationDays: 30,
    description: "Полное открытие оценки для 30 проектов в течение 30 дней.",
  },
  {
    key: "monthly_50",
    title: "50 проектов в месяц",
    shortTitle: "50 / месяц",
    monthlyPriceRub: 18_000,
    projectsLimit: 50,
    effectiveProjectPriceRub: 360,
    durationDays: 30,
    description: "Полное открытие оценки для 50 проектов в течение 30 дней.",
  },
  {
    key: "monthly_100",
    title: "100 проектов в месяц",
    shortTitle: "100 / месяц",
    monthlyPriceRub: 30_000,
    projectsLimit: 100,
    effectiveProjectPriceRub: 300,
    durationDays: 30,
    description: "Полное открытие оценки для 100 проектов в течение 30 дней.",
  },
];

export type WorkspaceSubscriptionStatus = {
  id: string;
  plan_key: MonthlyPlanKey;
  plan_title: string;
  price_kopeks: number;
  projects_limit: number;
  projects_used: number;
  projects_remaining: number;
  status: string;
  started_at: string;
  activated_at: string | null;
  expires_at: string;
  covered_project_ids?: string[];
};

export function isMonthlyPlanKey(value: unknown): value is MonthlyPlanKey {
  return value === "monthly_30" || value === "monthly_50" || value === "monthly_100";
}

export function getMonthlyPlanDefinition(value: MonthlyPlanKey | string | null | undefined) {
  return MONTHLY_SUBSCRIPTION_PLANS.find((item) => item.key === value) || null;
}

export function formatMonthlySubscriptionPeriod(expiresAt: string | null | undefined) {
  if (!expiresAt) return "";
  try {
    return new Date(expiresAt).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
