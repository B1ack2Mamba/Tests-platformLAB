import type { AssessmentGoal } from "@/lib/commercialGoals";
import { isAssessmentGoal } from "@/lib/commercialGoals";
import { getCompetencyRoute } from "@/lib/competencyRouter";
import { type FitWeightMap, type ResolvedFitMatrix } from "@/lib/fitProfiles";
import { resolveFitMatrixServer } from "@/lib/serverFitProfiles";
import type {
  AttemptLike,
  CandidateProjectLike,
  CandidateRegistryAnalysis,
  CompetencyScore,
  DomainKey,
  DomainScores,
  FitSnapshot,
} from "@/lib/candidateAnalysis/types";
import { extractCandidateFeatures } from "@/lib/candidateAnalysis/featureExtractor";
import { scoreAllCompetencies } from "@/lib/candidateAnalysis/competencyScoring";
import {
  applyRegistryCalibrationToCompetencies,
  applyRegistryCalibrationToMatrix,
  registryCommentBlock,
} from "@/lib/candidateAnalysis/registryCalibration";

const DOMAIN_COMPETENCIES: Record<DomainKey, string[]> = {
  thinking: ["C01", "C02", "C03", "C04", "C05", "C06"],
  management: ["C19", "C25", "C26", "C27", "C28", "C29", "C30"],
  communication: ["C17", "C18", "C20", "C21", "C22", "C23", "C24", "C31"],
  selfOrganization: ["C07", "C08", "C09", "C10", "C15", "C16"],
  emotional: ["C11", "C12", "C13", "C14"],
  motivation: ["C09", "C10", "C05", "C14"],
};

const DOMAIN_LABELS: Record<DomainKey, string> = {
  thinking: "Мышление и решения",
  management: "Управление и влияние",
  communication: "Коммуникация и команда",
  selfOrganization: "Самоорганизация",
  emotional: "Эмоциональная устойчивость",
  motivation: "Мотивация и развитие",
};

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[], fallback = 55) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return fallback;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function goalForProject(project: CandidateProjectLike): AssessmentGoal {
  return isAssessmentGoal(project.goal) ? project.goal : "role_fit";
}

function scoreMap(competencies: CompetencyScore[]) {
  return new Map(competencies.map((item) => [item.id, item]));
}

function weightedAverage(matrix: ResolvedFitMatrix, competencies: CompetencyScore[]) {
  const map = scoreMap(competencies);
  const weighted = Object.entries(matrix.weights || {})
    .map(([id, weight]) => ({ id, weight: Number(weight) || 0, score: map.get(id)?.score }))
    .filter((item) => item.weight > 0 && Number.isFinite(item.score));

  if (!weighted.length) return average(competencies.map((item) => item.score), 55);
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  return weighted.reduce((sum, item) => sum + Number(item.score) * item.weight, 0) / Math.max(1, totalWeight);
}

function computeFitIndex(matrix: ResolvedFitMatrix, competencies: CompetencyScore[], attemptsCount: number) {
  const map = scoreMap(competencies);
  const weights = Object.entries(matrix.weights || {}).filter(([, weight]) => Number(weight) > 0);
  const covered = weights.filter(([id]) => map.has(id));
  const base = weightedAverage(matrix, competencies);
  const criticalPenalty = (matrix.critical || []).reduce((sum, id) => {
    const score = map.get(id)?.score ?? 52;
    if (score < 46) return sum + 10;
    if (score < 58) return sum + 5;
    if (score < 64) return sum + 2;
    return sum;
  }, 0);
  const coverageRatio = weights.length ? covered.length / weights.length : 0.7;
  const coveragePenalty = weights.length ? Math.round((1 - coverageRatio) * 9) : 0;
  const testsBonus = Math.min(5, attemptsCount * 0.7);
  const score = Math.round(clamp(35, base + testsBonus - criticalPenalty - coveragePenalty, 97));
  return score;
}

function scoreDomains(competencies: CompetencyScore[], weights?: FitWeightMap): DomainScores {
  const map = scoreMap(competencies);
  const scoreDomain = (ids: string[]) => {
    if (!weights) return average(ids.map((id) => map.get(id)?.score ?? NaN), 55);
    const weighted = ids
      .map((id) => ({ score: map.get(id)?.score, weight: Number(weights[id] || 1) }))
      .filter((item) => Number.isFinite(item.score));
    if (!weighted.length) return 55;
    return Math.round(weighted.reduce((sum, item) => sum + Number(item.score) * item.weight, 0) / weighted.reduce((sum, item) => sum + item.weight, 0));
  };

  return {
    thinking: scoreDomain(DOMAIN_COMPETENCIES.thinking),
    management: scoreDomain(DOMAIN_COMPETENCIES.management),
    communication: scoreDomain(DOMAIN_COMPETENCIES.communication),
    selfOrganization: scoreDomain(DOMAIN_COMPETENCIES.selfOrganization),
    emotional: scoreDomain(DOMAIN_COMPETENCIES.emotional),
    motivation: scoreDomain(DOMAIN_COMPETENCIES.motivation),
  };
}

function topCompetencies(competencies: CompetencyScore[], limit = 5) {
  return [...competencies]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => `${item.name} (${item.score}/100)`);
}

function riskCompetencies(matrix: ResolvedFitMatrix, competencies: CompetencyScore[], limit = 6) {
  const map = scoreMap(competencies);
  const criticalRisks = (matrix.critical || [])
    .map((id) => map.get(id))
    .filter(Boolean) as CompetencyScore[];
  const lowWithContra = competencies.filter((item) => item.score < 60 || item.contra.length);
  return [...criticalRisks, ...lowWithContra]
    .filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((item) => {
      const contra = item.contra[0]?.label;
      return `${item.name} (${item.score}/100)${contra ? ` — ${contra}` : ""}`;
    });
}

function bestFor(domains: DomainScores, competencies: CompetencyScore[]) {
  const sortedDomains = (Object.entries(domains) as Array<[DomainKey, number]>).sort((a, b) => b[1] - a[1]);
  const topDomain = sortedDomains[0];
  const secondDomain = sortedDomains[1];
  const routeHints = topCompetencies(competencies, 3).join(", ");
  const result: string[] = [];
  if (topDomain) result.push(`${DOMAIN_LABELS[topDomain[0]]}: ${topDomain[1]}/100`);
  if (secondDomain && secondDomain[1] >= 70) result.push(`${DOMAIN_LABELS[secondDomain[0]]}: ${secondDomain[1]}/100`);
  if (routeHints) result.push(`Ключевые опоры: ${routeHints}.`);
  return result;
}

function interviewQuestions(competencies: CompetencyScore[], matrix: ResolvedFitMatrix) {
  const map = scoreMap(competencies);
  const critical = (matrix.critical || []).map((id) => map.get(id)).filter(Boolean) as CompetencyScore[];
  return [...critical, ...competencies]
    .flatMap((item) => item.interviewQuestions.map((question) => `${item.name}: ${question}`))
    .filter(Boolean)
    .slice(0, 8);
}

function buildSnapshot(args: {
  label: string;
  matrix: ResolvedFitMatrix;
  competencies: CompetencyScore[];
  attemptsCount: number;
  calibrated?: boolean;
}): FitSnapshot {
  const domains = scoreDomains(args.competencies, args.calibrated ? args.matrix.weights : undefined);
  const index = computeFitIndex(args.matrix, args.competencies, args.attemptsCount);
  const strongest = topCompetencies(args.competencies, 6);
  const risks = riskCompetencies(args.matrix, args.competencies, 8);
  const weightedLabels = Object.entries(args.matrix.weights || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8)
    .map(([id, weight]) => `${getCompetencyRoute(id)?.name || id} ×${weight}`);

  return {
    index,
    label: args.label,
    matrix: args.matrix,
    domains,
    competencies: args.competencies,
    strengths: strongest,
    risks,
    bestFor: bestFor(domains, args.competencies),
    interviewQuestions: interviewQuestions(args.competencies, args.matrix),
    explanation: [
      `Матрица: ${args.matrix.label}.`,
      weightedLabels.length ? `Ключевые веса: ${weightedLabels.join(", ")}.` : "Ключевые веса не заданы явно.",
      ...(args.matrix.explanation || []),
    ],
  };
}

function buildDeltaCompetencies(before: CompetencyScore[], after: CompetencyScore[], reasons: Array<{ competencyId: string; reason: string }>) {
  const beforeMap = scoreMap(before);
  const reasonMap = new Map(reasons.map((item) => [item.competencyId, item.reason]));
  return after
    .map((item) => {
      const prev = beforeMap.get(item.id);
      const delta = item.score - (prev?.score ?? item.score);
      return {
        competencyId: item.id,
        name: item.name,
        before: prev?.score ?? item.score,
        after: item.score,
        delta,
        reason: reasonMap.get(item.id) || (delta ? "Изменение после Registry-калибровки." : "Без изменения."),
      };
    })
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function domainDelta(before: DomainScores, after: DomainScores): DomainScores {
  return {
    thinking: after.thinking - before.thinking,
    management: after.management - before.management,
    communication: after.communication - before.communication,
    selfOrganization: after.selfOrganization - before.selfOrganization,
    emotional: after.emotional - before.emotional,
    motivation: after.motivation - before.motivation,
  };
}

function candidateName(project: CandidateProjectLike) {
  return project.person_name?.trim() || project.title?.replace(/^[^·]+·\s*/, "").trim() || null;
}

function buildHumanSummary(analysis: Omit<CandidateRegistryAnalysis, "summary" | "comparisonLine">) {
  const name = analysis.candidate.name || "Кандидат";
  const delta = analysis.calibrated.index - analysis.baseline.index;
  const sign = delta > 0 ? `+${delta}` : String(delta);
  const intentLabels = analysis.registryCalibration.intents.map((item) => item.label).join(", ");
  const strongest = analysis.calibrated.bestFor.join("; ");
  const risk = analysis.calibrated.risks.slice(0, 3).join("; ");
  return [
    `${name}: baseline ${analysis.baseline.index}/100, с учётом Registry ${analysis.calibrated.index}/100 (${sign}).`,
    analysis.registryCalibration.hasComment
      ? `Комментарии Registry сдвинули фокус требований: ${intentLabels || "явный фокус не распознан"}.`
      : "Registry-комментариев нет, поэтому baseline и calibrated совпадают по требованиям.",
    strongest ? `Лучше всего читается: ${strongest}` : "Сильные стороны требуют дополнительной проверки.",
    risk ? `Главные риски: ${risk}` : "Критичных рисков по матрице не выявлено.",
  ].join("\n");
}

function comparisonLine(analysis: Omit<CandidateRegistryAnalysis, "summary" | "comparisonLine">) {
  const name = analysis.candidate.name || "Кандидат";
  const domains = Object.entries(analysis.calibrated.domains) as Array<[DomainKey, number]>;
  const top = domains.sort((a, b) => b[1] - a[1])[0];
  const weak = domains.sort((a, b) => a[1] - b[1])[0];
  return `${name}: ${analysis.calibrated.index}/100 после Registry. Сильнейший блок — ${top ? DOMAIN_LABELS[top[0]] : "—"}; зона внимания — ${weak ? DOMAIN_LABELS[weak[0]] : "—"}.`;
}

export async function buildCandidateRegistryAnalysis(args: {
  project: CandidateProjectLike;
  attempts: AttemptLike[];
  fitProfileId?: string | null;
  fitRequest?: string | null;
  includeRegistry?: boolean;
}): Promise<CandidateRegistryAnalysis> {
  const features = extractCandidateFeatures(args.attempts);
  const competencies = scoreAllCompetencies(features);
  const matrix = await resolveFitMatrixServer({
    goal: goalForProject(args.project),
    fitProfileId: args.fitProfileId || null,
    fitRequest: args.fitRequest || null,
    targetRole: args.project.target_role || null,
  });

  const baseline = buildSnapshot({
    label: "Без комментариев Registry",
    matrix,
    competencies,
    attemptsCount: args.attempts.length,
  });

  const registryCalibration = args.includeRegistry === false
    ? applyRegistryCalibrationToMatrix(matrix, null)
    : applyRegistryCalibrationToMatrix(matrix, args.project.registry_comment || null);
  const calibratedCompetencies = args.includeRegistry === false
    ? competencies
    : applyRegistryCalibrationToCompetencies(competencies, features, registryCalibration);

  const calibrated = buildSnapshot({
    label: registryCalibration.hasComment ? "С комментариями Registry" : "Без Registry-калибровки",
    matrix: registryCalibration.matrix,
    competencies: calibratedCompetencies,
    attemptsCount: args.attempts.length,
    calibrated: registryCalibration.hasComment,
  });

  const partial = {
    candidate: {
      projectId: args.project.id || null,
      name: candidateName(args.project),
      title: args.project.title,
      goal: args.project.goal,
      currentPosition: args.project.current_position || null,
      targetRole: args.project.target_role || null,
    },
    features,
    baseline,
    calibrated,
    delta: {
      index: calibrated.index - baseline.index,
      domains: domainDelta(baseline.domains, calibrated.domains),
      competencies: buildDeltaCompetencies(competencies, calibratedCompetencies, registryCalibration.competencyAdjustments),
    },
    registryCalibration,
  } satisfies Omit<CandidateRegistryAnalysis, "summary" | "comparisonLine">;

  return {
    ...partial,
    summary: buildHumanSummary(partial),
    comparisonLine: comparisonLine(partial),
  };
}

export function buildRegistryCommentContext(project: Pick<CandidateProjectLike, "registry_comment">) {
  return registryCommentBlock(project.registry_comment || null);
}

export { DOMAIN_COMPETENCIES, DOMAIN_LABELS };
