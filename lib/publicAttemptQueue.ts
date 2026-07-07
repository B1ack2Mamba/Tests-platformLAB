import type { ScoreResult } from "@/lib/score";

const QUEUE_KEY = "commercial-public-attempt-queue:v1";
const DEFAULT_TIMEOUT_MS = 12000;

export type PublicAttemptPayload = {
  token: string;
  test_slug: string;
  test_title: string;
  result: ScoreResult;
};

export type QueuedPublicAttempt = PublicAttemptPayload & {
  queued_at: number;
  tries: number;
  last_error?: string;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function sameAttempt(a: Pick<PublicAttemptPayload, "token" | "test_slug">, b: Pick<PublicAttemptPayload, "token" | "test_slug">) {
  return a.token === b.token && a.test_slug === b.test_slug;
}

function errorMessage(error: unknown) {
  if (!error) return "unknown";
  if (error instanceof Error) return error.message || error.name || "unknown";
  return String(error);
}

function readQueue(): QueuedPublicAttempt[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.token && item?.test_slug && item?.result) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedPublicAttempt[]) {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // If storage is full or unavailable, we still let the live request try to save.
  }
}

export function getQueuedPublicAttempts(token?: string) {
  const items = readQueue();
  return token ? items.filter((item) => item.token === token) : items;
}

export function queuePublicAttempt(payload: PublicAttemptPayload, error?: unknown) {
  const items = readQueue();
  const existing = items.find((item) => sameAttempt(item, payload));
  const next: QueuedPublicAttempt = {
    ...payload,
    queued_at: existing?.queued_at || Date.now(),
    tries: existing?.tries || 0,
    last_error: error ? errorMessage(error) : existing?.last_error,
  };

  writeQueue([...items.filter((item) => !sameAttempt(item, payload)), next]);
}

export function removeQueuedPublicAttempt(token: string, testSlug: string) {
  writeQueue(readQueue().filter((item) => !(item.token === token && item.test_slug === testSlug)));
}

export async function postPublicAttempt(payload: PublicAttemptPayload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch("/api/commercial/projects/public-attempt-upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.ok) {
      const message = json?.error || `Не удалось сохранить результат участника (${resp.status})`;
      throw new Error(message);
    }
    return json;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function savePublicAttemptResilient(payload: PublicAttemptPayload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  queuePublicAttempt(payload);

  try {
    const json = await postPublicAttempt(payload, timeoutMs);
    removeQueuedPublicAttempt(payload.token, payload.test_slug);
    return { ok: true as const, queued: false as const, json };
  } catch (error) {
    queuePublicAttempt(payload, error);
    return { ok: false as const, queued: true as const, error };
  }
}

export async function flushPublicAttemptQueue({
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  limit = 10,
}: {
  token?: string;
  timeoutMs?: number;
  limit?: number;
} = {}) {
  const items = getQueuedPublicAttempts(token).slice(0, limit);
  const result = { sent: 0, failed: 0, pending: items.length, errors: [] as string[] };

  for (const item of items) {
    try {
      await postPublicAttempt(item, timeoutMs);
      removeQueuedPublicAttempt(item.token, item.test_slug);
      result.sent += 1;
    } catch (error) {
      const all = readQueue();
      const current = all.find((candidate) => sameAttempt(candidate, item));
      if (current) {
        writeQueue(
          all.map((candidate) =>
            sameAttempt(candidate, item)
              ? { ...candidate, tries: (candidate.tries || 0) + 1, last_error: errorMessage(error) }
              : candidate
          )
        );
      }
      result.failed += 1;
      result.errors.push(errorMessage(error));
    }
  }

  result.pending = getQueuedPublicAttempts(token).length;
  return result;
}
