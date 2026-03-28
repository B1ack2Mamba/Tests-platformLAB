import type { SupabaseClient } from "@supabase/supabase-js";

type ActivateWorkspaceSubscriptionParams = {
  workspaceId: string;
  userId?: string | null;
  paymentId: string;
  planKey: string;
  planTitle: string;
  amountKopeks: number;
  projectsLimit: number;
  durationDays: number;
};

export async function activateWorkspaceSubscription(
  supabaseAdmin: SupabaseClient,
  params: ActivateWorkspaceSubscriptionParams
) {
  const { workspaceId, userId, paymentId, planKey, planTitle, amountKopeks, projectsLimit, durationDays } = params;
  if (!workspaceId || !paymentId || !planKey || !projectsLimit) {
    throw new Error("Недостаточно данных для активации тарифа");
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: replaceError } = await supabaseAdmin
    .from("commercial_workspace_subscriptions")
    .update({ status: "replaced", updated_at: nowIso })
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (replaceError) throw replaceError;

  const { error: upsertError } = await supabaseAdmin
    .from("commercial_workspace_subscriptions")
    .upsert(
      {
        workspace_id: workspaceId,
        created_by_user_id: userId || null,
        payment_id: paymentId,
        plan_key: planKey,
        plan_title: planTitle,
        price_kopeks: amountKopeks,
        projects_limit: projectsLimit,
        projects_used: 0,
        duration_days: durationDays,
        status: "active",
        started_at: nowIso,
        activated_at: nowIso,
        expires_at: expiresAt,
        updated_at: nowIso,
      },
      { onConflict: "payment_id" }
    );

  if (upsertError) throw upsertError;

  return { expiresAt, activatedAt: nowIso };
}
