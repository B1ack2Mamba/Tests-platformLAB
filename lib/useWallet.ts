import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";

export type WalletRow = {
  user_id: string;
  balance_kopeks: number;
  updated_at?: string;
};

export type LedgerRow = {
  id: string;
  created_at: string;
  amount_kopeks: number;
  reason: string;
  ref: string | null;
};

export function formatRub(kopeks: number): string {
  const rub = Math.floor(Math.abs(kopeks) / 100);
  const sign = kopeks < 0 ? "-" : "";
  return `${sign}${rub} ₽`;
}

export function useWallet() {
  const { supabase, user, loading: sessionLoading } = useSession();
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const isUnlimited = isTestUnlimitedEmail(userEmail);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    if (sessionLoading) return;

    if (!supabase || !userId) {
      setWallet(null);
      setLedger([]);
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    setError("");
    try {
      if (isUnlimited) {
        setWallet({ user_id: userId, balance_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS, updated_at: new Date().toISOString() });
        setLedger([
          {
            id: "test-unlimited-balance",
            created_at: new Date().toISOString(),
            amount_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS,
            reason: "test_unlimited_balance",
            ref: "storyguild9@gmail.com",
          },
        ]);
        return;
      }

      const [walletResp, ledgerResp] = await Promise.all([
        supabase.from("wallets").select("user_id,balance_kopeks,updated_at").eq("user_id", userId).maybeSingle(),
        supabase
          .from("wallet_ledger")
          .select("id,created_at,amount_kopeks,reason,ref")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (walletResp.error) throw walletResp.error;
      if (ledgerResp.error) throw ledgerResp.error;

      if (walletResp.data) {
        setWallet(walletResp.data as any);
      } else {
        setWallet({ user_id: userId, balance_kopeks: 0, updated_at: new Date().toISOString() });
      }

      setLedger((ledgerResp.data ?? []) as any);
    } catch (e: any) {
      setError(e?.message ?? "Wallet load error");
    } finally {
      setWalletLoading(false);
    }
  }, [supabase, userId, isUnlimited, sessionLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loading = sessionLoading || walletLoading;

  return { wallet, ledger, loading, error, refresh, isUnlimited };
}
