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
const PROJECT_DETAILS_TEMPLATE_STORAGE_KEY = "project_details_template_builder_v3";

type DetailsTemplateBlock = "main" | "profile" | "qr" | "tests" | "results" | "counter";
type DetailsTemplateContentTarget = `${DetailsTemplateBlock}Content`;
type DetailsTemplateTarget = DetailsTemplateBlock | DetailsTemplateContentTarget;
type DetailsGestureMode = "move" | "scale" | "resizeX" | "resizeY" | "text";

type DetailsTemplateState = {
  builderOpen: boolean;
  mainX: number;
  mainY: number;
  mainScale: number;
  mainWidthScale: number;
  mainHeightScale: number;
  mainTextScale: number;
  mainContentX: number;
  mainContentY: number;
  profileX: number;
  profileY: number;
  profileScale: number;
  profileWidthScale: number;
  profileHeightScale: number;
  profileTextScale: number;
  profileContentX: number;
  profileContentY: number;
  qrX: number;
  qrY: number;
  qrScale: number;
  qrWidthScale: number;
  qrHeightScale: number;
  qrTextScale: number;
  qrContentX: number;
  qrContentY: number;
  testsX: number;
  testsY: number;
  testsScale: number;
  testsWidthScale: number;
  testsHeightScale: number;
  testsTextScale: number;
  testsContentX: number;
  testsContentY: number;
  resultsX: number;
  resultsY: number;
  resultsScale: number;
  resultsWidthScale: number;
  resultsHeightScale: number;
  resultsTextScale: number;
  resultsContentX: number;
  resultsContentY: number;
  counterX: number;
  counterY: number;
  counterScale: number;
  counterWidthScale: number;
  counterHeightScale: number;
  counterTextScale: number;
  counterContentX: number;
  counterContentY: number;
};

const DEFAULT_DETAILS_TEMPLATE_STATE: DetailsTemplateState = {
  builderOpen: false,
  mainX: 18,
  mainY: 88,
  mainScale: 0.62,
  mainWidthScale: 1,
  mainHeightScale: 1,
  mainTextScale: 1.08,
  mainContentX: 0,
  mainContentY: 0,
  profileX: 34,
  profileY: 182,
  profileScale: 1,
  profileWidthScale: 0.34,
  profileHeightScale: 0.88,
  profileTextScale: 0.96,
  profileContentX: 0,
  profileContentY: 0,
  qrX: 465,
  qrY: 72,
  qrScale: 1,
  qrWidthScale: 0.54,
  qrHeightScale: 0.64,
  qrTextScale: 0.82,
  qrContentX: 0,
  qrContentY: 0,
  testsX: 36,
  testsY: 565,
  testsScale: 1,
  testsWidthScale: 0.62,
  testsHeightScale: 1,
  testsTextScale: 0.9,
  testsContentX: 0,
  testsContentY: 0,
  resultsX: 255,
  resultsY: 236,
  resultsScale: 1,
  resultsWidthScale: 1,
  resultsHeightScale: 1,
  resultsTextScale: 1,
  resultsContentX: 0,
  resultsContentY: 0,
  counterX: 336,
  counterY: 180,
  counterScale: 0.9,
  counterWidthScale: 1,
  counterHeightScale: 1,
  counterTextScale: 0.94,
  counterContentX: 0,
  counterContentY: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateTestsContentHeight(totalTests: number, textScale: number) {
  const safeScale = clamp(Number.isFinite(textScale) ? textScale : 1, 0.75, 1.8);
  const count = Math.max(0, totalTests || 0);
  if (count === 0) return 240;
  const headerHeight = 70 * safeScale;
  const rowHeight = 54 * safeScale;
  const rowGap = 12 * safeScale;
  const footerPadding = 24 * safeScale;
  return Math.max(240, headerHeight + count * rowHeight + Math.max(0, count - 1) * rowGap + footerPadding);
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
  const [detailsViewReady, setDetailsViewReady] = useState(false);
  const [projectPaintReady, setProjectPaintReady] = useState(false);
  const [detailsGesture, setDetailsGesture] = useState<null | {
    target: DetailsTemplateTarget;
    mode: DetailsGestureMode;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startScale: number;
    startWidthScale: number;
    startHeightScale: number;
    startTextScale: number;
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
    const needsTemplateLoad = canEditProjectDetailsTemplate && !detailsTemplateLoaded;
    if (sessionLoading || loading || !data?.project?.id || needsTemplateLoad) {
      setDetailsViewReady(false);
      return;
    }
    let rafOne = 0;
    let rafTwo = 0;
    rafOne = window.requestAnimationFrame(() => {
      rafTwo = window.requestAnimationFrame(() => setDetailsViewReady(true));
    });
    return () => {
      window.cancelAnimationFrame(rafOne);
      window.cancelAnimationFrame(rafTwo);
    };
  }, [canEditProjectDetailsTemplate, data?.project?.id, detailsTemplateLoaded, loading, sessionLoading]);

  useEffect(() => {
    const projectStillBooting = sessionLoading || loading || !data?.project?.id || !detailsViewReady;
    if (projectStillBooting) {
      setProjectPaintReady(false);
      return;
    }
    let rafOne = 0;
    let rafTwo = 0;
    let timer = 0;
    rafOne = window.requestAnimationFrame(() => {
      rafTwo = window.requestAnimationFrame(() => {
        timer = window.setTimeout(() => setProjectPaintReady(true), 120);
      });
    });
    return () => {
      window.cancelAnimationFrame(rafOne);
      window.cancelAnimationFrame(rafTwo);
      window.clearTimeout(timer);
    };
  }, [data?.project?.id, detailsViewReady, loading, sessionLoading]);

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
      if (gesture.mode === "scale") {
        const nextScale = clamp(gesture.startScale + (dx + dy) / 500, 0.6, 1.6);
        setDetailsTemplate((prev) => ({ ...prev, [`${prefix}Scale`]: Number(nextScale.toFixed(3)) } as DetailsTemplateState));
        return;
      }
      if (gesture.mode === "resizeX") {
        const nextScale = clamp(gesture.startWidthScale + dx / 320, 0.72, 1.8);
        setDetailsTemplate((prev) => ({ ...prev, [`${prefix}WidthScale`]: Number(nextScale.toFixed(3)) } as DetailsTemplateState));
        return;
      }
      if (gesture.mode === "resizeY") {
        const nextScale = clamp(gesture.startHeightScale + dy / 320, 0.72, 2.4);
        setDetailsTemplate((prev) => ({ ...prev, [`${prefix}HeightScale`]: Number(nextScale.toFixed(3)) } as DetailsTemplateState));
        return;
      }
      const nextTextScale = clamp(gesture.startTextScale + (dx + dy) / 420, 0.75, 1.8);
      setDetailsTemplate((prev) => ({ ...prev, [`${prefix}TextScale`]: Number(nextTextScale.toFixed(3)) } as DetailsTemplateState));
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

  function startDetailsGesture(target: DetailsTemplateTarget, mode: DetailsGestureMode, event: React.PointerEvent<HTMLButtonElement>) {
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
      startWidthScale: Number((detailsTemplate as any)[`${prefix}WidthScale`] || 1),
      startHeightScale: Number((detailsTemplate as any)[`${prefix}HeightScale`] || 1),
      startTextScale: Number((detailsTemplate as any)[`${prefix}TextScale`] || 1),
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
          mainX: detailsTemplate.mainX,
          mainY: detailsTemplate.mainY,
          mainScale: detailsTemplate.mainScale,
          mainWidthScale: detailsTemplate.mainWidthScale,
          mainHeightScale: detailsTemplate.mainHeightScale,
          mainTextScale: detailsTemplate.mainTextScale,
          mainContentX: detailsTemplate.mainContentX,
          mainContentY: detailsTemplate.mainContentY,
          profileX: detailsTemplate.profileX,
          profileY: detailsTemplate.profileY,
          profileScale: detailsTemplate.profileScale,
          profileWidthScale: detailsTemplate.profileWidthScale,
          profileHeightScale: detailsTemplate.profileHeightScale,
          profileTextScale: detailsTemplate.profileTextScale,
          profileContentX: detailsTemplate.profileContentX,
          profileContentY: detailsTemplate.profileContentY,
          qrX: detailsTemplate.qrX,
          qrY: detailsTemplate.qrY,
          qrScale: detailsTemplate.qrScale,
          qrWidthScale: detailsTemplate.qrWidthScale,
          qrHeightScale: detailsTemplate.qrHeightScale,
          qrTextScale: detailsTemplate.qrTextScale,
          qrContentX: detailsTemplate.qrContentX,
          qrContentY: detailsTemplate.qrContentY,
          testsX: detailsTemplate.testsX,
          testsY: detailsTemplate.testsY,
          testsScale: detailsTemplate.testsScale,
          testsWidthScale: detailsTemplate.testsWidthScale,
          testsHeightScale: detailsTemplate.testsHeightScale,
          testsTextScale: detailsTemplate.testsTextScale,
          testsContentX: detailsTemplate.testsContentX,
          testsContentY: detailsTemplate.testsContentY,
          resultsX: detailsTemplate.resultsX,
          resultsY: detailsTemplate.resultsY,
          resultsScale: detailsTemplate.resultsScale,
          resultsWidthScale: detailsTemplate.resultsWidthScale,
          resultsHeightScale: detailsTemplate.resultsHeightScale,
          resultsTextScale: detailsTemplate.resultsTextScale,
          resultsContentX: detailsTemplate.resultsContentX,
          resultsContentY: detailsTemplate.resultsContentY,
          counterX: detailsTemplate.counterX,
          counterY: detailsTemplate.counterY,
          counterScale: detailsTemplate.counterScale,
          counterWidthScale: detailsTemplate.counterWidthScale,
          counterHeightScale: detailsTemplate.counterHeightScale,
          counterTextScale: detailsTemplate.counterTextScale,
          counterContentX: detailsTemplate.counterContentX,
          counterContentY: detailsTemplate.counterContentY,
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
  const mainWidth = 760 * detailsTemplate.mainWidthScale;
  const mainHeight = 1066 * detailsTemplate.mainHeightScale;
  const qrWidth = 300 * detailsTemplate.qrWidthScale;
  const qrHeight = 532 * detailsTemplate.qrHeightScale;
  const testsWidth = 870 * detailsTemplate.testsWidthScale;
  const testsAutoHeight = estimateTestsContentHeight(data?.project.tests?.length || 0, detailsTemplate.testsTextScale);
  const testsHeight = Math.max(400 * detailsTemplate.testsHeightScale, testsAutoHeight);
  const counterWidth = 120 * detailsTemplate.counterWidthScale;
  const counterHeight = 88 * detailsTemplate.counterHeightScale;
  const detailsCanvasHeight = Math.max(
    1560,
    detailsTemplate.mainY + mainHeight + 80,
    detailsTemplate.qrY + qrHeight + 80,
    detailsTemplate.testsY + testsHeight + 80,
    detailsTemplate.counterY + counterHeight + 80
  );
  const detailsViewportScale = 0.8;

  function renderTemplateHandles(target: DetailsTemplateBlock, label: string, contentTarget?: DetailsTemplateContentTarget) {
    if (!canEditProjectDetailsTemplate || !detailsTemplate.builderOpen) return null;
    return (
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border border-[#d8c3a1] bg-[#fffaf0]/95 px-2 py-1 shadow-[0_8px_18px_rgba(80,56,27,0.12)]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b6b3c]">{label}</span>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" onPointerDown={(event) => startDetailsGesture(target, "move", event)}>Тянуть</button>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" title="Общий масштаб" aria-label="Общий масштаб" onPointerDown={(event) => startDetailsGesture(target, "scale", event)}>↘</button>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" title="Растянуть по горизонтали" aria-label="Растянуть по горизонтали" onPointerDown={(event) => startDetailsGesture(target, "resizeX", event)}>↔</button>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" title="Растянуть по вертикали" aria-label="Растянуть по вертикали" onPointerDown={(event) => startDetailsGesture(target, "resizeY", event)}>↕</button>
        <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs font-semibold text-[#6b563d]" title="Размер текста и содержимого" aria-label="Размер текста и содержимого" onPointerDown={(event) => startDetailsGesture(target, "text", event)}>A</button>
        {contentTarget ? <button type="button" className="rounded-full border border-[#d7c2a1] bg-white px-2 py-1 text-xs text-[#6b563d]" onPointerDown={(event) => startDetailsGesture(contentTarget, "move", event)}>Слой</button> : null}
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

  const projectBootPending = sessionLoading || loading || !data?.project?.id || !detailsViewReady || !projectPaintReady;
  const keepLegacyResultsOnProjectPage = false;

  if (projectBootPending) {
    return (
      <Layout title={data?.project?.title || "Проект оценки"}>
        <div className="mx-auto max-w-[1280px] px-3 pb-10 pt-2 sm:px-4">
          <div className="mx-auto mb-4 flex max-w-[1220px] flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#dcc8aa] bg-[#fbf5e7] px-4 py-3 text-sm shadow-[0_12px_30px_rgba(90,68,33,0.08)]">
            <div>
              <div className="h-4 w-48 animate-pulse rounded bg-[#eadfc8]" />
              <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[#f0e7d7]" />
            </div>
            <div className="flex gap-2">
              <div className="h-11 w-48 animate-pulse rounded-2xl bg-[#eadfc8]" />
              <div className="h-11 w-28 animate-pulse rounded-2xl bg-[#eadfc8]" />
            </div>
          </div>
          <div className="mx-auto max-w-[1220px] overflow-hidden rounded-[36px] border border-[#e8dcc8] bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe4_100%)] shadow-[0_22px_44px_rgba(90,68,33,0.08)]">
            <div className="h-[920px] animate-pulse bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(248,241,230,0.86))]" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={data?.project.title || "Проект оценки"}>
      <div className="mx-auto max-w-[1280px] px-3 pb-10 pt-2 sm:px-4">
        {error ? <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-[0_10px_24px_rgba(124,45,18,0.08)]">{error}</div> : null}
        {info ? <div className="mb-4 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-[0_10px_24px_rgba(16,84,57,0.08)]">{info}</div> : null}

        {(progress.total > 0 || fullyDone) ? (
          <div className="mx-auto mb-4 flex max-w-[1220px] flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#dcc8aa] bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe4_100%)] px-4 py-3 text-sm shadow-[0_12px_30px_rgba(90,68,33,0.08)]">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#9d7a4b]">Отдельная страница результатов</div>
              <div className="mt-1 text-[#6f5a42]">
                {fullyDone
                  ? "Страница результатов уже готова. Там скрыт внутренний механизм и отдельно показана карта связей между тестами, компетенциями и итогом."
                  : `Откроется после завершения всех тестов. Сейчас готово ${progress.completed} из ${progress.total}${progress.total ? ` · осталось ${Math.max(0, progress.total - progress.completed)}` : ""}.`}
              </div>
            </div>
            {keepLegacyResultsOnProjectPage && fullyDone ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/projects/${data?.project.id}/results?collect=1`} className="rounded-2xl border border-[#7ca36f] bg-[#d9ead3] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.14)]">
                  Собрать итог по всей информации
                </Link>
                <Link href={`/projects/${data?.project.id}/results`} className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)]">
                  Открыть страницу результатов
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731]">
                Ещё {Math.max(0, progress.total - progress.completed)} {Math.max(0, progress.total - progress.completed) === 1 ? "тест" : (Math.max(0, progress.total - progress.completed) >= 2 && Math.max(0, progress.total - progress.completed) <= 4 ? "теста" : "тестов")}
              </div>
            )}
          </div>
        ) : null}

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

        {canEditProjectDetailsTemplate && detailsTemplate.builderOpen ? (
          <div className="mx-auto mb-4 max-w-[1220px] rounded-[20px] border border-[#dcc8aa] bg-[#fffaf0] px-4 py-3 text-sm text-[#6f5a42] shadow-[0_10px_24px_rgba(90,68,33,0.05)]">
            Тянуть — перенос блока, ↘ — общий масштаб, ↔ — ширина, ↕ — высота, A — размер текста и содержимого, Слой — сдвиг внутреннего слоя без движения фона.
          </div>
        ) : null}

        <div className="relative mx-auto w-full max-w-[1220px]" style={{ height: detailsCanvasHeight * detailsViewportScale }}>
          <div className="absolute left-1/2 top-0 origin-top" style={{ width: 1220, height: detailsCanvasHeight, transform: `translateX(-50%) scale(${detailsViewportScale})` }}>
          <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(247,243,235,0.72))]" />


          <div className="absolute left-0 top-0" style={{ width: mainWidth, height: mainHeight, transform: `translate(${detailsTemplate.mainX}px, ${detailsTemplate.mainY}px)` }}>
            <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: mainWidth, height: mainHeight, transform: `scale(${detailsTemplate.mainScale})` }}>
              <div className="relative h-full w-full bg-no-repeat" style={{ backgroundImage: "url('/project-details-main-template.png')", backgroundSize: "100% 100%" }} />
            </div>
            {renderTemplateHandles("main", "лист", "mainContent")}
            <div className="absolute inset-0 text-[#7d6548]" style={{ transform: `translate(${detailsTemplate.mainContentX}px, ${detailsTemplate.mainContentY}px)` }}>
              <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${detailsTemplate.mainTextScale})` }}>
            <div className="absolute inset-x-[48px] top-[58px]">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#9d7a4b]">Проект оценки</div>
                  <h1 className="mt-3 max-w-[620px] text-[2.18rem] font-semibold leading-[1.06] text-[#2f5031]">{data?.project.title || "Без названия"}</h1>
                </div>

                <div className="mt-8 grid max-w-[640px] gap-4">
                  <div className="rounded-[24px] border border-[#ddcbb0] bg-[rgba(255,251,242,0.88)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d6548]">Профиль</div>
                      <button type="button" onClick={() => setEditing((prev) => !prev)} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]">{editing ? "Отменить" : "Редактировать"}</button>
                    </div>
                    {editing ? (
                      <div className="mt-4 grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input className="input" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
                          <input className="input" value={form.current_position} onChange={(e) => setForm((prev) => ({ ...prev, current_position: e.target.value }))} placeholder="Текущая должность" />
                        </div>
                        <input className="input" value={form.target_role} onChange={(e) => setForm((prev) => ({ ...prev, target_role: e.target.value }))} placeholder="Целевая роль" />
                        <textarea className="input min-h-[96px]" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Комментарий специалиста" />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2 text-sm font-semibold text-[#264029]" onClick={saveDetails} disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
                          <button type="button" className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]" onClick={() => setEditing(false)}>Отменить</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 text-[#2d2a22]">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-[20px] border border-[#e1d3bf] bg-white/55 px-4 py-3.5">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Email</div>
                            <div className="mt-2 text-base font-medium leading-6 text-[#5b4731] break-words">{data?.project.person?.email || "Email не указан"}</div>
                          </div>
                          <div className="rounded-[20px] border border-[#e1d3bf] bg-white/55 px-4 py-3.5">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Должность</div>
                            <div className="mt-2 text-base font-medium leading-6 text-[#5b4731]">{data?.project.person?.current_position || "Должность не указана"}</div>
                          </div>
                        </div>
                        <div className="rounded-[20px] border border-[#e1d3bf] bg-white/55 px-4 py-3.5">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Целевая роль</div>
                          <div className="mt-2 text-base font-medium leading-6 text-[#5b4731]">{data?.project.target_role || goal?.shortTitle || "Роль не указана"}</div>
                        </div>
                        <div className="rounded-[20px] border border-[#e1d3bf] bg-white/55 px-4 py-3.5">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Комментарий</div>
                          <div className="mt-2 text-sm leading-6 text-[#6f6454]">{data?.project.person?.notes || "Комментарий пока не добавлен."}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div></div></div>
          </div>

          <div className="absolute left-0 top-0" style={{ width: counterWidth, height: counterHeight, transform: `translate(${detailsTemplate.counterX}px, ${detailsTemplate.counterY}px)` }}>
            {renderTemplateHandles("counter", "готово", "counterContent")}
            <div className="absolute inset-0 text-[#2d2a22]" style={{ transform: `translate(${detailsTemplate.counterContentX}px, ${detailsTemplate.counterContentY}px)` }}>
              <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${detailsTemplate.counterTextScale})` }}>
                <div className="h-full rounded-[20px] border border-[#ddcbb0] bg-[#fff9ee]/95 px-5 py-4 text-right shadow-[0_8px_18px_rgba(93,71,39,0.08)]">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Готово тестов</div>
                  <div className="mt-2 text-[2.1rem] font-semibold leading-none text-[#2d2a22]">{progress.completed} / {progress.total}</div>
                </div>
              </div>
            </div>
          </div>



          <div className="absolute left-0 top-0" style={{ width: qrWidth, height: qrHeight, transform: `translate(${detailsTemplate.qrX}px, ${detailsTemplate.qrY}px)` }}>
            <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: qrWidth, height: qrHeight, transform: `scale(${detailsTemplate.qrScale})` }}>
              <div className="relative h-full w-full bg-no-repeat" style={{ backgroundImage: "url('/project-details-qr-template.png')", backgroundSize: "100% 100%" }} />
            </div>
            {renderTemplateHandles("qr", "QR", "qrContent")}
            <div className="absolute inset-0 text-[#2d2a22]" style={{ transform: `translate(${detailsTemplate.qrContentX}px, ${detailsTemplate.qrContentY}px)` }}>
              <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${detailsTemplate.qrTextScale})` }}>
            <div className="absolute inset-x-[28px] top-[194px]">
                <div className="text-[1.12rem] font-semibold text-center">Доступ участника</div>
                <div className="mt-3 rounded-[18px] border border-[#e1d3bf] bg-white/60 p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Ссылка</div>
                  <div className="mt-2 flex gap-2">
                    <input className="input flex-1" readOnly value={shareCompactUrl || shareUrl || "Ссылка появится после сохранения"} />
                    <button type="button" onClick={copyShareUrl} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]">{copied ? "Скопировано" : "Копировать"}</button>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#9d7a4b]">QR</div>
                  <div className="mt-2 flex justify-center">{shareUrl ? <QRCodeBlock value={shareUrl} title="QR-код" size={120} /> : <div className="rounded-2xl border border-dashed border-[#d9c4a4] px-4 py-8 text-sm text-[#8d7860]">Сначала сохрани проект</div>}</div>
                </div>

            </div></div></div>
          </div>

          <div className="absolute left-0 top-0" style={{ width: testsWidth, height: testsHeight, transform: `translate(${detailsTemplate.testsX}px, ${detailsTemplate.testsY}px)` }}>
            <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: testsWidth, height: testsHeight, transform: `scale(${detailsTemplate.testsScale})` }}>
              <div className="relative h-full w-full bg-no-repeat" style={{ backgroundImage: "url('/project-details-tests-template.png')", backgroundSize: "100% 100%" }} />
            </div>
            {renderTemplateHandles("tests", "тесты", "testsContent")}
            <div className="absolute inset-0 text-[#2d2a22]" style={{ transform: `translate(${detailsTemplate.testsContentX}px, ${detailsTemplate.testsContentY}px)` }}>
              <div className="absolute inset-0 origin-top-left" style={{ transform: `scale(${detailsTemplate.testsTextScale})` }}>
            <div className="absolute inset-x-[34px] top-[30px]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold">Назначенные тесты</div>
                    <div className="mt-1 text-sm text-[#8d7860]">Только список и статус.</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  {(data?.project.tests || []).map((test) => {
                    const done = completedSet.has(test.test_slug);
                    return (
                      <div key={test.test_slug} className="flex items-center justify-between gap-3 rounded-[20px] border border-[#dfcfb5] bg-[#fffaf1] px-5 py-3.5">
                        <div className="text-[1.05rem] font-semibold leading-6 text-[#2d2a22]">{test.test_title}</div>
                        <span className={`rounded-full px-4 py-2 text-sm font-medium ${done ? "border border-[#bfd7b8] bg-[#edf7e7] text-[#446047]" : "border border-[#d9c4a4] bg-[#fff8ec] text-[#6b5943]"}`}>{done ? "Готово" : "Не пройден"}</span>
                      </div>
                    );
                  })}
                </div>
              </div></div></div>
          </div>
          </div>
        </div>

        {keepLegacyResultsOnProjectPage && fullyDone ? (
          <div className="mx-auto max-w-[1220px] rounded-[26px] border border-[#d7c4a6] bg-[#fbf5ea] p-5 shadow-[0_18px_38px_rgba(93,71,39,0.12)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-[#2d2a22]">Уровни результата</div>
                <div className="mt-1 text-sm text-[#8d7860]">Открывай нужный уровень интерпретации по мере готовности проекта.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/projects/${data?.project.id}/results?collect=1`} className="rounded-2xl border border-[#7ca36f] bg-[#d9ead3] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.14)]">
                  Собрать итог по всей информации
                </Link>
                <Link href={`/projects/${data?.project.id}/results`} className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)]">
                  Открыть страницу результатов
                </Link>
              </div>
            </div>

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
        ) : null}

        {progress.total > 0 || fullyDone ? (
          <div className="mx-auto mt-6 max-w-[1220px] rounded-[26px] border border-[#d7c4a6] bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe4_100%)] p-5 shadow-[0_18px_38px_rgba(93,71,39,0.10)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-[760px]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#9d7a4b]">Результаты вынесены на отдельную страницу</div>
                <div className="mt-2 text-xl font-semibold text-[#2d2a22]">Вся выдача результата теперь живёт отдельно от страницы проекта</div>
                <div className="mt-2 text-sm leading-6 text-[#8d7860]">На проекте остаётся только короткий вход. Полная выдача, анализ и карта внутреннего механизма открываются на самостоятельной странице результатов.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {fullyDone ? (
                  <>
                    <Link href={`/projects/${data?.project.id}/results?collect=1`} className="rounded-2xl border border-[#7ca36f] bg-[#d9ead3] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.14)]">
                      Собрать итог по всей информации
                    </Link>
                    <Link href={`/projects/${data?.project.id}/results`} className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)]">
                      Открыть страницу результатов
                    </Link>
                  </>
                ) : (
                  <div className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731]">
                    Результаты откроются после завершения всех тестов · осталось {Math.max(0, progress.total - progress.completed)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </Layout>
  );
}
