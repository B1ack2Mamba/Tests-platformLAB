import { buildDefaultCompetencyPromptRows, type CompetencyPromptRow } from "@/lib/competencyPrompts";
import { getGoalDefinition } from "@/lib/commercialGoals";
import {
  getCompetenciesForGoal,
  getCompetencyLongLabel,
  getCompetencyRecommendedTests,
  getCompetencyRoutes,
} from "@/lib/competencyRouter";
import { getTestDisplayTitle } from "@/lib/testTitles";
import type { ProjectRoutingMeta } from "@/lib/projectRoutingMeta";

export type ResultsBlueprintPromptSource = "custom" | "default" | "disabled" | "missing";
export type ResultsBlueprintTone = "ready" | "neutral" | "attention" | "muted";

export type ResultsBlueprintTestNode = {
  id: string;
  slug: string;
  title: string;
  completed: boolean;
  signal: number | null;
  summary: string;
  badges: string[];
};

export type ResultsBlueprintCompetencyNode = {
  id: string;
  competencyId: string;
  title: string;
  cluster: string;
  score: number;
  status: string;
  short: string;
  details: string;
  promptSource: ResultsBlueprintPromptSource;
  promptLabel: string;
  promptNotes: boolean;
  promptActive: boolean;
  testIds: string[];
  testTitles: string[];
  badges: string[];
  fitGate: string;
};

export type ResultsBlueprintBridgeNode = {
  id: string;
  title: string;
  tone: ResultsBlueprintTone;
  text: string;
  competencyIds: string[];
};

export type ResultsBlueprintFinalNode = {
  id: string;
  title: string;
  tone: ResultsBlueprintTone;
  text: string;
  bridgeIds: string[];
};

export type ResultsBlueprintLink = {
  from: string;
  to: string;
  tone: ResultsBlueprintTone;
};

export type ResultsBlueprintPromptCoverage = {
  total: number;
  custom: number;
  default: number;
  disabled: number;
  missing: number;
};

export type ResultsBlueprintSummary = {
  goalLabel: string;
  focusLabel: string;
  routeMode: "goal" | "competency";
  promptCoverage: ResultsBlueprintPromptCoverage;
  strongest: string[];
  attention: string[];
  finalLabel: string;
  finalText: string;
};

export type ResultsBlueprint = {
  summary: ResultsBlueprintSummary;
  tests: ResultsBlueprintTestNode[];
  competencies: ResultsBlueprintCompetencyNode[];
  bridges: ResultsBlueprintBridgeNode[];
  final: ResultsBlueprintFinalNode;
  links: ResultsBlueprintLink[];
};

export type ResultsBlueprintProjectInput = {
  title: string;
  goal: string;
  target_role?: string | null;
  current_position?: string | null;
  routing_meta?: ProjectRoutingMeta | null;
};

export type ResultsBlueprintTestInput = {
  test_slug: string;
  test_title?: string | null;
  sort_order?: number | null;
};

export type ResultsBlueprintAttemptInput = {
  test_slug: string;
  test_title?: string | null;
  result?: any;
};

type PromptRowLike = Pick<CompetencyPromptRow, "competency_id" | "system_prompt" | "prompt_template" | "notes" | "is_active">;

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rowsFromResult(result: any) {
  return Array.isArray(result?.ranked) ? result.ranked : [];
}

function getTopLabels(result: any, limit = 3) {
  return rowsFromResult(result)
    .slice(0, limit)
    .map((row: any) => String(row?.style || row?.tag || "показатель").trim())
    .filter(Boolean);
}

function extractSignal(result: any) {
  const rows = rowsFromResult(result);
  if (!rows.length) return 55;
  const values = rows.slice(0, 4).map((row: any) => {
    if (row?.percent != null) return Number(row.percent);
    if (row?.count != null) return Math.max(0, Math.min(100, Number(row.count) * 10));
    return 50;
  });
  return values.reduce((sum: number, value: number) => sum + value, 0) / values.length;
}

function describeStatus(score: number) {
  if (score >= 74) return { label: "Сильное совпадение", tone: "сильная опора" };
  if (score >= 60) return { label: "Рабочее совпадение", tone: "рабочая опора" };
  if (score >= 48) return { label: "Неустойчиво", tone: "смешанный сигнал" };
  return { label: "Зона риска", tone: "есть заметные ограничения" };
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildFocusCompetencyIds(project: ResultsBlueprintProjectInput, attempts: ResultsBlueprintAttemptInput[]) {
  const explicit = project.routing_meta?.mode === "competency" ? project.routing_meta.competencyIds || [] : [];
  if (explicit.length) return explicit;

  const availableSlugs = Array.from(new Set(attempts.map((item) => String(item.test_slug || "")).filter(Boolean)));
  return getCompetenciesForGoal(project.goal as any)
    .map((item) => {
      const relevantSlugs = getCompetencyRecommendedTests([item.id], availableSlugs, "standard");
      const overlap = relevantSlugs.filter((slug) => availableSlugs.includes(slug)).length;
      return { id: item.id, overlap };
    })
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return a.id.localeCompare(b.id, "ru");
    })
    .slice(0, 6)
    .map((item) => item.id);
}

function resolvePromptSource(routeId: string, dbMap: Map<string, PromptRowLike>, defaultsMap: Map<string, CompetencyPromptRow>) {
  const fallback = defaultsMap.get(routeId) || null;
  const stored = dbMap.get(routeId) || null;
  const fallbackSystem = normalizeText(fallback?.system_prompt);
  const fallbackTemplate = normalizeText(fallback?.prompt_template);
  const storedSystem = normalizeText(stored?.system_prompt);
  const storedTemplate = normalizeText(stored?.prompt_template);
  const storedNotes = normalizeText(stored?.notes);

  if (stored?.is_active === false) {
    return {
      source: "disabled" as const,
      label: "Prompt отключён",
      promptNotes: Boolean(storedNotes),
      promptActive: false,
    };
  }

  if (stored) {
    const customDiffers =
      (storedSystem && storedSystem !== fallbackSystem) ||
      (storedTemplate && storedTemplate !== fallbackTemplate) ||
      Boolean(storedNotes);

    if (customDiffers) {
      return {
        source: "custom" as const,
        label: storedNotes ? "Индивидуальный prompt + заметки" : "Индивидуальный prompt",
        promptNotes: Boolean(storedNotes),
        promptActive: true,
      };
    }
  }

  if (fallback && (fallbackSystem || fallbackTemplate)) {
    return {
      source: "default" as const,
      label: "Базовый prompt",
      promptNotes: Boolean(normalizeText(fallback.notes)),
      promptActive: true,
    };
  }

  return {
    source: "missing" as const,
    label: "Prompt не задан",
    promptNotes: false,
    promptActive: false,
  };
}

function toneFromPromptSource(source: ResultsBlueprintPromptSource): ResultsBlueprintTone {
  switch (source) {
    case "custom":
      return "ready";
    case "default":
      return "neutral";
    case "disabled":
    case "missing":
      return "attention";
    default:
      return "muted";
  }
}

function formatTestSummary(signal: number, topLabels: string[]) {
  const labels = topLabels.slice(0, 2).join(", ");
  if (labels) return `${Math.round(signal)}/100 · ${labels}`;
  return `${Math.round(signal)}/100 · сигнал сохранён`;
}

export function buildProjectResultsBlueprint(args: {
  project: ResultsBlueprintProjectInput;
  tests: ResultsBlueprintTestInput[];
  attempts: ResultsBlueprintAttemptInput[];
  promptRows?: PromptRowLike[];
}) {
  const { project, tests, attempts } = args;
  const defaultPromptRows = buildDefaultCompetencyPromptRows();
  const defaultsMap = new Map<string, CompetencyPromptRow>(defaultPromptRows.map((item) => [item.competency_id, item] as const));
  const dbMap = new Map<string, PromptRowLike>((args.promptRows || []).map((item) => [item.competency_id, item] as const));

  const testsBySlug = new Map(
    tests
      .map((item, index) => ({
        ...item,
        sort_order: typeof item.sort_order === "number" ? item.sort_order : index,
      }))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((item) => [item.test_slug, item] as const)
  );
  const attemptsBySlug = new Map(attempts.map((item) => [item.test_slug, item] as const));

  const testNodes: ResultsBlueprintTestNode[] = Array.from(testsBySlug.values()).map((test) => {
    const attempt = attemptsBySlug.get(test.test_slug);
    const signal = attempt?.result ? extractSignal(attempt.result) : null;
    const badges = attempt?.result ? getTopLabels(attempt.result, 3) : [];
    return {
      id: `test:${test.test_slug}`,
      slug: test.test_slug,
      title: getTestDisplayTitle(test.test_slug, test.test_title),
      completed: Boolean(attempt?.result),
      signal: signal != null ? Math.round(signal) : null,
      summary: attempt?.result ? formatTestSummary(signal || 0, badges) : "Ожидаем прохождение",
      badges,
    };
  });

  const focusIds = buildFocusCompetencyIds(project, attempts);
  const availableSlugs = Array.from(new Set(attempts.map((item) => item.test_slug).filter(Boolean)));
  const competencyNodes: ResultsBlueprintCompetencyNode[] = getCompetencyRoutes(focusIds)
    .map((route) => {
      const relevantSlugs = getCompetencyRecommendedTests([route.id], availableSlugs, "standard");
      const relevantAttempts = attempts.filter((item) => relevantSlugs.includes(item.test_slug));
      const avgSignal = relevantAttempts.length
        ? relevantAttempts.map((item) => extractSignal(item.result)).reduce((sum, value) => sum + value, 0) / relevantAttempts.length
        : 52;
      const coverageBoost = Math.min(6, relevantAttempts.length * 2);
      const score = Math.round(clamp(35, avgSignal + coverageBoost, 95));
      const statusInfo = describeStatus(score);
      const evidence = [...new Set(relevantAttempts.flatMap((item) => getTopLabels(item.result, 2)))].slice(0, 4);
      const promptInfo = resolvePromptSource(route.id, dbMap, defaultsMap);
      const profileLink = normalizeText(project.target_role) || normalizeText(project.current_position) || getGoalDefinition(project.goal as any)?.shortTitle || project.goal;
      const short = `${statusInfo.tone}; опора: ${evidence.length ? evidence.join(", ") : "данные тестов"}.`;
      const details = [
        `${statusInfo.label}: ${score}/100.`,
        `Методики: ${relevantAttempts.map((item) => getTestDisplayTitle(item.test_slug, item.test_title)).join(", ") || "нужные тесты ещё не завершены"}.`,
        evidence.length ? `Повторяющиеся сигналы: ${evidence.join(", ")}.` : "Повторяющиеся сигналы пока не проявились явно.",
        `Как читать для текущего ориентира (${profileLink}): ${route.fitGate}`,
      ].join("\n\n");

      return {
        id: `competency:${route.id}`,
        competencyId: route.id,
        title: route.name,
        cluster: route.cluster,
        score,
        status: statusInfo.label,
        short,
        details,
        promptSource: promptInfo.source,
        promptLabel: promptInfo.label,
        promptNotes: promptInfo.promptNotes,
        promptActive: promptInfo.promptActive,
        testIds: relevantSlugs.map((slug) => `test:${slug}`),
        testTitles: relevantAttempts.map((item) => getTestDisplayTitle(item.test_slug, item.test_title)),
        badges: evidence,
        fitGate: route.fitGate,
      } satisfies ResultsBlueprintCompetencyNode;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title, "ru");
    })
    .slice(0, 8);

  const promptCoverage: ResultsBlueprintPromptCoverage = {
    total: competencyNodes.length,
    custom: competencyNodes.filter((item) => item.promptSource === "custom").length,
    default: competencyNodes.filter((item) => item.promptSource === "default").length,
    disabled: competencyNodes.filter((item) => item.promptSource === "disabled").length,
    missing: competencyNodes.filter((item) => item.promptSource === "missing").length,
  };

  const strongestNodes = [...competencyNodes].sort((a, b) => b.score - a.score).slice(0, 3);
  const attentionNodes = [...competencyNodes]
    .sort((a, b) => {
      const aWeight = a.promptSource === "disabled" || a.promptSource === "missing" ? 2 : a.promptSource === "default" ? 1 : 0;
      const bWeight = b.promptSource === "disabled" || b.promptSource === "missing" ? 2 : b.promptSource === "default" ? 1 : 0;
      if (bWeight !== aWeight) return bWeight - aWeight;
      return a.score - b.score;
    })
    .slice(0, 3);

  const focusLabel = project.routing_meta?.mode === "competency" && project.routing_meta.competencyIds?.length
    ? getCompetencyLongLabel(project.routing_meta.competencyIds)
    : getGoalDefinition(project.goal as any)?.shortTitle || project.goal;

  const bridges: ResultsBlueprintBridgeNode[] = [
    {
      id: "bridge:strong",
      title: "Сильные сигналы",
      tone: strongestNodes.length ? "ready" : "muted",
      text: strongestNodes.length
        ? `Сильнее всего сейчас читаются ${strongestNodes.map((item) => `${item.title} (${item.score}/100)`).join(", ")}.`
        : "Сильные сигналы появятся после завершения ключевых тестов.",
      competencyIds: strongestNodes.map((item) => item.id),
    },
    {
      id: "bridge:attention",
      title: "Зоны внимания",
      tone: attentionNodes.some((item) => item.promptSource === "disabled" || item.promptSource === "missing") || attentionNodes.some((item) => item.score < 58)
        ? "attention"
        : "neutral",
      text: attentionNodes.length
        ? attentionNodes
            .map((item) => `${item.title}: ${item.promptLabel.toLowerCase()}, ${item.score}/100`)
            .join(" · ")
        : "Критичных провалов не видно — карта читается ровно.",
      competencyIds: attentionNodes.map((item) => item.id),
    },
    {
      id: "bridge:prompts",
      title: "Карта промтов",
      tone: promptCoverage.disabled || promptCoverage.missing ? "attention" : promptCoverage.default ? "neutral" : "ready",
      text: `Индивидуальных: ${promptCoverage.custom}/${promptCoverage.total}. Базовых: ${promptCoverage.default}. Выключено: ${promptCoverage.disabled}. Пустых: ${promptCoverage.missing}.`,
      competencyIds: competencyNodes.map((item) => item.id),
    },
  ];

  const finalTone: ResultsBlueprintTone = promptCoverage.disabled || promptCoverage.missing ? "attention" : promptCoverage.default ? "neutral" : "ready";
  const roleLabel = normalizeText(project.target_role) || getGoalDefinition(project.goal as any)?.shortTitle || project.goal;
  const finalText = [
    `Контур собран под ориентир «${roleLabel}».`,
    strongestNodes.length ? `Основная опора: ${strongestNodes.map((item) => item.title).join(", ")}.` : "Опорные сигналы ещё копятся.",
    promptCoverage.custom
      ? `Индивидуальными промтами уже закрыто ${promptCoverage.custom} из ${promptCoverage.total} ключевых узлов.`
      : "Ключевые узлы пока читаются в основном через базовые шаблоны.",
    promptCoverage.disabled || promptCoverage.missing
      ? `Есть узлы, где prompt отключён или ещё не заведен — это сразу видно в механике.`
      : promptCoverage.default
      ? `Часть узлов пока на базовом шаблоне — можно точечно усиливать их через админку.`
      : "Вся видимая цепочка уже опирается на настроенные промты.",
  ].join(" ");

  const finalNode: ResultsBlueprintFinalNode = {
    id: "final:result",
    title: "Итоговый контур",
    tone: finalTone,
    text: finalText,
    bridgeIds: bridges.map((item) => item.id),
  };

  const links: ResultsBlueprintLink[] = [];
  for (const competency of competencyNodes) {
    for (const testId of competency.testIds) {
      const sourceTest = testNodes.find((item) => item.id === testId);
      links.push({
        from: testId,
        to: competency.id,
        tone: sourceTest?.completed ? "ready" : "muted",
      });
    }
    const strongSet = new Set(bridges[0].competencyIds);
    const attentionSet = new Set(bridges[1].competencyIds);
    if (strongSet.has(competency.id)) {
      links.push({ from: competency.id, to: bridges[0].id, tone: "ready" });
    }
    if (attentionSet.has(competency.id)) {
      links.push({ from: competency.id, to: bridges[1].id, tone: toneFromPromptSource(competency.promptSource) });
    }
    links.push({ from: competency.id, to: bridges[2].id, tone: toneFromPromptSource(competency.promptSource) });
  }

  for (const bridge of bridges) {
    links.push({ from: bridge.id, to: finalNode.id, tone: bridge.tone });
  }

  return {
    summary: {
      goalLabel: getGoalDefinition(project.goal as any)?.title || project.goal,
      focusLabel,
      routeMode: project.routing_meta?.mode === "competency" ? "competency" : "goal",
      promptCoverage,
      strongest: strongestNodes.map((item) => item.title),
      attention: attentionNodes.map((item) => item.title),
      finalLabel: roleLabel,
      finalText,
    },
    tests: testNodes,
    competencies: competencyNodes,
    bridges,
    final: finalNode,
    links,
  } satisfies ResultsBlueprint;
}
