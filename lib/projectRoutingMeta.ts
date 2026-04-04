import type { AssessmentGoal } from "@/lib/commercialGoals";
import type { RoutingMode } from "@/lib/competencyRouter";

const META_PREFIX = "[router-meta]";

export type ProjectRoutingMeta = {
  version: 1;
  mode: RoutingMode;
  goal: AssessmentGoal;
  competencyIds?: string[];
  selectionLabel?: string | null;
};

export function encodeProjectSummary(summaryText: string, meta: ProjectRoutingMeta | null | undefined) {
  const cleanText = String(summaryText || "").trim();
  if (!meta) return cleanText;
  return `${META_PREFIX}${JSON.stringify(meta)}\n${cleanText}`.trim();
}

export function parseProjectSummary(raw: string | null | undefined) {
  const value = String(raw || "");
  if (!value.startsWith(META_PREFIX)) {
    return {
      meta: null as ProjectRoutingMeta | null,
      text: value.trim(),
    };
  }

  const nextLine = value.indexOf("\n");
  const metaRaw = value.slice(META_PREFIX.length, nextLine === -1 ? value.length : nextLine).trim();
  const text = nextLine === -1 ? "" : value.slice(nextLine + 1).trim();

  try {
    const parsed = JSON.parse(metaRaw) as ProjectRoutingMeta;
    if (parsed && parsed.version === 1 && parsed.goal) {
      return { meta: parsed, text };
    }
  } catch {
    // noop
  }

  return {
    meta: null as ProjectRoutingMeta | null,
    text: value.trim(),
  };
}
