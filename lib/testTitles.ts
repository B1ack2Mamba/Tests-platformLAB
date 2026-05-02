export const TEST_TITLE_BY_SLUG: Record<string, string> = {
  "16pf-a": "16PF-A (опросник Кеттелла)",
  "16pf-b": "16PF-B (опросник Кеттелла)",
  belbin: "Опросник Белбина",
  emin: "Эмоциональный интеллект (ЭМИН)",
  usk: "Уровень субъективного контроля (УСК)",
  "color-types": "Цветотипы",
  "time-management": "Тайм-менеджмент",
  "learning-typology": "Типология личности обучения",
  "motivation-cards": "Мотивационные карты",
  "situational-guidance": "Ситуативное руководство",
  "negotiation-style": "Ваш переговорный стиль",
};

export const TEST_ESTIMATED_MINUTES_BY_SLUG: Record<string, number> = {
  "16pf-a": 35,
  "16pf-b": 35,
  belbin: 6,
  emin: 6,
  usk: 7,
  "color-types": 3,
  "time-management": 3,
  "learning-typology": 5,
  "motivation-cards": 7,
  "situational-guidance": 5,
  "negotiation-style": 5,
};

export function getTestDisplayTitle(slug: string, fallbackTitle?: string | null) {
  const normalizedSlug = String(slug || "").trim();
  const normalizedFallback = String(fallbackTitle || "").trim();

  if (TEST_TITLE_BY_SLUG[normalizedSlug]) return TEST_TITLE_BY_SLUG[normalizedSlug];

  if (
    normalizedFallback &&
    normalizedFallback.toLowerCase() !== normalizedSlug.toLowerCase()
  ) {
    return normalizedFallback;
  }

  return normalizedSlug;
}

export function getTestEstimatedMinutes(slug: string) {
  const normalizedSlug = String(slug || "").trim();
  return TEST_ESTIMATED_MINUTES_BY_SLUG[normalizedSlug] ?? null;
}

export function formatEstimatedMinutes(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "";
  return `${minutes} мин`;
}

export function getTotalEstimatedMinutes(slugs: string[]) {
  return slugs.reduce((sum, slug) => sum + (getTestEstimatedMinutes(slug) || 0), 0);
}
