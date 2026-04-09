import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { formatRub, useWallet } from "@/lib/useWallet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PAYMENTS_UI_ENABLED, YOOKASSA_TEST_UI_ENABLED } from "@/lib/payments";
import { isGlobalTemplateOwnerEmail } from "@/lib/admin";

type CreateTopupResp = {
  ok: boolean;
  confirmation_url?: string;
  payment_id?: string;
  error?: string;
};

const QUICK_AMOUNTS = [1000, 3000, 5000, 10000, 50000];

const YOOKASSA_PENDING_TOPUP_KEY = "yookassa_pending_topup_payment_id";

function setPendingYooKassaPaymentId(key: string, value: string) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, value);
}


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
  const SHOW_YOOKASSA_TEST_BUTTONS = YOOKASSA_TEST_UI_ENABLED && !PAYMENTS_UI_ENABLED;

  const [topupOpen, setTopupOpen] = useState(false);
  const [amountRub, setAmountRub] = useState("3000");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);



  useEffect(() => {
    let cancelled = false;
    if (!user || !session?.access_token) return;
    (async () => {
      try {
        const resp = await fetch("/api/commercial/wallet-hermes-template", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok || !data?.template) return;
        if (cancelled) return;
        const next = {
          widthPercent: clamp(Number(data.template.widthPercent ?? DEFAULT_WALLET_HERMES_LAYOUT.widthPercent), 70, 150),
          heightPx: clamp(Number(data.template.heightPx ?? DEFAULT_WALLET_HERMES_LAYOUT.heightPx), 280, 760),
          offsetX: clamp(Number(data.template.offsetX ?? DEFAULT_WALLET_HERMES_LAYOUT.offsetX), -220, 220),
          offsetY: clamp(Number(data.template.offsetY ?? DEFAULT_WALLET_HERMES_LAYOUT.offsetY), -220, 220),
          cardWidthPx: clamp(Number(data.template.cardWidthPx ?? DEFAULT_WALLET_HERMES_LAYOUT.cardWidthPx), 240, 420),
          cardHeightPx: clamp(Number(data.template.cardHeightPx ?? DEFAULT_WALLET_HERMES_LAYOUT.cardHeightPx), 200, 420),
          cardOffsetX: clamp(Number(data.template.cardOffsetX ?? DEFAULT_WALLET_HERMES_LAYOUT.cardOffsetX), -220, 220),
          cardOffsetY: clamp(Number(data.template.cardOffsetY ?? DEFAULT_WALLET_HERMES_LAYOUT.cardOffsetY), -220, 220),
        };
        setWalletHermesLayout(next);
        storeWalletHermesLayout(next);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.id, session?.access_token]);

  async function saveWalletHermesTemplateForAll() {
    if (!canManageWalletHermesLayout || !session?.access_token) return;
    setWalletHermesTemplateBusy(true);
    setWalletHermesTemplateError(null);
    setWalletHermesTemplateInfo(null);
    try {
      const resp = await fetch("/api/commercial/wallet-hermes-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ template: walletHermesLayout }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) throw new Error(data?.error || "Не удалось сохранить шаблон для всех");
      setWalletHermesTemplateInfo("Шаблон окна Гермеса сохранен для всех.");
    } catch (e: any) {
      setWalletHermesTemplateError(e?.message || "Не удалось сохранить шаблон для всех");
    } finally {
      setWalletHermesTemplateBusy(false);
    }
  }
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
      if (!r.ok || !data.ok || !data.confirmation_url || !data.payment_id) {
        throw new Error(data.error || "Не удалось создать оплату");
      }

      setPendingYooKassaPaymentId(YOOKASSA_PENDING_TOPUP_KEY, data.payment_id);
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
            <div className="card overflow-hidden border-[#d9c3a0] bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e8_100%)] p-0 shadow-[0_14px_34px_rgba(137,109,64,0.08)]">
              <div className="border-b border-[#e5d6bd] px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#9a7a4b]">Гермес</div>
              </div>
              <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,250,242,0.98)_0%,rgba(246,238,226,0.98)_100%)]" style={{ minHeight: 420 }}>
                <img src="/wallet-hermes-guide.png" alt="Гермес с табличкой" className="block w-full max-w-none select-none" />
                <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none">
                  <div className="absolute bottom-[7%] right-[5%] w-[39%] min-w-[250px] max-w-[320px] rounded-[26px] border border-[#d8ccb9] bg-[rgba(255,252,246,0.94)] px-4 py-4 shadow-[0_16px_30px_rgba(120,92,44,0.12)] pointer-events-auto backdrop-blur-[1px]">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#9a7a4b]">{PAYMENTS_UI_ENABLED ? "Оплата" : SHOW_YOOKASSA_TEST_BUTTONS ? "Тестовая оплата" : "Пополнение"}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-600">{PAYMENTS_UI_ENABLED ? "Выбери сумму и перейди к оплате прямо из окна Гермеса." : SHOW_YOOKASSA_TEST_BUTTONS ? "Кнопки ниже запускают тестовый redirect в ЮKassa." : "Онлайн-оплата пока отключена."}</div>
                    {PAYMENTS_UI_ENABLED || SHOW_YOOKASSA_TEST_BUTTONS ? (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {QUICK_AMOUNTS.map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setAmountRub(String(a))}
                              className="rounded-full border border-[#dccfb9] bg-white px-2 py-2 text-xs font-medium text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                            >
                              {a} ₽
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          <input
                            value={amountRub}
                            onChange={(e) => setAmountRub(e.target.value)}
                            inputMode="numeric"
                            placeholder="3000"
                            className="input h-11"
                          />
                          <button
                            type="button"
                            disabled={isUnlimited || topupBusy || parsedRub === null || parsedRub < 1}
                            onClick={() => startTopup(parsedRub || 0)}
                            className="btn btn-primary w-full justify-center"
                          >
                            {isUnlimited ? "∞" : topupBusy ? "Создаю оплату…" : SHOW_YOOKASSA_TEST_BUTTONS && !PAYMENTS_UI_ENABLED ? "Тестовая оплата" : "Оплатить"}
                          </button>
                        </div>
                        <div className="mt-2 text-[11px] leading-4 text-slate-500">{SHOW_YOOKASSA_TEST_BUTTONS && !PAYMENTS_UI_ENABLED ? "После оплаты вернёшься в кошелёк, где проверим статус платежа." : "Минимум 1 ₽. Для безлимита оплата не нужна."}</div>
                        {topupError ? <div className="mt-2 text-xs text-red-600">{topupError}</div> : null}
                      </>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-xs leading-5 text-slate-600">
                        Чтобы показать кнопки оплаты, добавь NEXT_PUBLIC_YOOKASSA_TEST_UI_ENABLED=1. Боевой UI включается через NEXT_PUBLIC_PAYMENTS_ENABLED=1.
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
