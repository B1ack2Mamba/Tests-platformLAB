import Link from "next/link";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/admin";

export default function CreditPage() {
  const { user, session, loading, envOk } = useSession();
  const [amountRub, setAmountRub] = useState<string>("100");
  const [status, setStatus] = useState<string>("");

  const uid = user?.id ?? "";
  const canSend = useMemo(() => {
    const n = Number(amountRub);
    return Boolean(uid) && isAdminEmail(user?.email) && Number.isFinite(n) && n > 0;
  }, [uid, amountRub, user?.email]);

  const credit = async () => {
    if (!uid) return;
    if (!isAdminEmail(user?.email)) {
      setStatus("❌ Доступ запрещён" );
      return;
    }
    const accessToken = session?.access_token;
    if (!accessToken) {
      setStatus("❌ Нужен вход" );
      return;
    }
    const n = Number(amountRub);
    if (!Number.isFinite(n) || n <= 0) {
      setStatus("❌ Некорректная сумма" );
      return;
    }
    setStatus("⏳ Начисляю...");
    try {
      const r = await fetch("/api/admin/credit-wallet", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: uid, amount_rub: n, reason: "topup", ref: "admin" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus(`❌ ${j?.error ?? "Ошибка"}`);
        return;
      }
      setStatus(`✅ Ок: баланс (коп.) = ${j?.data?.balance_kopeks ?? "?"}`);
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "Ошибка"}`);
    }
  };

  return (
    <Layout title="Админ: начисление в кошелёк">
      <div className="mb-4 flex justify-end"><Link href="/admin" className="btn btn-secondary btn-sm">К админ-панели</Link></div>
      {!envOk ? (
        <div className="card text-sm text-zinc-600">
          Supabase не настроен. Добавь переменные из <code className="rounded bg-white/60 px-1">.env.example</code>.
        </div>
      ) : loading ? (
        <div className="card text-sm text-zinc-600">Загрузка…</div>
      ) : !user ? (
        <div className="card text-sm text-zinc-600">
          Нужен вход. Перейди в <Link className="underline" href="/auth">/auth</Link>.
        </div>
      ) : !isAdminEmail(user.email) ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Доступ запрещён. Админы: <span className="font-mono">{ADMIN_EMAILS.join(", ")}</span>
        </div>
      ) : (
      <div className="card">
        <div className="text-sm text-zinc-700">
          Служебная страница для ручного пополнения (на время тестов). Доступ — только администратору.
        </div>

        <div className="mt-3 card-soft p-3 text-sm">
          <div>
            user_id: <span className="font-mono">{uid || "(не авторизован)"}</span>
          </div>
          {!uid ? (
            <div className="mt-2 text-xs text-zinc-600">
              Перейди в <Link className="underline" href="/auth">/auth</Link> и войди по email.
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2">
          <input
            value={amountRub}
            onChange={(e) => setAmountRub(e.target.value)}
            placeholder="Сумма (RUB)"
            className="input"
          />
          <button
            disabled={!canSend}
            onClick={credit}
            className="btn btn-primary"
          >
            Начислить
          </button>
        </div>

        {status ? <div className="mt-3 text-sm text-zinc-700">{status}</div> : null}
      </div>
      )}
    </Layout>
  );
}
