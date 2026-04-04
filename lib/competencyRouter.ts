import type { AssessmentGoal } from "@/lib/commercialGoals";

export const ROUTING_MODES = ["goal", "competency"] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];

export const ROUTER_TEST_FAMILIES = [
  "16PF",
  "Belbin",
  "Типология обучения",
  "Цветотипы",
  "УСК",
  "Мотивационные карты",
  "Тайм-менеджмент",
  "ЭМИН",
  "Ситуативное руководство",
  "Переговорный стиль"
] as const;
export type RouterTestFamily = (typeof ROUTER_TEST_FAMILIES)[number];

export type CompetencyRoute = {
  id: string;
  cluster: string;
  name: string;
  definition: string;
  linkedGoals: AssessmentGoal[];
  quickFamilies: RouterTestFamily[];
  standardFamilies: RouterTestFamily[];
  fullFamilies: RouterTestFamily[];
  fitGate: string;
};

const GOAL_PRIORITY: AssessmentGoal[] = [
  "role_fit",
  "general_assessment",
  "motivation",
  "management_potential",
  "team_interaction",
  "leadership",
  "self_organization",
  "learning_agility",
  "emotional_regulation",
  "communication_influence"
] as AssessmentGoal[];

const DEFAULT_TEST_ORDER = [
  "16pf-a",
  "emin",
  "usk",
  "situational-guidance",
  "negotiation-style",
  "belbin",
  "motivation-cards",
  "time-management",
  "learning-typology",
  "color-types",
  "16pf-b",
] as const;

const FAMILY_TO_TEST_SLUGS: Record<RouterTestFamily, string[]> = {
  "16PF": [
    "16pf-a",
    "16pf-b"
  ],
  "ЭМИН": [
    "emin"
  ],
  "УСК": [
    "usk"
  ],
  "Ситуативное руководство": [
    "situational-guidance"
  ],
  "Переговорный стиль": [
    "negotiation-style"
  ],
  "Belbin": [
    "belbin"
  ],
  "Мотивационные карты": [
    "motivation-cards"
  ],
  "Тайм-менеджмент": [
    "time-management"
  ],
  "Типология обучения": [
    "learning-typology"
  ],
  "Цветотипы": [
    "color-types"
  ]
} as Record<RouterTestFamily, string[]>;

export const COMPETENCY_ROUTES: CompetencyRoute[] = [
  {
    "id": "C01",
    "cluster": "Мышление и обучение",
    "name": "Аналитическое мышление",
    "definition": "Умение разбирать ситуацию на части, сравнивать варианты, видеть причинно-следственные связи и снижать риск ошибочного решения.",
    "linkedGoals": [
      "role_fit",
      "general_assessment",
      "learning_agility",
      "communication_influence"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения",
      "Цветотипы"
    ],
    "fitGate": "Считать компетенцию подтверждённой, когда минимум 2 когнитивных семейства (16PF + Belbin/learning/color) согласованно поддерживают анализ и нет явной импульсивности."
  },
  {
    "id": "C02",
    "cluster": "Мышление и обучение",
    "name": "Системное / концептуальное мышление",
    "definition": "Умение видеть систему целиком, строить модели, работать с абстракциями и переносить выводы на более широкий контекст.",
    "linkedGoals": [
      "role_fit",
      "general_assessment",
      "learning_agility"
    ],
    "quickFamilies": [
      "16PF",
      "Типология обучения"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения",
      "Цветотипы"
    ],
    "fitGate": "Подтверждать, если в профиле есть сочетание абстрактности + логики + хотя бы одного поведенческого сигнала (Belbin/learning/color)."
  },
  {
    "id": "C03",
    "cluster": "Мышление и обучение",
    "name": "Критическое суждение / качество решений",
    "definition": "Способность не просто генерировать идеи, а проверять их на реалистичность, риски и последствия.",
    "linkedGoals": [
      "role_fit",
      "general_assessment",
      "self_organization"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Belbin",
      "Типология обучения",
      "Цветотипы"
    ],
    "fitGate": "Сигнал силён, когда критичность сочетается с самоконтролем; голая подозрительность или критика без структуры не засчитывается."
  },
  {
    "id": "C04",
    "cluster": "Мышление и обучение",
    "name": "Креативность / генерация идей",
    "definition": "Способность предлагать новые подходы, видеть нестандартные решения и не застревать только в стандартных шаблонах.",
    "linkedGoals": [
      "role_fit",
      "learning_agility",
      "leadership"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения",
      "Цветотипы"
    ],
    "fitGate": "Подтверждать, если новаторство поддержано и стилем мышления, и поведенческой ролью, а не только одним высоким M."
  },
  {
    "id": "C05",
    "cluster": "Мышление и обучение",
    "name": "Обучаемость / learning agility",
    "definition": "Скорость и качество освоения нового опыта, готовность менять подход и переносить новые способы в работу.",
    "linkedGoals": [
      "learning_agility",
      "role_fit",
      "management_potential"
    ],
    "quickFamilies": [
      "16PF",
      "Типология обучения"
    ],
    "standardFamilies": [
      "16PF",
      "Мотивационные карты",
      "Тайм-менеджмент",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Мотивационные карты",
      "Тайм-менеджмент",
      "Типология обучения"
    ],
    "fitGate": "Компетенция сильна, когда есть одновременно открытость к новому, мотивация на рост и рабочая готовность пробовать/перестраиваться."
  },
  {
    "id": "C06",
    "cluster": "Мышление и обучение",
    "name": "Практическое применение знаний",
    "definition": "Умение переводить идеи и обучение в конкретные действия, инструменты и рабочий результат.",
    "linkedGoals": [
      "self_organization",
      "role_fit",
      "management_potential"
    ],
    "quickFamilies": [
      "Belbin",
      "Типология обучения"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Тайм-менеджмент",
      "Типология обучения"
    ],
    "fitGate": "Подтверждать, если прикладной стиль учёбы подтверждён исполнением и самодисциплиной."
  },
  {
    "id": "C07",
    "cluster": "Управление собой",
    "name": "Планирование и приоритизация",
    "definition": "Умение выстраивать порядок задач, удерживать сроки и раскладывать работу по важности/последовательности.",
    "linkedGoals": [
      "self_organization",
      "management_potential",
      "role_fit"
    ],
    "quickFamilies": [
      "16PF",
      "Тайм-менеджмент"
    ],
    "standardFamilies": [
      "16PF",
      "УСК",
      "Belbin",
      "Тайм-менеджмент"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Belbin",
      "Тайм-менеджмент"
    ],
    "fitGate": "Компетенция подтверждается, когда стиль времени и личностная организованность сходятся в одну сторону."
  },
  {
    "id": "C08",
    "cluster": "Управление собой",
    "name": "Самоорганизация и дисциплина",
    "definition": "Способность стабильно держать рабочий ритм, выполнять договорённости и управлять собой без внешней подгонки.",
    "linkedGoals": [
      "self_organization",
      "general_assessment",
      "role_fit"
    ],
    "quickFamilies": [
      "16PF",
      "УСК"
    ],
    "standardFamilies": [
      "16PF",
      "УСК",
      "Тайм-менеджмент"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Belbin",
      "Тайм-менеджмент"
    ],
    "fitGate": "Считать высокой только если внутренний контроль подтверждается и по УСК, и по поведенческим стилям."
  },
  {
    "id": "C09",
    "cluster": "Управление собой",
    "name": "Ориентация на результат",
    "definition": "Фокус на достижении цели, завершении задачи и доведении работы до измеримого эффекта.",
    "linkedGoals": [
      "motivation",
      "role_fit",
      "leadership",
      "management_potential"
    ],
    "quickFamilies": [
      "Belbin",
      "Мотивационные карты"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Мотивационные карты"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Мотивационные карты",
      "Цветотипы"
    ],
    "fitGate": "Компетенцию засчитывать, когда драйв на достижение подтверждён хотя бы одним исполнительским контуром."
  },
  {
    "id": "C10",
    "cluster": "Управление собой",
    "name": "Ответственность / ownership",
    "definition": "Готовность считать себя автором результата, брать на себя последствия и не перекладывать контроль вовне.",
    "linkedGoals": [
      "self_organization",
      "management_potential",
      "general_assessment"
    ],
    "quickFamilies": [
      "16PF",
      "УСК"
    ],
    "standardFamilies": [
      "16PF",
      "УСК",
      "Мотивационные карты"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Belbin",
      "Мотивационные карты"
    ],
    "fitGate": "Ownership считать подтверждённым при высокой интернальности в работе + наличии поведенческого признака ответственности."
  },
  {
    "id": "C11",
    "cluster": "Управление собой",
    "name": "Стрессоустойчивость",
    "definition": "Способность сохранять работоспособность и адекватность под давлением, не разваливаться эмоционально и организационно.",
    "linkedGoals": [
      "emotional_regulation",
      "general_assessment",
      "management_potential"
    ],
    "quickFamilies": [
      "16PF",
      "ЭМИН"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "УСК"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "УСК",
      "Тайм-менеджмент"
    ],
    "fitGate": "Высокой считать только при совпадении личностной устойчивости и эмоциональной регуляции."
  },
  {
    "id": "C12",
    "cluster": "Управление собой",
    "name": "Эмоциональная осознанность",
    "definition": "Понимание своих состояний, причин реакций и того, как эмоции влияют на работу и взаимодействие.",
    "linkedGoals": [
      "emotional_regulation",
      "general_assessment"
    ],
    "quickFamilies": [
      "16PF",
      "ЭМИН"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Типология обучения"
    ],
    "fitGate": "Компетенция опирается прежде всего на ЭМИН; остальные тесты служат модификаторами и контекстом."
  },
  {
    "id": "C13",
    "cluster": "Управление собой",
    "name": "Эмоциональная саморегуляция",
    "definition": "Способность удерживать эмоции под контролем и не разрушать коммуникацию собственными реакциями.",
    "linkedGoals": [
      "emotional_regulation",
      "leadership",
      "team_interaction"
    ],
    "quickFamilies": [
      "16PF",
      "ЭМИН"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "УСК"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "УСК",
      "Ситуативное руководство"
    ],
    "fitGate": "Подтверждать только если человек умеет и выдерживать себя, и не разбрасывать это на других."
  },
  {
    "id": "C14",
    "cluster": "Управление собой",
    "name": "Адаптивность / гибкость",
    "definition": "Умение перестраиваться под новый контекст, задачи, людей и степень готовности исполнителей.",
    "linkedGoals": [
      "learning_agility",
      "leadership",
      "team_interaction",
      "role_fit"
    ],
    "quickFamilies": [
      "Ситуативное руководство",
      "Тайм-менеджмент"
    ],
    "standardFamilies": [
      "Ситуативное руководство",
      "Тайм-менеджмент",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Ситуативное руководство",
      "Тайм-менеджмент",
      "Типология обучения"
    ],
    "fitGate": "Сильна, если гибкость проявляется и в стиле лидерства, и в рабочем/учебном стиле."
  },
  {
    "id": "C15",
    "cluster": "Управление собой",
    "name": "Независимость / автономность",
    "definition": "Умение действовать без постоянной внешней опоры, удерживать собственную позицию и самостоятельные решения.",
    "linkedGoals": [
      "role_fit",
      "leadership",
      "management_potential"
    ],
    "quickFamilies": [
      "16PF",
      "УСК"
    ],
    "standardFamilies": [
      "16PF",
      "УСК",
      "Мотивационные карты"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Мотивационные карты",
      "Цветотипы"
    ],
    "fitGate": "Автономность подтверждать, если самостоятельность не сопровождается уходом от ответственности и кооперации."
  },
  {
    "id": "C16",
    "cluster": "Управление собой",
    "name": "Ориентация на качество",
    "definition": "Внимание к стандарту, деталям, рискам ошибок и доведению продукта до приемлемого уровня.",
    "linkedGoals": [
      "self_organization",
      "role_fit",
      "general_assessment"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Тайм-менеджмент"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Тайм-менеджмент",
      "Типология обучения"
    ],
    "fitGate": "Сигнал качества высокий, когда контроль ошибок поддержан личностной аккуратностью и рабочим стилем."
  },
  {
    "id": "C17",
    "cluster": "Коммуникация и влияние",
    "name": "Коммуникация",
    "definition": "Способность понятно доносить смысл, поддерживать контакт и быть понятным разным людям.",
    "linkedGoals": [
      "communication_influence",
      "team_interaction",
      "role_fit"
    ],
    "quickFamilies": [
      "16PF",
      "ЭМИН"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Цветотипы"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Belbin",
      "Цветотипы"
    ],
    "fitGate": "Компетенция не сводится к болтливости: нужен и контакт, и считывание собеседника."
  },
  {
    "id": "C18",
    "cluster": "Коммуникация и влияние",
    "name": "Эмпатия / понимание других",
    "definition": "Умение замечать состояние и потребности других людей и учитывать их в рабочем контакте.",
    "linkedGoals": [
      "team_interaction",
      "communication_influence",
      "emotional_regulation"
    ],
    "quickFamilies": [
      "16PF",
      "ЭМИН"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Belbin"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Belbin",
      "Цветотипы"
    ],
    "fitGate": "Подтверждать, если межличностное понимание видно не только в одной шкале ЭМИН, но и в стилях поведения."
  },
  {
    "id": "C19",
    "cluster": "Коммуникация и влияние",
    "name": "Влияние и убеждение",
    "definition": "Способность добиваться согласия, менять позицию других и вести их к решению без прямого административного давления.",
    "linkedGoals": [
      "communication_influence",
      "leadership",
      "management_potential"
    ],
    "quickFamilies": [
      "16PF",
      "ЭМИН",
      "Переговорный стиль"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Переговорный стиль"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство",
      "Переговорный стиль",
      "Цветотипы"
    ],
    "fitGate": "Высоким считать, когда человек может продавливать результат, но не сваливается в силовое продавливание и удерживает контакт."
  },
  {
    "id": "C20",
    "cluster": "Коммуникация и влияние",
    "name": "Дипломатичность / политическая чувствительность",
    "definition": "Умение учитывать интересы сторон, действовать тактично и выбирать форму воздействия под контекст.",
    "linkedGoals": [
      "communication_influence",
      "team_interaction",
      "leadership"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Переговорный стиль"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Переговорный стиль"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Переговорный стиль",
      "Belbin",
      "Цветотипы"
    ],
    "fitGate": "Тактичность подтверждать, когда социальная чувствительность сочетается с партнёрскими стратегиями переговоров, а не только с внешней вежливостью."
  },
  {
    "id": "C21",
    "cluster": "Коммуникация и влияние",
    "name": "Нетворкинг / ресурсность",
    "definition": "Способность находить людей, возможности и внешние ресурсы, быстро входить в рабочие связи.",
    "linkedGoals": [
      "communication_influence",
      "role_fit",
      "leadership"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Цветотипы"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Тайм-менеджмент",
      "Цветотипы"
    ],
    "fitGate": "Подтверждать при сочетании социальной смелости и реального поведенческого стиля на внешние связи."
  },
  {
    "id": "C22",
    "cluster": "Коммуникация и влияние",
    "name": "Командное взаимодействие",
    "definition": "Умение встроиться в совместную работу, учитывать роли других и удерживать кооперацию без лишнего трения.",
    "linkedGoals": [
      "team_interaction",
      "general_assessment",
      "role_fit"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Переговорный стиль",
      "Belbin"
    ],
    "standardFamilies": [
      "ЭМИН",
      "Переговорный стиль",
      "Belbin"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "УСК",
      "Переговорный стиль",
      "Belbin"
    ],
    "fitGate": "Командность высокая, если кооперация видна и в ролях, и в способе решать разногласия."
  },
  {
    "id": "C23",
    "cluster": "Коммуникация и влияние",
    "name": "Управление конфликтом",
    "definition": "Способность не только входить в острые ситуации, но и удерживать их в рабочем русле, не разрушая отношения.",
    "linkedGoals": [
      "team_interaction",
      "communication_influence",
      "leadership"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Переговорный стиль"
    ],
    "standardFamilies": [
      "ЭМИН",
      "Ситуативное руководство",
      "Переговорный стиль"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство",
      "Переговорный стиль",
      "Belbin"
    ],
    "fitGate": "Управление конфликтом — это способность держать острый разговор в рабочем режиме, а не просто побеждать или избегать."
  },
  {
    "id": "C24",
    "cluster": "Коммуникация и влияние",
    "name": "Клиентская / партнёрская ориентация",
    "definition": "Фокус на понимании потребностей другой стороны, удержании доверия и качестве сервиса.",
    "linkedGoals": [
      "communication_influence",
      "team_interaction",
      "role_fit"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Переговорный стиль"
    ],
    "standardFamilies": [
      "ЭМИН",
      "Переговорный стиль",
      "Belbin",
      "Цветотипы"
    ],
    "fullFamilies": [
      "ЭМИН",
      "Переговорный стиль",
      "Belbin",
      "Мотивационные карты",
      "Цветотипы"
    ],
    "fitGate": "Сильна, когда фокус на потребностях другой стороны не обнуляет собственные границы и качество договорённости."
  },
  {
    "id": "C25",
    "cluster": "Лидерство и управление",
    "name": "Лидерский потенциал",
    "definition": "Совокупная вероятность того, что человек сможет вести за собой, удерживать цель и быть точкой опоры для других.",
    "linkedGoals": [
      "leadership",
      "management_potential",
      "role_fit"
    ],
    "quickFamilies": [
      "16PF",
      "Ситуативное руководство"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство",
      "Переговорный стиль",
      "Belbin"
    ],
    "fitGate": "Не считать высоким по одному E или RED — нужен баланс влияния, устойчивости и управления людьми."
  },
  {
    "id": "C26",
    "cluster": "Лидерство и управление",
    "name": "Ситуативное лидерство",
    "definition": "Умение подбирать стиль управления под зрелость исполнителя и реальный контекст задачи.",
    "linkedGoals": [
      "leadership",
      "management_potential",
      "team_interaction"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Ситуативное руководство"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "УСК",
      "Ситуативное руководство",
      "Переговорный стиль"
    ],
    "fitGate": "Подтверждать прежде всего по самому тесту situational guidance, а остальные тесты использовать как валидаторы зрелости стиля."
  },
  {
    "id": "C27",
    "cluster": "Лидерство и управление",
    "name": "Делегирование",
    "definition": "Готовность отдавать автономию, не перехватывая лишний контроль там, где человек уже способен справиться сам.",
    "linkedGoals": [
      "leadership",
      "management_potential",
      "team_interaction"
    ],
    "quickFamilies": [
      "16PF",
      "Ситуативное руководство"
    ],
    "standardFamilies": [
      "16PF",
      "Ситуативное руководство",
      "Belbin"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Ситуативное руководство",
      "Переговорный стиль",
      "Belbin"
    ],
    "fitGate": "Делегирование считать сильным только при наличии признаков доверия и контроля импульса «сделать всё самому»."
  },
  {
    "id": "C28",
    "cluster": "Лидерство и управление",
    "name": "Координация и организация других",
    "definition": "Умение собирать людей вокруг общей задачи, распределять роли, удерживать темп и сопрягать вклад разных участников.",
    "linkedGoals": [
      "management_potential",
      "leadership",
      "team_interaction"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Тайм-менеджмент"
    ],
    "fullFamilies": [
      "16PF",
      "УСК",
      "Belbin",
      "Тайм-менеджмент"
    ],
    "fitGate": "Подтверждать, когда координация поддержана и ролями, и структурой, а не только напором."
  },
  {
    "id": "C29",
    "cluster": "Лидерство и управление",
    "name": "Лидерство изменений",
    "definition": "Способность инициировать движение, продавить новизну и провести людей через изменения без распада работы.",
    "linkedGoals": [
      "leadership",
      "management_potential",
      "learning_agility"
    ],
    "quickFamilies": [
      "16PF",
      "Belbin"
    ],
    "standardFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения"
    ],
    "fullFamilies": [
      "16PF",
      "Belbin",
      "Типология обучения",
      "Цветотипы"
    ],
    "fitGate": "Высоким считать, если новаторство соединено с способностью тянуть людей, а не только генерировать идеи."
  },
  {
    "id": "C30",
    "cluster": "Лидерство и управление",
    "name": "Коучинг / развитие других",
    "definition": "Способность замечать уровень человека, поддерживать рост и усиливать его без лишнего давления.",
    "linkedGoals": [
      "leadership",
      "team_interaction",
      "emotional_regulation"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Ситуативное руководство"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство",
      "Переговорный стиль",
      "Belbin"
    ],
    "fitGate": "Компетенция сильна, когда поддержка людей подтверждается и стилем лидерства, и эмоциональным контуром."
  },
  {
    "id": "C31",
    "cluster": "Коммуникация и влияние",
    "name": "Переговорная компетентность / договороспособность",
    "definition": "Способность удерживать свои интересы и интересы другой стороны, выбирать подходящий стиль согласования и доводить конфликт или торг до рабочего соглашения.",
    "linkedGoals": [
      "communication_influence",
      "role_fit",
      "leadership",
      "team_interaction"
    ],
    "quickFamilies": [
      "ЭМИН",
      "Переговорный стиль"
    ],
    "standardFamilies": [
      "16PF",
      "ЭМИН",
      "Переговорный стиль"
    ],
    "fullFamilies": [
      "16PF",
      "ЭМИН",
      "Ситуативное руководство",
      "Переговорный стиль",
      "Belbin"
    ],
    "fitGate": "Подтверждать, если переговорный тест показывает партнёрский или сбалансированно-ассертивный стиль, а эмоциональная и личностная модель подтверждает способность выдерживать напряжение и учитывать интересы сторон."
  }
] as CompetencyRoute[];

export const COMPETENCY_CLUSTERS = [
  "Мышление и обучение",
  "Управление собой",
  "Коммуникация и влияние",
  "Лидерство и управление"
] as const;

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sortSlugs(values: string[]) {
  const order = new Map<string, number>(DEFAULT_TEST_ORDER.map((slug, index) => [slug, index]));
  return [...values].sort((a, b) => {
    const delta = (order.get(a) ?? 999) - (order.get(b) ?? 999);
    if (delta !== 0) return delta;
    return a.localeCompare(b, "ru");
  });
}

export function isRoutingMode(value: unknown): value is RoutingMode {
  return typeof value === "string" && (ROUTING_MODES as readonly string[]).includes(value);
}

export function getCompetencyRoute(id: string) {
  return COMPETENCY_ROUTES.find((item) => item.id === id) || null;
}

export function getCompetencyRoutes(ids: readonly string[]) {
  const selected = new Set(ids);
  return COMPETENCY_ROUTES.filter((item) => selected.has(item.id));
}

export function getCompetencyGroups() {
  return COMPETENCY_CLUSTERS.map((cluster) => ({
    cluster,
    items: COMPETENCY_ROUTES.filter((item) => item.cluster === cluster),
  }));
}

export function normalizeCompetencyIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const valid = new Set(COMPETENCY_ROUTES.map((item) => item.id));
  return uniqueStrings(value.map((item) => String(item || "").trim())).filter((id) => valid.has(id));
}

function materializeFamily(family: RouterTestFamily, availableSet: Set<string> | null) {
  const candidates = FAMILY_TO_TEST_SLUGS[family] || [];
  if (!candidates.length) return [] as string[];
  if (!availableSet) return [candidates[0]];
  const match = candidates.find((slug) => availableSet.has(slug));
  return match ? [match] : [];
}

function collectFamilies(ids: readonly string[], route: "quick" | "standard" | "full") {
  const families: RouterTestFamily[] = [];
  const seen = new Set<string>();

  for (const item of getCompetencyRoutes(ids)) {
    const source = route === "quick" ? item.quickFamilies : route === "full" ? item.fullFamilies : item.standardFamilies;
    for (const family of source) {
      if (seen.has(family)) continue;
      seen.add(family);
      families.push(family);
    }
  }

  return families;
}

export function getCompetencyRecommendedFamilies(ids: readonly string[], route: "quick" | "standard" | "full" = "standard") {
  return collectFamilies(ids, route);
}

export function getCompetencyRecommendedTests(
  ids: readonly string[],
  availableSlugs?: readonly string[],
  route: "quick" | "standard" | "full" = "standard"
) {
  const availableSet = availableSlugs?.length ? new Set(availableSlugs) : null;
  const families = collectFamilies(ids, route);
  const slugs = uniqueStrings(families.flatMap((family) => materializeFamily(family, availableSet)));
  return sortSlugs(slugs);
}

export function getCompetencyTestReasons(
  ids: readonly string[],
  availableSlugs?: readonly string[],
  route: "quick" | "standard" | "full" = "standard"
) {
  const availableSet = availableSlugs?.length ? new Set(availableSlugs) : null;
  const reasons = new Map<string, string[]>();

  for (const item of getCompetencyRoutes(ids)) {
    const source = route === "quick" ? item.quickFamilies : route === "full" ? item.fullFamilies : item.standardFamilies;
    const slugs = uniqueStrings(source.flatMap((family) => materializeFamily(family, availableSet)));
    for (const slug of slugs) {
      const current = reasons.get(slug) || [];
      if (!current.includes(item.name)) current.push(item.name);
      reasons.set(slug, current);
    }
  }

  return Object.fromEntries(Array.from(reasons.entries()).map(([slug, names]) => [slug, names]));
}

export function getClosestGoalForCompetencies(ids: readonly string[]): AssessmentGoal | null {
  const scores = new Map<AssessmentGoal, number>();

  for (const item of getCompetencyRoutes(ids)) {
    for (const goal of item.linkedGoals) {
      scores.set(goal, (scores.get(goal) || 0) + 1);
    }
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return GOAL_PRIORITY.indexOf(a[0]) - GOAL_PRIORITY.indexOf(b[0]);
  });

  return ranked[0]?.[0] || null;
}

export function getAllCompetencyIds() {
  return COMPETENCY_ROUTES.map((item) => item.id);
}

export function getCompetenciesForGoal(goal: AssessmentGoal) {
  return COMPETENCY_ROUTES.filter((item) => item.linkedGoals.includes(goal));
}

export function getCompetencyNames(ids: readonly string[]) {
  return getCompetencyRoutes(ids).map((item) => item.name);
}

export function getCompetencyShortLabel(ids: readonly string[]) {
  const names = getCompetencyNames(ids);
  if (!names.length) return "Компетенции";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(" + ");
  return `Компетенции (${names.length})`;
}

export function getCompetencyLongLabel(ids: readonly string[]) {
  const names = getCompetencyNames(ids);
  if (!names.length) return "Компетенции не выбраны";
  return names.join(", ");
}
