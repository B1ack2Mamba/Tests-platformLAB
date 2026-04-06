import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { ThinkingStatus } from "@/components/ThinkingStatus";
import { useWalletBalance } from "@/lib/useWalletBalance";
import {
  COMMERCIAL_GOALS,
  EVALUATION_PACKAGES,
  getEvaluationPackageDefinition,
  getUpgradePriceRub,
  isPackageAccessible,
  getGoalDefinition,
  type AssessmentGoal,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import { formatMonthlySubscriptionPeriod, type WorkspaceSubscriptionStatus } from "@/lib/commercialSubscriptions";
import { getFitRoleProfiles, type FitRoleProfile } from "@/lib/fitProfiles";
import { getCompetencyNames } from "@/lib/competencyRouter";
import type { ProjectRoutingMeta } from "@/lib/projectRoutingMeta";

type ProjectPayload = {
  ok: true;
  workspace: { workspace_id: string; role: string; name: string };
  project: {
    id: string;
    title: string;
    goal: AssessmentGoal;
    package_mode: string;
    unlocked_package_mode: EvaluationPackage | null;
    unlocked_package_paid_at: string | null;
    unlocked_package_price_kopeks: number;
    subscription_applied?: boolean;
    target_role: string | null;
    status: string;
    summary: string | null;
    routing_meta?: ProjectRoutingMeta | null;
    invite_token: string | null;
    created_at: string;
    person: {
      id: string;
      full_name: string;
      email: string | null;
      current_position: string | null;
      notes?: string | null;
    } | null;
    tests: Array<{ test_slug: string; test_title: string; sort_order: number }>;
    attempts: Array<{ test_slug: string; test_title?: string; created_at: string; result?: any }>;
  };
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

function formatStatus(status: string | null | undefined) {
  switch (status) {
    case "completed":
      return "Завершён";
    case "active":
      return "Активен";
    case "draft":
    default:
      return "Черновик";
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


function formatProjectModeLabel(meta: ProjectRoutingMeta | null | undefined) {
  if (meta?.mode === "competency") return "Оценка по компетенциям";
  return "Оценка по цели";
}

function getProjectPaperTitle(meta: ProjectRoutingMeta | null | undefined, fallback: string) {
  if (meta?.mode === "competency") return "Проект оценки по компетенциям";
  return fallback || "Проект оценки";
}

function getTestStateStyles(state: "not_started" | "in_progress" | "completed") {
  if (state === "completed") return { label: "Завершен", pill: "border-[#c8d1c5] bg-[#eef3ea] text-[#516451]", dot: "bg-[#8ea486]" };
  if (state === "in_progress") return { label: "В процессе", pill: "border-[#eadfcb] bg-[#fbf4ea] text-[#8f7752]", dot: "bg-[#cfb688]" };
  return { label: "Не пройден", pill: "border-[#e5dccf] bg-[#faf6ef] text-[#7c6f60]", dot: "bg-[#d7c4a3]" };
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

export default function ProjectDetailsPage() {
  const { session, user, loading: sessionLoading } = useSession();
  const { balance_rub, refresh: refreshWallet, loading: walletLoading, isUnlimited } = useWalletBalance();
  const router = useRouter();
  const projectId = typeof router.query.projectId === "string" ? router.query.projectId : "";
  const [data, setData] = useState<ProjectPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [copied, setCopied] = useState(false);
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

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    current_position: "",
    goal: "role_fit" as AssessmentGoal,
    target_role: "",
    notes: "",
  });

  async function loadProject() {
    if (!session || !projectId) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`/api/commercial/projects/get?id=${encodeURIComponent(projectId)}`, {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить проект");
      setData(json);
      setForm({
        full_name: json.project.person?.full_name || "",
        email: json.project.person?.email || "",
        current_position: json.project.person?.current_position || "",
        goal: json.project.goal,
        target_role: json.project.target_role || "",
        notes: json.project.person?.notes || "",
      });
    } catch (err: any) {
      setError(err?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function loadEvaluation(mode: EvaluationPackage, opts?: { customRequest?: string }) {
    if (!session || !projectId) return;
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
        if (fitRequested && fitProfileId) {
          url.searchParams.set("fit_profile_id", fitProfileId);
        }
        if (fitRequested && fitRequest.trim()) {
          url.searchParams.set("fit_request", fitRequest.trim());
        }
      }
      const resp = await fetch(url.toString(), {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить уровень оценки");
      setEvaluationByMode((prev) => ({ ...prev, [mode]: json }));
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить уровень оценки");
    } finally {
      setEvaluationLoading((prev) => ({ ...prev, [mode]: false }));
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

  useEffect(() => {
    let cancelled = false;
    async function loadFitProfiles() {
      try {
        const resp = await fetch("/api/commercial/fit-config/options");
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok || !Array.isArray(json?.profiles)) return;
        if (!cancelled && json.profiles.length) {
          setFitProfiles(json.profiles);
        }
      } catch {
        // fallback to embedded presets
      }
    }
    loadFitProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || !user) {
      router.replace(`/auth?next=${encodeURIComponent(router.asPath || "/dashboard")}`);
      return;
    }
    if (!projectId) return;
    loadProject();
    loadSubscriptionStatus();
  }, [projectId, router, session, sessionLoading, user]);

  const goal = useMemo(() => getGoalDefinition(data?.project.goal), [data?.project.goal]);
  const completedSet = useMemo(() => new Set((data?.project.attempts || []).filter((item) => item.result).map((item) => item.test_slug)), [data?.project.attempts]);
  const startedSet = useMemo(() => new Set((data?.project.attempts || []).map((item) => item.test_slug)), [data?.project.attempts]);
  const unlockedMode = data?.project.unlocked_package_mode || null;
  const projectCoveredBySubscription = Boolean(data?.project.subscription_applied);
  const shareUrl = useMemo(() => {
    const token = data?.project.invite_token;
    if (!token) return "";
    if (typeof window !== "undefined") return `${window.location.origin}/invite/${token}`;
    return `/invite/${token}`;
  }, [data?.project.invite_token]);
  const progress = useMemo(() => {
    const total = data?.project.tests?.length || 0;
    const completed = completedSet.size;
    return { completed, total };
  }, [completedSet, data?.project.tests?.length]);
  const fullyDone = progress.total > 0 && progress.completed >= progress.total;
  const selectedCompetencyNames = useMemo(() => getCompetencyNames(data?.project.routing_meta?.competencyIds || []), [data?.project.routing_meta?.competencyIds]);
  const projectModeLabel = useMemo(() => formatProjectModeLabel(data?.project.routing_meta), [data?.project.routing_meta]);
  const paperTitle = useMemo(() => getProjectPaperTitle(data?.project.routing_meta, goal?.shortTitle || "Проект оценки"), [data?.project.routing_meta, goal?.shortTitle]);

  useEffect(() => {
    if (!fullyDone || !unlockedMode) return;
    const available = EVALUATION_PACKAGES.filter((item) => isPackageAccessible(unlockedMode, item.key)).map((item) => item.key);
    available.forEach((mode) => {
      if (!evaluationByMode[mode] && !evaluationLoading[mode]) loadEvaluation(mode);
    });
    setActiveEvaluationMode((prev) => prev || available[available.length - 1] || null);
  }, [fullyDone, unlockedMode]);

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function saveDetails() {
    if (!session || !data?.project.id) return;
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const resp = await fetch("/api/commercial/projects/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          project_id: data.project.id,
          person_name: form.full_name,
          person_email: form.email,
          current_position: form.current_position,
          goal: form.goal,
          target_role: form.target_role,
          notes: form.notes,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить изменения");
      setInfo("Данные проекта обновлены.");
      setEditing(false);
      await loadProject();
      setEvaluationByMode({});
    } catch (err: any) {
      setError(err?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!session || !data?.project.id) return;
    if (!window.confirm("Удалить проект? Приглашение и результаты по нему тоже будут удалены.")) return;
    setSaving(true);
    setError("");
    try {
      const resp = await fetch("/api/commercial/projects/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: data.project.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить проект");
      await router.push("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Ошибка");
      setSaving(false);
    }
  }

  async function unlockPackage(mode: EvaluationPackage) {
    if (!session || !data?.project.id) return;
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
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось открыть уровень результата");
      const chargedRub = Number(json?.charged_rub || 0);
      if (json?.used_subscription) {
        setInfo(`Уровень «${getEvaluationPackageDefinition(mode)?.title || mode}» открыт по месячному тарифу.${Number.isFinite(Number(json?.subscription_remaining)) ? ` Осталось ${Number(json?.subscription_remaining)} проектов.` : ""}`);
      } else {
        setInfo(chargedRub > 0 ? `Уровень «${getEvaluationPackageDefinition(mode)?.title || mode}» открыт.` : "Уровень уже был открыт.");
      }
      await loadProject();
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

  const activeSections = activeEvaluationMode && evaluationByMode[activeEvaluationMode]?.evaluation?.sections
    ? evaluationByMode[activeEvaluationMode]!.evaluation!.sections
    : [];
  const overviewSections = activeSections.filter((section) => section.kind !== "test");
  const testSections = activeSections.filter((section) => section.kind === "test");

  if (!session || !user) {
    return (
      <Layout title="Проект оценки">
        <div className="card text-sm text-slate-700">Переадресация на вход…</div>
      </Layout>
    );
  }

  return (
    <Layout title={data?.project.title || "Проект оценки"}>
      <div className="space-y-6">
        <div className="rounded-[22px] border border-[#ded6c8] bg-[#f5efe4] px-4 py-3 shadow-[0_10px_30px_rgba(117,92,50,0.08)]">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#7d6b57]">
            <span className="rounded-full border border-[#ddd1bc] bg-[#fbf7ef] px-3 py-1.5">{data?.workspace.name || "Рабочее пространство"} / ID проекта #{projectId.slice(0, 6) || "—"}</span>
            <Link href="/dashboard" className="rounded-xl border border-[#ddd1bc] bg-[#fbf7ef] px-4 py-2 font-medium text-[#5e5142] shadow-sm transition hover:bg-white">Кабинет</Link>
            <Link href="/projects/new" className="rounded-xl border border-[#ddd1bc] bg-[#fbf7ef] px-4 py-2 font-medium text-[#5e5142] shadow-sm transition hover:bg-white">Новый проект</Link>
            <button type="button" onClick={deleteProject} className="rounded-xl border border-[#e3c9bf] bg-[#fff6f2] px-4 py-2 font-medium text-[#8a5d51] shadow-sm transition hover:bg-white">Удалить проект</button>
          </div>
        </div>

        {error ? <div className="rounded-[20px] border border-[#f0d0c8] bg-[#fff5f2] px-4 py-3 text-sm text-red-600 shadow-sm">{error}</div> : null}
        {info ? <div className="rounded-[20px] border border-[#dce7d8] bg-[#f2faf1] px-4 py-3 text-sm text-emerald-700 shadow-sm">{info}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px] xl:items-start">
          <div className="relative mx-auto w-full max-w-[860px]">
            <div className="absolute inset-0 rounded-[42px] bg-[#c79b67] shadow-[0_26px_60px_rgba(90,64,24,0.16)]" />
            <div className="absolute inset-[12px] rounded-[34px] bg-[#d9b98c]" />
            <div className="absolute left-1/2 top-0 z-20 h-[96px] w-[210px] -translate-x-1/2 -translate-y-7 rounded-b-[26px] rounded-t-[18px] border border-[#b98d4d] bg-gradient-to-b from-[#e9d097] to-[#c69a56] shadow-[0_18px_34px_rgba(93,68,26,0.18)]" />
            <div className="absolute left-1/2 top-0 z-30 h-[44px] w-[54px] -translate-x-1/2 -translate-y-10 rounded-full border-[8px] border-[#d9b66d] bg-[#f8edcf] shadow-[0_8px_18px_rgba(93,68,26,0.18)]" />
            <div className="relative z-10 m-[18px] rounded-[30px] border border-[#eadfcd] bg-[#f8f3ea] px-8 pb-8 pt-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12px] font-semibold uppercase tracking-[0.38em] text-[#9f7a54]">Проект #{projectId.slice(0, 6) || "—"}</div>
                <span className="rounded-full border border-[#e0d4bf] bg-[#fbf7ef] px-3 py-1 text-xs font-medium text-[#7a6856]">{formatStatus(data?.project.status)}</span>
              </div>

              <div className="mt-5">
                <div className="text-sm font-medium uppercase tracking-[0.18em] text-[#7f6a56]">{paperTitle}</div>
                <h1 className="mt-3 text-[42px] font-semibold leading-[1.05] text-[#334f37]">{data?.project.title || "—"}</h1>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#e0d4bf] bg-[#fbf7ef] px-3 py-1 text-xs font-medium text-[#7a6856]">{projectModeLabel}</span>
                <span className="rounded-full border border-[#d6dccc] bg-[#f3f7ee] px-3 py-1 text-xs font-medium text-[#50634f]">{goal?.shortTitle || data?.project.goal || "—"}</span>
                {unlockedMode ? <span className="rounded-full border border-[#d6dccc] bg-[#f3f7ee] px-3 py-1 text-xs font-medium text-[#50634f]">Уровень: {getEvaluationPackageDefinition(unlockedMode)?.shortTitle || unlockedMode}</span> : null}
              </div>

              <div className="mt-5 rounded-[22px] border border-[#e7ddce] bg-[#fcfaf6] p-5 shadow-[0_10px_24px_rgba(117,92,50,0.04)]">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#ede4d6] pb-4">
                  <div>
                    <div className="text-sm font-medium text-[#7d6751]">Готово тестов</div>
                    <div className="mt-2 text-[44px] font-semibold leading-none text-[#2f4734]">{progress.completed} / {progress.total}</div>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <div className="rounded-full border border-[#e7ddce] bg-[#f7f0e4] px-4 py-2 text-sm font-medium text-[#6d5d4b]">{selectedCompetencyNames.length ? selectedCompetencyNames.join(" · ") : (data?.project.summary || goal?.description || "Общая оценка проекта")}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[18px] border border-[#ece2d4] bg-[#faf6ef] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9c876b]">Режим проекта</div>
                    <div className="mt-2 text-base font-medium text-[#544635]">{projectModeLabel}</div>
                  </div>
                  <div className="rounded-[18px] border border-[#ece2d4] bg-[#faf6ef] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9c876b]">Оценка по компетенциям</div>
                    <div className="mt-2 text-base font-medium text-[#544635]">{selectedCompetencyNames.length ? selectedCompetencyNames.join(" · ") : goal?.shortTitle || "Общая оценка"}</div>
                  </div>
                  <div className="rounded-[18px] border border-[#ece2d4] bg-[#faf6ef] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9c876b]">Аналитическая опора</div>
                    <div className="mt-2 text-base font-medium text-[#544635]">{selectedCompetencyNames[0] || goal?.shortTitle || "Базовый профиль"}</div>
                  </div>
                  <div className="rounded-[18px] border border-[#ece2d4] bg-[#faf6ef] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9c876b]">Целевая роль</div>
                    <div className="mt-2 text-base font-medium text-[#544635]">{data?.project.target_role || form.target_role || "Роль не указана"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[20px] border border-[#eadfcd] bg-[#fbf7ef] px-4 py-3 text-sm leading-6 text-[#6f624f]">
                <span className="font-medium text-[#4f4234]">Примечание специалисту:</span> результаты откроются после того, как участник завершит назначенные тесты.
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-[#e5dbc8] bg-[#f8f3ea] p-5 shadow-[0_20px_40px_rgba(117,92,50,0.07)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-[#4c4033]">Профиль участника</div>
                  <div className="mt-1 text-xs leading-5 text-[#8b7761]">Имя, должность, email и комментарий специалиста.</div>
                </div>
                <button type="button" onClick={() => setEditing((prev) => !prev)} className="rounded-xl border border-[#ddd1bc] bg-[#fbf7ef] px-3 py-2 text-sm font-medium text-[#5e5142] shadow-sm">
                  {editing ? "Свернуть" : "Редактировать"}
                </button>
              </div>
              <div className="mt-5 space-y-4 text-[#5d5041]">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#a18b6e]">Имя участника</div>
                  <div className="mt-2 rounded-2xl border border-[#e8ddcc] bg-[#fcf9f3] px-4 py-3 text-base font-medium">{data?.project.person?.full_name || "Имя не заполнено"}</div>
                </div>
                <div className="text-base">{data?.project.person?.email || "email@example.com"}</div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#a18b6e]">Должность</div>
                  <div className="mt-2 rounded-2xl border border-[#e8ddcc] bg-[#fcf9f3] px-4 py-3 text-base">{data?.project.person?.current_position || "Должность не указана"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#a18b6e]">Комментарий специалиста</div>
                  <div className="mt-2 rounded-2xl border border-[#e8ddcc] bg-[#fcf9f3] px-4 py-3 text-sm leading-6">{data?.project.person?.notes || "Комментарий пока не добавлен."}</div>
                </div>
              </div>
            </div>

            {editing ? (
              <div className="rounded-[28px] border border-[#e5dbc8] bg-[#f8f3ea] p-5 shadow-[0_20px_40px_rgba(117,92,50,0.07)]">
                <div className="mb-4 text-sm font-semibold text-[#4c4033]">Редактирование участника и параметров проекта</div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-[#9f8463]">Имя и фамилия</span>
                    <input className="input !border-[#e0d4bf] !bg-[#fbf7ef]" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-[#9f8463]">Email</span>
                    <input className="input !border-[#e0d4bf] !bg-[#fbf7ef]" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="optional@example.com" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-[#9f8463]">Должность участника</span>
                    <input className="input !border-[#e0d4bf] !bg-[#fbf7ef]" value={form.current_position} onChange={(e) => setForm((prev) => ({ ...prev, current_position: e.target.value }))} placeholder="Например: менеджер по продажам" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-xs font-medium uppercase tracking-wide text-[#9f8463]">Целевая роль / вакансия</span>
                    <input className="input !border-[#e0d4bf] !bg-[#fbf7ef]" value={form.target_role} onChange={(e) => setForm((prev) => ({ ...prev, target_role: e.target.value }))} placeholder="Например: руководитель группы" />
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-[#9f8463]">Цель оценки</span>
                    <select className="input !border-[#e0d4bf] !bg-[#fbf7ef]" value={form.goal} onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value as AssessmentGoal }))}>
                      {COMMERCIAL_GOALS.map((item) => (
                        <option key={item.key} value={item.key}>{item.shortTitle}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-[#9f8463]">Комментарий специалиста</span>
                    <textarea className="input min-h-[110px] !border-[#e0d4bf] !bg-[#fbf7ef]" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Короткий внутренний комментарий по участнику" />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={saveDetails} disabled={saving} className="btn btn-primary">
                    {saving ? "Сохраняем…" : "Сохранить изменения"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setForm({
                        full_name: data?.project.person?.full_name || "",
                        email: data?.project.person?.email || "",
                        current_position: data?.project.person?.current_position || "",
                        goal: data?.project.goal || "role_fit",
                        target_role: data?.project.target_role || "",
                        notes: data?.project.person?.notes || "",
                      });
                    }}
                    className="btn btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}

            <div className="relative rounded-[28px] border border-[#e4d8c5] bg-[#f8f3ea] p-4 shadow-[0_20px_40px_rgba(117,92,50,0.07)]">
              <div className="absolute left-1/2 top-0 h-12 w-14 -translate-x-1/2 -translate-y-8 rounded-b-[16px] rounded-t-[12px] border border-[#b98d4d] bg-gradient-to-b from-[#ead5a2] to-[#c79e61] shadow-[0_12px_20px_rgba(93,68,26,0.18)]" />
              <div className="rounded-[22px] border border-[#ece2d4] bg-[#fcfaf6] p-5 pt-8">
                <div className="text-[15px] font-semibold text-[#4c4033]">Доступ участника</div>
                <div className="mt-4 flex gap-2">
                  <input className="input flex-1 !rounded-xl !border-[#e0d4bf] !bg-[#fbf7ef]" readOnly value={shareUrl} />
                  <button type="button" onClick={copyShareUrl} className="rounded-xl border border-[#ddd1bc] bg-[#fbf7ef] px-3 py-2 text-sm font-medium text-[#5e5142] shadow-sm">{copied ? "Скопировано" : "Копировать"}</button>
                </div>
                <div className="mt-4">
                  <QRCodeBlock value={shareUrl} title="QR для прохождения" />
                </div>
              </div>
            </div>

            <div className="space-y-3 xl:pt-2">
              {(["not_started", "in_progress", "completed"] as const).map((state) => {
                const styles = getTestStateStyles(state);
                return (
                  <div key={state} className={`inline-flex w-full items-center gap-3 rounded-full border px-4 py-3 text-sm font-medium shadow-sm ${styles.pill}`}>
                    <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
                    {styles.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {fullyDone ? (
          <div className="rounded-[30px] border border-[#e4d8c5] bg-[#f8f3ea] p-4 shadow-[0_20px_40px_rgba(117,92,50,0.07)]">
            <div className="rounded-[24px] border border-[#ece2d4] bg-[#fcfaf6] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe5d8] pb-4">
                <div>
                  <div className="text-sm font-semibold text-[#4b4034]">Результаты по режимам</div>
                  <div className="mt-1 text-sm text-[#8c7761]">Открой нужную глубину результата после завершения всех тестов.</div>
                  {projectCoveredBySubscription ? <div className="mt-2 text-xs text-emerald-700">Этот проект уже покрыт месячным тарифом — внутри него результат можно раскрывать без доплаты.</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e7ddce] bg-[#fbf7ef] px-4 py-3 text-sm text-[#6b5b49]">
                  <span>Баланс: {walletLoading ? "…" : formatRub(balance_rub)}</span>
                  {activeSubscription ? <span className="rounded-full border border-[#d7dfd4] bg-[#f1f6ef] px-3 py-1 text-xs text-[#566a56]">Тариф: {activeSubscription.plan_title}</span> : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {EVALUATION_PACKAGES.map((item) => {
                  const accessible = isPackageAccessible(unlockedMode, item.key);
                  const isActive = activeEvaluationMode === item.key;
                  const isBusy = saving || !!evaluationLoading[item.key];
                  const upgradeRub = getUpgradePriceRub(unlockedMode, item.key);
                  return (
                    <div key={item.key} className={`flex h-full flex-col rounded-[22px] border p-4 ${accessible ? "border-[#d8e1d5] bg-white" : "border-[#e7ddce] bg-[#fbf7ef]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-[#4c4033]">{item.title}</div>
                          {item.shortTitle ? <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#9a8366]">{item.shortTitle}</div> : null}
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${accessible ? "bg-[#eef3ea] text-[#526651]" : "bg-[#f3ede3] text-[#7a6a58]"}`}>{accessible ? "Открыто" : "Закрыто"}</span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[#6d5d4b]">{item.description}</div>
                      <div className="mt-3 text-sm font-medium text-[#5d5347]">{formatRub(item.priceRub)}</div>
                      <div className="mt-auto pt-4">
                        {accessible ? (
                          <button type="button" className="btn btn-primary btn-sm w-full" onClick={async () => { setActiveEvaluationMode(item.key); if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined); }}>
                            {isActive ? "Показано ниже" : "Показать результат"}
                          </button>
                        ) : (
                          <button type="button" className="btn btn-primary btn-sm w-full" disabled={isBusy} onClick={() => unlockPackage(item.key)}>
                            {getPackageButtonLabel(item.key, unlockedMode, isUnlimited, activeSubscription, projectCoveredBySubscription)}
                          </button>
                        )}
                        {!accessible && !isUnlimited && !projectCoveredBySubscription && !(activeSubscription && activeSubscription.projects_remaining > 0) && balance_rub < upgradeRub ? <div className="mt-2 text-xs text-amber-700">Не хватает {formatRub(upgradeRub - balance_rub)}.</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeEvaluationMode && isPackageAccessible(unlockedMode, activeEvaluationMode) ? (
                <div className="mt-5 rounded-[22px] border border-[#e7ddce] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe5d8] pb-4">
                    <div>
                      <div className="text-sm font-semibold text-[#4b4034]">{getEvaluationPackageDefinition(activeEvaluationMode)?.title || "Результат"}</div>
                      <div className="mt-1 text-sm text-[#8c7761]">Один аккуратный блок результата без вложенной каши.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {EVALUATION_PACKAGES.filter((item) => isPackageAccessible(unlockedMode, item.key)).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeEvaluationMode === item.key ? "border-[#cad6c6] bg-[#eef3ea] text-[#495d49]" : "border-[#e0d4bf] bg-[#fbf7ef] text-[#6e5d4c]"}`}
                          onClick={async () => {
                            setActiveEvaluationMode(item.key);
                            if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) {
                              await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                            }
                          }}
                        >
                          {item.shortTitle}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeEvaluationMode === "premium_ai_plus" ? (
                    <div className="mt-4 rounded-[18px] border border-[#e7ddce] bg-[#fbf7ef] p-4">
                      <div className="text-sm font-semibold text-[#4b4034]">Дополнительный запрос к Премиум AI+</div>
                      <div className="mt-1 text-sm text-[#8c7761]">Можно задать дополнительный акцент анализа и отдельно включить индекс соответствия только тогда, когда он реально нужен.</div>
                      <div className="mt-3 grid gap-4">
                        <textarea className="input min-h-[96px]" value={aiPlusRequest} onChange={(e) => setAiPlusRequest(e.target.value)} placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска." />
                        <label className="flex items-start gap-3 rounded-2xl border border-[#e0d4bf] bg-white px-4 py-3 text-sm text-[#6f5f4d]">
                          <input type="checkbox" className="mt-1 h-4 w-4" checked={fitRequested} onChange={(e) => setFitRequested(e.target.checked)} />
                          <span>
                            <span className="font-medium text-[#4b4034]">Считать индекс соответствия</span>
                            <span className="mt-1 block text-xs leading-5 text-[#8c7761]">Включай только если хочешь проверить соответствие конкретной роли, должности или ожиданиям.</span>
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
                            <textarea className="input min-h-[84px]" value={fitRequest} onChange={(e) => setFitRequest(e.target.value)} placeholder="Например: соответствие должности руководителя отдела продаж или ожиданиям по самостоятельности, влиянию и стрессоустойчивости." />
                            <div className="text-xs leading-5 text-[#8c7761]">Можно выбрать готовую ролевую матрицу или оставить автоопределение и просто описать ожидания словами.</div>
                          </div>
                        ) : null}
                        <div className="flex justify-end">
                          <button type="button" className="btn btn-primary" disabled={!!evaluationLoading.premium_ai_plus} onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}>
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
                              <div key={`${section.title}:${index}`} className="rounded-2xl border border-[#e7ddce] bg-[#fbf7ef] p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-sm font-semibold text-[#4b4034]">{section.title}</div>
                                  {hasDetails ? (
                                    <button type="button" className="text-xs font-medium text-[#8c7761]" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}>
                                      {isOpen ? "Скрыть детали" : "Подробнее"}
                                    </button>
                                  ) : null}
                                </div>
                                <div className="mt-2 whitespace-pre-line text-sm leading-7 text-[#6f5f4d]">{parts.preview}</div>
                                {hasDetails && isOpen ? <div className="mt-3 whitespace-pre-line border-t border-[#e8dece] pt-3 text-sm leading-7 text-[#6f5f4d]">{parts.details}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {testSections.length ? (
                        <div className="rounded-2xl border border-[#e7ddce] bg-[#fbf7ef] p-4">
                          <div className="text-sm font-semibold text-[#4b4034]">По отдельным тестам</div>
                          <div className="mt-1 text-sm text-[#8c7761]">Открывай только те методики, которые нужно посмотреть сейчас.</div>
                          <div className="mt-4 grid gap-3">
                            {testSections.map((section, index) => {
                              const key = sectionKey(activeEvaluationMode, index);
                              const isOpen = openSections[key] ?? index === 0;
                              return (
                                <div key={key} className="overflow-hidden rounded-2xl border border-[#e7ddce] bg-white">
                                  <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))}>
                                    <div className="text-sm font-semibold text-[#4b4034]">{section.title}</div>
                                    <span className="text-xs text-[#8c7761]">{isOpen ? "Скрыть" : "Открыть"}</span>
                                  </button>
                                  {isOpen ? <div className="border-t border-[#e8dece] px-4 py-4 whitespace-pre-line text-sm leading-7 text-[#6f5f4d]">{cleanSectionBody(section.body)}</div> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-[#e7ddce] bg-[#fbf7ef] p-4 text-sm text-[#6f5f4d]">Результат для этого уровня пока не собран.</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-[26px] border border-[#e4d8c5] bg-[#f8f3ea] px-5 py-4 text-sm text-[#6f5f4d] shadow-[0_20px_40px_rgba(117,92,50,0.07)]">Уровни результата откроются после того, как участник завершит все назначенные тесты.</div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_150px] xl:items-start">
          <div className="rounded-[30px] border border-[#e4d8c5] bg-[#f8f3ea] p-4 shadow-[0_20px_40px_rgba(117,92,50,0.07)]">
            <div className="rounded-[24px] border border-[#ece2d4] bg-[#fcfaf6] p-5">
              <div className="text-[28px] font-semibold text-[#4b4034]">Назначенные тесты</div>
              <div className="mt-2 text-sm text-[#8c7761]">Список назначенных методик и текущий статус прохождения.</div>
              <div className="mt-5 space-y-3">
                {(data?.project.tests || []).map((test) => {
                  const state = completedSet.has(test.test_slug) ? "completed" : startedSet.has(test.test_slug) ? "in_progress" : "not_started";
                  const styles = getTestStateStyles(state);
                  return (
                    <div key={test.test_slug} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#ece2d4] bg-white/80 px-4 py-4">
                      <div>
                        <div className="text-[17px] font-semibold text-[#4e4335]">{test.test_title}</div>
                        <div className="mt-1 text-sm text-[#8a7763]">Тип теста: {test.test_slug === "16pf-a" ? "Личностный профиль" : test.test_slug === "belbin" ? "Командная роль" : test.test_slug === "time-management" ? "Самоорганизация" : "Диагностическая методика"}</div>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${styles.pill}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                        {styles.label}
                      </span>
                    </div>
                  );
                })}
                {!loading && !(data?.project.tests || []).length ? <div className="rounded-[18px] border border-dashed border-[#dacdbb] bg-white/70 px-4 py-5 text-sm text-[#7f705f]">Для проекта пока не назначены тесты.</div> : null}
              </div>
            </div>
          </div>

          <div className="space-y-3 xl:pt-6">
            {(["not_started", "in_progress", "completed"] as const).map((state) => {
              const styles = getTestStateStyles(state);
              return (
                <div key={state} className={`inline-flex w-full items-center gap-3 rounded-full border px-4 py-3 text-sm font-medium shadow-sm ${styles.pill}`}>
                  <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
                  {styles.label}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
