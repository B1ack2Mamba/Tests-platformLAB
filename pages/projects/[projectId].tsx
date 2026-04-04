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
  const completedSet = useMemo(() => new Set((data?.project.attempts || []).map((item) => item.test_slug)), [data?.project.attempts]);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">{data?.workspace.name || "Рабочее пространство"}</div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="btn btn-secondary btn-sm">Кабинет</Link>
          <Link href="/projects/new" className="btn btn-secondary btn-sm">Новый проект</Link>
          <button type="button" onClick={deleteProject} className="btn btn-secondary btn-sm">Удалить проект</button>
        </div>
      </div>

      {error ? <div className="mb-4 card text-sm text-red-600">{error}</div> : null}
      {info ? <div className="mb-4 card text-sm text-emerald-700">{info}</div> : null}

      <div className="grid gap-4">
        <div className="card">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.8fr)_minmax(300px,0.8fr)]">
            <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Проект оценки</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{data?.project.title || "—"}</div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-right ${fullyDone ? "border-emerald-300 bg-white" : "border-emerald-100 bg-white"}`}>
                  <div className="text-xs text-slate-500">Готово тестов</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{progress.completed} / {progress.total}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">{goal?.shortTitle || data?.project.goal || "—"}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">Статус: {formatStatus(data?.project.status)}</span>
                {unlockedMode ? <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">Открыт уровень: {getEvaluationPackageDefinition(unlockedMode)?.shortTitle || unlockedMode}</span> : null}
              </div>
              <div className="mt-4 text-sm leading-6 text-slate-700">{data?.project.summary || goal?.description || ""}</div>
              {data?.project.target_role ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Целевая роль: <span className="font-medium text-slate-950">{data.project.target_role}</span></div> : null}
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Профиль участника</div>
                  <div className="mt-1 text-sm text-slate-500">Имя, email, должность и комментарий специалиста.</div>
                </div>
                <button type="button" onClick={() => setEditing((prev) => !prev)} className="btn btn-secondary btn-sm">
                  {editing ? "Свернуть" : "Редактировать"}
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-emerald-100 bg-slate-50/60 p-4">
                  <div className="text-xs text-slate-500">Участник</div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">{data?.project.person?.full_name || "—"}</div>
                  <div className="mt-1 text-sm text-slate-600">{data?.project.person?.current_position || "Должность не указана"}</div>
                  {data?.project.person?.email ? <div className="mt-1 text-sm text-slate-600">{data.project.person.email}</div> : null}
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-slate-50/60 p-4 text-sm leading-6 text-slate-700">
                  <div className="text-xs text-slate-500">Комментарий специалиста</div>
                  <div className="mt-2">{data?.project.person?.notes || "Комментарий пока не добавлен."}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5">
              <div className="text-sm font-semibold text-slate-900">Ссылка и QR</div>
              <div className="mt-1 text-sm text-slate-500">Сотрудник пройдёт тесты по ссылке или QR и не увидит результаты.</div>
              <div className="mt-4 flex gap-2">
                <input className="input flex-1" readOnly value={shareUrl} />
                <button type="button" onClick={copyShareUrl} className="btn btn-secondary btn-sm">{copied ? "Скопировано" : "Копировать"}</button>
              </div>
              <div className="mt-4 flex justify-center">
                <QRCodeBlock value={shareUrl} title="QR для прохождения" />
              </div>
            </div>
          </div>

          {editing ? (
            <div className="mt-4 rounded-3xl border border-emerald-200 bg-white p-4">
              <div className="mb-4 text-sm font-semibold text-slate-900">Редактирование участника и параметров проекта</div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Имя и фамилия</span>
                  <input className="input" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="optional@example.com" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Должность участника</span>
                  <input className="input" value={form.current_position} onChange={(e) => setForm((prev) => ({ ...prev, current_position: e.target.value }))} placeholder="Например: менеджер по продажам" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Целевая роль / вакансия</span>
                  <input className="input" value={form.target_role} onChange={(e) => setForm((prev) => ({ ...prev, target_role: e.target.value }))} placeholder="Например: руководитель группы" />
                </label>
                <label className="grid gap-1 text-sm md:col-span-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Цель оценки</span>
                  <select className="input" value={form.goal} onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value as AssessmentGoal }))}>
                    {COMMERCIAL_GOALS.map((item) => (
                      <option key={item.key} value={item.key}>{item.shortTitle}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Комментарий специалиста</span>
                  <textarea className="input min-h-[110px]" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Короткий внутренний комментарий по участнику" />
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
        </div>

        {fullyDone ? (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Результаты по режимам</div>
                <div className="mt-1 text-sm text-slate-500">Открой нужную глубину результата после завершения всех тестов.</div>
                {projectCoveredBySubscription ? <div className="mt-2 text-xs text-emerald-700">Этот проект уже покрыт месячным тарифом — внутри него результат можно раскрывать без доплаты.</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Баланс</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{walletLoading ? "…" : isUnlimited ? "∞" : `${balance_rub} ₽`}</div>
                  {isUnlimited ? <div className="text-[11px] text-emerald-700">Тестовый безлимит активен</div> : null}
                  {activeSubscription ? <div className="mt-1 text-[11px] text-emerald-700">Тариф: {activeSubscription.plan_title} · осталось {activeSubscription.projects_remaining} · до {formatMonthlySubscriptionPeriod(activeSubscription.expires_at)}</div> : null}
                </div>
                <div className="flex gap-2">
                  {!isUnlimited ? <Link href="/wallet" className="btn btn-secondary btn-sm">Пополнить</Link> : null}
                  <Link href="/wallet" className="btn btn-secondary btn-sm">Кошелёк</Link>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {EVALUATION_PACKAGES.map((item) => {
                const accessible = isPackageAccessible(unlockedMode, item.key);
                const upgradeRub = getUpgradePriceRub(unlockedMode, item.key);
                const isBusy = !!evaluationLoading[item.key] || saving;
                const isActive = activeEvaluationMode === item.key;
                return (
                  <div key={item.key} className={`flex h-full min-h-[220px] flex-col rounded-3xl border p-5 ${accessible ? "border-emerald-200 bg-white" : "border-slate-200 bg-slate-50/90"} ${isActive ? "ring-2 ring-emerald-200" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-slate-950">{item.title}{item.note ? <span className="text-xs font-normal text-slate-500"> ({item.note})</span> : null}</div>
                          {item.helpText ? (
                            <button
                              type="button"
                              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition ${packageHelp === item.key ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-800"}`}
                              onClick={() => setPackageHelp((current) => (current === item.key ? null : item.key))}
                              aria-label={`Информация о тарифе ${item.title}`}
                              title={`Информация о тарифе ${item.title}`}
                            >
                              ?
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-500">{formatRub(item.priceRub)}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${accessible ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{accessible ? "Открыто" : "Закрыто"}</span>
                    </div>
                    {item.helpText && packageHelp === item.key ? (
                      <div className="mt-3 rounded-2xl border border-emerald-100 bg-white p-3 text-xs leading-6 text-slate-700">
                        {item.helpText}
                      </div>
                    ) : null}
                    <div className="mt-4 text-sm leading-6 text-slate-700">{item.description}</div>
                    <div className="mt-auto pt-5">
                      {accessible ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm w-full"
                          onClick={async () => {
                            setActiveEvaluationMode(item.key);
                            if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) {
                              await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined);
                            }
                          }}
                        >
                          {isActive ? "Показано ниже" : "Показать результат"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm w-full"
                          disabled={isBusy}
                          onClick={() => unlockPackage(item.key)}
                        >
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
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{getEvaluationPackageDefinition(activeEvaluationMode)?.title || "Результат"}</div>
                    <div className="mt-1 text-sm text-slate-500">Один аккуратный блок результата без вложенной каши.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EVALUATION_PACKAGES.filter((item) => isPackageAccessible(unlockedMode, item.key)).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeEvaluationMode === item.key ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
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
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/40 p-4">
                    <div className="text-sm font-semibold text-slate-900">Дополнительный запрос к Премиум AI+</div>
                    <div className="mt-1 text-sm text-slate-500">Можно задать дополнительный акцент анализа и отдельно включить индекс соответствия только тогда, когда он реально нужен.</div>
                    <div className="mt-3 grid gap-4">
                      <textarea
                        className="input min-h-[96px]"
                        value={aiPlusRequest}
                        onChange={(e) => setAiPlusRequest(e.target.value)}
                        placeholder="Например: сделай акцент на управленческий потенциал, стиле взаимодействия и зонах риска."
                      />
                      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        <input type="checkbox" className="mt-1 h-4 w-4" checked={fitRequested} onChange={(e) => setFitRequested(e.target.checked)} />
                        <span>
                          <span className="font-medium text-slate-900">Считать индекс соответствия</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Включай только если хочешь проверить соответствие конкретной роли, должности или ожиданиям.</span>
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
                          <textarea
                            className="input min-h-[84px]"
                            value={fitRequest}
                            onChange={(e) => setFitRequest(e.target.value)}
                            placeholder="Например: соответствие должности руководителя отдела продаж или ожиданиям по самостоятельности, влиянию и стрессоустойчивости."
                          />
                          <div className="text-xs leading-5 text-slate-500">Можно выбрать готовую ролевую матрицу или оставить автоопределение и просто описать ожидания словами.</div>
                        </div>
                      ) : null}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={!!evaluationLoading.premium_ai_plus}
                          onClick={() => loadEvaluation("premium_ai_plus", { customRequest: aiPlusRequest })}
                        >
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
                        {overviewSections.map((section, index) => (
                          (() => {
                            const key = sectionKey(`${activeEvaluationMode}:overview`, index);
                            const isOpen = openSections[key] ?? false;
                            const parts = splitSectionBody(section.body);
                            const hasDetails = Boolean(parts.details);
                            return (
                              <div key={`${section.title}:${index}`} className="rounded-2xl border border-emerald-100 bg-slate-50/50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-900">{section.title}</div>
                                  {hasDetails ? (
                                    <button
                                      type="button"
                                      className="text-xs font-medium text-slate-500"
                                      onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !isOpen }))}
                                    >
                                      {isOpen ? "Скрыть детали" : "Подробнее"}
                                    </button>
                                  ) : null}
                                </div>
                                <div className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{parts.preview}</div>
                                {hasDetails && isOpen ? <div className="mt-3 whitespace-pre-line border-t border-emerald-100 pt-3 text-sm leading-7 text-slate-700">{parts.details}</div> : null}
                              </div>
                            );
                          })()
                        ))}
                      </div>
                    ) : null}

                    {testSections.length ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-sm font-semibold text-slate-900">По отдельным тестам</div>
                        <div className="mt-1 text-sm text-slate-500">Открывай только те методики, которые нужно посмотреть сейчас.</div>
                        <div className="mt-4 grid gap-3">
                          {testSections.map((section, index) => {
                            const key = sectionKey(activeEvaluationMode, index);
                            const isOpen = openSections[key] ?? index === 0;
                            return (
                              <div key={key} className="overflow-hidden rounded-2xl border border-emerald-100 bg-white">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                                  onClick={() => setOpenSections((prev) => ({ ...prev, [key]: !(prev[key] ?? index === 0) }))}
                                >
                                  <div className="text-sm font-semibold text-slate-900">{section.title}</div>
                                  <span className="text-xs text-slate-500">{isOpen ? "Скрыть" : "Открыть"}</span>
                                </button>
                                {isOpen ? <div className="border-t border-emerald-100 px-4 py-4 whitespace-pre-line text-sm leading-7 text-slate-700">{cleanSectionBody(section.body)}</div> : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Результат для этого уровня пока не собран.</div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="card text-sm text-slate-700">Уровни результата откроются после того, как участник завершит все назначенные тесты.</div>
        )}

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Назначенные тесты</div>
              <div className="mt-1 text-sm text-slate-500">Показываем только название и статус прохождения.</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(data?.project.tests || []).map((test) => {
              const done = completedSet.has(test.test_slug);
              return (
                <div key={test.test_slug} className={`rounded-2xl border p-4 ${done ? "border-emerald-200 bg-white" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{test.test_title}</div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{done ? "Готово" : "Не пройден"}</span>
                  </div>
                </div>
              );
            })}
            {!loading && !(data?.project.tests || []).length ? <div className="text-sm text-slate-600">Для проекта пока не назначены тесты.</div> : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
