import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const LOCAL_ENV = {
  ...loadDotEnvFile(path.join(process.cwd(), ".env")),
  ...loadDotEnvFile(path.join(process.cwd(), ".env.local")),
  ...process.env,
};

function readEnv(key, fallback = "") {
  return String(LOCAL_ENV[key] ?? fallback).trim();
}

const APP_URL = readEnv("APP_URL", "https://tests-platform-lab.vercel.app").replace(/\/+$/, "");

async function resolveBearerToken() {
  const direct = readEnv("SMOKE_BEARER_TOKEN") || readEnv("BEARER_TOKEN");
  if (direct) return direct;

  const email = readEnv("SMOKE_USER_EMAIL");
  const password = readEnv("SMOKE_USER_PASSWORD");
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (email && password && supabaseUrl && supabaseKey) {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${supabaseKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.access_token) {
      throw new Error(`Email auth failed: ${body?.error_description || body?.msg || response.statusText}`);
    }
    return String(body.access_token);
  }

  const firstName = readEnv("SMOKE_USER_FIRST_NAME");
  const lastName = readEnv("SMOKE_USER_LAST_NAME");
  const namePassword = readEnv("SMOKE_USER_PASSWORD");

  if (firstName && lastName && namePassword) {
    const response = await fetch(`${APP_URL}/api/auth/name-login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        password: namePassword,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.session?.access_token) {
      throw new Error(`Name auth failed: ${body?.error || response.statusText}`);
    }
    return String(body.session.access_token);
  }

  throw new Error(
    "Missing auth smoke credentials. Set SMOKE_BEARER_TOKEN, or SMOKE_USER_EMAIL/SMOKE_USER_PASSWORD, or SMOKE_USER_FIRST_NAME/SMOKE_USER_LAST_NAME/SMOKE_USER_PASSWORD."
  );
}

let bearerPromise = null;

async function getBearerToken() {
  if (!bearerPromise) bearerPromise = resolveBearerToken();
  return bearerPromise;
}

const DEFAULT_CHECKS = [
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
    path: `/api/commercial/projects/get?id=${encodeURIComponent(
      readEnv("SMOKE_PROJECT_ID", "1080efe5-1250-44bc-aead-a6e927a2dfe9")
    )}`,
    label: "project-get",
    method: "GET",
    expected: ['"ok":true', '"project"', '"tests"'],
  },
  {
    path: `/api/commercial/projects/results-map?id=${encodeURIComponent(
      readEnv("SMOKE_PROJECT_ID", "1080efe5-1250-44bc-aead-a6e927a2dfe9")
    )}`,
    label: "results-map-collect",
    method: "POST",
    expected: ['"ok":true', '"project"', '"collect_mode":"collect"'],
  },
  {
    path:
      `/api/commercial/projects/evaluation?id=${encodeURIComponent(
        readEnv("SMOKE_PROJECT_ID", "1080efe5-1250-44bc-aead-a6e927a2dfe9")
      )}` +
      `&mode=${encodeURIComponent(readEnv("SMOKE_EVALUATION_MODE", "premium_ai_plus"))}` +
      `&stage=${encodeURIComponent(readEnv("SMOKE_EVALUATION_STAGE", "summary"))}`,
    label: "evaluation-summary",
    method: "GET",
    expected: ['"ok":true', '"evaluation"', '"unlocked_package_mode":"premium_ai_plus"'],
  },
  {
    path:
      `/api/commercial/projects/unlock-access?id=${encodeURIComponent(
        readEnv("SMOKE_PROJECT_ID", "1080efe5-1250-44bc-aead-a6e927a2dfe9")
      )}` +
      `&package_mode=${encodeURIComponent(readEnv("SMOKE_EVALUATION_MODE", "premium_ai_plus"))}`,
    label: "unlock-access",
    method: "GET",
    expected: ['"ok":true', '"can_unlock"', '"upgrade_price_rub"'],
  },
  {
    path: `/api/tests/take-access?slug=${encodeURIComponent(readEnv("SMOKE_TEST_SLUG", "negotiation-style"))}`,
    label: "test-take-access",
    method: "GET",
    expected: ['"ok":true', '"price_rub"', '"balance_kopeks"'],
  },
];

async function fetchCheck(check) {
  const bearer = await getBearerToken();
  const url = `${APP_URL}${check.path}`;
  const startedAt = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: check.method || "GET",
        headers: {
          authorization: `Bearer ${bearer}`,
          "cache-control": "no-cache",
          "content-type": "application/json",
        },
      });
      const body = await response.text();
      return {
        path: check.path,
        url,
        ok: response.ok,
        status: response.status,
        ms: Date.now() - startedAt,
        body,
      };
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

function assertExpectedText(check, body) {
  const missing = (check.expected || []).filter((text) => !body.toLowerCase().includes(String(text).toLowerCase()));
  if (!missing.length) return null;
  return `Expected body to contain: ${missing.map((item) => `"${item}"`).join(", ")}`;
}

async function main() {
  const failures = [];
  console.log(`Auth smoke target: ${APP_URL}`);

  for (const check of DEFAULT_CHECKS) {
    try {
      const result = await fetchCheck(check);
      const expectationError = assertExpectedText(check, result.body);
      const bodyPreview = result.body.replace(/\s+/g, " ").slice(0, 180);
      console.log(`${result.ok ? "OK" : "FAIL"} ${result.status} ${check.label} ${check.method || "GET"} ${check.path} ${result.ms}ms`);
      if (!result.ok) {
        failures.push(`${check.label} ${check.path}: HTTP ${result.status}. Preview: ${bodyPreview}`);
      } else if (expectationError) {
        failures.push(`${check.label} ${check.path}: ${expectationError}. Preview: ${bodyPreview}`);
      }
    } catch (error) {
      failures.push(`${check.label} ${check.path}: ${error?.message || error}`);
      console.log(`FAIL ERR ${check.label} ${check.path} ${error?.message || error}`);
    }
  }

  if (failures.length) {
    console.error("\nAuth smoke failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("\nAuth smoke passed.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
