export const AI_PLUS_REFRESH_PRICE_RUB = 500;
export const AI_PLUS_REFRESH_PRICE_KOPEKS = AI_PLUS_REFRESH_PRICE_RUB * 100;
export const AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT = 3;

export type AiPlusRefreshAccess = {
  ok: true;
  project_id: string;
  price_rub: number;
  price_kopeks: number;
  unlimited: boolean;
  subscription_covered: boolean;
  free_refreshes_limit: number;
  free_refreshes_used: number;
  free_refreshes_remaining: number;
  operation_key?: string;
  billing_source?: "subscription" | "wallet" | "unlimited";
  charged_kopeks?: number;
  balance_kopeks?: number | null;
  already_reserved?: boolean;
  completed?: boolean;
};

function refreshStorageKey(projectId: string) {
  return `commercial-ai-plus-refresh:${projectId}`;
}

export function createAiPlusRefreshOperationKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getPendingAiPlusRefreshOperation(projectId: string) {
  if (typeof window === "undefined") return "";
  const key = refreshStorageKey(projectId);
  const durableValue = window.localStorage.getItem(key) || "";
  if (durableValue) return durableValue;

  const legacyValue = window.sessionStorage.getItem(key) || "";
  if (legacyValue) {
    window.localStorage.setItem(key, legacyValue);
    window.sessionStorage.removeItem(key);
  }
  return legacyValue;
}

export function rememberPendingAiPlusRefreshOperation(projectId: string, operationKey: string) {
  if (typeof window === "undefined" || !operationKey) return;
  window.localStorage.setItem(refreshStorageKey(projectId), operationKey);
}

export function clearPendingAiPlusRefreshOperation(projectId: string, operationKey?: string) {
  if (typeof window === "undefined") return;
  const key = refreshStorageKey(projectId);
  const storedOperationKey = window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || "";
  if (operationKey && storedOperationKey !== operationKey) return;
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}

export async function requestAiPlusRefreshAccess(accessToken: string, projectId: string, signal?: AbortSignal) {
  const response = await fetch(`/api/commercial/projects/ai-plus-refresh?project_id=${encodeURIComponent(projectId)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Не удалось проверить условия обновления анализа");
  return payload as AiPlusRefreshAccess;
}

export async function reserveAiPlusRefresh(accessToken: string, projectId: string, operationKey: string) {
  const response = await fetch("/api/commercial/projects/ai-plus-refresh", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ project_id: projectId, operation_key: operationKey }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || "Не удалось подтвердить обновление анализа") as Error & {
      code?: string;
      balance_kopeks?: number;
      price_kopeks?: number;
    };
    error.code = typeof payload?.code === "string" ? payload.code : undefined;
    error.balance_kopeks = Number(payload?.balance_kopeks ?? 0);
    error.price_kopeks = Number(payload?.price_kopeks ?? AI_PLUS_REFRESH_PRICE_KOPEKS);
    throw error;
  }
  return payload as AiPlusRefreshAccess;
}
