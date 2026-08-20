import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_PLUS_REFRESH_PRICE_KOPEKS,
  AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT,
  type AiPlusRefreshAccess,
} from "@/lib/commercialAiRefresh";
import { chargeWallet } from "@/lib/serverWallet";

const PAID_REASON_PREFIX = "commercial_ai_plus_refresh";
const FREE_REASON_PREFIX = "commercial_ai_plus_refresh_free";

type SubscriptionCoverage = {
  id: string;
  billingUserId: string;
};

type RefreshAuthorization = {
  authorized: boolean;
  completed: boolean;
  source: "subscription" | "wallet" | "unlimited" | null;
};

function normalizeOperationKey(value: unknown) {
  const operationKey = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(operationKey)) {
    throw new Error("Некорректный номер операции обновления");
  }
  return operationKey;
}

function paidRef(workspaceId: string, projectId: string, operationKey: string) {
  return `commercial-ai-plus-refresh:${workspaceId}:${projectId}:${operationKey}`;
}

function freeSlotPrefix(subscriptionId: string, projectId: string) {
  return `commercial-ai-plus-refresh-free:${subscriptionId}:${projectId}:slot:`;
}

function freeSlotRef(subscriptionId: string, projectId: string, slot: number) {
  return `${freeSlotPrefix(subscriptionId, projectId)}${slot}`;
}

function reservedReason(source: "subscription" | "wallet", operationKey: string) {
  return `${source === "subscription" ? FREE_REASON_PREFIX : PAID_REASON_PREFIX}_reserved:${operationKey}`;
}

function completedReason(source: "subscription" | "wallet", operationKey: string) {
  return `${source === "subscription" ? FREE_REASON_PREFIX : PAID_REASON_PREFIX}_completed:${operationKey}`;
}

function isUniqueViolation(error: any) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "23505" || message.includes("duplicate key") || message.includes("unique constraint");
}

async function getWalletBalance(supabaseAdmin: SupabaseClient, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .select("balance_kopeks")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Number((data as any)?.balance_kopeks ?? 0);
}

async function getSubscriptionCoverage(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  projectId: string,
  fallbackUserId: string
): Promise<SubscriptionCoverage | null> {
  const { data: coverage, error: coverageError } = await supabaseAdmin
    .from("commercial_workspace_subscription_projects")
    .select("subscription_id")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (coverageError) throw coverageError;
  if (!(coverage as any)?.subscription_id) return null;

  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("commercial_workspace_subscriptions")
    .select("id,created_by_user_id,status,expires_at")
    .eq("id", (coverage as any).subscription_id)
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "exhausted"])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!(subscription as any)?.id) return null;

  return {
    id: String((subscription as any).id),
    billingUserId: String((subscription as any).created_by_user_id || fallbackUserId),
  };
}

async function getFreeRefreshRows(
  supabaseAdmin: SupabaseClient,
  coverage: SubscriptionCoverage,
  projectId: string
) {
  const { data, error } = await supabaseAdmin
    .from("wallet_ledger")
    .select("id,ref,reason,user_id")
    .eq("user_id", coverage.billingUserId)
    .like("ref", `${freeSlotPrefix(coverage.id, projectId)}%`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as Array<{ id: string; ref: string; reason: string; user_id: string }>;
}

async function findFreeOperation(
  supabaseAdmin: SupabaseClient,
  coverage: SubscriptionCoverage,
  projectId: string,
  operationKey: string
) {
  const reasons = [reservedReason("subscription", operationKey), completedReason("subscription", operationKey)];
  const { data, error } = await supabaseAdmin
    .from("wallet_ledger")
    .select("id,ref,reason,user_id")
    .eq("user_id", coverage.billingUserId)
    .like("ref", `${freeSlotPrefix(coverage.id, projectId)}%`)
    .in("reason", reasons)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; ref: string; reason: string; user_id: string } | null;
}

async function findPaidOperation(
  supabaseAdmin: SupabaseClient,
  workspaceId: string,
  projectId: string,
  operationKey: string
) {
  const { data, error } = await supabaseAdmin
    .from("wallet_ledger")
    .select("id,ref,reason,user_id,amount_kopeks")
    .eq("ref", paidRef(workspaceId, projectId, operationKey))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; ref: string; reason: string; user_id: string; amount_kopeks: number } | null;
}

export async function getCommercialAiPlusRefreshAccess(
  supabaseAdmin: SupabaseClient,
  params: { workspaceId: string; projectId: string; userId: string; unlimited: boolean }
): Promise<AiPlusRefreshAccess> {
  const { workspaceId, projectId, userId, unlimited } = params;
  const coverage = unlimited ? null : await getSubscriptionCoverage(supabaseAdmin, workspaceId, projectId, userId);
  const freeRows = coverage ? await getFreeRefreshRows(supabaseAdmin, coverage, projectId) : [];
  const freeUsed = Math.min(
    AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT,
    new Set(freeRows.map((row) => row.ref).filter(Boolean)).size
  );

  return {
    ok: true,
    project_id: projectId,
    price_rub: AI_PLUS_REFRESH_PRICE_KOPEKS / 100,
    price_kopeks: AI_PLUS_REFRESH_PRICE_KOPEKS,
    unlimited,
    subscription_covered: Boolean(coverage),
    free_refreshes_limit: AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT,
    free_refreshes_used: freeUsed,
    free_refreshes_remaining: coverage ? Math.max(0, AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT - freeUsed) : 0,
  };
}

export async function reserveCommercialAiPlusRefresh(
  supabaseAdmin: SupabaseClient,
  params: { workspaceId: string; projectId: string; userId: string; operationKey: string; unlimited: boolean }
): Promise<AiPlusRefreshAccess> {
  const { workspaceId, projectId, userId, unlimited } = params;
  const operationKey = normalizeOperationKey(params.operationKey);
  const baseAccess = await getCommercialAiPlusRefreshAccess(supabaseAdmin, { workspaceId, projectId, userId, unlimited });

  if (unlimited) {
    return {
      ...baseAccess,
      operation_key: operationKey,
      billing_source: "unlimited",
      charged_kopeks: 0,
      balance_kopeks: null,
      already_reserved: false,
      completed: false,
    };
  }

  const coverage = await getSubscriptionCoverage(supabaseAdmin, workspaceId, projectId, userId);
  if (coverage) {
    const existingFree = await findFreeOperation(supabaseAdmin, coverage, projectId, operationKey);
    if (existingFree) {
      const refreshedAccess = await getCommercialAiPlusRefreshAccess(supabaseAdmin, { workspaceId, projectId, userId, unlimited });
      return {
        ...refreshedAccess,
        operation_key: operationKey,
        billing_source: "subscription",
        charged_kopeks: 0,
        balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
        already_reserved: true,
        completed: existingFree.reason === completedReason("subscription", operationKey),
      };
    }

    const freeRows = await getFreeRefreshRows(supabaseAdmin, coverage, projectId);
    const occupiedRefs = new Set(freeRows.map((row) => row.ref).filter(Boolean));
    for (let slot = 1; slot <= AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT && occupiedRefs.size < AI_PLUS_SUBSCRIPTION_FREE_REFRESH_LIMIT; slot += 1) {
      const slotRef = freeSlotRef(coverage.id, projectId, slot);
      if (occupiedRefs.has(slotRef)) continue;
      const { error } = await supabaseAdmin.from("wallet_ledger").insert({
        user_id: coverage.billingUserId,
        amount_kopeks: 0,
        reason: reservedReason("subscription", operationKey),
        ref: slotRef,
        created_at: new Date().toISOString(),
      });
      if (!error) {
        const refreshedAccess = await getCommercialAiPlusRefreshAccess(supabaseAdmin, { workspaceId, projectId, userId, unlimited });
        return {
          ...refreshedAccess,
          operation_key: operationKey,
          billing_source: "subscription",
          charged_kopeks: 0,
          balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
          already_reserved: false,
          completed: false,
        };
      }
      if (!isUniqueViolation(error)) throw error;
      const concurrentFree = await findFreeOperation(supabaseAdmin, coverage, projectId, operationKey);
      if (concurrentFree) {
        const refreshedAccess = await getCommercialAiPlusRefreshAccess(supabaseAdmin, { workspaceId, projectId, userId, unlimited });
        return {
          ...refreshedAccess,
          operation_key: operationKey,
          billing_source: "subscription",
          charged_kopeks: 0,
          balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
          already_reserved: true,
          completed: concurrentFree.reason === completedReason("subscription", operationKey),
        };
      }
    }
  }

  const existingPaid = await findPaidOperation(supabaseAdmin, workspaceId, projectId, operationKey);
  if (existingPaid) {
    return {
      ...baseAccess,
      operation_key: operationKey,
      billing_source: "wallet",
      charged_kopeks: Math.abs(Number(existingPaid.amount_kopeks || AI_PLUS_REFRESH_PRICE_KOPEKS)),
      balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
      already_reserved: true,
      completed: existingPaid.reason === completedReason("wallet", operationKey),
    };
  }

  const ref = paidRef(workspaceId, projectId, operationKey);
  let debit;
  try {
    debit = await chargeWallet(supabaseAdmin, {
      userId,
      amountKopeks: AI_PLUS_REFRESH_PRICE_KOPEKS,
      reason: reservedReason("wallet", operationKey),
      ref,
    });
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      const concurrentPaid = await findPaidOperation(supabaseAdmin, workspaceId, projectId, operationKey);
      if (concurrentPaid) {
        return {
          ...baseAccess,
          operation_key: operationKey,
          billing_source: "wallet",
          charged_kopeks: Math.abs(Number(concurrentPaid.amount_kopeks || AI_PLUS_REFRESH_PRICE_KOPEKS)),
          balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
          already_reserved: true,
          completed: concurrentPaid.reason === completedReason("wallet", operationKey),
        };
      }
    }
    throw error;
  }

  return {
    ...baseAccess,
    operation_key: operationKey,
    billing_source: "wallet",
    charged_kopeks: Number(debit.charged_kopeks || AI_PLUS_REFRESH_PRICE_KOPEKS),
    balance_kopeks: Number(debit.balance_kopeks || 0),
    already_reserved: false,
    completed: false,
  };
}

export async function assertCommercialAiPlusRefreshAuthorization(
  supabaseAdmin: SupabaseClient,
  params: { workspaceId: string; projectId: string; operationKey: string; unlimited: boolean }
): Promise<RefreshAuthorization> {
  const { workspaceId, projectId, unlimited } = params;
  const operationKey = normalizeOperationKey(params.operationKey);
  if (unlimited) return { authorized: true, completed: false, source: "unlimited" };

  const paid = await findPaidOperation(supabaseAdmin, workspaceId, projectId, operationKey);
  if (paid) {
    return {
      authorized: true,
      completed: paid.reason === completedReason("wallet", operationKey),
      source: "wallet",
    };
  }

  const reasons = [reservedReason("subscription", operationKey), completedReason("subscription", operationKey)];
  const { data: free, error } = await supabaseAdmin
    .from("wallet_ledger")
    .select("reason")
    .like("ref", `commercial-ai-plus-refresh-free:%:${projectId}:slot:%`)
    .in("reason", reasons)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (free) {
    return {
      authorized: true,
      completed: (free as any).reason === completedReason("subscription", operationKey),
      source: "subscription",
    };
  }

  return { authorized: false, completed: false, source: null };
}

export async function completeCommercialAiPlusRefresh(
  supabaseAdmin: SupabaseClient,
  params: { workspaceId: string; projectId: string; operationKey: string; unlimited: boolean }
) {
  const operationKey = normalizeOperationKey(params.operationKey);
  const authorization = await assertCommercialAiPlusRefreshAuthorization(supabaseAdmin, { ...params, operationKey });
  if (!authorization.authorized || authorization.completed || authorization.source === "unlimited") return authorization;
  if (authorization.source !== "subscription" && authorization.source !== "wallet") return authorization;

  const fromReason = reservedReason(authorization.source, operationKey);
  const toReason = completedReason(authorization.source, operationKey);
  const query = supabaseAdmin
    .from("wallet_ledger")
    .update({ reason: toReason })
    .eq("reason", fromReason);
  const { error } = authorization.source === "wallet"
    ? await query.eq("ref", paidRef(params.workspaceId, params.projectId, operationKey))
    : await query.like("ref", `commercial-ai-plus-refresh-free:%:${params.projectId}:slot:%`);
  if (error) throw error;
  return { authorized: true, completed: true, source: authorization.source } as RefreshAuthorization;
}
