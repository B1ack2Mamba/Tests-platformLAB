import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { LineChart } from "@/components/LineChart";
import { useSession } from "@/lib/useSession";
import type { ScoreResult } from "@/lib/score";
import { interpretationToDisplayText } from "@/lib/testInterpretationText";

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
  const [authorContent, setAuthorContent] = useState<any>(null);
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

  useEffect(() => {
    if (!attemptId || !data?.test_slug || !session?.access_token) return;

    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/tests/interpretation", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ attempt_id: attemptId, test_slug: data.test_slug }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok || cancelled) return;
        setAuthorContent(json.content ?? null);
      } catch {
        // Best-effort only.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId, data?.test_slug, session?.access_token]);

  const result = data?.result;
  const resultRows = useMemo(() => (Array.isArray(result?.ranked) ? result.ranked : []), [result]);
  const chartData = useMemo(() => resultRows.map((r) => ({ tag: r.tag, percent: r.percent })), [resultRows]);
  const isNumericPrimary = result?.kind === "usk_v1" || result?.kind === "16pf_v1";
  const interpretationText = useMemo(() => interpretationToDisplayText(authorContent), [authorContent]);
  const topResult = useMemo(() => {
    return resultRows.length
      ? [...resultRows].sort((a, b) => Number(b?.percent ?? b?.count ?? 0) - Number(a?.percent ?? a?.count ?? 0))[0]
      : null;
  }, [resultRows]);

  return (
    <Layout title={data?.test_title || "Результат"}>
      {error ? <div className="mb-4 card text-sm text-red-600">{error}</div> : null}
      {loading ? <div className="mb-4 card text-sm text-slate-600">Загрузка…</div> : null}
      {!data || !result ? null : (
        <>
          <div className="mb-4 card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Каталожный тест</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{data.test_title || data.test_slug}</div>
                <div className="mt-2 text-sm text-slate-600">
                  Один тест + краткая интерпретация из методички.
                </div>
              </div>
              {topResult ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">Ведущий показатель</div>
                  <div className="mt-1 font-semibold">{topResult.style}</div>
                </div>
              ) : null}
            </div>
          </div>

          {interpretationText ? (
            <div className="mb-4 card">
              <div className="mb-3 text-sm font-medium text-zinc-900">Краткая интерпретация из методички</div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-800">{interpretationText}</div>
            </div>
          ) : null}

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
                  {resultRows.map((r, idx) => {
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
              <Link href={`/tests/${encodeURIComponent(data.test_slug)}`} className="btn btn-secondary">К тесту</Link>
            </div>
          </div>

          {!resultRows.length ? (
            <div className="mt-4 card text-sm text-slate-600">
              Результат сохранён, но таблица показателей не найдена. Попробуйте открыть тест заново или пройти его ещё раз.
            </div>
          ) : null}

        </>
      )}
    </Layout>
  );
}
