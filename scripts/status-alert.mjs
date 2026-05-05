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

function readEnv(key, fallback = "") {
  return String(LOCAL_ENV[key] ?? fallback).trim();
}

function readBool(key, fallback = false) {
  const raw = readEnv(key, fallback ? "1" : "");
  return /^(1|true|yes|on)$/i.test(raw);
}

function runStatusScript() {
  const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "release-status.mjs")], {
    cwd: process.cwd(),
    env: LOCAL_ENV,
    encoding: "utf8",
  });

  const stdout = String(result.stdout || "").trim();
  const stderr = String(result.stderr || "").trim();
  let report = null;

  try {
    report = stdout ? JSON.parse(stdout) : null;
  } catch {
    report = null;
  }

  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout,
    stderr,
    report,
  };
}

function buildFailureSummary(report) {
  if (!report) return ["Не удалось распарсить JSON статуса."];
  const lines = [];
  if (!report.health?.ok) {
    lines.push(`health: FAIL ${report.health?.status || "ERR"}`);
  }
  if (!report.smoke_prod?.ok) {
    lines.push(...(report.smoke_prod?.summary || []).filter(Boolean).slice(-6));
  }
  if (!report.smoke_auth?.ok) {
    lines.push(...(report.smoke_auth?.summary || []).filter(Boolean).slice(-6));
  }
  return lines.length ? lines : ["Статус вернул ok=false без явной причины."];
}

function buildMessage(report, mode) {
  const statusLine = mode === "heartbeat" ? "STATUS OK" : "STATUS FAIL";
  const lines = [
    statusLine,
    `target: ${report?.target || readEnv("APP_URL", "https://tests-platform-lab.vercel.app")}`,
    `checked_at: ${report?.checked_at || new Date().toISOString()}`,
    `version: ${report?.health?.version || "unknown"}`,
    `request_id: ${report?.health?.request_id || "—"}`,
    `duration_ms: ${report?.duration_ms ?? "—"}`,
  ];

  if (mode === "failure") {
    lines.push("details:");
    for (const item of buildFailureSummary(report)) lines.push(`- ${item}`);
  } else {
    lines.push(`public_smoke: ${report?.smoke_prod?.ok ? "ok" : "fail"}`);
    lines.push(`auth_smoke: ${report?.smoke_auth?.ok ? "ok" : "fail"}`);
  }

  return lines.join("\n");
}

async function sendTelegramMessage(text) {
  const botToken = readEnv("TELEGRAM_SUPPORT_BOT_TOKEN");
  const chatId = readEnv("TELEGRAM_SUPPORT_CHAT_ID");
  const threadId = readEnv("TELEGRAM_ALERT_THREAD_ID") || readEnv("TELEGRAM_SUPPORT_THREAD_ID");

  if (!botToken || !chatId) {
    throw new Error("Set TELEGRAM_SUPPORT_BOT_TOKEN and TELEGRAM_SUPPORT_CHAT_ID for status alerts.");
  }

  const payload = {
    chat_id: chatId,
    text,
    ...(threadId ? { message_thread_id: Number(threadId) } : {}),
  };

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.description || "Telegram send failed");
  }
  return body;
}

async function main() {
  const dryRun = readBool("STATUS_ALERT_DRY_RUN", false);
  const alertOnOk = readBool("STATUS_ALERT_ON_OK", false);
  const status = runStatusScript();
  const report = status.report || {
    ok: false,
    target: readEnv("APP_URL", "https://tests-platform-lab.vercel.app"),
    checked_at: new Date().toISOString(),
    duration_ms: 0,
    health: { version: null, request_id: null },
    smoke_prod: { ok: false, summary: [] },
    smoke_auth: { ok: false, summary: [] },
  };

  const mode = report.ok ? "heartbeat" : "failure";
  if (report.ok && !alertOnOk) {
    console.log("Status ok. No alert sent.");
    return;
  }

  const text = buildMessage(report, mode);
  if (dryRun) {
    console.log(text);
    console.log("Dry run: Telegram message not sent.");
    if (!report.ok) process.exit(status.status || 1);
    return;
  }

  await sendTelegramMessage(text);
  console.log(`Telegram ${mode === "heartbeat" ? "heartbeat" : "alert"} sent.`);
  if (!report.ok) process.exit(status.status || 1);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
