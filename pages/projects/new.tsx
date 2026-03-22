import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import {
  COMMERCIAL_GOALS,
  getGoalAdditionalTests,
  getGoalDefinition,
  getGoalRecommendedTests,
  getGoalWeight,
  isAssessmentGoal,
  type AssessmentGoal,
} from "@/lib/commercialGoals";
import { getAllTests } from "@/lib/loadTests";
import type { AnyTest } from "@/lib/testTypes";

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
        <span className="mt-1 block text-xs text-slate-500">{note}</span>
      </span>
    </button>
  );
}

export default function NewProjectPage({ tests }: NewProjectPageProps) {
  const { session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const initialGoal = router.query.goal;
  const allSlugs = useMemo(() => tests.map((item) => item.slug), [tests]);

  const [goal, setGoal] = useState<AssessmentGoal>(isAssessmentGoal(initialGoal) ? initialGoal : "role_fit");
  const [workspaceName, setWorkspaceName] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [currentPosition, setCurrentPosition] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>(() => getGoalRecommendedTests("role_fit", allSlugs));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAssessmentGoal(initialGoal)) setGoal(initialGoal);
  }, [initialGoal]);

  useEffect(() => {
    setSelectedTests(getGoalRecommendedTests(goal, allSlugs));
  }, [allSlugs, goal]);

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

  const definition = useMemo(() => getGoalDefinition(goal), [goal]);
  const recommendedSlugs = useMemo(() => getGoalRecommendedTests(goal, allSlugs), [allSlugs, goal]);
  const additionalSlugs = useMemo(() => getGoalAdditionalTests(goal, allSlugs), [allSlugs, goal]);
  const recommendedTestSet = useMemo(() => new Set(recommendedSlugs), [recommendedSlugs]);
  const selectedTestCards = useMemo(
    () => selectedTests.map((slug) => tests.find((item) => item.slug === slug) || { slug, title: slug }),
    [selectedTests, tests]
  );
  const recommendedTests = useMemo(
    () => recommendedSlugs.map((slug) => tests.find((item) => item.slug === slug)).filter(Boolean) as Pick<AnyTest, "slug" | "title">[],
    [recommendedSlugs, tests]
  );
  const additionalTests = useMemo(
    () => additionalSlugs.map((slug) => tests.find((item) => item.slug === slug)).filter(Boolean) as Pick<AnyTest, "slug" | "title">[],
    [additionalSlugs, tests]
  );
  const selectedRecommendedCount = useMemo(
    () => selectedTests.filter((slug) => recommendedTestSet.has(slug)).length,
    [recommendedTestSet, selectedTests]
  );

  function toggleTest(slug: string) {
    setSelectedTests((prev) => (prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]));
  }

  function restoreRecommended() {
    setSelectedTests(getGoalRecommendedTests(goal, allSlugs));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
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
          goal,
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

  return (
    <Layout title="Новый проект оценки">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {workspaceName ? `Рабочее пространство: ${workspaceName}` : "Подготавливаем рабочее пространство…"}
        </div>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">Назад в кабинет</Link>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
        <aside className="card xl:sticky xl:top-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Шаг 1. Цель оценки</div>
              <div className="mt-1 text-xs text-slate-500">Компактный список без визуального мусора. Сверху — только выбор логики.</div>
            </div>
            <InfoHint label="Как работает цель оценки?">
              Цель нужна как стартовая логика рекомендаций. Финальный набор тестов ниже можно собрать вручную.
            </InfoHint>
          </div>

          <div className="mt-4 grid gap-1.5">
            {COMMERCIAL_GOALS.map((item) => {
              const active = item.key === goal;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setGoal(item.key)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    active ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <span className={`font-medium ${active ? "text-emerald-950" : "text-slate-800"}`}>{item.shortTitle}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-200"}`} />
                </button>
              );
            })}
          </div>

          {definition ? (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Активная цель</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{definition.shortTitle}</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">{definition.description}</div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600">
                {definition.outcomes.slice(0, 3).map((item) => (
                  <div key={item}>• {item}</div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="grid gap-4">
          <section className="card">
            <div className="text-sm font-semibold text-slate-900">Шаг 2. Кого оцениваем</div>
            <div className="mt-1 text-xs text-slate-500">Короткая плотная карточка без лишней толщины. Всё нужное видно в два ряда.</div>

            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs text-slate-600">Имя и фамилия</span>
                <input className="input" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Например: Иван Петров" required />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-600">Email</span>
                <input className="input" type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} placeholder="candidate@example.com" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-slate-600">Текущая должность</span>
                <input className="input" value={currentPosition} onChange={(e) => setCurrentPosition(e.target.value)} placeholder="Например: менеджер по продажам" />
              </label>
              <label className="grid gap-1 xl:col-span-1">
                <span className="text-xs text-slate-600">Целевая роль</span>
                <input className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Например: руководитель группы" />
              </label>
              <label className="grid gap-1 xl:col-span-2">
                <span className="text-xs text-slate-600">Комментарий специалиста</span>
                <textarea className="input min-h-[88px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Коротко опиши контекст оценки, риски или задачу руководителя." />
              </label>
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Шаг 3. Набор тестов</div>
                <div className="mt-1 text-xs text-slate-500">Главное рабочее поле: ядро рекомендаций, дополнительные тесты и итог проекта — сразу на одном экране.</div>
              </div>
              <div className="flex items-center gap-2">
                <InfoHint label="Как работает рекомендация?">
                  Мы считаем цель стартовой логикой, а не жёсткой клеткой. Ядро берётся по весам, соседние тесты можно добавить вручную.
                </InfoHint>
                <button type="button" onClick={restoreRecommended} className="btn btn-secondary btn-sm">Вернуть ядро</button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
              <div className="grid gap-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/55 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Рекомендуется</div>
                        <div className="mt-1 text-sm text-slate-600">Основное ядро под выбранную цель.</div>
                      </div>
                      <div className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                        {selectedRecommendedCount}/{recommendedTests.length}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {recommendedTests.map((test) => (
                        <TestToggleRow
                          key={test.slug}
                          title={test.title}
                          active={selectedTests.includes(test.slug)}
                          note={`Вес для цели: ${getGoalWeight(goal, test.slug)}/10`}
                          onToggle={() => toggleTest(test.slug)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Можно добавить</div>
                        <div className="mt-1 text-sm text-slate-600">Соседние инструменты, которые усиливают картину.</div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {additionalTests.length}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {additionalTests.map((test) => (
                        <TestToggleRow
                          key={test.slug}
                          title={test.title}
                          active={selectedTests.includes(test.slug)}
                          note={`Дополняет цель с весом ${getGoalWeight(goal, test.slug)}/10`}
                          onToggle={() => toggleTest(test.slug)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 h-fit xl:sticky xl:top-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Итог проекта</div>
                    <div className="mt-1 text-xs text-slate-500">Короткая сводка до создания ссылки и QR.</div>
                  </div>
                  <InfoHint label="Что войдёт в проект?">
                    После создания сразу появятся ссылка и QR-код для сотрудника. Результаты увидит только специалист.
                  </InfoHint>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">
                    {definition?.shortTitle}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">
                    {testsLabel(selectedTestCards.length)}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 p-3 text-sm leading-6 text-slate-600">
                  <div><span className="font-medium text-slate-900">Участник:</span> {personName.trim() || "ещё не заполнен"}</div>
                  <div className="mt-1"><span className="font-medium text-slate-900">Роль:</span> {targetRole.trim() || currentPosition.trim() || "не указана"}</div>
                  <div className="mt-2 text-xs text-slate-500">Ссылка и QR появятся сразу после создания проекта.</div>
                </div>

                {selectedTestCards.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                    Выбери хотя бы один тест.
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium text-slate-900">
                    Выбрано
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {selectedTestCards.length}
                    </span>
                  </div>
                  <div className="grid max-h-[360px] gap-2 overflow-auto pr-1">
                    {selectedTestCards.length ? selectedTestCards.map((test) => (
                      <button
                        key={test.slug}
                        type="button"
                        onClick={() => toggleTest(test.slug)}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white/95 px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-200"
                      >
                        <span className="min-w-0 flex-1">{test.title}</span>
                        <span className="text-xs text-emerald-700">Убрать</span>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/80 px-3 py-3 text-sm text-slate-500">
                        Пока пусто. Собери финальный набор слева.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : (
                <div className="text-xs text-slate-500">Сначала выбери цель, потом собери набор тестов и заполни карточку участника. Дальше — создание проекта.</div>
              )}
              <button type="submit" disabled={loading || !selectedTestCards.length} className="btn btn-primary min-w-[220px]">
                {loading ? "Создаём проект…" : "Создать проект"}
              </button>
            </div>
          </section>
        </div>
      </form>
    </Layout>
  );
}

export async function getServerSideProps() {
  const tests = await getAllTests();
  return {
    props: {
      tests: tests.map((test) => ({ slug: test.slug, title: test.title })),
    },
  };
}
