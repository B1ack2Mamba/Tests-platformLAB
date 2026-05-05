const APP_URL = (process.env.APP_URL || "https://tests-platform-lab.vercel.app").replace(/\/+$/, "");

const DEFAULT_CHECKS = [
  { path: "/", label: "landing", expected: ["Лаборатория кадров"] },
  { path: "/login", label: "login", expected: ["Лаборатория кадров", "Кабинет оценки персонала"] },
  { path: "/wallet", label: "wallet", expected: ['"page":"/wallet"'] },
  { path: "/api/health", label: "health", expected: ['"ok":true'] },
  {
    path: process.env.SMOKE_INVITE_PATH || "/invite/84f535b7722203030592a17b57433864",
    label: "invite",
    expected: ["Назначенные тесты", "Пройдено:", "Общее время:"],
  },
  {
    path: process.env.SMOKE_PROJECT_PATH || "/projects/b1a327b5-946b-48fb-910e-ff6dbe5db2ba",
    label: "project",
    expected: ['"page":"/projects/[projectId]"'],
  },
  {
    path: process.env.SMOKE_RESULTS_PATH || "/projects/1080efe5-1250-44bc-aead-a6e927a2dfe9/results",
    label: "results",
    expected: ['"page":"/projects/[projectId]/results"'],
  },
];

async function fetchCheck(path) {
  const url = `${APP_URL}${path}`;
  const startedAt = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "cache-control": "no-cache" },
      });
      const body = await response.text();
      return {
        path,
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

  console.log(`Smoke target: ${APP_URL}`);

  for (const check of DEFAULT_CHECKS) {
    try {
      const result = await fetchCheck(check.path);
      const expectationError = assertExpectedText(check, result.body);
      const bodyPreview = result.body.replace(/\s+/g, " ").slice(0, 160);
      console.log(`${result.ok ? "OK" : "FAIL"} ${result.status} ${check.label} ${check.path} ${result.ms}ms`);
      if (!result.ok) {
        failures.push(`${check.label} ${check.path}: HTTP ${result.status}`);
      } else if (expectationError) {
        failures.push(`${check.label} ${check.path}: ${expectationError}. Preview: ${bodyPreview}`);
      }
    } catch (error) {
      failures.push(`${check.label} ${check.path}: ${error?.message || error}`);
      console.log(`FAIL ERR ${check.label} ${check.path} ${error?.message || error}`);
    }
  }

  if (failures.length) {
    console.error("\nSmoke check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("\nSmoke check passed.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
