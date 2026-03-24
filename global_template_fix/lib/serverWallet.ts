import type { SupabaseClient } from "@supabase/supabase-js";

export type WalletChargeResult = {
  balance_kopeks: number;
  charged_kopeks: number;
  source: "rpc" | "fallback";
};

function normalizeMessage(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return String((error as any)?.message || error || "");
}

function isMissingDebitWalletFunction(error: unknown) {
  const message = normalizeMessage(error).toLowerCase();
  return (
    message.includes("could not find the function public.debit_wallet") ||
    message.includes("schema cache") ||
    message.includes("function public.debit_wallet")
  );
}

async function getWalletBalance(supabaseAdmin: SupabaseClient, userId: string) {
  const { data: wallet, error } = await supabaseAdmin
    .from("wallets")
    .select("balance_kopeks")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Number((wallet as any)?.balance_kopeks ?? 0);
}

async function fallbackDebitWallet(
  supabaseAdmin: SupabaseClient,
  params: { userId: string; amountKopeks: number; reason: string; ref?: string | null }
): Promise<WalletChargeResult> {
  const { userId, amountKopeks, reason, ref } = params;

  if (!userId) throw new Error("p_user_id is required");
  if (!Number.isFinite(amountKopeks) || amountKopeks <= 0) throw new Error("Amount must be positive");

  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from("wallets")
    .upsert({ user_id: userId, balance_kopeks: 0 }, { onConflict: "user_id", ignoreDuplicates: true });

  if (ref) {
    const { data: existingLedger, error: existingLedgerError } = await supabaseAdmin
      .from("wallet_ledger")
      .select("amount_kopeks")
      .eq("user_id", userId)
      .eq("ref", ref)
      .maybeSingle();

    if (!existingLedgerError && existingLedger) {
      return {
        balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
        charged_kopeks: Math.abs(Number((existingLedger as any)?.amount_kopeks ?? amountKopeks)),
        source: "fallback",
      };
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("balance_kopeks")
      .eq("user_id", userId)
      .single();

    if (walletError) throw walletError;

    const currentBalance = Number((wallet as any)?.balance_kopeks ?? 0);
    if (currentBalance < amountKopeks) {
      throw new Error("Insufficient balance");
    }

    const nextBalance = currentBalance - amountKopeks;

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ balance_kopeks: nextBalance, updated_at: nowIso })
      .eq("user_id", userId)
      .eq("balance_kopeks", currentBalance)
      .select("balance_kopeks");

    if (updateError) throw updateError;
    if (!updatedRows || updatedRows.length === 0) continue;

    const { error: ledgerError } = await supabaseAdmin.from("wallet_ledger").insert({
      user_id: userId,
      amount_kopeks: -amountKopeks,
      reason: reason || "debit",
      ref: ref || null,
      created_at: nowIso,
    });

    if (ledgerError) {
      if (ref) {
        const { data: existingLedger } = await supabaseAdmin
          .from("wallet_ledger")
          .select("amount_kopeks")
          .eq("user_id", userId)
          .eq("ref", ref)
          .maybeSingle();

        if (existingLedger) {
          return {
            balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
            charged_kopeks: Math.abs(Number((existingLedger as any)?.amount_kopeks ?? amountKopeks)),
            source: "fallback",
          };
        }
      }
      throw ledgerError;
    }

    return {
      balance_kopeks: Number((updatedRows[0] as any)?.balance_kopeks ?? nextBalance),
      charged_kopeks: amountKopeks,
      source: "fallback",
    };
  }

  throw new Error("Wallet debit conflict, please retry");
}

export async function chargeWallet(
  supabaseAdmin: SupabaseClient,
  params: { userId: string; amountKopeks: number; reason: string; ref?: string | null }
): Promise<WalletChargeResult> {
  const { userId, amountKopeks, reason, ref } = params;

  if (!Number.isFinite(amountKopeks) || amountKopeks <= 0) {
    return {
      balance_kopeks: await getWalletBalance(supabaseAdmin, userId),
      charged_kopeks: 0,
      source: "fallback",
    };
  }

  const rpcArgs = {
    p_user_id: userId,
    p_amount_kopeks: amountKopeks,
    p_reason: reason,
    p_ref: ref ?? null,
  };

  const { data, error } = await supabaseAdmin.rpc("debit_wallet", rpcArgs);
  if (!error) {
    return {
      balance_kopeks: Number((data as any)?.balance_kopeks ?? 0),
      charged_kopeks: Number((data as any)?.charged_kopeks ?? amountKopeks),
      source: "rpc",
    };
  }

  if (!isMissingDebitWalletFunction(error)) {
    throw error;
  }

  return fallbackDebitWallet(supabaseAdmin, { userId, amountKopeks, reason, ref });
}
