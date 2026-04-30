type Audience = "staff" | "client";

type MotivationFactorCode = "A" | "B" | "C" | "D" | "E" | "F" | "H" | "I";

type MotivationFactorRow = {
  tag?: string;
  style?: string;
  count?: number;
  percent?: number;
  level?: string;
};

const HERZBERG_ORDER: MotivationFactorCode[] = ["A", "D", "I", "B", "C", "E", "F", "H"];

const HERZBERG_META: Record<
  MotivationFactorCode,
  { name: string; group: "hygiene" | "motivational"; groupLabel: string }
> = {
  A: { name: "Заработная плата", group: "hygiene", groupLabel: "гигиенический" },
  D: { name: "Деятельность администрации", group: "hygiene", groupLabel: "гигиенический" },
  I: { name: "Климат отношений в коллективе", group: "hygiene", groupLabel: "гигиенический" },
  B: { name: "Признание со стороны других", group: "motivational", groupLabel: "мотивационный" },
  C: { name: "Ответственность и способность принимать решения", group: "motivational", groupLabel: "мотивационный" },
  E: { name: "Карьерный рост и развитие", group: "motivational", groupLabel: "мотивационный" },
  F: { name: "Достижения в работе", group: "motivational", groupLabel: "мотивационный" },
  H: { name: "Интерес к работе", group: "motivational", groupLabel: "мотивационный" },
};

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function factorBand(score: number) {
  if (score <= 14) {
    return {
      label: "слабо выражен",
      interpretation: "фактор выражен слабо и сам по себе редко становится сильным источником рабочей энергии",
    };
  }
  if (score <= 18) {
    return {
      label: "средняя выраженность",
      interpretation: "фактор значим, но обычно работает как условие, а не как главный драйвер поведения",
    };
  }
  if (score <= 21) {
    return {
      label: "высокий фактор",
      interpretation: "фактор заметно влияет на выбор, включённость и устойчивость человека в работе",
    };
  }
  return {
    label: "требование / дефицит / напряжение",
    interpretation: "фактор звучит как чувствительное требование: если он не закрыт, высок риск напряжения, претензий или демотивации",
  };
}

function normalizeRows(result: any) {
  const ranked = Array.isArray(result?.ranked) ? (result.ranked as MotivationFactorRow[]) : [];
  const byTag = new Map(ranked.map((row) => [String(row.tag || ""), row]));
  return HERZBERG_ORDER.map((tag) => {
    const row: MotivationFactorRow = byTag.get(tag) || {};
    const score = Number(row.count ?? 0);
    const meta = HERZBERG_META[tag];
    return {
      tag,
      name: meta.name,
      group: meta.group,
      group_label: meta.groupLabel,
      score,
      percent: Number.isFinite(Number(row.percent)) ? Number(row.percent) : null,
      level_from_score_module: String(row.level || "").trim() || null,
      band: factorBand(score).label,
      band_interpretation: factorBand(score).interpretation,
    };
  });
}

export function isHerzbergMotivationResult(result: any, testTitle?: string) {
  const title = String(testTitle || "").toLowerCase();
  const ranked = Array.isArray(result?.ranked) ? result.ranked : [];
  const tags = new Set(ranked.map((row: any) => String(row?.tag || "")));
  return (
    result?.kind === "pair_sum5_v1" &&
    HERZBERG_ORDER.every((tag) => tags.has(tag)) &&
    (title.includes("мотивац") || title.includes("герцберг") || title.includes("herzberg") || ranked.length === 8)
  );
}

function buildPacket(testTitle: string, result: any) {
  const factors = normalizeRows(result);
  const hygieneFactors = factors.filter((item) => item.group === "hygiene");
  const motivationalFactors = factors.filter((item) => item.group === "motivational");
  const hygieneScore = hygieneFactors.reduce((sum, item) => sum + item.score, 0);
  const motivationalScore = motivationalFactors.reduce((sum, item) => sum + item.score, 0);
  const totalScore = factors.reduce((sum, item) => sum + item.score, 0);
  const sorted = [...factors].sort((a, b) => b.score - a.score);
  const weakest = [...factors].sort((a, b) => a.score - b.score);

  return {
    test_title: testTitle,
    model: "Герцберг / мотивационный профиль",
    factors,
    leading_factors: sorted.slice(0, 3).map((item) => ({
      name: item.name,
      score: item.score,
      band: item.band,
    })),
    weak_factors: weakest.slice(0, 3).map((item) => ({
      name: item.name,
      score: item.score,
      band: item.band,
    })),
    tension_factors: factors.filter((item) => item.score >= 22).map((item) => item.name),
    hygiene_vs_motivational: {
      hygiene_score: hygieneScore,
      motivational_score: motivationalScore,
      difference: motivationalScore - hygieneScore,
      hygiene_share_percent: totalScore ? Math.round((hygieneScore / totalScore) * 100) : 0,
      motivational_share_percent: totalScore ? Math.round((motivationalScore / totalScore) * 100) : 0,
    },
    interpretation_scale: {
      "0-14": "слабо выражен",
      "15-18": "средняя выраженность",
      "19-21": "высокий фактор",
      "22+": "требование / дефицит / напряжение",
    },
    allowed_portraits: [
      "карьерист",
      "командный игрок",
      "одиночка",
      "трудоголик / рабочая лошадка",
      "продавец от бога",
      "сотрудник с риском выгорания",
      "сотрудник с внутренней недооценённостью",
      "зависимый от руководителя последователь",
    ],
  };
}

export function buildHerzbergPrompt(args: {
  testTitle: string;
  result: any;
  audience: Audience;
}) {
  const { testTitle, result, audience } = args;
  const packet = buildPacket(testTitle, result);
  const lines: string[] = [];

  if (audience === "staff") {
    lines.push(`Ты готовишь профессиональную HR-расшифровку результатов теста «${testTitle}» по модели Ф. Герцберга.`);
  } else {
    lines.push(`Ты готовишь понятную, уважительную и полезную для участника расшифровку результатов теста «${testTitle}» по модели Ф. Герцберга.`);
  }

  lines.push("");
  lines.push("Жёсткие правила:");
  lines.push("- Пиши только по-русски.");
  lines.push("- Не упоминай ИИ, модель, prompt, API, нейросети.");
  lines.push("- Не придумывай фактов о человеке, которых нет в данных.");
  lines.push("- Не используй психиатрические диагнозы, клинические ярлыки и медицинские формулировки.");
  lines.push("- Если вывод неочевиден и строится по косвенной комбинации факторов, помечай его как «Гипотеза».");
  lines.push("- Не пиши воду, общие банальности и бессодержательные комплименты.");
  lines.push("- Фактор со значением 22+ трактуй не как просто «сильный», а как требование, дефицит или зону напряжения.");

  if (audience === "staff") {
    lines.push("- Тон: профессиональный, прикладной, для HR и руководителя.");
    lines.push("- Можно использовать названия факторов и их числовые значения, если это помогает точности.");
  } else {
    lines.push("- Тон: понятный, спокойный, без кодов факторов и без управленческого жаргона.");
    lines.push("- В тексте для участника не показывай буквенные коды факторов.");
  }

  lines.push("");
  lines.push("Факторы и шкала уже определены системой. Используй их как источник истины:");
  lines.push(safeJson(packet));
  lines.push("");
  lines.push("Как интерпретировать профиль:");
  lines.push("- Обязательно разделяй факторы на гигиенические и мотивационные.");
  lines.push("- Смотри не только на лидеров, но и на слабые факторы, потому что именно они могут объяснять демотивацию.");
  lines.push("- Если у человека несколько высоких факторов из разных групп, допускай смешанный портрет.");
  lines.push("- Тип мотивационного портрета выбирай только из разрешённого списка. Если чистого типа нет — так и пиши: «смешанный тип».");
  lines.push("- Не делай категоричных выводов о личности там, где данные описывают только рабочую мотивацию.");

  if (audience === "staff") {
    lines.push("");
    lines.push("Структура ответа обязательна и должна идти именно в таком порядке:");
    lines.push("1. Краткий общий вывод");
    lines.push("2. Ведущие факторы");
    lines.push("3. Слабые факторы");
    lines.push("4. Соотношение гигиенических и мотивационных факторов");
    lines.push("5. Вероятный мотивационный портрет");
    lines.push("6. Риски");
    lines.push("7. Что реально мотивирует человека");
    lines.push("8. Как с ним работать руководителю");
    lines.push("9. Итог для найма / удержания / развития");
    lines.push("");
    lines.push("Дополнительные требования к разделам:");
    lines.push("- В разделе «Ведущие факторы» объясни, какие 2–4 фактора действительно двигают человека и как это будет проявляться в работе.");
    lines.push("- В разделе «Слабые факторы» объясни, что человека обычно не удерживает, не включает или не подпитывает.");
    lines.push("- В разделе «Соотношение гигиенических и мотивационных факторов» покажи, что для человека важнее: условия, отношения и стабильность или рост, ответственность, достижения и интерес к работе.");
    lines.push("- В разделе «Вероятный мотивационный портрет» назови один основной тип или смешанный тип. Если тип неочевиден, пиши «Гипотеза». Разрешённые типы: карьерист, командный игрок, одиночка, трудоголик / рабочая лошадка, продавец от бога, сотрудник с риском выгорания, сотрудник с внутренней недооценённостью, зависимый от руководителя последователь.");
    lines.push("- В разделе «Риски» отдельно оцени: риск ухода, риск выгорания, риск конфликтности, риск падения результативности, риск зависимости от внешнего признания, риск демотивации. Для каждого риска укажи уровень (низкий / средний / высокий) и короткое основание.");
    lines.push("- В разделе «Что реально мотивирует человека» перечисли конкретные рабочие условия, формат задач, стиль обратной связи, управленческие и организационные триггеры.");
    lines.push("- В разделе «Как с ним работать руководителю» обязательно подпункты: как ставить задачи, как давать обратную связь, как удерживать, как не демотивировать, что нельзя делать.");
    lines.push("- В разделе «Итог для найма / удержания / развития» дай отдельный прикладной вывод по трём сценариям: найм, удержание, развитие. Не повторяй те же фразы дословно.");
    lines.push("- Итог должен быть содержательным. Не делай поверхностную заметку на 5 строк.");
  } else {
    lines.push("");
    lines.push("Структура ответа для участника:");
    lines.push("1. Краткий общий вывод");
    lines.push("2. Что в работе для человека особенно важно");
    lines.push("3. Что быстрее всего может его демотивировать");
    lines.push("4. Вероятные риски");
    lines.push("5. Что поможет работать устойчиво и с интересом");
    lines.push("");
    lines.push("Требования к тексту для участника:");
    lines.push("- Не используй наймовые формулировки и не пиши «для работодателя»."); 
    lines.push("- Не перечисляй факторы сухим отчётом. Переводи результат в понятные рабочие смыслы.");
    lines.push("- Если указываешь гипотезу, прямо маркируй это словом «Гипотеза».");
  }

  return lines.join("\n");
}
