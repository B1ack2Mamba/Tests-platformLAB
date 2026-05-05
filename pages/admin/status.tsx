/* eslint-disable react-hooks/exhaustive-deps */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";
import { RECOVERY_CHECKLIST } from "@/lib/recoveryChecklist";
import { type ReleaseStatusReport } from "@/lib/releaseStatus";
import { useSession } from "@/lib/useSession";

function statusTone(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : "border-red-200 bg-red-50 text-red-900";
}

function toneChip(ok: boolean) {
  return ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-red-200 bg-red-50 text-red-900";
}

export default function AdminStatusPage() {
  const { user, session, loading, envOk } = useSession();
  const canUseAdmin = isAdminEmail(user?.email);
  const [report, setReport] = useState<ReleaseStatusReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadStatus() {
    if (!session?.access_token || !canUseAdmin) return;
    setBusy(true);
    setMessage("");
    try {
      const resp = await fetch("/api/admin/release-status", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok || !json?.report) throw new Error(json?.error || "Не удалось загрузить статус");
      setReport(json.report);
    } catch (error: any) {
      setMessage(error?.message || "Не удалось загрузить статус");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    loadStatus();
  }, [session?.access_token, canUseAdmin]);

  return (
    <Layout title="Операционный статус">
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
                <div className="text-sm font-semibold text-slate-900">Операционный статус прод-контура</div>
                <div className="mt-1 text-sm text-slate-500">Один экран для health, публичного smoke, авторизованного smoke и AI-проверки без запуска локальных скриптов.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin" className="btn btn-secondary btn-sm">Назад в админку</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadStatus} disabled={busy}>
                  {busy ? "Обновляем…" : "Обновить статус"}
                </button>
              </div>
            </div>
            {message ? <div className="mt-3 text-sm text-red-700">{message}</div> : null}
          </section>

          {report ? (
            <>
              <section className="grid gap-4 lg:grid-cols-4">
                <div className={`rounded-2xl border px-4 py-4 ${statusTone(report.ok)}`}>
                  <div className="text-xs uppercase tracking-wide opacity-70">Общий статус</div>
                  <div className="mt-2 text-lg font-semibold">{report.ok ? "Система готова" : "Есть сбои"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Версия</div>
                  <div className="mt-2 break-all text-sm font-medium">{report.health.version || "unknown"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Request ID health</div>
                  <div className="mt-2 break-all text-sm font-medium">{report.health.request_id || "—"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Длительность</div>
                  <div className="mt-2 text-sm font-medium">{report.duration_ms} мс</div>
                </div>
              </section>

              <section className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Health</div>
                    <div className="mt-1 text-xs text-slate-500">{report.target}/api/health</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneChip(report.health.ok)}`}>
                    {report.health.ok ? `OK ${report.health.status}` : `FAIL ${report.health.status}`}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Ответ: {report.health.ms} мс</div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Проверено: {new Date(report.checked_at).toLocaleString("ru-RU")}</div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">Preview: {report.health.preview || "—"}</div>
                </div>
              </section>

              <section className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Публичный smoke</div>
                    <div className="mt-1 text-xs text-slate-500">Главная, логин, кошелёк, invite, проект, результаты</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneChip(report.smoke_prod.ok)}`}>
                    {report.smoke_prod.ok ? "Все проверки пройдены" : "Есть ошибки"}
                  </span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Проверка</th>
                        <th className="pb-2 pr-4 font-medium">Статус</th>
                        <th className="pb-2 pr-4 font-medium">Время</th>
                        <th className="pb-2 pr-4 font-medium">Путь</th>
                        <th className="pb-2 font-medium">Ошибка / preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.smoke_prod.checks.map((item) => (
                        <tr key={`public-${item.label}`} className="border-t border-slate-100 align-top">
                          <td className="py-3 pr-4 font-medium text-slate-900">{item.label}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full border px-2 py-1 text-xs font-medium ${toneChip(item.ok)}`}>
                              {item.ok ? `OK ${item.status}` : `FAIL ${item.status || "ERR"}`}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{item.ms} мс</td>
                          <td className="py-3 pr-4 text-slate-600">{item.path}</td>
                          <td className="py-3 text-slate-600">{item.error || item.preview || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Авторизованный smoke</div>
                    <div className="mt-1 text-xs text-slate-500">Профиль, кабинет, подписка, проект, results-map, AI evaluation, unlock access, test access</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneChip(report.smoke_auth.ok)}`}>
                    {report.smoke_auth.ok ? "Все проверки пройдены" : "Есть ошибки"}
                  </span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">Проверка</th>
                        <th className="pb-2 pr-4 font-medium">Статус</th>
                        <th className="pb-2 pr-4 font-medium">Время</th>
                        <th className="pb-2 pr-4 font-medium">Метод</th>
                        <th className="pb-2 pr-4 font-medium">Путь</th>
                        <th className="pb-2 font-medium">Ошибка / preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.smoke_auth.checks.map((item) => (
                        <tr key={`auth-${item.label}`} className="border-t border-slate-100 align-top">
                          <td className="py-3 pr-4 font-medium text-slate-900">{item.label}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full border px-2 py-1 text-xs font-medium ${toneChip(item.ok)}`}>
                              {item.ok ? `OK ${item.status}` : `FAIL ${item.status || "ERR"}`}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{item.ms} мс</td>
                          <td className="py-3 pr-4 text-slate-600">{item.method}</td>
                          <td className="py-3 pr-4 text-slate-600">{item.path}</td>
                          <td className="py-3 text-slate-600">{item.error || item.preview || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <div className="text-sm font-semibold text-slate-900">Recovery checklist</div>
                <div className="mt-1 text-xs text-slate-500">Что делать, если какой-то блок в статусе стал красным.</div>
                <div className="mt-4 grid gap-3">
                  {RECOVERY_CHECKLIST.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-sm font-medium text-slate-900">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.symptoms}</div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700">
                        {item.actions.map((action) => (
                          <div key={action}>• {action}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="card text-sm text-slate-500">Статус ещё не загружен.</section>
          )}
        </div>
      )}
    </Layout>
  );
}
