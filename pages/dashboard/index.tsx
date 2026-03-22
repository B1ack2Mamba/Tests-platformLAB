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
      return "Зрелый сад";
    case 3:
      return "Сильное дерево";
    case 2:
      return "Молодое дерево";
    case 1:
      return "Саженец";
    default:
      return "Росток";
  }
}

function getGreeneryHint(level: GreeneryLevel) {
  switch (level) {
    case 4:
      return "Кабинет уже выглядит как живая среда: дерево раскрыто, а рамки окон обросли мягкой зеленью.";
    case 3:
      return "Дерево окрепло, а вьюны уже заметно обрамляют панели и рабочие окна.";
    case 2:
      return "Зелень уже начала собирать пространство: дерево выросло, а по краям панелей пошли первые вьюны.";
    case 1:
      return "Появился уверенный саженец и первые живые линии вокруг окон.";
    default:
      return "Пока в кабинете только маленький росток. Чем больше пополнений, тем гуще станет вся зелень.";
  }
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

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-900 shadow-[0_12px_30px_-24px_rgba(16,94,64,0.5)] backdrop-blur-xl">
            Живая система оценки
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_0.7fr] items-stretch">
            <div className="card dashboard-panel dashboard-panel-vined relative h-full overflow-hidden">
              <VineFrame growthLevel={greeneryLevel} density="rich" pulseToken={mechanicPulse} />
              <div className="dashboard-panel-glow absolute -right-16 top-0 h-40 w-40 rounded-full bg-emerald-300/25 blur-3xl" />
              <div className="relative">
                <div className="text-sm font-medium text-emerald-900/70">Рабочее пространство</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950 sm:text-[2rem]">{displayName}</div>
                <div className="mt-2 text-sm text-slate-600">{workspaceName}</div>
                <div className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                  Кабинет теперь растёт от реального вклада: чем больше пополнений, тем крупнее дерево и тем гуще зелень вокруг панелей. {greeneryHint}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <PremiumActionButton
                    label="Создать проект оценки"
                    variant="primary"
                    pulseToken={mechanicPulse}
                    onClick={() => triggerMechanics(() => router.push("/projects/new"))}
                  />
                  <PremiumActionButton
                    label="Каталог тестов"
                    variant="secondary"
                    pulseToken={mechanicPulse}
                    onClick={() => triggerMechanics(() => router.push("/assessments"))}
                  />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="dashboard-stat-chip">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Проекты</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{projects.length}</div>
                  </div>
                  <div className="dashboard-stat-chip">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Папки</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{folders.length}</div>
                  </div>
                  <div className="dashboard-stat-chip">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Попытки</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-950">{totalAttempts}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card dashboard-panel dashboard-panel-vined dashboard-wallet h-full relative overflow-hidden border-emerald-100 bg-white/70">
              <VineFrame growthLevel={greeneryLevel} density="light" pulseToken={mechanicPulse} />
              <div className="pointer-events-none absolute -right-16 top-1 h-44 w-44 rounded-full bg-white/70 blur-2xl" />
              <div className="pointer-events-none absolute right-4 top-4 flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/70 bg-white/80 text-xl text-emerald-900 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">₽</div>
              <div className="relative flex items-start justify-between gap-3 pr-14">
                <div>
                  <div className="text-sm font-medium text-emerald-900/70">Кошелёк</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{walletLoading ? "…" : isUnlimited ? "∞" : `${balance_rub} ₽`}</div>
                  <div className="mt-2 max-w-[22rem] text-xs leading-5 text-slate-500">Баланс для открытия уровней результата, AI-интерпретаций и расширенных функций.</div>
                  <div className="mt-3 rounded-2xl border border-emerald-100 bg-white/70 px-3 py-2 text-xs leading-5 text-emerald-900/80">
                    Чем больше вложено рублей в кабинет, тем гуще зелень и крупнее дерево: {isUnlimited ? "без лимита" : `${investedRub} ₽`}. Сейчас это стадия «{greeneryLabel}».
                  </div>
                </div>
              </div>
              <div className="relative mt-5 grid grid-cols-2 gap-3">
                <PremiumActionButton
                  label="Пополнить"
                  variant="primary"
                  compact
                  pulseToken={mechanicPulse}
                  onClick={() => triggerMechanics(() => router.push("/wallet"))}
                />
                <PremiumActionButton
                  label="Открыть"
                  variant="secondary"
                  compact
                  pulseToken={mechanicPulse}
                  onClick={() => triggerMechanics(() => router.push("/wallet"))}
                />
              </div>
            </div>
          </div>

      {isAdmin ? (
        <section className="card dashboard-panel dashboard-panel-vined relative mt-6 overflow-hidden">
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
            <div className="text-sm font-semibold text-slate-900">Рабочий стол проектов</div>
            <div className="mt-1 text-sm text-slate-500">Папки открываются поверх стола, а свободные проекты лежат отдельными иконками.</div>
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
                <div className="text-sm font-semibold text-slate-900">Новая папка на рабочем столе</div>
                <div className="mt-1 text-xs text-slate-500">Выбери иконку, задай название и собери свои проекты в одну понятную группу.</div>
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

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {folderBuckets.byFolder.map(({ folder, projects: folderProjects }) => (
            <FolderDesktopIcon
              key={folder.id}
              folder={folder}
              projects={folderProjects}
              busy={busyFolderId === folder.id}
              onOpen={() => setActiveFolderId(folder.id)}
              onManage={() => setFolderActionTarget(folder)}
              onDropProject={(projectId) => moveProject(projectId, folder.id)}
              draggingProjectId={draggingProjectId}
            />
          ))}

          {folderBuckets.uncategorized.map((project) => (
            <ProjectDesktopIcon
              key={project.id}
              project={project}
              busy={busyFolderId === `delete:${project.id}`}
              onOpen={() => router.push(`/projects/${project.id}`)}
              onDragStart={() => setDraggingProjectId(project.id)}
              onDragEnd={() => setDraggingProjectId(null)}
              onDelete={() => deleteProject(project.id)}
            />
          ))}
        </div>

        {!folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
            Здесь пока пусто. Создай проект или папку, и рабочий стол оживёт.
          </div>
        ) : null}
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
        <div className="absolute -left-20 top-4 h-72 w-72 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="absolute right-[-4rem] top-0 h-80 w-80 rounded-full bg-white/55 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-64 w-64 rounded-full bg-teal-200/20 blur-3xl" />
      </div>

      <TreeGrowthScene greeneryLevel={greeneryLevel} pulseToken={pulseToken} />

      {greeneryLevel <= 1 ? (
        <div className="pointer-events-none absolute right-[4%] top-[12%] z-[1] opacity-70 blur-[0.2px]">
          <SproutAura key={`sprout-aura-${pulseToken}`} />
        </div>
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

function TreeGrowthScene({ greeneryLevel, pulseToken }: { greeneryLevel: GreeneryLevel; pulseToken: number }) {
  const sceneClass =
    greeneryLevel >= 4
      ? "h-[27rem] w-[28rem] max-w-[46vw] opacity-[0.98]"
      : greeneryLevel === 3
      ? "h-[24rem] w-[25rem] max-w-[44vw] opacity-[0.96]"
      : greeneryLevel === 2
      ? "h-[20rem] w-[21rem] max-w-[38vw] opacity-[0.94]"
      : greeneryLevel === 1
      ? "h-[16rem] w-[17rem] max-w-[32vw] opacity-[0.9]"
      : "h-[11rem] w-[12rem] max-w-[24vw] opacity-[0.84]";

  return (
    <div className={`dashboard-tree-scene pointer-events-none absolute bottom-[-0.8rem] left-[-1.4rem] z-[1] transition-all duration-700 ${sceneClass}`}>
      <svg key={`tree-growth-level-${greeneryLevel}-${pulseToken}`} viewBox="0 0 360 360" className="h-full w-full" fill="none" aria-hidden="true">
        <ellipse cx="135" cy="318" rx="78" ry="22" className="dashboard-tree-ground" />

        <g className="dashboard-tree-sprout">
          <path d="M120 312C128 300 136 292 144 286" className="dashboard-tree-sprout-stem" />
          <path d="M143 286C131 280 121 280 112 288C123 292 133 292 143 286Z" className="dashboard-tree-sprout-leaf" />
          <path d="M143 286C152 276 164 272 178 278C169 287 158 290 143 286Z" className="dashboard-tree-sprout-leaf dashboard-tree-sprout-leaf-alt" />
        </g>

        {greeneryLevel >= 1 ? <path d="M143 286C150 252 160 220 177 191C194 162 211 139 223 110" className="dashboard-tree-trunk" /> : null}
        {greeneryLevel >= 1 ? <path d="M167 208C153 214 139 224 124 239" className="dashboard-tree-branch dashboard-tree-branch-e" /> : null}
        {greeneryLevel >= 2 ? <path d="M179 190C162 175 145 165 126 159" className="dashboard-tree-branch dashboard-tree-branch-a" /> : null}
        {greeneryLevel >= 2 ? <path d="M204 145C192 124 177 108 156 96" className="dashboard-tree-branch dashboard-tree-branch-c" /> : null}
        {greeneryLevel >= 3 ? <path d="M191 166C211 157 229 143 245 120" className="dashboard-tree-branch dashboard-tree-branch-b" /> : null}
        {greeneryLevel >= 3 ? <path d="M214 131C234 123 252 108 267 86" className="dashboard-tree-branch dashboard-tree-branch-d" /> : null}

        {greeneryLevel >= 1 ? (
          <g className="dashboard-tree-canopy dashboard-tree-canopy-c">
            <circle cx="154" cy="96" r="22" />
            <circle cx="186" cy="80" r="19" />
            <circle cx="214" cy="98" r="17" />
          </g>
        ) : null}
        {greeneryLevel >= 2 ? (
          <g className="dashboard-tree-canopy dashboard-tree-canopy-a">
            <circle cx="118" cy="152" r="28" />
            <circle cx="150" cy="132" r="30" />
            <circle cx="176" cy="156" r="24" />
          </g>
        ) : null}
        {greeneryLevel >= 3 ? (
          <g className="dashboard-tree-canopy dashboard-tree-canopy-b">
            <circle cx="206" cy="122" r="29" />
            <circle cx="242" cy="102" r="32" />
            <circle cx="266" cy="132" r="22" />
          </g>
        ) : null}

        {greeneryLevel >= 4 ? (
          <g className="dashboard-tree-canopy dashboard-tree-canopy-rich">
            <circle cx="101" cy="188" r="18" />
            <circle cx="126" cy="188" r="15" />
            <circle cx="286" cy="152" r="18" />
            <circle cx="246" cy="72" r="14" />
            <circle cx="217" cy="58" r="12" />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function SproutAura() {
  return (
    <svg viewBox="0 0 140 140" width="112" height="112" fill="none" aria-hidden="true" className="dashboard-sprout-aura">
      <circle cx="70" cy="70" r="42" className="dashboard-sprout-aura-core" />
      <path d="M70 94C70 76 70 63 70 48" className="dashboard-sprout-aura-stem" />
      <path d="M70 55C54 44 41 44 30 55C45 60 58 60 70 55Z" className="dashboard-sprout-aura-leaf" />
      <path d="M70 55C84 39 99 34 116 42C104 56 89 61 70 55Z" className="dashboard-sprout-aura-leaf dashboard-sprout-aura-leaf-alt" />
    </svg>
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

function VineFrame({ growthLevel, density = "rich", pulseToken = 0 }: VineFrameProps) {
  if (growthLevel === 0) return null;

  return (
    <div key={`vines-${density}-${growthLevel}-${pulseToken}`} className={`dashboard-vine-shell pointer-events-none absolute inset-[8px] z-0 ${density === "rich" ? "opacity-95" : "opacity-80"}`}>
      <CornerVine className="-left-3 -top-3" growthLevel={growthLevel} />
      <CornerVine className="-right-3 -top-3 -scale-x-100" growthLevel={growthLevel} />
      <CornerVine className="-bottom-3 -left-3 -scale-y-100" growthLevel={growthLevel} />
      <CornerVine className="-bottom-3 -right-3 scale-y-[-1] scale-x-[-1]" growthLevel={growthLevel} />
      {growthLevel >= 2 ? <EdgeVine side="top" growthLevel={growthLevel} /> : null}
      {growthLevel >= 3 && density === "rich" ? <EdgeVine side="right" growthLevel={growthLevel} /> : null}
      {growthLevel >= 4 && density === "rich" ? <EdgeVine side="bottom" growthLevel={growthLevel} /> : null}
    </div>
  );
}

function CornerVine({ className = "", growthLevel }: { className?: string; growthLevel: GreeneryLevel }) {
  return (
    <div className={`absolute h-20 w-24 sm:h-24 sm:w-28 ${className}`}>
      <svg viewBox="0 0 160 150" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M14 138C20 111 30 93 46 78C64 61 79 52 102 44C116 39 131 27 143 12" className="dashboard-vine-stroke dashboard-vine-stroke-main" />
        {growthLevel >= 2 ? <path d="M36 134C46 110 57 95 72 84" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        {growthLevel >= 3 ? <path d="M64 77C56 66 48 62 37 61" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        {growthLevel >= 4 ? <path d="M100 44C95 30 90 23 79 16" className="dashboard-vine-stroke dashboard-vine-stroke-soft" /> : null}
        <ellipse cx="55" cy="66" rx="8" ry="4.4" className="dashboard-vine-leaf" transform="rotate(-32 55 66)" />
        {growthLevel >= 2 ? <ellipse cx="82" cy="51" rx="8" ry="4.4" className="dashboard-vine-leaf dashboard-vine-leaf-delay" transform="rotate(18 82 51)" /> : null}
        {growthLevel >= 3 ? <ellipse cx="108" cy="33" rx="8" ry="4.4" className="dashboard-vine-leaf dashboard-vine-leaf-delay-2" transform="rotate(-25 108 33)" /> : null}
        {growthLevel >= 4 ? <ellipse cx="37" cy="97" rx="7" ry="4" className="dashboard-vine-leaf dashboard-vine-leaf-delay" transform="rotate(28 37 97)" /> : null}
      </svg>
    </div>
  );
}

function EdgeVine({ side, growthLevel }: { side: "top" | "right" | "bottom"; growthLevel: GreeneryLevel }) {
  if (side === "top") {
    return (
      <div className="absolute left-16 right-16 top-0 h-7 opacity-80">
        <svg viewBox="0 0 360 48" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M10 34C62 10 102 10 152 26C204 42 260 40 350 16" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
          <ellipse cx="92" cy="17" rx="7" ry="4" className="dashboard-vine-leaf" transform="rotate(-12 92 17)" />
          <ellipse cx="170" cy="28" rx="7" ry="4" className="dashboard-vine-leaf dashboard-vine-leaf-delay" transform="rotate(16 170 28)" />
          {growthLevel >= 3 ? <ellipse cx="252" cy="26" rx="7" ry="4" className="dashboard-vine-leaf dashboard-vine-leaf-delay-2" transform="rotate(-18 252 26)" /> : null}
        </svg>
      </div>
    );
  }

  if (side === "right") {
    return (
      <div className="absolute right-0 top-16 bottom-16 w-5 opacity-75">
        <svg viewBox="0 0 40 220" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M14 8C28 38 28 70 18 104C10 138 12 172 28 212" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
          <ellipse cx="26" cy="52" rx="7" ry="4" className="dashboard-vine-leaf" transform="rotate(72 26 52)" />
          <ellipse cx="12" cy="120" rx="7" ry="4" className="dashboard-vine-leaf dashboard-vine-leaf-delay" transform="rotate(-68 12 120)" />
          {growthLevel >= 4 ? <ellipse cx="24" cy="180" rx="7" ry="4" className="dashboard-vine-leaf dashboard-vine-leaf-delay-2" transform="rotate(58 24 180)" /> : null}
        </svg>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-20 right-20 h-6 opacity-70">
      <svg viewBox="0 0 360 40" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M12 8C72 30 134 34 190 22C246 10 296 10 348 30" className="dashboard-vine-stroke dashboard-vine-stroke-soft" />
        <ellipse cx="110" cy="24" rx="7" ry="4" className="dashboard-vine-leaf" transform="rotate(-8 110 24)" />
        <ellipse cx="230" cy="16" rx="7" ry="4" className="dashboard-vine-leaf dashboard-vine-leaf-delay" transform="rotate(14 230 16)" />
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
};

function FolderDesktopIcon({ folder, projects, busy, onOpen, onManage, onDropProject, draggingProjectId }: FolderDesktopIconProps) {
  const preview = projects.slice(0, 4);
  const icon = getFolderIcon(folder.icon_key);
  return (
    <div className="group relative flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className={`relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border bg-white shadow-sm transition hover:shadow-md ${draggingProjectId ? "border-emerald-300" : "border-emerald-200"} ${busy ? "opacity-70" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
          if (draggedId) onDropProject(draggedId);
        }}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${icon.tileClass}`} />
        <div className="absolute left-3 top-3 text-[30px] leading-none">{icon.symbol}</div>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-1">
          {preview.length ? preview.map((project) => (
            <div
              key={project.id}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border bg-gradient-to-br ${goalColor(project.goal)} text-[11px] font-semibold shadow-sm`}
            >
              {getInitials(project.person?.full_name || project.title || "PR")}
            </div>
          )) : (
            <div className="col-span-2 text-xs text-slate-500">Пусто</div>
          )}
        </div>
        <div className="absolute bottom-2 right-3 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm">{projects.length}</div>
      </button>
      <div className="max-w-[112px] text-center text-sm font-medium leading-tight text-slate-800">{folder.name}</div>
      <button
        type="button"
        onClick={onManage}
        className="absolute right-1 top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/95 text-sm text-slate-500 shadow-sm opacity-0 transition hover:text-slate-900 group-hover:opacity-100"
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
  const goal = getGoalDefinition(project.goal);
  const total = project.tests?.length || 0;
  const completed = Math.min(project.attempts_count || 0, total || 0);
  const isDone = total > 0 && completed >= total;

  return (
    <div className="group relative flex flex-col items-center gap-2">
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1 top-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white/95 text-xs text-slate-500 shadow-sm opacity-0 transition hover:text-red-600 group-hover:opacity-100"
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
        className={`relative flex ${compact ? "h-24 w-24" : "h-28 w-28"} items-center justify-center rounded-[28px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isDone ? "border-emerald-300 bg-white" : "border-slate-200"} ${busy ? "opacity-60" : ""}`}
      >
        <div className={`flex ${compact ? "h-14 w-14 text-lg" : "h-16 w-16 text-xl"} items-center justify-center rounded-2xl border bg-gradient-to-br ${goalColor(project.goal)} font-semibold shadow-sm`}>
          {getInitials(displayName)}
        </div>
        <div className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm ${isDone ? "bg-emerald-100 text-emerald-900" : "bg-white text-slate-600"}`}>
          {isDone ? "Готово" : `${completed}/${total || 0}`}
        </div>
      </button>
      <div className="max-w-[116px] text-center text-sm font-semibold leading-tight text-slate-900">{displayName}</div>
      <div className="max-w-[120px] text-center text-xs leading-tight text-slate-500">{goal?.shortTitle || project.goal}</div>
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
      <div className="w-full max-w-5xl rounded-[32px] border border-emerald-200 bg-white/95 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
