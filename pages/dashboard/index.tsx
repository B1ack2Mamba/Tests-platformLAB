import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { COMMERCIAL_GOALS, getGoalDefinition, type AssessmentGoal } from "@/lib/commercialGoals";
import { FOLDER_ICONS, getFolderIcon, type FolderIconKey } from "@/lib/folderIcons";
import { useWallet } from "@/lib/useWallet";
import { isAdminEmail } from "@/lib/admin";

type DashboardPayload = {
  profile: {
    full_name: string | null;
    company_name: string | null;
    email: string | null;
  } | null;
  stats: {
    attempts_count: number;
    unique_tests_count: number;
  };
};

type FolderRow = {
  id: string;
  name: string;
  icon_key: string | null;
  sort_order: number;
  created_at: string;
};

type ProjectRow = {
  id: string;
  title: string;
  goal: AssessmentGoal;
  package_mode: string;
  target_role: string | null;
  status: string;
  created_at: string;
  folder_id: string | null;
  person: { id: string; full_name: string; email: string | null; current_position: string | null } | null;
  tests: Array<{ test_slug: string; test_title: string; sort_order: number }>;
  attempts_count: number;
};

type WorkspacePayload = {
  ok: true;
  workspace: { workspace_id: string; role: string; name: string };
  folders: FolderRow[];
  projects: ProjectRow[];
};

type DeskPosition = { x: number; y: number; z: number };
type DeskPositions = Record<string, DeskPosition>;

type SceneWidgetKind = "text" | "button";
type SceneWidgetAction = "createProject" | "createFolder" | "openCatalog" | "none";
type SceneWidgetTone = "marker" | "note" | "buttonPrimary" | "buttonSecondary";
type SceneWidget = {
  id: string;
  kind: SceneWidgetKind;
  text: string;
  action?: SceneWidgetAction;
  tone?: SceneWidgetTone;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  z: number;
};

type WidgetInteractionMode = "drag" | "resize" | "rotate";
type WidgetInteractionState = {
  id: string;
  mode: WidgetInteractionMode;
  startX: number;
  startY: number;
  widget: SceneWidget;
};

const DESK_WIDTH = 1400;
const DESK_HEIGHT = 760;
const DESK_FOLDER_WIDTH = 164;
const DESK_FOLDER_HEIGHT = 142;
const DESK_SHEET_WIDTH = 184;
const DESK_SHEET_HEIGHT = 132;
const DESK_STORAGE_PREFIX = "commercialDeskLayout:v1835:";
const SCENE_WIDGETS_STORAGE_PREFIX = "commercialSceneWidgets:v1836:";
const BOARD_ZONE = { x: 238, y: 124, width: 770, height: 214 };
const TRAY_ZONE = { x: 1042, y: 520, width: 246, height: 168 };
const TRAY_CLIP = { x: 1050, y: 526, width: 226, height: 124 };
const SHEET_ZONE = { x: 110, y: 618, width: 760, height: 110 };
const TRASH_ZONE = { x: 16, y: 434, width: 160, height: 180 };

const GOAL_ORDER = Object.fromEntries(COMMERCIAL_GOALS.map((item, index) => [item.key, index + 1])) as Record<AssessmentGoal, number>;

function sortProjects(list: ProjectRow[]) {
  return [...list].sort((a, b) => {
    const goalDelta = (GOAL_ORDER[a.goal] || 99) - (GOAL_ORDER[b.goal] || 99);
    if (goalDelta !== 0) return goalDelta;
    const nameA = (a.person?.full_name || a.title || "").toLowerCase();
    const nameB = (b.person?.full_name || b.title || "").toLowerCase();
    const nameDelta = nameA.localeCompare(nameB, "ru");
    if (nameDelta !== 0) return nameDelta;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "PR";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function getEntityTilt(seedSource: string, spread = 4) {
  const seed = Array.from(seedSource).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((seed % (spread * 2 + 1)) - spread) * 1.2;
}

function getStickyNoteTone(goal: AssessmentGoal) {
  switch (goal) {
    case "motivation":
      return "sticky-note-gold";
    case "general_assessment":
      return "sticky-note-mint";
    case "management_potential":
    case "leadership":
      return "sticky-note-blue";
    case "team_interaction":
    case "communication_influence":
      return "sticky-note-peach";
    case "self_organization":
    case "learning_agility":
      return "sticky-note-lilac";
    case "emotional_regulation":
      return "sticky-note-rose";
    default:
      return "sticky-note-cream";
  }
}

function goalColor(goal: AssessmentGoal) {
  switch (goal) {
    case "motivation":
      return "from-emerald-200 to-green-100 text-emerald-950 border-emerald-300";
    case "general_assessment":
      return "from-teal-200 to-emerald-100 text-teal-950 border-teal-300";
    case "management_potential":
    case "leadership":
      return "from-sky-200 to-cyan-100 text-sky-950 border-sky-300";
    case "team_interaction":
    case "communication_influence":
      return "from-amber-200 to-yellow-100 text-amber-950 border-amber-300";
    case "self_organization":
    case "learning_agility":
      return "from-violet-200 to-indigo-100 text-violet-950 border-violet-300";
    case "emotional_regulation":
      return "from-rose-200 to-pink-100 text-rose-950 border-rose-300";
    default:
      return "from-lime-200 to-emerald-100 text-lime-950 border-lime-300";
  }
}

type GreeneryLevel = 0 | 1 | 2 | 3 | 4;

function getGreeneryLevel(amountRub: number, isUnlimited = false): GreeneryLevel {
  if (isUnlimited) return 4;
  if (amountRub >= 5000) return 4;
  if (amountRub >= 2500) return 3;
  if (amountRub >= 1000) return 2;
  if (amountRub >= 300) return 1;
  return 0;
}

function getGreeneryLabel(level: GreeneryLevel) {
  switch (level) {
    case 4:
      return "Премиальный кабинет";
    case 3:
      return "Густая зелень";
    case 2:
      return "Живой интерьер";
    case 1:
      return "Первые вьюны";
    default:
      return "Чистый кабинет";
  }
}

function getGreeneryHint(level: GreeneryLevel) {
  switch (level) {
    case 4:
      return "Окна и панели уже мягко обрамлены реалистичной зеленью, а кабинет выглядит как дорогой живой интерьер.";
    case 3:
      return "Вьюны уже хорошо видны по рамкам и собирают интерьер в цельную живую композицию.";
    case 2:
      return "Зелень заметно оживляет панели: по краям окон уже идут первые уверенные линии вьюнов.";
    case 1:
      return "Появились первые аккуратные вьюны вокруг окон и карточек.";
    default:
      return "Пока кабинет остаётся чистым и строгим. Чем больше пополнений, тем богаче станет живая зелень вокруг окон.";
  }
}

function clampDesk(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isInsideTrayZone(x: number, y: number) {
  return x >= TRAY_ZONE.x && x <= TRAY_ZONE.x + TRAY_ZONE.width && y >= TRAY_ZONE.y && y <= TRAY_ZONE.y + TRAY_ZONE.height;
}

function getDeskStorageKey(workspaceId: string) {
  return `${DESK_STORAGE_PREFIX}${workspaceId}`;
}

function getSceneWidgetsStorageKey(workspaceId: string) {
  return `${SCENE_WIDGETS_STORAGE_PREFIX}${workspaceId}`;
}

function buildDefaultSceneWidgets(params: {
  displayName: string;
  workspaceName: string;
  email: string;
  balanceText: string;
  investedText: string;
  greeneryLabel: string;
}): SceneWidget[] {
  const { displayName, workspaceName, email, balanceText, investedText, greeneryLabel } = params;
  return [
    { id: "wallet-title", kind: "text", text: "Кошелёк", tone: "marker", x: 262, y: 150, width: 280, height: 56, rotation: -1.6, fontSize: 30, z: 20 },
    { id: "wallet-value", kind: "text", text: balanceText, tone: "note", x: 264, y: 212, width: 200, height: 40, rotation: -1.2, fontSize: 28, z: 21 },
    { id: "wallet-note", kind: "text", text: `Вложено: ${investedText} · ${greeneryLabel}`, tone: "note", x: 264, y: 265, width: 450, height: 48, rotation: -1, fontSize: 16, z: 22 },
    { id: "profile-title", kind: "text", text: workspaceName, tone: "marker", x: 262, y: 364, width: 360, height: 52, rotation: -1.6, fontSize: 28, z: 23 },
    { id: "profile-name", kind: "text", text: displayName, tone: "marker", x: 262, y: 426, width: 340, height: 58, rotation: -1, fontSize: 36, z: 24 },
    { id: "profile-role", kind: "text", text: "admin", tone: "note", x: 264, y: 494, width: 180, height: 30, rotation: -1.1, fontSize: 16, z: 25 },
    { id: "profile-email", kind: "text", text: email, tone: "note", x: 264, y: 530, width: 300, height: 34, rotation: -1.1, fontSize: 16, z: 26 },
    { id: "create-project", kind: "button", text: "Создать проект", action: "createProject", tone: "buttonPrimary", x: 1010, y: 170, width: 170, height: 46, rotation: -2.4, fontSize: 16, z: 30 },
    { id: "create-folder", kind: "button", text: "Новая папка", action: "createFolder", tone: "buttonSecondary", x: 1010, y: 226, width: 160, height: 44, rotation: -2.1, fontSize: 15, z: 31 },
    { id: "open-tests", kind: "button", text: "Каталог тестов", action: "openCatalog", tone: "buttonSecondary", x: 1010, y: 280, width: 168, height: 44, rotation: -2.2, fontSize: 15, z: 32 },
  ];
}

function getDefaultFolderPosition(index: number): DeskPosition {
  return {
    x: TRAY_CLIP.x + 8 + index * 16,
    y: TRAY_CLIP.y + 10 + index * 8,
    z: 30 + index,
  };
}

function getDefaultProjectPosition(index: number): DeskPosition {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const offsets = [
    { x: 0, y: 4 },
    { x: 206, y: 16 },
    { x: 418, y: 10 },
  ];
  const offset = offsets[col] || offsets[0];
  return {
    x: SHEET_ZONE.x + offset.x + row * 18,
    y: SHEET_ZONE.y + offset.y + row * 12,
    z: 180 + index,
  };
}

function mergeDeskPositions(folders: FolderRow[], projects: ProjectRow[], saved: DeskPositions): DeskPositions {
  const next: DeskPositions = {};

  folders.forEach((folder, index) => {
    const key = `folder:${folder.id}`;
    next[key] = saved[key] || getDefaultFolderPosition(index);
  });

  projects.forEach((project, index) => {
    const key = `project:${project.id}`;
    next[key] = saved[key] || getDefaultProjectPosition(index);
  });

  return next;
}

export default function DashboardPage() {
  const { session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState<FolderIconKey>("folder");
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [busyFolderId, setBusyFolderId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [iconPickerFolder, setIconPickerFolder] = useState<FolderRow | null>(null);
  const [folderActionTarget, setFolderActionTarget] = useState<FolderRow | null>(null);
  const [folderRenameTarget, setFolderRenameTarget] = useState<FolderRow | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<FolderRow | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const { wallet, ledger, loading: walletLoading, isUnlimited } = useWallet();
  const isAdmin = isAdminEmail(user?.email);
  const [mechanicPulse, setMechanicPulse] = useState(0);
  const [deskPositions, setDeskPositions] = useState<DeskPositions>({});
  const [deskLayer, setDeskLayer] = useState(300);
  const [previewProject, setPreviewProject] = useState<ProjectRow | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [trashHover, setTrashHover] = useState<{ kind: "project" | "folder"; id: string } | null>(null);
  const trashHoverTimer = useRef<number | null>(null);
  const canEditScene = user?.email === "storyguild9@gmail.com" || isAdmin;
  const [sceneEditMode, setSceneEditMode] = useState(false);
  const [sceneWidgets, setSceneWidgets] = useState<SceneWidget[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const widgetInteractionRef = useRef<WidgetInteractionState | null>(null);

  const balance_rub = useMemo(() => {
    if (isUnlimited) return 999999;
    return Math.floor(Number(wallet?.balance_kopeks ?? 0) / 100);
  }, [isUnlimited, wallet?.balance_kopeks]);

  const investedRub = useMemo(() => {
    if (isUnlimited) return 10000;
    const creditedKopeks = ledger.reduce((sum, item) => {
      const amount = Number(item?.amount_kopeks ?? 0);
      return amount > 0 ? sum + amount : sum;
    }, 0);
    const fromLedger = Math.floor(creditedKopeks / 100);
    return Math.max(fromLedger, balance_rub, 0);
  }, [balance_rub, isUnlimited, ledger]);

  const greeneryLevel = useMemo(() => getGreeneryLevel(investedRub, isUnlimited), [investedRub, isUnlimited]);
  const greeneryLabel = useMemo(() => getGreeneryLabel(greeneryLevel), [greeneryLevel]);
  const greeneryHint = useMemo(() => getGreeneryHint(greeneryLevel), [greeneryLevel]);
  const balanceText = walletLoading ? "…" : isUnlimited ? "∞" : `${balance_rub} ₽`;
  const investedText = isUnlimited ? "без лимита" : `${investedRub} ₽`;

  const triggerMechanics = useCallback((after?: () => void, delay = 220) => {
    setMechanicPulse((value) => value + 1);
    if (after) {
      window.setTimeout(() => {
        after();
      }, delay);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [profileResp, workspaceResp] = await Promise.all([
        fetch("/api/commercial/profile/me", {
          headers: { authorization: `Bearer ${session.access_token}` },
        }),
        fetch("/api/commercial/projects/list", {
          headers: { authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      const profileJson = await profileResp.json().catch(() => ({}));
      const workspaceJson = await workspaceResp.json().catch(() => ({}));
      if (!profileResp.ok || !profileJson?.ok) throw new Error(profileJson?.error || "Не удалось загрузить кабинет");
      if (!workspaceResp.ok || !workspaceJson?.ok) throw new Error(workspaceJson?.error || "Не удалось загрузить проекты");

      setData(profileJson as DashboardPayload & { ok: true });
      setWorkspace(workspaceJson as WorkspacePayload);
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [session, user?.email]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || !user) {
      router.replace("/auth?next=%2Fdashboard");
      return;
    }
    loadDashboard();
  }, [router, session, sessionLoading, user, loadDashboard]);

  const displayName = data?.profile?.full_name || (user?.user_metadata as any)?.full_name || user?.email || "Пользователь";
  const workspaceName = workspace?.workspace?.name || data?.profile?.company_name || (user?.user_metadata as any)?.company_name || "Рабочее пространство";
  const defaultSceneWidgets = useMemo(
    () => buildDefaultSceneWidgets({
      displayName,
      workspaceName,
      email: data?.profile?.email || user?.email || "email не указан",
      balanceText,
      investedText,
      greeneryLabel,
    }),
    [balanceText, data?.profile?.email, displayName, greeneryLabel, investedText, user?.email, workspaceName]
  );

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id) return;
    const key = getSceneWidgetsStorageKey(workspace.workspace.workspace_id);
    let saved: SceneWidget[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) saved = JSON.parse(raw) as SceneWidget[];
      } catch {
        saved = [];
      }
    }
    setSceneWidgets(saved.length ? saved : defaultSceneWidgets);
  }, [defaultSceneWidgets, workspace?.workspace?.workspace_id]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined" || !sceneWidgets.length) return;
    window.localStorage.setItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id), JSON.stringify(sceneWidgets));
  }, [sceneWidgets, workspace?.workspace?.workspace_id]);

  const selectedWidget = useMemo(() => sceneWidgets.find((item) => item.id === selectedWidgetId) || null, [sceneWidgets, selectedWidgetId]);

  const updateSceneWidget = useCallback((id: string, patch: Partial<SceneWidget>) => {
    setSceneWidgets((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleSceneWidgetAction = useCallback(
    (action: SceneWidgetAction | undefined) => {
      if (action === "createProject") {
        router.push('/projects/new');
        return;
      }
      if (action === "openCatalog") {
        router.push('/assessments');
        return;
      }
      if (action === "createFolder") {
        const name = window.prompt('Название новой папки', 'Новая папка');
        if (name && name.trim()) void createFolderNamed(name.trim(), 'folder');
      }
    },
    [router]
  );

  const startWidgetInteraction = useCallback(
    (e: any, widget: SceneWidget, mode: WidgetInteractionMode) => {
      if (!sceneEditMode || !canEditScene) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedWidgetId(widget.id);
      widgetInteractionRef.current = { id: widget.id, mode, startX: e.clientX, startY: e.clientY, widget: { ...widget } };
    },
    [canEditScene, sceneEditMode]
  );

  useEffect(() => {
    if (!sceneEditMode) return;
    const handleMove = (e: MouseEvent) => {
      const current = widgetInteractionRef.current;
      if (!current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (current.mode === "drag") {
        updateSceneWidget(current.id, {
          x: clampDesk(current.widget.x + dx, 40, DESK_WIDTH - current.widget.width - 40),
          y: clampDesk(current.widget.y + dy, 40, DESK_HEIGHT - current.widget.height - 40),
        });
        return;
      }
      if (current.mode === "resize") {
        updateSceneWidget(current.id, {
          width: clampDesk(current.widget.width + dx, 110, 520),
          height: clampDesk(current.widget.height + dy, 30, 180),
        });
        return;
      }
      updateSceneWidget(current.id, { rotation: current.widget.rotation + dx * 0.18 });
    };
    const handleUp = () => {
      widgetInteractionRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [sceneEditMode, updateSceneWidget]);

  const resetSceneWidgets = useCallback(() => {
    setSceneWidgets(defaultSceneWidgets);
    setSelectedWidgetId(null);
  }, [defaultSceneWidgets]);

  const projects = useMemo(() => workspace?.projects || [], [workspace?.projects]);
  const folders = useMemo(() => workspace?.folders || [], [workspace?.folders]);
  const folderBuckets = useMemo(() => {
    const buckets = new Map<string, ProjectRow[]>();
    for (const folder of folders) buckets.set(folder.id, []);
    const uncategorized: ProjectRow[] = [];
    for (const project of projects) {
      if (project.folder_id && buckets.has(project.folder_id)) {
        buckets.get(project.folder_id)!.push(project);
      } else {
        uncategorized.push(project);
      }
    }
    return {
      uncategorized: sortProjects(uncategorized),
      byFolder: folders.map((folder) => ({ folder, projects: sortProjects(buckets.get(folder.id) || []) })),
    };
  }, [folders, projects]);

  const activeFolder = useMemo(
    () => folderBuckets.byFolder.find((item) => item.folder.id === activeFolderId) || null,
    [activeFolderId, folderBuckets.byFolder]
  );
  const totalAttempts = useMemo(
    () => projects.reduce((sum, item) => sum + (item.attempts_count || 0), 0),
    [projects]
  );

  useEffect(() => {
    if (!activeFolderId) return;
    const stillExists = folderBuckets.byFolder.some((item) => item.folder.id === activeFolderId);
    if (!stillExists) setActiveFolderId(null);
  }, [activeFolderId, folderBuckets.byFolder]);

  useEffect(() => {
    if (!previewProject) return;
    const stillExists = projects.some((item) => item.id === previewProject.id);
    if (!stillExists) setPreviewProject(null);
  }, [previewProject, projects]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id) return;
    const saved = typeof window !== "undefined"
      ? (() => {
          try {
            const raw = window.localStorage.getItem(getDeskStorageKey(workspace.workspace.workspace_id));
            return raw ? (JSON.parse(raw) as DeskPositions) : {};
          } catch {
            return {} as DeskPositions;
          }
        })()
      : ({} as DeskPositions);

    setDeskPositions((current) => {
      const merged = mergeDeskPositions(folders, folderBuckets.uncategorized, { ...saved, ...current });
      setDeskLayer(Object.values(merged).reduce((max, item) => Math.max(max, item.z || 0), 300));
      return merged;
    });
  }, [workspace?.workspace?.workspace_id, folders, folderBuckets.uncategorized]);

  useEffect(() => {
    if (!workspace?.workspace?.workspace_id || typeof window === "undefined") return;
    window.localStorage.setItem(getDeskStorageKey(workspace.workspace.workspace_id), JSON.stringify(deskPositions));
  }, [deskPositions, workspace?.workspace?.workspace_id]);

  const bringDeskItemToFront = useCallback((itemId: string) => {
    setDeskLayer((current) => {
      const next = current + 1;
      setDeskPositions((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { x: 48, y: 48, z: next }),
          z: next,
        },
      }));
      return next;
    });
  }, []);

  const placeDeskItem = useCallback((itemId: string, kind: "folder" | "project", x: number, y: number) => {
    const maxX = kind === "folder" ? DESK_WIDTH - DESK_FOLDER_WIDTH - 24 : DESK_WIDTH - DESK_SHEET_WIDTH - 24;
    const maxY = kind === "folder" ? DESK_HEIGHT - DESK_FOLDER_HEIGHT - 24 : DESK_HEIGHT - DESK_SHEET_HEIGHT - 24;
    const nextX = clampDesk(x, 24, maxX);
    const nextY = clampDesk(y, 24, maxY);

    if (kind === "folder") {
      const folderId = itemId.replace("folder:", "");
      const folderIndex = Math.max(0, folders.findIndex((item) => item.id === folderId));
      const snapped = isInsideTrayZone(nextX, nextY) ? getDefaultFolderPosition(folderIndex) : { x: nextX, y: nextY, z: 20 + folderIndex };
      setDeskPositions((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { z: deskLayer + 1 }),
          x: snapped.x,
          y: snapped.y,
          z: prev[itemId]?.z || deskLayer + 1,
        },
      }));
      return;
    }

    setDeskPositions((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { z: deskLayer + 1 }),
        x: nextX,
        y: nextY,
        z: prev[itemId]?.z || deskLayer + 1,
      },
    }));
  }, [deskLayer, folders]);

  const handleDeskDrop = useCallback((e: any) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
    const draggedFolderId = e.dataTransfer.getData("text/folder-id") || "";

    if (draggedProjectId) {
      const wasInFolder = !folderBuckets.uncategorized.some((project) => project.id === draggedProjectId);
      const itemId = `project:${draggedProjectId}`;
      bringDeskItemToFront(itemId);
      placeDeskItem(itemId, "project", e.clientX - rect.left - DESK_SHEET_WIDTH / 2, e.clientY - rect.top - DESK_SHEET_HEIGHT / 2);
      if (wasInFolder) {
        moveProject(draggedProjectId, null);
      }
      setDraggingProjectId(null);
      clearTrashHover();
      return;
    }

    if (draggedFolderId) {
      const itemId = `folder:${draggedFolderId}`;
      bringDeskItemToFront(itemId);
      placeDeskItem(itemId, "folder", e.clientX - rect.left - DESK_FOLDER_WIDTH / 2, e.clientY - rect.top - DESK_FOLDER_HEIGHT / 2);
      setDraggingFolderId(null);
      clearTrashHover();
    }
  }, [bringDeskItemToFront, clearTrashHover, draggingProjectId, folderBuckets.uncategorized, moveProject, placeDeskItem]);

  async function createFolderNamed(nameValue: string, iconKey: FolderIconKey = newFolderIcon) {
    const name = nameValue.trim();
    if (!name || !session) return;
    setBusyFolderId("new");
    try {
      const resp = await fetch("/api/commercial/folders/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, icon_key: iconKey }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось создать папку");
      setNewFolderName("");
      setNewFolderIcon("folder");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function createFolder() {
    return createFolderNamed(newFolderName, newFolderIcon);
  }

  function openRenameFolder(folder: FolderRow) {
    setFolderActionTarget(null);
    setFolderRenameTarget(folder);
    setFolderRenameValue(folder.name);
  }

  async function saveRenameFolder() {
    if (!session || !folderRenameTarget) return;
    const name = folderRenameValue.trim();
    if (!name || name === folderRenameTarget.name) {
      setFolderRenameTarget(null);
      return;
    }
    setBusyFolderId(folderRenameTarget.id);
    try {
      const resp = await fetch("/api/commercial/folders/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folderRenameTarget.id, name }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось переименовать папку");
      setFolderRenameTarget(null);
      setFolderRenameValue("");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function updateFolderIcon(folder: FolderRow, iconKey: FolderIconKey) {
    if (!session) return;
    setBusyFolderId(folder.id);
    try {
      const resp = await fetch("/api/commercial/folders/update", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folder.id, icon_key: iconKey }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось обновить иконку");
      setIconPickerFolder(null);
      setFolderActionTarget(null);
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  function openDeleteFolder(folder: FolderRow) {
    setFolderActionTarget(null);
    setFolderDeleteTarget(folder);
  }

  async function confirmDeleteFolder() {
    if (!session || !folderDeleteTarget) return;
    const folder = folderDeleteTarget;
    setBusyFolderId(folder.id);
    try {
      const resp = await fetch("/api/commercial/folders/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folder.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить папку");
      setFolderDeleteTarget(null);
      setActiveFolderId((current) => (current === folder.id ? null : current));
      setIconPickerFolder((current) => (current?.id === folder.id ? null : current));
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function deleteFolderDirect(folderId: string) {
    if (!session) return;
    setBusyFolderId(folderId);
    try {
      const resp = await fetch("/api/commercial/folders/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: folderId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить папку");
      setFolderDeleteTarget(null);
      setActiveFolderId((current) => (current === folderId ? null : current));
      setIconPickerFolder((current) => (current?.id === folderId ? null : current));
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  async function moveProject(projectId: string, folderId: string | null) {
    if (!session) return;
    setBusyFolderId(folderId || "desktop");
    try {
      const resp = await fetch("/api/commercial/folders/move-project", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId, folder_id: folderId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось переместить проект");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setDraggingProjectId(null);
      setBusyFolderId(null);
    }
  }

  async function deleteProject(projectId: string, skipConfirm = false) {
    if (!session) return;
    if (!skipConfirm && !window.confirm("Удалить проект? Это действие уберёт проект, приглашение и результаты по нему.")) return;
    setBusyFolderId(`delete:${projectId}`);
    try {
      const resp = await fetch("/api/commercial/projects/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить проект");
      await loadDashboard();
    } catch (e: any) {
      setError(e?.message || "Ошибка");
    } finally {
      setBusyFolderId(null);
    }
  }

  function clearTrashHover() {
    if (trashHoverTimer.current) {
      window.clearTimeout(trashHoverTimer.current);
      trashHoverTimer.current = null;
    }
    setTrashHover(null);
  }

  const beginTrashHover = useCallback((kind: "project" | "folder", id: string) => {
    setTrashHover((current) => {
      if (current?.kind === kind && current?.id === id) return current;
      return { kind, id };
    });
    if (trashHoverTimer.current) window.clearTimeout(trashHoverTimer.current);
    trashHoverTimer.current = window.setTimeout(() => {
      if (kind === "project") {
        void deleteProject(id, true);
      } else {
        void deleteFolderDirect(id);
      }
      setDraggingProjectId(null);
      setDraggingFolderId(null);
      setTrashHover(null);
      trashHoverTimer.current = null;
    }, 650);
  }, [deleteFolderDirect, deleteProject]);

  useEffect(() => () => {
    if (trashHoverTimer.current) window.clearTimeout(trashHoverTimer.current);
  }, []);


  if (!session || !user) {
    return (
      <Layout title="Кабинет">
        <div className="card text-sm text-slate-700">Переадресация на вход…</div>
      </Layout>
    );
  }

  const trayFolders = folderBuckets.byFolder.filter(({ folder }, index) => {
    const pos = deskPositions[`folder:${folder.id}`] || getDefaultFolderPosition(index);
    return isInsideTrayZone(pos.x, pos.y);
  });
  const looseFolders = folderBuckets.byFolder.filter(({ folder }, index) => {
    const pos = deskPositions[`folder:${folder.id}`] || getDefaultFolderPosition(index);
    return !isInsideTrayZone(pos.x, pos.y);
  });

  return (
    <Layout title="Кабинет специалиста">
      <div className="dashboard-experience relative isolate -mx-3 overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4">
        {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7a5b37]">Кабинет специалиста</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xl font-semibold text-[#2c1b10]">{displayName}</span>
              <span className="text-sm text-[#6a4b31]">{workspaceName}</span>
              <span className="text-sm text-[#8b6a48]">{data?.profile?.email || user.email || "email не указан"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dashboard-desk-meta-pill">Баланс: {balanceText}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => router.push('/assessments')}>Каталог тестов</button>
            {canEditScene ? (
              <>
                <button type="button" className={`btn btn-sm ${sceneEditMode ? "btn-primary" : "btn-secondary"}`} onClick={() => setSceneEditMode((prev) => !prev)}>
                  {sceneEditMode ? "Выйти из конструктора" : "Режим конструктора"}
                </button>
                {sceneEditMode ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={resetSceneWidgets}>Сбросить сцену</button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {canEditScene && sceneEditMode && selectedWidget ? (
          <div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
            <div className="mb-3 text-sm font-semibold text-[#55361f]">Конструктор сцены · {selectedWidget.id}</div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs text-[#7b5b3b]">X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.x)} onChange={(e) => updateSceneWidget(selectedWidget.id, { x: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.y)} onChange={(e) => updateSceneWidget(selectedWidget.id, { y: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Ширина
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.width)} onChange={(e) => updateSceneWidget(selectedWidget.id, { width: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b]">Высота
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.height)} onChange={(e) => updateSceneWidget(selectedWidget.id, { height: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b] md:col-span-1">Поворот
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={selectedWidget.rotation} onChange={(e) => updateSceneWidget(selectedWidget.id, { rotation: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b] md:col-span-1">Шрифт
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={selectedWidget.fontSize} onChange={(e) => updateSceneWidget(selectedWidget.id, { fontSize: Number(e.target.value || 0) })} />
              </label>
              <label className="text-xs text-[#7b5b3b] md:col-span-2">Текст
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="text" value={selectedWidget.text} onChange={(e) => updateSceneWidget(selectedWidget.id, { text: e.target.value })} />
              </label>
            </div>
          </div>
        ) : null}

        <div className="dashboard-office-scene relative min-h-[920px] overflow-hidden rounded-[34px] border border-[#4f3420]/10 bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.28)]">
          <div className="dashboard-office-scene-backdrop absolute inset-0" />
          <div className="dashboard-office-scene-vignette absolute inset-0" />

          <div className="dashboard-office-workzone absolute inset-0 overflow-hidden" onClick={() => setSelectedWidgetId(null)} onDragOver={(e) => e.preventDefault()} onDrop={handleDeskDrop}>
            <div className="absolute inset-0 z-[8]">
              {sceneWidgets.map((widget) => {
                const isSelected = widget.id === selectedWidgetId;
                return (
                  <div
                    key={widget.id}
                    className={`dashboard-scene-widget dashboard-scene-widget-${widget.kind} dashboard-scene-widget-${widget.tone || "note"} ${sceneEditMode ? "dashboard-scene-widget-editing" : ""} ${isSelected ? "dashboard-scene-widget-selected" : ""}`}
                    style={{
                      left: `${widget.x}px`,
                      top: `${widget.y}px`,
                      width: `${widget.width}px`,
                      height: `${widget.height}px`,
                      transform: `rotate(${widget.rotation}deg)`,
                      zIndex: widget.z,
                      fontSize: `${widget.fontSize}px`,
                    }}
                    onMouseDown={(e) => startWidgetInteraction(e, widget, "drag")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWidgetId(widget.id);
                      if (!sceneEditMode && widget.kind === "button") handleSceneWidgetAction(widget.action);
                    }}
                  >
                    <span className="dashboard-scene-widget-label">{widget.text}</span>
                    {sceneEditMode && isSelected ? (
                      <>
                        <button type="button" className="dashboard-scene-widget-rotate" onMouseDown={(e) => startWidgetInteraction(e, widget, "rotate")} aria-label="Повернуть элемент">↻</button>
                        <button type="button" className="dashboard-scene-widget-resize" onMouseDown={(e) => startWidgetInteraction(e, widget, "resize")} aria-label="Изменить размер элемента">↘</button>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div
              className={`dashboard-trash-zone absolute z-[6] ${trashHover ? 'dashboard-trash-zone-active' : ''}`}
              style={{ left: `${TRASH_ZONE.x}px`, top: `${TRASH_ZONE.y}px`, width: `${TRASH_ZONE.width}px`, height: `${TRASH_ZONE.height}px` }}
              onDragOver={(e) => {
                e.preventDefault();
                const draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                const draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                if (draggedProjectId) beginTrashHover('project', draggedProjectId);
                else if (draggedFolderId) beginTrashHover('folder', draggedFolderId);
              }}
              onDragLeave={() => clearTrashHover()}
              onDrop={(e) => {
                e.preventDefault();
                clearTrashHover();
              }}
            />

            <div className="absolute z-[12] overflow-hidden" style={{ left: `${TRAY_CLIP.x}px`, top: `${TRAY_CLIP.y}px`, width: `${TRAY_CLIP.width}px`, height: `${TRAY_CLIP.height}px` }}>
              {trayFolders.map(({ folder, projects: folderProjects }, folderIndex) => {
                const itemId = `folder:${folder.id}`;
                const position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
                return (
                  <div key={folder.id} className="absolute" style={{ left: position.x - TRAY_CLIP.x, top: position.y - TRAY_CLIP.y, zIndex: position.z }}>
                    <FolderDesktopIcon
                      folder={folder}
                      projects={folderProjects}
                      busy={busyFolderId === folder.id}
                      onOpen={() => setActiveFolderId(folder.id)}
                      onManage={() => setFolderActionTarget(folder)}
                      onDropProject={(projectId) => moveProject(projectId, folder.id)}
                      draggingProjectId={draggingProjectId}
                      onDragStart={() => {
                        setDraggingFolderId(folder.id);
                        bringDeskItemToFront(itemId);
                      }}
                      onDragEnd={() => setDraggingFolderId(null)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="dashboard-tray-divider-cover absolute z-[14]" style={{ left: `${TRAY_ZONE.x + 6}px`, top: `${TRAY_ZONE.y + 76}px`, width: `${TRAY_ZONE.width - 14}px`, height: `102px` }} />

            {looseFolders.map(({ folder, projects: folderProjects }, folderIndex) => {
              const itemId = `folder:${folder.id}`;
              const position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
              return (
                <div key={folder.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z }}>
                  <FolderDesktopIcon
                    folder={folder}
                    projects={folderProjects}
                    busy={busyFolderId === folder.id}
                    onOpen={() => setActiveFolderId(folder.id)}
                    onManage={() => setFolderActionTarget(folder)}
                    onDropProject={(projectId) => moveProject(projectId, folder.id)}
                    draggingProjectId={draggingProjectId}
                    onDragStart={() => {
                      setDraggingFolderId(folder.id);
                      bringDeskItemToFront(itemId);
                    }}
                    onDragEnd={() => setDraggingFolderId(null)}
                  />
                </div>
              );
            })}

            {folderBuckets.uncategorized.map((project, projectIndex) => {
              const itemId = `project:${project.id}`;
              const position = deskPositions[itemId] || getDefaultProjectPosition(projectIndex);
              return (
                <div key={project.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z }}>
                  <ProjectDesktopIcon
                    project={project}
                    busy={busyFolderId === `delete:${project.id}`}
                    onOpen={() => setPreviewProject(project)}
                    onDragStart={() => {
                      setDraggingProjectId(project.id);
                      bringDeskItemToFront(itemId);
                    }}
                    onDragEnd={() => {
                      setDraggingProjectId(null);
                      clearTrashHover();
                    }}
                    onDelete={() => deleteProject(project.id)}
                  />
                </div>
              );
            })}

            <button
              type="button"
              className="dashboard-pen-trigger absolute bottom-12 right-10 z-[220]"
              onClick={() => router.push('/projects/new')}
              aria-label="Создать проект оценки"
              title="Создать проект оценки"
            >
              <span className="dashboard-pen-body" />
              <span className="dashboard-pen-cap" />
              <span className="dashboard-pen-tip" />
            </button>

            {!folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? (
              <div className="absolute inset-x-8 bottom-12 rounded-2xl border border-dashed border-black/10 bg-white/88 p-8 text-center text-sm text-[#4b3727] shadow-[0_14px_30px_-24px_rgba(31,18,10,0.22)]">
                Здесь пока пусто. Создай первый проект или добавь папку в стойку справа.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {activeFolder ? (
        <FolderModal
          folder={activeFolder.folder}
          projects={activeFolder.projects}
          busy={busyFolderId === activeFolder.folder.id}
          onClose={() => setActiveFolderId(null)}
          onManage={() => setFolderActionTarget(activeFolder.folder)}
          onOpenProject={(id) => router.push(`/projects/${id}`)}
          onMoveToDesktop={(projectId) => moveProject(projectId, null)}
          onDeleteProject={(projectId) => deleteProject(projectId)}
        />
      ) : null}

      {previewProject ? (
        <ProjectSheetPreviewModal
          project={previewProject}
          onClose={() => setPreviewProject(null)}
          onOpenFull={() => router.push(`/projects/${previewProject.id}`)}
        />
      ) : null}


      {folderActionTarget ? (
        <FolderActionDialog
          folder={folderActionTarget}
          onClose={() => setFolderActionTarget(null)}
          onRename={() => openRenameFolder(folderActionTarget)}
          onDelete={() => openDeleteFolder(folderActionTarget)}
          onChooseIcon={() => {
            setIconPickerFolder(folderActionTarget);
            setFolderActionTarget(null);
          }}
        />
      ) : null}

      {folderRenameTarget ? (
        <FolderRenameDialog
          folder={folderRenameTarget}
          value={folderRenameValue}
          busy={busyFolderId === folderRenameTarget.id}
          onChange={setFolderRenameValue}
          onClose={() => {
            setFolderRenameTarget(null);
            setFolderRenameValue("");
          }}
          onSave={saveRenameFolder}
        />
      ) : null}

      {folderDeleteTarget ? (
        <FolderDeleteDialog
          folder={folderDeleteTarget}
          busy={busyFolderId === folderDeleteTarget.id}
          onClose={() => setFolderDeleteTarget(null)}
          onDelete={confirmDeleteFolder}
        />
      ) : null}

      {iconPickerFolder ? (
        <FolderIconPicker
          folder={iconPickerFolder}
          busy={busyFolderId === iconPickerFolder.id}
          onClose={() => setIconPickerFolder(null)}
          onSelect={(iconKey) => updateFolderIcon(iconPickerFolder, iconKey)}
        />
      ) : null}
    </Layout>
  );
}

type DashboardBackdropProps = {
  pulseToken: number;
  greeneryLevel: GreeneryLevel;
};

type PremiumActionButtonProps = {
  label: string;
  onClick: () => void;
  pulseToken: number;
  variant?: "primary" | "secondary";
  compact?: boolean;
};

type VineFrameProps = {
  growthLevel: GreeneryLevel;
  density?: "rich" | "light";
  pulseToken?: number;
};

function DashboardBackdrop({ pulseToken, greeneryLevel }: DashboardBackdropProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 dashboard-surface-gradient" />
        <div className="absolute left-[6%] top-[3%] h-56 w-[42%] rounded-[40px] bg-white/20 blur-3xl" />
        <div className="absolute right-[4%] top-[6%] h-48 w-[30%] rounded-[40px] bg-white/22 blur-3xl" />
        <div className="absolute inset-y-0 left-[11%] w-px bg-white/8" />
        <div className="absolute inset-y-0 left-[42%] w-px bg-black/5" />
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/7" />
        <div className="absolute inset-x-0 top-[18%] h-px bg-white/7" />
        <div className="absolute inset-x-0 top-[53%] h-px bg-black/5" />
      </div>

      {greeneryLevel >= 1 ? (
        <div key={`desk-breath-${pulseToken}-${greeneryLevel}`} className="pointer-events-none absolute right-[4%] top-[6%] z-[1] h-40 w-40 rounded-full bg-emerald-200/10 blur-3xl" />
      ) : null}
    </>
  );
}

function PremiumActionButton({ label, onClick, pulseToken, variant = "primary", compact = false }: PremiumActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dashboard-action-btn ${variant === "primary" ? "dashboard-action-btn-primary" : "dashboard-action-btn-secondary"} ${compact ? "dashboard-action-btn-compact" : ""}`}
    >
      <span className="relative z-10">{label}</span>
      <span className="dashboard-action-badge-shell" aria-hidden="true">
        <SproutBadge key={`${label}-${pulseToken}`} compact={compact} />
      </span>
    </button>
  );
}

function SproutBadge({ compact = false }: { compact?: boolean }) {
  const size = compact ? 28 : 32;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true" className="dashboard-button-sprout">
      <circle cx="24" cy="24" r="20" className="dashboard-button-sprout-orb" />
      <path d="M24 31V18" className="dashboard-button-sprout-stem" />
      <path d="M24 20C17 15 11 15 7 20C13 23 18 23 24 20Z" className="dashboard-button-sprout-leaf" />
      <path d="M24 20C30 12 36 10 42 14C37 22 31 24 24 20Z" className="dashboard-button-sprout-leaf dashboard-button-sprout-leaf-alt" />
    </svg>
  );
}

function VineLeaf({ x, y, rotate = 0, scale = 1, className = "" }: { x: number; y: number; rotate?: number; scale?: number; className?: string }) {
  return (
    <path
      d="M0 0C7 -8 15 -10 24 -2C18 10 8 12 0 0Z"
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}
      className={`dashboard-vine-leaf ${className}`.trim()}
    />
  );
}

function VineFrame({ growthLevel, density = "rich", pulseToken = 0 }: VineFrameProps) {
  if (growthLevel === 0) return null;

  return (
    <div key={`vines-${density}-${growthLevel}-${pulseToken}`} className={`dashboard-vine-shell pointer-events-none absolute inset-[10px] z-0 ${density === "rich" ? "opacity-100" : "opacity-90"}`}>
      <CornerVine className="-left-5 -top-5" growthLevel={growthLevel} />
      <CornerVine className="-right-5 -top-5 -scale-x-100" growthLevel={growthLevel} />
      <CornerVine className="-bottom-5 -left-5 -scale-y-100" growthLevel={growthLevel} />
      <CornerVine className="-bottom-5 -right-5 scale-y-[-1] scale-x-[-1]" growthLevel={growthLevel} />
      {growthLevel >= 1 ? <EdgeVine side="top" growthLevel={growthLevel} /> : null}
      {growthLevel >= 2 ? <EdgeVine side="right" growthLevel={growthLevel} /> : null}
      {growthLevel >= 3 && density === "rich" ? <EdgeVine side="bottom" growthLevel={growthLevel} /> : null}
    </div>
  );
}

function CornerVine({ className = "", growthLevel }: { className?: string; growthLevel: GreeneryLevel }) {
  return (
    <div className={`absolute h-24 w-32 sm:h-28 sm:w-36 ${className}`}>
      <svg viewBox="0 0 180 160" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M14 150C28 124 40 104 58 86C78 67 96 54 120 45C136 39 150 26 166 10" className="dashboard-vine-stroke dashboard-vine-stroke-main" />
        {growthLevel >= 2 ? <path d="M34 148C48 122 58 104 74 89" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        {growthLevel >= 2 ? <path d="M76 86C70 72 60 63 46 59" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        {growthLevel >= 3 ? <path d="M116 45C112 31 102 19 87 12" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        <VineLeaf x={54} y={98} rotate={-34} scale={0.9} />
        <VineLeaf x={76} y={74} rotate={14} scale={0.95} className="dashboard-vine-leaf-delay" />
        {growthLevel >= 2 ? <VineLeaf x={98} y={57} rotate={-22} scale={0.82} className="dashboard-vine-leaf-delay" /> : null}
        {growthLevel >= 3 ? <VineLeaf x={126} y={36} rotate={18} scale={0.88} className="dashboard-vine-leaf-delay-2" /> : null}
        {growthLevel >= 4 ? <VineLeaf x={30} y={122} rotate={42} scale={0.76} className="dashboard-vine-leaf-delay-2" /> : null}
      </svg>
    </div>
  );
}

function EdgeVine({ side, growthLevel }: { side: "top" | "right" | "bottom"; growthLevel: GreeneryLevel }) {
  if (side === "top") {
    return (
      <div className="absolute left-16 right-16 top-0 h-9 opacity-90">
        <svg viewBox="0 0 360 58" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M8 40C56 18 102 15 154 30C208 45 264 44 352 18" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
          <VineLeaf x={72} y={23} rotate={-18} scale={0.84} />
          <VineLeaf x={122} y={31} rotate={14} scale={0.8} className="dashboard-vine-leaf-delay" />
          <VineLeaf x={192} y={35} rotate={-10} scale={0.82} className="dashboard-vine-leaf-delay" />
          {growthLevel >= 2 ? <VineLeaf x={260} y={28} rotate={22} scale={0.86} className="dashboard-vine-leaf-delay-2" /> : null}
          {growthLevel >= 3 ? <VineLeaf x={310} y={20} rotate={-16} scale={0.78} className="dashboard-vine-leaf-delay-2" /> : null}
        </svg>
      </div>
    );
  }

  if (side === "right") {
    return (
      <div className="absolute right-0 top-14 bottom-14 w-8 opacity-85">
        <svg viewBox="0 0 48 240" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M18 10C34 44 34 80 22 116C12 152 13 188 32 230" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
          <VineLeaf x={26} y={58} rotate={72} scale={0.88} />
          <VineLeaf x={12} y={108} rotate={-60} scale={0.86} className="dashboard-vine-leaf-delay" />
          <VineLeaf x={28} y={162} rotate={64} scale={0.84} className="dashboard-vine-leaf-delay-2" />
          {growthLevel >= 4 ? <VineLeaf x={16} y={212} rotate={-52} scale={0.78} className="dashboard-vine-leaf-delay-2" /> : null}
        </svg>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-20 right-20 h-8 opacity-80">
      <svg viewBox="0 0 360 50" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M12 12C68 32 130 36 190 25C246 15 300 15 348 32" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
        <VineLeaf x={92} y={26} rotate={-12} scale={0.84} />
        <VineLeaf x={158} y={30} rotate={18} scale={0.84} className="dashboard-vine-leaf-delay" />
        <VineLeaf x={228} y={22} rotate={-8} scale={0.82} className="dashboard-vine-leaf-delay" />
        <VineLeaf x={286} y={28} rotate={14} scale={0.86} className="dashboard-vine-leaf-delay-2" />
      </svg>
    </div>
  );
}

type FolderDesktopIconProps = {
  folder: FolderRow;
  projects: ProjectRow[];
  busy?: boolean;
  onOpen: () => void;
  onManage: () => void;
  onDropProject: (projectId: string) => void;
  draggingProjectId: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
};

function FolderDesktopIcon({ folder, projects, busy, onOpen, onManage, onDropProject, draggingProjectId, onDragStart, onDragEnd }: FolderDesktopIconProps) {
  const preview = projects.slice(0, 3);
  const tilt = getEntityTilt(folder.id, 2) * 0.42;
  return (
    <div className="group relative flex flex-col items-center gap-2">
      <button
        type="button"
        draggable
        disabled={busy}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/folder-id", folder.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={`dashboard-folder-card dashboard-folder-card-angled relative flex items-end justify-start overflow-visible border transition hover:-translate-y-0.5 ${draggingProjectId ? "border-[#94724a]" : "border-[#b88c5a]"} ${busy ? "opacity-70" : ""}`}
        style={{ transform: `rotate(${tilt}deg)`, ["--folder-rotate" as any]: `${tilt}deg` }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
          if (draggedId) onDropProject(draggedId);
        }}
      >
        <div className="dashboard-folder-shadow-strip" />
        <div className="dashboard-folder-spine" />
        <div className="dashboard-folder-tab" />
        <div className="dashboard-folder-pocket" />
        <div className="dashboard-folder-mouth" />
        <div className="dashboard-folder-inner-shadow" />
        <div className="dashboard-folder-gloss" />

        <div className="pointer-events-none absolute left-4 right-4 top-3 z-20 flex flex-col gap-1.5">
          {preview.length ? preview.map((project, index) => {
            const slipTitle = project.person?.full_name || project.title || "Проект";
            return (
              <div
                key={project.id}
                className="dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm"
                style={{
                  marginLeft: `${index * 10}px`,
                  marginRight: `${Math.max(0, 20 - index * 5)}px`,
                  transform: `translateY(${index * 8}px) rotate(${index % 2 === 0 ? -0.8 : 0.65}deg)`,
                  zIndex: 30 - index,
                }}
              >
                <span className="block truncate">{slipTitle}</span>
              </div>
            );
          }) : (
            <div className="dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm">
              <span className="block truncate">Папка пуста</span>
            </div>
          )}
        </div>

        <div className="relative z-10 flex w-full items-end justify-between px-4 pb-3">
          <div>
            <div className="text-[15px] font-semibold leading-tight text-[#5c3e1f]">{folder.name}</div>
            <div className="mt-1 text-[11px] text-[#7a5830]">Открыть папку</div>
          </div>
          <div className="rounded-full border border-[#d5be99] bg-[#fff9f0]/92 px-2 py-1 text-[11px] font-medium text-[#5b4024] shadow-sm">{projects.length}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={onManage}
        className="absolute right-0 top-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#f2e7d3] bg-[#fffaf2]/96 text-sm text-[#6e4d2f] shadow-sm opacity-0 transition hover:text-slate-900 group-hover:opacity-100"
        title="Управление папкой"
        aria-label="Управление папкой"
      >
        ⋯
      </button>
    </div>
  );
}

type ProjectDesktopIconProps = {
  project: ProjectRow;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete?: () => void;
  busy?: boolean;
  compact?: boolean;
};

function ProjectDesktopIcon({ project, onOpen, onDragStart, onDragEnd, onDelete, busy = false, compact = false }: ProjectDesktopIconProps) {
  const displayName = project.person?.full_name || project.title || "Проект";
  const titleLine = project.title || displayName;
  const roleLine = project.target_role || project.person?.current_position || "Роль не указана";
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;
  const assessmentLine = isDone ? "сформирована" : completed > 0 ? "в процессе" : "ещё не собрана";
  const tilt = getEntityTilt(project.id, 1) * 0.18;

  return (
    <div className="group relative dashboard-desk-sheet-wrap" style={{ transform: `rotate(${tilt}deg)` }}>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="dashboard-desk-sheet-delete"
          title="Удалить проект"
          aria-label="Удалить проект"
        >
          ✕
        </button>
      ) : null}
      <button
        type="button"
        draggable
        disabled={busy}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/project-id", project.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={`dashboard-desk-sheet ${isDone ? "dashboard-desk-sheet-ready" : "dashboard-desk-sheet-pending"} ${compact ? "dashboard-desk-sheet-compact" : ""} ${busy ? "opacity-60" : ""}`}
      >
        <span className="dashboard-desk-sheet-clip" aria-hidden="true" />
        <span className="dashboard-desk-sheet-kicker">Лист проекта</span>
        <span className="dashboard-desk-sheet-title">{titleLine}</span>
        <span className="dashboard-desk-sheet-row"><span>Имя</span><strong>{displayName}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Цель</span><strong>{goal?.shortTitle || project.goal}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Роль</span><strong>{roleLine}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Оценка</span><strong>{assessmentLine}</strong></span>
        <span className="dashboard-desk-sheet-footer">
          <span>{completed}/{total || 0} тестов</span>
          <span>{new Date(project.created_at).toLocaleDateString("ru-RU")}</span>
        </span>
      </button>
    </div>
  );
}

type ProjectSheetPreviewModalProps = {
  project: ProjectRow;
  onClose: () => void;
  onOpenFull: () => void;
};

function ProjectSheetPreviewModal({ project, onClose, onOpenFull }: ProjectSheetPreviewModalProps) {
  const displayName = project.person?.full_name || project.title || "Проект";
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;
  const assessmentLine = isDone ? "Общая оценка сформирована" : completed > 0 ? "Общая оценка в процессе" : "Общая оценка ещё не собрана";
  const roleLine = project.target_role || project.person?.current_position || "Не указана";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="dashboard-project-preview-wrap relative w-full max-w-[920px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/92 text-lg text-slate-700 shadow-lg hover:text-slate-950"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ✕
        </button>

        <div className="dashboard-project-preview-board">
          <div className="dashboard-project-preview-clip" aria-hidden="true" />
          <div className="dashboard-project-preview-clip-inner" aria-hidden="true" />

          <div className="dashboard-project-preview-sheet">
            <div className="dashboard-project-preview-topline">
              <div>
                <div className="dashboard-project-preview-kicker">Лист проекта оценки</div>
                <div className="dashboard-project-preview-title">{project.title || displayName}</div>
              </div>
              <div className={`dashboard-project-preview-stamp ${isDone ? "dashboard-project-preview-stamp-ready" : "dashboard-project-preview-stamp-progress"}`}>
                {assessmentLine}
              </div>
            </div>

            <div className="dashboard-project-preview-columns">
              <div className="dashboard-project-preview-section">
                <div className="dashboard-project-preview-section-title">Карточка участника</div>
                <div className="dashboard-project-preview-table">
                  <div><span>Имя и фамилия</span><strong>{displayName}</strong></div>
                  <div><span>Email</span><strong>{project.person?.email || "Не указан"}</strong></div>
                  <div><span>Текущая должность</span><strong>{project.person?.current_position || "Не указана"}</strong></div>
                  <div><span>Целевая роль</span><strong>{roleLine}</strong></div>
                  <div><span>Цель оценки</span><strong>{goal?.title || goal?.shortTitle || project.goal}</strong></div>
                  <div><span>Создан</span><strong>{new Date(project.created_at).toLocaleString("ru-RU")}</strong></div>
                </div>
              </div>

              <div className="dashboard-project-preview-section">
                <div className="dashboard-project-preview-section-title">Сводка по проекту</div>
                <div className="dashboard-project-preview-table">
                  <div><span>Статус</span><strong>{assessmentLine}</strong></div>
                  <div><span>Тестов в наборе</span><strong>{total}</strong></div>
                  <div><span>Завершено попыток</span><strong>{completed}</strong></div>
                  <div><span>Пакет</span><strong>{project.package_mode || "standard"}</strong></div>
                </div>

                <div className="dashboard-project-preview-tests">
                  <div className="dashboard-project-preview-section-title">Инструменты в проекте</div>
                  {project.tests?.length ? (
                    <ul>
                      {project.tests
                        .slice()
                        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                        .map((test) => (
                          <li key={`${project.id}-${test.test_slug}`}>{test.test_title || test.test_slug}</li>
                        ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-500">Тесты пока не добавлены.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="dashboard-project-preview-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть лист</button>
              <button type="button" className="btn btn-primary" onClick={onOpenFull}>Открыть проект полностью</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type FolderModalProps = {
  folder: FolderRow;
  projects: ProjectRow[];
  busy?: boolean;
  onClose: () => void;
  onManage: () => void;
  onOpenProject: (id: string) => void;
  onMoveToDesktop: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
};

function FolderModal({ folder, projects, busy, onClose, onManage, onOpenProject, onMoveToDesktop, onDeleteProject }: FolderModalProps) {
  const [draggingInnerProjectId, setDraggingInnerProjectId] = useState<string | null>(null);
  const icon = getFolderIcon(folder.icon_key);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm ${draggingInnerProjectId ? "ring-4 ring-emerald-300/50" : ""}`}
      onClick={onClose}
      onDragOver={(e) => {
        if (draggingInnerProjectId) e.preventDefault();
      }}
      onDrop={(e) => {
        const draggedId = e.dataTransfer.getData("text/project-id") || draggingInnerProjectId;
        if (!draggedId) return;
        e.preventDefault();
        e.stopPropagation();
        setDraggingInnerProjectId(null);
        onMoveToDesktop(draggedId);
      }}
    >
      <div className="w-full max-w-5xl rounded-[32px] border border-[#b68b58] bg-[#f8f0e3]/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br text-3xl shadow-sm ${icon.tileClass}`}>{icon.symbol}</div>
            <div>
              <div className="text-sm text-slate-500">Папка</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
              <div className="mt-1 text-sm text-slate-500">Открой проект как иконку или просто перетащи её за пределы окна папки, чтобы вернуть на рабочий стол.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onManage} className="btn btn-secondary btn-sm">Управление</button>
            <button type="button" onClick={onClose} className="btn btn-primary btn-sm">Закрыть</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
          Рабочий стол снаружи этого окна. Потяни иконку проекта на затемнённый фон, и она вернётся из папки обратно на стол.
        </div>

        <div className={`mt-6 rounded-[28px] border border-emerald-100 bg-white p-4 ${busy ? "opacity-70" : ""}`}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {projects.length ? (
              projects.map((project) => (
                <ProjectDesktopIcon
                  key={project.id}
                  project={project}
                  compact
                  busy={busy}
                  onOpen={() => onOpenProject(project.id)}
                  onDragStart={() => setDraggingInnerProjectId(project.id)}
                  onDragEnd={() => setDraggingInnerProjectId(null)}
                  onDelete={onDeleteProject ? () => onDeleteProject(project.id) : undefined}
                />
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
                Папка пока пустая. Перетащи на неё проекты с рабочего стола.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type FolderActionDialogProps = {
  folder: FolderRow;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onChooseIcon: () => void;
};

function FolderActionDialog({ folder, onClose, onRename, onDelete, onChooseIcon }: FolderActionDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-500">Управление папкой</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4 grid gap-2">
          <button type="button" className="btn btn-secondary justify-start" onClick={onRename}>Переименовать</button>
          <button type="button" className="btn btn-secondary justify-start" onClick={onChooseIcon}>Сменить иконку</button>
          <button type="button" className="btn btn-secondary justify-start text-red-600 hover:text-red-700" onClick={onDelete}>Удалить папку</button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

type FolderRenameDialogProps = {
  folder: FolderRow;
  value: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

function FolderRenameDialog({ folder, value, busy, onChange, onClose, onSave }: FolderRenameDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-500">Переименование папки</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">Новое название</label>
          <input
            className="input mt-2 w-full"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Введите название папки"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSave();
              }
            }}
            autoFocus
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={busy || !value.trim()}>{busy ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

type FolderDeleteDialogProps = {
  folder: FolderRow;
  busy?: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function FolderDeleteDialog({ folder, busy, onClose, onDelete }: FolderDeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-slate-500">Удаление папки</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4 text-sm leading-6 text-slate-600">Проекты из папки вернутся на рабочий стол. Сама папка будет удалена.</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 border-rose-600" onClick={onDelete} disabled={busy}>{busy ? "Удаляем…" : "Удалить"}</button>
        </div>
      </div>
    </div>
  );
}

type FolderIconPickerProps = {
  folder: FolderRow;
  busy?: boolean;
  onClose: () => void;
  onSelect: (iconKey: FolderIconKey) => void;
};

function FolderIconPicker({ folder, busy, onClose, onSelect }: FolderIconPickerProps) {
  const active = getFolderIcon(folder.icon_key);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Иконка папки</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
            <div className="mt-1 text-sm text-slate-500">Выбери минимальную иконку — папка на рабочем столе полностью сменится на неё.</div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Закрыть</button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ${active.tileClass}`}>{active.symbol}</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Сейчас: {active.label}</div>
            <div className="text-xs text-slate-500">Иконка влияет только на вид папки на рабочем столе.</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FOLDER_ICONS.map((icon) => {
            const selected = active.key === icon.key;
            return (
              <button
                key={icon.key}
                type="button"
                onClick={() => onSelect(icon.key)}
                disabled={busy}
                className={`rounded-[22px] border p-3 text-left transition ${selected ? `border-transparent ring-2 ${icon.ringClass}` : "border-emerald-100 hover:border-emerald-200"} ${busy ? "opacity-70" : ""}`}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ${icon.tileClass}`}>{icon.symbol}</div>
                <div className="mt-3 text-sm font-medium text-slate-900">{icon.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}