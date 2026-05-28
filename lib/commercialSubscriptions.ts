export type MonthlyPlanKey = "monthly_30" | "monthly_50" | "monthly_100";

export type MonthlyPlanDefinition = {
  key: MonthlyPlanKey;
  title: string;
  shortTitle: string;
  monthlyPriceRub: number;
  oldMonthlyPriceRub: number;
  projectsLimit: number;
  effectiveProjectPriceRub: number;
  durationDays: number;
  description: string;
};

export const PROMO_PLAN_PRICES_HOLD_UNTIL = "2026-07-25T23:59:59+03:00";
export const CURRENT_PLAN_PRICES_HOLD_LABEL = "Текущие цены держатся автоматически до 25 июля 2026 г.";
export const STANDARD_PLAN_PRICES_LABEL = "Акционный период завершён. Действуют стандартные цены.";

export const MONTHLY_SUBSCRIPTION_PLANS: MonthlyPlanDefinition[] = [
  {
    key: "monthly_30",
    title: "15 проектов в месяц",
    shortTitle: "15 / месяц",
    monthlyPriceRub: 13_500,
    oldMonthlyPriceRub: 33_000,
    projectsLimit: 15,
    effectiveProjectPriceRub: 900,
    durationDays: 30,
    description: "Полное открытие оценки для 15 проектов в течение 30 дней.",
  },
  {
    key: "monthly_50",
    title: "25 проектов в месяц",
    shortTitle: "25 / месяц",
    monthlyPriceRub: 18_000,
    oldMonthlyPriceRub: 50_000,
    projectsLimit: 25,
    effectiveProjectPriceRub: 720,
    durationDays: 30,
    description: "Полное открытие оценки для 25 проектов в течение 30 дней.",
  },
  {
    key: "monthly_100",
    title: "50 проектов в месяц",
    shortTitle: "50 / месяц",
    monthlyPriceRub: 30_000,
    oldMonthlyPriceRub: 90_000,
    projectsLimit: 50,
    effectiveProjectPriceRub: 600,
    durationDays: 30,
    description: "Полное открытие оценки для 50 проектов в течение 30 дней.",
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

export function isMonthlyPlanPromoPriceActive(now: Date | number = new Date()) {
  const nowMs = typeof now === "number" ? now : now.getTime();
  return nowMs <= new Date(PROMO_PLAN_PRICES_HOLD_UNTIL).getTime();
}

export function getActiveMonthlyPlanPriceRub(plan: MonthlyPlanDefinition, now: Date | number = new Date()) {
  return isMonthlyPlanPromoPriceActive(now) ? plan.monthlyPriceRub : plan.oldMonthlyPriceRub;
}

export function getActiveMonthlyPlanEffectiveProjectPriceRub(plan: MonthlyPlanDefinition, now: Date | number = new Date()) {
  return Math.round(getActiveMonthlyPlanPriceRub(plan, now) / plan.projectsLimit);
}

export function getMonthlyPlanPriceHoldLabel(now: Date | number = new Date()) {
  return isMonthlyPlanPromoPriceActive(now) ? CURRENT_PLAN_PRICES_HOLD_LABEL : STANDARD_PLAN_PRICES_LABEL;
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
