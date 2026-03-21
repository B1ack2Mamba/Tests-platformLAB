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
        setError(e?.message || "Ошибка");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, session, sessionLoading, user]);

  return (
    <Layout title="Мои результаты">
      {error ? <div className="mb-4 card text-sm text-red-600">{error}</div> : null}
      <div className="grid gap-3">
        {rows.map((row) => {
          const top = Array.isArray(row.result?.ranked) ? [...row.result.ranked].sort((a: any, b: any) => Number(b?.percent || 0) - Number(a?.percent || 0))[0] : null;
          return (
            <div key={row.id} className="card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-950">{row.test_title || row.test_slug}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(row.created_at)}</div>
                  {top ? <div className="mt-2 text-sm text-slate-700">Топ-фактор: <b>{top.style}</b> ({top.percent}%)</div> : null}
                </div>
                <Link href={`/results/${encodeURIComponent(row.id)}`} className="btn btn-primary">Открыть</Link>
              </div>
            </div>
          );
        })}

        {!rows.length && !loading ? (
          <div className="card text-sm text-slate-600">
            Пока нет сохранённых результатов. Пройди любой тест из каталога — и результат появится здесь.
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
