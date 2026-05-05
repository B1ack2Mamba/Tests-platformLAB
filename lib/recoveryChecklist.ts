export type RecoveryChecklistItem = {
  title: string;
  symptoms: string;
  actions: string[];
};

export const RECOVERY_CHECKLIST: RecoveryChecklistItem[] = [
  {
    title: "Падает health или главная страница",
    symptoms: "status-screen красный по Health или public smoke не проходит на / и /api/health.",
    actions: [
      "Проверить текущую версию деплоя и request_id в /api/health.",
      "Сразу прогнать npm run status:prod локально и сверить, ломается ли только прод или весь контур.",
      "Если свежий релиз виноват, откатить alias на предыдущий стабильный deploy в Vercel.",
    ],
  },
  {
    title: "Не работает вход или кабинет",
    symptoms: "auth smoke падает на profile, dashboard-bootstrap или subscriptions-status.",
    actions: [
      "Проверить, жив ли Supabase auth и не истёк ли smoke-пользователь.",
      "Проверить env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY.",
      "Смотреть request_id проблемной ручки и разбирать серверный лог по нему.",
    ],
  },
  {
    title: "Не открываются проекты или результаты",
    symptoms: "auth smoke падает на project-get, results-map или evaluation-summary.",
    actions: [
      "Проверить, существует ли smoke project_id и не был ли он удалён вручную.",
      "Проверить /api/commercial/projects/get и /api/commercial/projects/results-map на том же bearer токене.",
      "Если ломается только evaluation, временно отключить AI-функцию в продажах и оставить базовый контур результатов.",
    ],
  },
  {
    title: "Проблема с unlock и пакетами оценки",
    symptoms: "unlock-access check красный или пользователи не могут открыть пакет результата.",
    actions: [
      "Сначала смотреть /api/commercial/projects/unlock-access: это safe-check без списания.",
      "Проверить, что проект завершён полностью и unlocked_package_mode не уже выше требуемого.",
      "Отдельно проверить кошелёк, подписку workspace и consume_commercial_workspace_subscription.",
    ],
  },
  {
    title: "AI-контур жив, но текст или логика выглядят странно",
    symptoms: "evaluation-summary отвечает 200, но отчёт слабый или противоречивый.",
    actions: [
      "Проверить registry_comment, unlocked_package_mode и results-map для проекта.",
      "Сверить live prompts в commercial_competency_prompts и test_interpretations.",
      "Если это методическая проблема, править rule-layer и prompts, а не сам продовый smoke.",
    ],
  },
];
