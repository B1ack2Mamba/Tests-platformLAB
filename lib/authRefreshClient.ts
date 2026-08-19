import type { Session } from "@supabase/supabase-js";

type RefreshSessionResponse = {
  ok?: boolean;
  error?: string;
  session?: Session | null;
};

export class SessionRefreshError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SessionRefreshError";
    this.status = status;
  }
}

export function isInvalidSessionRefreshError(error: unknown) {
  return error instanceof SessionRefreshError && error.status === 401;
}

export async function refreshSessionThroughServer(refreshToken: string): Promise<Session> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = (await response.json().catch(() => ({}))) as RefreshSessionResponse;
  if (!response.ok || !data?.ok || !data.session?.access_token || !data.session.refresh_token) {
    throw new SessionRefreshError(data?.error || "Session refresh failed", response.status);
  }
  return data.session;
}
