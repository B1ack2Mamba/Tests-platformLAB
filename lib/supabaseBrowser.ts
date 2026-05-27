import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthStorage } from "@/lib/authPersistence";
import { getSupabaseEnv } from "@/lib/supabaseClient";

let browserClient: SupabaseClient | null = null;

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
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: createSupabaseAuthStorage(),
      },
    });
  }
  return browserClient;
}
