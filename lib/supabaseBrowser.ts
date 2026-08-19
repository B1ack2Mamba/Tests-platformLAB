import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthStorage } from "@/lib/authPersistence";
import { getSupabaseEnv } from "@/lib/supabaseClient";

let browserClient: SupabaseClient | null = null;

export function getSupabaseAuthStorageKey(url?: string) {
  const env = getSupabaseEnv();
  const sourceUrl = url || env?.url || "";
  try {
    const projectRef = new URL(sourceUrl).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : "sb-auth-token";
  } catch {
    return "sb-auth-token";
  }
}

export function clearPersistedSupabaseSession(url?: string) {
  createSupabaseAuthStorage().removeItem(getSupabaseAuthStorageKey(url));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lk-auth-session", { detail: null }));
  }
}

/**
 * Browser-only singleton Supabase client.
 * Returns null if env is not configured.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const env = getSupabaseEnv();
  if (!env) return null;
  if (!browserClient) {
    browserClient = createClient(env.url, env.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: true,
        storageKey: getSupabaseAuthStorageKey(env.url),
        storage: createSupabaseAuthStorage(),
      },
    });
  }
  return browserClient;
}
