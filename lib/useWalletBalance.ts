import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/useSession";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";
import { friendlyErrorMessage } from "@/lib/friendlyErrors";

type WalletBalanceRow = {
  user_id: string;
  balance_kopeks: number;
  updated_at?: string;
} | null;

/**
 * Lightweight balance hook for screens that only need the current wallet amount.
 * Avoids loading the full ledger history on every page open.
 */
export function useWalletBalance(_userId: string | null = null) {
  const { session, user, loading: sessionLoading } = useSession();
  const userId = user?.id || _userId || "";
  const userEmail = user?.email || "";
  const isUnlimited = isTestUnlimitedEmail(userEmail);
  const [wallet, setWallet] = useState<WalletBalanceRow>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    if (sessionLoading) return;

    const accessToken = session?.access_token || "";

    if (!accessToken || !userId) {
      setWallet(null);
      setError("");
      setWalletLoading(false);
      return;
    }

    setWalletLoading(true);
    setError("");
    try {
      if (isUnlimited) {
        setWallet({
          user_id: userId,
          balance_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS,
          updated_at: new Date().toISOString(),
        });
        return;
      }

      const response = await fetch("/api/commercial/wallet?include_ledger=0", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json().catch(() => ({} as any));
      if (!response.ok || !data?.ok) throw new Error(data?.error || "wallet_balance_load_failed");

      setWallet(
        (data.wallet as WalletBalanceRow) || {
          user_id: userId,
          balance_kopeks: 0,
          updated_at: new Date().toISOString(),
        }
      );
    } catch (e: any) {
      setError(friendlyErrorMessage(e, "Не удалось загрузить баланс"));
    } finally {
      setWalletLoading(false);
    }
  }, [isUnlimited, session?.access_token, sessionLoading, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const balance_rub = useMemo(() => {
    const kopeks = wallet?.balance_kopeks ?? 0;
    return Math.floor(kopeks / 100);
  }, [wallet?.balance_kopeks]);

  const loading = sessionLoading || walletLoading;

  return { balance_rub, balanceRub: balance_rub, refresh, loading, error, isUnlimited };
}
