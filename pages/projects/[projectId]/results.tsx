import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProjectResultsFlow, type FlowStage } from "@/components/ProjectResultsFlow";
import { isAdminEmail } from "@/lib/admin";
import { useSession } from "@/lib/useSession";
import type {
  ResultsBlueprint,
  ResultsBlueprintBridgeNode,
  ResultsBlueprintCompetencyNode,
  ResultsBlueprintFinalNode,
  ResultsBlueprintTestNode,
} from "@/lib/projectResultsBlueprint";

type ResultsPagePayload = {
  ok: true;
  fully_done: boolean;
  completed: number;
  total: number;
  project: {
    id: string;
    title: string;
    goal: string;
    status: string | null;
    target_role: string | null;
    routing_meta: {
      mode: "goal" | "competency";
      competencyIds?: string[];
      selectionLabel?: string | null;
    } | null;
    person: {
      full_name: string | null;
      email: string | null;
      current_position: string | null;
    } | null;
  };
  blueprint: ResultsBlueprint | null;
};

type DetailNode =
  | { kind: "test"; node: ResultsBlueprintTestNode }
  | { kind: "competency"; node: ResultsBlueprintCompetencyNode }
  | { kind: "bridge"; node: ResultsBlueprintBridgeNode }
  | { kind: "final"; node: ResultsBlueprintFinalNode };

function promptCoverageLine(blueprint: ResultsBlueprint) {
  const coverage = blueprint.summary.promptCoverage;
  return `Индивидуальных: ${coverage.custom}/${coverage.total} · базовых: ${coverage.default} · выключено: ${coverage.disabled} · пустых: ${coverage.missing}`;
}

function statusLabel(value: string | null | undefined) {
  switch (value) {
    case "completed":
      return "Завершён";
    case "active":
      return "Активен";
    case "draft":
      return "Черновик";
    default:
      return "Проект";
  }
}

function pluralize(count: number, one: string, few: string, many: string) {
  const value = Math.abs(count) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function percentValue(done: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

export default function ProjectResultsStandalonePage() {
  const router = useRouter();
  const { session, user, loading, envOk } = useSession();
  const projectId = typeof router.query.projectId === "string" ? router.query.projectId : "";
  const [data, setData] = useState<ResultsPagePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMechanism, setShowMechanism] = useState(false);
  const [focusInput, setFocusInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.project?.target_role) return;
    setRoleInput((current) => (current ? current : data.project.target_role || ""));
  }, [data?.project?.target_role]);

  useEffect(() => {
    if (!session?.access_token || !projectId) return;
    let cancelled = false;
    setBusy(true);
    setError("");
    fetch(`/api/commercial/projects/results-map?id=${encodeURIComponent(projectId)}`, {
      headers: { authorization: `Bearer ${session.access_token}` },
    })
      .then(async (resp) => {
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось открыть страницу результатов");
        if (!cancelled) {
          setData(json as ResultsPagePayload);
          setSelectedId((json as ResultsPagePayload).blueprint?.final.id || null);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "Не удалось открыть страницу результатов");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, session?.access_token]);

  const blueprint = data?.blueprint || null;
  const coverage = blueprint?.summary.promptCoverage || null;
  const testsReadyPercent = percentValue(data?.completed || 0, data?.total || 0);
  const promptReadyPercent = coverage ? percentValue(coverage.custom + coverage.default, coverage.total) : 0;
  const nodeTotal = blueprint ? blueprint.tests.length + blueprint.competencies.length + blueprint.bridges.length + 1 : 0;
  const remainingTests = Math.max(0, (data?.total || 0) - (data?.completed || 0));

  const stages = useMemo<FlowStage[]>(() => {
    if (!blueprint) return [];
    return [
      {
        id: "tests",
        title: "Тесты",
        caption: "Сырые блоки, из которых собирается контур.",
        nodes: blueprint.tests.map((item) => ({
          id: item.id,
          title: item.title,
          meta: item.completed ? "готово" : "ожидаем",
          body: item.summary,
          badges: item.badges,
          tone: item.completed ? "ready" : "muted",
        })),
      },
      {
        id: "competencies",
        title: "Компетенции",
        caption: "Промежуточные смысловые узлы с prompt-статусом.",
        nodes: blueprint.competencies.map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${item.score}/100 · ${item.promptLabel}`,
          body: item.short,
          badges: item.badges,
          footer: item.cluster,
          tone: item.promptSource === "custom" ? "ready" : item.promptSource === "default" ? "neutral" : "attention",
        })),
      },
      {
        id: "bridges",
        title: "Промежуточный результат",
        caption: "Сборка сильных сигналов, зон внимания и prompt-карты.",
        nodes: blueprint.bridges.map((item) => ({
          id: item.id,
          title: item.title,
          body: item.text,
          tone: item.tone,
        })),
      },
      {
        id: "final",
        title: "Итог",
        caption: "Верхний результат для внешней выдачи.",
        nodes: [
          {
            id: blueprint.final.id,
            title: blueprint.final.title,
            body: blueprint.final.text,
            tone: blueprint.final.tone,
          },
        ],
      },
    ];
  }, [blueprint]);

  const detailNode = useMemo<DetailNode | null>(() => {
    if (!blueprint || !selectedId) return null;
    const test = blueprint.tests.find((item) => item.id === selectedId);
    if (test) return { kind: "test", node: test };
    const competency = blueprint.competencies.find((item) => item.id === selectedId);
    if (competency) return { kind: "competency", node: competency };
    const bridge = blueprint.bridges.find((item) => item.id === selectedId);
    if (bridge) return { kind: "bridge", node: bridge };
    if (blueprint.final.id === selectedId) return { kind: "final", node: blueprint.final };
    return null;
  }, [blueprint, selectedId]);

  const outerDraft = useMemo(() => {
    if (!blueprint || !data) return null;
    const focus = focusInput.trim() || blueprint.summary.focusLabel;
    const role = roleInput.trim() || blueprint.summary.finalLabel;
    const strongest = blueprint.summary.strongest.slice(0, 3).join(", ");
    const attention = blueprint.summary.attention.slice(0, 2).join(", ");

    const intermediate = [
      `Фокус: ${focus}.`,
      strongest ? `Опорные сигналы: ${strongest}.` : "Опорные сигналы ещё собираются.",
      coverage?.custom
        ? `Индивидуальными промтами закрыто ${coverage.custom} из ${coverage.total} ключевых узлов.`
        : "Контур пока в основном читает базовые шаблоны.",
    ].join(" ");

    const final = [
      `Ориентир: ${role}.`,
      blueprint.summary.finalText,
      attention ? `Дополнительное внимание: ${attention}.` : "",
      focusInput.trim() ? `Акцент сверху: ${focusInput.trim()}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      intermediate,
      final,
    };
  }, [blueprint, coverage, data, focusInput, roleInput]);

  if (!envOk) {
    return (
      <Layout title="Страница результатов">
        <div className="card text-sm text-zinc-600">Supabase не настроен.</div>
      </Layout>
    );
  }

  if (loading || busy || (!data && !error)) {
    return (
      <Layout title="Страница результатов">
        <div className="mx-auto max-w-[1260px] px-3 pb-10 pt-3 sm:px-4">
          <div className="rounded-[34px] border border-[#dcc8aa] bg-[linear-gradient(180deg,#fffdfa_0%,#f6efe4_100%)] p-5 shadow-[0_24px_54px_rgba(93,71,39,0.10)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="h-5 w-56 animate-pulse rounded bg-[#eadfc8]" />
                <div className="mt-3 h-8 w-80 animate-pulse rounded bg-[#f0e7d7]" />
                <div className="mt-3 h-4 w-72 animate-pulse rounded bg-[#f0e7d7]" />
              </div>
              <div className="h-11 w-52 animate-pulse rounded-2xl bg-[#eadfc8]" />
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
              <div className="h-[360px] animate-pulse rounded-[28px] bg-[#f4ecde]" />
              <div className="h-[360px] animate-pulse rounded-[28px] bg-[#f4ecde]" />
            </div>
            <div className="mt-6 h-[520px] animate-pulse rounded-[28px] bg-[#f4ecde]" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!session || !user) {
    return (
      <Layout title="Страница результатов">
        <div className="card text-sm text-zinc-600">Нужен вход. Перейди в <a className="underline" href="/auth">/auth</a>.</div>
      </Layout>
    );
  }

  return (
    <Layout title={data?.project.title ? `${data.project.title} — результаты` : "Страница результатов"}>
      <div className="mx-auto max-w-[1260px] px-3 pb-12 pt-3 sm:px-4">
        {error ? <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="rounded-[36px] border border-[#dcc8aa] bg-[linear-gradient(180deg,#fffdfa_0%,#f5eee2_100%)] p-4 shadow-[0_26px_60px_rgba(93,71,39,0.12)] sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eadcc5] pb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#9d7a4b]">Аналитическое досье проекта</div>
              <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight text-[#2d2a22] sm:text-[2.1rem]">
                {data?.project.title || "Проект"}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#7b664f]">
                <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">{statusLabel(data?.project.status)}</span>
                <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">Тесты: {data?.completed}/{data?.total}</span>
                {blueprint ? (
                  <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">
                    {blueprint.summary.routeMode === "competency" ? "Контур компетенций" : "Контур цели"}
                  </span>
                ) : null}
                {data?.project.person?.full_name ? (
                  <span className="rounded-full border border-[#e3d4bd] bg-white/70 px-3 py-1">Участник: {data.project.person.full_name}</span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/projects/${projectId}`} className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731] shadow-[0_8px_18px_rgba(93,71,39,0.08)]">
                Назад к проекту
              </Link>
              {data?.fully_done && blueprint ? (
                <button
                  type="button"
                  onClick={() => setShowMechanism((prev) => !prev)}
                  className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)]"
                >
                  {showMechanism ? "Скрыть механизм" : "Открыть механизм"}
                </button>
              ) : null}
              {isAdminEmail(user.email) ? (
                <Link href="/admin/competency-prompts" className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731] shadow-[0_8px_18px_rgba(93,71,39,0.08)]">
                  AI-промты компетенций
                </Link>
              ) : null}
            </div>
          </div>

          {!data?.fully_done || !blueprint ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="rounded-[28px] border border-[#d8c5a8] bg-[#fbf5ea] px-5 py-5 text-sm leading-7 text-[#6f6454] shadow-[0_16px_34px_rgba(93,71,39,0.08)]">
                Эта страница откроется после завершения всех тестов в проекте. Сейчас готово {data?.completed || 0} из {data?.total || 0}. Внешний слой уже подготовлен, но внутренняя карта ещё не собрана до конца.
              </div>
              <aside className="rounded-[28px] border border-[#d8c5a8] bg-white/70 p-5 shadow-[0_16px_34px_rgba(93,71,39,0.08)]">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Готовность доступа</div>
                <div className="mt-3 text-[2.4rem] font-semibold leading-none text-[#2f5031]">{testsReadyPercent}%</div>
                <div className="mt-2 text-sm leading-6 text-[#6f6454]">
                  Осталось пройти {remainingTests} {pluralize(remainingTests, "тест", "теста", "тестов")}, чтобы открыть итоговую карту результатов.
                </div>
              </aside>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                <section className="rounded-[30px] border border-[#d8c5a8] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,250,241,0.74)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-[720px]">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#9d7a4b]">Внешний слой</div>
                      <div className="mt-2 text-[1.15rem] font-semibold text-[#2d2a22]">Снаружи только короткий вывод и две строки управления</div>
                      <div className="mt-2 text-sm leading-7 text-[#8b7760]">
                        Внутреннюю механику можно не показывать вообще. Сначала человек видит спокойный результат, а уже потом при необходимости открывает карту узлов и промтов.
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3 text-right">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Готовность логики</div>
                      <div className="mt-2 text-[2.2rem] font-semibold leading-none text-[#2f5031]">{promptReadyPercent}%</div>
                      <div className="mt-2 text-xs leading-5 text-[#7b664f]">Рабочие prompt-узлы: {coverage ? coverage.custom + coverage.default : 0} из {coverage?.total || 0}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Акцент анализа</span>
                      <input
                        className="input"
                        value={focusInput}
                        onChange={(e) => setFocusInput(e.target.value)}
                        placeholder="Например: управленческий потенциал и риски"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Ориентир / роль</span>
                      <input
                        className="input"
                        value={roleInput}
                        onChange={(e) => setRoleInput(e.target.value)}
                        placeholder="Например: руководитель проекта"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[24px] border border-[#dfcfb5] bg-[#fffaf1] px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Промежуточный результат</div>
                      <div className="mt-2 text-sm leading-7 text-[#5f5446]">{outerDraft?.intermediate}</div>
                    </div>
                    <div className="rounded-[24px] border border-[#dfcfb5] bg-[#fffaf1] px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Итоговый результат</div>
                      <div className="mt-2 text-sm leading-7 text-[#5f5446]">{outerDraft?.final}</div>
                    </div>
                  </div>
                </section>

                <aside className="rounded-[30px] border border-[#d8c5a8] bg-[linear-gradient(180deg,#fffaf2_0%,#f8f1e7_100%)] p-5 shadow-[0_18px_38px_rgba(93,71,39,0.10)]">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Паспорт карты</div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] border border-[#e2d3bb] bg-white/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#9d7a4b]">Тесты</div>
                      <div className="mt-2 text-xl font-semibold text-[#2d2a22]">{data.completed}/{data.total}</div>
                    </div>
                    <div className="rounded-[20px] border border-[#e2d3bb] bg-white/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#9d7a4b]">Узлы</div>
                      <div className="mt-2 text-xl font-semibold text-[#2d2a22]">{nodeTotal}</div>
                    </div>
                    <div className="rounded-[20px] border border-[#e2d3bb] bg-white/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#9d7a4b]">Инд. prompt</div>
                      <div className="mt-2 text-xl font-semibold text-[#2d2a22]">{coverage?.custom || 0}</div>
                    </div>
                    <div className="rounded-[20px] border border-[#e2d3bb] bg-white/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#9d7a4b]">Пустых</div>
                      <div className="mt-2 text-xl font-semibold text-[#2d2a22]">{coverage?.missing || 0}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f5446]">
                    <div className="rounded-[22px] border border-[#e2d3bb] bg-white/65 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Опора</div>
                      <div className="mt-2">{blueprint.summary.strongest.length ? blueprint.summary.strongest.join(", ") : "Опорные сигналы пока не выделены"}</div>
                    </div>
                    <div className="rounded-[22px] border border-[#e2d3bb] bg-white/65 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Внимание</div>
                      <div className="mt-2">{blueprint.summary.attention.length ? blueprint.summary.attention.join(", ") : "Явных провалов в видимом контуре нет"}</div>
                    </div>
                    <div className="rounded-[22px] border border-[#e2d3bb] bg-white/65 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Prompt-карта</div>
                      <div className="mt-2 text-sm leading-6 text-[#5f5446]">{promptCoverageLine(blueprint)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMechanism((prev) => !prev)}
                      className="rounded-2xl border border-[#7ca36f] bg-[#a8d19d] px-4 py-2.5 text-sm font-semibold text-[#264029] shadow-[0_10px_20px_rgba(78,116,67,0.18)]"
                    >
                      {showMechanism ? "Скрыть механизм" : "Открыть механизм"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusInput("");
                        setRoleInput(data?.project.target_role || "");
                      }}
                      className="rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2.5 text-sm font-medium text-[#5b4731]"
                    >
                      Сбросить строки
                    </button>
                  </div>
                </aside>
              </div>

              {showMechanism ? (
                <div className="mt-6 rounded-[30px] border border-[#d8c5a8] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe4_100%)] p-4 shadow-[0_18px_38px_rgba(93,71,39,0.10)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eadcc5] pb-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Внутренний механизм</div>
                      <div className="mt-2 text-lg font-semibold text-[#2d2a22]">Тесты → компетенции → промежуточный результат → итог</div>
                      <div className="mt-1 text-sm leading-6 text-[#8b7760]">Здесь уже видно, где есть индивидуальный prompt, где работает базовый шаблон и какие узлы ещё просят внимания.</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[#6f5a42]">
                      <span className="rounded-full border border-[#bfd8bf] bg-[#e6f3e3] px-3 py-1">Индивидуальный prompt</span>
                      <span className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-3 py-1">Базовый шаблон</span>
                      <span className="rounded-full border border-[#e4c79d] bg-[#fff3e1] px-3 py-1">Нужно внимание</span>
                      <span className="rounded-full border border-[#e4d7c4] bg-[#f5ecde] px-3 py-1">Ещё не собрано</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                    <ProjectResultsFlow stages={stages} links={blueprint.links} selectedId={selectedId} onSelect={setSelectedId} />

                    <aside className="rounded-[30px] border border-[#d8c5a8] bg-[linear-gradient(180deg,#fffaf2_0%,#f7efe3_100%)] p-5 shadow-[0_20px_42px_rgba(93,71,39,0.10)] xl:sticky xl:top-4">
                      <div className="text-sm font-semibold text-[#2d2a22]">Деталь выбранного узла</div>
                      {!detailNode ? (
                        <div className="mt-4 text-sm leading-7 text-[#6f6454]">Нажми на блок в схеме, чтобы посмотреть из чего он собран и что он сейчас отдаёт.</div>
                      ) : detailNode.kind === "test" ? (
                        <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f5446]">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Тест</div>
                            <div className="mt-1 text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
                          </div>
                          <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3">{detailNode.node.summary}</div>
                          <div className="flex flex-wrap gap-2">
                            {(detailNode.node.badges.length ? detailNode.node.badges : [detailNode.node.completed ? "Готово" : "Ожидает прохождения"]).map((item) => (
                              <span key={item} className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-3 py-1 text-xs text-[#6f5a42]">{item}</span>
                            ))}
                          </div>
                        </div>
                      ) : detailNode.kind === "competency" ? (
                        <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f5446]">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Компетенция</div>
                            <div className="mt-1 text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#9d7a4b]">{detailNode.node.cluster} · {detailNode.node.score}/100</div>
                          </div>
                          <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3">{detailNode.node.details}</div>
                          <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Статус prompt</div>
                            <div className="mt-1">{detailNode.node.promptLabel}</div>
                            <div className="mt-2 text-xs leading-6 text-[#8b7760]">
                              {detailNode.node.promptSource === "custom"
                                ? "Узел опирается на настроенный в админке индивидуальный prompt."
                                : detailNode.node.promptSource === "default"
                                ? "Узел живёт на базовом шаблоне — это не пустота, но и не индивидуальная настройка."
                                : detailNode.node.promptSource === "disabled"
                                ? "Узел выключен в таблице prompt-контура и требует внимания."
                                : "Здесь вообще нет рабочего шаблона, значит итог будет слабее."}
                            </div>
                          </div>
                          <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9d7a4b]">Связанные тесты</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(detailNode.node.testTitles.length ? detailNode.node.testTitles : ["Пока нет завершённых релевантных тестов"]).map((item) => (
                                <span key={item} className="rounded-full border border-[#e2d3bb] bg-[#f4ecdf] px-3 py-1 text-xs text-[#6f5a42]">{item}</span>
                              ))}
                            </div>
                          </div>
                          {isAdminEmail(user.email) ? (
                            <Link href="/admin/competency-prompts" className="inline-flex rounded-2xl border border-[#d9c4a4] bg-[#fffaf0] px-4 py-2 text-sm font-medium text-[#5b4731]">
                              Открыть prompt-админку
                            </Link>
                          ) : null}
                        </div>
                      ) : detailNode.kind === "bridge" ? (
                        <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f5446]">
                          <div className="text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
                          <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3">{detailNode.node.text}</div>
                          <div className="text-xs text-[#8b7760]">Это уже не сырые результаты тестов, а собранный промежуточный слой, из которого питается итог.</div>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f5446]">
                          <div className="text-lg font-semibold text-[#2d2a22]">{detailNode.node.title}</div>
                          <div className="rounded-[22px] border border-[#e2d3bb] bg-white/70 px-4 py-3">{detailNode.node.text}</div>
                          <div className="text-xs text-[#8b7760]">Это верхний результат. Он нарочно короткий снаружи, а подробная механика остаётся в раскрывающемся слое.</div>
                        </div>
                      )}
                    </aside>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[26px] border border-dashed border-[#d8c5a8] bg-white/50 px-5 py-4 text-sm leading-7 text-[#6f6454]">
                  Механизм скрыт. Снаружи пользователь видит только короткий вывод. При необходимости можно открыть карту взаимосвязей и пройти от тестов к компетенциям, промежуточным блокам и финальному выводу.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
