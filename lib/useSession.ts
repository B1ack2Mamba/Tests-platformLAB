import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { refreshSessionThroughServer } from "@/lib/authRefreshClient";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const SESSION_REFRESH_CHECK_MS = 15 * 60 * 1000;
const SESSION_REFRESH_SKEW_MS = 10 * 60 * 1000;
let sessionRefreshMaintenanceStarted = false;
let sessionRefreshInFlight = false;

async function refreshPersistedSession(client: SupabaseClient) {
  if (sessionRefreshInFlight) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

  sessionRefreshInFlight = true;
  try {
    const { data: current } = await client.auth.getSession();
    if (!current.session) return;
    const expiresAtMs = Number(current.session.expires_at || 0) * 1000;
    if (expiresAtMs && expiresAtMs - Date.now() > SESSION_REFRESH_SKEW_MS) return;
    const refreshedSession = await refreshSessionThroughServer(current.session.refresh_token);
    await client.auth.setSession({
      access_token: refreshedSession.access_token,
      refresh_token: refreshedSession.refresh_token,
    });
  } catch {
    // Keep the current session during transient network/Auth outages.
  } finally {
    sessionRefreshInFlight = false;
  }
}

function startSessionRefreshMaintenance(client: SupabaseClient) {
  if (sessionRefreshMaintenanceStarted || typeof window === "undefined") return;
  sessionRefreshMaintenanceStarted = true;

  const refreshWhenVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    refreshPersistedSession(client);
  };

  window.setTimeout(() => refreshPersistedSession(client), 1000);
  window.setInterval(() => refreshPersistedSession(client), SESSION_REFRESH_CHECK_MS);
  window.addEventListener("focus", refreshWhenVisible);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", refreshWhenVisible);
  }
}

export function useSession() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [envOk, setEnvOk] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setEnvOk(false);
      setLoading(false);
      return;
    }
    const client = supabase;

    setEnvOk(true);
    let mounted = true;
    startSessionRefreshMaintenance(client);

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  return { supabase, session, user: session?.user ?? null, loading, envOk };
}
