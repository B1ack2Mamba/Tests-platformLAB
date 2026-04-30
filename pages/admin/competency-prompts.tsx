/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";
import { getCompetencyRoute, getCompetencyRecommendedTests } from "@/lib/competencyRouter";
import { getTestDisplayTitle } from "@/lib/testTitles";
import {
  buildDefaultCompetencyPromptRows,
  COMPETENCY_PROMPT_PLACEHOLDERS,
  getDefaultCompetencyPromptRowById,
  normalizePracticalExperience,
  type CompetencyPromptRow,
} from "@/lib/competencyPrompts";

const PRACTICAL_EXPERIENCE_DRAFT_PREFIX = "competency_prompt_practical_draft:";

function getPracticalDraftKey(competencyId: string) {
  return `${PRACTICAL_EXPERIENCE_DRAFT_PREFIX}${competencyId}`;
}

function readPracticalDraft(competencyId: string) {
  if (typeof window === "undefined" || !competencyId) return "";
  try {
    return normalizePracticalExperience(window.localStorage.getItem(getPracticalDraftKey(competencyId)) || "");
  } catch {
    return "";
  }
}

function writePracticalDraft(competencyId: string, value: string) {
  if (typeof window === "undefined" || !competencyId) return;
  try {
    const normalized = normalizePracticalExperience(value);
    if (normalized) {
      window.localStorage.setItem(getPracticalDraftKey(competencyId), normalized);
    } else {
      window.localStorage.removeItem(getPracticalDraftKey(competencyId));
    }
  } catch {}
}

function clearPracticalDraft(competencyId: string) {
  if (typeof window === "undefined" || !competencyId) return;
  try {
    window.localStorage.removeItem(getPracticalDraftKey(competencyId));
  } catch {}
}

function mergeRowsWithDrafts(rows: CompetencyPromptRow[]) {
  return rows.map((row) => {
    const draft = readPracticalDraft(row.competency_id);
    return draft ? { ...row, notes: draft } : row;
  });
}

export default function CompetencyPromptsAdminPage() {
  const { user, session, loading, envOk } = useSession();
  const canUseAdmin = isAdminEmail(user?.email);
  const [rows, setRows] = useState<CompetencyPromptRow[]>(() => mergeRowsWithDrafts(buildDefaultCompetencyPromptRows()));
  const [activeId, setActiveId] = useState<string>(() => buildDefaultCompetencyPromptRows()[0]?.competency_id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"db" | "fallback" | "error">("fallback");
  const [tableReady, setTableReady] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showMainPrompt, setShowMainPrompt] = useState(false);

  const activeRow = rows.find((row) => row.competency_id === activeId) || rows[0] || null;
  const activeRoute = activeRow ? getCompetencyRoute(activeRow.competency_id) : null;
  const allRouteTests = useMemo(() => {
    if (!activeRow) return [] as string[];
    const full = getCompetencyRecommendedTests([activeRow.competency_id], undefined, "full");
    const standard = getCompetencyRecommendedTests([activeRow.competency_id], undefined, "standard");
    const quick = getCompetencyRecommendedTests([activeRow.competency_id], undefined, "quick");
    return Array.from(new Set([...full, ...standard, ...quick]));
  }, [activeRow]);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, CompetencyPromptRow[]>();
    for (const row of rows) {
      const list = groups.get(row.competency_cluster) || [];
      list.push(row);
      groups.set(row.competency_cluster, list);
    }
    return Array.from(groups.entries());
  }, [rows]);

  async function loadRows() {
    if (!session?.access_token || !canUseAdmin) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/competency-prompts", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить AI-шаблоны");
      const nextRows: CompetencyPromptRow[] = Array.isArray(json.rows) && json.rows.length
        ? mergeRowsWithDrafts(json.rows as CompetencyPromptRow[])
        : mergeRowsWithDrafts(buildDefaultCompetencyPromptRows());
      setRows(nextRows);
      setSource(json.source || "fallback");
      setTableReady(Boolean(json.tableReady));
      if (!nextRows.find((item: CompetencyPromptRow) => item.competency_id === activeId)) setActiveId(nextRows[0]?.competency_id || "");
    } catch (error: any) {
      setMessage(error?.message || "Не удалось загрузить AI-шаблоны");
    } finally {
      setBusy(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    loadRows();
  }, [session?.access_token, canUseAdmin]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!activeRow) return;
    const draft = readPracticalDraft(activeRow.competency_id);
    if (draft && draft !== normalizePracticalExperience(activeRow.notes)) {
      setRows((current) => current.map((row) => row.competency_id === activeRow.competency_id ? { ...row, notes: draft } : row));
    }
  }, [activeId]);

  function patchActive(patch: Partial<CompetencyPromptRow>) {
    if (!activeRow) return;
    setRows((current) => current.map((row) => row.competency_id === activeRow.competency_id ? { ...row, ...patch } : row));
  }

  function patchPracticalExperience(value: string) {
    if (!activeRow) return;
    const normalized = value.replace(/\r/g, "");
    writePracticalDraft(activeRow.competency_id, normalized);
    patchActive({ notes: normalized });
    setMessage("Черновик практического опыта сохранён локально. Нажми «Сохранить в систему», чтобы он учитывался в AI-анализе.");
  }

  async function saveActive() {
    if (!session?.access_token || !activeRow) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = { ...activeRow, notes: normalizePracticalExperience(activeRow.notes) || null };
      const resp = await fetch("/api/admin/competency-prompts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "save", item: payload }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить AI-шаблон");
      clearPracticalDraft(activeRow.competency_id);
      setMessage(`Сохранено: ${activeRow.competency_name}. Практический опыт будет учитываться в генерации ответа.`);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Не удалось сохранить AI-шаблон");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    if (!session?.access_token) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/competency-prompts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "seed" }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось импортировать шаблоны по умолчанию");
      setMessage(`Базовые AI-шаблоны загружены: ${json.seeded || 0}`);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Не удалось импортировать шаблоны по умолчанию");
    } finally {
      setBusy(false);
    }
  }

  function resetActiveToDefault() {
    if (!activeRow) return;
    const fallback = getDefaultCompetencyPromptRowById(activeRow.competency_id);
    if (!fallback) return;
    clearPracticalDraft(activeRow.competency_id);
    setRows((current) => current.map((row) => row.competency_id === activeRow.competency_id ? { ...fallback, notes: null } : row));
    setMessage(`Шаблон «${activeRow.competency_name}» сброшен к базовой версии. Нажми «Сохранить в систему», чтобы записать изменения.`);
  }

  return (
    <Layout title="AI-шаблоны компетенций">
      {!envOk ? (
        <div className="card text-sm text-zinc-600">Supabase не настроен.</div>
      ) : loading ? (
        <div className="card text-sm text-zinc-600">Загрузка…</div>
      ) : !user ? (
        <div className="card text-sm text-zinc-600">Нужен вход. Перейди в <Link className="underline" href="/auth">/auth</Link>.</div>
      ) : !canUseAdmin ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Доступ запрещён. Админы: <span className="font-mono">{ADMIN_EMAILS.join(", ")}</span>
        </div>
      ) : (
        <div className="grid gap-4">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">AI-шаблоны по компетенциям</div>
                <div className="mt-1 text-sm text-slate-500">Системный prompt и основной шаблон спрятаны, чтобы не мешать. Основное рабочее поле — практический опыт специалиста. Его черновик хранится локально, а после нажатия «Сохранить в систему» начинает учитываться в AI-анализе по компетенции.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin" className="btn btn-secondary btn-sm">Назад в админку</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={seedDefaults} disabled={busy}>Импортировать базовые AI-шаблоны</button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Источник: {source === "db" ? "таблица Supabase" : source === "fallback" ? "вшитый fallback" : "ошибка загрузки"}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Таблица готова: {tableReady ? "да" : "нет"}</span>
            </div>
            {message ? <div className="mt-3 text-sm text-slate-700">{message}</div> : null}
          </section>

          <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="card">
              <div className="text-sm font-semibold text-slate-900">Компетенции</div>
              <div className="mt-4 grid gap-4 max-h-[72vh] overflow-auto pr-1">
                {groupedRows.map(([cluster, items]) => (
                  <div key={cluster}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{cluster}</div>
                    <div className="grid gap-2">
                      {items.map((row) => (
                        <button key={row.competency_id} type="button" className={`rounded-2xl border px-3 py-3 text-left ${activeId === row.competency_id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`} onClick={() => setActiveId(row.competency_id)}>
                          <div className="text-sm font-medium text-slate-900">{row.competency_id} · {row.competency_name}</div>
                          <div className="mt-1 text-xs text-slate-500">{row.is_active ? "Активен" : "Выключен"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              {!activeRow ? (
                <div className="text-sm text-slate-500">Выбери компетенцию слева.</div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{activeRow.competency_id} · {activeRow.competency_name}</div>
                        <div className="mt-1 text-sm text-slate-500">{activeRow.competency_cluster}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={resetActiveToDefault}>Вернуть базовый шаблон</button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={activeRow.is_active} onChange={(e) => patchActive({ is_active: e.target.checked })} />
                        Использовать этот шаблон в AI+ анализе
                      </label>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Тесты для определения компетенции</div>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        {allRouteTests.length ? allRouteTests.map((slug) => getTestDisplayTitle(slug)).join(" · ") : "Тесты пока не определены."}
                      </div>
                      {activeRoute ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                          <span className="font-semibold text-slate-700">Правило чтения:</span> {activeRoute.fitGate}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Системный prompt</div>
                          <div className="mt-1 text-xs text-slate-500">Скрыт по умолчанию. Нужен только для тонкой настройки логики.</div>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSystemPrompt((value) => !value)}>
                          {showSystemPrompt ? "Скрыть" : "Редактировать"}
                        </button>
                      </div>
                      {showSystemPrompt ? (
                        <label className="mt-3 grid gap-2">
                          <textarea className="input min-h-[120px] resize-y" value={activeRow.system_prompt} onChange={(e) => patchActive({ system_prompt: e.target.value })} />
                        </label>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Главный prompt по компетенции</div>
                          <div className="mt-1 text-xs text-slate-500">Уже заполнен. Обычно здесь ничего не меняют без необходимости.</div>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowMainPrompt((value) => !value)}>
                          {showMainPrompt ? "Скрыть" : "Редактировать"}
                        </button>
                      </div>
                      {showMainPrompt ? (
                        <textarea className="input mt-3 min-h-[300px] resize-y font-mono text-xs leading-6" value={activeRow.prompt_template} onChange={(e) => patchActive({ prompt_template: e.target.value })} />
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Практический опыт специалиста</div>
                      <div className="mt-1 text-sm text-slate-500">Сюда вбивай свои правила чтения, совокупности результатов, пороги, конкретные цифры и исключения. Черновик не пропадёт при случайном обновлении страницы.</div>
                      <textarea
                        className="input mt-3 min-h-[360px] resize-y text-sm leading-6"
                        value={activeRow.notes || ""}
                        onChange={(e) => patchPracticalExperience(e.target.value)}
                        placeholder="Например: если по 16PF доминантность высокая, а ЭМИН по управлению эмоциями низкий, не считать управленческую зрелость устойчивой. Или: если Belbin + переговорный стиль + УСК дают согласованный сигнал, усиливать вывод по компетенции."
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-600">После сохранения этот текст будет учитываться при генерации ответа по компетенции.</div>
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveActive} disabled={busy}>Сохранить в систему</button>
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-3 xl:sticky xl:top-4 self-start">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Подстановки</div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 max-h-[70vh] overflow-auto pr-1">
                      {COMPETENCY_PROMPT_PLACEHOLDERS.map((item) => (
                        <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <div className="font-mono text-[11px] text-slate-900">{`{{${item.key}}}`}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
