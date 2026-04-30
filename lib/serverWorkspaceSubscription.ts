import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceSubscriptionStatus } from "@/lib/commercialSubscriptions";

export async function getActiveWorkspaceSubscription(supabaseAdmin: SupabaseClient, workspaceId: string) {
  const nowIso = new Date().toISOString();
  const { data: active, error } = await supabaseAdmin
    .from("commercial_workspace_subscriptions")
    .select(`
      id,
      plan_key,
      plan_title,
      price_kopeks,
      projects_limit,
      projects_used,
      status,
      started_at,
      activated_at,
      expires_at
    `)
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "exhausted"])
    .gt("expires_at", nowIso)
    .order("activated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  let coveredProjectIds: string[] = [];
  if ((active as any)?.id) {
    const { data: coverageRows, error: coverageError } = await supabaseAdmin
      .from("commercial_workspace_subscription_projects")
      .select("project_id")
      .eq("subscription_id", (active as any).id);
    if (coverageError) throw coverageError;
    coveredProjectIds = (coverageRows || []).map((item: any) => item.project_id).filter(Boolean);
  }

  const activePlan: WorkspaceSubscriptionStatus | null = active
    ? {
        id: (active as any).id,
        plan_key: (active as any).plan_key,
        plan_title: (active as any).plan_title,
        price_kopeks: Number((active as any).price_kopeks || 0),
        projects_limit: Number((active as any).projects_limit || 0),
        projects_used: Number((active as any).projects_used || 0),
        projects_remaining: Math.max(0, Number((active as any).projects_limit || 0) - Number((active as any).projects_used || 0)),
        status: (active as any).status,
        started_at: (active as any).started_at,
        activated_at: (active as any).activated_at || null,
        expires_at: (active as any).expires_at,
        covered_project_ids: coveredProjectIds,
      }
    : null;

  return activePlan;
}
