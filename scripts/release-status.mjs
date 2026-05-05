import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

const APP_URL = String(LOCAL_ENV.APP_URL || "https://tests-platform-lab.vercel.app").replace(/\/+$/, "");

function tailLines(text, limit = 8) {
  return String(text || "")
    .trim()
    .split(/\r?\n/)
    .slice(-limit);
}

function runNodeScript(scriptName) {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", scriptName)], {
    cwd: process.cwd(),
    env: LOCAL_ENV,
    encoding: "utf8",
  });

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    summary: tailLines(`${result.stdout || ""}\n${result.stderr || ""}`),
  };
}

async function fetchHealth() {
  const startedAt = Date.now();
  const response = await fetch(`${APP_URL}/api/health`, {
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

async function main() {
  const startedAt = Date.now();
  const health = await fetchHealth();
  const smokeProd = runNodeScript("smoke-prod.mjs");
  const smokeAuth = runNodeScript("smoke-auth.mjs");

  const report = {
    ok: health.ok && smokeProd.ok && smokeAuth.ok,
    checked_at: new Date().toISOString(),
    target: APP_URL,
    duration_ms: Date.now() - startedAt,
    health: {
      ok: health.ok,
      status: health.status,
      ms: health.ms,
      version: health.body?.version || null,
      request_id: health.body?.request_id || null,
    },
    smoke_prod: {
      ok: smokeProd.ok,
      exit_code: smokeProd.status,
      summary: smokeProd.summary,
    },
    smoke_auth: {
      ok: smokeAuth.ok,
      exit_code: smokeAuth.status,
      summary: smokeAuth.summary,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        target: APP_URL,
        error: error?.message || String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
