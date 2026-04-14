import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ThinkingStatus } from "@/components/ThinkingStatus";
import {
  EVALUATION_PACKAGES,
  getEvaluationPackageDefinition,
  getUpgradePriceRub,
  isPackageAccessible,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import { formatMonthlySubscriptionPeriod, type WorkspaceSubscriptionStatus } from "@/lib/commercialSubscriptions";
import { getFitRoleProfiles, type FitRoleProfile } from "@/lib/fitProfiles";
import { useSession } from "@/lib/useSession";
import { useWalletBalance } from "@/lib/useWalletBalance";
import type { ResultsBlueprint } from "@/lib/projectResultsBlueprint";

type ResultsPagePayload = {
  ok: true;
  fully_done: boolean;
  completed: number;
  total: number;
  collected_at: string | null;
  collect_mode: "view" | "collect";
  project: {
    id: string;
    title: string;
    goal: string;
    status: string | null;
    package_mode: string | null;
    unlocked_package_mode: EvaluationPackage | null;
    target_role: string | null;
    routing_meta: {
      mode: "goal" | "competency";
      competencyIds?: string[];
      selectionLabel?: string | null;
    } | null;
    person: {
      full_name: string | null;
      email: string | null;
      current_position: string | null;
    } | null;
  };
  blueprint: ResultsBlueprint | null;
};

type EvaluationPayload = {
  ok: true;
  fully_done: boolean;
  completed: number;
  total: number;
  unlocked_package_mode?: EvaluationPackage | null;
  evaluation: {
    mode: string;
    sections: Array<{ kind: string; title: string; body: string }>;
  } | null;
};



type SectionTone = "positive" | "warning" | "neutral";

function formatCollectedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short" }).format(d);
}

function cleanSectionBody(body: string | null | undefined): string {
  return String(body || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function splitSectionBody(body: string | null | undefined): { preview: string; details: string } {
  const cleaned = cleanSectionBody(body);
  if (!cleaned) return { preview: "", details: "" };
  const parts = cleaned.split(/\n\n+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length <= 1) return { preview: cleaned, details: "" };
  return { preview: parts[0], details: parts.slice(1).join("\n\n") };
}

function inferSectionTone(title: string | null | undefined): SectionTone {
  const source = String(title || "").toLowerCase();
  if (/(сильн|ресурс|потенциал|достоин|преиму|опора|устойчив|готов)/.test(source)) return "positive";
  if (/(риск|огранич|напряж|конфликт|слаб|дефицит|уязвим|предупреж|внимани)/.test(source)) return "warning";
  return "neutral";
}

function sectionKey(scope: string | null | undefined, index: number): string {
  return `${scope || "section"}:${index}`;
}


type EvaluationSectionItem = NonNullable<EvaluationPayload["evaluation"]>["sections"][number];

type MatchIndexItem = {
  value: string;
  label: string;
  tone: "green" | "sand" | "peach";
};

type ParsedSummaryBuckets = {
  summary: string;
  strengths: string[];
  risks: string[];
  important: string;
};

type AnalysisLayoutData = {
  indexItems: MatchIndexItem[];
  focusSection: EvaluationSectionItem | null;
  contextSection: EvaluationSectionItem | null;
  summaryText: string;
  strengths: string[];
  risks: string[];
  importantText: string;
  extraSections: EvaluationSectionItem[];
};

function normalizeLine(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripListPrefix(value: string): string {
  return value.replace(/^\s*(?:[•●▪◦*\-–—]+|\d+[\)\.\-:]?)\s*/u, "").trim();
}

function dedupeTextList(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of values) {
    const cleaned = normalizeLine(stripListPrefix(raw));
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function parseBulletLines(body: string | null | undefined): string[] {
  return dedupeTextList(
    cleanSectionBody(body)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function detectSummaryBucket(value: string): keyof ParsedSummaryBuckets | null {
  const normalized = stripListPrefix(value).toLowerCase();
  if (/^(общий|итоговый|короткий)\s+вывод/.test(normalized) || normalized === "вывод") return "summary";
  if (/^(сильные стороны|сильные сигналы|ресурсы|опоры)/.test(normalized)) return "strengths";
  if (/^(риски|риски и ограничения|ограничения|слабые стороны)/.test(normalized)) return "risks";
  if (/^(что особенно важно|что важно|особенно важно|что учитывать|рекомендации|что особенно важно с уч[её]том профиля)/.test(normalized)) return "important";
  return null;
}

function stripBucketHeading(value: string): string {
  let cleaned = value.trim().replace(/^\s*\d+[\)\.\-:]?\s*/, "");
  cleaned = cleaned
    .replace(/^(общий|итоговый|короткий)\s+вывод\s*[:\-–—]?\s*/i, "")
    .replace(/^(сильные стороны|сильные сигналы|ресурсы|опоры)\s*[:\-–—]?\s*/i, "")
    .replace(/^(риски|риски и ограничения|ограничения|слабые стороны)\s*[:\-–—]?\s*/i, "")
    .replace(/^(что особенно важно|что важно|особенно важно|что учитывать|рекомендации|что особенно важно с уч[её]том профиля)\s*[:\-–—]?\s*/i, "");
  return cleaned.trim();
}

function parseStructuredSummary(body: string | null | undefined): ParsedSummaryBuckets {
  const buckets: Record<keyof ParsedSummaryBuckets, string[]> = {
    summary: [],
    strengths: [],
    risks: [],
    important: [],
  };
  const lines = cleanSectionBody(body)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let current: keyof ParsedSummaryBuckets = "summary";

  for (const line of lines) {
    const bucket = detectSummaryBucket(line);
    if (bucket) {
      current = bucket;
      const remainder = stripBucketHeading(line);
      if (remainder) buckets[current].push(remainder);
      continue;
    }
    buckets[current].push(line);
  }

  return {
    summary: normalizeLine(buckets.summary.join(" ")),
    strengths: dedupeTextList(buckets.strengths),
    risks: dedupeTextList(buckets.risks),
    important: normalizeLine(buckets.important.join(" ")),
  };
}

function isIndexSectionTitle(title: string | null | undefined): boolean {
  return /индекс соответствия/i.test(String(title || ""));
}

function isFocusSectionTitle(title: string | null | undefined): boolean {
  return /фокус анализа/i.test(String(title || ""));
}

function isContextSectionTitle(title: string | null | undefined): boolean {
  return /контекст профиля/i.test(String(title || ""));
}

function isSummarySectionTitle(title: string | null | undefined): boolean {
  return /короткий вывод/i.test(String(title || ""));
}

function isStrengthSectionTitle(title: string | null | undefined): boolean {
  return /(сильные стороны|сильные сигналы|ресурсы|опоры)/i.test(String(title || ""));
}

function isRiskSectionTitle(title: string | null | undefined): boolean {
  return /(риски|ограничения|слабые стороны)/i.test(String(title || ""));
}

function isImportantSectionTitle(title: string | null | undefined): boolean {
  return /(что особенно важно|что учитывать|рекомендации|уч[её]том профиля)/i.test(String(title || ""));
}

function buildIndexLabel(section: EvaluationSectionItem, fallbackIndex: number): string {
  const body = cleanSectionBody(section.body);
  const orientMatch = body.match(/Ориентир:\s*([^\n.]+)/i);
  if (orientMatch?.[1]) {
    return `по ${orientMatch[1].trim().replace(/^[А-ЯЁ]/, (ch) => ch.toLowerCase())}`;
  }
  const scoreStripped = body
    .replace(/^[^:]+:\s*\d{1,3}\s*\/\s*100\.?\s*/i, "")
    .replace(/\b\d{1,3}\s*\/\s*100\b/g, "")
    .replace(/Ориентир:\s*[^\n.]+\.?/gi, "")
    .replace(/Индекс соответствия:?/gi, "")
    .trim();
  const firstSentence = scoreStripped.split(/\.\s+/)[0]?.trim();
  if (firstSentence) return firstSentence;
  if (fallbackIndex === 0) return "по выбранной цели";
  if (fallbackIndex === 1) return "по текущей должности";
  return "по будущей предполагаемой должности";
}

function buildAnalysisLayout(sections: EvaluationSectionItem[]): AnalysisLayoutData {
  const usedIndexes = new Set<number>();

  const findSection = (predicate: (section: EvaluationSectionItem) => boolean): { section: EvaluationSectionItem; index: number } | null => {
    const index = sections.findIndex((section) => predicate(section));
    return index >= 0 ? { section: sections[index], index } : null;
  };

  const indexItems: MatchIndexItem[] = [];
  const seenIndexKeys = new Set<string>();
  sections.forEach((section, index) => {
    if (!isIndexSectionTitle(section.title)) return;
    usedIndexes.add(index);
    const valueMatch = cleanSectionBody(section.body).match(/(\d{1,3})\s*\/\s*100/);
    const value = valueMatch?.[1] || "—";
    const label = buildIndexLabel(section, indexItems.length);
    const key = `${value}|${label.toLowerCase()}`;
    if (seenIndexKeys.has(key)) return;
    seenIndexKeys.add(key);
    indexItems.push({
      value,
      label,
      tone: indexItems.length === 0 ? "green" : indexItems.length === 1 ? "sand" : "peach",
    });
  });

  const focusMatch = findSection((section) => isFocusSectionTitle(section.title));
  if (focusMatch) usedIndexes.add(focusMatch.index);

  const contextMatch = findSection((section) => isContextSectionTitle(section.title));
  if (contextMatch) usedIndexes.add(contextMatch.index);

  const summaryMatch = findSection((section) => isSummarySectionTitle(section.title));
  if (summaryMatch) usedIndexes.add(summaryMatch.index);

  const strengthMatch = findSection((section) => isStrengthSectionTitle(section.title));
  if (strengthMatch) usedIndexes.add(strengthMatch.index);

  const riskMatch = findSection((section) => isRiskSectionTitle(section.title));
  if (riskMatch) usedIndexes.add(riskMatch.index);

  const importantMatch = findSection((section) => isImportantSectionTitle(section.title));
  if (importantMatch) usedIndexes.add(importantMatch.index);

  const parsedSummary = parseStructuredSummary(summaryMatch?.section.body || "");
  const summaryParts = summaryMatch ? splitSectionBody(summaryMatch.section.body) : { preview: "", details: "" };

  const strengths = dedupeTextList([
    ...parsedSummary.strengths,
    ...(strengthMatch ? parseBulletLines(strengthMatch.section.body) : []),
  ]).slice(0, 6);

  const risks = dedupeTextList([
    ...parsedSummary.risks,
    ...(riskMatch ? parseBulletLines(riskMatch.section.body) : []),
  ]).slice(0, 6);

  const importantText = normalizeLine(
    importantMatch ? cleanSectionBody(importantMatch.section.body) : parsedSummary.important
  );

  const extraSections = sections.filter((_, index) => !usedIndexes.has(index));

  return {
    indexItems,
    focusSection: focusMatch?.section || null,
    contextSection: contextMatch?.section || null,
    summaryText: parsedSummary.summary || summaryParts.preview,
    strengths,
    risks,
    importantText,
    extraSections,
  };
}

function getThinkingMessages(mode: EvaluationPackage | null): string[] {
  if (mode === "premium_ai_plus") {
    return [
      "Собираем итоговый профиль по всем тестам",
      "Сопоставляем компетенции и сигналы",
      "Формируем рекомендации и итоговый вывод",
    ];
  }
  if (mode === "premium") {
    return [
      "Читаем результаты каждого теста",
      "Собираем интерпретацию по секциям",
      "Готовим краткий аналитический вывод",
    ];
  }
  return [
    "Собираем базовый результат",
    "Проверяем готовность тестов",
    "Формируем выдачу по уровню",
  ];
}

function getPackageButtonLabel(
  mode: EvaluationPackage,
  unlockedMode: EvaluationPackage | null,
  isUnlimited: boolean,
  activeSubscription: WorkspaceSubscriptionStatus | null,
  projectCoveredBySubscription: boolean
): string {
  if (isPackageAccessible(unlockedMode, mode)) return "Открыть";
  if (isUnlimited) return "Открыть без лимита";
  if (projectCoveredBySubscription || (activeSubscription?.projects_remaining || 0) > 0) return "Открыть по тарифу";
  const price = getUpgradePriceRub(unlockedMode, mode);
  return price > 0 ? `Открыть за ${price} ₽` : "Открыть";
}
type SubscriptionStatusResp = {
  ok: boolean;
  error?: string;
  active_subscription?: WorkspaceSubscriptionStatus | null;
};

export default function ProjectResultsStandalonePage() {
  const router = useRouter();
  const { session, user, loading, envOk } = useSession();
  const { balance_rub, refresh: refreshWallet, isUnlimited } = useWalletBalance();
  const projectId = typeof router.query.projectId === "string" ? router.query.projectId : "";
  const [data, setData] = useState<ResultsPagePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [lastCollectedAt, setLastCollectedAt] = useState<string | null>(null);
  const [evaluationByMode, setEvaluationByMode] = useState<Partial<Record<EvaluationPackage, EvaluationPayload>>>({});
  const [evaluationLoading, setEvaluationLoading] = useState<Partial<Record<EvaluationPackage, boolean>>>({});
  const [activeEvaluationMode, setActiveEvaluationMode] = useState<EvaluationPackage | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [aiPlusRequest, setAiPlusRequest] = useState("");
  const [fitRequested, setFitRequested] = useState(false);
  const [fitProfileId, setFitProfileId] = useState("");
  const [fitRequest, setFitRequest] = useState("");
  const [activeSubscription, setActiveSubscription] = useState<WorkspaceSubscriptionStatus | null>(null);
  const [fitProfiles, setFitProfiles] = useState<FitRoleProfile[]>(() => getFitRoleProfiles());
  const [showAiPlusPrompt, setShowAiPlusPrompt] = useState(false);

  async function loadResults(explicitCollect: boolean, options?: { showSkeleton?: boolean; announce?: string }) {
    if (!session?.access_token || !projectId) return null;
    if (options?.showSkeleton) setBusy(true);
    if (explicitCollect) {
      setCollecting(true);
      setInfo("");
    }
    setError("");
    try {
      const resp = await fetch(`/api/commercial/projects/results-map?id=${encodeURIComponent(projectId)}`, {
        method: explicitCollect ? "POST" : "GET",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось собрать страницу результатов");
      const payload = json as ResultsPagePayload;
      setData(payload);
      setLastCollectedAt(payload.collected_at || null);
      if (explicitCollect) setInfo(options?.announce || "Анализ собран заново по всей информации проекта.");
      return payload;
    } catch (err: any) {
      setError(err?.message || "Не удалось открыть страницу результатов");
      return null;
    } finally {
      if (options?.showSkeleton) setBusy(false);
      if (explicitCollect) setCollecting(false);
    }
  }

  async function loadSubscriptionStatus() {
    if (!session?.access_token) {
      setActiveSubscription(null);
      return;
    }
    try {
      const resp = await fetch("/api/commercial/subscriptions/status", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as SubscriptionStatusResp;
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить месячный тариф");
      setActiveSubscription(json.active_subscription || null);
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить месячный тариф");
    }
  }

  async function loadEvaluation(mode: EvaluationPackage, opts?: { customRequest?: string }) {
    if (!session?.access_token || !projectId) return;
    setEvaluationLoading((prev) => ({ ...prev, [mode]: true }));
    try {
      const url = new URL(`/api/commercial/projects/evaluation`, window.location.origin);
      url.searchParams.set("id", projectId);
      url.searchParams.set("mode", mode);
      if (mode === "premium_ai_plus" && opts?.customRequest?.trim()) {
        url.searchParams.set("custom_request", opts.customRequest.trim());
      }
      if (mode === "premium_ai_plus") {
        url.searchParams.set("fit_enabled", fitRequested ? "1" : "0");
        if (fitRequested && fitProfileId) url.searchParams.set("fit_profile_id", fitProfileId);
        if (fitRequested && fitRequest.trim()) url.searchParams.set("fit_request", fitRequest.trim());
      }
      const resp = await fetch(url.toString(), {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить уровень анализа");
      setEvaluationByMode((prev) => ({ ...prev, [mode]: json as EvaluationPayload }));
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить уровень анализа");
    } finally {
      setEvaluationLoading((prev) => ({ ...prev, [mode]: false }));
    }
  }

  async function unlockPackage(mode: EvaluationPackage) {
    if (!session?.access_token || !data?.project.id) return;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const resp = await fetch("/api/commercial/projects/unlock", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: data.project.id, package_mode: mode }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось открыть уровень анализа");
      const chargedRub = Number(json?.charged_rub || 0);
      if (json?.used_subscription) {
        setInfo(`Уровень «${getEvaluationPackageDefinition(mode)?.title || mode}» открыт по месячному тарифу.${Number.isFinite(Number(json?.subscription_remaining)) ? ` Осталось ${Number(json?.subscription_remaining)} проектов.` : ""}`);
      } else {
        setInfo(chargedRub > 0 ? `Уровень «${getEvaluationPackageDefinition(mode)?.title || mode}» открыт.` : "Уровень уже был открыт.");
      }
      await loadResults(false);
      await loadSubscriptionStatus();
      await refreshWallet();
      setActiveEvaluationMode(mode);
      await loadEvaluation(mode, mode === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
      if (mode === "premium") await loadEvaluation("basic");
      if (mode === "premium_ai_plus") {
        await loadEvaluation("basic");
        await loadEvaluation("premium");
      }
    } catch (err: any) {
      setError(err?.message || "Ошибка оплаты");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadFitProfiles() {
      try {
        const resp = await fetch("/api/commercial/fit-config/options");
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok || !Array.isArray(json?.profiles)) return;
        if (!cancelled && json.profiles.length) setFitProfiles(json.profiles);
      } catch {
        // keep embedded defaults
      }
    }
    loadFitProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!router.isReady || !session?.access_token || !projectId) return;
    const shouldCollect = router.query.collect === "1";
    (async () => {
      await loadResults(shouldCollect, {
        showSkeleton: true,
        announce: shouldCollect ? "Анализ собран по всей информации проекта." : undefined,
      });
      await loadSubscriptionStatus();
      if (shouldCollect) {
        router.replace(`/projects/${projectId}/results`, undefined, { shallow: true });
      }
    })();
  }, [router.isReady, projectId, session?.access_token]);

  useEffect(() => {
    const unlocked = data?.project.unlocked_package_mode || null;
    if (!unlocked) {
      setActiveEvaluationMode(null);
      return;
    }
    setActiveEvaluationMode((prev) => prev || unlocked);
  }, [data?.project.unlocked_package_mode]);

  useEffect(() => {
    if (!activeEvaluationMode || !data?.fully_done || !data?.project.unlocked_package_mode) return;
    if (!isPackageAccessible(data.project.unlocked_package_mode, activeEvaluationMode)) return;
    if (evaluationByMode[activeEvaluationMode] || evaluationLoading[activeEvaluationMode]) return;
    loadEvaluation(activeEvaluationMode, activeEvaluationMode === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
  }, [activeEvaluationMode, data?.fully_done, data?.project.unlocked_package_mode, aiPlusRequest]);

  const blueprint = data?.blueprint || null;
  const coverage = blueprint?.summary.promptCoverage || null;
  const unlockedMode = data?.project.unlocked_package_mode || null;
  const projectCoveredBySubscription = false;
  const availablePackages = useMemo(
    () => EVALUATION_PACKAGES.filter((item) => isPackageAccessible(unlockedMode, item.key)).map((item) => item.key),
    [unlockedMode]
  );

  const activeSections = useMemo(() => {
    const sections = activeEvaluationMode ? evaluationByMode[activeEvaluationMode]?.evaluation?.sections || [] : [];
    return sections.filter((item) => item.body?.trim());
  }, [activeEvaluationMode, evaluationByMode]);
  const overviewSections = useMemo(() => activeSections.filter((item) => item.kind !== "test"), [activeSections]);
  const testSections = useMemo(() => activeSections.filter((item) => item.kind === "test"), [activeSections]);



  if (!envOk) {
    return (
      <Layout title="Страница результатов">
        <div className="card text-sm text-zinc-600">Supabase не настроен.</div>
      </Layout>
    );
  }

  if (loading || busy || (!data && !error)) {
    return (
      <Layout title="Страница результатов">
        <div className="mx-auto max-w-[1260px] px-3 pb-10 pt-3 sm:px-4">
          <div className="rounded-[34px] border border-[#dcc8aa] bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe4_100%)] p-5 shadow-[0_24px_54px_rgba(93,71,39,0.10)]">
            <div className="h-8 w-72 animate-pulse rounded bg-[#eadfc8]" />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="h-56 animate-pulse rounded-[24px] bg-[#f4ecde]" />
              <div className="h-56 animate-pulse rounded-[24px] bg-[#f4ecde]" />
              <div className="h-56 animate-pulse rounded-[24px] bg-[#f4ecde]" />
            </div>
            <div className="mt-6 h-[460px] animate-pulse rounded-[28px] bg-[#f4ecde]" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!session || !user) {
    return (
      <Layout title="Страница результатов">
        <div className="card text-sm text-zinc-600">Нужен вход. Перейди в <a className="underline" href="/auth">/auth</a>.</div>
      </Layout>
    );
  }

  const collectedLabel = formatCollectedAt(lastCollectedAt || data?.collected_at || null);
  const overviewCards = overviewSections.slice(0, 3);
  const primaryOverviewCards = overviewCards.slice(0, 2);
  const secondaryOverviewCards = overviewCards.slice(2);
  const coveragePercent = coverage ? Math.round(((coverage.custom + coverage.default) / Math.max(coverage.total, 1)) * 100) : 0;
  const analysisLayout = buildAnalysisLayout(overviewSections);

  return (
    <Layout title={data?.project.title ? `${data.project.title} — результаты` : "Страница результатов"}>
      <div className="mx-auto max-w-[1360px] px-3 pb-12 pt-5 sm:px-4">
        {error ? <div className="mb-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {info ? <div className="mb-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}

        <div className="relative overflow-hidden rounded-[38px] border border-[#dcc8aa] bg-[radial-gradient(circle_at_14%_18%,rgba(164,137,92,0.08)_0,transparent_26%),radial-gradient(circle_at_78%_22%,rgba(129,157,115,0.07)_0,transparent_24%),linear-gradient(180deg,#fffefb_0%,#f7f0e4_100%)] shadow-[0_22px_48px_rgba(93,71,39,0.08)]">
          <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(#ab9067_0.55px,transparent_0.55px)] [background-size:13px_13px]" />

          <div className="relative border-b border-[#eadbc3] px-6 py-5 sm:px-8 sm:py-6">
            <div className="pr-[170px] sm:pr-[210px]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[1.7rem] leading-tight text-[#5b4321] sm:text-[2.05rem]">Проект: {data?.project.title || "Результаты проекта"}</div>
                  <div className="mt-5 text-[1.5rem] font-semibold leading-tight text-[#2d2a22] sm:text-[1.7rem]">{data?.project.person?.full_name || "Участник проекта"}</div>
                  <div className="mt-2 space-y-1 text-[1rem] text-[#765f45]">
                    <div>Статус: {data?.fully_done ? "Тесты пройдены" : `Готово ${data?.completed || 0} из ${data?.total || 0}`}</div>
                    {collectedLabel ? <div>Результат собран: {collectedLabel}</div> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => loadResults(true, { announce: lastCollectedAt ? "Анализ пересобран по всей информации проекта." : "Анализ собран по всей информации проекта." })}
                    disabled={collecting || !data?.fully_done}
                    className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731] shadow-[0_4px_12px_rgba(93,71,39,0.05)] disabled:opacity-60"
                  >
                    {collecting ? "Пересобираем анализ" : "Пересобрать анализ"}
                  </button>
                  <Link href={`/projects/${projectId}`} className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731] shadow-[0_4px_12px_rgba(93,71,39,0.05)]">
                    Назад к проекту
                  </Link>
                </div>
              </div>
            </div>

            <div className="absolute right-5 top-5 grid h-[126px] w-[126px] place-items-center sm:right-8 sm:top-4 sm:h-[170px] sm:w-[170px]">
              <img
                src={data?.fully_done ? "/result-stamp.svg" : "/result-stamp-bw.svg"}
                alt={data?.fully_done ? "Результат собран" : "Результат ожидает"}
                className="h-full w-full object-contain opacity-90"
              />
            </div>
          </div>

          <div className="relative px-6 py-5 sm:px-8 sm:py-6">
            {!data?.fully_done ? (
              <div className="rounded-[26px] border border-[#d8c5a8] bg-[#fbf5ea] px-5 py-5 text-sm leading-7 text-[#6f6454]">
                Все уровни анализа откроются после завершения тестов. Сейчас готово {data?.completed || 0} из {data?.total || 0}.
              </div>
            ) : (
              <>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.08fr)_220px] xl:items-stretch">
                  {EVALUATION_PACKAGES.map((item) => {
                    const unlocked = isPackageAccessible(unlockedMode, item.key);
                    const currentEval = evaluationByMode[item.key];
                    const isBusy = !!saving || !!evaluationLoading[item.key];
                    const accessible = unlocked || isUnlimited || projectCoveredBySubscription || (activeSubscription?.projects_remaining || 0) > 0;
                    const isActive = activeEvaluationMode === item.key;
                    const isAi = item.key === "premium";
                    const isAiPlus = item.key === "premium_ai_plus";
                    return (
                      <div
                        key={item.key}
                        className={`min-h-[284px] rounded-[30px] border p-6 shadow-[0_10px_24px_rgba(93,71,39,0.04)] ${isAiPlus ? "border-[#b6d0ab] bg-[radial-gradient(circle_at_90%_10%,rgba(145,180,138,0.08),transparent_34%),linear-gradient(180deg,#f9fcf6_0%,#eef6e9_100%)]" : "border-[#dfcfb5] bg-[radial-gradient(circle_at_18%_18%,rgba(184,153,108,0.08),transparent_30%),linear-gradient(180deg,#fffdf9_0%,#fbf5ec_100%)]"}`}
                      >
                        <div className="flex h-full flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-serif text-[2rem] leading-none text-[#4d3b24]">{item.title}</div>
                            
                          </div>
                          <div className="mt-6 text-[1.02rem] leading-9 text-[#6f5a42]">{item.description}</div>
                          {item.bullets?.length ? (
                            <ul className="mt-6 space-y-3 text-sm leading-7 text-[#6f5a42]">
                              {item.bullets?.slice(0, isAiPlus ? 3 : 2).map((bullet) => (
                                <li key={bullet} className="flex items-start gap-2.5"><span className="mt-2.5 h-1.5 w-1.5 rounded-full bg-[#d2bb92]" /> <span>{bullet}</span></li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="mt-auto pt-6">
                            {unlocked ? (
                              <button
                                type="button"
                                className={`w-full rounded-[18px] border px-4 py-2.5 text-sm font-medium ${isActive ? "border-[#8eb48d] bg-[#dceecd] text-[#27402b]" : "border-[#d9c4a4] bg-[#fffaf0] text-[#5b4731]"}`}
                                onClick={async () => {
                                  setActiveEvaluationMode(item.key);
                                  if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) {
                                    await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                                  }
                                }}
                              >
                                {isActive ? "Открыт" : currentEval?.evaluation ? "Открыть" : "Собрать и открыть"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="w-full rounded-[18px] border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] disabled:opacity-60"
                                disabled={isBusy || !accessible}
                                onClick={() => unlockPackage(item.key)}
                              >
                                {getPackageButtonLabel(item.key, unlockedMode, isUnlimited, activeSubscription, projectCoveredBySubscription)}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <aside className="rounded-[28px] border border-[#dfcfb5] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf5ec_100%)] p-5 shadow-[0_10px_24px_rgba(93,71,39,0.04)]">
                    <div className="text-[1.15rem] font-semibold text-[#4d3b24]">Статус анализа</div>
                    <div className="mt-6 space-y-4 text-[1.02rem] leading-7 text-[#6f5a42]">
                      <div>Тестов: {blueprint?.tests.length || 0}</div>
                      <div>Компетенций: {blueprint?.competencies.length || 0}</div>
                      <div>Связей: {blueprint?.links.length || 0}</div>
                      <div>Процент промтов: {coveragePercent}%</div>
                    </div>
                    {collectedLabel ? <div className="mt-10 text-[0.96rem] text-[#7d6953]">Собрано: {collectedLabel}</div> : null}
                  </aside>
                </div>

                {activeEvaluationMode && isPackageAccessible(unlockedMode, activeEvaluationMode) ? (
                  <div className="mt-6 rounded-[32px] border border-[#d7c4a6] bg-[linear-gradient(180deg,#fffdf9_0%,#f9f3e8_100%)] p-6 shadow-[0_14px_32px_rgba(93,71,39,0.05)]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead9bf] pb-4">
                      <div className="flex flex-wrap items-center gap-8 text-[1.08rem] font-medium">
                        {availablePackages.map((mode) => {
                          const selected = activeEvaluationMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              className={`relative pb-2 ${selected ? "text-[#2f4e2f]" : "text-[#8f7c64]"}`}
                              onClick={async () => {
                                setActiveEvaluationMode(mode);
                                if (!evaluationByMode[mode] && !evaluationLoading[mode]) {
                                  await loadEvaluation(mode, mode === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                                }
                              }}
                            >
                              {getEvaluationPackageDefinition(mode)?.title || mode}
                              <span className={`absolute inset-x-0 -bottom-[5px] h-[2px] rounded-full ${selected ? "bg-[#8eb48d]" : "bg-transparent"}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {activeEvaluationMode === "premium_ai_plus" && showAiPlusPrompt ? (
                      <div id="ai-refine-section" className="mt-5 rounded-[22px] border border-[#e2d1b6] bg-[#fcf7ef] p-4 transition-all duration-300 data-[flash=true]:ring-2 data-[flash=true]:ring-[#b9cfab] data-[flash=true]:ring-offset-2 data-[flash=true]:ring-offset-[#fcf7ef]">
                        <div className="text-sm font-semibold text-[#2d2a22]">Уточнение для AI+</div>
                        <div className="mt-1 text-sm text-[#8d7860]">Можно уточнить акцент итогового профиля и отдельно включить индекс соответствия.</div>
                        <div className="mt-3 grid gap-3">
                          <textarea className="input min-h-[92px]" value={aiPlusRequest} onChange={(e) => setAiPlusRequest(e.target.value)} placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска." />
                          <div className="flex justify-end">
                            <button type="button" className="rounded-[18px] border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029]" disabled={!!evaluationLoading.premium_ai_plus} onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}>
                              {evaluationLoading.premium_ai_plus ? "Собираем…" : "Обновить AI+"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : activeEvaluationMode === "premium_ai_plus" ? (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAiPlusPrompt(true);
                            window.setTimeout(() => {
                              const target = document.getElementById("ai-refine-section");
                              if (!target) return;
                              target.dataset.flash = "true";
                              target.scrollIntoView({ behavior: "smooth", block: "start" });
                              window.setTimeout(() => {
                                delete target.dataset.flash;
                              }, 1600);
                            }, 60);
                          }}
                          className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731] transition hover:-translate-y-[1px] hover:bg-[#fff4e6]"
                        >
                          Уточнить AI+
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-5">
                      <div className="min-w-0">
                        {evaluationLoading[activeEvaluationMode] ? (
                          <ThinkingStatus title={activeEvaluationMode === "premium_ai_plus" ? "AI+ формирует профиль" : activeEvaluationMode === "premium" ? "AI формирует интерпретацию" : "Собираем результат"} messages={getThinkingMessages(activeEvaluationMode)} />
                        ) : activeSections.length ? (
                          <div className="rounded-[30px] border border-[#e2d1b6] bg-white/74 p-6 shadow-[0_10px_22px_rgba(93,71,39,0.04)]">
                            <div className="font-serif text-[2rem] leading-tight text-[#4d3b24] sm:text-[2.2rem]">Итоговый аналитический вывод</div>
                            <div className="mt-6 border-t border-[#ead9bf] pt-6">
                              <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <aside className="space-y-5">
                                  {analysisLayout.indexItems.length ? (
                                    <div className="rounded-[26px] border border-[#d9e4d1] bg-[linear-gradient(180deg,#fbfdf8_0%,#f4f8ef_100%)] p-5 shadow-[0_8px_18px_rgba(93,71,39,0.03)]">
                                      <div className="font-serif text-[1.55rem] leading-tight text-[#4d3b24]">Индексы соответствия</div>
                                      <div className="mt-5 space-y-4">
                                        {analysisLayout.indexItems.map((item, index) => (
                                          <div key={`${item.value}:${item.label}:${index}`} className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3">
                                            <div
                                              className={`grid h-[52px] w-[52px] place-items-center rounded-full border text-[1.45rem] font-medium leading-none text-[#5b4321] ${
                                                item.tone === "green"
                                                  ? "border-[#bfd3b3] bg-[#dcead7]"
                                                  : item.tone === "sand"
                                                    ? "border-[#e7d2b3] bg-[#f4e3c4]"
                                                    : "border-[#ebd0bc] bg-[#f3d9bf]"
                                              }`}
                                            >
                                              {item.value}
                                            </div>
                                            <div className="text-[1rem] leading-6 text-[#6f5a42]">{item.label}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {analysisLayout.focusSection ? (() => {
                                    const focusKey = sectionKey(`${activeEvaluationMode}:analysis-focus`, 0);
                                    const focusOpen = openSections[focusKey] ?? false;
                                    const focusParts = splitSectionBody(analysisLayout.focusSection.body);
                                    return (
                                      <div className="rounded-[24px] border border-[#ead9bf] bg-[#fffdf8] p-5 shadow-[0_8px_18px_rgba(93,71,39,0.03)]">
                                        <div className="font-serif text-[1.42rem] leading-tight text-[#4d3b24]">Фокус анализа</div>
                                        <div className="mt-4 whitespace-pre-line text-[1rem] leading-8 text-[#6f5a42]">{focusParts.preview}</div>
                                        {focusParts.details ? (
                                          <>
                                            <button
                                              type="button"
                                              className="mt-4 text-sm font-medium text-[#8b6b3c]"
                                              onClick={() => setOpenSections((prev) => ({ ...prev, [focusKey]: !focusOpen }))}
                                            >
                                              {focusOpen ? "Скрыть детали" : "Подробнее"}
                                            </button>
                                            {focusOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{focusParts.details}</div> : null}
                                          </>
                                        ) : null}
                                      </div>
                                    );
                                  })() : null}

                                  {analysisLayout.contextSection ? (() => {
                                    const contextKey = sectionKey(`${activeEvaluationMode}:analysis-context`, 0);
                                    const contextOpen = openSections[contextKey] ?? false;
                                    const contextParts = splitSectionBody(analysisLayout.contextSection.body);
                                    return (
                                      <div className="rounded-[24px] border border-[#ead9bf] bg-[#fffdf8] p-5 shadow-[0_8px_18px_rgba(93,71,39,0.03)]">
                                        <div className="font-serif text-[1.42rem] leading-tight text-[#4d3b24]">Контекст профиля</div>
                                        <div className="mt-4 whitespace-pre-line text-[1rem] leading-8 text-[#6f5a42]">{contextParts.preview}</div>
                                        {contextParts.details ? (
                                          <>
                                            <button
                                              type="button"
                                              className="mt-4 text-sm font-medium text-[#8b6b3c]"
                                              onClick={() => setOpenSections((prev) => ({ ...prev, [contextKey]: !contextOpen }))}
                                            >
                                              {contextOpen ? "Скрыть детали" : "Подробнее"}
                                            </button>
                                            {contextOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{contextParts.details}</div> : null}
                                          </>
                                        ) : null}
                                      </div>
                                    );
                                  })() : null}
                                </aside>

                                <div className="rounded-[32px] border border-[#e4d3be] bg-[linear-gradient(180deg,#fffefb_0%,#fcf8f1_100%)] p-5 shadow-[0_8px_20px_rgba(93,71,39,0.04)] sm:p-6">
                                  <div className="flex items-center gap-3 px-1">
                                    <div className="grid h-12 w-12 place-items-center rounded-full border border-[#b9cfab] bg-[#eef5e6] text-[1.55rem] leading-none text-[#6b815f]">
                                      💡
                                    </div>
                                    <div className="font-serif text-[1.8rem] leading-tight text-[#4d3b24] sm:text-[2rem]">Короткий вывод</div>
                                  </div>

                                  <div className="mt-4 rounded-[26px] border border-[#ead9bf] bg-white/55 px-6 py-5">
                                    <div className="whitespace-pre-line text-[1.08rem] leading-9 text-[#5f4930] sm:text-[1.16rem]">
                                      {analysisLayout.summaryText || "Краткий вывод пока не выделен. Открой подробности по тестам ниже."}
                                    </div>
                                  </div>

                                  {analysisLayout.strengths.length || analysisLayout.risks.length ? (
                                    <div className="mt-5 overflow-hidden rounded-[24px] border border-[#ead9bf] bg-white/44 lg:grid lg:grid-cols-2">
                                      <div className="p-5">
                                        <div className="flex items-center gap-3 text-[#4d3b24]">
                                          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#9eb78f] text-sm font-semibold text-white">✓</span>
                                          <div className="text-[1.35rem] font-medium">Сильные стороны</div>
                                        </div>
                                        {analysisLayout.strengths.length ? (
                                          <ul className="mt-4 space-y-3.5 text-[1rem] leading-8 text-[#6f5a42]">
                                            {analysisLayout.strengths.map((item, index) => (
                                              <li key={`${item}:${index}`} className="flex items-start gap-3 pr-1">
                                                <span className="mt-[13px] h-2.5 w-2.5 flex-none rounded-full bg-[#9eb78f]" />
                                                <span>{item}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <div className="mt-4 text-sm leading-7 text-[#8a745a]">Отдельный блок сильных сторон пока не выделен.</div>
                                        )}
                                      </div>
                                      <div className="border-t border-[#ead9bf] p-5 lg:border-l lg:border-t-0 lg:pl-6">
                                        <div className="flex items-center gap-3 text-[#4d3b24]">
                                          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#cb8b7a] text-sm font-semibold text-white">!</span>
                                          <div className="text-[1.35rem] font-medium">Риски</div>
                                        </div>
                                        {analysisLayout.risks.length ? (
                                          <ul className="mt-4 space-y-3.5 text-[1rem] leading-8 text-[#6f5a42]">
                                            {analysisLayout.risks.map((item, index) => (
                                              <li key={`${item}:${index}`} className="flex items-start gap-3 pr-1">
                                                <span className="mt-[13px] h-2.5 w-2.5 flex-none rounded-full bg-[#cb8b7a]" />
                                                <span>{item}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <div className="mt-4 text-sm leading-7 text-[#8a745a]">Отдельный блок рисков пока не выделен.</div>
                                        )}
                                      </div>
                                    </div>
                                  ) : null}

                                  {analysisLayout.importantText ? (
                                    <div className="mt-5 border-t border-[#ead9bf] pt-5">
                                      <div className="text-[1.35rem] font-medium text-[#4d3b24]">Что особенно важно с учётом профиля</div>
                                      <div className="mt-3 whitespace-pre-line text-[1rem] leading-8 text-[#6f5a42]">{analysisLayout.importantText}</div>
                                    </div>
                                  ) : null}

                                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#ead9bf] bg-white/38 px-4 py-3">
                                    <div className="text-[1.18rem] font-medium text-[#4d3b24]">Подробности по отдельным тестам</div>
                                    {activeEvaluationMode === "premium_ai_plus" ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!showAiPlusPrompt) {
                                            setShowAiPlusPrompt(true);
                                          }
                                          window.setTimeout(() => {
                                            const target = document.getElementById("ai-refine-section");
                                            if (!target) return;
                                            target.dataset.flash = "true";
                                            target.scrollIntoView({ behavior: "smooth", block: "start" });
                                            window.setTimeout(() => {
                                              delete target.dataset.flash;
                                            }, 1600);
                                          }, showAiPlusPrompt ? 0 : 60);
                                        }}
                                        className="rounded-full border border-[#b9cfab] bg-[#dbe8d0] px-4 py-2 text-sm font-medium text-[#5b4731] transition hover:-translate-y-[1px] hover:bg-[#cfe0c2]"
                                      >
                                        Уточнить цели
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {analysisLayout.extraSections.length ? (
                                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                                  {analysisLayout.extraSections.map((section, index) => {
                                    const key = sectionKey(`${activeEvaluationMode}:analysis-extra`, index);
                                    const isOpen = openSections[key] ?? false;
                                    const parts = splitSectionBody(section.body);
                                    const tone = inferSectionTone(section.title);
                                    const toneClass =
                                      tone === "positive"
                                        ? "border-[#d8e7cf] bg-[#f7fcf4]"
                                        : tone === "warning"
                                          ? "border-[#eddcc0] bg-[#fffaf2]"
                                          : "border-[#ead9bf] bg-[#fffdf8]";
                                    return (
                                      <div key={`${section.title}:${index}`} className={`rounded-[24px] border p-5 shadow-[0_8px_18px_rgba(93,71,39,0.03)] ${toneClass}`}>
                                        <div className="font-serif text-[1.32rem] leading-tight text-[#4d3b24]">{section.title}</div>
                                        <div className="mt-4 whitespace-pre-line text-[1rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                        {parts.details ? (
                                          <>
                                            <button
                                              type="button"
                                              className="mt-4 text-sm font-medium text-[#8b6b3c]"
                                              onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}
                                            >
                                              {isOpen ? "Скрыть детали" : "Подробнее"}
                                            </button>
                                            {isOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                          </>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {testSections.length ? (
                                <div id="analysis-test-details" className="mt-6 rounded-[24px] border border-[#ead9bf] bg-[#fffdf8] p-5">
                                  <div className="text-lg font-semibold text-[#4d3b24]">Подробности по отдельным тестам</div>
                                  <div className="mt-4 grid gap-3">
                                    {testSections.map((section, index) => {
                                      const key = sectionKey(activeEvaluationMode, index);
                                      const isOpen = openSections[key] ?? index === 0;
                                      return (
                                        <div key={key} className="overflow-hidden rounded-[20px] border border-[#e2d1b6] bg-white/82">
                                          <button
                                            type="button"
                                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                            onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))}
                                          >
                                            <div className="text-sm font-semibold text-[#2d2a22]">{section.title}</div>
                                            <span className="text-xs text-[#8b6b3c]">{isOpen ? "Скрыть" : "Открыть"}</span>
                                          </button>
                                          {isOpen ? <div className="border-t border-[#ead9bf] px-4 py-4 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{cleanSectionBody(section.body)}</div> : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[24px] border border-[#e1d3bf] bg-[#fcf7ef] p-4 text-sm text-[#6f6454]">Результат для этого уровня пока не собран. Выбери уровень и нажми сборку.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
