import type { NextApiRequest } from "next";

export type ReleaseStatusCheck = {
  path: string;
  label: string;
  method?: "GET" | "POST";
  expected: string[];
};

export type ReleaseStatusCheckResult = {
  label: string;
  path: string;
  method: "GET" | "POST";
  ok: boolean;
  status: number;
  ms: number;
  preview: string;
  error?: string | null;
};

export type ReleaseStatusReport = {
  ok: boolean;
  checked_at: string;
  target: string;
  duration_ms: number;
  health: {
    ok: boolean;
    status: number;
    ms: number;
    version: string | null;
    request_id: string | null;
    preview: string;
  };
  smoke_prod: {
    ok: boolean;
    checks: ReleaseStatusCheckResult[];
  };
  smoke_auth: {
    ok: boolean;
    checks: ReleaseStatusCheckResult[];
  };
};

function readEnv(key: string, fallback = "") {
  return String(process.env[key] ?? fallback).trim();
}

function normalizeBaseUrl(url: string) {
  return String(url || "").replace(/\/+$/, "");
}

export function resolveAppUrl(req?: NextApiRequest) {
  const explicit = normalizeBaseUrl(readEnv("APP_URL", ""));
  if (explicit) return explicit;
  const host = String(req?.headers["x-forwarded-host"] || req?.headers.host || "tests-platform-lab.vercel.app");
  const proto = String(req?.headers["x-forwarded-proto"] || "https");
  return normalizeBaseUrl(`${proto}://${host}`);
}

export function getPublicStatusChecks(): ReleaseStatusCheck[] {
  return [
    { path: "/", label: "landing", expected: ["Лаборатория кадров"] },
    { path: "/login", label: "login", expected: ["Лаборатория кадров", "Кабинет оценки персонала"] },
    { path: "/wallet", label: "wallet", expected: ['"page":"/wallet"'] },
    { path: "/api/health", label: "health", expected: ['"ok":true'] },
    {
      path: readEnv("SMOKE_INVITE_PATH", "/invite/84f535b7722203030592a17b57433864"),
      label: "invite",
      expected: ["Назначенные тесты", "Пройдено:", "Общее время:"],
    },
    {
      path: readEnv("SMOKE_PROJECT_PATH", "/projects/b1a327b5-946b-48fb-910e-ff6dbe5db2ba"),
      label: "project",
      expected: ['"page":"/projects/[projectId]"'],
    },
    {
      path: readEnv("SMOKE_RESULTS_PATH", "/projects/1080efe5-1250-44bc-aead-a6e927a2dfe9/results"),
      label: "results",
      expected: ['"page":"/projects/[projectId]/results"'],
    },
  ];
}

export function getAuthStatusChecks(): ReleaseStatusCheck[] {
  const projectId = encodeURIComponent(readEnv("SMOKE_PROJECT_ID", "1080efe5-1250-44bc-aead-a6e927a2dfe9"));
  const evaluationMode = encodeURIComponent(readEnv("SMOKE_EVALUATION_MODE", "premium_ai_plus"));
  const evaluationStage = encodeURIComponent(readEnv("SMOKE_EVALUATION_STAGE", "summary"));
  const testSlug = encodeURIComponent(readEnv("SMOKE_TEST_SLUG", "negotiation-style"));

  return [
    {
      path: "/api/commercial/profile/me",
      label: "profile",
      method: "GET",
      expected: ['"ok":true', '"profile"', '"stats"'],
    },
    {
      path: "/api/commercial/dashboard/bootstrap",
      label: "dashboard-bootstrap",
      method: "GET",
      expected: ['"ok":true', '"workspace"', '"projects"'],
    },
    {
      path: "/api/commercial/subscriptions/status",
      label: "subscription-status",
      method: "GET",
      expected: ['"ok":true', '"workspace"', '"active_subscription"'],
    },
    {
      path: `/api/commercial/projects/get?id=${projectId}`,
      label: "project-get",
      method: "GET",
      expected: ['"ok":true', '"project"', '"tests"'],
    },
    {
      path: `/api/commercial/projects/results-map?id=${projectId}`,
      label: "results-map-collect",
      method: "POST",
      expected: ['"ok":true', '"project"', '"collect_mode":"collect"'],
    },
    {
      path: `/api/commercial/projects/evaluation?id=${projectId}&mode=${evaluationMode}&stage=${evaluationStage}`,
      label: "evaluation-summary",
      method: "GET",
      expected: ['"ok":true', '"evaluation"', '"unlocked_package_mode":"premium_ai_plus"'],
    },
    {
      path: `/api/commercial/projects/unlock-access?id=${projectId}&package_mode=${evaluationMode}`,
      label: "unlock-access",
      method: "GET",
      expected: ['"ok":true', '"can_unlock"', '"upgrade_price_rub"'],
    },
    {
      path: `/api/tests/take-access?slug=${testSlug}`,
      label: "test-take-access",
      method: "GET",
      expected: ['"ok":true', '"price_rub"', '"balance_kopeks"'],
    },
  ];
}

function assertExpectedText(expected: string[], body: string) {
  const lower = body.toLowerCase();
  const missing = expected.filter((item) => !lower.includes(String(item).toLowerCase()));
  return missing.length ? `Expected body to contain: ${missing.map((item) => `"${item}"`).join(", ")}` : null;
}

function buildPreview(body: string, limit = 180) {
  return String(body || "").replace(/\s+/g, " ").slice(0, limit);
}

async function fetchWithRetry(url: string, init: RequestInit) {
  let lastError: unknown = null;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const body = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        body,
        ms: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function runCheck(appUrl: string, check: ReleaseStatusCheck, bearerToken?: string | null): Promise<ReleaseStatusCheckResult> {
  const url = `${appUrl}${check.path}`;
  try {
    const result = await fetchWithRetry(url, {
      method: check.method || "GET",
      headers: {
        "cache-control": "no-cache",
        ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
        ...((check.method || "GET") === "POST" ? { "content-type": "application/json" } : {}),
      },
    });
    const expectationError = result.ok ? assertExpectedText(check.expected || [], result.body) : null;
    return {
      label: check.label,
      path: check.path,
      method: check.method || "GET",
      ok: result.ok && !expectationError,
      status: result.status,
      ms: result.ms,
      preview: buildPreview(result.body),
      error: expectationError,
    };
  } catch (error: any) {
    return {
      label: check.label,
      path: check.path,
      method: check.method || "GET",
      ok: false,
      status: 0,
      ms: 0,
      preview: "",
      error: error?.message || String(error),
    };
  }
}

async function fetchHealth(appUrl: string) {
  const startedAt = Date.now();
  const response = await fetch(`${appUrl}/api/health`, {
    method: "GET",
    headers: { "cache-control": "no-cache" },
  });
  const body = await response.json().catch(() => ({}));
  return {
    ok: response.ok && body?.ok === true,
    status: response.status,
    ms: Date.now() - startedAt,
    body,
  };
}

export async function buildReleaseStatusReport(args: {
  req?: NextApiRequest;
  bearerToken?: string | null;
}) {
  const startedAt = Date.now();
  const appUrl = resolveAppUrl(args.req);
  const health = await fetchHealth(appUrl);
  const publicChecks = await Promise.all(getPublicStatusChecks().map((check) => runCheck(appUrl, check)));
  const authChecks = args.bearerToken
    ? await Promise.all(getAuthStatusChecks().map((check) => runCheck(appUrl, check, args.bearerToken)))
    : [];

  const report: ReleaseStatusReport = {
    ok: health.ok && publicChecks.every((item) => item.ok) && authChecks.every((item) => item.ok),
    checked_at: new Date().toISOString(),
    target: appUrl,
    duration_ms: Date.now() - startedAt,
    health: {
      ok: health.ok,
      status: health.status,
      ms: health.ms,
      version: health.body?.version || null,
      request_id: health.body?.request_id || null,
      preview: buildPreview(JSON.stringify(health.body || {})),
    },
    smoke_prod: {
      ok: publicChecks.every((item) => item.ok),
      checks: publicChecks,
    },
    smoke_auth: {
      ok: authChecks.every((item) => item.ok),
      checks: authChecks,
    },
  };

  return report;
}
