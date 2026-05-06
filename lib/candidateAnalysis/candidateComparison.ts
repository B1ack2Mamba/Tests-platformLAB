import type { AttemptLike, CandidateProjectLike } from "@/lib/candidateAnalysis/types";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";
import type { CandidateRegistryAnalysis, CompetencyScore, DomainKey } from "@/lib/candidateAnalysis/types";

export type CandidateComparisonInput = {
  project: CandidateProjectLike;
  attempts: AttemptLike[];
};

const DOMAIN_LABELS: Record<DomainKey, string> = {
  thinking: "Мышление и решения",
  management: "Управление и влияние",
  communication: "Коммуникация и команда",
  selfOrganization: "Самоорганизация",
  emotional: "Эмоциональная устойчивость",
  motivation: "Мотивация и развитие",
};

function candidateName(analysis: CandidateRegistryAnalysis) {
  return analysis.candidate.name || analysis.candidate.title || "Кандидат";
}

function scoreGap(first?: number | null, second?: number | null) {
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return Math.round(Number(first) - Number(second));
}

function classifyLead(gap: number | null) {
  if (gap == null) return "solo";
  if (gap >= 8) return "clear";
  if (gap >= 4) return "solid";
  if (gap >= 1) return "tight";
  return "shared";
}

function topDomainEntries(analysis: CandidateRegistryAnalysis, limit = 2) {
  return (Object.entries(analysis.calibrated.domains) as Array<[DomainKey, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, score]) => ({
      key,
      label: DOMAIN_LABELS[key],
      score,
    }));
}

function buildDomainLeaders(analyses: CandidateRegistryAnalysis[]) {
  return (Object.keys(DOMAIN_LABELS) as DomainKey[]).map((domain) => {
    const ranked = analyses
      .map((analysis) => ({
        project_id: analysis.candidate.projectId,
        name: candidateName(analysis),
        score: analysis.calibrated.domains[domain],
      }))
      .sort((a, b) => b.score - a.score);
    const leader = ranked[0] || null;
    const runnerUp = ranked[1] || null;
    const gap = scoreGap(leader?.score, runnerUp?.score);
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      leader_project_id: leader?.project_id || null,
      leader_name: leader?.name || null,
      leader_score: leader?.score ?? null,
      runner_up_project_id: runnerUp?.project_id || null,
      runner_up_name: runnerUp?.name || null,
      runner_up_score: runnerUp?.score ?? null,
      gap,
      lead_type: classifyLead(gap),
      top_three: ranked.slice(0, 3),
    };
  });
}

function buildCompetencyLeaders(analyses: CandidateRegistryAnalysis[]) {
  const competencyMap = new Map<string, { id: string; name: string; cluster: string }>();
  for (const analysis of analyses) {
    for (const item of analysis.calibrated.competencies) {
      if (!competencyMap.has(item.id)) {
        competencyMap.set(item.id, { id: item.id, name: item.name, cluster: item.cluster });
      }
    }
  }

  return Array.from(competencyMap.values())
    .map((competency) => {
      const ranked = analyses
        .map((analysis) => {
          const current = analysis.calibrated.competencies.find((item) => item.id === competency.id) as CompetencyScore | undefined;
          return {
            project_id: analysis.candidate.projectId,
            name: candidateName(analysis),
            score: current?.score ?? 0,
            level: current?.level || "low",
            confidence: current?.confidence || "low",
          };
        })
        .sort((a, b) => b.score - a.score);
      const leader = ranked[0] || null;
      const runnerUp = ranked[1] || null;
      const gap = scoreGap(leader?.score, runnerUp?.score);
      return {
        competency_id: competency.id,
        competency_name: competency.name,
        competency_cluster: competency.cluster,
        leader_project_id: leader?.project_id || null,
        leader_name: leader?.name || null,
        leader_score: leader?.score ?? null,
        leader_level: leader?.level || null,
        leader_confidence: leader?.confidence || null,
        runner_up_project_id: runnerUp?.project_id || null,
        runner_up_name: runnerUp?.name || null,
        runner_up_score: runnerUp?.score ?? null,
        gap,
        lead_type: classifyLead(gap),
        top_three: ranked.slice(0, 3),
      };
    })
    .sort((a, b) => {
      const scoreDelta = (b.leader_score ?? 0) - (a.leader_score ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return (b.gap ?? -1) - (a.gap ?? -1);
    });
}

function buildCandidateStrengthMap(analyses: CandidateRegistryAnalysis[]) {
  return analyses
    .map((analysis) => {
      const strongestCompetencies = [...analysis.calibrated.competencies]
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((item) => ({
          competency_id: item.id,
          competency_name: item.name,
          score: item.score,
          level: item.level,
        }));
      return {
        project_id: analysis.candidate.projectId,
        name: candidateName(analysis),
        calibrated_index: analysis.calibrated.index,
        strongest_domains: topDomainEntries(analysis, 2),
        strongest_competencies: strongestCompetencies,
      };
    })
    .sort((a, b) => b.calibrated_index - a.calibrated_index);
}

function buildWinnerBoard(
  ranking: Array<{ project_id?: string | null; name: string; calibrated_index: number; baseline_index: number; delta: number }>,
  domainLeaders: ReturnType<typeof buildDomainLeaders>,
  competencyLeaders: ReturnType<typeof buildCompetencyLeaders>
) {
  const board = new Map<string, {
    project_id: string | null;
    name: string;
    calibrated_index: number;
    baseline_index: number;
    total_wins: number;
    domain_wins: number;
    competency_wins: number;
    lead_competencies: string[];
    lead_domains: string[];
  }>();

  for (const item of ranking) {
    const key = `${item.project_id || item.name}`;
    board.set(key, {
      project_id: item.project_id || null,
      name: item.name,
      calibrated_index: item.calibrated_index,
      baseline_index: item.baseline_index,
      total_wins: 0,
      domain_wins: 0,
      competency_wins: 0,
      lead_competencies: [],
      lead_domains: [],
    });
  }

  for (const domain of domainLeaders) {
    if (!domain.leader_name) continue;
    const key = `${domain.leader_project_id || domain.leader_name}`;
    const current = board.get(key);
    if (!current) continue;
    current.total_wins += 1;
    current.domain_wins += 1;
    current.lead_domains.push(domain.label);
  }

  for (const competency of competencyLeaders) {
    if (!competency.leader_name) continue;
    const key = `${competency.leader_project_id || competency.leader_name}`;
    const current = board.get(key);
    if (!current) continue;
    current.total_wins += 1;
    current.competency_wins += 1;
    if (current.lead_competencies.length < 10) {
      current.lead_competencies.push(`${competency.competency_name} (${competency.leader_score}/100)`);
    }
  }

  return Array.from(board.values()).sort((a, b) => {
    if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
    return b.calibrated_index - a.calibrated_index;
  });
}

function buildCompetencySummary(
  ranking: Array<{ name: string; calibrated_index: number }>,
  winnerBoard: ReturnType<typeof buildWinnerBoard>,
  domainLeaders: ReturnType<typeof buildDomainLeaders>,
  competencyLeaders: ReturnType<typeof buildCompetencyLeaders>
) {
  const overallLeader = ranking[0] || null;
  const winnerLeader = winnerBoard[0] || null;
  const standoutCompetencies = competencyLeaders
    .filter((item) => (item.leader_score ?? 0) >= 74)
    .slice(0, 6)
    .map((item) => `${item.competency_name}: ${item.leader_name} (${item.leader_score}/100)`);
  const standoutDomains = domainLeaders
    .slice()
    .sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1))
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.leader_name} (${item.leader_score}/100)`);

  return [
    overallLeader
      ? `Общий лидер по calibrated index: ${overallLeader.name} (${overallLeader.calibrated_index}/100).`
      : "Лидер по общему индексу пока не определён.",
    winnerLeader
      ? `По количеству лидерских позиций сильнее всего выглядит ${winnerLeader.name}: ${winnerLeader.total_wins} первых мест, из них ${winnerLeader.domain_wins} по доменам и ${winnerLeader.competency_wins} по отдельным компетенциям.`
      : "Лидерские позиции по компетенциям пока не сформированы.",
    standoutDomains.length
      ? `Самые заметные блоки лидерства: ${standoutDomains.join("; ")}.`
      : "Явных лидеров по доменам пока нет.",
    standoutCompetencies.length
      ? `Выраженные лидеры по компетенциям: ${standoutCompetencies.join("; ")}.`
      : "Выраженных лидеров по отдельным компетенциям пока нет.",
  ].join(" ");
}

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

  const domain_leaders = buildDomainLeaders(analyses);
  const competency_leaders = buildCompetencyLeaders(analyses);
  const candidate_strength_map = buildCandidateStrengthMap(analyses);
  const winner_board = buildWinnerBoard(ranking, domain_leaders, competency_leaders);
  const leader = ranking[0];
  const summary = leader
    ? `Лидер по calibrated index: ${leader.name} (${leader.calibrated_index}/100). Baseline: ${leader.baseline_index}/100, изменение после Registry: ${leader.delta > 0 ? `+${leader.delta}` : leader.delta}.`
    : "Нет кандидатов для сравнения.";
  const competency_summary = buildCompetencySummary(ranking, winner_board, domain_leaders, competency_leaders);

  return {
    ranking,
    domain_leaders,
    competency_leaders,
    candidate_strength_map,
    winner_board,
    analyses,
    summary,
    competency_summary,
  };
}
