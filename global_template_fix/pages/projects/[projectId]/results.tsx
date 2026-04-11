import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [packageHelp, setPackageHelp] = useState<EvaluationPackage | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<WorkspaceSubscriptionStatus | null>(null);
  const [fitProfiles, setFitProfiles] = useState<FitRoleProfile[]>(() => getFitRoleProfiles());
  const mechanismRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <Layout title={data?.project.title ? `${data.project.title} — результаты` : "Страница результатов"}>
      <div className="mx-auto max-w-[1260px] px-3 pb-12 pt-3 sm:px-4">
        {error ? <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {info ? <div className="mb-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div> : null}

        <div className="rounded-[36px] border border-[#dcc8aa] bg-[linear-gradient(180deg,#fffdfa_0%,#f5eee2_100%)] p-4 shadow-[0_26px_60px_rgba(93,71,39,0.12)] sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eadcc5] pb-5">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#9d7a4b]">Страница результатов проекта</div>
              <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight text-[#2d2a22] sm:text-[2.1rem]">{data?.project.title || "Проект"}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#7b664f]">
                <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">{statusLabel(data?.project.status)}</span>
                <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">Тесты: {data?.completed}/{data?.total}</span>
                {data?.project.person?.full_name ? <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">Участник: {data.project.person.full_name}</span> : null}
                {data?.project.person?.current_position ? <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">Позиция: {data.project.person.current_position}</span> : null}
                {unlockedMode ? <span className="rounded-full border border-[#b9d2b3] bg-[#edf7e7] px-3 py-1 text-[#355039]">Открыт уровень: {getEvaluationPackageDefinition(unlockedMode)?.shortTitle || unlockedMode}</span> : null}
              </div>
              <div className="mt-3 text-sm text-[#6f5a42]">
                Здесь живут все три степени анализа ИИ со своими ценниками, а также карта prompt-механизма и взаимосвязей между тестами, компетенциями и итогом.
              </div>
              {lastCollectedAt ? <div className="mt-2 text-xs text-[#8b7760]">Последняя явная сборка карты: {formatCollectedAt(lastCollectedAt)}</div> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/projects/${projectId}`} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731] shadow-[0_8px_18px_rgba(93,71,39,0.08)]">
                Назад к проекту
              </Link>
              {blueprint ? (
                <button
                  type="button"
                  onClick={() => loadResults(true, { announce: lastCollectedAt ? "Карта пересобрана по всей информации проекта." : "Карта собрана по всей информации проекта." })}
                  disabled={collecting}
                  className="rounded-2xl border border-[#7ca36f] bg-[#d9ead3] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.14)] disabled:opacity-60"
                >
                  {collecting ? "Собираем…" : lastCollectedAt ? "Пересобрать карту" : "Собрать карту"}
                </button>
              ) : null}
              {isAdminEmail(user.email) ? (
                <Link href="/admin/competency-prompts" className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731] shadow-[0_8px_18px_rgba(93,71,39,0.08)]">
                  AI-промты компетенций
                </Link>
              ) : null}
            </div>
          </div>

          {!data?.fully_done ? (
            <div className="mt-6 rounded-[28px] border border-[#d8c5a8] bg-[#fbf5ea] px-5 py-5 text-sm leading-7 text-[#6f6454] shadow-[0_16px_34px_rgba(93,71,39,0.08)]">
              Все уровни анализа откроются после завершения тестов. Сейчас готово {data?.completed || 0} из {data?.total || 0}.
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {EVALUATION_PACKAGES.map((item) => {
                  const unlocked = isPackageAccessible(unlockedMode, item.key);
                  const currentEval = evaluationByMode[item.key];
                  const isBusy = !!saving || !!evaluationLoading[item.key];
                  const upgradeRub = getUpgradePriceRub(unlockedMode, item.key);
                  const accessible = unlocked || isUnlimited || projectCoveredBySubscription || (activeSubscription?.projects_remaining || 0) > 0;
                  const isActive = activeEvaluationMode === item.key;
                  return (
                    <div key={item.key} className={`rounded-[26px] border p-5 shadow-[0_12px_28px_rgba(93,71,39,0.08)] ${isActive ? "border-[#8eb48d] bg-[#f3faef]" : "border-[#dfcfb5] bg-[#fffaf1]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">{item.note || "уровень анализа"}</div>
                          <div className="mt-2 text-xl font-semibold text-[#2d2a22]">{item.title}</div>
                          <div className="mt-2 text-sm leading-6 text-[#7a6a57]">{item.description}</div>
                        </div>
                        <button type="button" className="text-xs font-medium text-[#8b6b3c]" onClick={() => setPackageHelp((prev) => (prev === item.key ? null : item.key))}>Что внутри?</button>
                      </div>
                      <div className="mt-4 rounded-[18px] border border-[#eadcc5] bg-white/75 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Цена</div>
                        <div className="mt-2 text-2xl font-semibold text-[#2d2a22]">{formatRub(item.priceRub)}</div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm leading-6 text-[#5f5446]">
                        {item.bullets.map((bullet) => (
                          <li key={bullet} className="rounded-[16px] border border-[#eadcc5] bg-white/65 px-3 py-2">• {bullet}</li>
                        ))}
                      </ul>
                      {packageHelp === item.key && item.helpText ? <div className="mt-4 rounded-[20px] border border-[#ecdcbf] bg-white/70 p-3 text-sm leading-6 text-[#685742]">{item.helpText}</div> : null}
                      <div className="mt-4 text-sm font-semibold text-[#2f5031]">
                        {unlocked
                          ? currentEval?.evaluation
                            ? "Результат уже собран"
                            : "Уровень открыт и готов к сборке"
                          : accessible
                          ? projectCoveredBySubscription
                            ? "Откроется по тарифу"
                            : activeSubscription?.projects_remaining
                            ? `Осталось ${activeSubscription.projects_remaining} проектов по тарифу`
                            : "Можно открыть"
                          : upgradeRub
                          ? `Стоимость открытия: ${formatRub(upgradeRub)}`
                          : "Доступно после предыдущего уровня"}
                      </div>
                      <div className="mt-4 space-y-2">
                        {unlocked ? (
                          <button
                            type="button"
                            className={`w-full rounded-2xl border px-4 py-2.5 text-sm font-medium ${isActive ? "border-[#8eb48d] bg-[#cde7c1] text-[#27402b]" : "border-[#d9c4a4] bg-[#fffaf0] text-[#5b4731]"}`}
                            onClick={async () => {
                              setActiveEvaluationMode(item.key);
                              if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) {
                                await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                              }
                            }}
                          >
                            {isActive ? "Показано ниже" : currentEval?.evaluation ? "Показать результат" : "Собрать и показать"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="w-full rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] disabled:opacity-60"
                            disabled={isBusy}
                            onClick={() => unlockPackage(item.key)}
                          >
                            {getPackageButtonLabel(item.key, unlockedMode, isUnlimited, activeSubscription, projectCoveredBySubscription)}
                          </button>
                        )}
                        {!accessible && !isUnlimited && !projectCoveredBySubscription && !(activeSubscription && activeSubscription.projects_remaining > 0) && balance_rub < upgradeRub ? (
                          <div className="text-xs text-amber-700">Не хватает {formatRub(upgradeRub - balance_rub)}.</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeSubscription ? (
                <div className="mt-4 rounded-[24px] border border-[#d8c5a8] bg-white/70 px-4 py-3 text-sm text-[#6f5a42]">
                  Активен месячный тариф до {formatMonthlySubscriptionPeriod(activeSubscription.expires_at)} · осталось {activeSubscription.projects_remaining} проектов.
                </div>
              ) : null}

              {activeEvaluationMode && isPackageAccessible(unlockedMode, activeEvaluationMode) ? (
                <div className="mt-6 rounded-[30px] border border-[#d7c4a6] bg-[#fffaf1] p-5 shadow-[0_18px_38px_rgba(93,71,39,0.10)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead9bf] pb-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Активный уровень анализа</div>
                      <div className="mt-2 text-2xl font-semibold text-[#2d2a22]">{getEvaluationPackageDefinition(activeEvaluationMode)?.title || "Результат"}</div>
                      <div className="mt-1 text-sm text-[#8d7860]">Три степени анализа теперь живут отдельно от страницы проекта.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availablePackages.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeEvaluationMode === mode ? "border-[#8eb48d] bg-[#e4f1de] text-[#355039]" : "border-[#dec9a8] bg-[#fff8ec] text-[#6b5943]"}`}
                          onClick={async () => {
                            setActiveEvaluationMode(mode);
                            if (!evaluationByMode[mode] && !evaluationLoading[mode]) {
                              await loadEvaluation(mode, mode === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                            }
                          }}
                        >
                          {getEvaluationPackageDefinition(mode)?.shortTitle || mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeEvaluationMode === "premium_ai_plus" ? (
                    <div className="mt-4 rounded-[24px] border border-[#e2d1b6] bg-[#fcf7ef] p-4">
                      <div className="text-sm font-semibold text-[#2d2a22]">Дополнительный запрос к Премиум AI+</div>
                      <div className="mt-1 text-sm text-[#8d7860]">Можно задать акцент анализа и отдельно включить индекс соответствия.</div>
                      <div className="mt-3 grid gap-4">
                        <textarea className="input min-h-[96px]" value={aiPlusRequest} onChange={(e) => setAiPlusRequest(e.target.value)} placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска." />
                        <label className="flex items-start gap-3 rounded-[20px] border border-[#e1d3bf] bg-white/60 px-4 py-3 text-sm text-[#6f6454]">
                          <input type="checkbox" className="mt-1 h-4 w-4" checked={fitRequested} onChange={(e) => setFitRequested(e.target.checked)} />
                          <span>
                            <span className="font-medium text-[#2d2a22]">Считать индекс соответствия</span>
                            <span className="mt-1 block text-xs leading-5 text-[#8d7860]">Включай только если нужно проверить соответствие конкретной роли или ожиданиям.</span>
                          </span>
                        </label>
                        {fitRequested ? (
                          <div className="grid gap-3">
                            <select className="input" value={fitProfileId} onChange={(e) => setFitProfileId(e.target.value)}>
                              <option value="">Автоопределение по запросу / роли</option>
                              {fitProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>{profile.label}</option>
                              ))}
                            </select>
                            <textarea className="input min-h-[84px]" value={fitRequest} onChange={(e) => setFitRequest(e.target.value)} placeholder="Например: соответствие роли руководителя отдела продаж или ожиданиям по самостоятельности, влиянию и стрессоустойчивости." />
                          </div>
                        ) : null}
                        <div className="flex justify-end">
                          <button type="button" className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029]" disabled={!!evaluationLoading.premium_ai_plus} onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}>
                            {evaluationLoading.premium_ai_plus ? "Собираем…" : "Обновить AI+"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {evaluationLoading[activeEvaluationMode] ? (
                    <ThinkingStatus title={activeEvaluationMode === "premium_ai_plus" ? "AI+ формирует профиль" : activeEvaluationMode === "premium" ? "AI формирует интерпретацию" : "Собираем результат"} messages={getThinkingMessages(activeEvaluationMode)} />
                  ) : activeSections.length ? (
                    <div className="mt-4 grid gap-4">
                      {overviewSections.length ? (
                        <div className={`grid gap-3 ${overviewSections.length > 1 ? "md:grid-cols-2" : ""}`}>
                          {overviewSections.map((section, index) => {
                            const key = sectionKey(`${activeEvaluationMode}:overview`, index);
                            const isOpen = openSections[key] ?? false;
                            const parts = splitSectionBody(section.body);
                            const hasDetails = Boolean(parts.details);
                            return (
                              <div key={`${section.title}:${index}`} className="rounded-[22px] border border-[#dfcfb5] bg-[#fffaf1] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-sm font-semibold text-[#2d2a22]">{section.title}</div>
                                  {hasDetails ? <button type="button" className="text-xs font-medium text-[#8b6b3c]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>{isOpen ? "Скрыть детали" : "Подробнее"}</button> : null}
                                </div>
                                <div className="mt-2 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.preview}</div>
                                {hasDetails && isOpen ? <div className="mt-3 whitespace-pre-line border-t border-[#ead9bf] pt-3 text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {testSections.length ? (
                        <div className="rounded-[22px] border border-[#dfcfb5] bg-[#fffaf1] p-4">
                          <div className="text-sm font-semibold text-[#2d2a22]">По отдельным тестам</div>
                          <div className="mt-1 text-sm text-[#8d7860]">Открывай только те методики, которые нужно посмотреть сейчас.</div>
                          <div className="mt-4 grid gap-3">
                            {testSections.map((section, index) => {
                              const key = sectionKey(activeEvaluationMode, index);
                              const isOpen = openSections[key] ?? index === 0;
                              return (
                                <div key={key} className="overflow-hidden rounded-[20px] border border-[#e2d1b6] bg-white/70">
                                  <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))}>
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
                  ) : (
                    <div className="mt-4 rounded-[22px] border border-[#e1d3bf] bg-[#fcf7ef] p-4 text-sm text-[#6f6454]">Результат для этого уровня пока не собран. Выбери уровень и нажми сборку.</div>
                  )}
                </div>
              ) : null}

              {blueprint ? (
                <div ref={mechanismRef} className="mt-6 rounded-[30px] border border-[#d8c5a8] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe4_100%)] p-5 shadow-[0_18px_38px_rgba(93,71,39,0.10)]">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eadcc5] pb-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Механизм и prompt-карта</div>
                      <div className="mt-2 text-lg font-semibold text-[#2d2a22]">Тесты → компетенции → промежуточный результат → итог</div>
                      <div className="mt-1 text-sm leading-6 text-[#8b7760]">Здесь живут все prompt-настройки из админки, статусы покрытий и вся причинно-следственная цепочка результата.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full border border-[#e2d3bb] bg-white/70 px-3 py-1 text-xs text-[#6f5a42]">{promptCoverageLine(blueprint)}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMechanism((prev) => !prev);
                          if (!showMechanism) setTimeout(() => mechanismRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
                        }}
                        className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)]"
                      >
                        {showMechanism ? "Скрыть механизм" : "Открыть механизм"}
                      </button>
                    </div>
                  </div>
                  {showMechanism ? (
                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                      <ProjectResultsFlow stages={stages} links={blueprint.links} selectedId={selectedId} onSelect={setSelectedId} />
                      <aside className="rounded-[30px] border border-[#d8c5a8] bg-[linear-gradient(180deg,#fffaf2_0%,#f7efe3_100%)] p-5 shadow-[0_20px_42px_rgba(93,71,39,0.10)] xl:sticky xl:top-4">
                        <div className="text-sm font-semibold text-[#2d2a22]">Деталь выбранного узла</div>
                        <div className="mt-4"><DetailContent detailNode={detailNode} isAdmin={isAdminEmail(user.email)} /></div>
                      </aside>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[22px] border border-dashed border-[#d8c5a8] bg-white/60 px-4 py-4 text-sm leading-7 text-[#6f6454]">
                      Механизм скрыт. Открой его, чтобы увидеть все связи, prompt-статусы, промежуточные узлы и финальный результат.
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
