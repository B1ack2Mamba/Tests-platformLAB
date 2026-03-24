import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { LineChart } from "@/components/LineChart";
import { useSession } from "@/lib/useSession";
import type { ScoreResult } from "@/lib/score";

function levelColor(level: string) {
  const l = String(level || "").toLowerCase();
  if (l.includes("выс")) return "bg-emerald-50 text-emerald-700";
  if (l.includes("сред")) return "bg-amber-50 text-amber-700";
  if (l.includes("низ")) return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

type Payload = {
  id: string;
  test_slug: string;
  test_title: string;
  result: ScoreResult;
  created_at: string;
};

export default function AttemptResultPage() {
  const { session, user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const attemptId = typeof router.query.attemptId === "string" ? router.query.attemptId : "";
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!attemptId || sessionLoading) return;
    if (!session || !user) {
      router.replace(`/auth?next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await fetch(`/api/commercial/attempts/get?id=${encodeURIComponent(attemptId)}`, {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить результат");
        setData(json.attempt);
      } catch (e: any) {
        setError(e?.message || "Ошибка");
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId, router, session, sessionLoading, user]);

  const chartData = useMemo(() => data?.result?.ranked?.map((r) => ({ tag: r.tag, percent: r.percent })) || [], [data]);
  const result = data?.result;
  const isNumericPrimary = result?.kind === "usk_v1" || result?.kind === "16pf_v1";

  return (
    <Layout title={data?.test_title || "Результат"}>
      {error ? <div className="mb-4 card text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="mb-4 card text-sm text-slate-600">Загрузка…</div> : null}
      {!data || !result ? null : (
        <>
          {chartData.length ? (
            <div className="mb-4 card">
              <div className="mb-3 text-sm font-medium text-zinc-900">Профиль</div>
              <LineChart data={chartData} />
            </div>
          ) : null}

          <div className="card">
            <div className="mb-3 text-sm font-medium text-zinc-900">Таблица результатов</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-zinc-700">Фактор</th>
                    <th className="py-2 text-left font-medium text-zinc-700">Значение</th>
                    <th className="py-2 text-left font-medium text-zinc-700">Уровень</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ranked.map((r, idx) => {
                    const stripe = idx % 2 === 0 ? "bg-white/55" : "bg-white/35";
                    return (
                      <tr key={r.tag} className={["border-b align-top", stripe].join(" ")}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2 font-medium text-zinc-900">
                            <span className="inline-flex min-w-6 items-center justify-center rounded-md border bg-white px-1.5 py-0.5 text-[11px] text-zinc-700">{String(r.tag)}</span>
                            <span>{r.style}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-zinc-900">
                          {isNumericPrimary ? <><b>{r.count}</b><span className="text-xs text-zinc-600">/10</span></> : <><b>{r.percent}%</b><span className="text-xs text-zinc-600"> · {r.count}</span></>}
                        </td>
                        <td className="py-3">
                          <span className={["inline-flex rounded-full px-2 py-1 text-xs", levelColor(r.level)].join(" ")}>{r.level}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/results" className="btn btn-secondary">← К результатам</Link>
              <Link href={`/tests/${data.test_slug}`} className="btn btn-secondary">К тесту</Link>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
