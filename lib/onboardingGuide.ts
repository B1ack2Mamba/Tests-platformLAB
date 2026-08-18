export const ONBOARDING_GUIDE_POSES = {
  welcome: "/onboarding-specialist-guide.png",
  pointRight: "/onboarding-guide-point-right.png",
  pointLeft: "/onboarding-guide-point-left.png",
  present: "/onboarding-guide-present.png",
  results: "/onboarding-guide-results.png",
} as const;

export const PLATFORM_ONBOARDING_GUIDE = {
  imageSrc: ONBOARDING_GUIDE_POSES.welcome,
  imageAlt: "Помощник по работе с платформой",
  name: "Помощник платформы",
  welcomeTitle: "Помочь разобраться с платформой?",
  welcomeBody: "Я покажу папки, проекты, ссылки участника и раздел ИИ-аналитики. Короткая экскурсия займёт меньше минуты.",
} as const;
