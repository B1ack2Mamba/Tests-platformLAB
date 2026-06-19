import type { NextApiRequest, NextApiResponse } from "next";
import { setNoStore } from "@/lib/apiHardening";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { requireUser } from "@/lib/serverAuth";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";

type WalletRow = {
  user_id: string;
  balance_kopeks: number;
  updated_at?: string;
};

type LedgerRow = {
  id: string;
  created_at: string;
  amount_kopeks: number;
  reason: string;
  ref: string | null;
};

function emptyWallet(userId: string): WalletRow {
  return {
    user_id: userId,
    balance_kopeks: 0,
    updated_at: new Date().toISOString(),
  };
}

function unlimitedWallet(userId: string): { wallet: WalletRow; ledger: LedgerRow[] } {
  return {
    wallet: {
      user_id: userId,
      balance_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS,
      updated_at: new Date().toISOString(),
    },
    ledger: [
      {
        id: "test-unlimited-balance",
        created_at: new Date().toISOString(),
        amount_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS,
        reason: "test_unlimited_balance",
        ref: "storyguild9@gmail.com",
      },
    ],
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  setNoStore(res);

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const includeLedger = String(req.query.include_ledger ?? "1") !== "0";
  const rawLimit = Number(req.query.ledger_limit ?? 20);
  const ledgerLimit = Math.min(50, Math.max(0, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20));

  try {
    const unlimited = isTestUnlimitedEmail(auth.user.email);
    if (unlimited) {
      const data = unlimitedWallet(auth.user.id);
      return res.status(200).json({
        ok: true,
        request_id: requestId,
        wallet: data.wallet,
        ledger: includeLedger ? data.ledger.slice(0, ledgerLimit || data.ledger.length) : [],
        balance_kopeks: data.wallet.balance_kopeks,
        unlimited: true,
      });
    }

    const walletPromise = auth.supabaseAdmin
      .from("wallets")
      .select("user_id,balance_kopeks,updated_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    const ledgerPromise =
      includeLedger && ledgerLimit > 0
        ? auth.supabaseAdmin
            .from("wallet_ledger")
            .select("id,created_at,amount_kopeks,reason,ref")
            .eq("user_id", auth.user.id)
            .order("created_at", { ascending: false })
            .limit(ledgerLimit)
        : Promise.resolve({ data: [], error: null });

    const [walletResp, ledgerResp] = await Promise.all([walletPromise, ledgerPromise]);
    if (walletResp.error) throw walletResp.error;
    if (ledgerResp.error) throw ledgerResp.error;

    const wallet = (walletResp.data as WalletRow | null) || emptyWallet(auth.user.id);
    const ledger = (ledgerResp.data || []) as LedgerRow[];

    return res.status(200).json({
      ok: true,
      request_id: requestId,
      wallet,
      ledger,
      balance_kopeks: Number(wallet.balance_kopeks ?? 0),
      unlimited: false,
    });
  } catch (error: any) {
    logApiError("commercial.wallet", requestId, error);
    return res.status(400).json({
      ok: false,
      request_id: requestId,
      error: error?.message || "Failed to load wallet",
    });
  }
}
