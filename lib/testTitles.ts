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
