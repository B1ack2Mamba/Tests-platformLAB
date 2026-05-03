import type { CandidateFeatures, CompetencyScore, RegistryCalibration, RegistryCalibrationIntent } from "@/lib/candidateAnalysis/types";
import type { ResolvedFitMatrix } from "@/lib/fitProfiles";
import { adjustedCompetencyScore } from "@/lib/candidateAnalysis/competencyScoring";
import { getFeature, isLowSignal } from "@/lib/candidateAnalysis/featureExtractor";

function normalize(value: string | null | undefined) {
  return String(value || "").toLowerCase().replace(/ё/g, "е").trim();
}

function hasAny(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeWeights(target: Record<string, number>, source: Record<string, number>) {
  for (const [id, weight] of Object.entries(source)) {
    target[id] = Math.max(target[id] || 0, weight);
  }
}

const INTENT_LIBRARY: Array<Omit<RegistryCalibrationIntent, "reason"> & { patterns: RegExp[]; reasonFactory?: (comment: string) => string }> = [
  {
    id: "quality",
    label: "Качество и точность",
    patterns: [/качеств/, /точност/, /ошиб/, /провер/, /внимательн/, /контрол/],
    weightAdjustments: { C16: 5, C03: 4, C07: 3 },
    criticalCompetencies: ["C16"],
  },
  {
    id: "autonomy",
    label: "Автономность и самостоятельность",
    patterns: [/автоном/, /самостоят/, /без\s+контрол/, /без\s+микроменедж/, /инициатив/],
    weightAdjustments: { C15: 5, C10: 4, C08: 3, C09: 3 },
    criticalCompetencies: ["C15", "C10"],
  },
  {
    id: "rules",
    label: "Регламентность и дисциплина",
    patterns: [/регламент/, /правил/, /норматив/, /дисциплин/, /процедур/, /стандарт/],
    weightAdjustments: { C08: 5, C16: 4, C10: 3 },
    criticalCompetencies: ["C08", "C16"],
  },
  {
    id: "analytics",
    label: "Аналитика и критичность решений",
    patterns: [/аналит/, /критическ/, /системн/, /данн/, /рисков/, /решени/],
    weightAdjustments: { C01: 5, C02: 5, C03: 5, C16: 3 },
    criticalCompetencies: ["C01", "C03"],
  },
  {
    id: "communication",
    label: "Коммуникация и договороспособность",
    patterns: [/коммуникац/, /договар/, /переговор/, /взаимодейств/, /контакт/, /убежден/],
    weightAdjustments: { C17: 5, C20: 4, C23: 3, C31: 5 },
    criticalCompetencies: ["C17", "C31"],
  },
  {
    id: "client",
    label: "Клиентский / партнёрский контур",
    patterns: [/клиент/, /партнер/, /сервис/, /отношени/, /customer/, /аккаунт/],
    weightAdjustments: { C24: 5, C18: 4, C20: 4, C17: 3 },
    criticalCompetencies: ["C24"],
  },
  {
    id: "team",
    label: "Команда и координация людей",
    patterns: [/команд/, /координац/, /люд/, /hr/, /адаптац/, /обучен/],
    weightAdjustments: { C22: 5, C28: 4, C18: 4, C17: 3 },
    criticalCompetencies: ["C22"],
  },
  {
    id: "leadership",
    label: "Управление и лидерство",
    patterns: [/управлен/, /руковод/, /лидер/, /вести/, /влияни/, /делегир/],
    weightAdjustments: { C25: 5, C26: 4, C28: 4, C30: 4, C19: 3 },
    criticalCompetencies: ["C25", "C28"],
  },
  {
    id: "stress",
    label: "Давление и эмоциональная устойчивость",
    patterns: [/стресс/, /давлен/, /нагруз/, /напряж/, /конфликт/, /кризис/],
    weightAdjustments: { C11: 5, C13: 4, C23: 4, C14: 3 },
    criticalCompetencies: ["C11", "C23"],
  },
  {
    id: "change",
    label: "Изменения и развитие",
    patterns: [/изменен/, /развити/, /нов/, /гибк/, /адаптив/, /трансформац/],
    weightAdjustments: { C14: 5, C29: 5, C05: 4, C04: 3 },
    criticalCompetencies: ["C14", "C29"],
  },
];

export function parseRegistryCalibrationIntents(comment: string | null | undefined): RegistryCalibrationIntent[] {
  const text = normalize(comment);
  if (!text) return [];
  return INTENT_LIBRARY
    .filter((item) => hasAny(text, item.patterns))
    .map((item) => ({
      id: item.id,
      label: item.label,
      weightAdjustments: item.weightAdjustments,
      criticalCompetencies: item.criticalCompetencies,
      reason: item.reasonFactory?.(text) || `Комментарий Registry усиливает требование: ${item.label.toLowerCase()}.`,
    }));
}

export function applyRegistryCalibrationToMatrix(matrix: ResolvedFitMatrix, comment: string | null | undefined): RegistryCalibration {
  const intents = parseRegistryCalibrationIntents(comment);
  const weights = { ...matrix.weights };
  const critical = new Set(matrix.critical || []);
  const explanation = [...(matrix.explanation || [])];

  for (const intent of intents) {
    mergeWeights(weights, intent.weightAdjustments);
    intent.criticalCompetencies.forEach((id) => critical.add(id));
    explanation.push(`Registry: ${intent.label}.`);
  }

  return {
    hasComment: Boolean(normalize(comment)),
    comment: String(comment || "").trim(),
    intents,
    matrix: {
      ...matrix,
      label: intents.length ? `${matrix.label} + Registry` : matrix.label,
      weights,
      critical: unique(Array.from(critical)),
      explanation: intents.length
        ? [...explanation, "Комментарии Registry применены как калибровка требований роли, а не как самостоятельное доказательство компетенций."]
        : explanation,
    },
    competencyAdjustments: [],
  };
}

function low16(features: CandidateFeatures, key: string) {
  return isLowSignal(getFeature(features, "16PF", key));
}

function lowBelbin(features: CandidateFeatures, key: string) {
  return isLowSignal(getFeature(features, "Belbin", key));
}

function lowUsk(features: CandidateFeatures, key: string) {
  return isLowSignal(getFeature(features, "УСК", key));
}

function lowColor(features: CandidateFeatures, key: string) {
  return isLowSignal(getFeature(features, "Цветотипы", key));
}

function pushAdjustment(target: Map<string, { delta: number; reasons: string[] }>, id: string, delta: number, reason: string) {
  const current = target.get(id) || { delta: 0, reasons: [] };
  current.delta += delta;
  current.reasons.push(reason);
  target.set(id, current);
}

export function buildRegistryCompetencyAdjustments(features: CandidateFeatures, intents: RegistryCalibrationIntent[]) {
  const adjustments = new Map<string, { delta: number; reasons: string[] }>();
  const ids = new Set(intents.map((item) => item.id));

  if (ids.has("quality")) {
    if (low16(features, "Q3")) pushAdjustment(adjustments, "C16", -7, "Registry подчёркивает качество, а 16PF Q3 низко: риск самоконтроля и финальной проверки.");
    if (low16(features, "G")) pushAdjustment(adjustments, "C16", -6, "Registry подчёркивает качество, а 16PF G низко: риск нормативности и следования стандартам.");
    if (lowBelbin(features, "CF")) pushAdjustment(adjustments, "C16", -7, "Registry подчёркивает качество, а Belbin CF низко: слабее роль контролёра/критика.");
    if (lowColor(features, "BLUE")) pushAdjustment(adjustments, "C03", -4, "Registry подчёркивает проверку решений, а синий структурный контур выражен слабо.");
  }

  if (ids.has("autonomy")) {
    if (low16(features, "Q2")) pushAdjustment(adjustments, "C15", -9, "Registry подчёркивает автономность, а 16PF Q2 низко: риск зависимости от группы/контекста.");
    if (lowUsk(features, "IO")) pushAdjustment(adjustments, "C10", -6, "Registry подчёркивает самостоятельное владение результатом, а общая интернальность УСК низкая.");
    if (low16(features, "C")) pushAdjustment(adjustments, "C15", -4, "Registry подчёркивает самостоятельность, а эмоциональная устойчивость 16PF C низкая.");
  }

  if (ids.has("rules")) {
    if (low16(features, "G")) pushAdjustment(adjustments, "C08", -8, "Registry подчёркивает регламентность, а 16PF G низко: риск слабого следования правилам.");
    if (low16(features, "Q3")) pushAdjustment(adjustments, "C08", -6, "Registry подчёркивает дисциплину, а 16PF Q3 низко: риск самоконтроля.");
    if (lowBelbin(features, "CW")) pushAdjustment(adjustments, "C08", -4, "Registry подчёркивает операционную дисциплину, а Belbin CW низко: слабее исполнительский контур.");
  }

  if (ids.has("analytics")) {
    if (low16(features, "B")) pushAdjustment(adjustments, "C01", -8, "Registry усиливает аналитику, а 16PF B низко: риск когнитивной сложности.");
    if (low16(features, "Q1")) pushAdjustment(adjustments, "C02", -5, "Registry усиливает системное мышление, а 16PF Q1 низко: риск ригидности подходов.");
    if (lowBelbin(features, "ME")) pushAdjustment(adjustments, "C01", -6, "Registry усиливает аналитику, а Belbin ME низко: слабее роль аналитика/эксперта.");
    if (lowBelbin(features, "CF")) pushAdjustment(adjustments, "C03", -6, "Registry усиливает критичность решений, а Belbin CF низко: слабее контроль рисков.");
  }

  if (ids.has("communication") || ids.has("client") || ids.has("team")) {
    if (low16(features, "A")) pushAdjustment(adjustments, "C17", -5, "Registry усиливает коммуникацию, а 16PF A низко: риск дистанции в контакте.");
    if (low16(features, "H")) pushAdjustment(adjustments, "C17", -4, "Registry усиливает контактность, а 16PF H низко: риск социальной осторожности.");
    if (isLowSignal(getFeature(features, "ЭМИН", "MEI"))) pushAdjustment(adjustments, "C18", -6, "Registry усиливает работу с людьми, а межличностный ЭИ выражен слабо.");
    if (isLowSignal(getFeature(features, "Переговорный стиль", "B"))) pushAdjustment(adjustments, "C31", -5, "Registry усиливает договороспособность, а стиль сотрудничества в переговорах низкий.");
  }

  if (ids.has("stress")) {
    if (low16(features, "C")) pushAdjustment(adjustments, "C11", -7, "Registry подчёркивает давление, а 16PF C низко: риск эмоциональной устойчивости.");
    if (isLowSignal(getFeature(features, "ЭМИН", "UE"))) pushAdjustment(adjustments, "C13", -5, "Registry подчёркивает саморегуляцию, а управление эмоциями в ЭМИН выражено слабо.");
  }

  if (ids.has("change")) {
    if (low16(features, "Q1")) pushAdjustment(adjustments, "C14", -6, "Registry усиливает изменения, а 16PF Q1 низко: риск сопротивления новому.");
    if (lowBelbin(features, "PL")) pushAdjustment(adjustments, "C04", -4, "Registry усиливает развитие/идеи, а Belbin PL низко: генерация идей слабее.");
  }

  return Array.from(adjustments.entries()).map(([competencyId, value]) => ({
    competencyId,
    delta: Math.max(-14, Math.min(8, value.delta)),
    reason: unique(value.reasons).join(" "),
  }));
}

export function applyRegistryCalibrationToCompetencies(
  competencies: CompetencyScore[],
  features: CandidateFeatures,
  calibration: RegistryCalibration
) {
  const adjustments = buildRegistryCompetencyAdjustments(features, calibration.intents);
  calibration.competencyAdjustments = adjustments;
  if (!adjustments.length) return competencies;

  const byId = new Map(adjustments.map((item) => [item.competencyId, item]));
  return competencies.map((item) => {
    const adjustment = byId.get(item.id);
    if (!adjustment) return item;
    return adjustedCompetencyScore(item, adjustment.delta, adjustment.reason);
  });
}

export function registryCommentBlock(comment: string | null | undefined) {
  const text = String(comment || "").trim();
  if (!text) return "Комментариев Registry нет: анализ построен только по тестам, цели оценки и матрице роли.";
  const intents = parseRegistryCalibrationIntents(text);
  const intentText = intents.length ? intents.map((item) => item.label).join(", ") : "явных ключевых требований не распознано";
  return [
    "Комментарии Registry используются как калибровка требований роли, а не как самостоятельное доказательство компетенций.",
    `Распознанные фокусы: ${intentText}.`,
    "Комментарий:",
    text,
  ].join("\n");
}
