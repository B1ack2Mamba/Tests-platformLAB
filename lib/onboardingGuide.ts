export const ONBOARDING_GUIDE_POSES = {
  welcome: "/onboarding-specialist-guide.png",
  pointRight: "/onboarding-guide-point-right.webp",
  pointLeft: "/onboarding-guide-point-left.webp",
  present: "/onboarding-guide-present.webp",
  results: "/onboarding-guide-results.webp",
} as const;

export const PLATFORM_ONBOARDING_GUIDE = {
  imageSrc: ONBOARDING_GUIDE_POSES.welcome,
  imageAlt: "Помощник по работе с платформой",
  name: "Помощник платформы",
  welcomeTitle: "Помочь разобраться с платформой?",
  welcomeBody: "Я покажу папки, проекты, ссылки участника и раздел ИИ-аналитики. Короткая экскурсия займёт меньше минуты.",
} as const;
