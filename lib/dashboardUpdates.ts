export type DashboardUpdateItem = {
  title: string;
  body: string;
};

export type DashboardUpdateVersion = {
  version: string;
  title: string;
  items: DashboardUpdateItem[];
};

export type DashboardUpdatesContent = {
  title: string;
  intro: string;
  versions: DashboardUpdateVersion[];
  items: DashboardUpdateItem[];
};

export const DASHBOARD_UPDATES_SETTING_KEY = "dashboard_release_updates";

export const DEFAULT_DASHBOARD_UPDATES: DashboardUpdatesContent = {
  title: "Что нового",
  intro: "Собрали последние улучшения сервиса простым языком.",
  versions: [
    {
      version: "1",
      title: "Удобство входа и мобильной работы",
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
    },
    {
      version: "2",
      title: "Рабочий стол и порядок в проектах",
      items: [
        {
          title: "Обновления теперь собраны по версиям",
          body: "В разделе «Что нового» сначала виден номер версии, а ниже — все изменения внутри неё: 2.1, 2.2, 2.3 и дальше по порядку.",
        },
        {
          title: "В админке можно вести версии обновлений",
          body: "Для каждой версии можно менять номер, название и список пунктов, чтобы постепенно дописывать новости для пользователей.",
        },
        {
          title: "Рабочий стол стало проще разобрать",
          body: "Добавлена аккуратная раскладка: папки и проекты можно быстро упорядочить маленькими значками, не ломая ручную расстановку без команды.",
        },
        {
          title: "Иконки на рабочем столе стали похожи на компьютерные",
          body: "Папки и проекты теперь выглядят как привычные ярлыки: маленькая иконка, подпись снизу, подсветка при наведении и выборе.",
        },
        {
          title: "Таблица проектов стала удобнее для больших списков",
          body: "Появились поиск, фильтр по проектам и папкам, а также фильтр по расположению — на столе или внутри папок.",
        },
        {
          title: "Сборка проектов осталась только на доске",
          body: "Лишняя кнопка рядом с рабочим столом убрана, чтобы переход к сборке был в одном понятном месте.",
        },
        {
          title: "Схема на доске меньше отвлекает обновлениями",
          body: "Кабинет больше не перезагружает рабочий стол при обычном продлении сессии, а сама схема не пересобирается из-за обновления профиля или баланса.",
        },
      ],
    },
  ],
  items: [],
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeDashboardUpdates(value: unknown): DashboardUpdatesContent {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const normalizeItems = (rawItems: unknown) => (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: cleanText(row.title, 90),
        body: cleanText(row.body, 360),
      };
    })
    .filter((item) => item.title && item.body)
    .slice(0, 20);

  const rawVersions = Array.isArray(source.versions) ? source.versions : [];
  const versions = rawVersions
    .map((version, index) => {
      const row = version && typeof version === "object" ? (version as Record<string, unknown>) : {};
      const items = normalizeItems(row.items);
      return {
        version: cleanText(row.version, 24) || String(index + 1),
        title: cleanText(row.title, 100) || `Версия ${index + 1}`,
        items,
      };
    })
    .filter((version) => version.items.length)
    .slice(0, 12);

  const legacyItems = normalizeItems(source.items);
  const normalizedVersions = versions.length
    ? versions
    : legacyItems.length
    ? [{ version: "1", title: "Последние улучшения", items: legacyItems }]
    : DEFAULT_DASHBOARD_UPDATES.versions;
  const flatItems = normalizedVersions.flatMap((version) => version.items);

  return {
    title: cleanText(source.title, 80) || DEFAULT_DASHBOARD_UPDATES.title,
    intro: cleanText(source.intro, 220) || DEFAULT_DASHBOARD_UPDATES.intro,
    versions: normalizedVersions,
    items: flatItems.length ? flatItems : DEFAULT_DASHBOARD_UPDATES.versions.flatMap((version) => version.items),
  };
}
