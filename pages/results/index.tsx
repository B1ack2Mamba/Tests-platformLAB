import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";

type AttemptRow = {
  id: string;
  test_slug: string;
  test_title: string;
  created_at: string;
  result: any;
};

function formatDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("ru-RU");
}

function formatShortDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function topResult(result: any) {
  return Array.isArray(result?.ranked)
    ? [...result.ranked].sort((a: any, b: any) => Number(b?.percent ?? b?.count ?? 0) - Number(a?.percent ?? a?.count ?? 0))[0] || null
    : null;
}

function resultValue(row: any) {
  const percent = Number(row?.percent);
  const count = Number(row?.count);
  if (Number.isFinite(percent)) return `${Math.round(percent)}%`;
  if (Number.isFinite(count)) return `${Math.round(count)} балл.`;
  return "не указано";
}

export default function ResultsPage() {
  const { session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    if (!session || !user) {
      router.replace("/auth?next=%2Fresults");
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await fetch("/api/commercial/attempts/list", {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить результаты");
        setRows(json.attempts || []);
      } catch (e: any) {
        setError(e?.message || "Ошибка загрузки результатов");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, session, sessionLoading, user]);

  return (
    <Layout title="Мои результаты">
      {error ? <div className="mb-4 card text-sm text-red-600">{error}</div> : null}
      <div className="mb-4 card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-950">История тестов из каталога</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">
              Здесь сохраняются отдельные прохождения из каталога и краткие интерпретации по методичке.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/assessments" className="btn btn-secondary">
              К каталогу
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
              <div className="text-xs uppercase tracking-wide text-slate-500">Всего результатов</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{rows.length}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="mb-4 card text-sm text-slate-600">Загружаю историю...</div> : null}

      <div className="grid gap-3">
        {rows.map((row) => {
          const top = topResult(row.result);
          const factorsCount = Array.isArray(row.result?.ranked) ? row.result.ranked.length : 0;
          return (
            <div key={row.id} className="card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-lg font-semibold text-slate-950">{row.test_title || row.test_slug}</div>
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      краткая интерпретация
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{formatShortDate(row.created_at)} - {formatDate(row.created_at)}</div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    {top ? (
                      <div className="rounded-2xl border border-slate-200 bg-white/65 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Ведущий показатель</div>
                        <div className="mt-1 font-medium text-slate-950">{top.style}</div>
                        <div className="mt-1 text-xs text-slate-500">{resultValue(top)} - {top.level || "уровень не указан"}</div>
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-slate-200 bg-white/65 p-3">
                      <div className="text-xs uppercase tracking-wide text-slate-500">Профиль</div>
                      <div className="mt-1 font-medium text-slate-950">{factorsCount || "нет"} показателей</div>
                      <div className="mt-1 text-xs text-slate-500">Открывается таблица и вывод по методичке</div>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/results/${encodeURIComponent(row.id)}`} className="btn btn-primary">Открыть результат</Link>
                  <Link href={`/tests/${row.test_slug}`} className="btn btn-secondary">К тесту</Link>
                </div>
              </div>
            </div>
          );
        })}

        {!rows.length && !loading ? (
          <div className="card text-sm leading-6 text-slate-600">
            Пока нет сохранённых результатов. Пройдите любой тест из каталога, и результат появится здесь.
            <div className="mt-4">
              <Link href="/assessments" className="btn btn-primary">
                Открыть каталог
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
