export type DashboardUpdateItem = {
  title: string;
  body: string;
};

export type DashboardUpdatesContent = {
  title: string;
  intro: string;
  items: DashboardUpdateItem[];
};

export const DASHBOARD_UPDATES_SETTING_KEY = "dashboard_release_updates";

export const DEFAULT_DASHBOARD_UPDATES: DashboardUpdatesContent = {
  title: "Что нового",
  intro: "Собрали последние улучшения сервиса простым языком.",
  items: [
    {
      title: "С телефона стало удобнее работать",
      body: "Главные действия на маленьком экране стали ближе, лишние элементы убраны с первого плана, а страницы проектов и результатов легче читать.",
    },
    {
      title: "Выбор компетенций в проекте стал чище",
      body: "Список больше не наползает на экран и не сливается с фоном. Выбранные компетенции теперь выглядят спокойнее и понятнее.",
    },
    {
      title: "Результаты проекта на телефоне стали шире",
      body: "Текст больше не зажимается в узкую колонку, поэтому отчёт проще читать без постоянного увеличения экрана.",
    },
    {
      title: "Вход стал устойчивее",
      body: "Если прямой вход не проходит из-за связи, сайт пробует запасной путь и показывает более понятную подсказку, что можно сделать.",
    },
    {
      title: "Добавлена помощь при сбоях связи",
      body: "При проблемах со входом из Москвы появляется отдельное сообщение с советом подождать, попробовать VPN и кнопкой для связи в Telegram.",
    },
    {
      title: "Вход теперь сохраняется на устройстве",
      body: "После успешного входа кабинет остаётся открытым на этом устройстве, чтобы не приходилось каждый раз вводить почту и пароль заново.",
    },
    {
      title: "Подсказки на главном экране снова попадают в нужные места",
      body: "Окна обучения теперь выделяют именно ту кнопку или область, о которой идёт речь.",
    },
    {
      title: "Десктоп и планшеты защищены от мобильных правок",
      body: "Исправления для телефона отделены от версии для компьютера, чтобы не сбивать доску, рабочий стол и конструктор.",
    },
    {
      title: "Главная страница на телефоне стала мягче визуально",
      body: "Для мобильной версии добавлен более тёплый фон в стиле кошелька, чтобы вход и описание сервиса выглядели едино.",
    },
  ],
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeDashboardUpdates(value: unknown): DashboardUpdatesContent {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: cleanText(row.title, 90),
        body: cleanText(row.body, 360),
      };
    })
    .filter((item) => item.title && item.body)
    .slice(0, 20);

  return {
    title: cleanText(source.title, 80) || DEFAULT_DASHBOARD_UPDATES.title,
    intro: cleanText(source.intro, 220) || DEFAULT_DASHBOARD_UPDATES.intro,
    items: items.length ? items : DEFAULT_DASHBOARD_UPDATES.items,
  };
}
