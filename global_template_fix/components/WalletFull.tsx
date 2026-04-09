import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { formatRub, useWallet } from "@/lib/useWallet";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PAYMENTS_UI_ENABLED } from "@/lib/payments";

type CreateTopupResp = {
  ok: boolean;
  confirmation_url?: string;
  payment_id?: string;
  error?: string;
};

const QUICK_AMOUNTS = [1000, 3000, 5000, 10000, 50000];

function reasonLabel(reason: string): string {
  switch (reason) {
    case "topup":
      return "Пополнение";
    case "author_interpretation":
      return "Авторская расшифровка";
    case "detailed_interpretation":
      return "Подробная расшифровка";
    case "test_unlimited_balance":
      return "Тестовый безлимит";
    case "promo_code":
      return "Промокод";
    case "test_take_unlock":
      return "Прохождение теста";
    default:
      return reason;
  }
}

export default function WalletPage() {
  const { user, session } = useSession();
  const { wallet, ledger, loading, error, refresh, isUnlimited } = useWallet();

  const [topupOpen, setTopupOpen] = useState(false);
  const [amountRub, setAmountRub] = useState("3000");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  const parsedRub = useMemo(() => {
    const n = Number(String(amountRub).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }, [amountRub]);

  async function startTopup(rub: number) {
    if (!session?.access_token) {
      setTopupError("Нужно войти, чтобы пополнять баланс.");
      return;
    }

    setTopupBusy(true);
    setTopupError(null);
    try {
      const r = await fetch("/api/payments/yookassa/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount_rub: rub }),
      });

      const data = (await r.json()) as CreateTopupResp;
      if (!r.ok || !data.ok || !data.confirmation_url) {
        throw new Error(data.error || "Не удалось создать оплату");
      }

      // Redirect to YooKassa confirmation page (SBP QR / bank selection)
      window.location.href = data.confirmation_url;
    } catch (e: any) {
      setTopupError(e?.message || "Ошибка пополнения");
    } finally {
      setTopupBusy(false);
    }
  }


  return (
    <Layout title="Кошелёк">
      {!user ? (
        <div className="card bg-white">
          <div className="text-sm text-slate-700">Чтобы пользоваться кошельком — нужно войти.</div>
          <Link href="/auth?next=/wallet" className="mt-3 inline-block btn btn-primary">Вход</Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <div className="card relative overflow-hidden border-slate-200 bg-white">
              <div className="pointer-events-none absolute -right-6 -top-10 text-[180px] font-light leading-none text-slate-200/35 select-none">☿</div>
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Кошелёк</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">
                    {wallet ? (isUnlimited ? "∞" : formatRub(wallet.balance_kopeks)) : "—"}
                  </div>
                  <div className="mt-2 max-w-xl text-sm text-slate-600">
                    Баланс используется для оплаты пакетов услуг и открытия расширенного функционала сайта.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    {isUnlimited ? <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-900">Тестовый безлимит</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isUnlimited && PAYMENTS_UI_ENABLED ? (
                    <button
                      onClick={() => setTopupOpen(true)}
                      className="btn btn-primary"
                    >
                      Пополнить
                    </button>
                  ) : null}
                  <button
                    onClick={refresh}
                    className="btn btn-secondary"
                  >
                    Обновить
                  </button>
                </div>
              </div>

              {error ? <div className="relative mt-3 text-sm text-red-600">{error}</div> : null}
              {loading ? <div className="relative mt-2 text-xs text-slate-500">⏳ Загружаю…</div> : null}
            </div>

            <div className="card bg-white">
              <div className="text-sm font-semibold text-emerald-900">Как это работает</div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div className="card-soft bg-white p-3 text-sm text-slate-700">
                  <div className="font-medium">1. Пополнение</div>
                  <div className="mt-1 text-xs text-slate-500">{PAYMENTS_UI_ENABLED ? "Через СБП и ЮKassa." : "Онлайн-оплата подключается отдельно."}</div>
                </div>
                <div className="card-soft bg-white p-3 text-sm text-slate-700">
                  <div className="font-medium">2. Открытие уровней</div>
                  <div className="mt-1 text-xs text-slate-500">База, Премиум AI и Премиум AI+.</div>
                </div>
                <div className="card-soft bg-white p-3 text-sm text-slate-700">
                  <div className="font-medium">3. История</div>
                  <div className="mt-1 text-xs text-slate-500">Все операции сохраняются ниже.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="card bg-white">
              <div className="text-sm font-semibold text-emerald-900">{PAYMENTS_UI_ENABLED ? "Быстрое пополнение" : "Пополнение временно отключено"}</div>
              <div className="mt-2 text-sm text-slate-600">{PAYMENTS_UI_ENABLED ? "Выбери сумму и сразу перейди к оплате." : "ЮKassa пока не подключена. Кошелёк работает без онлайн-оплаты."}</div>
              {PAYMENTS_UI_ENABLED ? (<>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmountRub(String(a))}
                    className="btn btn-secondary btn-pill"
                  >
                    {a} ₽
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={amountRub}
                  onChange={(e) => setAmountRub(e.target.value)}
                  inputMode="numeric"
                  placeholder="3000"
                  className="input"
                />
                <button
                  type="button"
                  disabled={isUnlimited || topupBusy || parsedRub === null || parsedRub < 1}
                  onClick={() => startTopup(parsedRub || 0)}
                  className="btn btn-primary whitespace-nowrap"
                >
                  {isUnlimited ? "∞" : topupBusy ? "Создаю…" : "Оплатить"}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">Минимум 1 ₽. Для тестового безлимита оплата не нужна.</div>
              {topupError ? <div className="mt-2 text-sm text-red-600">{topupError}</div> : null}
              </>) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Как только ЮKassa будет подключена, здесь появится онлайн-оплата и быстрые суммы.
                </div>
              )}
            </div>

            <div className="card bg-white">
              <div className="text-sm font-medium">История операций</div>
              <div className="mt-2 max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-2">Дата</th>
                      <th className="py-2">Сумма</th>
                      <th className="py-2">Причина</th>
                      <th className="py-2">Ссылка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="py-2 text-xs text-slate-600">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="py-2">{formatRub(row.amount_kopeks)}</td>
                        <td className="py-2">{reasonLabel(row.reason)}</td>
                        <td className="py-2 text-xs text-slate-600">{row.ref ?? "—"}</td>
                      </tr>
                    ))}
                    {ledger.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-xs text-slate-500">
                          Пока пусто
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {isUnlimited || !PAYMENTS_UI_ENABLED ? null : topupOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-md card shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Пополнить баланс</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Откроем страницу ЮKassa для СБП (QR). После оплаты вернёшься назад,
                      а баланс обновится автоматически.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!topupBusy) {
                        setTopupOpen(false);
                        setTopupError(null);
                      }
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-slate-500">Сумма (₽)</div>
                  <input
                    value={amountRub}
                    onChange={(e) => setAmountRub(e.target.value)}
                    inputMode="numeric"
                    placeholder="3000"
                    className="mt-1 input"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAmountRub(String(a))}
                        className="btn btn-secondary btn-pill"
                      >
                        {a} ₽
                      </button>
                    ))}
                  </div>

                  {topupError ? (
                    <div className="mt-3 text-sm text-red-600">{topupError}</div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={topupBusy}
                      onClick={() => {
                        setTopupOpen(false);
                        setTopupError(null);
                      }}
                      className="btn btn-secondary"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={topupBusy || parsedRub === null || parsedRub < 1}
                      onClick={() => startTopup(parsedRub || 0)}
                      className="btn btn-primary"
                    >
                      {topupBusy ? "Создаю оплату…" : "Перейти к оплате"}
                    </button>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500">
                    Минимум 1 ₽. Комиссии и чек — по настройкам ЮKassa.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Layout>
  );
}
