import type { Session } from "@supabase/supabase-js";

type RefreshSessionResponse = {
  ok?: boolean;
  error?: string;
  session?: Session | null;
};

export async function refreshSessionThroughServer(refreshToken: string): Promise<Session> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = (await response.json().catch(() => ({}))) as RefreshSessionResponse;
  if (!response.ok || !data?.ok || !data.session?.access_token || !data.session.refresh_token) {
    throw new Error(data?.error || "Session refresh failed");
  }
  return data.session;
}
