export type CompactEvaluationPreview = {
  modeTitle: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
};

type EvaluationSectionLike = {
  kind?: string | null;
  title?: string | null;
  body?: string | null;
};

function normalizeTitle(value: string | null | undefined) {
  return String(value || "").toLocaleLowerCase("ru").replace(/ё/gu, "е").trim();
}

function cleanText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\r/gu, "")
    .replace(/^\s*#{1,6}\s*/gmu, "")
    .replace(/\*\*/gu, "")
    .replace(/`/gu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function parseList(value: string | null | undefined) {
  const source = cleanText(value);
  if (!source) return [];
  const lineItems = source
    .split(/\n+/u)
    .map((line) => line.replace(/^[-•*\d.)\s]+/u, "").trim())
    .filter(Boolean);

  if (lineItems.length > 1) return lineItems;
  return source
    .split(/;\s+/u)
    .map((item) => item.replace(/^[-•*\d.)\s]+/u, "").trim())
    .filter(Boolean);
}

function parseSummaryOutline(value: string | null | undefined) {
  const source = cleanText(value);
  if (!source) return { summary: "", strengths: [] as string[], risks: [] as string[], important: "" };

  const numbered = source
    .split(/(?:^|\n)\s*(?:\d+[).:]?|[1-4]\s*[—-])\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const parts = numbered.length > 1
    ? numbered
    : source.split(/\n\n+/u).map((part) => part.trim()).filter(Boolean);
  const [summary = "", strengths = "", risks = "", important = ""] = parts;

  return {
    summary: summary.replace(/^(общий вывод[:\s-]*)/iu, "").trim(),
    strengths: parseList(strengths),
    risks: parseList(risks),
    important: important
      .replace(/^(что особенно важно(?:\s+с\s+уч[её]том\s+профиля)?[:\s-]*)/iu, "")
      .trim(),
  };
}

export function buildCompactEvaluationPreview(
  evaluation: { sections?: EvaluationSectionLike[] | null } | null | undefined,
  modeTitle: string
): CompactEvaluationPreview | null {
  const sections = (evaluation?.sections || []).filter((section) => cleanText(section.body));
  const overview = sections.filter((section) => section.kind !== "test" && section.kind !== "development");
  if (!overview.length) return null;

  const findByTitle = (pattern: RegExp) => overview.find((section) => pattern.test(normalizeTitle(section.title))) || null;
  const summarySection = findByTitle(/коротк|итогов|общий вывод/u);
  const strengthsSection = findByTitle(/сильн|ресурс|преимущ|опора/u);
  const risksSection = findByTitle(/риск|огранич|уязвим|зона риска/u);
  const recommendationSection = findByTitle(/важно|учетом профиля|учётом профиля|рекомендац/u);
  const parsed = parseSummaryOutline(summarySection?.body);
  const summary = parsed.summary || cleanText(summarySection?.body).split(/\n\n+/u)[0]?.trim() || "";

  if (!summary) return null;

  return {
    modeTitle,
    summary,
    strengths: strengthsSection ? parseList(strengthsSection.body) : parsed.strengths,
    risks: risksSection ? parseList(risksSection.body) : parsed.risks,
    recommendation: recommendationSection ? cleanText(recommendationSection.body) : parsed.important,
  };
}
