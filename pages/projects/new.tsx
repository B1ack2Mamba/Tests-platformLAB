import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import {
  COMMERCIAL_GOALS,
  getGoalDefinition,
  getGoalRecommendedTests,
  type AssessmentGoal
} from "@/lib/commercialGoals";
import { getAllTests } from "@/lib/loadTests";
import type { AnyTest } from "@/lib/testTypes";

type WorkspacePayload = {
  ok: true;
  workspace: { workspace_id: string; role: string; name: string };
};

type NewProjectPageProps = { tests: Pick<AnyTest, "slug" | "title">[] };

function isGoal(value: unknown): value is AssessmentGoal {
  return value === "role_fit" || value === "general_assessment" || value === "motivation";
}

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

export default function NewProjectPage({ tests }: NewProjectPageProps) {
  const { session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const initialGoal = router.query.goal;

  const [goal, setGoal] = useState<AssessmentGoal>(isGoal(initialGoal) ? initialGoal : "role_fit");
  const [workspaceName, setWorkspaceName] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [currentPosition, setCurrentPosition] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>(() => getGoalRecommendedTests("role_fit"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isGoal(initialGoal)) setGoal(initialGoal);
  }, [initialGoal]);

  useEffect(() => {
    setSelectedTests(getGoalRecommendedTests(goal));
  }, [goal]);

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
  const recommendedTestSet = useMemo(() => new Set(definition?.recommended || []), [definition]);
  const selectedTestCards = useMemo(
    () => selectedTests.map((slug) => tests.find((item) => item.slug === slug) || { slug, title: slug }),
    [selectedTests, tests]
  );
  const optionalTests = useMemo(() => tests.filter((test) => !recommendedTestSet.has(test.slug)), [recommendedTestSet, tests]);

  function toggleTest(slug: string) {
    setSelectedTests((prev) => (prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]));
  }

  function restoreRecommended() {
    setSelectedTests(getGoalRecommendedTests(goal));
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
        <div className="text-sm text-slate-600">{workspaceName ? `Рабочее пространство: ${workspaceName}` : "Подготавливаем рабочее пространство…"}</div>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">Назад в кабинет</Link>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Шаг 1. Цель оценки</div>
              <div className="mt-1 text-xs text-slate-500">Выбери задачу. Она нужна только как стартовая логика подбора тестов.</div>
            </div>
            <InfoHint label="Как работает цель оценки?">
              Цель нужна только как стартовая рекомендация по тестам. Финальный набор ты соберёшь сам ниже.
            </InfoHint>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {COMMERCIAL_GOALS.map((item) => {
              const active = item.key === goal;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setGoal(item.key)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    active ? "border-emerald-500 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <div className="text-base font-semibold text-slate-950">{item.shortTitle}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">{item.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Шаг 2. Кого оцениваем</div>
              <div className="mt-1 text-xs text-slate-500">Одна аккуратная карточка участника до выбора финального набора тестов.</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 md:col-span-2 xl:col-span-2">
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
            <label className="grid gap-1 md:col-span-2 xl:col-span-2">
              <span className="text-xs text-slate-600">Целевая должность / роль</span>
              <input className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Например: руководитель группы" />
            </label>
            <label className="grid gap-1 md:col-span-2 xl:col-span-2">
              <span className="text-xs text-slate-600">Комментарий специалиста</span>
              <textarea className="input min-h-[104px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Коротко опиши контекст оценки, риски или задачу руководителя." />
            </label>
          </div>
        </div>


        <div className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Шаг 3. Набор тестов</div>
              <div className="mt-1 text-xs text-slate-500">Финальный набор тестов для проекта. Цель сверху только подсказывает стартовую рекомендацию.</div>
            </div>
            <div className="flex items-center gap-2">
              <InfoHint label="Как работает рекомендация?">
                Мы только подсказываем стартовый набор. Ты можешь убрать лишнее, добавить нужное и в любой момент вернуть рекомендованный комплект.
              </InfoHint>
              <button type="button" onClick={restoreRecommended} className="btn btn-secondary btn-sm">Вернуть рекомендацию</button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Рекомендуются под цель</div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {tests.filter((test) => recommendedTestSet.has(test.slug)).map((test) => {
                    const active = selectedTests.includes(test.slug);
                    return (
                      <label key={test.slug} className={`flex items-start gap-3 rounded-2xl border p-3 text-sm transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
                        <input className="mt-1" type="checkbox" checked={active} onChange={() => toggleTest(test.slug)} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{test.title}</div>
                          <div className="mt-1 text-xs text-emerald-700">Рекомендуется</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <details className="rounded-3xl border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-slate-500">Дополнительные тесты</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {optionalTests.map((test) => {
                    const active = selectedTests.includes(test.slug);
                    return (
                      <label key={test.slug} className={`flex items-start gap-3 rounded-2xl border p-3 text-sm transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
                        <input className="mt-1" type="checkbox" checked={active} onChange={() => toggleTest(test.slug)} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{test.title}</div>
                          <div className="mt-1 text-xs text-slate-500">Дополнительный тест</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </details>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4 h-fit">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Итог проекта</div>
                  <div className="mt-1 text-xs text-slate-500">Короткая сводка до создания проекта.</div>
                </div>
                <InfoHint label="Что войдёт в проект?">
                  В проект попадут цель оценки, карточка сотрудника и финальный набор тестов. После создания сразу появятся ссылка и QR, а результаты откроются уже после прохождения.
                </InfoHint>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">{definition?.shortTitle}</span>
                <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">{selectedTestCards.length} тест{selectedTestCards.length === 1 ? "" : selectedTestCards.length < 5 ? "а" : "ов"}</span>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 p-3 text-xs leading-5 text-slate-600">
                После создания проекта сразу появятся ссылка и QR-код для сотрудника. Результаты он не увидит.
              </div>

              {selectedTestCards.length === 0 ? <div className="mt-3 text-sm text-red-600">Выбери хотя бы один тест.</div> : null}

              <details className="mt-3 rounded-2xl border border-emerald-100 bg-white/90 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-900">
                  Выбранные тесты
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{selectedTestCards.length}</span>
                </summary>
                <div className="mt-3 grid gap-2 max-h-[240px] overflow-auto pr-1">
                  {selectedTestCards.map((test) => (
                    <div key={test.slug} className="rounded-2xl border border-emerald-100 bg-white/95 px-3 py-2 text-sm text-slate-700">{test.title}</div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : <div className="text-xs text-slate-500">Сначала цель, потом набор тестов, затем карточка участника. После этого проект можно создавать.</div>}
            <button type="submit" disabled={loading || !selectedTestCards.length} className="btn btn-primary min-w-[220px]">
              {loading ? "Создаём проект…" : "Создать проект"}
            </button>
          </div>
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
