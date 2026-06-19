/* eslint-disable react-hooks/exhaustive-deps */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";
import { RECOVERY_CHECKLIST } from "@/lib/recoveryChecklist";
import { type ReleaseStatusReport } from "@/lib/releaseStatus";
import { useSession } from "@/lib/useSession";

type ConnectionProbe = {
  name: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  bytes: number;
  headers: {
    cf_ray: string | null;
    cf_colo: string | null;
    cf_colo_country: string | null;
    sb_project_ref: string | null;
    server: string | null;
  };
  error?: string;
};

type ConnectionRouteReport = {
  ok: boolean;
  request_id: string;
  checked_at: string;
  total_ms: number;
  runtime: string;
  route: {
    visitor: {
      country_code: string | null;
      country: string | null;
      region: string | null;
      city: string | null;
      source: string;
    };
    vercel: {
      region: string | null;
      city: string | null;
      country: string | null;
      source: string;
    };
    supabase_edge: {
      cf_colo: string | null;
      city: string | null;
      country: string | null;
      source: string;
    };
    supabase_project: {
      ref: string | null;
      region: string | null;
      city: string | null;
      country: string | null;
      source: string;
    };
  };
  checks: ConnectionProbe[];
};

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

function slowTone(ms: number, ok: boolean) {
  if (!ok) return "border-red-200 bg-red-50 text-red-900";
  if (ms > 2500) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function formatPlace(country?: string | null, city?: string | null) {
  return [country, city].filter(Boolean).join(", ") || "Не определено";
}

export default function AdminStatusPage() {
  const { user, session, loading, envOk } = useSession();
  const canUseAdmin = isAdminEmail(user?.email);
  const [report, setReport] = useState<ReleaseStatusReport | null>(null);
  const [connectionRoute, setConnectionRoute] = useState<ConnectionRouteReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [routeBusy, setRouteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [routeMessage, setRouteMessage] = useState("");

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

  async function loadConnectionRoute() {
    if (!session?.access_token || !canUseAdmin) return;
    setRouteBusy(true);
    setRouteMessage("");
    try {
      const resp = await fetch("/api/admin/connection-route", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.route) throw new Error(json?.error || "Не удалось загрузить маршрут подключений");
      setConnectionRoute(json as ConnectionRouteReport);
    } catch (error: any) {
      setRouteMessage(error?.message || "Не удалось загрузить маршрут подключений");
    } finally {
      setRouteBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    loadStatus();
    loadConnectionRoute();
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
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadConnectionRoute} disabled={routeBusy}>
                  {routeBusy ? "Проверяем маршрут…" : "Обновить маршрут"}
                </button>
              </div>
            </div>
            {message ? <div className="mt-3 text-sm text-red-700">{message}</div> : null}
            {routeMessage ? <div className="mt-3 text-sm text-red-700">{routeMessage}</div> : null}
          </section>

          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Маршрут подключений</div>
                <div className="mt-1 text-sm text-slate-500">
                  Показывает, откуда пришел пользователь, где выполнилась Vercel-функция и через какой Cloudflare POP ответил Supabase Edge.
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${connectionRoute ? toneChip(connectionRoute.ok) : "border-slate-200 bg-white text-slate-500"}`}>
                {routeBusy ? "Проверяем" : connectionRoute?.ok ? "STABLE" : "Нужна проверка"}
              </span>
            </div>

            {connectionRoute ? (
              <>
                <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
                  <div className="rounded-3xl border border-emerald-100 bg-white px-4 py-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">1. Пользователь</div>
                    <div className="mt-3 text-lg font-semibold text-slate-950">
                      {formatPlace(connectionRoute.route.visitor.country, connectionRoute.route.visitor.city)}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">
                      country={connectionRoute.route.visitor.country_code || "?"}, region={connectionRoute.route.visitor.region || "?"}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{connectionRoute.route.visitor.source}</div>
                  </div>
                  <div className="hidden items-center text-xl font-semibold text-emerald-700 xl:flex">-&gt;</div>
                  <div className="rounded-3xl border border-emerald-100 bg-white px-4 py-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">2. Vercel</div>
                    <div className="mt-3 text-lg font-semibold text-slate-950">
                      {formatPlace(connectionRoute.route.vercel.country, connectionRoute.route.vercel.city)}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">region={connectionRoute.route.vercel.region || "local"}</div>
                    <div className="mt-2 text-xs text-slate-400">{connectionRoute.route.vercel.source}</div>
                  </div>
                  <div className="hidden items-center text-xl font-semibold text-emerald-700 xl:flex">-&gt;</div>
                  <div className="rounded-3xl border border-emerald-100 bg-white px-4 py-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">3. Supabase Edge</div>
                    <div className="mt-3 text-lg font-semibold text-slate-950">
                      {formatPlace(connectionRoute.route.supabase_edge.country, connectionRoute.route.supabase_edge.city)}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">Cloudflare POP={connectionRoute.route.supabase_edge.cf_colo || "?"}</div>
                    <div className="mt-2 text-xs text-slate-400">{connectionRoute.route.supabase_edge.source}</div>
                  </div>
                  <div className="hidden items-center text-xl font-semibold text-emerald-700 xl:flex">-&gt;</div>
                  <div className="rounded-3xl border border-emerald-100 bg-white px-4 py-4 shadow-sm">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">4. Supabase Project</div>
                    <div className="mt-3 text-lg font-semibold text-slate-950">
                      {formatPlace(connectionRoute.route.supabase_project.country, connectionRoute.route.supabase_project.city)}
                    </div>
                    <div className="mt-4 text-xs text-slate-500">region={connectionRoute.route.supabase_project.region || "не задан"}</div>
                    <div className="mt-2 text-xs text-slate-400">ref={connectionRoute.route.supabase_project.ref || "?"}</div>
                    <div className="mt-2 text-xs text-slate-400">{connectionRoute.route.supabase_project.source}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Общее время: <span className="font-semibold text-slate-950">{connectionRoute.total_ms} мс</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Runtime: <span className="font-semibold text-slate-950">{connectionRoute.runtime}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    Проверено: <span className="font-semibold text-slate-950">{new Date(connectionRoute.checked_at).toLocaleString("ru-RU")}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {connectionRoute.checks.map((item) => (
                    <div key={item.name} className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${slowTone(item.ms, item.ok)}`}>
                          {item.ok ? item.ms > 2500 ? "SLOW" : "STABLE" : "BROKEN"}
                        </span>
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-slate-950">{item.status || "ERR"} · {item.ms} мс</div>
                      <div className="mt-2 break-all text-xs text-slate-500">{item.url}</div>
                      <div className="mt-3 text-xs text-slate-600">
                        POP={item.headers.cf_colo || "?"} · страна={item.headers.cf_colo_country || "?"} · project={item.headers.sb_project_ref || "?"}
                      </div>
                      {item.error ? (
                        <div className="mt-3 rounded-2xl bg-red-950 px-4 py-3 font-mono text-xs text-red-50">{item.error}</div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Важно: путь браузер -&gt; Supabase может скрывать POP из-за CORS, поэтому здесь самый точный замер для серверного пути Vercel -&gt; Supabase. Именно через него теперь идут кошелек, refresh сессии и часть авторизации.
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                {routeBusy ? "Проверяем маршрут подключений…" : "Маршрут еще не загружен."}
              </div>
            )}
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
                    <div className="mt-1 text-xs text-slate-500">Профиль, кабинет, подписка, проект, results-map, AI evaluation, unlock access, test access, purchase access</div>
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
