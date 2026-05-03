import type {
  CandidateRegistryAnalysis,
  DomainKey,
} from "@/lib/candidateAnalysis/types";

export type ManualCalibrationBenchmark = {
  id?: string | null;
  projectId?: string | null;
  benchmarkLabel?: string | null;
  fitProfileId?: string | null;
  fitRequest?: string | null;
  manualBaselineIndex?: number | null;
  manualCalibratedIndex?: number | null;
  manualDomains?: Partial<Record<DomainKey, number>> | null;
  manualCompetencies?: Record<string, number> | null;
  expectedProfileType?: string | null;
  manualRank?: number | null;
  expertNotes?: string | null;
  correctionNotes?: string | null;
};

export type CalibrationDiff = {
  metric: string;
  label: string;
  manual: number | null;
  project: number | null;
  delta: number | null;
  absDelta: number | null;
};

export type CalibrationComparison = {
  projectId?: string | null;
  candidateName: string;
  benchmarkLabel: string;
  fitProfileId: string | null;
  fitRequest: string | null;
  profileType: string | null;
  expectedProfileType: string | null;
  manualRank: number | null;
  projectBaselineIndex: number;
  projectCalibratedIndex: number;
  manualBaselineIndex: number | null;
  manualCalibratedIndex: number | null;
  baselineDelta: number | null;
  calibratedDelta: number | null;
  maxAbsDelta: number | null;
  quality: "hit" | "near" | "watch" | "needs_calibration" | "no_manual_score";
  diffs: CalibrationDiff[];
  suggestedCorrections: string[];
  expertNotes: string | null;
  correctionNotes: string | null;
  summary: string;
};

export type CalibrationReport = {
  rows: CalibrationComparison[];
  aggregate: {
    cases: number;
    scoredCases: number;
    hit: number;
    near: number;
    watch: number;
    needsCalibration: number;
    averageAbsDelta: number | null;
    maxAbsDelta: number | null;
  };
  summary: string;
};

const DOMAIN_LABELS: Record<DomainKey, string> = {
  thinking: "Мышление и решения",
  management: "Управление и влияние",
  communication: "Коммуникация и команда",
  selfOrganization: "Самоорганизация",
  emotional: "Эмоциональная устойчивость",
  motivation: "Мотивация и развитие",
};

function toNumber(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

function delta(project: number | null, manual: number | null) {
  if (project == null || manual == null) return null;
  return project - manual;
}

function abs(value: number | null) {
  return value == null ? null : Math.abs(value);
}

function qualityFromDelta(maxAbsDelta: number | null): CalibrationComparison["quality"] {
  if (maxAbsDelta == null) return "no_manual_score";
  if (maxAbsDelta <= 3) return "hit";
  if (maxAbsDelta <= 5) return "near";
  if (maxAbsDelta <= 9) return "watch";
  return "needs_calibration";
}

function profileTypeFromAnalysis(analysis: CandidateRegistryAnalysis) {
  const domains = analysis.calibrated.domains;
  const ordered = (Object.entries(domains) as Array<[DomainKey, number]>).sort((a, b) => b[1] - a[1]);
  const top = ordered[0];
  const second = ordered[1];
  if (!top) return null;
  const labels = [DOMAIN_LABELS[top[0]]];
  if (second && second[1] >= top[1] - 5) labels.push(DOMAIN_LABELS[second[0]]);
  return labels.join(" + ");
}

function collectDiffs(analysis: CandidateRegistryAnalysis, benchmark: ManualCalibrationBenchmark): CalibrationDiff[] {
  const manualBaseline = toNumber(benchmark.manualBaselineIndex);
  const manualCalibrated = toNumber(benchmark.manualCalibratedIndex);
  const rows: CalibrationDiff[] = [
    {
      metric: "baseline_index",
      label: "Индекс без комментариев Registry",
      manual: manualBaseline,
      project: analysis.baseline.index,
      delta: delta(analysis.baseline.index, manualBaseline),
      absDelta: abs(delta(analysis.baseline.index, manualBaseline)),
    },
    {
      metric: "calibrated_index",
      label: "Индекс с комментариями Registry",
      manual: manualCalibrated,
      project: analysis.calibrated.index,
      delta: delta(analysis.calibrated.index, manualCalibrated),
      absDelta: abs(delta(analysis.calibrated.index, manualCalibrated)),
    },
  ];

  const manualDomains = benchmark.manualDomains || {};
  for (const key of Object.keys(DOMAIN_LABELS) as DomainKey[]) {
    const manual = toNumber(manualDomains[key]);
    if (manual == null) continue;
    const project = analysis.calibrated.domains[key];
    rows.push({
      metric: `domain.${key}`,
      label: DOMAIN_LABELS[key],
      manual,
      project,
      delta: delta(project, manual),
      absDelta: abs(delta(project, manual)),
    });
  }

  const manualCompetencies = benchmark.manualCompetencies || {};
  const byId = new Map(analysis.calibrated.competencies.map((item) => [item.id, item]));
  for (const [id, rawManual] of Object.entries(manualCompetencies)) {
    const manual = toNumber(rawManual);
    if (manual == null) continue;
    const competency = byId.get(id);
    if (!competency) continue;
    rows.push({
      metric: `competency.${id}`,
      label: competency.name,
      manual,
      project: competency.score,
      delta: delta(competency.score, manual),
      absDelta: abs(delta(competency.score, manual)),
    });
  }

  return rows;
}

function correctionHints(analysis: CandidateRegistryAnalysis, diffs: CalibrationDiff[]) {
  const hints: string[] = [];
  const major = diffs.filter((item) => (item.absDelta || 0) >= 6).sort((a, b) => (b.absDelta || 0) - (a.absDelta || 0));
  const calibrated = diffs.find((item) => item.metric === "calibrated_index");

  if (calibrated?.delta != null) {
    if (calibrated.delta >= 6) {
      hints.push("Движок завышает итоговый calibrated index: проверь штрафы contra-сигналов, critical penalties и веса Registry-калибровки.");
    } else if (calibrated.delta <= -6) {
      hints.push("Движок занижает итоговый calibrated index: проверь, не слишком ли жёстко режутся supportive/core-сигналы и coverage caps.");
    }
  }

  for (const item of major.slice(0, 5)) {
    const direction = (item.delta || 0) > 0 ? "завышен" : "занижен";
    hints.push(`${item.label}: ${direction} на ${item.absDelta} балл(ов); нужна калибровка правил/весов для этого блока.`);
  }

  if (!hints.length && diffs.some((item) => item.absDelta != null)) {
    hints.push("Попадание в допустимом коридоре: менять веса не обязательно, достаточно накопить больше эталонных кейсов.");
  }

  if (!hints.length) {
    hints.push("Нет ручных баллов для сравнения: добавь manual_baseline_index/manual_calibrated_index или доменные эталоны.");
  }

  const topRisks = analysis.calibrated.risks.slice(0, 3).join("; ");
  if (topRisks) hints.push(`При ручной проверке отдельно сверь риски: ${topRisks}.`);

  return hints;
}

export function compareAnalysisWithBenchmark(
  analysis: CandidateRegistryAnalysis,
  benchmark: ManualCalibrationBenchmark
): CalibrationComparison {
  const diffs = collectDiffs(analysis, benchmark);
  const maxAbsDelta = diffs.reduce<number | null>((max, item) => {
    if (item.absDelta == null) return max;
    return max == null ? item.absDelta : Math.max(max, item.absDelta);
  }, null);
  const baselineDelta = diffs.find((item) => item.metric === "baseline_index")?.delta ?? null;
  const calibratedDelta = diffs.find((item) => item.metric === "calibrated_index")?.delta ?? null;
  const quality = qualityFromDelta(maxAbsDelta);
  const candidateName = analysis.candidate.name || analysis.candidate.title || "Кандидат";
  const benchmarkLabel = benchmark.benchmarkLabel || "Эталонный кейс";
  const profileType = profileTypeFromAnalysis(analysis);
  const suggestedCorrections = correctionHints(analysis, diffs);
  const qualityLabel: Record<CalibrationComparison["quality"], string> = {
    hit: "точное попадание",
    near: "рядом с эталоном",
    watch: "нужна ручная проверка",
    needs_calibration: "нужна калибровка",
    no_manual_score: "нет ручного эталона",
  };

  return {
    projectId: analysis.candidate.projectId || benchmark.projectId || null,
    candidateName,
    benchmarkLabel,
    fitProfileId: benchmark.fitProfileId || null,
    fitRequest: benchmark.fitRequest || null,
    profileType,
    expectedProfileType: benchmark.expectedProfileType || null,
    manualRank: toNumber(benchmark.manualRank),
    projectBaselineIndex: analysis.baseline.index,
    projectCalibratedIndex: analysis.calibrated.index,
    manualBaselineIndex: toNumber(benchmark.manualBaselineIndex),
    manualCalibratedIndex: toNumber(benchmark.manualCalibratedIndex),
    baselineDelta,
    calibratedDelta,
    maxAbsDelta,
    quality,
    diffs,
    suggestedCorrections,
    expertNotes: benchmark.expertNotes || null,
    correctionNotes: benchmark.correctionNotes || null,
    summary: `${candidateName}: ${qualityLabel[quality]}. Проект: ${analysis.calibrated.index}/100, ручной calibrated: ${toNumber(benchmark.manualCalibratedIndex) ?? "—"}, delta: ${calibratedDelta == null ? "—" : calibratedDelta > 0 ? `+${calibratedDelta}` : calibratedDelta}.`,
  };
}

export function buildCalibrationReport(rows: CalibrationComparison[]): CalibrationReport {
  const scored = rows.filter((item) => item.maxAbsDelta != null);
  const absDeltas = scored.map((item) => item.maxAbsDelta as number);
  const averageAbsDelta = absDeltas.length
    ? Math.round((absDeltas.reduce((sum, value) => sum + value, 0) / absDeltas.length) * 10) / 10
    : null;
  const maxAbsDelta = absDeltas.length ? Math.max(...absDeltas) : null;
  const aggregate = {
    cases: rows.length,
    scoredCases: scored.length,
    hit: rows.filter((item) => item.quality === "hit").length,
    near: rows.filter((item) => item.quality === "near").length,
    watch: rows.filter((item) => item.quality === "watch").length,
    needsCalibration: rows.filter((item) => item.quality === "needs_calibration").length,
    averageAbsDelta,
    maxAbsDelta,
  };

  const summary = rows.length
    ? `Проверено эталонных кейсов: ${rows.length}. Среднее максимальное расхождение: ${averageAbsDelta ?? "—"}. Точные/рядом: ${aggregate.hit + aggregate.near}; требуют калибровки: ${aggregate.needsCalibration}.`
    : "Эталонные кейсы не найдены.";

  return { rows, aggregate, summary };
}

export function calibrationBenchmarkKey(projectId: string, fitProfileId?: string | null, fitRequest?: string | null) {
  return [projectId, fitProfileId || "", String(fitRequest || "").trim()].join("|");
}
