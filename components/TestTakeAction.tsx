import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/useSession";
import { useWalletBalance } from "@/lib/useWalletBalance";
import { getTestTakePriceRub } from "@/lib/testTakeAccess";

type AccessState = {
  unlocked: boolean;
  price_rub: number;
  balance_kopeks: number;
  unlimited: boolean;
};

export function TestTakeAction({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const router = useRouter();
  const { session, user, loading } = useSession();
  const { refresh } = useWalletBalance();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [access, setAccess] = useState<AccessState | null>(null);
  const fallbackPrice = useMemo(() => getTestTakePriceRub(), []);

  useEffect(() => {
    let cancelled = false;
    async function loadAccess() {
      if (!session?.access_token || !user) {
        setAccess(null);
        return;
      }
      try {
        const resp = await fetch(`/api/tests/take-access?slug=${encodeURIComponent(slug)}`, {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось проверить доступ");
        if (!cancelled) {
          setAccess({
            unlocked: Boolean(json.unlocked),
            price_rub: Number(json.price_rub ?? fallbackPrice),
            balance_kopeks: Number(json.balance_kopeks ?? 0),
            unlimited: Boolean(json.unlimited),
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось проверить доступ");
      }
    }
    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [fallbackPrice, session?.access_token, slug, user]);

  async function unlockAndGo() {
    if (!session?.access_token) {
      router.push(`/auth?next=${encodeURIComponent(`/tests/${slug}/take`)}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const opId = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      const resp = await fetch("/api/tests/unlock-take", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ test_slug: slug, op_id: opId }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось открыть тест");
      setAccess({
        unlocked: true,
        price_rub: Number(json.price_rub ?? fallbackPrice),
        balance_kopeks: Number(json.balance_kopeks ?? 0),
        unlimited: Boolean(json.unlimited),
      });
      refresh();
      router.push(`/tests/${slug}/take`);
    } catch (e: any) {
      const msg = e?.message || "Не удалось открыть тест";
      setError(msg);
      if (/insufficient|недостаточно/i.test(msg)) {
        router.push(`/wallet?need=${fallbackPrice}`);
      }
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = compact ? "btn btn-secondary btn-sm" : "btn btn-primary";
  const secondaryClass = compact ? "btn btn-secondary btn-sm" : "btn btn-secondary";

  return (
    <div className="flex flex-col gap-2">
      {!user || !session ? (
        <Link href={`/auth?next=${encodeURIComponent(`/tests/${slug}/take`)}`} className={buttonClass}>
          Войти и пройти за {fallbackPrice} ₽
        </Link>
      ) : access?.unlocked ? (
        <Link href={`/tests/${slug}/take`} className={buttonClass}>
          Пройти тест
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={unlockAndGo} disabled={busy || loading} className={buttonClass}>
            {busy ? "Открываем…" : `Пройти за ${access?.price_rub ?? fallbackPrice} ₽`}
          </button>
          <Link href="/wallet" className={secondaryClass}>
            Кошелёк
          </Link>
        </div>
      )}
      {access && !access.unlimited && !access.unlocked ? (
        <div className="text-xs text-slate-500">Баланс: {Math.floor(access.balance_kopeks / 100)} ₽</div>
      ) : null}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}
