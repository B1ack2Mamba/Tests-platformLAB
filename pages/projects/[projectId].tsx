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
import { getCompetencyLongLabel } from "@/lib/competencyRouter";

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

const PROJECT_DETAILS_TEMPLATE_OWNER_EMAIL = "storyguild9@gmail.com";
const PROJECT_DETAILS_TEMPLATE_STORAGE_KEY = "project_details_template_builder_v1";

type DetailsTemplateTarget = "strip" | "main" | "profile" | "qr" | "tests" | "status";

type DetailsTemplateState = {
  builderOpen: boolean;
  stripX: number;
  stripY: number;
  stripScale: number;
  mainX: number;
  mainY: number;
  mainScale: number;
  profileX: number;
  profileY: number;
  profileScale: number;
  qrX: number;
  qrY: number;
  qrScale: number;
  testsX: number;
  testsY: number;
  testsScale: number;
  statusX: number;
  statusY: number;
  statusScale: number;
};

const DEFAULT_DETAILS_TEMPLATE_STATE: DetailsTemplateState = {
  builderOpen: false,
  stripX: 184,
  stripY: 0,
  stripScale: 1,
  mainX: 8,
  mainY: 92,
  mainScale: 0.686,
  profileX: 855,
  profileY: 120,
  profileScale: 0.39,
  qrX: 880,
  qrY: 360,
  qrScale: 0.385,
  testsX: 24,
  testsY: 1018,
  testsScale: 1.0,
  statusX: 995,
  statusY: 1098,
  statusScale: 0.32,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const [detailsTemplate, setDetailsTemplate] = useState<DetailsTemplateState>(DEFAULT_DETAILS_TEMPLATE_STATE);
  const [detailsTemplateLoaded, setDetailsTemplateLoaded] = useState(false);
  const [detailsTemplateSaving, setDetailsTemplateSaving] = useState(false);
  const [detailsTemplateMessage, setDetailsTemplateMessage] = useState("");
  const [detailsGesture, setDetailsGesture] = useState<null | {
    target: DetailsTemplateTarget;
    mode: "move" | "resize";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startScale: number;
  }>(null);
  const canEditProjectDetailsTemplate = (user?.email || "").toLowerCase() === PROJECT_DETAILS_TEMPLATE_OWNER_EMAIL;

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
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/commercial/project-details-template", {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const json = await resp.json().catch(() => ({} as any));
        if (!cancelled && resp.ok && json?.ok && json?.template) {
          const parsed = json.template as Partial<DetailsTemplateState>;
          setDetailsTemplate((prev) => ({ ...prev, ...parsed, builderOpen: prev.builderOpen }));
        }
      } catch {}
      finally {
        if (!cancelled) setDetailsTemplateLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!canEditProjectDetailsTemplate || !detailsTemplateLoaded || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PROJECT_DETAILS_TEMPLATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DetailsTemplateState>;
      setDetailsTemplate((prev) => ({ ...prev, ...parsed, builderOpen: Boolean(parsed.builderOpen) }));
    } catch {}
  }, [canEditProjectDetailsTemplate, detailsTemplateLoaded]);

  useEffect(() => {
    if (!canEditProjectDetailsTemplate || !detailsTemplateLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(PROJECT_DETAILS_TEMPLATE_STORAGE_KEY, JSON.stringify(detailsTemplate));
  }, [canEditProjectDetailsTemplate, detailsTemplate, detailsTemplateLoaded]);

  useEffect(() => {
    if (!detailsGesture) return;
    const gesture = detailsGesture;
    function onMove(event: PointerEvent) {
      const dx = event.clientX - gesture.startClientX;
      const dy = event.clientY - gesture.startClientY;
      const prefix = gesture.target;
      if (gesture.mode === "move") {
        setDetailsTemplate((prev) => ({
          ...prev,
          [`${prefix}X`]: Math.round(gesture.startX + dx),
          [`${prefix}Y`]: Math.round(gesture.startY + dy),
        } as DetailsTemplateState));
        return;
      }
      const nextScale = clamp(gesture.startScale + (dx + dy) / 500, 0.6, 1.6);
      setDetailsTemplate((prev) => ({ ...prev, [`${prefix}Scale`]: Number(nextScale.toFixed(3)) } as DetailsTemplateState));
    }
    function stop() {
      setDetailsGesture(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [detailsGesture]);

  function startDetailsGesture(target: DetailsTemplateTarget, mode: "move" | "resize", event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const prefix = target;
    setDetailsGesture({
      target,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number((detailsTemplate as any)[`${prefix}X`] || 0),
      startY: Number((detailsTemplate as any)[`${prefix}Y`] || 0),
      startScale: Number((detailsTemplate as any)[`${prefix}Scale`] || 1),
    });
  }

  function resetDetailsTemplate() {
    setDetailsTemplate((prev) => ({ ...DEFAULT_DETAILS_TEMPLATE_STATE, builderOpen: prev.builderOpen }));
    setDetailsTemplateMessage("");
  }

  async function saveDetailsTemplate() {
    if (!session || !canEditProjectDetailsTemplate) return;
    setDetailsTemplateSaving(true);
    setDetailsTemplateMessage("");
    try {
      const payload = {
        template: {
          stripX: detailsTemplate.stripX,
          stripY: detailsTemplate.stripY,
          stripScale: detailsTemplate.stripScale,
          mainX: detailsTemplate.mainX,
          mainY: detailsTemplate.mainY,
          mainScale: detailsTemplate.mainScale,
          profileX: detailsTemplate.profileX,
          profileY: detailsTemplate.profileY,
          profileScale: detailsTemplate.profileScale,
          qrX: detailsTemplate.qrX,
          qrY: detailsTemplate.qrY,
          qrScale: detailsTemplate.qrScale,
          testsX: detailsTemplate.testsX,
          testsY: detailsTemplate.testsY,
          testsScale: detailsTemplate.testsScale,
          statusX: detailsTemplate.statusX,
          statusY: detailsTemplate.statusY,
          statusScale: detailsTemplate.statusScale,
        },
      };
      const resp = await fetch("/api/commercial/project-details-template", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить шаблон страницы проекта");
      setDetailsTemplateMessage("Шаблон проекта сохранён для всех.");
    } catch (err: any) {
      setDetailsTemplateMessage(err?.message || "Не удалось сохранить шаблон страницы проекта");
    } finally {
      setDetailsTemplateSaving(false);
    }
  }

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
  const routingMeta = data?.project.routing_meta || null;
  const competencyLabel = routingMeta?.competencyIds?.length ? getCompetencyLongLabel(routingMeta.competencyIds) : "";
  const shareCompactUrl = shareUrl ? shareUrl.replace(/^https?:\/\//, "") : "";
  const detailsCanvasHeight = Math.max(
    1700,
    detailsTemplate.mainY + 1050 * detailsTemplate.mainScale + 80,
    detailsTemplate.profileY + 217 * detailsTemplate.profileScale + 80,
    detailsTemplate.qrY + 532 * detailsTemplate.qrScale + 80,
    detailsTemplate.testsY + 400 * detailsTemplate.testsScale + 80,
    detailsTemplate.statusY + 200 * detailsTemplate.statusScale + 80
  );

  function renderTemplateHandles(target: DetailsTemplateTarget, label: string) {
    if (!canEditProjectDetailsTemplate || !detailsTemplate.builderOpen) return null;
    return (
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-[#d8c3a1] bg-[#fffaf0]/95 px-2 py-1 shadow-[0_8px_18px_rgba(80,56,27,0.12)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b6b3c]">{label}</span>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" onPointerDown={(event) => startDetailsGesture(target, "move", event)}>Тянуть</button>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" onPointerDown={(event) => startDetailsGesture(target, "resize", event)}>↘</button>
      </div>
    );
  }

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
      <div className="mx-auto max-w-[1280px] px-3 pb-10 pt-2 sm:px-4">
        {error ? <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-[0_10px_24px_rgba(124,45,18,0.08)]">{error}</div> : null}
        {info ? <div className="mb-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-[0_10px_24px_rgba(16,84,57,0.08)]">{info}</div> : null}

        {canEditProjectDetailsTemplate ? (
          <div className="mx-auto mb-4 flex max-w-[1220px] flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#dcc8aa] bg-[#fbf5e7] px-4 py-3 text-sm shadow-[0_12px_30px_rgba(90,68,33,0.08)]">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#9d7a4b]">Конструктор страницы проекта</div>
              <div className="mt-1 text-[#6f5a42]">Подгони шаблоны и сохрани как общий макет для всех.</div>
              {detailsTemplateMessage ? <div className="mt-1 text-xs text-[#7b6548]">{detailsTemplateMessage}</div> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDetailsTemplate((prev) => ({ ...prev, builderOpen: !prev.builderOpen }))} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(90,68,33,0.08)]">{detailsTemplate.builderOpen ? "Скрыть конструктор" : "Открыть конструктор"}</button>
              <button type="button" onClick={resetDetailsTemplate} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(90,68,33,0.08)]">Сбросить</button>
              <button type="button" onClick={saveDetailsTemplate} disabled={detailsTemplateSaving} className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2 font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)] disabled:opacity-60">{detailsTemplateSaving ? "Сохраняем…" : "Сохранить как шаблон для всех"}</button>
            </div>
          </div>
        ) : null}

        <div className="relative mx-auto w-full max-w-[1220px]" style={{ height: detailsCanvasHeight }}>
          <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(247,243,235,0.72))]" />

          <div className="absolute left-0 top-0 origin-top-left" style={{ width: 840, height: 102, transform: `translate(${detailsTemplate.stripX}px, ${detailsTemplate.stripY}px) scale(${detailsTemplate.stripScale})` }}>
            <div className="relative h-full w-full bg-contain bg-no-repeat" style={{ backgroundImage: "url('/project-details-top-strip-template.png')" }}>
              {renderTemplateHandles("strip", "верх")}
              <div className="absolute inset-x-[18px] top-[12px] flex items-center justify-between gap-3 px-3">
                <div className="min-w-0 pt-1">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#9d7a4b]">Название рабочего пространства / ID проекта</div>
                  <div className="mt-1 truncate text-sm text-[#6f5a42]">{data?.workspace.name || "Рабочее пространство"} / {data?.project.id ? data.project.id.slice(0, 8) : "—"}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href="/dashboard" className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(90,68,33,0.08)]">Кабинет</Link>
                  <Link href="/projects/new" className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(90,68,33,0.08)]">Новый проект</Link>
                  <button type="button" onClick={deleteProject} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731] shadow-[0_6px_14px_rgba(90,68,33,0.08)]">Удалить проект</button>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute left-0 top-0 origin-top-left" style={{ width: 760, height: 1066, transform: `translate(${detailsTemplate.mainX}px, ${detailsTemplate.mainY}px) scale(${detailsTemplate.mainScale})` }}>
            <div className="relative h-full w-full bg-contain bg-no-repeat" style={{ backgroundImage: "url('/project-details-main-template.png')" }}>
              {renderTemplateHandles("main", "лист")}
              <div className="absolute inset-x-[52px] top-[64px] text-[#7d6548]">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#9d7a4b]">Проект #{data?.project.id ? data.project.id.slice(0, 5) : "—"}</div>
                <div className="mt-2 text-sm text-[#958066]">{data?.workspace.name || "Рабочее пространство"} / {data?.project.created_at ? new Date(data.project.created_at).toLocaleDateString("ru-RU") : "—"}</div>
                <div className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#7d6548]">Проект оценки</div>
                <h1 className="mt-3 max-w-[560px] text-[2.15rem] font-semibold leading-[1.08] text-[#2f5031]">{data?.project.title || "—"}</h1>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#d8c4a2] bg-[#fff9ef] px-4 py-1.5 text-sm font-medium text-[#6d573d]">{goal?.shortTitle || data?.project.goal || "—"}</span>
                    <span className="rounded-full border border-[#e3d7c4] bg-[#f5efe4] px-4 py-1.5 text-sm font-medium text-[#6f6454]">{formatStatus(data?.project.status)}</span>
                  </div>
                  <div className="rounded-[18px] border border-[#ddcbb0] bg-[#fff9ee]/95 px-4 py-3 text-right shadow-[0_8px_18px_rgba(93,71,39,0.08)]">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Готово тестов</div>
                    <div className="mt-2 text-[2.1rem] font-semibold leading-none text-[#2d2a22]">{progress.completed} / {progress.total}</div>
                  </div>
                </div>

                <div className="mt-7 rounded-[24px] border border-[#ddcbb0] bg-[rgba(255,251,242,0.86)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Режим проекта</div>
                      <div className="mt-2 rounded-2xl border border-[#e5d9c7] bg-[#fcf7ef] px-4 py-3 text-sm font-medium text-[#5f4b35]">{routingMeta?.mode === "competency" ? "Оценка по компетенциям" : "Оценка по текущей цели"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Фокус оценки</div>
                      <div className="mt-2 rounded-2xl border border-[#e5d9c7] bg-[#fcf7ef] px-4 py-3 text-sm font-medium text-[#5f4b35]">{competencyLabel || data?.project.target_role || goal?.title || "Не задан"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Аналитическая опора</div>
                      <div className="mt-2 rounded-2xl border border-[#e5d9c7] bg-[#fcf7ef] px-4 py-3 text-sm font-medium text-[#5f4b35]">{goal?.title || "Общая оценка"}</div>
                    </div>
                    {data?.project.target_role ? <div><div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Целевая роль</div><div className="mt-2 rounded-2xl border border-[#e5d9c7] bg-[#fcf7ef] px-4 py-3 text-sm font-medium text-[#5f4b35]">{data.project.target_role}</div></div> : null}
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-[#ddcbb0] bg-[#f8f1e5] px-5 py-4 text-sm leading-7 text-[#685742] shadow-[0_12px_24px_rgba(93,71,39,0.06)]"><span className="font-semibold text-[#4d4338]">Примечание специалисту:</span> результаты откроются после того, как участник завершит назначенные тесты.</div>
              </div>
            </div>
          </div>

          <div className="absolute left-0 top-0 origin-top-left" style={{ width: 360, height: 217, transform: `translate(${detailsTemplate.profileX}px, ${detailsTemplate.profileY}px) scale(${detailsTemplate.profileScale})` }}>
            <div className="relative h-full w-full bg-contain bg-no-repeat" style={{ backgroundImage: "url('/project-details-profile-template.png')" }}>
              {renderTemplateHandles("profile", "профиль")}
              <div className="absolute inset-x-[26px] top-[28px] text-[#2d2a22]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[2rem] font-semibold text-[#2f5031]">Профиль участника</div>
                    <div className="mt-2 text-sm leading-6 text-[#8d7860]">Профиль, должность и комментарий специалиста.</div>
                  </div>
                  <button type="button" onClick={() => setEditing((prev) => !prev)} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]">{editing ? "Отменить" : "Редактировать"}</button>
                </div>
                <div className="mt-8 rounded-[22px] border border-[#e1d3bf] bg-white/55 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Участник</div>
                  {editing ? (
                    <div className="mt-3 grid gap-3">
                      <input className="input" value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="Имя участника" />
                      <input className="input" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
                      <input className="input" value={form.current_position} onChange={(e) => setForm((prev) => ({ ...prev, current_position: e.target.value }))} placeholder="Должность" />
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2 text-[#2d2a22]">
                      <div className="text-2xl font-semibold">{data?.project.person?.full_name || "Имя участника"}</div>
                      <div className="text-sm text-[#6f6454]">{data?.project.person?.current_position || "Должность не указана"}</div>
                      {data?.project.person?.email ? <div className="text-sm text-[#6f6454]">{data.project.person.email}</div> : null}
                    </div>
                  )}
                </div>
                <div className="mt-3 rounded-[20px] border border-[#e1d3bf] bg-white/60 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Комментарий специалиста</div>
                  {editing ? <textarea className="input mt-3 min-h-[118px]" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Комментарий специалиста" /> : <div className="mt-3 text-sm leading-7 text-[#6f6454]">{data?.project.person?.notes || "Комментарий пока не добавлен."}</div>}
                </div>
                {editing ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2 text-sm font-semibold text-[#264029]" onClick={saveDetails} disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button><button type="button" className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]" onClick={() => setEditing(false)}>Отменить</button></div> : null}
              </div>
            </div>
          </div>

          <div className="absolute left-0 top-0 origin-top-left" style={{ width: 300, height: 532, transform: `translate(${detailsTemplate.qrX}px, ${detailsTemplate.qrY}px) scale(${detailsTemplate.qrScale})` }}>
            <div className="relative h-full w-full bg-contain bg-no-repeat" style={{ backgroundImage: "url('/project-details-qr-template.png')" }}>
              {renderTemplateHandles("qr", "QR")}
              <div className="absolute inset-x-[34px] top-[202px] text-[#2d2a22]">
                <div className="text-[1.1rem] font-semibold text-center">Доступ участника</div>
                <div className="mt-4 rounded-[18px] border border-[#e1d3bf] bg-white/60 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Ссылка</div>
                  <div className="mt-3 flex gap-2">
                    <input className="input flex-1" readOnly value={shareCompactUrl || shareUrl || "Ссылка появится после сохранения"} />
                    <button type="button" onClick={copyShareUrl} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]">{copied ? "Скопировано" : "Копировать"}</button>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#9d7a4b]">QR для прохождения</div>
                  <div className="mt-3 flex justify-center">{shareUrl ? <QRCodeBlock value={shareUrl} title="QR-код" size={124} /> : <div className="rounded-2xl border border-dashed border-[#d9c4a4] px-4 py-8 text-sm text-[#8d7860]">Сначала сохрани проект</div>}</div>
                  <div className="mt-3 text-sm leading-6 text-[#8d7860]">Открой ссылку на телефоне или отсканируй QR.</div>
                </div>
              </div>
            </div>
          </div>


          <div className="absolute left-0 top-0 origin-top-left" style={{ width: 178, height: 208, transform: `translate(${detailsTemplate.statusX}px, ${detailsTemplate.statusY}px) scale(${detailsTemplate.statusScale})` }}>
            <div className="relative h-full w-full bg-contain bg-no-repeat" style={{ backgroundImage: "url('/project-details-status-template.png')" }}>
              {renderTemplateHandles("status", "статусы")}
              <div className="absolute inset-x-[18px] top-[18px] flex h-[172px] flex-col justify-between text-center text-[0.95rem] font-medium text-[#5a4a37]">
                <div className="flex h-[46px] items-center justify-center">Не пройден</div>
                <div className="flex h-[60px] items-center justify-center text-[#53664a]">В процессе</div>
                <div className="flex h-[46px] items-center justify-center">Завершён</div>
              </div>
            </div>
          </div>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: 870, height: 400, transform: `translate(${detailsTemplate.testsX}px, ${detailsTemplate.testsY}px) scale(${detailsTemplate.testsScale})` }}>
            <div className="relative h-full w-full bg-contain bg-no-repeat" style={{ backgroundImage: "url('/project-details-tests-template.png')" }}>
              {renderTemplateHandles("tests", "тесты")}
              <div className="absolute inset-x-[36px] top-[34px] text-[#2d2a22]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold">Назначенные тесты</div>
                    <div className="mt-1 text-sm text-[#8d7860]">Список назначенных методик и статус прохождения.</div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {(data?.project.tests || []).map((test) => {
                    const done = completedSet.has(test.test_slug);
                    return (
                      <div key={test.test_slug} className="flex items-center justify-between gap-3 rounded-[20px] border border-[#dfcfb5] bg-[#fffaf1] px-5 py-3.5">
                        <div className="text-xl font-semibold text-[#2d2a22]">{test.test_title}</div>
                        <span className={`rounded-full px-4 py-2 text-sm font-medium ${done ? "border border-[#bfd7b8] bg-[#edf7e7] text-[#446047]" : "border border-[#d9c4a4] bg-[#fff8ec] text-[#6b5943]"}`}>{done ? "Завершён" : "Не пройден"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {fullyDone ? (
          <div className="mx-auto max-w-[1220px] rounded-[26px] border border-[#d7c4a6] bg-[#fbf5ea] p-5 shadow-[0_18px_38px_rgba(93,71,39,0.12)]">
            <div className="text-lg font-semibold text-[#2d2a22]">Уровни результата</div>
            <div className="mt-1 text-sm text-[#8d7860]">Открывай нужный уровень интерпретации по мере готовности проекта.</div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {EVALUATION_PACKAGES.map((item) => {
                const unlocked = isPackageAccessible(unlockedMode, item.key);
                const currentEval = evaluationByMode[item.key];
                const isBusy = !!saving || !!evaluationLoading[item.key];
                const upgradeRub = getUpgradePriceRub(unlockedMode, item.key);
                const accessible = unlocked || isUnlimited || projectCoveredBySubscription || (activeSubscription?.projects_remaining || 0) > 0;
                const isActive = activeEvaluationMode === item.key;
                return (
                  <div key={item.key} className={`rounded-[24px] border p-4 shadow-[0_10px_20px_rgba(93,71,39,0.06)] ${isActive ? "border-[#8eb48d] bg-[#f3faef]" : "border-[#dfcfb5] bg-[#fffaf1]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-[#2d2a22]">{item.title}</div>
                        <div className="mt-1 text-sm leading-6 text-[#7a6a57]">{item.description}</div>
                      </div>
                      <button type="button" className="text-xs font-medium text-[#8b6b3c]" onClick={() => setPackageHelp((prev) => (prev === item.key ? null : item.key))}>Что внутри?</button>
                    </div>
                    {packageHelp === item.key ? <div className="mt-3 rounded-2xl border border-[#ecdcbf] bg-white/70 p-3 text-sm leading-6 text-[#685742]">{item.helpText}</div> : null}
                    <div className="mt-4 text-sm font-semibold text-[#2f5031]">{accessible ? (unlocked ? "Уровень уже открыт" : projectCoveredBySubscription ? "Откроется по тарифу" : activeSubscription?.projects_remaining ? `Осталось ${activeSubscription.projects_remaining} проектов по тарифу` : "Можно открыть") : upgradeRub ? `Стоимость: ${formatRub(upgradeRub)}` : "Доступно после предыдущего уровня"}</div>
                    <div className="mt-4">
                      {unlocked ? (
                        <button type="button" className={`w-full rounded-2xl border px-4 py-2.5 text-sm font-medium ${isActive ? "border-[#8eb48d] bg-[#cde7c1] text-[#27402b]" : "border-[#d9c4a4] bg-[#fffaf0] text-[#5b4731]"}`} onClick={() => setActiveEvaluationMode(item.key)}>
                          {isActive ? "Показано ниже" : "Показать результат"}
                        </button>
                      ) : (
                        <button type="button" className="w-full rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] disabled:opacity-60" disabled={isBusy} onClick={() => unlockPackage(item.key)}>
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
              <div className="mt-5 rounded-[26px] border border-[#d7c4a6] bg-[#fffaf1] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ead9bf] pb-4">
                  <div>
                    <div className="text-lg font-semibold text-[#2d2a22]">{getEvaluationPackageDefinition(activeEvaluationMode)?.title || "Результат"}</div>
                    <div className="mt-1 text-sm text-[#8d7860]">Аккуратная выдача результата по выбранному уровню.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EVALUATION_PACKAGES.filter((item) => isPackageAccessible(unlockedMode, item.key)).map((item) => (
                      <button key={item.key} type="button" className={`rounded-full border px-3 py-1.5 text-xs font-medium ${activeEvaluationMode === item.key ? "border-[#8eb48d] bg-[#e4f1de] text-[#355039]" : "border-[#dec9a8] bg-[#fff8ec] text-[#6b5943]"}`} onClick={async () => { setActiveEvaluationMode(item.key); if (!evaluationByMode[item.key] && !evaluationLoading[item.key]) { await loadEvaluation(item.key, item.key === "premium_ai_plus" ? { customRequest: aiPlusRequest } : undefined); } }}>
                        {item.shortTitle}
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
                        {overviewSections.map((section, index) => (() => {
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
                        })())}
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
                  <div className="mt-4 rounded-[22px] border border-[#e1d3bf] bg-[#fcf7ef] p-4 text-sm text-[#6f6454]">Результат для этого уровня пока не собран.</div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[26px] border border-[#d8c5a8] bg-[#fbf5ea] px-5 py-4 text-sm text-[#6f6454] shadow-[0_16px_34px_rgba(93,71,39,0.10)]">Уровни результата откроются после того, как участник завершит все назначенные тесты.</div>
        )}

      </div>
    </Layout>
  );
}
