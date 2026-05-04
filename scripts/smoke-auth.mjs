const APP_URL = (process.env.APP_URL || "https://tests-platform-lab.vercel.app").replace(/\/+$/, "");
const BEARER = String(process.env.SMOKE_BEARER_TOKEN || process.env.BEARER_TOKEN || "").trim();

const DEFAULT_CHECKS = [
  {
    path: "/api/commercial/profile/me",
    label: "profile",
    expected: ['"ok":true', '"profile"', '"stats"'],
  },
  {
    path: "/api/commercial/dashboard/bootstrap",
    label: "dashboard-bootstrap",
    expected: ['"ok":true', '"workspace"', '"projects"'],
  },
  {
    path: "/api/commercial/subscriptions/status",
    label: "subscription-status",
    expected: ['"ok":true', '"workspace"', '"active_subscription"'],
  },
];

async function fetchCheck(path) {
  const url = `${APP_URL}${path}`;
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${BEARER}`,
      "cache-control": "no-cache",
    },
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
}

function assertExpectedText(check, body) {
  const missing = (check.expected || []).filter((text) => !body.toLowerCase().includes(String(text).toLowerCase()));
  if (!missing.length) return null;
  return `Expected body to contain: ${missing.map((item) => `"${item}"`).join(", ")}`;
}

async function main() {
  if (!BEARER) {
    console.error("Missing SMOKE_BEARER_TOKEN or BEARER_TOKEN for auth smoke.");
    process.exit(1);
  }

  const failures = [];
  console.log(`Auth smoke target: ${APP_URL}`);

  for (const check of DEFAULT_CHECKS) {
    try {
      const result = await fetchCheck(check.path);
      const expectationError = assertExpectedText(check, result.body);
      const bodyPreview = result.body.replace(/\s+/g, " ").slice(0, 180);
      console.log(`${result.ok ? "OK" : "FAIL"} ${result.status} ${check.label} ${check.path} ${result.ms}ms`);
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
