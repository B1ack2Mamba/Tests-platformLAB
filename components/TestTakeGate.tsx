import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { useWalletBalance } from "@/lib/useWalletBalance";
import { getTestTakePriceRub } from "@/lib/testTakeAccess";

type Props = {
  slug: string;
  title: string;
  children: ReactNode;
};

export function TestTakeGate({ slug, title, children }: Props) {
  const router = useRouter();
  const { session, user, loading } = useSession();
  const { refresh } = useWalletBalance();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [priceRub, setPriceRub] = useState(getTestTakePriceRub());

  const inviteToken = typeof router.query.invite === "string" ? router.query.invite : "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (loading) return;
      if (inviteToken) {
        setAllowed(true);
        setChecking(false);
        return;
      }
      if (!session?.access_token || !user) {
        setChecking(false);
        setAllowed(false);
        return;
      }
      setChecking(true);
      try {
        const resp = await fetch(`/api/tests/take-access?slug=${encodeURIComponent(slug)}`, {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось проверить доступ");
        if (!cancelled) {
          setAllowed(Boolean(json.unlocked));
          setPriceRub(Number(json.price_rub ?? getTestTakePriceRub()));
        }
      } catch (e: any) {
        if (!cancelled) {
          setAllowed(false);
          setError(e?.message || "Не удалось проверить доступ");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, loading, session?.access_token, slug, user]);

  async function unlock() {
    if (!session?.access_token) return;
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
      setAllowed(true);
      setPriceRub(Number(json.price_rub ?? getTestTakePriceRub()));
      refresh();
    } catch (e: any) {
      setError(e?.message || "Не удалось открыть тест");
    } finally {
      setBusy(false);
    }
  }

  if (allowed) return <>{children}</>;

  return (
    <Layout title={title}>
      <div className="card max-w-2xl">
        <div className="text-lg font-semibold text-slate-950">Прохождение теста открывается отдельно</div>
        <div className="mt-3 text-sm leading-6 text-slate-700">
          Для каталога это отдельный платный доступ. После оплаты тест откроется для прохождения в твоём кабинете.
        </div>
        {checking ? <div className="mt-4 text-sm text-slate-500">Проверяем доступ…</div> : null}
        {!user || !session ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/auth?next=${encodeURIComponent(`/tests/${slug}/take`)}`} className="btn btn-primary">
              Войти и пройти за {priceRub} ₽
            </Link>
            <Link href={`/tests/${slug}`} className="btn btn-secondary">Назад к описанию</Link>
          </div>
        ) : !checking ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={unlock} disabled={busy} className="btn btn-primary">
              {busy ? "Открываем…" : `Открыть прохождение за ${priceRub} ₽`}
            </button>
            <Link href="/wallet" className="btn btn-secondary">Пополнить кошелёк</Link>
            <Link href={`/tests/${slug}`} className="btn btn-secondary">Назад к описанию</Link>
          </div>
        ) : null}
        {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
      </div>
    </Layout>
  );
}
