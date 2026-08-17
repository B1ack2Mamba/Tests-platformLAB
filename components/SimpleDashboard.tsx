import { useDeferredValue, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent, type ReactNode } from "react";
import { QRCodeBlock } from "@/components/QRCodeBlock";
import { COMMERCIAL_GOALS, getGoalDefinition, isAssessmentGoal, type AssessmentGoal } from "@/lib/commercialGoals";
import { MOBILE_INTERFACE_MEDIA_QUERY } from "@/lib/interfaceMode";
import styles from "../styles/SimpleDashboard.module.css";

export type SimpleDashboardProject = {
  id: string;
  title: string;
  status: string;
  goal?: string;
  target_role: string | null;
  registry_comment?: string | null;
  invite_token?: string | null;
  folder_id: string | null;
  attempts_count: number;
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
type DetailPanel = "participant" | "access" | "results";
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
  state: "loading" | "locked" | "ready";
  modeTitle: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
};

type Props = {
  displayName: string;
  workspaceName: string;
  balanceText: string;
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
  onOpenWallet: () => void;
  onOpenTrash: () => void;
  onMoveProject: (projectId: string, folderId: string | null) => Promise<void>;
  onRenameFolder: (folder: SimpleDashboardFolder) => void;
  onDeleteFolder: (folder: SimpleDashboardFolder) => void;
  onRefresh: () => Promise<unknown>;
  accessToken: string;
  onOpenResults: (projectId: string) => void;
  onProjectOpenChange?: (open: boolean, userInitiated: boolean) => void;
};

const PRIMARY_INVITE_BASE_URLS = [
  { key: "vercel", label: "Основная ссылка", baseUrl: "https://tests-platform-lab.vercel.app" },
  { key: "rf", label: "Запасная ссылка", baseUrl: "https://www.xn--80aaachl0aqe6abetcez8t.xn--p1ai" },
] as const;

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
  return Math.min(100, Math.round((project.attempts_count / project.tests.length) * 100));
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

function Icon({ name }: { name: "tests" | "folder" | "search" | "filter" | "plus" | "arrow" | "person" | "sparkles" | "archive" | "copy" | "download" | "edit" | "sliders" | "drag" }) {
  const paths: Record<typeof name, ReactNode> = {
    tests: <><path d="M7 4.5h10v15H7z" /><path d="M9.5 9h5M9.5 12h5M9.5 15h3M9 4.5V3h6v1.5" /></>,
    folder: <><path d="M3.5 7.5h6l2 2H20.5v9H3.5z" /><path d="M3.5 7.5V5h6l2 2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
    filter: <path d="M4 6h16l-6.2 7v5l-3.6 2v-7z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M8 5l7 7-7 7" />,
    person: <><circle cx="12" cy="8" r="3" /><path d="M5.5 19c.6-3.3 2.8-5 6.5-5s5.9 1.7 6.5 5" /></>,
    sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z" /><path d="m18.5 13 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" /></>,
    archive: <><path d="M5 7h14v12H5zM4 4h16v3H4z" /><path d="M9 11h6" /></>,
    copy: <><rect x="8" y="8" width="10" height="11" rx="2" /><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></>,
    download: <><path d="M12 4v10" /><path d="m8 10 4 4 4-4" /><path d="M5 19h14" /></>,
    edit: <><path d="m5 16-.8 3.8L8 19l9.8-9.8-3-3z" /><path d="m13.8 7.2 3 3" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
    drag: <><circle cx="8" cy="7" r="1" /><circle cx="16" cy="7" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="8" cy="17" r="1" /><circle cx="16" cy="17" r="1" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
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
  projects,
  folders,
  trashCount,
  loading,
  error,
  onCreateProject,
  onCreateFolder,
  onOpenCatalog,
  onOpenAiAnalytics,
  onOpenTrash,
  onMoveProject,
  onRenameFolder,
  onDeleteFolder,
  onRefresh,
  accessToken,
  onOpenResults,
  onProjectOpenChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [mainView, setMainView] = useState<MainView>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectView, setProjectView] = useState<ProjectView>("overview");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  const [copiedLink, setCopiedLink] = useState("");
  const [movingProjectId, setMovingProjectId] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState("");
  const [folderMoveNotice, setFolderMoveNotice] = useState("");
  const [aiPreviews, setAiPreviews] = useState<Record<string, AiPreview>>({});
  const [aiPreviewRevisions, setAiPreviewRevisions] = useState<Record<string, number>>({});
  const [editingProjectId, setEditingProjectId] = useState("");
  const [inlineEditForm, setInlineEditForm] = useState<InlineEditForm | null>(null);
  const [savingProjectId, setSavingProjectId] = useState("");
  const [inlineEditError, setInlineEditError] = useState("");
  const [savedProjectId, setSavedProjectId] = useState("");
  const firstProjectSelectedRef = useRef(false);
  const aiPreviewFrameRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("ru"));

  useEffect(() => {
    onProjectOpenChange?.(Boolean(selectedProjectId), false);
  }, [onProjectOpenChange, selectedProjectId]);

  useEffect(() => {
    if (!projects.length) {
      setSelectedProjectId(null);
      firstProjectSelectedRef.current = false;
      return;
    }
    if (!firstProjectSelectedRef.current) {
      firstProjectSelectedRef.current = true;
      if (!window.matchMedia(MOBILE_INTERFACE_MEDIA_QUERY).matches) {
        setSelectedProjectId(projects[0].id);
      }
      return;
    }
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(window.matchMedia(MOBILE_INTERFACE_MEDIA_QUERY).matches ? null : projects[0].id);
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
      const state = message.state === "ready" || message.state === "locked" ? message.state : "loading";
      setAiPreviews((current) => ({
        ...current,
        [message.projectId]: {
          state,
          modeTitle: typeof payload.modeTitle === "string" ? payload.modeTitle : "Результат",
          summary: typeof payload.summary === "string" ? payload.summary : "",
          strengths: Array.isArray(payload.strengths) ? payload.strengths.filter((item: unknown): item is string => typeof item === "string") : [],
          risks: Array.isArray(payload.risks) ? payload.risks.filter((item: unknown): item is string => typeof item === "string") : [],
          recommendation: typeof payload.recommendation === "string" ? payload.recommendation : "",
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

  function selectProject(projectId: string) {
    const nextProjectId = selectedProjectId === projectId ? null : projectId;
    setSelectedProjectId(nextProjectId);
    onProjectOpenChange?.(Boolean(nextProjectId), true);
    setProjectView("overview");
    setEditingProjectId("");
    setInlineEditForm(null);
    setInlineEditError("");
  }

  function togglePanel(projectId: string, panel: DetailPanel) {
    const key = `${projectId}:${panel}`;
    setCollapsedPanels((current) => ({ ...current, [key]: !current[key] }));
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
    const frameDocument = aiPreviewFrameRefs.current[projectId]?.contentDocument;
    const downloadButton = frameDocument?.querySelector<HTMLButtonElement>("[data-simple-download-analysis]");
    if (downloadButton && !downloadButton.disabled) {
      downloadButton.click();
      return;
    }
    setProjectView("results");
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

  function allowFolderDrop(event: ReactDragEvent<HTMLButtonElement>, folderId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId || "without-folder");
  }

  async function dropProjectIntoFolder(event: ReactDragEvent<HTMLButtonElement>, folderId: string) {
    event.preventDefault();
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
            <aside className={styles.folderSection} data-drag-active={Boolean(draggedProjectId)} data-onboarding-id="simple-folders" aria-label="Папки проектов">
              <div className={styles.sectionHeading}>
                <strong>Папки</strong>
              </div>
              <button type="button" className={styles.newFolderCard} data-onboarding-id="dashboard-create-folder" onClick={onCreateFolder}>
                <Icon name="plus" /><span>Создать папку</span>
              </button>
              <div className={styles.folderCards}>
                <button type="button" data-active={folderFilter === "all"} onClick={() => setFolderFilter("all")}>
                  <Icon name="folder" /><strong>Все проекты</strong><small>{projects.length}</small>
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    data-active={folderFilter === folder.id}
                    data-drop-enabled={Boolean(draggedProjectId)}
                    data-drop-target={dragOverFolderId === folder.id}
                    onClick={() => setFolderFilter(folder.id)}
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
                  onClick={() => setFolderFilter("without-folder")}
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
                <button type="button" className={styles.filterButton} data-active={toolsOpen} onClick={() => setToolsOpen((current) => !current)}>
                  <Icon name="filter" /><span>Фильтры</span>
                </button>
              </section>

              {toolsOpen ? (
                <section className={styles.quickTools}>
                  <button type="button" onClick={() => setMainView("tests")}><Icon name="tests" />Каталог тестов</button>
                  <button type="button" onClick={onOpenTrash}><Icon name="archive" />Корзина{trashCount ? ` · ${trashCount}` : ""}</button>
                  <button type="button" onClick={() => { setFolderFilter("all"); setQuery(""); }}>Сбросить фильтры</button>
                </section>
              ) : null}

              <section className={styles.registry} data-onboarding-id="simple-project-list">
            {loading ? <div className={styles.empty}>Загружаем проекты...</div> : null}
            {!loading && !projects.length ? (
              <div className={styles.empty}><strong>Проектов пока нет</strong><span>Создайте первый проект, чтобы начать оценку.</span><button type="button" onClick={() => setMainView("create")}>Создать проект</button></div>
            ) : null}
            {!loading && projects.length > 0 && !visibleProjects.length ? (
              <div className={styles.empty}><strong>Ничего не найдено</strong><span>Измените запрос или выберите другую папку.</span><button type="button" onClick={() => { setQuery(""); setFolderFilter("all"); }}>Сбросить фильтры</button></div>
            ) : null}

            {!loading ? visibleProjects.map((project) => {
              const progress = projectProgress(project);
              const isSelected = selectedProject?.id === project.id;
              const completed = Math.min(project.attempts_count, project.tests.length);
              const allTestsCompleted = project.tests.length > 0 && completed >= project.tests.length;
              const shareLinks = project.invite_token
                ? PRIMARY_INVITE_BASE_URLS.map((item) => ({ ...item, url: `${item.baseUrl}/invite/${project.invite_token}` }))
                : [];
              const qrUrl = shareLinks[0]?.url || "";
              const participantCollapsed = Boolean(collapsedPanels[`${project.id}:participant`]);
              const accessCollapsed = Boolean(collapsedPanels[`${project.id}:access`]);
              const resultsCollapsed = Boolean(collapsedPanels[`${project.id}:results`]);
              const aiPreview = aiPreviews[project.id];
              const goalDefinition = getGoalDefinition(project.goal);
              const isEditing = editingProjectId === project.id && inlineEditForm;
              const statusLabel = projectStatusLabel(project.status);

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
                      <span className={styles.status} data-tone={statusTone(project)}>{statusLabel}</span>
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
                        {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
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
                                  {project.tests.slice().sort((a, b) => a.sort_order - b.sort_order).map((test) => (
                                    <div key={test.test_slug}><span>{test.test_title}</span><small>{progress === 100 ? "Завершён" : "Назначен"}</small></div>
                                  ))}
                                  {!project.tests.length ? <div className={styles.noTests}>Тесты ещё не назначены.</div> : null}
                                </div>
                              </div>
                            ) : null}
                          </section>

                          <section className={`${styles.detailPanel} ${styles.resultsPanel}`} data-collapsed={resultsCollapsed} data-onboarding-id="simple-project-results">
                            <PanelHeader title="Результаты и ИИ" icon="sparkles" collapsed={resultsCollapsed} onToggle={() => togglePanel(project.id, "results")} />
                            {!resultsCollapsed ? (
                              <div className={`${styles.panelBody} ${styles.resultsBody}`}>
                                {project.attempts_count > 0 ? (
                                  <iframe
                                    key={`${project.id}:${aiPreviewRevisions[project.id] || 0}`}
                                    ref={(node) => {
                                      aiPreviewFrameRefs.current[project.id] = node;
                                    }}
                                    className={styles.aiPreviewBridge}
                                    src={`/projects/${project.id}/results?embedded=1&compact=1`}
                                    title={`Подготовка аналитического вывода: ${project.title}`}
                                    tabIndex={-1}
                                    aria-hidden="true"
                                  />
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
                                    <strong>Подготавливаем итоговый вывод</strong>
                                    <span>Загружаем уже сохранённый аналитический результат проекта.</span>
                                  </div>
                                ) : (
                                  <div className={styles.aiEmptyPreview}>
                                    <Icon name="sparkles" />
                                    <strong>{project.attempts_count > 0 ? "Итоговый анализ ещё не открыт" : "Результатов пока нет"}</strong>
                                    <span>{project.attempts_count > 0
                                      ? "Откройте результаты проекта, чтобы выбрать доступный уровень анализа. После этого вывод появится здесь автоматически."
                                      : "Окно анализа заполнится после первого завершённого теста."}</span>
                                  </div>
                                )}

                                {allTestsCompleted ? (
                                  <div className={styles.analysisActions}>
                                    <button type="button" className={styles.primaryAction} onClick={() => setProjectView("results")}>
                                      <Icon name="sparkles" />Сделать ИИ-анализ
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.secondaryAction}
                                      onClick={() => downloadProjectAnalysis(project.id)}
                                      disabled={aiPreview?.state !== "ready"}
                                      title={aiPreview?.state === "ready" ? "Скачать сформированный анализ в Word" : "Сначала сформируйте ИИ-анализ"}
                                    >
                                      <Icon name="download" />Скачать анализ
                                    </button>
                                  </div>
                                ) : (
                                  <span className={styles.analysisWaiting}>Кнопки анализа появятся после завершения всех тестов.</span>
                                )}
                                {aiPreview?.state === "ready" ? <span className={styles.scrollHint}>Результат прокручивается внутри этого окна</span> : null}
                              </div>
                            ) : null}
                          </section>
                        </div>
                      ) : null}

                      {projectView === "results" ? (
                        <EmbeddedWorkspace
                          src={`/projects/${project.id}/results?embedded=1&compact=1`}
                          title={`Анализ: ${project.person?.full_name || project.title}`}
                          description="База, Премиум и Премиум ИИ+"
                          variant="analysis"
                          onBack={() => setProjectView("overview")}
                          onOpenSeparate={() => onOpenResults(project.id)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            }) : null}
              </section>
            </div>
          </div>
        </>
      ) : embeddedSection}
    </main>
  );
}
