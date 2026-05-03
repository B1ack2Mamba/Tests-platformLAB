import type { AttemptLike, CandidateProjectLike } from "@/lib/candidateAnalysis/types";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";

export type CandidateComparisonInput = {
  project: CandidateProjectLike;
  attempts: AttemptLike[];
};

export async function buildCandidateComparison(args: {
  candidates: CandidateComparisonInput[];
  fitProfileId?: string | null;
  fitRequest?: string | null;
  includeRegistry?: boolean;
}) {
  const analyses = await Promise.all(
    args.candidates.map((item) =>
      buildCandidateRegistryAnalysis({
        project: item.project,
        attempts: item.attempts,
        fitProfileId: args.fitProfileId || null,
        fitRequest: args.fitRequest || null,
        includeRegistry: args.includeRegistry !== false,
      })
    )
  );

  const ranking = analyses
    .map((analysis) => ({
      project_id: analysis.candidate.projectId,
      name: analysis.candidate.name || analysis.candidate.title,
      baseline_index: analysis.baseline.index,
      calibrated_index: analysis.calibrated.index,
      delta: analysis.delta.index,
      best_for: analysis.calibrated.bestFor,
      main_risks: analysis.calibrated.risks.slice(0, 4),
      comparison_line: analysis.comparisonLine,
    }))
    .sort((a, b) => b.calibrated_index - a.calibrated_index || b.baseline_index - a.baseline_index);

  const leader = ranking[0];
  const summary = leader
    ? `Лидер по calibrated index: ${leader.name} (${leader.calibrated_index}/100). Baseline: ${leader.baseline_index}/100, изменение после Registry: ${leader.delta > 0 ? `+${leader.delta}` : leader.delta}.`
    : "Нет кандидатов для сравнения.";

  return {
    ranking,
    analyses,
    summary,
  };
}
