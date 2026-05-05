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

  throw new Error("Missing auth credentials for e2e-commercial. Set SMOKE_BEARER_TOKEN or SMOKE_USER_EMAIL/SMOKE_USER_PASSWORD.");
}

async function apiFetch(pathname, init = {}, bearer) {
  const response = await fetch(`${APP_URL}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, text, json };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const bearer = await resolveBearerToken();
  const personName = `Smoke E2E ${Date.now()}`;
  let projectId = null;

  try {
    const created = await apiFetch("/api/admin/demo-project-create", {
      method: "POST",
      body: JSON.stringify({
        person_name: personName,
        current_position: "Smoke Candidate",
        target_role: "Smoke Role",
        goal: "general_assessment",
        package_mode: "premium_ai_plus",
      }),
    }, bearer);

    assert(created.response.ok && created.json?.ok && created.json?.project_id, `Demo project create failed: ${created.text}`);
    projectId = String(created.json.project_id);
    console.log(`Created demo project: ${projectId}`);

    const project = await apiFetch(`/api/commercial/projects/get?id=${encodeURIComponent(projectId)}`, { method: "GET" }, bearer);
    assert(project.response.ok && project.json?.ok && project.json?.project?.id === projectId, `Project get failed: ${project.text}`);
    console.log("OK project-get");

    const resultsMap = await apiFetch(`/api/commercial/projects/results-map?id=${encodeURIComponent(projectId)}`, { method: "POST" }, bearer);
    assert(resultsMap.response.ok && resultsMap.json?.ok, `Results map failed: ${resultsMap.text}`);
    console.log("OK results-map");

    const evaluation = await apiFetch(
      `/api/commercial/projects/evaluation?id=${encodeURIComponent(projectId)}&mode=premium_ai_plus&stage=summary`,
      { method: "GET" },
      bearer
    );
    assert(evaluation.response.ok && evaluation.json?.ok && evaluation.json?.evaluation, `Evaluation failed: ${evaluation.text}`);
    console.log("OK evaluation-summary");

    const unlockAccess = await apiFetch(
      `/api/commercial/projects/unlock-access?id=${encodeURIComponent(projectId)}&package_mode=premium_ai_plus`,
      { method: "GET" },
      bearer
    );
    assert(unlockAccess.response.ok && unlockAccess.json?.ok && Object.prototype.hasOwnProperty.call(unlockAccess.json, "can_unlock"), `Unlock access failed: ${unlockAccess.text}`);
    console.log("OK unlock-access");

    console.log("Commercial e2e passed.");
  } finally {
    if (projectId) {
      const deleted = await apiFetch("/api/commercial/projects/delete", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId }),
      }, bearer);
      if (deleted.response.ok && deleted.json?.ok) {
        console.log(`Deleted demo project: ${projectId}`);
      } else {
        console.error(`Cleanup failed for ${projectId}: ${deleted.text}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
