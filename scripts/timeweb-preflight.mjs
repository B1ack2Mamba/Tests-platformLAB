import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { getOpenAIConnection, getOpenAIRequestConfig } from "../lib/openaiTransport.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const known = new Set(["--env-file", "--models", "--network", "--production"]);
let envPath = path.join(root, ".env.timeweb.local");
for (let i = 0; i < args.length; i += 1) {
  if (!known.has(args[i])) throw new Error("Unknown option. Use --env-file PATH, --models, --network or --production.");
  if (args[i] === "--env-file") {
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("--env-file requires a path.");
    envPath = path.resolve(args[++i]);
  }
}

function fail(message) { console.error(`FAIL ${message}`); process.exitCode = 1; }

async function request(url, headers = {}) {
  // Do not follow redirects with API credentials. Never print response bodies or secrets.
  try {
    return await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Network/TLS/timeout failure; no response body or credential was logged.");
  }
}

async function listModels(env, showIds) {
  const connection = getOpenAIConnection(env);
  if (!connection || connection.provider !== "timeweb") throw new Error("Configure OPENAI_PROVIDER=timeweb and TIMEWEB_AI_API_KEY first.");
  const response = await request(`${connection.baseUrl}/models`, { authorization: `Bearer ${connection.apiKey}` });
  if (!response.ok) throw new Error(`Gateway /models returned HTTP ${response.status}.`);
  const json = await response.json().catch(() => null);
  if (!Array.isArray(json?.data)) throw new Error("Gateway model list has an unexpected format.");
  const ids = json.data.map(item => item?.id).filter(id => typeof id === "string" && /^[a-zA-Z0-9_.:/-]+$/.test(id));
  console.log(`OK gateway catalogue received (${ids.length} models); no generation requested.`);
  if (showIds) for (const id of ids.filter(id => /gpt/i.test(id))) console.log(id);
  return new Set(ids);
}

function httpsOrigin(env, name) {
  try {
    const url = new URL(env[name]);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.port) throw new Error();
    if (!url.hostname.includes(".") || /(^|\.)(localhost|example\.(com|org|net)|invalid|test)$/.test(url.hostname)) throw new Error();
    return url.origin;
  } catch {
    fail(`${name} must be a real HTTPS origin without a path, credentials or query.`);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(envPath)) throw new Error("Timeweb env file is missing. Copy deploy/timeweb/env.timeweb.example to .env.timeweb.local and configure it.");
  // Read only the explicit file: never borrow credentials from an unrelated shell.
  const env = parseEnv(fs.readFileSync(envPath, "utf8"));
  if (args.includes("--models")) { await listModels(env, true); return; }

  const appOrigin = httpsOrigin(env, "NEXT_PUBLIC_APP_URL");
  const supabaseOrigin = httpsOrigin(env, "NEXT_PUBLIC_SUPABASE_URL");
  for (const name of ["APP_URL", "APP_BASE_URL", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_INVITE_BASE_URL"]) {
    const value = httpsOrigin(env, name);
    if (value && appOrigin && value !== appOrigin) fail(`${name} does not match the application origin.`);
  }
  for (const [name, origin] of [["APP_DOMAIN", appOrigin], ["SUPABASE_DOMAIN", supabaseOrigin]]) {
    if (!origin || env[name] !== new URL(origin).hostname) fail(`${name} must match its HTTPS origin (use ASCII/Punycode for a Cyrillic domain).`);
  }
  let redirectOrigin = null;
  if (!env.APP_REDIRECT_DOMAIN || !/^[a-z0-9.-]+$/.test(env.APP_REDIRECT_DOMAIN)) {
    fail("APP_REDIRECT_DOMAIN must be an ASCII/Punycode hostname.");
  } else {
    redirectOrigin = httpsOrigin({ redirect: `https://${env.APP_REDIRECT_DOMAIN}` }, "redirect");
    if (redirectOrigin && new URL(redirectOrigin).hostname !== env.APP_REDIRECT_DOMAIN) fail("APP_REDIRECT_DOMAIN is not a normalized hostname.");
    if (redirectOrigin === appOrigin || redirectOrigin === supabaseOrigin) fail("The redirect domain must differ from both the application and Supabase domains.");
  }
  if (appOrigin && appOrigin === supabaseOrigin) fail("Application and Supabase require separate hostnames with this Caddy configuration.");
  if (supabaseOrigin && new URL(supabaseOrigin).hostname.endsWith(".supabase.co")) fail("Supabase still points to the managed cloud; the full Russia migration is incomplete.");
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicKey?.trim()) fail("A public Supabase key is required at build time.");
  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) fail("SUPABASE_SERVICE_ROLE_KEY is required at runtime.");
  if (publicKey && publicKey === env.SUPABASE_SERVICE_ROLE_KEY) fail("Public and server Supabase keys must be different.");
  if (!env.ACME_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ACME_EMAIL)) fail("ACME_EMAIL is required for HTTPS certificate management.");
  if (!env.NEXT_PUBLIC_ADMIN_EMAILS?.trim() && !env.NEXT_PUBLIC_ADMIN_EMAIL?.trim()) fail("Preserve the existing administrator email configuration.");
  if (!args.includes("--production")) {
    for (const name of ["PAYMENTS_ENABLED", "NEXT_PUBLIC_PAYMENTS_ENABLED", "NEXT_PUBLIC_YOOKASSA_TEST_UI_ENABLED"]) {
      if (env[name] !== "0") fail(`${name} must be 0 during the migration rehearsal.`);
    }
  }
  if (env.OPENAI_PROVIDER !== "timeweb") fail("This migration profile requires OPENAI_PROVIDER=timeweb.");
  // Include the fixed model choices used by folder chat as well as configurable tasks.
  const models = new Set([
    "gpt-5.6-terra", "gpt-5.6-sol", env.OPENAI_TEST_MODEL, env.OPENAI_PREMIUM_MODEL,
    env.OPENAI_FINAL_MODEL, env.OPENAI_AI_PLUS_MODEL, env.OPENAI_MODEL,
  ].filter(Boolean));
  const configs = [];
  for (const model of models) {
    try {
      const config = getOpenAIRequestConfig(model, env);
      if (!config) fail("TIMEWEB_AI_API_KEY is missing.");
      else configs.push(config);
    } catch (error) { fail(error.message); }
  }
  if (process.exitCode) return;
  console.log("OK offline configuration; secrets were not printed. Hosting location and restored data still need verification.");
  if (!args.includes("--network")) {
    console.log("No network requests made. Use --network for read-only endpoint and model-catalogue checks.");
    return;
  }

  const modelsAvailable = await listModels(env, false);
  for (const config of configs) if (!modelsAvailable.has(config.model)) fail(`Configured gateway model is unavailable: ${config.model}`);
  const redirectProbePath = "/.well-known/kadrlab-redirect-check?source=preflight";
  const redirectResponse = await fetch(`${redirectOrigin}${redirectProbePath}`, {
    redirect: "manual", signal: AbortSignal.timeout(15000),
  });
  if (redirectResponse.status !== 308 || redirectResponse.headers.get("location") !== `${appOrigin}${redirectProbePath}`) {
    fail("The bare-domain redirect must preserve the path and query and return HTTP 308.");
  } else console.log("OK bare-domain redirect, including path and query.");
  await redirectResponse.body?.cancel();
  const health = await request(`${appOrigin}/api/health`);
  const healthJson = await health.json().catch(() => null);
  if (!health.ok || healthJson?.ok !== true) fail(`Application health check failed (HTTP ${health.status}).`);
  else console.log("OK application process health.");

  const auth = await request(`${supabaseOrigin}/auth/v1/health`, { apikey: publicKey });
  if (!auth.ok) fail(`Supabase Auth health failed (HTTP ${auth.status}).`);
  else console.log("OK Supabase Auth endpoint.");
  const rest = await request(`${supabaseOrigin}/rest/v1/tests?select=slug&limit=1`, {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  });
  const rows = await rest.json().catch(() => null);
  if (!rest.ok || !Array.isArray(rows) || rows.length === 0) fail(`Restored test catalogue could not be read (HTTP ${rest.status}).`);
  else console.log("OK database API and non-empty test catalogue; no row data logged.");
  console.log("Read-only checks finished. Login, RLS isolation, GPT Responses/JSON output, payments and no-VPN performance require separate acceptance tests.");
}

main().catch(error => { fail(error.message); });
