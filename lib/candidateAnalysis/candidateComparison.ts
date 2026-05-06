import type { AttemptLike, CandidateProjectLike } from "@/lib/candidateAnalysis/types";
import { buildCandidateRegistryAnalysis } from "@/lib/candidateAnalysis/candidateReport";
import type { CandidateRegistryAnalysis, CompetencyScore, DomainKey } from "@/lib/candidateAnalysis/types";
import { getCompetencyRoutes } from "@/lib/competencyRouter";

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
      ? `Общий лидер по итоговому индексу: ${overallLeader.name} (${overallLeader.calibrated_index}/100).`
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

function averageSelectedCompetencies(analysis: CandidateRegistryAnalysis, selectedCompetencyIds: readonly string[]) {
  if (!selectedCompetencyIds.length) return analysis.calibrated.index;
  const scores = selectedCompetencyIds
    .map((id) => analysis.calibrated.competencies.find((item) => item.id === id)?.score)
    .filter((value): value is number => Number.isFinite(value));
  if (!scores.length) return analysis.calibrated.index;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length));
}

function buildCandidateDifferentiator(analysis: CandidateRegistryAnalysis, selectedCompetencyIds: readonly string[]) {
  const source = selectedCompetencyIds.length
    ? analysis.calibrated.competencies.filter((item) => selectedCompetencyIds.includes(item.id))
    : analysis.calibrated.competencies;
  const strong = [...source]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.name.toLowerCase());
  const risk = [...source]
    .sort((a, b) => a.score - b.score)
    .slice(0, 1)
    .map((item) => item.name.toLowerCase())[0];
  const parts: string[] = [];
  if (strong.length) {
    parts.push(`Сильнее всего выделяется по ${strong.join(" и ")}.`);
  }
  if (risk) {
    parts.push(`Требует дополнительной проверки по блоку «${risk}».`);
  }
  return parts.join(" ");
}

function stripCodeFences(value: string) {
  return String(value || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function callDeepseek(system: string, prompt: string, maxTokens = 1800) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const r = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  const j = await r.json().catch(() => null);
  const text = j?.choices?.[0]?.message?.content;
  if (!r.ok || !text) throw new Error(j?.error?.message || `DeepSeek error (${r.status})`);
  return stripCodeFences(String(text));
}

function buildAssemblyAiFallback(args: {
  analyses: CandidateRegistryAnalysis[];
  ranking: Array<{ project_id?: string | null; name: string; calibrated_index: number; baseline_index: number; focus_score: number; main_risks: string[]; best_for: string[] }>;
  selectedCompetencyIds: readonly string[];
}) {
  const winner = args.ranking[0] || null;
  const selectedRoutes = getCompetencyRoutes(args.selectedCompetencyIds);
  return {
    best_candidate_ai: winner ? {
      winner_name: winner.name,
      winner_project_id: winner.project_id || null,
      summary: selectedRoutes.length
        ? `${winner.name} выглядит наиболее сильным кандидатом по выбранному фокусу: ${selectedRoutes.map((item) => item.name).join(", ")}.`
        : `${winner.name} выглядит наиболее сильным кандидатом по общей силе профиля и устойчивости результатов.`,
      rationale: winner.best_for?.slice(0, 2).join(" ") || "Лидирует по совокупности сильных сторон и итоговому индексу.",
    } : null,
    candidate_briefs: args.analyses.map((analysis) => ({
      project_id: analysis.candidate.projectId || null,
      name: candidateName(analysis),
      summary: buildCandidateDifferentiator(analysis, args.selectedCompetencyIds),
    })),
  };
}

async function buildAssemblyAiInsights(args: {
  analyses: CandidateRegistryAnalysis[];
  ranking: Array<{ project_id?: string | null; name: string; calibrated_index: number; baseline_index: number; focus_score: number; main_risks: string[]; best_for: string[] }>;
  selectedCompetencyIds: readonly string[];
  fitRequest?: string | null;
}) {
  const fallback = buildAssemblyAiFallback(args);
  const selectedRoutes = getCompetencyRoutes(args.selectedCompetencyIds);
  const winner = args.ranking[0] || null;
  const candidatesBlock = args.analyses.map((analysis) => {
    const topCompetencies = [...analysis.calibrated.competencies]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => `${item.name} (${item.score}/100)`)
      .join(", ");
    const riskCompetencies = [...analysis.calibrated.competencies]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((item) => `${item.name} (${item.score}/100)`)
      .join(", ");
    const focusText = selectedRoutes.length
      ? selectedRoutes
        .map((route) => {
          const current = analysis.calibrated.competencies.find((item) => item.id === route.id);
          return current ? `${route.name}: ${current.score}/100` : null;
        })
        .filter(Boolean)
        .join(", ")
      : "Фокус по компетенциям не задан.";
    return [
      `${candidateName(analysis)}`,
      `Итоговый индекс: ${analysis.calibrated.index}/100. Базовый индекс: ${analysis.baseline.index}/100.`,
      `Лучшие стороны: ${analysis.calibrated.strengths.slice(0, 4).join(", ")}.`,
      `Риски: ${analysis.calibrated.risks.slice(0, 3).join(", ")}.`,
      `Фокусные компетенции: ${focusText}`,
      `Топ-компетенции: ${topCompetencies}.`,
      `Слабее всего: ${riskCompetencies}.`,
    ].join("\n");
  }).join("\n\n---\n\n");
  const prompt = [
    "Ты оцениваешь нескольких кандидатов внутри одной папки и должен выбрать лучшего под должность.",
    args.fitRequest ? `Целевая должность или запрос специалиста: ${args.fitRequest}.` : "Отдельная должность не указана: опирайся на общий профессиональный профиль и выбранные компетенции.",
    selectedRoutes.length
      ? `Выбранные компетенции для сравнения: ${selectedRoutes.map((item) => item.name).join(", ")}.`
      : "Явный набор компетенций не выбран: сравнивай по общей силе профиля и устойчивости результатов.",
    winner ? `Текущий лидер rule-based ранжирования: ${winner.name} (${winner.focus_score}/100 по фокусному сравнению).` : "",
    "",
    "Данные по кандидатам:",
    candidatesBlock,
    "",
    "Верни JSON строго такого вида:",
    '{"winner_name":"...","winner_project_id":"...","summary":"...","rationale":"...","candidate_briefs":[{"name":"...","project_id":"...","summary":"..."}]}',
    "Требования:",
    "- Пиши по-русски.",
    "- winner_name и summary должны прямо отвечать, кто лучший кандидат под должность и почему.",
    "- summary: 2-3 предложения максимум.",
    "- rationale: 2-4 коротких предложения, только по данным.",
    "- candidate_briefs: по каждому кандидату 2-3 предложения максимум, чем он отличается от остальных.",
    "- Не используй психиатрические диагнозы.",
    "- Если вывод гипотетический, прямо помечай это как гипотезу.",
  ].filter(Boolean).join("\n");

  try {
    const text = await callDeepseek(
      "Ты HR-аналитик. Сравниваешь кандидатов строго по данным тестов и компетенций, без воды и без выдуманных фактов.",
      prompt
    );
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    const candidateBriefs = Array.isArray(parsed?.candidate_briefs) ? parsed.candidate_briefs : [];
    return {
      best_candidate_ai: parsed?.winner_name ? {
        winner_name: String(parsed.winner_name),
        winner_project_id: parsed?.winner_project_id ? String(parsed.winner_project_id) : null,
        summary: String(parsed?.summary || ""),
        rationale: String(parsed?.rationale || ""),
      } : fallback.best_candidate_ai,
      candidate_briefs: candidateBriefs.length
        ? candidateBriefs.map((item: any) => ({
          project_id: item?.project_id ? String(item.project_id) : null,
          name: String(item?.name || ""),
          summary: String(item?.summary || ""),
        }))
        : fallback.candidate_briefs,
    };
  } catch {
    return fallback;
  }
}

export async function buildCandidateComparison(args: {
  candidates: CandidateComparisonInput[];
  fitProfileId?: string | null;
  fitRequest?: string | null;
  includeRegistry?: boolean;
  selectedCompetencyIds?: readonly string[] | null;
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

  const selectedCompetencyIds = (args.selectedCompetencyIds || []).filter(Boolean);
  const ranking = analyses
    .map((analysis) => ({
      project_id: analysis.candidate.projectId,
      name: analysis.candidate.name || analysis.candidate.title,
      baseline_index: analysis.baseline.index,
      calibrated_index: analysis.calibrated.index,
      focus_score: averageSelectedCompetencies(analysis, selectedCompetencyIds),
      delta: analysis.delta.index,
      best_for: analysis.calibrated.bestFor,
      main_risks: analysis.calibrated.risks.slice(0, 4),
      comparison_line: selectedCompetencyIds.length
        ? buildCandidateDifferentiator(analysis, selectedCompetencyIds)
        : analysis.comparisonLine,
    }))
    .sort((a, b) => b.focus_score - a.focus_score || b.calibrated_index - a.calibrated_index || b.baseline_index - a.baseline_index);

  const domain_leaders = buildDomainLeaders(analyses);
  const competency_leaders = buildCompetencyLeaders(analyses);
  const candidate_strength_map = buildCandidateStrengthMap(analyses);
  const winner_board = buildWinnerBoard(ranking, domain_leaders, competency_leaders);
  const leader = ranking[0];
  const selectedRoutes = getCompetencyRoutes(selectedCompetencyIds);
  const summary = leader
    ? selectedRoutes.length
      ? `Лидер по выбранным компетенциям: ${leader.name} (${leader.focus_score}/100 по фокусному сравнению). Итоговый индекс: ${leader.calibrated_index}/100. Базовый индекс: ${leader.baseline_index}/100, изменение после калибровки требований: ${leader.delta > 0 ? `+${leader.delta}` : leader.delta}.`
      : `Лидер по итоговому индексу: ${leader.name} (${leader.calibrated_index}/100). Базовый индекс: ${leader.baseline_index}/100, изменение после калибровки требований: ${leader.delta > 0 ? `+${leader.delta}` : leader.delta}.`
    : "Нет кандидатов для сравнения.";
  const competency_summary = buildCompetencySummary(ranking, winner_board, domain_leaders, competency_leaders);
  const aiInsights = await buildAssemblyAiInsights({
    analyses,
    ranking,
    selectedCompetencyIds,
    fitRequest: args.fitRequest || null,
  });

  return {
    ranking,
    domain_leaders,
    competency_leaders,
    candidate_strength_map,
    winner_board,
    analyses,
    summary,
    competency_summary,
    selected_competency_ids: selectedCompetencyIds,
    selected_competency_label: selectedRoutes.length ? selectedRoutes.map((item) => item.name).join(", ") : "",
    best_candidate_ai: aiInsights.best_candidate_ai,
    candidate_briefs: aiInsights.candidate_briefs,
  };
}
