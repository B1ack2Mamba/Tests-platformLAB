import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import {
  COMMERCIAL_GOALS,
  getGoalDefinition,
  getGoalRecommendedTests,
  getGoalWeight,
  isAssessmentGoal,
  type AssessmentGoal,
} from "@/lib/commercialGoals";
import {
  getClosestGoalForCompetencies,
  getCompetencyGroups,
  getCompetencyLongLabel,
  getCompetencyRecommendedTests,
  getCompetencyTestReasons,
  type RoutingMode,
} from "@/lib/competencyRouter";
import { getAllTests } from "@/lib/loadTests";
import type { AnyTest } from "@/lib/testTypes";
import { getTestDisplayTitle } from "@/lib/testTitles";

type WorkspacePayload = {
  ok: true;
  workspace: { workspace_id: string; role: string; name: string };
};

type NewProjectPageProps = { tests: Pick<AnyTest, "slug" | "title">[] };

type PageBuilderState = {
  builderOpen: boolean;
  tabletX: number;
  tabletY: number;
  tabletScale: number;
  pageX: number;
  pageY: number;
  pageScale: number;
};

const DEFAULT_PAGE_BUILDER_STATE: PageBuilderState = {
  builderOpen: false,
  tabletX: 0,
  tabletY: 0,
  tabletScale: 1,
  pageX: 0,
  pageY: 0,
  pageScale: 1,
};

const PAGE_BUILDER_STORAGE_KEY = "project-create-page-builder-v1";
const PROJECT_CREATE_TEMPLATE_OWNER_EMAIL = "storyguild9@gmail.com";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group relative shrink-0">
      <summary
        className="flex h-7 w-7 list-none items-center justify-center rounded-full border border-[#d3c0a2] bg-[#fff8ed] text-[11px] font-semibold text-[#7c5d2c] shadow-sm transition hover:bg-[#fff2dc]"
        aria-label={label}
        title={label}
      >
        ?
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-3xl border border-[#e7d8bf] bg-[#fffaf2] p-3 text-xs leading-5 text-[#6a5640] shadow-xl">
        <div className="mb-1 text-xs font-semibold text-[#3d3124]">{label}</div>
        <div>{children}</div>
      </div>
    </details>
  );
}

function testsLabel(count: number) {
  return `${count} тест${count === 1 ? "" : count < 5 ? "а" : "ов"}`;
}

function GoalDescriptionHint({ title, description }: { title: string; description: string }) {
  return (
    <details className="group relative shrink-0">
      <summary
        className="flex h-6 w-6 list-none items-center justify-center rounded-full border border-[#d3c0a2] bg-[#fff8ed] text-[10px] font-semibold text-[#7c5d2c] shadow-sm transition hover:bg-[#fff2dc]"
        aria-label={`Описание цели: ${title}`}
        title={`Описание цели: ${title}`}
      >
        ?
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-3xl border border-[#e7d8bf] bg-[#fffaf2] p-3 text-xs leading-5 text-[#6a5640] shadow-xl">
        <div className="mb-1 text-xs font-semibold text-[#3d3124]">{title}</div>
        <div>{description}</div>
      </div>
    </details>
  );
}

function ChoiceCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[20px] border px-3.5 py-3 text-left transition ${
        active
          ? "border-[#8eb792] bg-[#edf6ea] shadow-sm"
          : "border-[#e6d9c4] bg-[#fffdf8] hover:border-[#c9b492] hover:bg-[#fff8ee]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${active ? "text-[#2f4c32]" : "text-[#3d3124]"}`}>{title}</div>
        </div>
        <div className="flex items-center gap-2">
          <GoalDescriptionHint title={title} description={description} />
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? "bg-[#6ea374]" : "bg-[#d8cfc0]"}`} />
        </div>
      </div>
    </button>
  );
}

function CompetencyToggle({
  title,
  active,
  onToggle,
}: {
  title: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
        active
          ? "border-[#93be97] bg-[#edf6ea] text-[#2f4c32] shadow-sm"
          : "border-[#e5d7c4] bg-[#fffdf8] text-[#5f4f3f] hover:border-[#ccb18d] hover:bg-[#fff7eb]"
      }`}
    >
      <span
        className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[10px] font-semibold ${
          active ? "border-[#6ea374] bg-[#6ea374] text-white" : "border-[#c9c0b4] bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span>{title}</span>
    </button>
  );
}

function TestToggleRow({
  title,
  active,
  note,
  onToggle,
}: {
  title: string;
  active: boolean;
  note: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
        active
          ? "border-[#92bb97] bg-[#edf6ea] shadow-sm"
          : "border-[#e5d8c4] bg-[#fffdf8] hover:border-[#ccb18d] hover:bg-[#fff8ee]"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold ${
          active ? "border-[#6ea374] bg-[#6ea374] text-white" : "border-[#cbc1b3] bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[#3d3124]">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[#6a5640]">{note}</span>
      </span>
    </button>
  );
}

function summarizeReasonList(items: string[]) {
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} + ещё ${items.length - 2}`;
}

function sameSlugSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

export default function NewProjectPage({ tests }: NewProjectPageProps) {
  const { session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const initialGoal = router.query.goal;
  const allSlugs = useMemo(() => tests.map((item) => item.slug), [tests]);

  const [selectionMode, setSelectionMode] = useState<RoutingMode>("goal");
  const [goal, setGoal] = useState<AssessmentGoal>(isAssessmentGoal(initialGoal) ? initialGoal : "role_fit");
  const [workspaceName, setWorkspaceName] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [currentPosition, setCurrentPosition] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [competencyQuery, setCompetencyQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageBuilder, setPageBuilder] = useState<PageBuilderState>(DEFAULT_PAGE_BUILDER_STATE);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const canEditProjectCreateTemplate = (user?.email || "").toLowerCase() === PROJECT_CREATE_TEMPLATE_OWNER_EMAIL;
  const [builderGesture, setBuilderGesture] = useState<null | {
    target: "tablet" | "page";
    mode: "move" | "resize";
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startScale: number;
  }>(null);

  useEffect(() => {
    if (isAssessmentGoal(initialGoal)) {
      setGoal(initialGoal);
      setSelectionMode("goal");
    }
  }, [initialGoal]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || !user) {
      router.replace("/auth?next=%2Fprojects%2Fnew");
      return;
    }

    (async () => {
      const resp = await fetch("/api/commercial/workspace/bootstrap", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as Partial<WorkspacePayload> & { error?: string };
      if (resp.ok && json.ok && json.workspace) {
        setWorkspaceName(json.workspace.name);
      }
    })();
  }, [router, session, sessionLoading, user]);

  useEffect(() => {
    if (!session || typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch("/api/commercial/project-create-template", {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const json = await resp.json().catch(() => ({} as any));
        if (!cancelled && resp.ok && json?.ok && json?.template) {
          const parsed = json.template as Partial<PageBuilderState>;
          setPageBuilder((prev) => ({
            ...prev,
            ...parsed,
            builderOpen: prev.builderOpen,
          }));
        }
      } catch {}
      finally {
        if (!cancelled) setTemplateLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!canEditProjectCreateTemplate || !templateLoaded || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PAGE_BUILDER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PageBuilderState>;
      setPageBuilder((prev) => ({
        ...prev,
        ...parsed,
        builderOpen: Boolean(parsed.builderOpen),
      }));
    } catch {}
  }, [canEditProjectCreateTemplate, templateLoaded]);

  useEffect(() => {
    if (!canEditProjectCreateTemplate || !templateLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(PAGE_BUILDER_STORAGE_KEY, JSON.stringify(pageBuilder));
  }, [canEditProjectCreateTemplate, pageBuilder, templateLoaded]);

  const effectiveGoal = useMemo<AssessmentGoal>(() => {
    if (selectionMode === "goal") return goal;
    return getClosestGoalForCompetencies(selectedCompetencyIds) || "general_assessment";
  }, [goal, selectedCompetencyIds, selectionMode]);

  const effectiveGoalDefinition = useMemo(() => getGoalDefinition(effectiveGoal), [effectiveGoal]);
  const competencyReasonMap = useMemo(
    () => getCompetencyTestReasons(selectedCompetencyIds, allSlugs, "standard"),
    [allSlugs, selectedCompetencyIds]
  );
  const autoSelectedTests = useMemo(
    () =>
      selectionMode === "goal"
        ? getGoalRecommendedTests(goal, allSlugs)
        : getCompetencyRecommendedTests(selectedCompetencyIds, allSlugs, "standard"),
    [allSlugs, goal, selectedCompetencyIds, selectionMode]
  );
  const autoSelectedKey = useMemo(() => autoSelectedTests.join("|"), [autoSelectedTests]);

  useEffect(() => {
    setSelectedTests(autoSelectedTests);
  }, [autoSelectedKey]);

  const definition = useMemo(() => getGoalDefinition(goal), [goal]);
  const competencyGroups = useMemo(() => {
    const query = competencyQuery.trim().toLowerCase();
    return getCompetencyGroups()
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !query || item.name.toLowerCase().includes(query) || item.definition.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [competencyQuery]);
  const selectedCompetencySet = useMemo(() => new Set(selectedCompetencyIds), [selectedCompetencyIds]);
  const testMap = useMemo(() => new Map(tests.map((item) => [item.slug, item])), [tests]);
  const selectedTestCards = useMemo(
    () => selectedTests.map((slug) => testMap.get(slug) || { slug, title: getTestDisplayTitle(slug) }),
    [selectedTests, testMap]
  );
  const autoSelectedTestCards = useMemo(
    () => autoSelectedTests.map((slug) => testMap.get(slug) || { slug, title: getTestDisplayTitle(slug) }),
    [autoSelectedTests, testMap]
  );
  const hasCustomTestSelection = useMemo(() => !sameSlugSet(selectedTests, autoSelectedTests), [autoSelectedTests, selectedTests]);

  function toggleCompetency(id: string) {
    setSelectedCompetencyIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleTest(slug: string) {
    setSelectedTests((prev) => (prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]));
  }

  function restoreAutoSelected() {
    setSelectedTests(autoSelectedTests);
  }

  function updateBuilder<K extends keyof PageBuilderState>(key: K, value: PageBuilderState[K]) {
    setPageBuilder((prev) => ({ ...prev, [key]: value }));
  }

  function resetBuilder() {
    setPageBuilder((prev) => ({ ...DEFAULT_PAGE_BUILDER_STATE, builderOpen: prev.builderOpen }));
    setTemplateMessage("");
  }

  function startBuilderMove(target: "tablet" | "page", event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setBuilderGesture({
      target,
      mode: "move",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target === "tablet" ? pageBuilder.tabletX : pageBuilder.pageX,
      startY: target === "tablet" ? pageBuilder.tabletY : pageBuilder.pageY,
      startScale: target === "tablet" ? pageBuilder.tabletScale : pageBuilder.pageScale,
    });
  }

  function startBuilderResize(target: "tablet" | "page", event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setBuilderGesture({
      target,
      mode: "resize",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: target === "tablet" ? pageBuilder.tabletX : pageBuilder.pageX,
      startY: target === "tablet" ? pageBuilder.tabletY : pageBuilder.pageY,
      startScale: target === "tablet" ? pageBuilder.tabletScale : pageBuilder.pageScale,
    });
  }

  async function saveBuilderTemplate() {
    if (!session || !canEditProjectCreateTemplate) return;
    setTemplateSaving(true);
    setTemplateMessage("");
    try {
      const payload = {
        template: {
          tabletX: pageBuilder.tabletX,
          tabletY: pageBuilder.tabletY,
          tabletScale: pageBuilder.tabletScale,
          pageX: pageBuilder.pageX,
          pageY: pageBuilder.pageY,
          pageScale: pageBuilder.pageScale,
        },
      };
      const resp = await fetch("/api/commercial/project-create-template", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}` ,
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({} as any));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить шаблон");
      setTemplateMessage("Шаблон для всех сохранён.");
    } catch (err: any) {
      setTemplateMessage(err?.message || "Не удалось сохранить шаблон");
    } finally {
      setTemplateSaving(false);
    }
  }

  function testNote(slug: string) {
    if (selectionMode === "goal") {
      const weight = getGoalWeight(goal, slug);
      if (weight > 0) return `Автоподбор по цели «${definition?.shortTitle || "Цель"}": ${weight * 10}%`;
      return "Можно добавить вручную для уточнения профиля.";
    }
    const reasons = competencyReasonMap[slug] || [];
    if (reasons.length) return `Нужен для: ${summarizeReasonList(reasons)}.`;
    return "Можно добавить вручную, если нужен дополнительный контекст.";
  }

  useEffect(() => {
    if (!builderGesture) return;
    const gesture = builderGesture;

    function onMove(event: PointerEvent) {
      if (gesture.mode === "move") {
        const nextX = gesture.startX + (event.clientX - gesture.startClientX);
        const nextY = gesture.startY + (event.clientY - gesture.startClientY);
        if (gesture.target === "tablet") {
          setPageBuilder((prev) => ({ ...prev, tabletX: Math.round(nextX), tabletY: Math.round(nextY) }));
        } else {
          setPageBuilder((prev) => ({ ...prev, pageX: Math.round(nextX), pageY: Math.round(nextY) }));
        }
        return;
      }

      const delta = (event.clientX - gesture.startClientX + event.clientY - gesture.startClientY) / 420;
      const nextScale = gesture.target === "tablet"
        ? clamp(gesture.startScale + delta, 0.7, 1.45)
        : clamp(gesture.startScale + delta, 0.72, 1.35);

      if (gesture.target === "tablet") {
        setPageBuilder((prev) => ({ ...prev, tabletScale: Number(nextScale.toFixed(3)) }));
      } else {
        setPageBuilder((prev) => ({ ...prev, pageScale: Number(nextScale.toFixed(3)) }));
      }
    }

    function stop() {
      setBuilderGesture(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [builderGesture]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    if (selectionMode === "competency" && selectedCompetencyIds.length === 0) {
      setError("Выбери хотя бы одну компетенцию.");
      return;
    }

    if (selectedTests.length === 0) {
      setError("Выбери хотя бы один тест.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/commercial/projects/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          goal: effectiveGoal,
          selection_mode: selectionMode,
          selected_competency_ids: selectedCompetencyIds,
          package_mode: "basic",
          person_name: personName,
          person_email: personEmail,
          current_position: currentPosition,
          target_role: targetRole,
          notes,
          tests: selectedTests,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось создать проект");
      router.push(`/projects/${json.project_id}`);
    } catch (err: any) {
      setError(err?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  if (!session || !user) {
    return (
      <Layout title="Новый проект оценки">
        <div className="card text-sm text-slate-700">Переадресация на вход…</div>
      </Layout>
    );
  }

  const selectedCriteriaLabel =
    selectionMode === "goal" ? definition?.shortTitle || "Цель оценки" : getCompetencyLongLabel(selectedCompetencyIds);

  return (
    <Layout title="Новый проект оценки">
      <div className="mx-auto px-2 pb-6 pt-2 sm:px-4">
        <div className="relative mx-auto min-h-[calc(100vh-40px)] max-w-[1280px] overflow-visible">
          <div className="flex min-h-[calc(100vh-40px)] items-start justify-center overflow-visible pt-4">
            <div
              className="relative aspect-[2/3] bg-no-repeat bg-top bg-contain"
              style={{
                width: "min(100%, 1180px)",
                maxWidth: "calc(100vw - 32px)",
                backgroundImage: "url('/project-create-clipboard-photo.png')",
                transform: `translate(${pageBuilder.tabletX}px, ${pageBuilder.tabletY}px) scale(${pageBuilder.tabletScale})`,
                transformOrigin: "top center",
              }}
            >
              {canEditProjectCreateTemplate && pageBuilder.builderOpen ? (
                <>
                  <button
                    type="button"
                    onPointerDown={(event) => startBuilderMove("tablet", event)}
                    className="absolute left-[3%] top-[4%] z-30 inline-flex items-center rounded-full border border-[#d6bea0] bg-[rgba(255,248,236,0.94)] px-3 py-1.5 text-[11px] font-semibold text-[#6a4e2f] shadow-sm cursor-move"
                  >
                    Тянуть планшет
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => startBuilderResize("tablet", event)}
                    className="absolute bottom-[5%] right-[7%] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[#d6bea0] bg-[rgba(255,248,236,0.94)] text-lg text-[#6a4e2f] shadow-sm cursor-nwse-resize"
                    aria-label="Изменить размер планшета"
                    title="Изменить размер планшета"
                  >
                    ↘
                  </button>
                </>
              ) : null}
              <div
                className="absolute left-[11.2%] top-[11.2%] h-[79.8%] w-[77.6%] overflow-y-auto rounded-[24px] px-[2.8%] pb-[3.2%] pt-[2.8%] [scrollbar-width:thin]"
                style={{
                  transform: `translate(${pageBuilder.pageX}px, ${pageBuilder.pageY}px) scale(${pageBuilder.pageScale})`,
                  transformOrigin: "top center",
                }}
              >
                {canEditProjectCreateTemplate && pageBuilder.builderOpen ? (
                  <>
                    <button
                      type="button"
                      onPointerDown={(event) => startBuilderMove("page", event)}
                      className="sticky left-2 top-2 z-20 inline-flex items-center rounded-full border border-[#d6bea0] bg-[rgba(255,248,236,0.96)] px-3 py-1 text-[11px] font-semibold text-[#6a4e2f] shadow-sm cursor-move"
                    >
                      Тянуть лист
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => startBuilderResize("page", event)}
                      className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#d6bea0] bg-[rgba(255,248,236,0.96)] text-lg text-[#6a4e2f] shadow-sm cursor-nwse-resize"
                      aria-label="Изменить размер листа"
                      title="Изменить размер листа"
                    >
                      ↘
                    </button>
                  </>
                ) : null}
            <div className="relative overflow-hidden rounded-[28px] border border-[rgba(172,140,101,0.24)] bg-[rgba(255,251,245,0.68)] px-3 pb-4 pt-5 shadow-[0_18px_40px_rgba(92,67,38,0.06)] backdrop-blur-[1px] sm:px-5 sm:pb-5 sm:pt-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.78),rgba(255,255,255,0)_30%),linear-gradient(90deg,rgba(180,142,101,0.045)_1px,transparent_1px),linear-gradient(rgba(180,142,101,0.045)_1px,transparent_1px)] [background-size:auto,100%_100%,100%_34px] opacity-55" />
              <div className="relative">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8a6a46]">Лист проекта</div>
                  <h1 className="mt-2.5 text-[24px] font-semibold tracking-[0.01em] text-[#31492f] sm:text-[28px]">Новый проект оценки</h1>
                  <div className="mt-2 text-sm text-[#6a5640]">
                    {workspaceName ? `Рабочее пространство: ${workspaceName}` : "Подготавливаем рабочее пространство…"}
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-[38px] items-center rounded-full border border-[#d9c2a0] bg-[#fff8ec] px-3.5 py-1.5 text-sm font-medium text-[#5d4830] shadow-sm transition hover:bg-[#fff3df]"
                >
                  Назад в кабинет
                </Link>
              </div>

              {canEditProjectCreateTemplate ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-[#eadbc4] bg-[rgba(255,252,246,0.88)] px-3 py-2.5 shadow-[0_8px_18px_rgba(98,73,41,0.04)]">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6a46]">Конструктор посадки</div>
                      <div className="mt-1 text-[12px] text-[#7a6750]">Доступен только для профиля {PROJECT_CREATE_TEMPLATE_OWNER_EMAIL}.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateBuilder("builderOpen", !pageBuilder.builderOpen)}
                        className="inline-flex min-h-[34px] items-center rounded-full border border-[#d6bea0] bg-[#fff8ec] px-3 py-1.5 text-xs font-medium text-[#5d4830] shadow-sm transition hover:bg-[#fff2df]"
                      >
                        {pageBuilder.builderOpen ? "Скрыть конструктор" : "Открыть конструктор"}
                      </button>
                      <button
                        type="button"
                        onClick={resetBuilder}
                        className="inline-flex min-h-[34px] items-center rounded-full border border-[#d6bea0] bg-[#fff8ec] px-3 py-1.5 text-xs font-medium text-[#5d4830] shadow-sm transition hover:bg-[#fff2df]"
                      >
                        Сбросить
                      </button>
                      <button
                        type="button"
                        onClick={saveBuilderTemplate}
                        disabled={templateSaving}
                        className="inline-flex min-h-[34px] items-center rounded-full border border-[#8fb494] bg-[#e7f3e5] px-3 py-1.5 text-xs font-semibold text-[#315437] shadow-sm transition hover:bg-[#d9eed7] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {templateSaving ? "Сохраняем…" : "Сохранить как шаблон для всех"}
                      </button>
                    </div>
                  </div>

                  {pageBuilder.builderOpen ? (
                    <div className="mb-4 rounded-[20px] border border-[#eadbc4] bg-[rgba(255,252,246,0.92)] p-3 shadow-[0_8px_18px_rgba(98,73,41,0.04)]">
                      <div className="text-sm font-medium text-[#5d4830]">Тяни метки на самом планшете: «Тянуть планшет», «Тянуть лист» и круглый маркер ↘ для изменения размера.</div>
                      <div className="mt-2 text-xs text-[#7a6750]">Черновик посадки сохраняется локально у тебя в браузере. После нажатия «Сохранить как шаблон для всех» этот шаблон увидят остальные.</div>
                      {templateMessage ? <div className="mt-3 text-sm font-medium text-[#315437]">{templateMessage}</div> : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              <form onSubmit={onSubmit} className="grid gap-3.5">
                <section className="rounded-[24px] border border-[#eadbc4] bg-[rgba(255,252,246,0.88)] p-3.5 shadow-[0_10px_22px_rgba(98,73,41,0.05)] sm:p-4.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[18px] font-semibold text-[#3d3124]">Шаг 1. Личная информация клиента</div>
                      <div className="mt-1 text-[13px] leading-5 text-[#6b5843]">
                        Заполни только базовые данные. Этого достаточно, чтобы сразу создать проект и выдать ссылку человеку.
                      </div>
                    </div>
                    <InfoHint label="Что обязательно на этом шаге?">
                      Обязательно только имя. Остальное можно заполнить коротко: почта, текущая должность, целевая роль и контекст запроса.
                    </InfoHint>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium text-[#6c563b]">Имя и фамилия</span>
                      <input
                        className="h-11 rounded-[16px] border border-[#dfcfba] bg-[#fffdf8] px-4 text-[15px] text-[#3d3124] outline-none transition placeholder:text-[#b8aa97] focus:border-[#c9ab7f] focus:ring-2 focus:ring-[#ecd6af]"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        placeholder="Например: Иван Петров"
                        required
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium text-[#6c563b]">Email</span>
                      <input
                        className="h-11 rounded-[16px] border border-[#dfcfba] bg-[#fffdf8] px-4 text-[15px] text-[#3d3124] outline-none transition placeholder:text-[#b8aa97] focus:border-[#c9ab7f] focus:ring-2 focus:ring-[#ecd6af]"
                        type="email"
                        value={personEmail}
                        onChange={(e) => setPersonEmail(e.target.value)}
                        placeholder="candidate@example.com"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium text-[#6c563b]">Текущая должность</span>
                      <input
                        className="h-11 rounded-[16px] border border-[#dfcfba] bg-[#fffdf8] px-4 text-[15px] text-[#3d3124] outline-none transition placeholder:text-[#b8aa97] focus:border-[#c9ab7f] focus:ring-2 focus:ring-[#ecd6af]"
                        value={currentPosition}
                        onChange={(e) => setCurrentPosition(e.target.value)}
                        placeholder="Например: менеджер по продажам"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-sm font-medium text-[#6c563b]">Целевая роль</span>
                      <input
                        className="h-11 rounded-[16px] border border-[#dfcfba] bg-[#fffdf8] px-4 text-[15px] text-[#3d3124] outline-none transition placeholder:text-[#b8aa97] focus:border-[#c9ab7f] focus:ring-2 focus:ring-[#ecd6af]"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        placeholder="Например: руководитель группы"
                      />
                    </label>
                    <label className="grid gap-1.5 md:col-span-2">
                      <span className="text-sm font-medium text-[#6c563b]">Комментарий специалиста</span>
                      <textarea
                        className="min-h-[92px] rounded-[16px] border border-[#dfcfba] bg-[#fffdf8] px-4 py-3 text-[15px] text-[#3d3124] outline-none transition placeholder:text-[#b8aa97] focus:border-[#c9ab7f] focus:ring-2 focus:ring-[#ecd6af]"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Коротко опиши контекст оценки, задачу руководителя или риски, которые важно проверить."
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#eadbc4] bg-[rgba(255,252,246,0.88)] p-3.5 shadow-[0_10px_22px_rgba(98,73,41,0.05)] sm:p-4.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[18px] font-semibold text-[#3d3124]">Шаг 2. Что проверяем</div>
                      <div className="mt-1 text-[13px] leading-5 text-[#6b5843]">
                        Можно идти от текущих целей оценки или от конкретных компетенций. Набор тестов система подберёт сама.
                      </div>
                    </div>
                    <InfoHint label="Как выбирать режим?">
                      Если нужен привычный сценарий — выбери цель. Если нужна точечная проверка, выбери одну или несколько компетенций, а система соберёт общий набор тестов.
                    </InfoHint>
                  </div>

                  <div className="mt-4 inline-flex rounded-full border border-[#dcc8ab] bg-[#fff8ee] p-1.5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setSelectionMode("goal")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        selectionMode === "goal" ? "bg-[#f0dcc1] text-[#4e3b25] shadow-sm" : "text-[#7b6650]"
                      }`}
                    >
                      По текущей цели
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectionMode("competency")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        selectionMode === "competency" ? "bg-[#f0dcc1] text-[#4e3b25] shadow-sm" : "text-[#7b6650]"
                      }`}
                    >
                      По компетенциям
                    </button>
                  </div>

                  {selectionMode === "goal" ? (
                    <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
                      {COMMERCIAL_GOALS.map((item) => (
                        <ChoiceCard
                          key={item.key}
                          active={item.key === goal}
                          title={item.shortTitle}
                          description={item.description}
                          onClick={() => setGoal(item.key)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-[22px] border border-[#e7d8c0] bg-[#fff7eb] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-[#3d3124]">Выбери одну или несколько компетенций</div>
                            <div className="mt-1 text-[13px] leading-5 text-[#6b5843]">
                              Система объединит маршруты и предложит стандартный набор тестов по выбранным компетенциям.
                            </div>
                          </div>
                          <input
                            className="h-10 min-w-[220px] max-w-[300px] rounded-[16px] border border-[#dfcfba] bg-[#fffdf8] px-4 text-[15px] text-[#3d3124] outline-none transition placeholder:text-[#b8aa97] focus:border-[#c9ab7f] focus:ring-2 focus:ring-[#ecd6af]"
                            value={competencyQuery}
                            onChange={(e) => setCompetencyQuery(e.target.value)}
                            placeholder="Найти компетенцию"
                          />
                        </div>
                      </div>

                      {selectedCompetencyIds.length ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedCompetencyIds.map((id) => {
                            const groups = getCompetencyGroups();
                            const match = groups.flatMap((group) => group.items).find((item) => item.id === id);
                            if (!match) return null;
                            return (
                              <span
                                key={id}
                                className="rounded-full border border-[#9ac09d] bg-[#edf6ea] px-3 py-1 text-xs font-medium text-[#2f4c32]"
                              >
                                {match.name}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="grid gap-3">
                        {competencyGroups.map((group) => {
                          const selectedCount = group.items.filter((item) => selectedCompetencySet.has(item.id)).length;
                          return (
                            <details
                              key={group.cluster}
                              className="rounded-[20px] border border-[#e7d8c0] bg-[#fffdf8] p-3"
                              open={selectedCount > 0 || Boolean(competencyQuery)}
                            >
                              <summary className="cursor-pointer list-none text-sm font-semibold text-[#3d3124]">
                                <div className="flex items-center justify-between gap-3">
                                  <span>{group.cluster}</span>
                                  <span className="rounded-full border border-[#e6d8c4] bg-[#fff7eb] px-2.5 py-1 text-[11px] font-semibold text-[#7b6650]">
                                    {selectedCount ? `${selectedCount} выбрано` : `${group.items.length} вариантов`}
                                  </span>
                                </div>
                              </summary>
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {group.items.map((item) => (
                                  <CompetencyToggle
                                    key={item.id}
                                    title={item.name}
                                    active={selectedCompetencySet.has(item.id)}
                                    onToggle={() => toggleCompetency(item.id)}
                                  />
                                ))}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="rounded-[22px] border border-[#a8d1a7] bg-[#edf6ea] p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[15px] font-semibold text-[#2f4c32]">Набор тестов подобран автоматически</div>
                          <div className="mt-1 text-[13px] leading-5 text-[#507154]">
                            {selectionMode === "goal"
                              ? "Это рекомендуемый набор под выбранную цель."
                              : "Это стандартный маршрут по выбранным компетенциям. При необходимости его можно скорректировать вручную."}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasCustomTestSelection ? (
                            <span className="rounded-full border border-[#ebcf93] bg-[#fff6dc] px-3 py-1 text-[11px] font-semibold text-[#886428]">
                              Набор изменён вручную
                            </span>
                          ) : null}
                          <span className="rounded-full border border-[#9ac09d] bg-[#fffdf8] px-3 py-1 text-[11px] font-semibold text-[#2f4c32]">
                            {testsLabel(selectedTestCards.length)}
                          </span>
                        </div>
                      </div>

                      {selectionMode === "competency" && selectedCompetencyIds.length === 0 ? (
                        <div className="mt-3 rounded-[18px] border border-dashed border-[#c9c0b1] bg-[#fffdf8] px-3.5 py-3 text-[13px] text-[#7b6650]">
                          Сначала выбери хотя бы одну компетенцию — после этого система сразу соберёт набор тестов.
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {autoSelectedTestCards.map((test) => (
                              <span
                                key={test.slug}
                                className="rounded-full border border-[#9ac09d] bg-[#fffdf8] px-3 py-1 text-xs font-medium text-[#2f4c32]"
                              >
                                {test.title}
                              </span>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditorOpen((prev) => !prev)}
                              className="inline-flex min-h-[40px] items-center rounded-full border border-[#d6bea0] bg-[#fff8ec] px-4 py-2 text-sm font-medium text-[#5d4830] shadow-sm transition hover:bg-[#fff2df]"
                            >
                              {editorOpen ? "Скрыть редактор набора" : "Редактировать набор тестов"}
                            </button>
                            <button
                              type="button"
                              onClick={restoreAutoSelected}
                              className="inline-flex min-h-[40px] items-center rounded-full border border-[#d6bea0] bg-[#fff8ec] px-4 py-2 text-sm font-medium text-[#5d4830] shadow-sm transition hover:bg-[#fff2df] disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!autoSelectedTests.length}
                            >
                              Вернуть автоподбор
                            </button>
                          </div>
                        </>
                      )}

                      {editorOpen ? (
                        <div className="mt-3 grid gap-2 xl:grid-cols-2">
                          {tests.map((test) => (
                            <TestToggleRow
                              key={test.slug}
                              title={test.title}
                              active={selectedTests.includes(test.slug)}
                              note={testNote(test.slug)}
                              onToggle={() => toggleTest(test.slug)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-[#eadbc4] bg-[rgba(255,252,246,0.88)] p-3.5 shadow-[0_10px_22px_rgba(98,73,41,0.05)] sm:p-4.5">
                  <div className="flex flex-col items-center gap-3 text-center">
                    {error ? (
                      <div className="w-full max-w-3xl rounded-[20px] border border-[#efc7b6] bg-[#fff1ea] px-4 py-3 text-sm text-[#9a4d31]">{error}</div>
                    ) : (
                      <div className="max-w-3xl text-sm leading-6 text-[#6b5843]">
                        После создания сразу появится ссылка и QR-код для клиента. Если нужно, состав тестов можно подправить перед созданием проекта.
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loading || !selectedTests.length || (selectionMode === "competency" && selectedCompetencyIds.length === 0)}
                      className="inline-flex min-h-[48px] min-w-[240px] items-center justify-center rounded-[18px] border border-[#88b88d] bg-[linear-gradient(180deg,#cfe9c9_0%,#b6ddb0_100%)] px-8 py-3 text-base font-semibold text-[#2f4c32] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_18px_rgba(76,128,82,0.18)] transition hover:brightness-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Создаём проект…" : "Создать проект"}
                    </button>
                  </div>
                </section>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const tests = await getAllTests();
  return {
    props: {
      tests: tests.map((test) => ({ slug: test.slug, title: getTestDisplayTitle(test.slug, test.title) })),
    },
  };
}
