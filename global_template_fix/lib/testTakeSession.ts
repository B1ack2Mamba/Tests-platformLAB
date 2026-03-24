const PREFIX = "test-take-session:";

type TestTakeSession = {
  slug: string;
  activated_at: number;
};

function keyFor(slug: string) {
  return `${PREFIX}${slug}`;
}

function hasSessionStorage() {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

export function loadTestTakeSession(slug: string): TestTakeSession | null {
  if (!hasSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(keyFor(slug));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TestTakeSession;
    if (!parsed || parsed.slug !== slug) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasActiveTestTakeSession(slug: string): boolean {
  return Boolean(loadTestTakeSession(slug));
}

export function markTestTakeSession(slug: string) {
  if (!hasSessionStorage()) return;
  const payload: TestTakeSession = { slug, activated_at: Date.now() };
  window.sessionStorage.setItem(keyFor(slug), JSON.stringify(payload));
}

export function clearTestTakeSession(slug: string) {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(keyFor(slug));
}
