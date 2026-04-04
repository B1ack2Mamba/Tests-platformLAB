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
  getCompetencyShortLabel,
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

function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group relative">
      <summary
        className="flex h-6 w-6 list-none items-center justify-center rounded-full border border-emerald-200 bg-white text-[11px] font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
        aria-label={label}
        title={label}
      >
        ?
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-emerald-100 bg-white/98 p-3 text-xs leading-5 text-slate-600 shadow-xl backdrop-blur-sm">
        <div className="mb-1 text-xs font-semibold text-slate-900">{label}</div>
        <div>{children}</div>
      </div>
    </details>
  );
}

function testsLabel(count: number) {
  return `${count} тест${count === 1 ? "" : count < 5 ? "а" : "ов"}`;
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
      className={`rounded-3xl border px-4 py-4 text-left transition ${
        active ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${active ? "text-emerald-950" : "text-slate-900"}`}>{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-600">{description}</div>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-slate-200"}`} />
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
        active ? "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
      }`}
    >
      <span
        className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border text-[10px] font-semibold ${
          active ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"
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
      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        active ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold ${
          active ? "border-emerald-400 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{note}</span>
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
    () => selectionMode === "goal"
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
        items: group.items.filter((item) => !query || item.name.toLowerCase().includes(query) || item.definition.toLowerCase().includes(query)),
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
  const hasCustomTestSelection = useMemo(
    () => !sameSlugSet(selectedTests, autoSelectedTests),
    [autoSelectedTests, selectedTests]
  );

  function toggleCompetency(id: string) {
    setSelectedCompetencyIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  function toggleTest(slug: string) {
    setSelectedTests((prev) => prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]);
  }

  function restoreAutoSelected() {
    setSelectedTests(autoSelectedTests);
  }

  function testNote(slug: string) {
    if (selectionMode === "goal") {
      const weight = getGoalWeight(goal, slug);
      if (weight > 0) return `Автоподбор по цели «${definition?.shortTitle || "Цель"}»: ${weight * 10}%`;
      return "Можно добавить вручную для уточнения профиля.";
    }
    const reasons = competencyReasonMap[slug] || [];
    if (reasons.length) return `Нужен для: ${summarizeReasonList(reasons)}.`;
    return "Можно добавить вручную, если нужен дополнительный контекст.";
  }

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

  const selectedCriteriaLabel = selectionMode === "goal"
    ? definition?.shortTitle || "Цель оценки"
    : getCompetencyLongLabel(selectedCompetencyIds);

  return (
    <Layout title="Новый проект оценки">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {workspaceName ? `Рабочее пространство: ${workspaceName}` : "Подготавливаем рабочее пространство…"}
        </div>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">Назад в кабинет</Link>
      </div>

      <form onSubmit={onSubmit} className="mx-auto grid max-w-5xl gap-4">
        <section className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Шаг 1. Личная информация клиента</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Заполни только базовые данные. Этого достаточно, чтобы сразу создать проект и выдать ссылку человеку.
              </div>
            </div>
            <InfoHint label="Что обязательно на этом шаге?">
              Обязательно только имя. Остальное можно заполнить коротко: почта, текущая должность, целевая роль и контекст запроса.
            </InfoHint>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 md:col-span-2 xl:col-span-2">
              <span className="text-xs text-slate-600">Имя и фамилия</span>
              <input className="input" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Например: Иван Петров" required />
            </label>
            <label className="grid gap-1 md:col-span-2 xl:col-span-2">
              <span className="text-xs text-slate-600">Email</span>
              <input className="input" type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} placeholder="candidate@example.com" />
            </label>
            <label className="grid gap-1 md:col-span-1 xl:col-span-2">
              <span className="text-xs text-slate-600">Текущая должность</span>
              <input className="input" value={currentPosition} onChange={(e) => setCurrentPosition(e.target.value)} placeholder="Например: менеджер по продажам" />
            </label>
            <label className="grid gap-1 md:col-span-1 xl:col-span-2">
              <span className="text-xs text-slate-600">Целевая роль</span>
              <input className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Например: руководитель группы" />
            </label>
            <label className="grid gap-1 md:col-span-2 xl:col-span-4">
              <span className="text-xs text-slate-600">Комментарий специалиста</span>
              <textarea className="input min-h-[96px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Коротко опиши контекст оценки, задачу руководителя или риски, которые важно проверить." />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Шаг 2. Что проверяем</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                Можно идти от текущих целей оценки или от конкретных компетенций. Набор тестов система подберёт сама.
              </div>
            </div>
            <InfoHint label="Как выбирать режим?">
              Если нужен привычный сценарий — выбери цель. Если нужна точечная проверка, выбери одну или несколько компетенций, а система соберёт общий набор тестов.
            </InfoHint>
          </div>

          <div className="mt-4 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setSelectionMode("goal")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${selectionMode === "goal" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
            >
              По текущей цели
            </button>
            <button
              type="button"
              onClick={() => setSelectionMode("competency")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${selectionMode === "competency" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
            >
              По компетенциям
            </button>
          </div>

          {selectionMode === "goal" ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
            <div className="mt-4 grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Выбери одну или несколько компетенций</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">Система объединит маршруты и предложит стандартный набор тестов по выбранным компетенциям.</div>
                  </div>
                  <input
                    className="input h-10 min-w-[240px] max-w-[320px]"
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
                      <span key={id} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
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
                    <details key={group.cluster} className="rounded-3xl border border-slate-200 bg-white p-4" open={selectedCount > 0 || Boolean(competencyQuery)}>
                      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                        <div className="flex items-center justify-between gap-3">
                          <span>{group.cluster}</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {selectedCount ? `${selectedCount} выбрано` : `${group.items.length} вариантов`}
                          </span>
                        </div>
                      </summary>
                      <div className="mt-3 flex flex-wrap gap-2">
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

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Набор тестов подобран автоматически</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {selectionMode === "goal"
                      ? "Это рекомендуемый набор под выбранную цель."
                      : "Это стандартный маршрут по выбранным компетенциям. При необходимости его можно скорректировать вручную."}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasCustomTestSelection ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
                      Набор изменён вручную
                    </span>
                  ) : null}
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800">
                    {testsLabel(selectedTestCards.length)}
                  </span>
                </div>
              </div>

              {selectionMode === "competency" && selectedCompetencyIds.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/85 px-4 py-4 text-sm text-slate-500">
                  Сначала выбери хотя бы одну компетенцию — после этого система сразу соберёт набор тестов.
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {autoSelectedTestCards.map((test) => (
                      <span key={test.slug} className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-900">
                        {test.title}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setEditorOpen((prev) => !prev)} className="btn btn-secondary btn-sm">
                      {editorOpen ? "Скрыть редактор набора" : "Редактировать набор тестов"}
                    </button>
                    <button type="button" onClick={restoreAutoSelected} className="btn btn-secondary btn-sm" disabled={!autoSelectedTests.length}>
                      Вернуть автоподбор
                    </button>
                  </div>
                </>
              )}

              {editorOpen ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
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

            <aside className="rounded-3xl border border-slate-200 bg-white p-4 xl:sticky xl:top-4">
              <div className="text-sm font-semibold text-slate-900">Краткая сводка проекта</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {selectionMode === "goal" ? "Режим: цель" : "Режим: компетенции"}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                  {testsLabel(selectedTestCards.length)}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-sm leading-6 text-slate-700">
                <div><span className="font-medium text-slate-900">Клиент:</span> {personName.trim() || "ещё не заполнен"}</div>
                <div className="mt-1"><span className="font-medium text-slate-900">Роль:</span> {targetRole.trim() || currentPosition.trim() || "не указана"}</div>
                <div className="mt-1"><span className="font-medium text-slate-900">Логика подбора:</span> {selectedCriteriaLabel}</div>
                {selectionMode === "competency" ? (
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    Внутри системы проект будет опираться на цель «{effectiveGoalDefinition?.shortTitle || effectiveGoal}».
                  </div>
                ) : null}
              </div>

              {selectedTests.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                  Выбери хотя бы один тест.
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : (
              <div className="text-xs leading-5 text-slate-500">
                После создания сразу появится ссылка и QR-код для клиента. Если нужно, состав тестов можно подправить перед созданием проекта.
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !selectedTests.length || (selectionMode === "competency" && selectedCompetencyIds.length === 0)}
              className="btn btn-primary min-w-[220px]"
            >
              {loading ? "Создаём проект…" : "Создать проект"}
            </button>
          </div>
        </section>
      </form>
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
