import { useDeferredValue, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent } from "react";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { SimpleDashboardIcon as Icon } from "@/components/SimpleDashboardIcon";
import {
  COMMERCIAL_GOALS,
  getGoalDefinition,
  getUpgradePriceRub,
  isAssessmentGoal,
  isPackageAccessible,
  type AssessmentGoal,
  type EvaluationPackage,
} from "@/lib/commercialGoals";
import type { WorkspaceSubscriptionStatus } from "@/lib/commercialSubscriptions";
import { MOBILE_INTERFACE_MEDIA_QUERY } from "@/lib/interfaceMode";
import styles from "../styles/SimpleDashboard.module.css";

export type SimpleDashboardProject = {
  id: string;
  title: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  goal?: string;
  package_mode?: EvaluationPackage;
  unlocked_package_mode?: EvaluationPackage | null;
  unlocked_package_paid_at?: string | null;
  target_role: string | null;
  registry_comment?: string | null;
  invite_token?: string | null;
  folder_id: string | null;
  attempts_count: number;
  completed_test_slugs?: string[];
  tests: Array<{ test_slug: string; test_title: string; sort_order: number }>;
  person: {
    full_name: string;
    email?: string | null;
    current_position?: string | null;
    notes?: string | null;
  } | null;
};

export type SimpleDashboardFolder = {
  id: string;
  name: string;
  icon_key: string | null;
  sort_order: number;
};

type MainView = "projects" | "tests" | "create";
type ProjectView = "overview" | "results";
type AnalysisLaunchMode = "view" | "generate";
type DetailPanel = "participant" | "access" | "results";
type StatusFilter = "all" | "active" | "waiting" | "completed";
type InlineEditForm = {
  full_name: string;
  email: string;
  current_position: string;
  goal: AssessmentGoal;
  target_role: string;
  notes: string;
  registry_comment: string;
};
type AiPreview = {
  state: "loading" | "locked" | "empty" | "ready" | "error";
  modeTitle: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
  message?: string;
};
type AiPurchaseState = {
  state: "processing" | "success" | "error";
  message: string;
};
type WalletFocus = "topup" | "subscription";

type Props = {
  displayName: string;
  workspaceName: string;
  balanceText: string;
  balanceKopeks: number | null;
  walletLoading: boolean;
  isUnlimited: boolean;
  activeSubscription: WorkspaceSubscriptionStatus | null;
  attemptsCount: number;
  uniqueTestsCount: number;
  projects: SimpleDashboardProject[];
  folders: SimpleDashboardFolder[];
  trashCount: number;
  loading: boolean;
  error: string;
  onCreateProject: () => void;
  onCreateFolder: () => void;
  onOpenCatalog: () => void;
  onOpenAiAnalytics: () => void;
  onOpenWallet: (focus?: WalletFocus) => void;
  onOpenTrash: () => void;
  onMoveProject: (projectId: string, folderId: string | null) => Promise<void>;
  onRenameFolder: (folder: SimpleDashboardFolder) => void;
  onDeleteFolder: (folder: SimpleDashboardFolder) => void;
  onRefresh: () => Promise<unknown>;
  onRefreshWallet: () => Promise<unknown>;
  accessToken: string;
  onOpenResults: (projectId: string) => void;
  onProjectOpenChange?: (open: boolean, userInitiated: boolean) => void;
};

const PRIMARY_INVITE_BASE_URLS = [
  { key: "vercel", label: "Основная ссылка", baseUrl: "https://tests-platform-lab.vercel.app" },
  { key: "rf", label: "Запасная ссылка", baseUrl: "https://www.xn--80aaachl0aqe6abetcez8t.xn--p1ai" },
] as const;

const AI_PLUS_PACKAGE: EvaluationPackage = "premium_ai_plus";

function formatCompactRub(value: number) {
  return `${Math.max(0, Math.floor(value)).toLocaleString("ru-RU")} ₽`;
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "В процессе",
  archived: "В архиве",
  awaiting: "Ожидает",
  cancelled: "Отменён",
  completed: "Завершён",
  complete: "Завершён",
  created: "Новый",
  done: "Завершён",
  draft: "Черновик",
  failed: "Требует внимания",
  finished: "Завершён",
  in_progress: "В процессе",
  new: "Новый",
  on_hold: "На паузе",
  paused: "На паузе",
  pending: "Ожидает",
  processing: "В процессе",
  ready: "Завершён",
  running: "В процессе",
  waiting: "Ожидает",
};

function projectStatusLabel(status: string) {
  const value = String(status || "").trim();
  if (!value) return "В процессе";
  const key = value.toLocaleLowerCase("ru").replace(/[\s-]+/gu, "_");
  if (PROJECT_STATUS_LABELS[key]) return PROJECT_STATUS_LABELS[key];
  return /[a-z]/iu.test(value) ? "В процессе" : value;
}

function projectProgress(project: SimpleDashboardProject) {
  if (/готов|заверш|completed|complete|done|finished|ready/i.test(project.status)) return 100;
  if (!project.tests.length) return 0;
  const completed = project.completed_test_slugs?.length ?? project.attempts_count;
  return Math.min(100, Math.round((completed / project.tests.length) * 100));
}

function completedTestCount(project: SimpleDashboardProject) {
  return Math.min(project.completed_test_slugs?.length ?? project.attempts_count, project.tests.length);
}

function projectStage(project: SimpleDashboardProject) {
  const completed = completedTestCount(project);
  if (project.tests.length > 0 && completed >= project.tests.length) {
    return { label: "Тесты завершены", tone: "ready" } as const;
  }
  if (completed > 0) {
    return { label: "Проходит тесты", tone: "active" } as const;
  }

  const fallback = projectStatusLabel(project.status);
  if (!project.tests.length && /готов|заверш/i.test(fallback)) {
    return { label: fallback, tone: "ready" } as const;
  }
  if (!project.tests.length || /ожида|пауз|не нач|чернов|нов/i.test(fallback)) {
    return { label: "Черновик", tone: "waiting" } as const;
  }
  return { label: fallback, tone: statusTone(project) } as const;
}

function formatProjectUpdatedAt(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function statusTone(project: SimpleDashboardProject) {
  const label = projectStatusLabel(project.status);
  if (/готов|заверш/i.test(label)) return "ready";
  if (/ожида|пауз|не нач|чернов/i.test(label)) return "waiting";
  return "active";
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ru"))
    .join("") || "ЛК";
}

function EmbeddedWorkspace({
  src,
  title,
  description,
  variant = "default",
  onBack,
  onOpenSeparate,
}: {
  src: string;
  title: string;
  description?: string;
  variant?: "default" | "create" | "edit" | "analysis";
  onBack?: () => void;
  onOpenSeparate: () => void;
}) {
  return (
    <section className={styles.embeddedWorkspace} data-variant={variant}>
      <header>
        <div className={styles.workspaceTitle}>
          {onBack ? <button type="button" className={styles.backButton} onClick={onBack}>← Назад</button> : null}
          <span>{description || "Рабочая область"}</span>
          <strong>{title}</strong>
        </div>
        <button type="button" onClick={onOpenSeparate}>Классическая страница</button>
      </header>
      <iframe src={src} title={title} />
    </section>
  );
}

function PanelHeader({
  title,
  icon,
  collapsed,
  onToggle,
}: {
  title: string;
  icon: "person" | "tests" | "sparkles";
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className={styles.panelHeader} onClick={onToggle} aria-expanded={!collapsed}>
      <span><Icon name={icon} />{title}</span>
      <Icon name="arrow" />
    </button>
  );
}

export function SimpleDashboard({
  balanceText,
  balanceKopeks,
  walletLoading,
  isUnlimited,
  activeSubscription,
  projects,
  folders,
  trashCount,
  loading,
  error,
  onCreateProject,
  onCreateFolder,
  onOpenCatalog,
  onOpenAiAnalytics,
  onOpenWallet,
  onOpenTrash,
  onMoveProject,
  onRenameFolder,
  onDeleteFolder,
  onRefresh,
  onRefreshWallet,
  accessToken,
  onOpenResults,
  onProjectOpenChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [mainView, setMainView] = useState<MainView>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectView, setProjectView] = useState<ProjectView>("overview");
  const [analysisLaunchMode, setAnalysisLaunchMode] = useState<AnalysisLaunchMode>("view");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [foldersExpanded, setFoldersExpanded] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState("");
  const [movingProjectId, setMovingProjectId] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState("");
  const [folderMoveNotice, setFolderMoveNotice] = useState("");
  const [aiPreviews, setAiPreviews] = useState<Record<string, AiPreview>>({});
  const [aiPreviewRevisions, setAiPreviewRevisions] = useState<Record<string, number>>({});
  const [aiPurchaseStates, setAiPurchaseStates] = useState<Record<string, AiPurchaseState>>({});
  const [editingProjectId, setEditingProjectId] = useState("");
  const [inlineEditForm, setInlineEditForm] = useState<InlineEditForm | null>(null);
  const [savingProjectId, setSavingProjectId] = useState("");
  const [inlineEditError, setInlineEditError] = useState("");
  const [savedProjectId, setSavedProjectId] = useState("");
  const [downloadProjectId, setDownloadProjectId] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const downloadFrameRef = useRef<HTMLIFrameElement | null>(null);
  const aiPreviewLoadsRef = useRef(new Set<string>());
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("ru"));

  useEffect(() => {
    onProjectOpenChange?.(Boolean(selectedProjectId), false);
  }, [onProjectOpenChange, selectedProjectId]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_INTERFACE_MEDIA_QUERY);
    const update = () => setIsCompactLayout(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    function receiveAiPreview(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      if (message?.type === "commercial-project-created" && typeof message.projectId === "string") {
        void onRefresh().then(() => {
          setMainView("projects");
          setSelectedProjectId(message.projectId);
        });
        return;
      }
      if (message?.type === "commercial-project-updated" && typeof message.projectId === "string") {
        void onRefresh();
        return;
      }
      if (!message || message.type !== "commercial-project-ai-preview" || typeof message.projectId !== "string") return;
      const payload = message.payload || {};
      const state = message.state === "ready" || message.state === "locked" || message.state === "empty" ? message.state : "loading";
      setAiPreviews((current) => ({
        ...current,
        [message.projectId]: {
          state,
          modeTitle: typeof payload.modeTitle === "string" ? payload.modeTitle : "Результат",
          summary: typeof payload.summary === "string" ? payload.summary : "",
          strengths: Array.isArray(payload.strengths) ? payload.strengths.filter((item: unknown): item is string => typeof item === "string") : [],
          risks: Array.isArray(payload.risks) ? payload.risks.filter((item: unknown): item is string => typeof item === "string") : [],
          recommendation: typeof payload.recommendation === "string" ? payload.recommendation : "",
          message: "",
        },
      }));
    }
    window.addEventListener("message", receiveAiPreview);
    return () => window.removeEventListener("message", receiveAiPreview);
  }, [onRefresh]);

  const visibleProjects = projects.filter((project) => {
    const matchesFolder = folderFilter === "all"
      || (folderFilter === "without-folder" ? !project.folder_id : project.folder_id === folderFilter);
    if (!matchesFolder) return false;
    const progress = projectProgress(project);
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "completed" ? progress === 100 : statusFilter === "active" ? progress > 0 && progress < 100 : progress === 0);
    if (!matchesStatus) return false;
    if (!deferredQuery) return true;
    const searchable = [project.title, project.person?.full_name, project.person?.email, project.target_role, project.status]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru");
    return searchable.includes(deferredQuery);
  });

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const projectCountByFolder = new Map<string, number>();
  for (const project of projects) {
    if (project.folder_id) projectCountByFolder.set(project.folder_id, (projectCountByFolder.get(project.folder_id) || 0) + 1);
  }
  const projectsWithoutFolder = projects.filter((project) => !project.folder_id).length;
  const activeFolder = folders.find((folder) => folder.id === folderFilter) || null;
  const visibleProjectGroups = folderFilter === "all"
    ? [
        ...folders.map((folder) => ({
          key: folder.id,
          name: folder.name,
          projects: visibleProjects.filter((project) => project.folder_id === folder.id),
        })),
        {
          key: "without-folder",
          name: "Без папки",
          projects: visibleProjects.filter((project) => !project.folder_id),
        },
      ]
    : [{
        key: folderFilter,
        name: activeFolder?.name || "Без папки",
        projects: visibleProjects,
      }];
  const selectedPreviewRevision = selectedProjectId ? aiPreviewRevisions[selectedProjectId] || 0 : 0;
  const selectedCompletedCount = selectedProject ? completedTestCount(selectedProject) : 0;

  useEffect(() => {
    if (!selectedProjectId || !accessToken || selectedCompletedCount <= 0) return;

    const loadKey = `${selectedProjectId}:${selectedPreviewRevision}`;
    const previewLoads = aiPreviewLoadsRef.current;
    if (previewLoads.has(loadKey)) return;
    previewLoads.add(loadKey);
    const controller = new AbortController();
    let settled = false;

    setAiPreviews((current) => ({
      ...current,
      [selectedProjectId]: {
        state: "loading",
        modeTitle: "Результат",
        summary: "",
        strengths: [],
        risks: [],
        recommendation: "",
      },
    }));

    void fetch(`/api/commercial/projects/evaluation-preview?id=${encodeURIComponent(selectedProjectId)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Не удалось загрузить сохранённый анализ");
        const preview = payload?.preview || {};
        const state = payload?.state === "ready" || payload?.state === "locked" || payload?.state === "empty"
          ? payload.state
          : "empty";
        setAiPreviews((current) => ({
          ...current,
          [selectedProjectId]: {
            state,
            modeTitle: typeof preview.modeTitle === "string" ? preview.modeTitle : "Результат",
            summary: typeof preview.summary === "string" ? preview.summary : "",
            strengths: Array.isArray(preview.strengths) ? preview.strengths.filter((item: unknown): item is string => typeof item === "string") : [],
            risks: Array.isArray(preview.risks) ? preview.risks.filter((item: unknown): item is string => typeof item === "string") : [],
            recommendation: typeof preview.recommendation === "string" ? preview.recommendation : "",
          },
        }));
        settled = true;
      })
      .catch((previewError: any) => {
        if (previewError?.name === "AbortError") return;
        setAiPreviews((current) => ({
          ...current,
          [selectedProjectId]: {
            state: "error",
            modeTitle: "Результат",
            summary: "",
            strengths: [],
            risks: [],
            recommendation: "",
            message: previewError?.message || "Не удалось загрузить сохранённый анализ",
          },
        }));
        settled = true;
      });

    return () => {
      controller.abort();
      if (!settled) previewLoads.delete(loadKey);
    };
  }, [accessToken, selectedCompletedCount, selectedPreviewRevision, selectedProjectId]);

  useEffect(() => {
    if (!downloadProjectId) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const downloadButton = downloadFrameRef.current?.contentDocument?.querySelector<HTMLButtonElement>("[data-simple-download-analysis]");
      if (downloadButton && !downloadButton.disabled) {
        downloadButton.click();
        window.clearInterval(timer);
        setDownloadMessage("Файл подготовлен и передан в загрузки браузера.");
        window.setTimeout(() => {
          setDownloadProjectId("");
          setDownloadMessage("");
        }, 2400);
        return;
      }
      if (Date.now() - startedAt > 90000) {
        window.clearInterval(timer);
        setDownloadProjectId("");
        setDownloadMessage("Не удалось подготовить файл автоматически. Откройте полный анализ и скачайте его там.");
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [downloadProjectId]);

  function selectProject(projectId: string) {
    const nextProjectId = selectedProjectId === projectId ? null : projectId;
    setSelectedProjectId(nextProjectId);
    onProjectOpenChange?.(Boolean(nextProjectId), true);
    setProjectView("overview");
    setAnalysisLaunchMode("view");
    setEditingProjectId("");
    setInlineEditForm(null);
    setInlineEditError("");
    if (nextProjectId && isCompactLayout) {
      setCollapsedPanels((current) => ({
        ...current,
        [`${nextProjectId}:participant`]: false,
        [`${nextProjectId}:access`]: true,
        [`${nextProjectId}:results`]: true,
      }));
    }
  }

  function togglePanel(projectId: string, panel: DetailPanel) {
    const key = `${projectId}:${panel}`;
    setCollapsedPanels((current) => {
      const nextCollapsed = !current[key];
      if (!isCompactLayout || nextCollapsed) return { ...current, [key]: nextCollapsed };
      return {
        ...current,
        [`${projectId}:participant`]: panel !== "participant",
        [`${projectId}:access`]: panel !== "access",
        [`${projectId}:results`]: panel !== "results",
      };
    });
  }

  async function copyLink(url: string) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      window.setTimeout(() => setCopiedLink((current) => current === url ? "" : current), 1800);
    } catch {}
  }

  function downloadProjectAnalysis(projectId: string) {
    if (downloadProjectId) return;
    setDownloadMessage("Подготавливаем файл Word без повторного списания...");
    setDownloadProjectId(projectId);
  }

  function chooseFolder(folderId: string) {
    setFolderFilter(folderId);
    if (isCompactLayout) setFoldersExpanded(false);
  }

  async function startAiPlusAnalysis(project: SimpleDashboardProject) {
    if (!accessToken || aiPurchaseStates[project.id]?.state === "processing") return;

    const completed = Math.min(project.attempts_count, project.tests.length);
    const allTestsCompleted = project.tests.length > 0 && completed >= project.tests.length;
    if (!allTestsCompleted) {
      setAiPurchaseStates((current) => ({
        ...current,
        [project.id]: { state: "error", message: "ИИ-анализ станет доступен после завершения всех назначенных тестов." },
      }));
      return;
    }

    const currentMode = project.unlocked_package_mode || null;
    if (isPackageAccessible(currentMode, AI_PLUS_PACKAGE)) {
      const previewState = aiPreviews[project.id]?.state;
      if (!previewState || previewState === "loading") {
        setAiPurchaseStates((current) => ({
          ...current,
          [project.id]: { state: "error", message: "Проверяем сохранённый анализ. Подождите несколько секунд." },
        }));
        return;
      }
      if (previewState === "error") {
        setAiPurchaseStates((current) => ({
          ...current,
          [project.id]: { state: "error", message: "Не удалось проверить сохранённый анализ. Повторите загрузку результата." },
        }));
        return;
      }
      setAnalysisLaunchMode(previewState === "ready" ? "view" : "generate");
      setProjectView("results");
      return;
    }

    const upgradePriceRub = getUpgradePriceRub(currentMode, AI_PLUS_PACKAGE);
    const coveredBySubscription = Boolean(activeSubscription?.covered_project_ids?.includes(project.id));
    const subscriptionAvailable = coveredBySubscription || Number(activeSubscription?.projects_remaining || 0) > 0;
    const walletBalanceRub = Math.floor(Number(balanceKopeks || 0) / 100);

    if (!isUnlimited && !subscriptionAvailable && walletLoading) {
      setAiPurchaseStates((current) => ({
        ...current,
        [project.id]: { state: "error", message: "Баланс ещё загружается. Подождите несколько секунд и повторите запуск." },
      }));
      return;
    }

    if (!isUnlimited && !subscriptionAvailable && walletBalanceRub < upgradePriceRub) {
      setAiPurchaseStates((current) => ({
        ...current,
        [project.id]: {
          state: "error",
          message: `Для Премиум AI+ не хватает ${formatCompactRub(upgradePriceRub - walletBalanceRub)}. Пополните кошелёк или подключите тариф.`,
        },
      }));
      return;
    }

    setAiPurchaseStates((current) => ({
      ...current,
      [project.id]: { state: "processing", message: "Открываем Премиум AI+ и запускаем анализ..." },
    }));

    try {
      const response = await fetch("/api/commercial/projects/unlock", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ project_id: project.id, package_mode: AI_PLUS_PACKAGE }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Не удалось открыть Премиум AI+");

      const chargedRub = Number(payload?.charged_rub || 0);
      const remaining = Number(payload?.subscription_remaining);
      const successMessage = payload?.used_subscription
        ? `Премиум AI+ открыт по тарифу${Number.isFinite(remaining) ? `. Осталось проектов: ${remaining}` : ""}.`
        : chargedRub > 0
          ? `Премиум AI+ открыт. Списано ${formatCompactRub(chargedRub)}.`
          : "Премиум AI+ уже открыт для этого проекта.";

      setAiPurchaseStates((current) => ({
        ...current,
        [project.id]: { state: "success", message: successMessage },
      }));
      await Promise.allSettled([onRefresh(), onRefreshWallet()]);
      setAiPreviewRevisions((current) => ({ ...current, [project.id]: (current[project.id] || 0) + 1 }));
      setAnalysisLaunchMode("generate");
      setProjectView("results");
    } catch (purchaseError: any) {
      setAiPurchaseStates((current) => ({
        ...current,
        [project.id]: { state: "error", message: purchaseError?.message || "Не удалось открыть Премиум AI+." },
      }));
    }
  }

  async function moveProjectToFolder(projectId: string, folderId: string) {
    setMovingProjectId(projectId);
    try {
      await onMoveProject(projectId, folderId || null);
    } finally {
      setMovingProjectId("");
    }
  }

  function beginProjectDrag(event: ReactDragEvent<HTMLElement>, projectId: string) {
    const target = event.target as HTMLElement;
    if (target.closest('[data-no-row-drag="true"], select, input, textarea, a')) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
    setDraggedProjectId(projectId);
    setFolderMoveNotice("");
  }

  function finishProjectDrag() {
    setDraggedProjectId("");
    setDragOverFolderId("");
  }

  function allowFolderDrop(event: ReactDragEvent<HTMLElement>, folderId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId || "without-folder");
  }

  function leaveFolderDropTarget(event: ReactDragEvent<HTMLElement>, folderId: string) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    const targetKey = folderId || "without-folder";
    setDragOverFolderId((current) => current === targetKey ? "" : current);
  }

  async function dropProjectIntoFolder(event: ReactDragEvent<HTMLElement>, folderId: string) {
    event.preventDefault();
    event.stopPropagation();
    const projectId = event.dataTransfer.getData("text/plain") || draggedProjectId;
    const project = projects.find((item) => item.id === projectId);
    const targetFolderId = folderId || "";
    finishProjectDrag();
    if (!project || (project.folder_id || "") === targetFolderId) return;

    try {
      await moveProjectToFolder(projectId, targetFolderId);
      const targetName = folders.find((folder) => folder.id === targetFolderId)?.name || "Без папки";
      setFolderMoveNotice(`«${project.title}» перемещён: ${targetName}`);
    } catch {
      setFolderMoveNotice("Не удалось переместить проект. Попробуйте ещё раз.");
    }
    window.setTimeout(() => setFolderMoveNotice(""), 2600);
  }

  function beginInlineEdit(project: SimpleDashboardProject) {
    setEditingProjectId(project.id);
    setInlineEditError("");
    setSavedProjectId("");
    setInlineEditForm({
      full_name: project.person?.full_name || "",
      email: project.person?.email || "",
      current_position: project.person?.current_position || "",
      goal: isAssessmentGoal(project.goal) ? project.goal : "role_fit",
      target_role: project.target_role || "",
      notes: project.person?.notes || "",
      registry_comment: project.registry_comment || "",
    });
  }

  function cancelInlineEdit() {
    setEditingProjectId("");
    setInlineEditForm(null);
    setInlineEditError("");
  }

  async function saveInlineEdit(event: FormEvent<HTMLFormElement>, projectId: string) {
    event.preventDefault();
    if (!inlineEditForm || savingProjectId) return;
    if (!accessToken) {
      setInlineEditError("Сессия входа ещё загружается. Повторите сохранение через несколько секунд.");
      return;
    }
    if (!inlineEditForm.full_name.trim()) {
      setInlineEditError("Укажите имя и фамилию участника.");
      return;
    }

    setSavingProjectId(projectId);
    setInlineEditError("");
    try {
      const response = await fetch("/api/commercial/projects/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          person_name: inlineEditForm.full_name,
          person_email: inlineEditForm.email,
          current_position: inlineEditForm.current_position,
          goal: inlineEditForm.goal,
          target_role: inlineEditForm.target_role,
          notes: inlineEditForm.notes,
          registry_comment: inlineEditForm.registry_comment,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Не удалось сохранить изменения");

      await onRefresh();
      setAiPreviews((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
      setAiPreviewRevisions((current) => ({ ...current, [projectId]: (current[projectId] || 0) + 1 }));
      setEditingProjectId("");
      setInlineEditForm(null);
      setSavedProjectId(projectId);
      window.setTimeout(() => setSavedProjectId((current) => current === projectId ? "" : current), 3500);
    } catch (saveError: any) {
      setInlineEditError(saveError?.message || "Не удалось сохранить изменения");
    } finally {
      setSavingProjectId("");
    }
  }

  const embeddedSection = mainView === "tests"
    ? <EmbeddedWorkspace src="/assessments?embedded=1" title="Каталог тестов" description="Тесты и методики" onBack={() => setMainView("projects")} onOpenSeparate={onOpenCatalog} />
    : mainView === "create"
        ? <EmbeddedWorkspace src="/projects/new?embedded=1&simple=1" title="Создание проекта" description="Три коротких шага" variant="create" onBack={() => setMainView("projects")} onOpenSeparate={onCreateProject} />
        : null;

  return (
    <main className={styles.shell}>
      {error ? <div className={styles.error}>{error}</div> : null}

      {mainView === "projects" ? (
        <>
          <div className={styles.projectsLayout}>
            <aside
              className={styles.folderSection}
              data-drag-active={Boolean(draggedProjectId)}
              data-mobile-open={foldersExpanded}
              data-onboarding-id="simple-folders"
              aria-label="Папки проектов"
            >
              <div className={styles.sectionHeading}>
                <strong>Папки</strong>
                <button
                  type="button"
                  className={styles.folderMobileToggle}
                  onClick={() => setFoldersExpanded((current) => !current)}
                  aria-expanded={foldersExpanded}
                  aria-label={`${foldersExpanded ? "Свернуть" : "Открыть"} список папок. Выбрано: ${activeFolder?.name || (folderFilter === "without-folder" ? "Без папки" : "Все проекты")}`}
                >
                  <span>{activeFolder?.name || (folderFilter === "without-folder" ? "Без папки" : "Все проекты")}</span>
                  <Icon name="arrow" />
                </button>
              </div>
              <button type="button" className={styles.newFolderCard} data-onboarding-id="dashboard-create-folder" onClick={onCreateFolder}>
                <Icon name="plus" /><span>Создать папку</span>
              </button>
              <div className={styles.folderCards}>
                <button type="button" data-active={folderFilter === "all"} onClick={() => chooseFolder("all")}>
                  <Icon name="folder" /><strong>Все проекты</strong><small>{projects.length}</small>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    data-active={folderFilter === folder.id}
                    data-drop-enabled={Boolean(draggedProjectId)}
                    data-drop-target={dragOverFolderId === folder.id}
                    onClick={() => chooseFolder(folder.id)}
                    onDragEnter={(event) => allowFolderDrop(event, folder.id)}
                    onDragOver={(event) => allowFolderDrop(event, folder.id)}
                    onDragLeave={() => setDragOverFolderId((current) => current === folder.id ? "" : current)}
                    onDrop={(event) => void dropProjectIntoFolder(event, folder.id)}
                  >
                    <Icon name="folder" /><strong>{folder.name}</strong><small>{projectCountByFolder.get(folder.id) || 0}</small>
                  </button>
                ))}
                <button
                  type="button"
                  data-active={folderFilter === "without-folder"}
                  data-drop-enabled={Boolean(draggedProjectId)}
                  data-drop-target={dragOverFolderId === "without-folder"}
                  onClick={() => chooseFolder("without-folder")}
                  onDragEnter={(event) => allowFolderDrop(event, "")}
                  onDragOver={(event) => allowFolderDrop(event, "")}
                  onDragLeave={() => setDragOverFolderId((current) => current === "without-folder" ? "" : current)}
                  onDrop={(event) => void dropProjectIntoFolder(event, "")}
                >
                  <Icon name="folder" /><strong>Без папки</strong><small>{projectsWithoutFolder}</small>
                </button>
              </div>
              <div className={styles.folderMoveNotice} data-active={Boolean(draggedProjectId || folderMoveNotice)} role="status" aria-live="polite">
                {draggedProjectId ? "Перетащите проект в нужную папку" : folderMoveNotice}
              </div>
              <div className={styles.folderUtilityActions}>
                <button type="button" data-onboarding-id="dashboard-ai-analytics-entry" onClick={onOpenAiAnalytics}>
                  <Icon name="sparkles" /><span>ИИ-аналитика и чат</span><Icon name="arrow" />
                </button>
              </div>
              {activeFolder ? (
                <div className={styles.folderActions}>
                  <button type="button" onClick={() => onRenameFolder(activeFolder)}><Icon name="edit" />Переименовать</button>
                  <button type="button" data-danger="true" onClick={() => onDeleteFolder(activeFolder)}>Удалить</button>
                </div>
              ) : null}
              <div className={styles.sidebarDecoration} aria-hidden="true" />
            </aside>

            <div className={styles.projectWorkspace}>
              <section className={styles.toolbar}>
                <button type="button" className={styles.createButton} data-onboarding-id="dashboard-create-project" onClick={() => setMainView("create")}>
                  <Icon name="plus" />Создать проект
                </button>
                <label className={styles.search}>
                  <Icon name="search" />
                  <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск проектов" />
                </label>
                <button
                  type="button"
                  className={styles.filterButton}
                  data-active={toolsOpen || statusFilter !== "all"}
                  onClick={() => setToolsOpen((current) => !current)}
                  aria-label="Открыть фильтры и дополнительные действия"
                  aria-expanded={toolsOpen}
                >
                  <Icon name="filter" /><span>Фильтры</span>
                </button>
              </section>

              {toolsOpen ? (
                <section className={styles.quickTools}>
                  <div className={styles.statusFilters} role="group" aria-label="Фильтр по готовности проектов">
                    <button type="button" data-active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Все</button>
                    <button type="button" data-active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>В процессе</button>
                    <button type="button" data-active={statusFilter === "waiting"} onClick={() => setStatusFilter("waiting")}>Не начаты</button>
                    <button type="button" data-active={statusFilter === "completed"} onClick={() => setStatusFilter("completed")}>Завершены</button>
                  </div>
                  <button type="button" onClick={() => setMainView("tests")}><Icon name="tests" />Каталог тестов</button>
                  <button type="button" onClick={onOpenTrash}><Icon name="archive" />Корзина{trashCount ? ` · ${trashCount}` : ""}</button>
                  <button type="button" onClick={() => { setFolderFilter("all"); setStatusFilter("all"); setQuery(""); }}>Сбросить</button>
                </section>
              ) : null}

              <section className={styles.registry} data-onboarding-id="simple-project-list">
            {loading ? <div className={styles.empty}>Загружаем проекты...</div> : null}
            {!loading && !projects.length ? (
              <div className={styles.empty}><strong>Проектов пока нет</strong><span>Создайте первый проект, чтобы начать оценку.</span><button type="button" onClick={() => setMainView("create")}>Создать проект</button></div>
            ) : null}
            {!loading && projects.length > 0 && !visibleProjects.length ? (
              <div className={styles.empty}><strong>Ничего не найдено</strong><span>Измените запрос, статус или выберите другую папку.</span><button type="button" onClick={() => { setQuery(""); setFolderFilter("all"); setStatusFilter("all"); }}>Сбросить фильтры</button></div>
            ) : null}

            {!loading && visibleProjects.length ? (
              <div className={styles.registryColumns} aria-hidden="true">
                <span />
                <div>
                  <span>Проект</span>
                  <span>Тесты</span>
                  <span>Статус</span>
                  <span>Обновлено</span>
                  <span>Прогресс</span>
                  <span />
                </div>
                <span>Папка</span>
              </div>
            ) : null}

            {!loading ? visibleProjectGroups.map((group) => {
              const targetFolderId = group.key === "without-folder" ? "" : group.key;
              const draggedProject = draggedProjectId ? projects.find((project) => project.id === draggedProjectId) : null;
              const acceptsDrop = folderFilter === "all"
                && Boolean(draggedProject)
                && (draggedProject?.folder_id || "") !== targetFolderId;
              const targetKey = targetFolderId || "without-folder";

              return (
              <section
                key={group.key}
                className={styles.projectFolderGroup}
                data-grouped={folderFilter === "all"}
                data-drop-enabled={acceptsDrop}
                data-drop-target={acceptsDrop && dragOverFolderId === targetKey}
                onDragEnter={acceptsDrop ? (event) => allowFolderDrop(event, targetFolderId) : undefined}
                onDragOver={acceptsDrop ? (event) => allowFolderDrop(event, targetFolderId) : undefined}
                onDragLeave={acceptsDrop ? (event) => leaveFolderDropTarget(event, targetFolderId) : undefined}
                onDrop={acceptsDrop ? (event) => void dropProjectIntoFolder(event, targetFolderId) : undefined}
              >
                {folderFilter === "all" ? (
                  <header className={styles.projectFolderGroupLabel}>
                    <Icon name="folder" />
                    <strong>{group.name}</strong>
                    <small>{group.projects.length}</small>
                  </header>
                ) : null}
                <div className={styles.projectFolderGroupList}>
                  {!group.projects.length ? (
                    <div className={styles.projectFolderDropHint} data-active={acceptsDrop && dragOverFolderId === targetKey}>
                      <Icon name="folder" />
                      <span>Перетащите проект сюда</span>
                    </div>
                  ) : null}
                  {group.projects.map((project) => {
              const progress = projectProgress(project);
              const isSelected = selectedProject?.id === project.id;
              const completed = completedTestCount(project);
              const completedSlugs = new Set(
                project.completed_test_slugs || (progress === 100 ? project.tests.map((test) => test.test_slug) : [])
              );
              const allTestsCompleted = project.tests.length > 0 && completed >= project.tests.length;
              const shareLinks = project.invite_token
                ? PRIMARY_INVITE_BASE_URLS.map((item) => ({ ...item, url: `${item.baseUrl}/invite/${project.invite_token}` }))
                : [];
              const qrUrl = shareLinks[0]?.url || "";
              const participantCollapsed = Boolean(collapsedPanels[`${project.id}:participant`]);
              const accessCollapsed = Boolean(collapsedPanels[`${project.id}:access`]);
              const resultsCollapsed = Boolean(collapsedPanels[`${project.id}:results`]);
              const aiPreview = aiPreviews[project.id];
              const aiPurchaseState = aiPurchaseStates[project.id];
              const currentPackageMode = project.unlocked_package_mode || null;
              const aiPlusUnlocked = isPackageAccessible(currentPackageMode, AI_PLUS_PACKAGE);
              const aiPreviewChecking = aiPlusUnlocked && (!aiPreview || aiPreview.state === "loading");
              const aiPlusUpgradePriceRub = getUpgradePriceRub(currentPackageMode, AI_PLUS_PACKAGE);
              const projectCoveredBySubscription = Boolean(activeSubscription?.covered_project_ids?.includes(project.id));
              const subscriptionCanCoverProject = projectCoveredBySubscription || Number(activeSubscription?.projects_remaining || 0) > 0;
              const walletBalanceRub = Math.floor(Number(balanceKopeks || 0) / 100);
              const walletCanCoverProject = isUnlimited || walletBalanceRub >= aiPlusUpgradePriceRub;
              const fullAnalysisReady = aiPreview?.state === "ready";
              const fullAnalysisPriceLabel = aiPlusUnlocked
                ? ""
                : isUnlimited
                  ? "(без списания)"
                  : subscriptionCanCoverProject
                    ? "(по подписке)"
                    : `(${formatCompactRub(aiPlusUpgradePriceRub)})`;
              const aiPlusNeedsPayment = allTestsCompleted
                && !aiPlusUnlocked
                && !isUnlimited
                && !subscriptionCanCoverProject
                && !walletLoading
                && !walletCanCoverProject;
              const goalDefinition = getGoalDefinition(project.goal);
              const isEditing = editingProjectId === project.id && inlineEditForm;
              const stage = projectStage(project);

              return (
                <article key={project.id} className={styles.projectEntry} data-open={isSelected} data-dragging={draggedProjectId === project.id}>
                  <div
                    className={styles.projectRow}
                    draggable={movingProjectId !== project.id}
                    data-draggable={movingProjectId !== project.id}
                    onDragStart={(event) => beginProjectDrag(event, project.id)}
                    onDragEnd={finishProjectDrag}
                    title="Строку можно перетащить в папку"
                  >
                    <span
                      className={styles.dragHandle}
                      aria-hidden="true"
                    >
                      <Icon name="drag" />
                    </span>
                    <button type="button" className={styles.projectToggle} onClick={() => selectProject(project.id)} aria-expanded={isSelected}>
                      <span className={styles.rowTitle}><i><Icon name="folder" /></i><span><strong>{project.title}</strong><small>{project.target_role || "Проект оценки"}</small></span></span>
                      <span className={styles.rowTests}>{project.tests.length ? `${completed} из ${project.tests.length}` : "Не назначены"}</span>
                      <span className={styles.status} data-tone={stage.tone}>{stage.label}</span>
                      <span className={styles.rowUpdated}>{formatProjectUpdatedAt(project.updated_at || project.created_at)}</span>
                      <span className={styles.rowProgress}><b>{progress}%</b><i><u style={{ width: `${progress}%` }} /></i></span>
                      <span className={styles.chevron}><Icon name="arrow" /></span>
                    </button>
                    <label className={styles.folderMove} data-no-row-drag="true" title="Переместить проект в папку">
                      <Icon name="folder" />
                      <select
                        value={project.folder_id || ""}
                        disabled={movingProjectId === project.id}
                        onChange={(event) => void moveProjectToFolder(project.id, event.target.value)}
                        aria-label={`Папка проекта «${project.title}»`}
                      >
                        <option value="">Без папки</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name} · {projectCountByFolder.get(folder.id) || 0}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {isSelected ? (
                    <div className={styles.projectDetails} data-onboarding-id="simple-project-details">
                      {projectView === "overview" ? (
                        <div className={styles.approvedGrid}>
                          <section className={styles.detailPanel} data-collapsed={participantCollapsed} data-onboarding-id="simple-project-participant">
                            <PanelHeader title="Участник" icon="person" collapsed={participantCollapsed} onToggle={() => togglePanel(project.id, "participant")} />
                            {!participantCollapsed ? (
                              <div className={styles.panelBody}>
                                {isEditing ? (
                                  <form className={styles.inlineEditForm} onSubmit={(event) => void saveInlineEdit(event, project.id)}>
                                    <div className={styles.inlineEditIntro}>
                                      <strong>Редактирование проекта</strong>
                                      <span>Изменения сохраняются в тот же профиль, который использует классическая версия и ИИ-анализ.</span>
                                    </div>
                                    <label className={styles.inlineEditField}>
                                      <span>Имя и фамилия</span>
                                      <input
                                        type="text"
                                        value={inlineEditForm.full_name}
                                        onChange={(event) => setInlineEditForm((current) => current ? { ...current, full_name: event.target.value } : current)}
                                        autoComplete="name"
                                        required
                                      />
                                    </label>
                                    <label className={styles.inlineEditField}>
                                      <span>Электронная почта</span>
                                      <input
                                        type="email"
                                        value={inlineEditForm.email}
                                        onChange={(event) => setInlineEditForm((current) => current ? { ...current, email: event.target.value } : current)}
                                        autoComplete="email"
                                      />
                                    </label>
                                    <label className={styles.inlineEditField}>
                                      <span>Текущая должность</span>
                                      <input
                                        type="text"
                                        value={inlineEditForm.current_position}
                                        onChange={(event) => setInlineEditForm((current) => current ? { ...current, current_position: event.target.value } : current)}
                                      />
                                    </label>
                                    <label className={styles.inlineEditField}>
                                      <span>Цель оценки</span>
                                      <select
                                        value={inlineEditForm.goal}
                                        onChange={(event) => setInlineEditForm((current) => current && isAssessmentGoal(event.target.value) ? { ...current, goal: event.target.value } : current)}
                                      >
                                        {COMMERCIAL_GOALS.map((goal) => <option key={goal.key} value={goal.key}>{goal.title}</option>)}
                                      </select>
                                    </label>
                                    <label className={styles.inlineEditField}>
                                      <span>Будущая предполагаемая должность</span>
                                      <input
                                        type="text"
                                        value={inlineEditForm.target_role}
                                        onChange={(event) => setInlineEditForm((current) => current ? { ...current, target_role: event.target.value } : current)}
                                      />
                                    </label>
                                    <label className={styles.inlineEditField}>
                                      <span>Комментарий специалиста</span>
                                      <textarea
                                        value={inlineEditForm.notes}
                                        onChange={(event) => setInlineEditForm((current) => current ? { ...current, notes: event.target.value } : current)}
                                        placeholder="Дополнительная информация об участнике"
                                      />
                                    </label>
                                    <label className={styles.inlineEditField}>
                                      <span>Уточнение для ИИ-анализа</span>
                                      <textarea
                                        value={inlineEditForm.registry_comment}
                                        onChange={(event) => setInlineEditForm((current) => current ? { ...current, registry_comment: event.target.value } : current)}
                                        placeholder="Контекст, который ИИ должен учесть в следующем анализе"
                                      />
                                      <small>Будет учтено при следующем формировании или обновлении анализа, как в классической версии.</small>
                                    </label>
                                    {inlineEditError ? <div className={styles.inlineEditError}>{inlineEditError}</div> : null}
                                    <div className={styles.inlineEditActions}>
                                      <button type="button" onClick={cancelInlineEdit} disabled={savingProjectId === project.id}>Отмена</button>
                                      <button type="submit" disabled={savingProjectId === project.id}>{savingProjectId === project.id ? "Сохраняем..." : "Сохранить"}</button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    <div className={styles.participantCard}>
                                      <span>{initials(project.person?.full_name || project.title)}</span>
                                      <div><strong>{project.person?.full_name || "Участник не указан"}</strong><small>{project.person?.email || "Электронная почта не указана"}</small></div>
                                    </div>
                                    <dl className={styles.personFacts}>
                                      <div><dt>Текущая роль</dt><dd>{project.person?.current_position || "Не указана"}</dd></div>
                                      <div><dt>Целевая роль</dt><dd>{project.target_role || "Не указана"}</dd></div>
                                      <div><dt>Цель оценки</dt><dd>{goalDefinition?.title || "Оценка профессионального профиля"}</dd></div>
                                      <div><dt>Комментарий</dt><dd>{project.person?.notes || "Не указан"}</dd></div>
                                      <div><dt>Для ИИ</dt><dd>{project.registry_comment || "Уточнение не добавлено"}</dd></div>
                                    </dl>
                                    {savedProjectId === project.id ? <span className={styles.inlineEditSuccess}>Изменения сохранены. ИИ увидит их при следующем обновлении анализа.</span> : null}
                                    <button type="button" className={styles.secondaryAction} onClick={() => beginInlineEdit(project)}><Icon name="edit" />Редактировать проект</button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </section>

                          <section className={styles.detailPanel} data-collapsed={accessCollapsed} data-onboarding-id="simple-project-access">
                            <PanelHeader title="Доступ и тестирование" icon="tests" collapsed={accessCollapsed} onToggle={() => togglePanel(project.id, "access")} />
                            {!accessCollapsed ? (
                              <div className={styles.panelBody}>
                                <div className={styles.accessBlock}>
                                  <div className={styles.shareLinks}>
                                    {shareLinks.map((link) => (
                                      <div key={link.key}>
                                        <span>{link.label}</span>
                                        <input
                                          type="text"
                                          value={link.url}
                                          readOnly
                                          aria-label={`${link.label}: полный адрес`}
                                          title="Нажмите, чтобы выделить полный адрес"
                                          onFocus={(event) => event.currentTarget.select()}
                                        />
                                        <button type="button" onClick={() => copyLink(link.url)} aria-label={`Скопировать: ${link.label}`}>
                                          <Icon name="copy" />
                                          {copiedLink === link.url ? "Ссылка скопирована" : "Копировать ссылку"}
                                        </button>
                                      </div>
                                    ))}
                                    {!shareLinks.length ? <span className={styles.noLink}>Ссылка участника ещё не сформирована.</span> : null}
                                  </div>
                                  <div className={styles.qrBox}>{qrUrl ? <QRCodeBlock value={qrUrl} title="QR-код участника" size={112} /> : <span>QR появится после сохранения ссылки</span>}</div>
                                </div>
                                <div data-onboarding-id="simple-project-progress">
                                  <div className={styles.testsHeading}><strong>Назначенные тесты</strong><span>{completed} из {project.tests.length} завершено</span></div>
                                  <div className={styles.completionBar}><i style={{ width: `${progress}%` }} /></div>
                                </div>
                                <div className={styles.testList}>
                                  {project.tests.slice().sort((a, b) => a.sort_order - b.sort_order).map((test) => {
                                    const testCompleted = completedSlugs.has(test.test_slug);
                                    return (
                                      <div key={test.test_slug}>
                                        <span>{test.test_title}</span>
                                        <small data-completed={testCompleted}>{testCompleted ? "Завершён" : "Ожидает"}</small>
                                      </div>
                                    );
                                  })}
                                  {!project.tests.length ? <div className={styles.noTests}>Тесты ещё не назначены.</div> : null}
                                </div>
                              </div>
                            ) : null}
                          </section>

                          <section className={`${styles.detailPanel} ${styles.resultsPanel}`} data-collapsed={resultsCollapsed} data-onboarding-id="simple-project-results">
                            <PanelHeader title="Результаты и ИИ" icon="sparkles" collapsed={resultsCollapsed} onToggle={() => togglePanel(project.id, "results")} />
                            {!resultsCollapsed ? (
                              <div className={`${styles.panelBody} ${styles.resultsBody}`}>
                                <div className={styles.analysisActions}>
                                  <button
                                    type="button"
                                    className={styles.primaryAction}
                                    onClick={() => fullAnalysisReady ? onOpenResults(project.id) : void startAiPlusAnalysis(project)}
                                    disabled={!allTestsCompleted || aiPurchaseState?.state === "processing" || aiPreviewChecking}
                                    title={allTestsCompleted
                                      ? fullAnalysisReady
                                        ? "Открыть страницу с полным анализом"
                                        : aiPlusUnlocked
                                        ? aiPreviewChecking
                                          ? "Проверяем, есть ли сохранённый анализ"
                                          : "Сформировать полный анализ Премиум AI+"
                                        : subscriptionCanCoverProject || isUnlimited
                                          ? "Открыть Премиум AI+ по действующему тарифу"
                                          : `Сделать полный анализ за ${formatCompactRub(aiPlusUpgradePriceRub)}`
                                      : "ИИ-анализ станет доступен после завершения всех тестов"}
                                  >
                                    <Icon name="sparkles" />
                                    <span className={styles.analysisActionText}>
                                      <span>{aiPurchaseState?.state === "processing"
                                        ? "Формируем полный анализ..."
                                        : aiPreviewChecking
                                          ? "Проверяем анализ..."
                                          : fullAnalysisReady
                                            ? "Открыть полный анализ"
                                            : "Сделать полный анализ"}</span>
                                      {!fullAnalysisReady && aiPurchaseState?.state !== "processing" && !aiPreviewChecking && fullAnalysisPriceLabel ? (
                                        <small>{fullAnalysisPriceLabel}</small>
                                      ) : null}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.secondaryAction}
                                    onClick={() => downloadProjectAnalysis(project.id)}
                                    disabled={!allTestsCompleted || aiPreview?.state !== "ready" || Boolean(downloadProjectId)}
                                    title={!allTestsCompleted
                                      ? "Скачивание станет доступно после завершения всех тестов"
                                      : aiPreview?.state === "ready"
                                        ? "Скачать сформированный анализ в Word"
                                        : "Сначала сформируйте ИИ-анализ"}
                                  >
                                    <Icon name="download" />{downloadProjectId === project.id ? "Готовим файл..." : "Скачать анализ"}
                                  </button>
                                </div>
                                <div
                                  className={styles.aiBillingSummary}
                                  data-tone={aiPlusUnlocked ? "ready" : aiPlusNeedsPayment ? "attention" : "available"}
                                  aria-label="Текущий баланс"
                                >
                                  <div>
                                    <span>Текущий баланс</span>
                                    <strong>{isUnlimited ? "Без лимита" : walletLoading || balanceKopeks == null ? balanceText : formatCompactRub(walletBalanceRub)}</strong>
                                  </div>
                                </div>
                                {aiPlusNeedsPayment ? (
                                  <div className={styles.aiBillingPaywall}>
                                    <div>
                                      <strong>Для анализа нужно пополнить баланс или подключить тариф</strong>
                                      <span>На кошельке {balanceText}. Для этого проекта не хватает {formatCompactRub(aiPlusUpgradePriceRub - walletBalanceRub)}.</span>
                                    </div>
                                    <div>
                                      <button type="button" onClick={() => onOpenWallet("topup")}>Пополнить кошелёк</button>
                                      <button type="button" onClick={() => onOpenWallet("subscription")}>Выбрать подписку</button>
                                    </div>
                                  </div>
                                ) : null}
                                {aiPurchaseState?.message ? (
                                  <div className={styles.aiPurchaseNotice} data-tone={aiPurchaseState.state} role="status" aria-live="polite">
                                    {aiPurchaseState.message}
                                  </div>
                                ) : null}
                                {downloadMessage && (downloadProjectId === project.id || !downloadProjectId) ? (
                                  <div className={styles.aiPurchaseNotice} data-tone={downloadProjectId ? "processing" : "success"} role="status" aria-live="polite">
                                    {downloadMessage}
                                  </div>
                                ) : null}
                                {!allTestsCompleted ? (
                                  <span className={styles.analysisWaiting}>Кнопки станут доступны после завершения всех назначенных тестов.</span>
                                ) : null}

                                {aiPreview?.state === "ready" && aiPreview.summary ? (
                                  <div className={styles.aiAdaptedResult}>
                                    <div className={styles.aiResultLead}>
                                      <span><Icon name="sparkles" />{aiPreview.modeTitle}</span>
                                      <strong>Итоговый аналитический вывод</strong>
                                      <p>{aiPreview.summary}</p>
                                    </div>

                                    {(aiPreview.strengths.length || aiPreview.risks.length) ? (
                                      <div className={styles.aiInsightGrid}>
                                        {aiPreview.strengths.length ? (
                                          <section data-tone="positive">
                                            <strong>Сильные стороны</strong>
                                            <ul>{aiPreview.strengths.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
                                          </section>
                                        ) : null}
                                        {aiPreview.risks.length ? (
                                          <section data-tone="attention">
                                            <strong>Зоны внимания</strong>
                                            <ul>{aiPreview.risks.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
                                          </section>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {aiPreview.recommendation ? (
                                      <div className={styles.aiRecommendation}>
                                        <strong>Рекомендация</strong>
                                        <p>{aiPreview.recommendation}</p>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : aiPreview?.state === "loading" && project.attempts_count > 0 ? (
                                  <div className={styles.aiLoadingPreview}>
                                    <Icon name="sparkles" />
                                    <strong>Открываем сохранённый вывод</strong>
                                    <span>Только читаем готовый результат, без повторного анализа и списания.</span>
                                  </div>
                                ) : aiPreview?.state === "error" ? (
                                  <div className={styles.aiEmptyPreview}>
                                    <Icon name="sparkles" />
                                    <strong>Не удалось показать сохранённый вывод</strong>
                                    <span>{aiPreview.message || "Проверьте соединение и попробуйте ещё раз."}</span>
                                    <button
                                      type="button"
                                      className={styles.secondaryAction}
                                      onClick={() => {
                                        aiPreviewLoadsRef.current.delete(`${project.id}:${aiPreviewRevisions[project.id] || 0}`);
                                        setAiPreviewRevisions((current) => ({ ...current, [project.id]: (current[project.id] || 0) + 1 }));
                                      }}
                                    >
                                      Повторить загрузку
                                    </button>
                                  </div>
                                ) : (
                                  <div className={styles.aiEmptyPreview}>
                                    <Icon name="sparkles" />
                                    <strong>{project.attempts_count > 0 ? "Готового ИИ-вывода пока нет" : "Результатов пока нет"}</strong>
                                    <span>{project.attempts_count > 0
                                      ? allTestsCompleted
                                        ? "Нажмите «Сделать полный анализ». После формирования готовый краткий вывод будет открываться здесь без повторного запуска модели."
                                        : "Завершите назначенные тесты. Здесь появится итоговый вывод по их результатам."
                                      : "Окно анализа заполнится после первого завершённого теста."}</span>
                                  </div>
                                )}

                                {aiPreview?.state === "ready" ? <span className={styles.scrollHint}>Результат прокручивается внутри этого окна</span> : null}
                              </div>
                            ) : null}
                          </section>
                        </div>
                      ) : null}

                      {projectView === "results" ? (
                        <EmbeddedWorkspace
                          src={`/projects/${project.id}/results?embedded=1&compact=1&${analysisLaunchMode === "generate" ? "generate=1" : "view_only=1"}`}
                          title={`Анализ: ${project.person?.full_name || project.title}`}
                          description="Премиум AI+"
                          variant="analysis"
                          onBack={() => {
                            setAnalysisLaunchMode("view");
                            setProjectView("overview");
                          }}
                          onOpenSeparate={() => onOpenResults(project.id)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
                  })}
                </div>
              </section>
              );
            }) : null}
              </section>
            </div>
          </div>
        </>
      ) : embeddedSection}
      {downloadProjectId ? (
        <iframe
          ref={downloadFrameRef}
          className={styles.aiPreviewBridge}
          src={`/projects/${downloadProjectId}/results?embedded=1&compact=1&view_only=1`}
          title="Подготовка файла анализа"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : null}
    </main>
  );
}
