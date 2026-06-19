import Head from "next/head";
import { useEffect, useState } from "react";

const DEFAULT_SUPABASE_URL = "https://npgrkyqtgdhzdsabkhxg.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_cxQoCPqxNwDa1krM-C8jyA_TXEt21Sr";

type Sample = {
  status: number;
  ok: boolean;
  ms: number;
  bytes: number;
  error?: string;
};

type ProbeSummary = {
  name: string;
  url: string;
  samples: Sample[];
  okCount: number;
  avgMs: number;
  maxMs: number;
};

type ServerPing = {
  ok: boolean;
  total_ms: number;
  server_time: string;
  runtime: string;
  vercel_region: string | null;
  checks: Array<{
    name: string;
    url: string;
    ok: boolean;
    status: number;
    ms: number;
    bytes: number;
    error?: string;
  }>;
};

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

async function runOne(url: string): Promise<Sample> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${supabaseKey}`,
        "cache-control": "no-cache",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      ms: Date.now() - started,
      bytes: text.length,
      error: response.ok ? undefined : text.slice(0, 180),
    };
  } catch (error: any) {
    return {
      status: 0,
      ok: false,
      ms: Date.now() - started,
      bytes: 0,
      error: error?.message || String(error),
    };
  }
}

async function runProbe(name: string, url: string, samplesCount = 5): Promise<ProbeSummary> {
  const samples: Sample[] = [];
  for (let index = 0; index < samplesCount; index += 1) {
    samples.push(await runOne(url));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const okCount = samples.filter((sample) => sample.ok).length;
  const avgMs = Math.round(samples.reduce((sum, sample) => sum + sample.ms, 0) / samples.length);
  const maxMs = Math.max(...samples.map((sample) => sample.ms));
  return { name, url, samples, okCount, avgMs, maxMs };
}

function verdict(summary: ProbeSummary) {
  if (summary.okCount === summary.samples.length && summary.maxMs < 2500) return "stable";
  if (summary.okCount >= Math.ceil(summary.samples.length * 0.8)) return "slow";
  return "broken";
}

function StatusPill({ value }: { value: string }) {
  return <span className={`pill pill-${value}`}>{value}</span>;
}

export default function Home() {
  const [running, setRunning] = useState(false);
  const [clientResults, setClientResults] = useState<ProbeSummary[]>([]);
  const [serverPing, setServerPing] = useState<ServerPing | null>(null);
  const [lastRun, setLastRun] = useState<string>("");
  const [clientError, setClientError] = useState<string>("");

  const connection =
    typeof navigator !== "undefined"
      ? (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      : null;

  async function runAll() {
    setRunning(true);
    setClientError("");
    setClientResults([]);
    setServerPing(null);
    setLastRun(new Date().toLocaleString("ru-RU"));

    try {
      const serverResponse = await fetch("/api/server-ping", { cache: "no-store" });
      setServerPing(await serverResponse.json());
    } catch (error: any) {
      setClientError(`Не удалось вызвать /api/server-ping: ${error?.message || String(error)}`);
    }

    const probes = [
      ["browser -> Supabase auth settings", `${supabaseUrl}/auth/v1/settings`],
      ["browser -> Supabase tests REST", `${supabaseUrl}/rest/v1/tests?select=slug,title&limit=5`],
    ] as const;

    const results: ProbeSummary[] = [];
    for (const [name, url] of probes) {
      const result = await runProbe(name, url);
      results.push(result);
      setClientResults([...results]);
    }
    setRunning(false);
  }

  useEffect(() => {
    runAll();
  }, []);

  return (
    <>
      <Head>
        <title>Indi Supabase Connection Test</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Supabase Indi probe</p>
            <h1>Проверка связи без VPN</h1>
            <p className="lead">
              Эта страница отдельно проверяет браузер пользователя и сервер Vercel. Если без VPN не грузится основной сайт,
              здесь будет видно, где именно обрывается путь.
            </p>
          </div>
          <button className="runButton" disabled={running} onClick={runAll}>
            {running ? "Проверяю..." : "Повторить проверку"}
          </button>
        </section>

        <section className="metaGrid">
          <div className="metaCard">
            <span>Supabase</span>
            <strong>npgrkyqtgdhzdsabkhxg</strong>
            <small>{supabaseUrl}</small>
          </div>
          <div className="metaCard">
            <span>Запуск</span>
            <strong>{lastRun || "..."}</strong>
            <small>Автоматически при открытии</small>
          </div>
          <div className="metaCard">
            <span>Сеть браузера</span>
            <strong>{typeof navigator !== "undefined" && navigator.onLine ? "online" : "unknown"}</strong>
            <small>
              {connection
                ? `${connection.effectiveType || "type ?"} / downlink ${connection.downlink || "?"}`
                : "Network Information API недоступен"}
            </small>
          </div>
        </section>

        {clientError ? <div className="warning">{clientError}</div> : null}

        <section className="panel">
          <div className="panelTitle">
            <h2>Vercel server {"->"} Supabase Indi</h2>
            {serverPing ? <StatusPill value={serverPing.ok ? "stable" : "broken"} /> : <StatusPill value="slow" />}
          </div>
          {serverPing ? (
            <div className="serverGrid">
              <div>
                <span>Общее время</span>
                <strong>{serverPing.total_ms} мс</strong>
              </div>
              <div>
                <span>Vercel region</span>
                <strong>{serverPing.vercel_region || "local"}</strong>
              </div>
              <div>
                <span>Runtime</span>
                <strong>{serverPing.runtime}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">Жду ответ сервера...</p>
          )}
          <div className="cards">
            {serverPing?.checks.map((check) => (
              <article className="resultCard" key={check.name}>
                <div className="resultTop">
                  <h3>{check.name}</h3>
                  <StatusPill value={check.ok ? "stable" : "broken"} />
                </div>
                <p className="metric">{check.ms} мс</p>
                <p className="url">{check.url}</p>
                {check.error ? <pre>{check.error}</pre> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle">
            <h2>Browser {"->"} Supabase Indi</h2>
            {running ? <StatusPill value="slow" /> : null}
          </div>
          <div className="cards">
            {clientResults.map((summary) => (
              <article className="resultCard" key={summary.name}>
                <div className="resultTop">
                  <h3>{summary.name}</h3>
                  <StatusPill value={verdict(summary)} />
                </div>
                <p className="metric">
                  {summary.okCount}/{summary.samples.length} ok · avg {summary.avgMs} мс · max {summary.maxMs} мс
                </p>
                <p className="url">{summary.url}</p>
                <div className="sampleList">
                  {summary.samples.map((sample, index) => (
                    <span className={sample.ok ? "sampleOk" : "sampleBad"} key={index}>
                      {sample.status || "ERR"} · {sample.ms}мс
                    </span>
                  ))}
                </div>
                {summary.samples.some((sample) => sample.error) ? (
                  <pre>{summary.samples.find((sample) => sample.error)?.error}</pre>
                ) : null}
              </article>
            ))}
          </div>
          {!clientResults.length ? <p className="muted">Проверка браузера запускается...</p> : null}
        </section>

        <section className="help">
          <h2>Как читать результат</h2>
          <p>
            Если блок Vercel зелёный, а Browser красный, значит Vercel до Supabase достучался, но сеть пользователя без VPN
            режет или теряет запросы к Supabase. Если оба зелёные, проблема вероятнее в тяжёлых ресурсах основного сайта,
            кешe браузера или переключении сети.
          </p>
        </section>
      </main>
    </>
  );
}
