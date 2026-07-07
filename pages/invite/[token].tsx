import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import { Layout } from "@/components/Layout";
import { formatEstimatedMinutes, getTestDisplayTitle, getTestEstimatedMinutes, getTotalEstimatedMinutes } from "@/lib/testTitles";
import { flushPublicAttemptQueue, getQueuedPublicAttempts } from "@/lib/publicAttemptQueue";

type InvitePageProps = {
  notFound?: boolean;
  project?: {
    title: string;
    goal: string;
    person_name: string | null;
    target_role: string | null;
    status: string;
    package_mode?: string | null;
    tests: Array<{ test_slug: string; test_title: string; sort_order: number }>;
    attempts: Array<{ test_slug: string; created_at: string }>;
  };
  token?: string;
  doneSlug?: string | null;
};

export default function InvitePage({ notFound, project, token, doneSlug }: InvitePageProps) {
  const router = useRouter();
  const [syncState, setSyncState] = useState<{
    status: "idle" | "syncing" | "failed";
    queuedSlugs: string[];
    error?: string;
  }>({ status: "idle", queuedSlugs: [] });

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const queued = getQueuedPublicAttempts(token);
    if (!queued.length) return;

    setSyncState({ status: "syncing", queuedSlugs: queued.map((item) => item.test_slug) });

    flushPublicAttemptQueue({ token }).then((result) => {
      if (cancelled) return;

      const remaining = getQueuedPublicAttempts(token);
      if (result.sent > 0) {
        router.replace(router.asPath, undefined, { scroll: false });
        return;
      }

      setSyncState({
        status: remaining.length ? "failed" : "idle",
        queuedSlugs: remaining.map((item) => item.test_slug),
        error: result.errors[0],
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (notFound || !project || !token) {
    return (
      <Layout title="Приглашение не найдено">
        <div className="card text-sm text-slate-700">Ссылка недействительна или проект уже недоступен.</div>
      </Layout>
    );
  }

  const doneSet = new Set([
    ...(project.attempts || []).map((item) => item.test_slug),
    ...syncState.queuedSlugs,
  ]);
  const completed = doneSet.size;
  const total = project.tests.length;
  const fullyDone = total > 0 && completed >= total;
  const packageLabel = project.package_mode === "basic" ? "База" : project.package_mode === "premium_ai_plus" ? "Премиум AI+" : "Премиум";
  const totalMinutes = getTotalEstimatedMinutes(project.tests.map((test) => test.test_slug));

  return (
    <Layout title={project.title || "Оценка сотрудника"}>
      <div className="mx-auto max-w-5xl grid gap-4">
        {doneSlug ? (
          <div className="card border-emerald-200 bg-emerald-50/70 text-sm text-emerald-900">
            Тест <b>{getTestDisplayTitle(doneSlug, doneSlug)}</b> принят. Результаты увидит только специалист. Здесь можно продолжить остальные тесты.
          </div>
        ) : null}

        {syncState.status === "syncing" ? (
          <div className="card border-amber-200 bg-amber-50/80 text-sm leading-6 text-amber-900">
            Результат уже посчитан на этом устройстве. Досылаем его специалисту, если связь на предыдущем шаге была нестабильной.
          </div>
        ) : syncState.status === "failed" ? (
          <div className="card border-amber-200 bg-amber-50/80 text-sm leading-6 text-amber-900">
            Результат сохранён на этом устройстве, но пока не отправился специалисту из-за связи. Оставьте эту страницу открытой или обновите её позже, система попробует отправить повторно.
            {syncState.error ? <div className="mt-2 text-xs text-amber-800">Причина: {syncState.error}</div> : null}
          </div>
        ) : null}

        <div className="card">
          <div className="text-xs uppercase tracking-wide text-slate-500">Оценка сотрудника</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{project.person_name || "Участник"}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            {project.target_role ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Будущая предполагаемая должность: {project.target_role}</span> : null}
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Пройдено: {completed} / {total}</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Общее время: примерно {formatEstimatedMinutes(totalMinutes)}</span>
          </div>
          <div className="mt-4 text-sm leading-6 text-slate-700">
            Пройди назначенные тесты по очереди. После каждого завершения ты вернёшься сюда. Цифры и результаты увидит только специалист.
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card">
            <div className="text-sm font-semibold text-slate-900">Назначенные тесты</div>
            <div className="mt-4 grid gap-3">
              {project.tests.map((test, index) => {
                const done = doneSet.has(test.test_slug);
                return (
                  <div key={test.test_slug} className={`rounded-2xl border p-4 ${done ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-500">Тест {index + 1}</div>
                        <div className="mt-1 text-base font-semibold text-slate-950">{test.test_title}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">{formatEstimatedMinutes(getTestEstimatedMinutes(test.test_slug))}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                        {done ? "Завершён" : "Ожидает"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/tests/${test.test_slug}/take?invite=${encodeURIComponent(token)}`} className="btn btn-primary btn-sm">
                        {done ? "Пройти заново" : "Открыть тест"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 content-start">
            <div className="card">
              <div className="text-sm font-semibold text-slate-900">Как это работает</div>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <li>• проходи тесты в удобном порядке;</li>
                <li>• после каждого теста ты возвращаешься на эту страницу;</li>
                <li>• результаты не показываются участнику;</li>
                <li>• специалист увидит итог в своём кабинете.</li>
              </ul>
            </div>
            <div className="card">
              <div className="text-sm font-semibold text-slate-900">Статус прохождения</div>
              <div className="mt-3 text-3xl font-semibold text-slate-950">{completed} / {total}</div>
              <div className="mt-2 text-sm text-slate-600">{fullyDone ? `Все тесты завершены. Специалист получит ${packageLabel === "База" ? "итоговые результаты тестов" : packageLabel === "Премиум" ? "интерпретации по каждому тесту" : "индивидуальный профиль и индекс соответствия"}.` : "Пока не все тесты завершены."}</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export async function getServerSideProps({ params, query }: { params: { token: string }, query: { done?: string } }) {
  const token = typeof params?.token === "string" ? params.token : "";
  if (!token) return { notFound: true };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { notFound: true };

  const supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabaseAdmin
    .from("commercial_projects")
    .select(`
      title,
      goal,
      target_role,
      status,
      package_mode,
      commercial_people(full_name),
      commercial_project_tests(test_slug, test_title, sort_order),
      commercial_project_attempts(test_slug, created_at)
    `)
    .eq("invite_token", token)
    .maybeSingle();

  if (error || !data) return { notFound: true };

  return {
    props: {
      token,
      doneSlug: typeof query.done === "string" ? query.done : null,
      project: {
        title: (data as any).title,
        goal: (data as any).goal,
        person_name: (data as any).commercial_people?.full_name || null,
        target_role: (data as any).target_role || null,
        status: (data as any).status || "draft",
        package_mode: (data as any).package_mode || "premium",
        tests: ((data as any).commercial_project_tests || [])
          .map((test: any) => ({
            ...test,
            test_title: getTestDisplayTitle(test?.test_slug, test?.test_title),
          }))
          .sort((a: any, b: any) => a.sort_order - b.sort_order),
        attempts: (data as any).commercial_project_attempts || [],
      },
    },
  };
}
