import fs from "node:fs";
import path from "node:path";

const APP_URL = (process.env.APP_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");

const ROUTES = [
  "/auth",
  "/wallet",
  "/dashboard",
  "/projects/new",
  process.env.SMOKE_PROJECT_RESULTS_PATH || "/projects/1080efe5-1250-44bc-aead-a6e927a2dfe9/results",
  "/assessments",
  "/tests/16pf-a",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

async function checkRoute(route) {
  const response = await fetch(`${APP_URL}${route}`, {
    headers: {
      "cache-control": "no-cache",
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      "sec-ch-viewport-width": "390",
    },
  });
  const body = await response.text();
  assert(response.ok, `${route}: HTTP ${response.status}`);
  assert(body.includes("__NEXT_DATA__"), `${route}: Next payload not found`);
  return { route, status: response.status, bytes: Buffer.byteLength(body, "utf8") };
}

function checkStaticMobileGuards() {
  const dashboard = readWorkspaceFile("pages/dashboard/index.tsx");
  const css = readWorkspaceFile("styles/globals.css");
  const assessments = readWorkspaceFile("pages/assessments/index.tsx");

  assert(dashboard.includes("mobile-dashboard-home lg:hidden"), "Dashboard mobile shell must stay mobile-only");
  assert(dashboard.includes("lg:block"), "Dashboard desktop scene must stay hidden below the lg breakpoint");
  assert(dashboard.includes("LAYOUT_BACKUP_STORAGE_PREFIX"), "Dashboard layout backup storage guard is missing");
  assert(css.includes("@media (max-width: 767px)"), "Mobile CSS media query is missing");
  assert(css.includes("body:has(textarea:focus) .global-hints-trigger"), "Floating hints button focus guard is missing");
  assert(css.includes(".project-selected-competencies") && css.includes("max-height: min(42dvh, 18rem)"), "Selected competencies mobile container guard is missing");
  assert(css.includes(".project-results-page .project-results-stamp") && css.includes("float: none"), "Project results mobile stamp guard is missing");
  assert(assessments.includes('Pick<AnyTest, "slug" | "title" | "description">'), "Assessments catalog payload was expanded again");
}

async function main() {
  checkStaticMobileGuards();
  console.log(`Mobile smoke target: ${APP_URL}`);

  const results = [];
  for (const route of ROUTES) {
    const result = await checkRoute(route);
    results.push(result);
    console.log(`OK ${result.status} ${route} ${result.bytes} bytes`);
  }

  console.log("\nMobile smoke check passed.");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
