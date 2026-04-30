/* eslint-disable react-hooks/exhaustive-deps */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";
import { type FitRoleProfile, getFitRoleProfiles, FIT_EXPECTATION_TAGS } from "@/lib/fitProfiles";

type ConfigKind = "role" | "expectation";

type ConfigRow = {
  id: string;
  kind: ConfigKind;
  label: string;
  short_label: string | null;
  description: string | null;
  keywords: string[] | null;
  weights: Record<string, number> | null;
  critical: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
};

function defaultRows(): ConfigRow[] {
  const roles = getFitRoleProfiles().map((item, index) => ({
    id: item.id,
    kind: "role" as const,
    label: item.label,
    short_label: item.shortLabel,
    description: item.description,
    keywords: item.keywords,
    weights: item.weights,
    critical: item.critical,
    sort_order: index + 1,
    is_active: true,
  }));
  const expectations = FIT_EXPECTATION_TAGS.map((item, index) => ({
    id: item.id,
    kind: "expectation" as const,
    label: item.label,
    short_label: null,
    description: "",
    keywords: item.keywords,
    weights: item.weights,
    critical: item.critical || [],
    sort_order: 100 + index + 1,
    is_active: true,
  }));
  return [...roles, ...expectations];
}

function formatKeywords(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseKeywords(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatWeights(value: Record<string, number> | null | undefined) {
  return JSON.stringify(value || {}, null, 2);
}

function parseWeights(value: string) {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Weights must be object");
  return parsed as Record<string, number>;
}

function blankRow(kind: ConfigKind): ConfigRow {
  return {
    id: kind === "role" ? `role_${Date.now()}` : `exp_${Date.now()}`,
    kind,
    label: "",
    short_label: kind === "role" ? "" : null,
    description: kind === "role" ? "" : null,
    keywords: [],
    weights: {},
    critical: [],
    sort_order: kind === "role" ? 999 : 1999,
    is_active: true,
  };
}

export default function FitConfigAdminPage() {
  const { user, session, loading, envOk } = useSession();
  const canUseAdmin = isAdminEmail(user?.email);
  const [rows, setRows] = useState<ConfigRow[]>(defaultRows());
  const [activeId, setActiveId] = useState<string>(defaultRows()[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"db" | "fallback" | "error">("fallback");
  const [tableReady, setTableReady] = useState(false);

  const activeRow = rows.find((row) => row.id === activeId) || rows[0] || null;
  const roleRows = useMemo(() => rows.filter((row) => row.kind === "role"), [rows]);
  const expectationRows = useMemo(() => rows.filter((row) => row.kind === "expectation"), [rows]);

  async function loadRows() {
    if (!session?.access_token || !canUseAdmin) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/fit-config", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить матрицы");
      setRows(Array.isArray(json.rows) && json.rows.length ? json.rows : defaultRows());
      setSource(json.source || "fallback");
      setTableReady(Boolean(json.tableReady));
      if (!activeId && json.rows?.[0]?.id) setActiveId(json.rows[0].id);
    } catch (error: any) {
      setMessage(error?.message || "Не удалось загрузить матрицы");
    } finally {
      setBusy(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    loadRows();
  }, [session?.access_token, canUseAdmin]);

  function patchActive(patch: Partial<ConfigRow>) {
    if (!activeRow) return;
    setRows((current) => current.map((row) => row.id === activeRow.id ? { ...row, ...patch } : row));
  }

  async function saveActive() {
    if (!session?.access_token || !activeRow) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/fit-config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "save", item: activeRow }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось сохранить запись");
      setMessage(`Сохранено: ${activeRow.label || activeRow.id}`);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Не удалось сохранить запись");
    } finally {
      setBusy(false);
    }
  }

  async function deleteActive() {
    if (!session?.access_token || !activeRow) return;
    if (!confirm(`Удалить запись «${activeRow.label || activeRow.id}»?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/fit-config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "delete", id: activeRow.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось удалить запись");
      const nextRows = rows.filter((row) => row.id !== activeRow.id);
      setRows(nextRows);
      setActiveId(nextRows[0]?.id || "");
      setMessage("Запись удалена");
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Не удалось удалить запись");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    if (!session?.access_token) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/fit-config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "seed" }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось импортировать базовую матрицу");
      setMessage(`Базовая матрица загружена: ${json.seeded || 0} записей`);
      await loadRows();
    } catch (error: any) {
      setMessage(error?.message || "Не удалось импортировать базовую матрицу");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout title="Матрица соответствия">
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
                <div className="text-sm font-semibold text-slate-900">Редактор матрицы ролей и ожиданий</div>
                <div className="mt-1 text-sm text-slate-500">Здесь ты меняешь роли, ключевые слова, веса компетенций и критичные провалы без новой сборки проекта.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin" className="btn btn-secondary btn-sm">Назад в админку</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={seedDefaults} disabled={busy}>Импортировать базовую матрицу</button>
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
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Записи</div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const row = blankRow("role"); setRows((current) => [row, ...current]); setActiveId(row.id); }}>+ Роль</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const row = blankRow("expectation"); setRows((current) => [row, ...current]); setActiveId(row.id); }}>+ Ожидание</button>
                </div>
              </div>
              <div className="mt-4 grid gap-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Роли</div>
                  <div className="grid gap-2">
                    {roleRows.map((row) => (
                      <button key={row.id} type="button" className={`rounded-2xl border px-3 py-3 text-left ${activeId === row.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`} onClick={() => setActiveId(row.id)}>
                        <div className="text-sm font-medium text-slate-900">{row.label || row.id}</div>
                        <div className="mt-1 text-xs text-slate-500">{row.short_label || "без short label"}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ожидания</div>
                  <div className="grid gap-2 max-h-[320px] overflow-auto pr-1">
                    {expectationRows.map((row) => (
                      <button key={row.id} type="button" className={`rounded-2xl border px-3 py-3 text-left ${activeId === row.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`} onClick={() => setActiveId(row.id)}>
                        <div className="text-sm font-medium text-slate-900">{row.label || row.id}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatKeywords(row.keywords).slice(0, 80) || "без ключевых слов"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              {!activeRow ? (
                <div className="text-sm text-slate-500">Выбери запись слева.</div>
              ) : (
                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600">ID</span>
                      <input className="input" value={activeRow.id} onChange={(e) => patchActive({ id: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600">Тип</span>
                      <select className="input" value={activeRow.kind} onChange={(e) => patchActive({ kind: e.target.value as ConfigKind })}>
                        <option value="role">Роль</option>
                        <option value="expectation">Ожидание</option>
                      </select>
                    </label>
                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Название</span>
                      <input className="input" value={activeRow.label} onChange={(e) => patchActive({ label: e.target.value })} />
                    </label>
                    {activeRow.kind === "role" ? (
                      <>
                        <label className="grid gap-1">
                          <span className="text-xs text-slate-600">Короткое название</span>
                          <input className="input" value={activeRow.short_label || ""} onChange={(e) => patchActive({ short_label: e.target.value })} />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs text-slate-600">Порядок</span>
                          <input className="input" inputMode="numeric" value={String(activeRow.sort_order ?? "")} onChange={(e) => patchActive({ sort_order: Number(e.target.value || 0) })} />
                        </label>
                        <label className="grid gap-1 md:col-span-2">
                          <span className="text-xs text-slate-600">Описание роли</span>
                          <textarea className="input min-h-[90px]" value={activeRow.description || ""} onChange={(e) => patchActive({ description: e.target.value })} />
                        </label>
                      </>
                    ) : (
                      <label className="grid gap-1">
                        <span className="text-xs text-slate-600">Порядок</span>
                        <input className="input" inputMode="numeric" value={String(activeRow.sort_order ?? "")} onChange={(e) => patchActive({ sort_order: Number(e.target.value || 0) })} />
                      </label>
                    )}
                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Ключевые слова (через запятую)</span>
                      <textarea className="input min-h-[96px]" value={formatKeywords(activeRow.keywords)} onChange={(e) => patchActive({ keywords: parseKeywords(e.target.value) })} />
                    </label>
                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Критичные компетенции (через запятую)</span>
                      <input className="input" value={formatKeywords(activeRow.critical)} onChange={(e) => patchActive({ critical: parseKeywords(e.target.value) })} placeholder="Например: C19, C31, C09" />
                    </label>
                    <label className="grid gap-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Веса компетенций (JSON)</span>
                      <textarea className="input min-h-[220px] font-mono text-xs" value={formatWeights(activeRow.weights)} onChange={(e) => {
                        try {
                          patchActive({ weights: parseWeights(e.target.value) });
                          setMessage("");
                        } catch (error: any) {
                          setMessage(error?.message || "JSON не разобран");
                        }
                      }} />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" onClick={saveActive} disabled={busy || !activeRow.label.trim()}>{busy ? "Сохраняем…" : "Сохранить запись"}</button>
                    <button type="button" className="btn btn-secondary" onClick={deleteActive} disabled={busy}>Удалить запись</button>
                    <button type="button" className="btn btn-secondary" onClick={loadRows} disabled={busy}>Обновить</button>
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
