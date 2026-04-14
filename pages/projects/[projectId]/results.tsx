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
  const price = getUpgradePriceRub(mode, unlockedMode);
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
        url.searchParams.set("fit_enabled", "1");
        if (fitProfileId) url.searchParams.set("fit_profile_id", fitProfileId);
        if (fitRequest.trim()) url.searchParams.set("fit_request", fitRequest.trim());
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
  const activePackageDefinition = getEvaluationPackageDefinition(activeEvaluationMode);
  const packageSummaryTitle = activePackageDefinition?.title || "";
  const filteredOverviewSections = overviewSections.filter((item) => item.title !== packageSummaryTitle);
  const shortConclusionSection = filteredOverviewSections.find((item) => /короткий вывод/i.test(item.title)) || null;
  const fitSections = filteredOverviewSections.filter((item) => /индекс соответствия/i.test(item.title));
  const focusSection = filteredOverviewSections.find((item) => /фокус анализа/i.test(item.title)) || null;
  const profileContextSection = filteredOverviewSections.find((item) => /контекст профиля/i.test(item.title)) || null;
  const keyIndicatorsSection = filteredOverviewSections.find((item) => /ключевые показатели/i.test(item.title)) || null;
  const competencySections = filteredOverviewSections.filter((item) => item.kind === "development");
  const usedOverviewSections = new Set([
    ...(shortConclusionSection ? [shortConclusionSection] : []),
    ...fitSections,
    ...(focusSection ? [focusSection] : []),
    ...(profileContextSection ? [profileContextSection] : []),
    ...(keyIndicatorsSection ? [keyIndicatorsSection] : []),
    ...competencySections,
  ]);
  const additionalOverviewSections = filteredOverviewSections.filter((item) => !usedOverviewSections.has(item));
  const metaOverviewSections = [...fitSections, ...(focusSection ? [focusSection] : []), ...(profileContextSection ? [profileContextSection] : [])];
  const coveragePercent = coverage ? Math.round(((coverage.custom + coverage.default) / Math.max(coverage.total, 1)) * 100) : 0;

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
                              {item.bullets.slice(0, 3).map((bullet) => (
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
                      <div className="mt-5 rounded-[22px] border border-[#e2d1b6] bg-[#fcf7ef] p-4">
                        <div className="text-sm font-semibold text-[#2d2a22]">Уточнение для AI+</div>
                        <div className="mt-1 text-sm text-[#8d7860]">Можно уточнить акцент итогового профиля. Индекс соответствия по выбранной цели теперь входит в AI+ по умолчанию.</div>
                        <div className="mt-3 grid gap-3">
                          <textarea className="input min-h-[92px]" value={aiPlusRequest} onChange={(e) => setAiPlusRequest(e.target.value)} placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска." />
                          <div className="flex justify-end">
                            <button type="button" className="rounded-[18px] border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029]" disabled={!!evaluationLoading.premium_ai_plus} onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}>
                              {evaluationLoading.premium_ai_plus ? "Собираем…" : "Обновить профиль AI+"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : activeEvaluationMode === "premium_ai_plus" ? (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAiPlusPrompt(true)}
                          className="rounded-[18px] border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]"
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
                          <div className="rounded-[28px] border border-[#e2d1b6] bg-white/72 p-6 shadow-[0_10px_22px_rgba(93,71,39,0.04)]">
                            <div className="font-serif text-[2rem] leading-tight text-[#4d3b24]">Итоговый аналитический вывод</div>
                            {metaOverviewSections.length ? (
                              <div className={`mt-6 grid gap-5 ${metaOverviewSections.length > 1 ? "xl:grid-cols-3" : ""}`}>
                                {metaOverviewSections.map((section, index) => {
                                  const key = sectionKey(`${activeEvaluationMode}:meta`, index);
                                  const isOpen = openSections[key] ?? false;
                                  const parts = splitSectionBody(section.body);
                                  const tone = /индекс соответствия/i.test(section.title) ? "positive" : inferSectionTone(section.title);
                                  const toneClass = tone === "positive" ? "bg-[#f7fcf4] border-[#d8e7cf]" : tone === "warning" ? "bg-[#fffaf2] border-[#eddcc0]" : "bg-[#fffdf8] border-[#ead9bf]";
                                  return (
                                    <div key={`${section.title}:${index}`} className={`rounded-[24px] border p-5 ${toneClass}`}>
                                      <div className="font-serif text-[1.24rem] text-[#4d3b24]">{section.title}</div>
                                      <div className="mt-4 whitespace-pre-line text-[1rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                      {parts.details ? (
                                        <button type="button" className="mt-4 text-sm font-medium text-[#8b6b3c]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                          {isOpen ? "Скрыть детали" : "Подробнее"}
                                        </button>
                                      ) : null}
                                      {parts.details && isOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            {shortConclusionSection ? (() => {
                              const key = sectionKey(`${activeEvaluationMode}:short`, 0);
                              const isOpen = openSections[key] ?? false;
                              const parts = splitSectionBody(shortConclusionSection.body);
                              return (
                                <div className="mt-5 rounded-[24px] border border-[#e3d4bf] bg-[linear-gradient(180deg,#fffdf9_0%,#fcf6eb_100%)] p-5 shadow-[0_8px_18px_rgba(93,71,39,0.04)]">
                                  <div className="font-serif text-[1.45rem] text-[#4d3b24]">{shortConclusionSection.title}</div>
                                  <div className="mt-4 whitespace-pre-line text-[1.04rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                  {parts.details ? (
                                    <button type="button" className="mt-4 text-sm font-medium text-[#8b6b3c]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                      {isOpen ? "Скрыть детали" : "Подробнее"}
                                    </button>
                                  ) : null}
                                  {parts.details && isOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                </div>
                              );
                            })() : null}

                            {keyIndicatorsSection ? (() => {
                              const key = sectionKey(`${activeEvaluationMode}:indicators`, 0);
                              const isOpen = openSections[key] ?? true;
                              const parts = splitSectionBody(keyIndicatorsSection.body);
                              return (
                                <div className="mt-5 rounded-[24px] border border-[#d8e7cf] bg-[#f8fcf5] p-5">
                                  <div className="font-serif text-[1.28rem] text-[#355033]">{keyIndicatorsSection.title}</div>
                                  <div className="mt-4 whitespace-pre-line text-[0.98rem] leading-8 text-[#4d5f44]">{parts.preview}</div>
                                  {parts.details ? (
                                    <button type="button" className="mt-4 text-sm font-medium text-[#6a8a52]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                      {isOpen ? "Скрыть детали" : "Подробнее"}
                                    </button>
                                  ) : null}
                                  {parts.details && isOpen ? <div className="mt-3 border-t border-[#d8e7cf] pt-3 whitespace-pre-line text-sm leading-7 text-[#5f6b56]">{parts.details}</div> : null}
                                </div>
                              );
                            })() : null}

                            {competencySections.length ? (
                              <div className="mt-6 rounded-[24px] border border-[#ead9bf] bg-[#fffdf8] p-5">
                                <div className="text-lg font-semibold text-[#4d3b24]">Профиль по компетенциям</div>
                                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                  {competencySections.map((section, index) => {
                                    const key = sectionKey(`${activeEvaluationMode}:competency`, index);
                                    const isOpen = openSections[key] ?? false;
                                    const parts = splitSectionBody(section.body);
                                    const tone = inferSectionTone(section.title);
                                    const toneClass = tone === "positive" ? "bg-[#f7fcf4] border-[#d8e7cf]" : tone === "warning" ? "bg-[#fffaf2] border-[#eddcc0]" : "bg-white border-[#ead9bf]";
                                    return (
                                      <div key={key} className={`rounded-[22px] border p-5 ${toneClass}`}>
                                        <div className="font-serif text-[1.2rem] text-[#4d3b24]">{section.title}</div>
                                        <div className="mt-3 whitespace-pre-line text-[0.98rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                        {parts.details ? (
                                          <button type="button" className="mt-4 text-sm font-medium text-[#8b6b3c]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                            {isOpen ? "Скрыть детали" : "Подробнее"}
                                          </button>
                                        ) : null}
                                        {parts.details && isOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {additionalOverviewSections.length ? (
                              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                                {additionalOverviewSections.map((section, index) => {
                                  const key = sectionKey(`${activeEvaluationMode}:overview:extra`, index);
                                  const isOpen = openSections[key] ?? false;
                                  const parts = splitSectionBody(section.body);
                                  return (
                                    <div key={`${section.title}:${index}`} className="rounded-[24px] border border-[#ead9bf] bg-[#fffdf8] p-5">
                                      <div className="font-serif text-[1.24rem] text-[#4d3b24]">{section.title}</div>
                                      <div className="mt-4 whitespace-pre-line text-[1rem] leading-8 text-[#6f5a42]">{parts.preview}</div>
                                      {parts.details ? (
                                        <button type="button" className="mt-4 text-sm font-medium text-[#8b6b3c]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                          {isOpen ? "Скрыть детали" : "Подробнее"}
                                        </button>
                                      ) : null}
                                      {parts.details && isOpen ? <div className="mt-3 border-t border-[#ead9bf] pt-3 whitespace-pre-line text-sm leading-7 text-[#6f6454]">{parts.details}</div> : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}

                            {testSections.length ? (
                              <div className="mt-6 rounded-[24px] border border-[#ead9bf] bg-[#fffdf8] p-5">
                                <div className="text-lg font-semibold text-[#4d3b24]">Подробности по отдельным тестам</div>
                                <div className="mt-4 grid gap-3">
                                  {testSections.map((section, index) => {
                                    const key = sectionKey(activeEvaluationMode, index);
                                    const isOpen = openSections[key] ?? index === 0;
                                    return (
                                      <div key={key} className="overflow-hidden rounded-[20px] border border-[#e2d1b6] bg-white/82">
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
