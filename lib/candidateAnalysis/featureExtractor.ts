import type { AttemptLike, CandidateFeatures, NumericSignal, SignalFamily } from "@/lib/candidateAnalysis/types";

const FAMILY_BY_KIND: Record<string, SignalFamily> = {
  "16pf_v1": "16PF",
  belbin_v1: "Belbin",
  emin_v1: "ЭМИН",
  usk_v1: "УСК",
  forced_pair_v1: "Переговорный стиль",
  pair_sum5_v1: "Мотивационные карты",
  time_management_v1: "Тайм-менеджмент",
  learning_typology_v1: "Типология обучения",
  color_types_v1: "Цветотипы",
  situational_guidance_v1: "Ситуативное руководство",
};

const FAMILY_BY_SLUG: Record<string, SignalFamily> = {
  "16pf-a": "16PF",
  "16pf-b": "16PF",
  belbin: "Belbin",
  emin: "ЭМИН",
  usk: "УСК",
  "negotiation-style": "Переговорный стиль",
  "motivation-cards": "Мотивационные карты",
  "time-management": "Тайм-менеджмент",
  "learning-typology": "Типология обучения",
  "color-types": "Цветотипы",
  "situational-guidance": "Ситуативное руководство",
};

const BELBIN_MAX_RAW = 18;
const NEGOTIATION_MAX_RAW = 12;
const MOTIVATION_MAX_RAW = 35;

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function score100FromRaw(family: SignalFamily, key: string, raw: number, percent?: number | null, maxByFactor?: Record<string, number>) {
  if (family === "16PF" || family === "УСК") return clamp(0, raw * 10, 100);
  if (family === "Belbin") {
    const max = Number(maxByFactor?.[key]) || BELBIN_MAX_RAW;
    return clamp(0, Math.round((raw / Math.max(1, max)) * 100), 100);
  }
  if (family === "Переговорный стиль") return clamp(0, Math.round((raw / NEGOTIATION_MAX_RAW) * 100), 100);
  if (family === "Мотивационные карты") return clamp(0, Math.round((raw / MOTIVATION_MAX_RAW) * 100), 100);
  if (Number.isFinite(Number(percent))) return clamp(0, Number(percent), 100);
  const max = Number(maxByFactor?.[key]) || 0;
  if (max > 0) return clamp(0, Math.round((raw / max) * 100), 100);
  return clamp(0, Math.round(raw * 10), 100);
}

function familyForAttempt(attempt: AttemptLike): SignalFamily {
  const resultKind = String(attempt.result?.kind || "");
  if (FAMILY_BY_KIND[resultKind]) return FAMILY_BY_KIND[resultKind];
  return FAMILY_BY_SLUG[String(attempt.test_slug || "")] || "Другое";
}

function signalKey(value: any) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function putSignal(features: CandidateFeatures, signal: NumericSignal) {
  const familyValues = features.values[signal.family] || {};
  familyValues[signal.key] = signal;
  features.values[signal.family] = familyValues;
}

function rowLabel(row: any, fallback: string) {
  return String(row?.style || row?.name || row?.label || fallback).trim() || fallback;
}

function readNumber(value: any): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function addRows(attempt: AttemptLike, features: CandidateFeatures, family: SignalFamily) {
  const result = attempt.result || {};
  const rows: any[] = Array.isArray(result.ranked) ? result.ranked : [];
  const counts = result?.meta?.stenByFactor || result?.meta?.counts || result?.counts || {};
  const percents = result?.percents || {};
  const maxByFactor = result?.meta?.maxByFactor || {};
  const title = attempt.test_title || attempt.test_slug;

  const seen = new Set<string>();
  for (const row of rows) {
    const key = signalKey(row?.tag || row?.key || row?.code || row?.scale || row?.style);
    if (!key) continue;
    const count = readNumber(row?.count);
    const raw = count ?? readNumber(counts?.[key]) ?? 0;
    const percent = readNumber(row?.percent) ?? readNumber(percents?.[key]);
    const scale: NumericSignal["scale"] = family === "16PF" || family === "УСК" ? "sten" : percent !== null ? "percent" : "count";
    putSignal(features, {
      family,
      key,
      label: rowLabel(row, key),
      raw,
      score100: score100FromRaw(family, key, raw, percent, maxByFactor),
      level: row?.level || null,
      sourceSlug: attempt.test_slug,
      sourceTitle: title,
      scale,
    });
    seen.add(key);
  }

  for (const [rawKey, rawValue] of Object.entries(counts || {})) {
    const key = signalKey(rawKey);
    if (!key || seen.has(key)) continue;
    const raw = readNumber(rawValue) ?? 0;
    const percent = readNumber(percents?.[key]);
    putSignal(features, {
      family,
      key,
      label: key,
      raw,
      score100: score100FromRaw(family, key, raw, percent, maxByFactor),
      level: null,
      sourceSlug: attempt.test_slug,
      sourceTitle: title,
      scale: family === "16PF" || family === "УСК" ? "sten" : percent !== null ? "percent" : "count",
    });
  }
}

function add16PfSecondary(attempt: AttemptLike, features: CandidateFeatures) {
  const secondary = attempt.result?.meta?.secondary || {};
  const title = attempt.test_title || attempt.test_slug;
  for (const [key, value] of Object.entries<any>(secondary)) {
    const count = readNumber(value?.count ?? value?.raw);
    if (count === null) continue;
    putSignal(features, {
      family: "16PF",
      key: signalKey(key),
      label: value?.name || key,
      raw: count,
      score100: clamp(0, Math.round(count * 10), 100),
      level: value?.level || null,
      sourceSlug: attempt.test_slug,
      sourceTitle: title,
      scale: "derived",
    });
  }
}

function addColorBlend(attempt: AttemptLike, features: CandidateFeatures) {
  const colors = features.values["Цветотипы"] || {};
  const red = colors.RED?.score100 || 0;
  const green = colors.GREEN?.score100 || 0;
  const blue = colors.BLUE?.score100 || 0;
  const title = attempt.test_title || attempt.test_slug;
  const blends: Array<[string, number, string]> = [
    ["RED_GREEN", Math.min(red, green), "Смешанный красно-зелёный контур"],
    ["BLUE_GREEN", Math.min(blue, green), "Смешанный сине-зелёный контур"],
    ["RED_BLUE", Math.min(red, blue), "Смешанный красно-синий контур"],
  ];
  for (const [key, value, label] of blends) {
    putSignal(features, {
      family: "Цветотипы",
      key,
      label,
      raw: value,
      score100: value,
      level: value >= 30 ? "смешанный профиль выражен" : "смешанный профиль слабый",
      sourceSlug: attempt.test_slug,
      sourceTitle: title,
      scale: "derived",
    });
  }
}

export function extractCandidateFeatures(attempts: AttemptLike[]): CandidateFeatures {
  const features: CandidateFeatures = {
    attemptsCount: attempts.length,
    completedSlugs: Array.from(new Set(attempts.map((item) => String(item.test_slug || "")).filter(Boolean))),
    values: {},
    topSignals: [],
  };

  for (const attempt of attempts) {
    const family = familyForAttempt(attempt);
    if (family === "Другое") continue;
    addRows(attempt, features, family);
    if (family === "16PF") add16PfSecondary(attempt, features);
    if (family === "Цветотипы") addColorBlend(attempt, features);
  }

  features.topSignals = Object.values(features.values)
    .flatMap((familyValues) => Object.values(familyValues || {}))
    .sort((a, b) => b.score100 - a.score100)
    .slice(0, 18);

  return features;
}

export function getFeature(features: CandidateFeatures, family: SignalFamily, key: string): NumericSignal | null {
  const normalized = signalKey(key);
  return features.values[family]?.[normalized] || null;
}

export function featureRaw(features: CandidateFeatures, family: SignalFamily, key: string): number | null {
  return getFeature(features, family, key)?.raw ?? null;
}

export function featureScore100(features: CandidateFeatures, family: SignalFamily, key: string): number | null {
  return getFeature(features, family, key)?.score100 ?? null;
}

export function describeFeature(signal: NumericSignal | null) {
  if (!signal) return "нет данных";
  const rawText = signal.scale === "sten" || signal.scale === "derived" ? `${Math.round(signal.raw)}/10` : `${Math.round(signal.raw)} балл.`;
  return `${signal.label}: ${rawText}, ${Math.round(signal.score100)}/100`;
}

export function isHighSignal(signal: NumericSignal | null) {
  if (!signal) return false;
  if (signal.family === "16PF" || signal.family === "УСК") return signal.raw >= 7;
  if (signal.family === "Belbin") return signal.raw >= 10 || signal.score100 >= 56;
  if (signal.family === "Переговорный стиль") return signal.raw >= 7 || signal.score100 >= 58;
  if (signal.family === "Мотивационные карты") return signal.raw >= 19 || signal.score100 >= 54;
  return signal.score100 >= 62;
}

export function isMediumOrHighSignal(signal: NumericSignal | null) {
  if (!signal) return false;
  if (signal.family === "16PF" || signal.family === "УСК") return signal.raw >= 5;
  if (signal.family === "Belbin") return signal.raw >= 7 || signal.score100 >= 39;
  if (signal.family === "Переговорный стиль") return signal.raw >= 5 || signal.score100 >= 42;
  if (signal.family === "Мотивационные карты") return signal.raw >= 15 || signal.score100 >= 43;
  return signal.score100 >= 45;
}

export function isLowSignal(signal: NumericSignal | null) {
  if (!signal) return false;
  if (signal.family === "16PF" || signal.family === "УСК") return signal.raw <= 4;
  if (signal.family === "Belbin") return signal.raw <= 4 || signal.score100 <= 22;
  if (signal.family === "Переговорный стиль") return signal.raw <= 3 || signal.score100 <= 25;
  if (signal.family === "Мотивационные карты") return signal.raw <= 12 || signal.score100 <= 34;
  return signal.score100 <= 33;
}
