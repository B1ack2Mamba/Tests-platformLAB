import workbook from "@/data/competency-calibration/completed-workbook.json";
import { COMPETENCY_ROUTES } from "@/lib/competencyRouter";
import type { CandidateFeatures, CompetencyScore, EvidenceHit, SignalFamily } from "@/lib/candidateAnalysis/types";
import { getFeature, isHighSignal, isLowSignal, isMediumOrHighSignal } from "@/lib/candidateAnalysis/featureExtractor";

const FAMILY_ALIASES: Array<{ family: SignalFamily; patterns: RegExp[] }> = [
  { family: "16PF", patterns: [/16\s*pf/i, /кеттел/i] },
  { family: "Belbin", patterns: [/belbin/i, /белбин/i] },
  { family: "ЭМИН", patterns: [/emin/i, /эми/i, /эмоц/i] },
  { family: "УСК", patterns: [/usk/i, /уск/i, /интерн/i] },
  { family: "Переговорный стиль", patterns: [/negotiation/i, /переговор/i] },
  { family: "Мотивационные карты", patterns: [/motivation/i, /мотивац/i, /герцберг/i] },
  { family: "Тайм-менеджмент", patterns: [/time/i, /тайм/i, /врем/i] },
  { family: "Типология обучения", patterns: [/learning/i, /обуч/i, /типолог/i] },
  { family: "Цветотипы", patterns: [/color/i, /цвет/i, /red/i, /green/i, /blue/i] },
  { family: "Ситуативное руководство", patterns: [/situational/i, /ситуатив/i, /s[1-4]/i] },
];

const FAMILY_KEYS: Record<SignalFamily, string[]> = {
  "16PF": ["Q1", "Q2", "Q3", "Q4", "F1", "F2", "F3", "F4", "A", "B", "C", "E", "F", "G", "H", "I", "L", "M", "N", "O"],
  Belbin: ["CW", "CH", "SH", "PL", "RI", "ME", "TW", "CF"],
  "ЭМИН": ["MEI", "VEI", "OEI", "MP", "MU", "VP", "VU", "VE", "PE", "UE"],
  "УСК": ["IO", "ID", "IN", "IS", "IP", "IM", "IZ"],
  "Переговорный стиль": ["A", "B", "C", "D", "E"],
  "Мотивационные карты": ["A", "D", "I", "B", "C", "E", "F", "H"],
  "Тайм-менеджмент": ["LC", "LP", "PC", "L", "P", "C"],
  "Типология обучения": ["OBS", "EXP", "PRA", "THE"],
  "Цветотипы": ["BLUE_GREEN", "RED_GREEN", "RED_BLUE", "GREEN", "BLUE", "RED"],
  "Ситуативное руководство": ["S1", "S2", "S3", "S4"],
  "Другое": [],
};

type WorkbookCompetencyRow = Record<string, any>;

type SignalKind = "core" | "supportive" | "contra";

type MatchOptions = {
  kind: SignalKind;
  competencyId: string;
};

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function workbookRows(): WorkbookCompetencyRow[] {
  const sheet = (workbook as any)?.sheets?.["Компетенции"];
  return Array.isArray(sheet?.rows) ? sheet.rows : [];
}

const ROWS_BY_ID = new Map<string, WorkbookCompetencyRow>(
  workbookRows().map((row) => [String(row?.ID || "").trim(), row]).filter(([id]) => Boolean(id)) as Array<[string, WorkbookCompetencyRow]>
);

function getRow(id: string) {
  return ROWS_BY_ID.get(id) || null;
}

function normalize(value: string) {
  return String(value || "").toLowerCase().replace(/ё/g, "е");
}

function splitSignalSegments(text: string) {
  return String(text || "")
    .split(/[;。]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function detectFamilies(segment: string): SignalFamily[] {
  const hits = FAMILY_ALIASES.filter((item) => item.patterns.some((pattern) => pattern.test(segment))).map((item) => item.family);
  if (/\b(?:red|green|blue|red_green|blue_green)\b/i.test(segment)) hits.push("Цветотипы");
  if (/\b(?:OBS|EXP|PRA|THE)\b/.test(segment)) hits.push("Типология обучения");
  if (/\b(?:CW|CH|SH|PL|RI|ME|TW|CF)\b/.test(segment)) hits.push("Belbin");
  if (/\b(?:MEI|VEI|OEI|MP|MU|VP|VU|VE|PE|UE)\b/.test(segment)) hits.push("ЭМИН");
  if (/\b(?:IO|ID|IN|IS|IP|IM|IZ)\b/.test(segment)) hits.push("УСК");
  return unique(hits).filter((item) => item !== "Другое");
}

function findKeysInSegment(segment: string, family: SignalFamily) {
  const upper = segment.toUpperCase().replace(/-/g, "_");
  const keys = FAMILY_KEYS[family] || [];
  return keys.filter((key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Z0-9_])${escaped}([^A-Z0-9_]|$)`, "i").test(upper);
  });
}

function directionForKey(segment: string, key: string, fallbackKind: SignalKind): "high" | "mid" | "low" | "present" {
  const upper = segment.toUpperCase().replace(/-/g, "_");
  const idx = upper.indexOf(key.toUpperCase());
  const near = idx >= 0 ? upper.slice(Math.max(0, idx - 8), idx + key.length + 14) : upper;
  if (/[↓]/.test(near) || /\bLOW\b|НИЗК|СЛАБ/.test(near)) return "low";
  if (/[↗]/.test(near) || /СР|УМЕРЕН/.test(near)) return "mid";
  if (/[↑]/.test(near) || /\bHIGH\b|ВЫСОК|СИЛЬН|ДОМИНИР/.test(near)) return "high";
  return fallbackKind === "contra" ? "low" : "present";
}

function signalMatches(features: CandidateFeatures, family: SignalFamily, key: string, direction: "high" | "mid" | "low" | "present") {
  const signal = getFeature(features, family, key);
  if (!signal) return false;
  if (direction === "low") return isLowSignal(signal);
  if (direction === "mid") return isMediumOrHighSignal(signal);
  if (direction === "present") return isMediumOrHighSignal(signal) || isHighSignal(signal);
  return isHighSignal(signal);
}

function strengthFromSignal(features: CandidateFeatures, family: SignalFamily, key: string, kind: SignalKind): EvidenceHit["strength"] {
  const signal = getFeature(features, family, key);
  if (!signal) return "weak";
  if (kind === "contra") {
    if (isLowSignal(signal)) return "strong";
    return "medium";
  }
  if (isHighSignal(signal)) return "strong";
  if (isMediumOrHighSignal(signal)) return "medium";
  return "weak";
}

function matchSignalText(text: string, features: CandidateFeatures, options: MatchOptions): EvidenceHit[] {
  const hits: EvidenceHit[] = [];
  for (const segment of splitSignalSegments(text)) {
    const families = detectFamilies(segment);
    for (const family of families) {
      const keys = findKeysInSegment(segment, family);
      for (const key of keys) {
        const direction = directionForKey(segment, key, options.kind);
        if (!signalMatches(features, family, key, direction)) continue;
        const signal = getFeature(features, family, key);
        hits.push({
          family,
          key,
          label: `${family} ${key}${direction === "low" ? " низко" : direction === "mid" ? " средне+" : " высоко"}${signal?.label ? ` (${signal.label})` : ""}`,
          source: options.kind,
          strength: strengthFromSignal(features, family, key, options.kind),
          score100: signal?.score100,
        });
      }
    }
  }

  return dedupeEvidence(hits);
}

function dedupeEvidence(items: EvidenceHit[]) {
  const map = new Map<string, EvidenceHit>();
  for (const item of items) {
    const key = `${item.source}:${item.family}:${item.key || item.label}`;
    const prev = map.get(key);
    if (!prev || strengthRank(item.strength) > strengthRank(prev.strength)) map.set(key, item);
  }
  return Array.from(map.values());
}

function strengthRank(strength: EvidenceHit["strength"]) {
  if (strength === "strong") return 3;
  if (strength === "medium") return 2;
  return 1;
}

function parseInterviewQuestions(value: any) {
  return String(value || "")
    .split(/[;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function levelFromScore(score: number): CompetencyScore["level"] {
  if (score >= 74) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function statusFromScore(score: number) {
  if (score >= 74) return "Высокий уровень";
  if (score >= 60) return "Средний уровень";
  return "Низкий уровень";
}

function familyCoveragePenalty(routeFamilies: string[], coveredFamilies: SignalFamily[]) {
  if (!routeFamilies.length) return 0;
  const normalizedCovered = new Set(coveredFamilies);
  let overlap = 0;
  for (const family of routeFamilies) {
    if (normalizedCovered.has(family as SignalFamily)) overlap += 1;
  }
  return overlap >= 2 ? 0 : overlap === 1 ? 6 : 12;
}

export function scoreCompetencyFromFeatures(competencyId: string, features: CandidateFeatures): CompetencyScore | null {
  const route = COMPETENCY_ROUTES.find((item) => item.id === competencyId);
  if (!route) return null;
  const row = getRow(competencyId);

  const core = matchSignalText(String(row?.["Core-signals"] || ""), features, { competencyId, kind: "core" });
  const supportive = matchSignalText(String(row?.["Supportive-signals"] || ""), features, { competencyId, kind: "supportive" });
  const contra = matchSignalText(String(row?.["Contra-signals"] || ""), features, { competencyId, kind: "contra" });

  const supportiveOnlyFamilies = unique([...core, ...supportive].map((item) => item.family));
  const contraFamilies = unique(contra.map((item) => item.family));
  const strongContra = contra.filter((item) => item.strength === "strong");

  const coreWeight = core.reduce((sum, item) => sum + (item.strength === "strong" ? 12 : item.strength === "medium" ? 8 : 5), 0);
  const supportiveWeight = supportive.reduce((sum, item) => sum + (item.strength === "strong" ? 5 : item.strength === "medium" ? 4 : 2), 0);
  const contraWeight = contra.reduce((sum, item) => sum + (item.strength === "strong" ? 13 : item.strength === "medium" ? 8 : 5), 0);
  const coveragePenalty = familyCoveragePenalty(route.standardFamilies as any, supportiveOnlyFamilies);

  let score = 52 + Math.min(30, coreWeight) + Math.min(16, supportiveWeight) - contraWeight - coveragePenalty;

  if (supportiveOnlyFamilies.length < 2) score = Math.min(score, 59);
  if (!core.length) score = Math.min(score, supportive.length ? 63 : 56);
  if (strongContra.length >= 1) score = Math.min(score, 73);
  if (contraFamilies.length >= 2 || strongContra.length >= 2) score = Math.min(score, 59);
  if (contraFamilies.length >= 3) score = Math.min(score, 49);

  score = Math.round(clamp(35, score, 95));
  const level = levelFromScore(score);
  const notes = [
    row?.["Rule of thumb"] ? String(row["Rule of thumb"]) : route.fitGate,
    row?.["Достаточность данных"] ? String(row["Достаточность данных"]) : "Минимум: два независимых семейства данных для уверенного вывода.",
  ].filter(Boolean).slice(0, 3);

  return {
    id: route.id,
    name: route.name,
    cluster: route.cluster,
    definition: route.definition,
    score,
    level,
    status: statusFromScore(score),
    evidence: dedupeEvidence([...core, ...supportive]),
    contra: dedupeEvidence(contra),
    families: supportiveOnlyFamilies,
    confidence: supportiveOnlyFamilies.length >= 3 ? "high" : supportiveOnlyFamilies.length >= 2 ? "medium" : "low",
    interviewQuestions: parseInterviewQuestions(row?.["Вопросы интервью"]),
    notes,
  };
}

export function scoreAllCompetencies(features: CandidateFeatures, ids?: readonly string[]) {
  const wanted = ids?.length ? ids : COMPETENCY_ROUTES.map((item) => item.id);
  return wanted
    .map((id) => scoreCompetencyFromFeatures(id, features))
    .filter(Boolean) as CompetencyScore[];
}

export function adjustedCompetencyScore(item: CompetencyScore, delta: number, reason: string): CompetencyScore {
  const score = Math.round(clamp(35, item.score + delta, 95));
  return {
    ...item,
    score,
    level: levelFromScore(score),
    status: statusFromScore(score),
    evidence: delta > 0 ? [...item.evidence, { family: "Другое", label: reason, source: "registry", strength: "medium" }] : item.evidence,
    contra: delta < 0 ? [...item.contra, { family: "Другое", label: reason, source: "registry", strength: Math.abs(delta) >= 8 ? "strong" : "medium" }] : item.contra,
  };
}

export function compactCompetencyLine(item: CompetencyScore) {
  const evidence = item.evidence.slice(0, 2).map((hit) => hit.label).join("; ") || "покрытие тестами ограничено";
  const contra = item.contra.slice(0, 2).map((hit) => hit.label).join("; ");
  return `${item.name}: ${item.score}/100, ${item.status.toLowerCase()}. Опора: ${evidence}${contra ? `. Ограничения: ${contra}` : ""}.`;
}
