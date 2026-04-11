import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProjectResultsFlow, type FlowStage } from "@/components/ProjectResultsFlow";
import { ThinkingStatus } from "@/components/ThinkingStatus";
import { isAdminEmail } from "@/lib/admin";
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
import type {
  ResultsBlueprint,
  ResultsBlueprintBridgeNode,
  ResultsBlueprintCompetencyNode,
  ResultsBlueprintFinalNode,
  ResultsBlueprintTestNode,
} from "@/lib/projectResultsBlueprint";

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

type SubscriptionStatusResp = {
  ok: boolean;
  error?: string;
  active_subscription?: WorkspaceSubscriptionStatus | null;
};

type DetailNode =
  | { kind: "test"; node: ResultsBlueprintTestNode }
  | { kind: "competency"; node: ResultsBlueprintCompetencyNode }
  | { kind: "bridge"; node: ResultsBlueprintBridgeNode }
  | { kind: "final"; node: ResultsBlueprintFinalNode };

function getThinkingMessages(mode: EvaluationPackage | null) {
  switch (mode) {
    case "premium_ai_plus":
      return [
        "Обрабатываем информацию. Это может занять около 5 минут.",
        "Собираем общий профиль по всем тестам и формируем вывод по запросу.",
        "Проверяем связи между результатами и считаем индекс соответствия.",
        "AI раскладывает рекомендации по развитию и управленческим выводам.",
      ];
    case "premium":
      return [
        "Обрабатываем информацию. Это может занять около 5 минут.",
        "Формируем вывод по каждому тесту и проверяем смысловые связи.",
        "AI догружает данные и собирает интерпретации по разделам.",
      ];
    default:
      return [
        "Подгружаем результат и собираем итоговые показатели.",
        "Сверяем данные проекта и готовим аккуратную выдачу.",
      ];
  }
}

function formatRub(amount: number) {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

function cleanSectionBody(body: string) {
  return body
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionKey(mode: string, index: number) {
  return `${mode}:${index}`;
}

function splitSectionBody(body: string) {
  const clean = cleanSectionBody(body);
  const [preview, ...rest] = clean.split(/\n\n+/);
  return {
    preview: preview || clean,
    details: rest.join("\n\n").trim(),
  };
}

function inferSectionTone(title: string) {
  const value = title.toLowerCase();
  if (value.includes("сильн") || value.includes("ресурс") || value.includes("опора")) return "positive" as const;
  if (value.includes("риск") || value.includes("огранич") || value.includes("зона внимания")) return "warning" as const;
  return "neutral" as const;
}

function promptCoverageLine(blueprint: ResultsBlueprint) {
  const coverage = blueprint.summary.promptCoverage;
  return `Индивидуальных: ${coverage.custom}/${coverage.total} · базовых: ${coverage.default} · выключено: ${coverage.disabled} · пустых: ${coverage.missing}`;
}

function statusLabel(value: string | null | undefined) {
  switch (value) {
    case "completed":
      return "Завершён";
    case "active":
      return "Активен";
    case "draft":
      return "Черновик";
    default:
      return "Проект";
  }
}

function formatCollectedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function stageCountLine(blueprint: ResultsBlueprint) {
  return `Тестов: ${blueprint.tests.length} · компетенций: ${blueprint.competencies.length} · связей: ${blueprint.links.length}`;
}

function getPackageButtonLabel(
  target: EvaluationPackage,
  current: EvaluationPackage | null | undefined,
  isUnlimited: boolean,
  activeSubscription: WorkspaceSubscriptionStatus | null,
  projectCoveredBySubscription: boolean
) {
  if (isUnlimited) return "Открыть бесплатно";
  if (isPackageAccessible(current, target)) return "Открыто";
  if (projectCoveredBySubscription) return "Открыть по тарифу";
  if (activeSubscription && activeSubscription.projects_remaining > 0) return "Открыть по тарифу";
  const upgradeRub = getUpgradePriceRub(current, target);
  if (current) return `Доплатить ${formatRub(upgradeRub)}`;
  return `Оплатить ${formatRub(getEvaluationPackageDefinition(target)?.priceRub || 0)}`;
}

function DetailContent({ detailNode, isAdmin }: { detailNode: DetailNode | null; isAdmin: boolean }) {
  if (!detailNode) {
    return <div className="text-sm leading-7 text-[#6f6454]">Нажми на любой узел в схеме, чтобы увидеть, из чего он собран и какой смысл он сейчас отдаёт наружу.</div>;
  }

  if (detailNode.kind === "test") {
    const badges = detailNode.node.badges.length ? detailNode.node.badges : [detailNode.node.completed ? "Готово" : "Ожидает прохождения"];
    return (
      <div className="space-y-3 text-sm leading-7 text-[#5f5446]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Тест</div>
          <div className="mt-1 text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
        </div>
        <div className="rounded-[20px] border border-[#e2d3bb] bg-white/80 px-4 py-3">{detailNode.node.summary}</div>
        <div className="flex flex-wrap gap-2">
          {badges.map((item) => (
            <span key={item} className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-3 py-1 text-xs text-[#6f5a42]">
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (detailNode.kind === "competency") {
    return (
      <div className="space-y-3 text-sm leading-7 text-[#5f5446]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Компетенция</div>
          <div className="mt-1 text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#9d7a4b]">{detailNode.node.cluster} · {detailNode.node.score}/100</div>
        </div>
        <div className="rounded-[20px] border border-[#e2d3bb] bg-white/80 px-4 py-3 whitespace-pre-line">{detailNode.node.details}</div>
        <div className="rounded-[20px] border border-[#e2d3bb] bg-white/80 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Статус prompt</div>
          <div className="mt-1">{detailNode.node.promptLabel}</div>
          <div className="mt-2 text-xs leading-6 text-[#8b7760]">
            {detailNode.node.promptSource === "custom"
              ? "Узел опирается на настроенный в админке индивидуальный prompt."
              : detailNode.node.promptSource === "default"
              ? "Узел живёт на базовом шаблоне — это не пустота, но и не индивидуальная настройка."
              : detailNode.node.promptSource === "disabled"
              ? "Узел выключен в таблице prompt-контура и требует внимания."
              : "Здесь вообще нет рабочего шаблона, значит итог будет слабее."}
          </div>
        </div>
        <div className="rounded-[20px] border border-[#e2d3bb] bg-white/80 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Связанные тесты</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(detailNode.node.testTitles.length ? detailNode.node.testTitles : ["Пока нет завершённых релевантных тестов"]).map((item) => (
              <span key={item} className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-3 py-1 text-xs text-[#6f5a42]">
                {item}
              </span>
            ))}
          </div>
        </div>
        {isAdmin ? (
          <Link href="/admin/competency-prompts" className="inline-flex rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]">
            Открыть prompt-админку
          </Link>
        ) : null}
      </div>
    );
  }

  if (detailNode.kind === "bridge") {
    return (
      <div className="space-y-3 text-sm leading-7 text-[#5f5446]">
        <div className="text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
        <div className="rounded-[20px] border border-[#e2d3bb] bg-white/80 px-4 py-3">{detailNode.node.text}</div>
        <div className="text-xs text-[#8b7760]">Это уже не сырые результаты тестов, а собранный промежуточный слой, из которого питается итог.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-7 text-[#5f5446]">
      <div className="text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
      <div className="rounded-[20px] border border-[#e2d3bb] bg-white/80 px-4 py-3">{detailNode.node.text}</div>
      <div className="text-xs text-[#8b7760]">Это верхний результат. Снаружи он короткий, а подробная логика остаётся в раскрываемом слое.</div>
    </div>
  );
}

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
  const [showMechanism, setShowMechanism] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      setSelectedId(payload.blueprint?.final.id || null);
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

  const stages = useMemo<FlowStage[]>(() => {
    if (!blueprint) return [];
    return [
      {
        id: "tests",
        title: "Тесты",
        caption: "Сырые блоки, из которых собирается контур.",
        nodes: blueprint.tests.map((item) => ({
          id: item.id,
          title: item.title,
          meta: item.completed ? "готово" : "ожидаем",
          body: item.summary,
          badges: item.badges,
          tone: item.completed ? "ready" : "muted",
        })),
      },
      {
        id: "competencies",
        title: "Компетенции",
        caption: "Промежуточные смысловые узлы с prompt-статусом.",
        nodes: blueprint.competencies.map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${item.score}/100 · ${item.promptLabel}`,
          body: item.short,
          badges: item.badges,
          footer: item.cluster,
          tone: item.promptSource === "custom" ? "ready" : item.promptSource === "default" ? "neutral" : "attention",
        })),
      },
      {
        id: "bridges",
        title: "Промежуточный результат",
        caption: "Сборка сильных сигналов, зон внимания и prompt-карты.",
        nodes: blueprint.bridges.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.text,
          tone: item.tone,
        })),
      },
      {
        id: "final",
        title: "Итог",
        caption: "Верхний результат для внешней выдачи.",
        nodes: [{ id: blueprint.final.id, title: blueprint.final.title, body: blueprint.final.text, tone: blueprint.final.tone }],
      },
    ];
  }, [blueprint]);

  const detailNode = useMemo<DetailNode | null>(() => {
    if (!blueprint || !selectedId) return null;
    const test = blueprint.tests.find((item) => item.id === selectedId);
    if (test) return { kind: "test", node: test };
    const competency = blueprint.competencies.find((item) => item.id === selectedId);
    if (competency) return { kind: "competency", node: competency };
    const bridge = blueprint.bridges.find((item) => item.id === selectedId);
    if (bridge) return { kind: "bridge", node: bridge };
    if (blueprint.final.id === selectedId) return { kind: "final", node: blueprint.final };
    return null;
  }, [blueprint, selectedId]);

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
  const coveragePercent = coverage ? Math.round(((coverage.custom + coverage.default) / Math.max(coverage.total, 1)) * 100) : 0;
  const statusItems = [
    { label: "Тестов", value: String(blueprint?.tests.length || 0) },
    { label: "Компетенций", value: String(blueprint?.competencies.length || 0) },
    { label: "Связей", value: String(blueprint?.links.length || 0) },
    { label: "Prompt", value: `${coveragePercent}%` },
  ];

  return (
    <Layout title={data?.project.title ? `${data.project.title} — результаты` : "Страница результатов"}>
      <div className="mx-auto max-w-[1290px] px-3 pb-10 pt-4 sm:px-4">
        {error ? <div className="mb-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {info ? <div className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}

        <div className="overflow-hidden rounded-[30px] border border-[#e7dbc7] bg-[#f9f5ee] shadow-[0_16px_38px_rgba(97,75,45,0.08)]">
          <div className="border-b border-[#ece2d3] bg-[#fcfaf6] px-5 py-4 sm:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium tracking-[0.08em] text-[#8a775c]">Результаты проекта</div>
                <div className="mt-2 text-[1.55rem] font-semibold leading-tight text-[#3b2f22] sm:text-[1.8rem]">{data?.project.title || "Проект"}</div>
                <div className="mt-3 text-[1.22rem] font-medium text-[#2d2a22]">{data?.project.person?.full_name || "Участник проекта"}</div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem] text-[#7b6a52]">
                  <span>{data?.fully_done ? "Тесты пройдены" : `Готово ${data?.completed || 0} из ${data?.total || 0}`}</span>
                  {collectedLabel ? <span>Собрано: {collectedLabel}</span> : null}
                </div>
              </div>

              <div className="flex items-start gap-3 xl:justify-end">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadResults(true, { announce: lastCollectedAt ? "Анализ пересобран по всей информации проекта." : "Анализ собран по всей информации проекта." })}
                    disabled={collecting || !data?.fully_done}
                    className="rounded-[16px] border border-[#d9cbb5] bg-white px-4 py-2.5 text-sm font-medium text-[#5f4b36] shadow-[0_4px_12px_rgba(97,75,45,0.04)] disabled:opacity-60"
                  >
                    {collecting ? "Пересобираем…" : "Пересобрать анализ"}
                  </button>
                  <Link href={`/projects/${projectId}`} className="rounded-[16px] border border-[#d9cbb5] bg-white px-4 py-2.5 text-sm font-medium text-[#5f4b36] shadow-[0_4px_12px_rgba(97,75,45,0.04)]">
                    Назад к проекту
                  </Link>
                </div>
                <div className="grid h-[88px] w-[88px] shrink-0 place-items-center sm:h-[98px] sm:w-[98px]">
                  <img
                    src={data?.fully_done ? "/result-stamp.svg" : "/result-stamp-bw.svg"}
                    alt={data?.fully_done ? "Результат собран" : "Результат ожидает"}
                    className="h-full w-full object-contain opacity-90"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7">
            {!data?.fully_done ? (
              <div className="rounded-[22px] border border-[#e4d8c5] bg-[#fffdf9] px-5 py-5 text-sm leading-7 text-[#6f6454]">
                Все уровни анализа откроются после завершения тестов. Сейчас готово {data?.completed || 0} из {data?.total || 0}.
              </div>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px]">
                  {EVALUATION_PACKAGES.map((item) => {
                    const unlocked = isPackageAccessible(unlockedMode, item.key);
                    const currentEval = evaluationByMode[item.key];
                    const isBusy = !!saving || !!evaluationLoading[item.key];
                    const accessible = unlocked || isUnlimited || projectCoveredBySubscription || (activeSubscription?.projects_remaining || 0) > 0;
                    const isActive = activeEvaluationMode === item.key;
                    const price = item.priceRub > 0 ? formatRub(item.priceRub) : "Входит в проект";
                    const highlight = item.key === "premium_ai_plus";
                    return (
                      <div
                        key={item.key}
                        className={`flex min-h-[228px] flex-col rounded-[24px] border px-5 py-4 ${isActive ? "border-[#a9c6a4] bg-[#f4faf2]" : highlight ? "border-[#cfdcc7] bg-[#fafcf8]" : "border-[#e5d9c6] bg-[#fffdf9]"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#8a7554]">{item.title}</div>
                            <div className="mt-3 text-[0.97rem] leading-7 text-[#695943]">{item.description}</div>
                          </div>
                          {item.key === "premium" ? <div className="rounded-full border border-[#b8ceb1] bg-[#edf5ea] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#52714f]">AI</div> : null}
                        </div>

                        <div className="mt-5 flex items-end justify-between gap-4">
                          <div>
                            <div className={`text-[1.55rem] font-semibold leading-none ${highlight ? "text-[#44603d]" : "text-[#433526]"}`}>{highlight ? "99%" : price}</div>
                            <div className="mt-2 text-sm text-[#7a6952]">{highlight ? "Индекс соответствия" : unlocked ? "Уровень доступен" : "Стоимость открытия"}</div>
                          </div>
                        </div>

                        <div className="mt-5 flex-1 space-y-2 text-sm leading-7 text-[#73614b]">
                          {(item.bullets || []).slice(0, 2).map((bullet) => (
                            <div key={bullet} className="flex items-start gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#cdb488]" />
                              <span>{bullet}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5">
                          {unlocked ? (
                            <button
                              type="button"
                              className={`w-full rounded-[16px] border px-4 py-2.5 text-sm font-medium ${isActive ? "border-[#8fb48d] bg-[#dceecd] text-[#27402b]" : "border-[#d9cbb5] bg-white text-[#5b4731]"}`}
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
                              className="w-full rounded-[16px] border border-[#88ab7f] bg-[#abd1a3] px-4 py-2.5 text-sm font-semibold text-[#264029] disabled:opacity-60"
                              disabled={isBusy || !accessible}
                              onClick={() => unlockPackage(item.key)}
                            >
                              {getPackageButtonLabel(item.key, unlockedMode, isUnlimited, activeSubscription, projectCoveredBySubscription)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <aside className="rounded-[24px] border border-[#e5d9c6] bg-[#fffdf9] px-4 py-4">
                    <div className="text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-[#8a7554]">Статус анализа</div>
                    <div className="mt-4 space-y-3">
                      {statusItems.map((item) => (
                        <div key={item.label} className="flex items-end justify-between gap-3 border-b border-[#f0e7d8] pb-2 last:border-b-0 last:pb-0">
                          <span className="text-sm text-[#7e6c55]">{item.label}</span>
                          <span className="text-lg font-semibold text-[#3f3225]">{item.value}</span>
                        </div>
                      ))}
                    </div>
                    {collectedLabel ? <div className="mt-5 text-xs leading-6 text-[#8a775f]">Последняя сборка: {collectedLabel}</div> : null}
                  </aside>
                </div>

                {activeEvaluationMode && isPackageAccessible(unlockedMode, activeEvaluationMode) ? (
                  <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_310px]">
                    <div className="min-w-0 rounded-[28px] border border-[#e5d9c6] bg-[#fffdf9] p-5 shadow-[0_8px_24px_rgba(97,75,45,0.04)]">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe5d6] pb-4">
                        <div className="flex flex-wrap gap-2">
                          {availablePackages.map((mode) => {
                            const selected = activeEvaluationMode === mode;
                            return (
                              <button
                                key={mode}
                                type="button"
                                className={`rounded-full px-4 py-2 text-sm font-medium ${selected ? "bg-[#29432d] text-white" : "border border-[#ded1bc] bg-white text-[#6a5943]"}`}
                                onClick={async () => {
                                  setActiveEvaluationMode(mode);
                                  if (!evaluationByMode[mode] && !evaluationLoading[mode]) {
                                    await loadEvaluation(mode, mode === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                                  }
                                }}
                              >
                                {getEvaluationPackageDefinition(mode)?.title || mode}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMechanism((prev) => !prev)}
                          className="rounded-[16px] border border-[#d9cbb5] bg-white px-4 py-2 text-sm font-medium text-[#5f4b36]"
                        >
                          {showMechanism ? "Скрыть механизм" : "Показать механизм"}
                        </button>
                      </div>

                      {activeEvaluationMode === "premium_ai_plus" && showAiPlusPrompt ? (
                        <div className="mt-4 rounded-[20px] border border-[#e7dbc8] bg-[#fbf8f2] p-4">
                          <div className="text-sm font-semibold text-[#2d2a22]">Уточнение для AI+</div>
                          <div className="mt-1 text-sm text-[#8d7860]">Добавь акцент и собери профиль заново.</div>
                          <div className="mt-3 grid gap-3">
                            <textarea className="input min-h-[92px]" value={aiPlusRequest} onChange={(e) => setAiPlusRequest(e.target.value)} placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска." />
                            <div className="flex justify-end">
                              <button type="button" className="rounded-[16px] border border-[#88ab7f] bg-[#abd1a3] px-4 py-2.5 text-sm font-semibold text-[#264029]" disabled={!!evaluationLoading.premium_ai_plus} onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}>
                                {evaluationLoading.premium_ai_plus ? "Собираем…" : "Обновить AI+"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : activeEvaluationMode === "premium_ai_plus" ? (
                        <div className="mt-4 flex justify-start">
                          <button
                            type="button"
                            onClick={() => setShowAiPlusPrompt(true)}
                            className="rounded-[16px] border border-[#d9cbb5] bg-white px-4 py-2 text-sm font-medium text-[#5f4b36]"
                          >
                            Уточнить AI+
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-5">
                        {evaluationLoading[activeEvaluationMode] ? (
                          <ThinkingStatus title={activeEvaluationMode === "premium_ai_plus" ? "AI+ формирует профиль" : activeEvaluationMode === "premium" ? "AI формирует интерпретацию" : "Собираем результат"} messages={getThinkingMessages(activeEvaluationMode)} />
                        ) : activeSections.length ? (
                          <>
                            <div className="rounded-[24px] border border-[#ece2d4] bg-[#fcfaf6] px-5 py-5">
                              <div className="text-[1.55rem] font-semibold leading-tight text-[#3f3225] sm:text-[1.75rem]">Итоговый аналитический вывод</div>
                              <div className="mt-2 text-sm leading-7 text-[#8a775f]">Краткая сводка по уровню {getEvaluationPackageDefinition(activeEvaluationMode)?.title || activeEvaluationMode}.</div>
                            </div>

                            {overviewCards.length ? (
                              <div className={`mt-5 grid gap-4 ${overviewCards.length > 1 ? "lg:grid-cols-2" : ""} ${overviewCards.length > 2 ? "2xl:grid-cols-3" : ""}`}>
                                {overviewCards.map((section, index) => {
                                  const key = sectionKey(`${activeEvaluationMode}:overview`, index);
                                  const isOpen = openSections[key] ?? false;
                                  const parts = splitSectionBody(section.body);
                                  const tone = inferSectionTone(section.title);
                                  const toneClass = tone === "positive" ? "border-[#d6e6ce] bg-[#f7fbf4]" : tone === "warning" ? "border-[#eadfc9] bg-[#fffaf2]" : "border-[#e7ddcf] bg-white";
                                  return (
                                    <div key={`${section.title}:${index}`} className={`rounded-[22px] border p-4 ${toneClass}`}>
                                      <div className="text-[1.02rem] font-semibold text-[#423526]">{section.title}</div>
                                      <div className="mt-3 whitespace-pre-line text-[0.98rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                      {parts.details ? (
                                        <button type="button" className="mt-4 text-sm font-medium text-[#876739]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                          {isOpen ? "Скрыть детали" : "Подробнее"}
                                        </button>
                                      ) : null}
                                      {parts.details && isOpen ? <div className="mt-3 border-t border-[#eee4d5] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            {testSections.length ? (
                              <div className="mt-5 rounded-[22px] border border-[#e7ddcf] bg-white p-4">
                                <div className="text-base font-semibold text-[#433526]">Подробности по отдельным тестам</div>
                                <div className="mt-4 grid gap-3">
                                  {testSections.map((section, index) => {
                                    const key = sectionKey(activeEvaluationMode, index);
                                    const isOpen = openSections[key] ?? index === 0;
                                    return (
                                      <div key={key} className="overflow-hidden rounded-[18px] border border-[#ece2d4] bg-[#fcfaf6]">
                                        <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))}>
                                          <div className="text-sm font-semibold text-[#2d2a22]">{section.title}</div>
                                          <span className="text-xs text-[#8b6b3c]">{isOpen ? "Скрыть" : "Открыть"}</span>
                                        </button>
                                        {isOpen ? <div className="border-t border-[#eee4d5] px-4 py-4 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{cleanSectionBody(section.body)}</div> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="rounded-[22px] border border-[#e7ddcf] bg-[#fcfaf6] p-4 text-sm text-[#6f6454]">Результат для этого уровня пока не собран. Выбери уровень и нажми сборку.</div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 space-y-4">
                      <div className="rounded-[24px] border border-[#e5d9c6] bg-[#fffdf9] p-4">
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8a7554]">Паспорт карты</div>
                        <div className="mt-3 space-y-2 text-sm leading-7 text-[#6f6454]">
                          <div>{stageCountLine(blueprint!)}</div>
                          <div>{promptCoverageLine(blueprint!)}</div>
                          <div>Режим сбора: {data?.collect_mode === "collect" ? "Явная сборка" : "Просмотр"}</div>
                        </div>
                      </div>

                      {showMechanism && blueprint ? (
                        <>
                          <div className="rounded-[24px] border border-[#e5d9c6] bg-[#fffdf9] p-4">
                            <ProjectResultsFlow stages={stages} links={blueprint.links} selectedId={selectedId} onSelect={setSelectedId} />
                          </div>
                          <aside className="rounded-[24px] border border-[#e5d9c6] bg-[#fffdf9] p-4">
                            <DetailContent detailNode={detailNode} isAdmin={isAdminEmail(user.email)} />
                          </aside>
                        </>
                      ) : (
                        <div className="rounded-[24px] border border-[#e5d9c6] bg-[#fffdf9] p-4 text-sm leading-7 text-[#6f6454]">
                          Внутренний механизм скрыт. Открой его, чтобы увидеть цепочку: тесты → компетенции → промежуточный результат → итог.
                        </div>
                      )}
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
