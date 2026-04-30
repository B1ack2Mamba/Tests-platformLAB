import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/useSession";
import { isTestUnlimitedEmail, TEST_UNLIMITED_BALANCE_KOPEKS } from "@/lib/testWallet";

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
  const { supabase, user } = useSession();
  const isUnlimited = isTestUnlimitedEmail(user?.email);
  const [wallet, setWallet] = useState<WalletBalanceRow>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setWallet(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (isUnlimited) {
        setWallet({
          user_id: user.id,
          balance_kopeks: TEST_UNLIMITED_BALANCE_KOPEKS,
          updated_at: new Date().toISOString(),
        });
        return;
      }

      const resp = await supabase
        .from("wallets")
        .select("user_id,balance_kopeks,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (resp.error) throw resp.error;
      if (resp.data) {
        setWallet(resp.data as WalletBalanceRow);
      } else {
        setWallet({
          user_id: user.id,
          balance_kopeks: 0,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Wallet load error");
    } finally {
      setLoading(false);
    }
  }, [isUnlimited, supabase, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const balance_rub = useMemo(() => {
    const kopeks = wallet?.balance_kopeks ?? 0;
    return Math.floor(kopeks / 100);
  }, [wallet?.balance_kopeks]);

  return { balance_rub, balanceRub: balance_rub, refresh, loading, error, isUnlimited };
}
