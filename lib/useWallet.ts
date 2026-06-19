import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/useSession";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";
import { friendlyErrorMessage } from "@/lib/friendlyErrors";

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
  const { session, user, loading: sessionLoading } = useSession();
  const userId = user?.id || "";
  const userEmail = user?.email || "";
  const isUnlimited = isTestUnlimitedEmail(userEmail);
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    if (sessionLoading) return;

    const accessToken = session?.access_token || "";

    if (!accessToken || !userId) {
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

      const response = await fetch("/api/commercial/wallet?ledger_limit=20", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({} as any));
      if (!response.ok || !data?.ok) throw new Error(data?.error || "wallet_load_failed");

      setWallet((data.wallet as WalletRow | null) || { user_id: userId, balance_kopeks: 0, updated_at: new Date().toISOString() });
      setLedger((data.ledger ?? []) as LedgerRow[]);
    } catch (e: any) {
      setError(friendlyErrorMessage(e, "Не удалось загрузить кошелёк"));
    } finally {
      setWalletLoading(false);
    }
  }, [session?.access_token, userId, isUnlimited, sessionLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loading = sessionLoading || walletLoading;

  return { wallet, ledger, loading, error, refresh, isUnlimited };
}
