import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { getGoalDefinition, type AssessmentGoal } from "@/lib/commercialGoals";
import { FOLDER_ICONS, getFolderIcon, type FolderIconKey } from "@/lib/folderIcons";
import { useWalletBalance } from "@/lib/useWalletBalance";
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

type PromoCodeRow = {
  id: string;
  code: string;
  amount_kopeks: number;
  max_redemptions: number;
  redeemed_count: number;
  remaining_count: number;
  is_active: boolean;
  created_at: string;
};

const GOAL_ORDER: Record<AssessmentGoal, number> = {
  role_fit: 1,
  general_assessment: 2,
  motivation: 3,
};

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
    default:
      return "from-lime-200 to-emerald-100 text-lime-950 border-lime-300";
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
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([]);
  const [promoCodeValue, setPromoCodeValue] = useState("");
  const [promoAmountRub, setPromoAmountRub] = useState("500");
  const [promoUses, setPromoUses] = useState("5");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");
  const { balance_rub, loading: walletLoading, isUnlimited } = useWalletBalance();
  const isAdmin = isAdminEmail(user?.email);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const requests = [
        fetch("/api/commercial/profile/me", {
          headers: { authorization: `Bearer ${session.access_token}` },
        }),
        fetch("/api/commercial/projects/list", {
          headers: { authorization: `Bearer ${session.access_token}` },
        }),
      ] as Promise<Response>[];
      if (isAdminEmail(user?.email)) {
        requests.push(fetch("/api/admin/promo-codes/list", {
          headers: { authorization: `Bearer ${session.access_token}` },
        }));
      }

      const [profileResp, workspaceResp, promoResp] = await Promise.all(requests);

      const profileJson = await profileResp.json().catch(() => ({}));
      const workspaceJson = await workspaceResp.json().catch(() => ({}));
      if (!profileResp.ok || !profileJson?.ok) throw new Error(profileJson?.error || "Не удалось загрузить кабинет");
      if (!workspaceResp.ok || !workspaceJson?.ok) throw new Error(workspaceJson?.error || "Не удалось загрузить проекты");

      setData(profileJson as DashboardPayload & { ok: true });
      setWorkspace(workspaceJson as WorkspacePayload);

      if (promoResp) {
        const promoJson = await promoResp.json().catch(() => ({}));
        if (!promoResp.ok || !promoJson?.ok) throw new Error(promoJson?.error || "Не удалось загрузить промокоды");
        setPromoCodes(Array.isArray(promoJson.promos) ? promoJson.promos : []);
      } else {
        setPromoCodes([]);
      }
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

  async function createPromoCode() {
    if (!session || !isAdmin) return;
    setPromoBusy(true);
    setPromoMessage("");
    try {
      const resp = await fetch("/api/admin/promo-codes/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code: promoCodeValue,
          amount_rub: Number(promoAmountRub),
          max_redemptions: Number(promoUses),
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось создать промокод");
      setPromoMessage(`Создан промокод ${json?.promo?.code || promoCodeValue}`);
      setPromoCodeValue("");
      await loadDashboard();
    } catch (e: any) {
      setPromoMessage(e?.message || "Ошибка создания промокода");
    } finally {
      setPromoBusy(false);
    }
  }

  async function togglePromoCode(id: string, isActive: boolean) {
    if (!session || !isAdmin) return;
    setPromoBusy(true);
    setPromoMessage("");
    try {
      const resp = await fetch("/api/admin/promo-codes/toggle", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, is_active: isActive }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось обновить промокод");
      await loadDashboard();
    } catch (e: any) {
      setPromoMessage(e?.message || "Ошибка обновления промокода");
    } finally {
      setPromoBusy(false);
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
      {error ? <div className="mb-4 card text-sm text-red-600">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_0.7fr] items-stretch">
        <div className="card h-full">
          <div className="text-sm text-slate-500">Рабочее пространство</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{displayName}</div>
          <div className="mt-2 text-sm text-slate-600">{workspaceName}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/projects/new" className="btn btn-primary">Создать проект оценки</Link>
            <Link href="/assessments" className="btn btn-secondary">Каталог тестов</Link>
          </div>
          <div className="mt-4 text-sm text-slate-600">Рабочий стол проектов устроен как лаунчер: проекты лежат иконками, а папки собирают их в аккуратные группы.</div>
        </div>

        <div className="card h-full relative overflow-hidden border-emerald-100 bg-white">
          <div className="pointer-events-none absolute -right-2 -top-6 text-[108px] font-light leading-none text-emerald-900/7 select-none">☿</div>
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">Кошелёк</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{walletLoading ? "…" : isUnlimited ? "∞" : `${balance_rub} ₽`}</div>
              <div className="mt-1 max-w-[22rem] text-xs text-slate-500">Баланс для открытия уровней результата, AI-интерпретаций и расширенных функций.</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-xl shadow-sm">₽</div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <Link href="/wallet" className="btn btn-primary btn-sm text-center">Пополнить</Link>
            <Link href="/wallet" className="btn btn-secondary btn-sm text-center">Открыть</Link>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <section className="card mt-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Админ · промокоды</div>
              <div className="mt-1 text-sm text-slate-500">Создание ограниченных промокодов по сумме депозита и количеству активаций.</div>
            </div>
            <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">{promoCodes.length} кодов</div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4">
              <div className="grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs text-slate-600">Код</span>
                  <input className="input" value={promoCodeValue} onChange={(e) => setPromoCodeValue(e.target.value.toUpperCase())} placeholder="Например: SPRING-500" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Депозит, ₽</span>
                    <input className="input" inputMode="numeric" value={promoAmountRub} onChange={(e) => setPromoAmountRub(e.target.value)} placeholder="500" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Количество активаций</span>
                    <input className="input" inputMode="numeric" value={promoUses} onChange={(e) => setPromoUses(e.target.value)} placeholder="5" />
                  </label>
                </div>
                <button type="button" className="btn btn-primary" onClick={createPromoCode} disabled={promoBusy || !promoCodeValue.trim()}>
                  {promoBusy ? "Создаём…" : "Создать промокод"}
                </button>
                {promoMessage ? <div className="text-sm text-slate-700">{promoMessage}</div> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white/85 p-4">
              <div className="max-h-[300px] overflow-auto">
                <div className="grid gap-2">
                  {promoCodes.length ? promoCodes.map((promo) => (
                    <div key={promo.id} className="rounded-2xl border border-emerald-100 bg-white px-3 py-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{promo.code}</div>
                          <div className="mt-1 text-xs text-slate-500">{Math.floor(promo.amount_kopeks / 100)} ₽ · {promo.redeemed_count}/{promo.max_redemptions} активаций</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={promoBusy}
                          onClick={() => togglePromoCode(promo.id, !promo.is_active)}
                        >
                          {promo.is_active ? "Отключить" : "Включить"}
                        </button>
                      </div>
                    </div>
                  )) : <div className="text-sm text-slate-500">Промокодов пока нет.</div>}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Рабочий стол проектов</div>
            <div className="mt-1 text-sm text-slate-500">Папки открываются поверх стола, а свободные проекты лежат отдельными иконками.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateFolder((v) => !v)}
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
              <button type="button" className="btn btn-primary" onClick={createFolder} disabled={!newFolderName.trim() || busyFolderId === "new"}>
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
    </Layout>
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
