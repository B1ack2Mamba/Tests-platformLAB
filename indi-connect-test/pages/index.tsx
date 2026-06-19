import Head from "next/head";
import { useEffect, useState } from "react";

const DEFAULT_SUPABASE_URL = "https://npgrkyqtgdhzdsabkhxg.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_cxQoCPqxNwDa1krM-C8jyA_TXEt21Sr";

type Sample = {
  status: number;
  ok: boolean;
  ms: number;
  bytes: number;
  headers?: {
    cf_ray: string | null;
    cf_colo: string | null;
    sb_project_ref: string | null;
    server: string | null;
  };
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

type RouteInfo = {
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
    ref: string;
    region: string;
    city: string;
    country: string;
    source: string;
  };
};

type ServerPing = {
  ok: boolean;
  total_ms: number;
  server_time: string;
  runtime: string;
  vercel_region: string | null;
  route?: RouteInfo;
  checks: Array<{
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
      x_vercel_id: string | null;
    };
    error?: string;
  }>;
};

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

function parseCfColo(cfRay: string | null) {
  if (!cfRay) return null;
  return cfRay.split("-").pop() || null;
}

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
    const cfRay = response.headers.get("cf-ray");
    return {
      status: response.status,
      ok: response.ok,
      ms: Date.now() - started,
      bytes: text.length,
      headers: {
        cf_ray: cfRay,
        cf_colo: parseCfColo(cfRay),
        sb_project_ref: response.headers.get("sb-project-ref"),
        server: response.headers.get("server"),
      },
      error: response.ok ? undefined : text.slice(0, 180),
    };
  } catch (error: any) {
    return {
      status: 0,
      ok: false,
      ms: Date.now() - started,
      bytes: 0,
      headers: {
        cf_ray: null,
        cf_colo: null,
        sb_project_ref: null,
        server: null,
      },
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

function formatPlace(country?: string | null, city?: string | null) {
  if (country && city) return `${country}, ${city}`;
  return country || city || "Detecting...";
}

function StatusPill({ value }: { value: string }) {
  return <span className={`pill pill-${value}`}>{value}</span>;
}

function RouteNode({
  label,
  place,
  detail,
  source,
}: {
  label: string;
  place: string;
  detail: string;
  source: string;
}) {
  return (
    <article className="routeNode">
      <span>{label}</span>
      <strong>{place}</strong>
      <small>{detail}</small>
      <em>{source}</em>
    </article>
  );
}

function BrowserPopLine({ summary }: { summary: ProbeSummary }) {
  const sampleWithPop = summary.samples.find((sample) => sample.headers?.cf_colo);
  const sampleWithProject = summary.samples.find((sample) => sample.headers?.sb_project_ref);
  return (
    <p className="routeMeta">
      Browser Supabase POP: {sampleWithPop?.headers?.cf_colo || "hidden by CORS"}
      {sampleWithProject?.headers?.sb_project_ref ? ` | project: ${sampleWithProject.headers.sb_project_ref}` : ""}
    </p>
  );
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
    setLastRun(new Date().toISOString());

    try {
      const serverResponse = await fetch("/api/server-ping", { cache: "no-store" });
      setServerPing(await serverResponse.json());
    } catch (error: any) {
      setClientError(`Could not call /api/server-ping: ${error?.message || String(error)}`);
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
        <title>Indi Supabase Connection Route Test</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="shell">
        <section className="hero">
          <div>
            <p className="eyebrow">Supabase Indi probe</p>
            <h1>Connection route test</h1>
            <p className="lead">
              This page shows where traffic goes: user country, Vercel server region, Supabase edge country,
              and the Supabase project region. Use it with VPN off and then with VPN on.
            </p>
          </div>
          <button className="runButton" disabled={running} onClick={runAll}>
            {running ? "Checking..." : "Run again"}
          </button>
        </section>

        <section className="metaGrid">
          <div className="metaCard">
            <span>Supabase project</span>
            <strong>npgrkyqtgdhzdsabkhxg</strong>
            <small>{supabaseUrl}</small>
          </div>
          <div className="metaCard">
            <span>Run time</span>
            <strong>{lastRun || "..."}</strong>
            <small>Runs automatically on page load</small>
          </div>
          <div className="metaCard">
            <span>Browser network</span>
            <strong>{typeof navigator !== "undefined" && navigator.onLine ? "online" : "unknown"}</strong>
            <small>
              {connection
                ? `${connection.effectiveType || "type ?"} / downlink ${connection.downlink || "?"}`
                : "Network Information API is unavailable"}
            </small>
          </div>
        </section>

        <section className="routePanel">
          <div className="panelTitle">
            <h2>Traffic route by country</h2>
            {serverPing?.route ? <StatusPill value="stable" /> : <StatusPill value="slow" />}
          </div>
          <div className="routeFlow">
            <RouteNode
              label="1. User"
              place={formatPlace(serverPing?.route?.visitor.country, serverPing?.route?.visitor.city)}
              detail={
                serverPing?.route?.visitor.country_code
                  ? `country=${serverPing.route.visitor.country_code}${serverPing.route.visitor.region ? `, region=${serverPing.route.visitor.region}` : ""}`
                  : "Geo appears after Vercel response"
              }
              source="Vercel geolocation headers"
            />
            <div className="routeArrow">{"->"}</div>
            <RouteNode
              label="2. Vercel"
              place={formatPlace(serverPing?.route?.vercel.country, serverPing?.route?.vercel.city)}
              detail={serverPing?.route?.vercel.region ? `region=${serverPing.route.vercel.region}` : "Region appears on Vercel"}
              source="VERCEL_REGION"
            />
            <div className="routeArrow">{"->"}</div>
            <RouteNode
              label="3. Supabase edge"
              place={formatPlace(serverPing?.route?.supabase_edge.country, serverPing?.route?.supabase_edge.city)}
              detail={
                serverPing?.route?.supabase_edge.cf_colo
                  ? `Cloudflare POP=${serverPing.route.supabase_edge.cf_colo}`
                  : "Cloudflare POP not visible yet"
              }
              source="Supabase cf-ray header"
            />
            <div className="routeArrow">{"->"}</div>
            <RouteNode
              label="4. Supabase project"
              place={formatPlace(serverPing?.route?.supabase_project.country, serverPing?.route?.supabase_project.city)}
              detail={serverPing?.route?.supabase_project.region || "ap-south-1"}
              source="Indi project region"
            />
          </div>
          <p className="routeNote">
            The server route is exact for Vercel to Supabase because Vercel can read response headers.
            Browser to Supabase may hide Cloudflare POP headers because of CORS, but status and timeout samples still show if the route works.
          </p>
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
                <span>Total time</span>
                <strong>{serverPing.total_ms} ms</strong>
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
            <p className="muted">Waiting for server response...</p>
          )}
          <div className="cards">
            {serverPing?.checks.map((check) => (
              <article className="resultCard" key={check.name}>
                <div className="resultTop">
                  <h3>{check.name}</h3>
                  <StatusPill value={check.ok ? "stable" : "broken"} />
                </div>
                <p className="metric">{check.ms} ms</p>
                <p className="url">{check.url}</p>
                <p className="routeMeta">
                  Supabase POP: {check.headers.cf_colo || "not visible"} | country: {check.headers.cf_colo_country || "unknown"} |
                  project: {check.headers.sb_project_ref || "not visible"}
                </p>
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
                  {summary.okCount}/{summary.samples.length} ok - avg {summary.avgMs} ms - max {summary.maxMs} ms
                </p>
                <p className="url">{summary.url}</p>
                <div className="sampleList">
                  {summary.samples.map((sample, index) => (
                    <span className={sample.ok ? "sampleOk" : "sampleBad"} key={index}>
                      {sample.status || "ERR"} - {sample.ms}ms
                    </span>
                  ))}
                </div>
                <BrowserPopLine summary={summary} />
                {summary.samples.some((sample) => sample.error) ? (
                  <pre>{summary.samples.find((sample) => sample.error)?.error}</pre>
                ) : null}
              </article>
            ))}
          </div>
          {!clientResults.length ? <p className="muted">Browser checks are starting...</p> : null}
        </section>

        <section className="help">
          <h2>How to read it</h2>
          <p>
            If Vercel is green but Browser is red, Vercel can reach Supabase but the user network cannot.
            If User country is Russia and the Browser block is slow or broken, the issue is likely on the direct user-to-Supabase path.
            If both Vercel and Browser are green, the main site issue is more likely heavy assets, browser cache, or network switching.
          </p>
        </section>
      </main>
    </>
  );
}
