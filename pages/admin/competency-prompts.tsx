import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";
import {
  buildDefaultCompetencyPromptRows,
  COMPETENCY_PROMPT_PLACEHOLDERS,
  getDefaultCompetencyPromptRowById,
  type CompetencyPromptRow,
} from "@/lib/competencyPrompts";

export default function CompetencyPromptsAdminPage() {
  const { user, session, loading, envOk } = useSession();
  const canUseAdmin = isAdminEmail(user?.email);
  const [rows, setRows] = useState<CompetencyPromptRow[]>(() => buildDefaultCompetencyPromptRows());
  const [activeId, setActiveId] = useState<string>(() => buildDefaultCompetencyPromptRows()[0]?.competency_id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"db" | "fallback" | "error">("fallback");
  const [tableReady, setTableReady] = useState(false);

  const activeRow = rows.find((row) => row.competency_id === activeId) || rows[0] || null;
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
      const nextRows = Array.isArray(json.rows) && json.rows.length ? json.rows : buildDefaultCompetencyPromptRows();
      setRows(nextRows);
      setSource(json.source || "fallback");
      setTableReady(Boolean(json.tableReady));
      if (!nextRows.find((item) => item.competency_id === activeId)) setActiveId(nextRows[0]?.competency_id || "");
    } catch (error: any) {
      setMessage(error?.message || "Не удалось загрузить AI-шаблоны");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    loadRows();
  }, [session?.access_token, canUseAdmin]);

  function patchActive(patch: Partial<CompetencyPromptRow>) {
    if (!activeRow) return;
    setRows((current) => current.map((row) => row.competency_id === activeRow.competency_id ? { ...row, ...patch } : row));
  }

  async function saveActive() {
    if (!session?.access_token || !activeRow) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/competency-prompts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "save", item: activeRow }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить AI-шаблон");
      setMessage(`Сохранено: ${activeRow.competency_name}`);
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
    setRows((current) => current.map((row) => row.competency_id === activeRow.competency_id ? fallback : row));
    setMessage(`Шаблон «${activeRow.competency_name}» сброшен к базовой версии. Нажми «Сохранить», чтобы записать в систему.`);
  }

  return (
    <Layout title="AI-шаблоны компетенций">
      {!envOk ? (
        <div className="card text-sm text-zinc-600">Supabase не настроен.</div>
      ) : loading ? (
        <div className="card text-sm text-zinc-600">Загрузка…</div>
      ) : !user ? (
        <div className="card text-sm text-zinc-600">Нужен вход. Перейди в <a className="underline" href="/auth">/auth</a>.</div>
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
                <div className="mt-1 text-sm text-slate-500">Здесь ты можешь под каждую компетенцию вписать свой рабочий промпт для AI. В шаблон автоматически подставятся результаты релевантных тестов, профиль человека и контекст проекта.</div>
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
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{activeRow.competency_id} · {activeRow.competency_name}</div>
                      <div className="mt-1 text-sm text-slate-500">{activeRow.competency_cluster}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={resetActiveToDefault}>Вернуть базовый шаблон</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveActive} disabled={busy}>Сохранить</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={activeRow.is_active} onChange={(e) => patchActive({ is_active: e.target.checked })} />
                      Использовать этот шаблон в AI+ анализе
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Системный prompt</span>
                    <textarea className="input min-h-[120px]" value={activeRow.system_prompt} onChange={(e) => patchActive({ system_prompt: e.target.value })} />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Шаблон user-prompt</span>
                    <textarea className="input min-h-[360px] font-mono text-xs leading-6" value={activeRow.prompt_template} onChange={(e) => patchActive({ prompt_template: e.target.value })} />
                  </label>

                  <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600">Заметка для себя</span>
                      <textarea className="input min-h-[120px]" value={activeRow.notes || ""} onChange={(e) => patchActive({ notes: e.target.value })} />
                    </label>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Подстановки</div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-600">
                        {COMPETENCY_PROMPT_PLACEHOLDERS.map((item) => (
                          <div key={item.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="font-mono text-[11px] text-slate-900">{`{{${item.key}}}`}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    AI берёт твой шаблон, подставляет туда реальные результаты релевантных тестов по этой компетенции, короткие интерпретации, профиль человека и текущий запрос проекта. Так ты сможешь постепенно встраивать свой практический опыт прямо в систему, а не надеяться на один общий промпт на весь проект.
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
