import { useCallback, useEffect, useMemo, useState } from "react";
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

const DESK_WIDTH = 1400;
const DESK_HEIGHT = 780;
const DESK_FOLDER_WIDTH = 168;
const DESK_FOLDER_HEIGHT = 196;
const DESK_SHEET_WIDTH = 212;
const DESK_SHEET_HEIGHT = 164;
const DESK_STORAGE_PREFIX = "commercialDeskLayout:";
const TRAY_ZONE = { x: 20, y: 164, width: 262, height: 286 };

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

function getDefaultFolderPosition(index: number): DeskPosition {
  return {
    x: TRAY_ZONE.x + 36 + (index % 2) * 8,
    y: TRAY_ZONE.y + 10 + index * 16,
    z: 20 + index,
  };
}

function getDefaultProjectPosition(index: number): DeskPosition {
  const row = Math.floor(index / 4);
  const col = index % 4;
  return {
    x: 420 + col * 186 + (row % 2) * 14,
    y: 360 + row * 96 + (col % 2) * 10,
    z: 140 + index,
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
      return;
    }

    if (draggedFolderId) {
      const itemId = `folder:${draggedFolderId}`;
      bringDeskItemToFront(itemId);
      placeDeskItem(itemId, "folder", e.clientX - rect.left - DESK_FOLDER_WIDTH / 2, e.clientY - rect.top - DESK_FOLDER_HEIGHT / 2);
    }
  }, [bringDeskItemToFront, draggingProjectId, folderBuckets.uncategorized, moveProject, placeDeskItem]);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name || !session) return;
    setBusyFolderId("new");
    try {
      const resp = await fetch("/api/commercial/folders/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name, icon_key: newFolderIcon }),
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

  async function deleteProject(projectId: string) {
    if (!session) return;
    if (!window.confirm("Удалить проект? Это действие уберёт проект, приглашение и результаты по нему.")) return;
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


  if (!session || !user) {
    return (
      <Layout title="Кабинет">
        <div className="card text-sm text-slate-700">Переадресация на вход…</div>
      </Layout>
    );
  }

  const displayName = data?.profile?.full_name || (user.user_metadata as any)?.full_name || user.email || "Пользователь";
  const workspaceName = workspace?.workspace?.name || data?.profile?.company_name || (user.user_metadata as any)?.company_name || "Рабочее пространство";

  return (
    <Layout title="Кабинет специалиста">
      <div className="dashboard-experience relative isolate -mx-3 overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4">
        <DashboardBackdrop pulseToken={mechanicPulse} greeneryLevel={greeneryLevel} />

        <div className="relative z-10">
          {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#5a3d22] shadow-[0_12px_30px_-24px_rgba(58,39,20,0.35)] backdrop-blur-xl">
            Премиальный рабочий стол
          </div>

          <section className="card dashboard-panel dashboard-panel-vined relative mt-2 overflow-hidden">
            <VineFrame growthLevel={greeneryLevel} density="rich" pulseToken={mechanicPulse} />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#4a2f18]">Рабочий стол проектов</div>
                <div className="mt-1 max-w-3xl text-sm leading-6 text-[#6f5033]">Реалистичный кабинет сверху: табличка с данными специалиста лежит на столе, кошелёк находится справа вверху, а проекты и папки можно свободно раскладывать по поверхности, класть друг на друга и убирать в папки мышкой.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateFolder((v) => !v); setMechanicPulse((value) => value + 1); }}
                  className="btn btn-secondary btn-sm"
                >
                  {showCreateFolder ? "Скрыть папку" : "Новая папка"}
                </button>
                <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">
                  Без папки: {folderBuckets.uncategorized.length}
                </div>
              </div>
            </div>

            {showCreateFolder ? (
              <div className="mt-4 rounded-[24px] border border-emerald-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#4a2f18]">Новая папка на столе</div>
                    <div className="mt-1 text-xs text-[#7b5a38]">Создай отдельную папку и складывай в неё листы проектов так же, как в реальном кабинете.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FOLDER_ICONS.map((icon) => {
                      const selected = newFolderIcon === icon.key;
                      return (
                        <button
                          key={icon.key}
                          type="button"
                          onClick={() => setNewFolderIcon(icon.key)}
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-gradient-to-br text-xl shadow-sm transition ${icon.tileClass} ${selected ? `ring-2 ${icon.ringClass} border-transparent` : "border-emerald-100 hover:border-emerald-200"}`}
                          title={icon.label}
                          aria-label={icon.label}
                        >
                          {icon.symbol}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Например, Подбор / Команда / Архив"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createFolder();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-primary" onClick={() => { setMechanicPulse((value) => value + 1); createFolder(); }} disabled={!newFolderName.trim() || busyFolderId === "new"}>
                    {busyFolderId === "new" ? "Создаём…" : "Создать"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="dashboard-office-scene relative min-h-[960px] overflow-hidden rounded-[34px] border border-[#4f3420]/20">
                <div className="dashboard-office-scene-backdrop absolute inset-0" />
                <div className="dashboard-office-scene-vignette absolute inset-0" />

                <div className="dashboard-desk-nameplate absolute left-6 top-6 z-[220] max-w-[24rem] rounded-[22px] px-5 py-4 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a5b37]">Кабинет специалиста</div>
                  <div className="mt-2 text-[1.45rem] font-semibold leading-tight text-[#2c1b10]">{displayName}</div>
                  <div className="mt-1 text-sm text-[#5e4128]">{workspaceName}</div>
                  <div className="mt-2 text-xs leading-5 text-[#71553a]">{data?.profile?.email || user.email || "email не указан"}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#64462c]">
                    <span className="dashboard-desk-meta-pill">Проектов: {projects.length}</span>
                    <span className="dashboard-desk-meta-pill">Папок: {folders.length}</span>
                    <span className="dashboard-desk-meta-pill">Попыток: {totalAttempts}</span>
                  </div>
                </div>

                <div className="dashboard-desk-wallet absolute right-6 top-6 z-[220] w-[18.5rem] rounded-[22px] px-5 py-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#84633d]">Кошелёк</div>
                      <div className="mt-2 text-[1.5rem] font-semibold text-[#2c1b10]">{walletLoading ? "…" : isUnlimited ? "∞" : `${balance_rub} ₽`}</div>
                    </div>
                    <div className="rounded-full border border-[#dcc39b] bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#6b4b2f] shadow-sm">{greeneryLabel}</div>
                  </div>
                  <div className="mt-2 text-xs leading-5 text-[#6a4b31]">Вложено: {isUnlimited ? "без лимита" : `${investedRub} ₽`}. Чем больше пополнений, тем богаче зелень и атмосфера кабинета.</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => triggerMechanics(() => router.push("/wallet"))}>Пополнить</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => triggerMechanics(() => router.push("/wallet"))}>Открыть</button>
                  </div>
                </div>

                <button
                  type="button"
                  className="dashboard-pen-trigger absolute bottom-16 right-12 z-[220]"
                  onClick={() => triggerMechanics(() => router.push("/projects/new"), 180)}
                  aria-label="Создать проект оценки"
                  title="Создать проект оценки"
                >
                  <span className="dashboard-pen-body" />
                  <span className="dashboard-pen-cap" />
                  <span className="dashboard-pen-tip" />
                  <span className="dashboard-pen-label">Создать проект оценки</span>
                </button>

                <button
                  type="button"
                  className="dashboard-notebook-trigger absolute right-10 top-[11.4rem] z-[220]"
                  onClick={() => triggerMechanics(() => router.push("/assessments"), 180)}
                >
                  <span className="dashboard-notebook-title">Каталог тестов</span>
                  <span className="dashboard-notebook-subtitle">Открыть материалы</span>
                </button>

                <div className="dashboard-office-workzone absolute inset-x-6 bottom-6 top-[13.5rem] overflow-hidden rounded-[26px]" onDragOver={(e) => e.preventDefault()} onDrop={handleDeskDrop}>
                  <div className="dashboard-tray-zone pointer-events-none absolute left-[0.9rem] top-[8.6rem] z-[3] h-[15rem] w-[15rem] rounded-[1.2rem]" />
                  <div className="dashboard-wood-desk-notes pointer-events-none absolute left-6 top-5 rounded-2xl border border-white/40 bg-white/12 px-4 py-2 text-xs font-medium text-[#f7f0e2] [text-shadow:0_1px_3px_rgba(40,22,8,0.5)]">
                    Папки можно складывать в лоток слева, а листы — свободно раскладывать под углом по столу.
                  </div>

                  {folderBuckets.byFolder.map(({ folder, projects: folderProjects }) => {
                    const itemId = `folder:${folder.id}`;
                    const position = deskPositions[itemId] || getDefaultFolderPosition(folder.sort_order || 0);
                    return (
                      <div
                        key={folder.id}
                        className="absolute"
                        style={{ left: position.x, top: position.y, zIndex: position.z }}
                      >
                        <FolderDesktopIcon
                          folder={folder}
                          projects={folderProjects}
                          busy={busyFolderId === folder.id}
                          onOpen={() => setActiveFolderId(folder.id)}
                          onManage={() => setFolderActionTarget(folder)}
                          onDropProject={(projectId) => moveProject(projectId, folder.id)}
                          draggingProjectId={draggingProjectId}
                          onDragStart={() => bringDeskItemToFront(itemId)}
                          onDragEnd={() => undefined}
                        />
                      </div>
                    );
                  })}

                  {folderBuckets.uncategorized.map((project, projectIndex) => {
                    const itemId = `project:${project.id}`;
                    const position = deskPositions[itemId] || getDefaultProjectPosition(projectIndex);
                    return (
                      <div
                        key={project.id}
                        className="absolute"
                        style={{ left: position.x, top: position.y, zIndex: position.z }}
                      >
                        <ProjectDesktopIcon
                          project={project}
                          busy={busyFolderId === `delete:${project.id}`}
                          onOpen={() => setPreviewProject(project)}
                          onDragStart={() => {
                            setDraggingProjectId(project.id);
                            bringDeskItemToFront(itemId);
                          }}
                          onDragEnd={() => setDraggingProjectId(null)}
                          onDelete={() => deleteProject(project.id)}
                        />
                      </div>
                    );
                  })}

                  {!folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? (
                    <div className="absolute inset-x-8 top-28 rounded-2xl border border-dashed border-white/35 bg-white/10 p-8 text-center text-sm text-[#fff7eb] backdrop-blur-[2px]">
                      Здесь пока пусто. Нажми на ручку справа внизу, чтобы создать первый проект, или создай папку над столом.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

      {isAdmin ? (
        <section className="card dashboard-panel dashboard-desk-surface dashboard-panel-vined relative mt-6 overflow-hidden">
          <VineFrame growthLevel={greeneryLevel} density="light" pulseToken={mechanicPulse} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Админ-панель</div>
              <div className="mt-1 text-sm text-slate-500">Промокоды и служебные инструменты вынесены в отдельную вкладку, чтобы кабинет остался рабочим, а не административным.</div>
            </div>
            <Link href="/admin" className="btn btn-secondary btn-sm">Открыть /admin</Link>
          </div>
        </section>
      ) : null}

      <section className="card dashboard-panel dashboard-panel-vined relative mt-6 overflow-hidden">
        <VineFrame growthLevel={greeneryLevel} density="rich" pulseToken={mechanicPulse} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#4a2f18]">Рабочий стол проектов</div>
            <div className="mt-1 text-sm text-[#6f5033]">Вид сверху на дорогой дубовый стол: папки лежат как реальные офисные папки, а проекты — как отдельные листы, которые можно перетаскивать в папки.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowCreateFolder((v) => !v); setMechanicPulse((value) => value + 1); }}
              className="btn btn-secondary btn-sm"
            >
              {showCreateFolder ? "Скрыть папку" : "Новая папка"}
            </button>
            <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">
              Без папки: {folderBuckets.uncategorized.length}
            </div>
          </div>
        </div>

        {showCreateFolder ? (
          <div className="mt-4 rounded-[24px] border border-emerald-100 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#4a2f18]">Новая папка на рабочем столе</div>
                <div className="mt-1 text-xs text-[#7b5a38]">Создай отдельную папку на столе и собирай в неё листы проектов как в реальном кабинете.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {FOLDER_ICONS.map((icon) => {
                  const selected = newFolderIcon === icon.key;
                  return (
                    <button
                      key={icon.key}
                      type="button"
                      onClick={() => setNewFolderIcon(icon.key)}
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-gradient-to-br text-xl shadow-sm transition ${icon.tileClass} ${selected ? `ring-2 ${icon.ringClass} border-transparent` : "border-emerald-100 hover:border-emerald-200"}`}
                      title={icon.label}
                      aria-label={icon.label}
                    >
                      {icon.symbol}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Например, Подбор / Команда / Архив"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createFolder();
                  }
                }}
              />
              <button type="button" className="btn btn-primary" onClick={() => { setMechanicPulse((value) => value + 1); createFolder(); }} disabled={!newFolderName.trim() || busyFolderId === "new"}>
                {busyFolderId === "new" ? "Создаём…" : "Создать"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <div
            className="dashboard-wood-desk relative min-h-[780px] overflow-hidden rounded-[30px] border border-[#6b4727]/35"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDeskDrop}
          >
            <div className="dashboard-wood-desk-glow pointer-events-none absolute inset-x-10 top-5 h-16 rounded-full blur-3xl" />
            <div className="dashboard-wood-desk-notes pointer-events-none absolute left-6 top-5 rounded-2xl border border-white/40 bg-white/10 px-4 py-2 text-xs font-medium text-[#f7f0e2] [text-shadow:0_1px_3px_rgba(40,22,8,0.5)]">
              Листы можно раскладывать по всему столу, класть друг на друга и собирать в папки.
            </div>

            {folderBuckets.byFolder.map(({ folder, projects: folderProjects }) => {
              const itemId = `folder:${folder.id}`;
              const position = deskPositions[itemId] || getDefaultFolderPosition(folder.sort_order || 0);
              return (
                <div
                  key={folder.id}
                  className="absolute"
                  style={{ left: position.x, top: position.y, zIndex: position.z }}
                >
                  <FolderDesktopIcon
                    folder={folder}
                    projects={folderProjects}
                    busy={busyFolderId === folder.id}
                    onOpen={() => setActiveFolderId(folder.id)}
                    onManage={() => setFolderActionTarget(folder)}
                    onDropProject={(projectId) => moveProject(projectId, folder.id)}
                    draggingProjectId={draggingProjectId}
                    onDragStart={() => bringDeskItemToFront(itemId)}
                    onDragEnd={() => undefined}
                  />
                </div>
              );
            })}

            {folderBuckets.uncategorized.map((project, projectIndex) => {
              const itemId = `project:${project.id}`;
              const position = deskPositions[itemId] || getDefaultProjectPosition(projectIndex);
              return (
                <div
                  key={project.id}
                  className="absolute"
                  style={{ left: position.x, top: position.y, zIndex: position.z }}
                >
                  <ProjectDesktopIcon
                    project={project}
                    busy={busyFolderId === `delete:${project.id}`}
                    onOpen={() => setPreviewProject(project)}
                    onDragStart={() => {
                      setDraggingProjectId(project.id);
                      bringDeskItemToFront(itemId);
                    }}
                    onDragEnd={() => setDraggingProjectId(null)}
                    onDelete={() => deleteProject(project.id)}
                  />
                </div>
              );
            })}

            {!folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? (
              <div className="absolute inset-x-8 top-28 rounded-2xl border border-dashed border-white/35 bg-white/10 p-8 text-center text-sm text-[#fff7eb] backdrop-blur-[2px]">
                Здесь пока пусто. Создай проект или папку, и рабочий стол оживёт.
              </div>
            ) : null}
          </div>
        </div>
      </section>

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
        </div>
      </div>
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
  const icon = getFolderIcon(folder.icon_key);
  const tilt = ((folder.sort_order || 0) % 4 - 1.5) * 0.12;

  return (
    <div className="group relative flex flex-col items-center gap-2" style={{ transform: `rotate(${tilt}deg)` }}>
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
        className={`dashboard-folder-card relative flex items-end justify-start overflow-visible border transition hover:-translate-y-0.5 ${draggingProjectId ? "border-[#94724a]" : "border-[#aa8258]"} ${busy ? "opacity-70" : ""}`}
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
        <div className="absolute left-4 top-3 text-sm leading-none text-[#8b6232] opacity-40">{icon.symbol}</div>

        <div className="pointer-events-none absolute left-3 right-4 top-2 z-20 flex flex-col gap-1.5">
          {preview.length ? preview.map((project, index) => {
            const slipTitle = project.person?.full_name || project.title || "Проект";
            return (
              <div
                key={project.id}
                className="dashboard-folder-name-slip rounded-[7px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm"
                style={{
                  marginLeft: `${index * 9}px`,
                  marginRight: `${Math.max(0, 18 - index * 5)}px`,
                  transform: `translateY(${index * 7}px) rotate(${index % 2 === 0 ? -0.75 : 0.55}deg)`,
                  zIndex: 30 - index,
                }}
              >
                <span className="block truncate">{slipTitle}</span>
              </div>
            );
          }) : (
            <div className="dashboard-folder-name-slip rounded-[7px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm">
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
  const tiltSeed = Array.from(project.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const tilt = ((tiltSeed % 9) - 4) * 2.1;
  const lift = 54 + (tiltSeed % 3) * 8;

  return (
    <div className="group relative flex flex-col items-center gap-2 dashboard-project-paper-angled-wrap" style={{ transform: `perspective(1400px) rotateX(66deg) rotateZ(${tilt}deg) translateY(-${lift}px)` }}>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1 top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#d5d9df] bg-white/95 text-xs text-[#5b6674] shadow-sm opacity-0 transition hover:text-red-600 group-hover:opacity-100"
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
        className={`dashboard-project-paper ${compact ? "dashboard-project-paper-compact" : ""} ${busy ? "opacity-60" : ""}`}
      >
        <span className="dashboard-project-paper-shadow" aria-hidden="true" />
        <span className="dashboard-project-paper-sheet" aria-hidden="true" />
        <span className="dashboard-project-paper-clip" aria-hidden="true" />
        <span className="dashboard-project-paper-clip-inner" aria-hidden="true" />

        <span className="dashboard-project-paper-header">Проект оценки</span>
        <span className="dashboard-project-paper-title">{titleLine}</span>

        <span className="dashboard-project-paper-grid">
          <span className="dashboard-project-paper-row">
            <span className="dashboard-project-paper-label">Имя</span>
            <span className="dashboard-project-paper-value">{displayName}</span>
          </span>
          <span className="dashboard-project-paper-row">
            <span className="dashboard-project-paper-label">Цель</span>
            <span className="dashboard-project-paper-value">{goal?.shortTitle || project.goal}</span>
          </span>
          <span className="dashboard-project-paper-row">
            <span className="dashboard-project-paper-label">Роль</span>
            <span className="dashboard-project-paper-value">{roleLine}</span>
          </span>
          <span className="dashboard-project-paper-row">
            <span className="dashboard-project-paper-label">Оценка</span>
            <span className="dashboard-project-paper-value">{assessmentLine}</span>
          </span>
        </span>

        <span className="dashboard-project-paper-footer">
          <span>{completed}/{total || 0} тестов</span>
          <span>{new Date(project.created_at).toLocaleDateString("ru-RU")}</span>
        </span>
        <span className="dashboard-project-paper-footer dashboard-project-paper-footer-secondary">
          <span>{assessmentLine}</span>
          <span>{roleLine}</span>
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
