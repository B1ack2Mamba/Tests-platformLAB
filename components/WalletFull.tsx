import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { formatRub, useWallet } from "@/lib/useWallet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PAYMENTS_UI_ENABLED } from "@/lib/payments";
import {
  MONTHLY_SUBSCRIPTION_PLANS,
  formatMonthlySubscriptionPeriod,
  type WorkspaceSubscriptionStatus,
  type MonthlyPlanKey,
} from "@/lib/commercialSubscriptions";

type CreateTopupResp = {
  ok: boolean;
  confirmation_url?: string;
  payment_id?: string;
  error?: string;
};

type CreateSubscriptionResp = {
  ok: boolean;
  confirmation_url?: string;
  payment_id?: string;
  error?: string;
};

type WalletSubscriptionPurchaseResp = {
  ok: boolean;
  payment_id?: string;
  charged_kopeks?: number;
  balance_kopeks?: number;
  error?: string;
};

type SubscriptionStatusResp = {
  ok: boolean;
  error?: string;
  active_subscription?: WorkspaceSubscriptionStatus | null;
};

const QUICK_AMOUNTS = [1000, 3000, 5000, 10000, 50000];

const FRAME_CARD = "card border-[#d9c3a0] bg-[linear-gradient(180deg,#fffdf9_0%,#f7f1e8_100%)] shadow-[0_14px_34px_rgba(137,109,64,0.08)]";
const FRAME_SOFT = "rounded-[28px] border border-[#e5d6bd] bg-white/70";

const PENDING_PROMO_CODE_KEY = "pending_promo_code";
const PROMO_FLASH_SUCCESS_KEY = "promo_flash_success";
const PROMO_FLASH_ERROR_KEY = "promo_flash_error";
const WALLET_HERMES_LAYOUT_KEY = "wallet_hermes_layout_v1";
const WALLET_TEMPLATE_OWNER_EMAIL = "storyguild9@gmail.com";

type WalletHermesLayout = {
  widthPercent: number;
  heightPx: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_WALLET_HERMES_LAYOUT: WalletHermesLayout = {
  widthPercent: 100,
  heightPx: 440,
  offsetX: 0,
  offsetY: 0,
};

function getStoredPromoCode() {
  if (typeof window === "undefined") return "";
  return (window.localStorage.getItem(PENDING_PROMO_CODE_KEY) || "").trim().toUpperCase();
}

function clearStoredPromoCode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_PROMO_CODE_KEY);
}

function readAndClearPromoFlash(key: string) {
  if (typeof window === "undefined") return "";
  const value = window.localStorage.getItem(key) || "";
  if (value) window.localStorage.removeItem(key);
  return value;
}



function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readWalletHermesLayout(): WalletHermesLayout {
  if (typeof window === "undefined") return DEFAULT_WALLET_HERMES_LAYOUT;
  try {
    const raw = window.localStorage.getItem(WALLET_HERMES_LAYOUT_KEY);
    if (!raw) return DEFAULT_WALLET_HERMES_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<WalletHermesLayout>;
    return {
      widthPercent: clamp(Number(parsed.widthPercent ?? DEFAULT_WALLET_HERMES_LAYOUT.widthPercent), 70, 150),
      heightPx: clamp(Number(parsed.heightPx ?? DEFAULT_WALLET_HERMES_LAYOUT.heightPx), 280, 760),
      offsetX: clamp(Number(parsed.offsetX ?? DEFAULT_WALLET_HERMES_LAYOUT.offsetX), -220, 220),
      offsetY: clamp(Number(parsed.offsetY ?? DEFAULT_WALLET_HERMES_LAYOUT.offsetY), -220, 220),
    };
  } catch {
    return DEFAULT_WALLET_HERMES_LAYOUT;
  }
}

function storeWalletHermesLayout(layout: WalletHermesLayout) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WALLET_HERMES_LAYOUT_KEY, JSON.stringify(layout));
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

  const [topupOpen, setTopupOpen] = useState(false);
  const [amountRub, setAmountRub] = useState("3000");
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoInfo, setPromoInfo] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<WorkspaceSubscriptionStatus | null>(null);
  const [subscriptionBusyKey, setSubscriptionBusyKey] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<string | null>(null);
  const [walletHermesLayout, setWalletHermesLayout] = useState<WalletHermesLayout>(DEFAULT_WALLET_HERMES_LAYOUT);
  const [walletHermesConstructorOpen, setWalletHermesConstructorOpen] = useState(false);

  const canManageWalletHermesLayout = (user?.email || "").trim().toLowerCase() === WALLET_TEMPLATE_OWNER_EMAIL;

  useEffect(() => {
    if (!canManageWalletHermesLayout && walletHermesConstructorOpen) {
      setWalletHermesConstructorOpen(false);
    }
  }, [canManageWalletHermesLayout, walletHermesConstructorOpen]);

  useEffect(() => {
    setPromoCode(getStoredPromoCode());
    const promoSuccess = readAndClearPromoFlash(PROMO_FLASH_SUCCESS_KEY);
    const promoErrorText = readAndClearPromoFlash(PROMO_FLASH_ERROR_KEY);
    if (promoSuccess) setPromoInfo(promoSuccess);
    if (promoErrorText) setPromoError(promoErrorText);

    if (typeof window !== "undefined") {
      setWalletHermesLayout(readWalletHermesLayout());
      const url = new URL(window.location.href);
      if (url.searchParams.get("plan_paid") === "1") {
        setSubscriptionInfo("Оплата тарифа принята. Проверяем активацию и обновляем лимит проектов…");
      }
      if (url.searchParams.get("paid") === "1") {
        setTopupError(null);
      }
    }
  }, []);

  const parsedRub = useMemo(() => {
    const n = Number(String(amountRub).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.floor(n);
  }, [amountRub]);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setActiveSubscription(null);
      return;
    }
    loadSubscriptionStatus();
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (!user || !session?.access_token || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const needsPlanPolling = url.searchParams.get("plan_paid") === "1";
    const needsWalletPolling = url.searchParams.get("paid") === "1";
    if (!needsPlanPolling && !needsWalletPolling) return;

    let cancelled = false;
    const ticks = [0, 2500, 6000, 12000];
    ticks.forEach((delay) => {
      window.setTimeout(async () => {
        if (cancelled) return;
        if (needsWalletPolling) await refresh();
        if (needsPlanPolling) await loadSubscriptionStatus();
      }, delay);
    });

    return () => { cancelled = true; };
  }, [user?.id, session?.access_token, refresh]);


  async function redeemPromo(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setPromoError("Укажи промокод.");
      return;
    }
    if (!session?.access_token) {
      setPromoError("Нужно войти, чтобы активировать промокод.");
      return;
    }

    setPromoBusy(true);
    setPromoError(null);
    setPromoInfo(null);
    try {
      const r = await fetch("/api/commercial/promo-codes/redeem", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || "Не удалось активировать промокод");
      }
      clearStoredPromoCode();
      setPromoCode("");
      setPromoInfo(`Промокод ${normalizedCode} успешно активирован.`);
      await refresh();
      await loadSubscriptionStatus();
    } catch (e: any) {
      if (typeof window !== "undefined") {
      setWalletHermesLayout(readWalletHermesLayout());
        window.localStorage.setItem(PENDING_PROMO_CODE_KEY, normalizedCode);
      }
      setPromoError(e?.message || "Не удалось активировать промокод");
    } finally {
      setPromoBusy(false);
    }
  }


  async function loadSubscriptionStatus() {
    if (!session?.access_token) {
      setActiveSubscription(null);
      return;
    }
    try {
      const resp = await fetch("/api/commercial/subscriptions/status", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as SubscriptionStatusResp;
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить месячный тариф");
      setActiveSubscription(json.active_subscription || null);
    } catch (err: any) {
      setSubscriptionError((current) => current || err?.message || "Не удалось загрузить месячный тариф");
    }
  }

  async function startMonthlyPlanPurchase(planKey: MonthlyPlanKey) {
    if (!session?.access_token) {
      setSubscriptionError("Нужно войти, чтобы оформить тариф.");
      return;
    }

    setSubscriptionBusyKey(`online:${planKey}`);
    setSubscriptionError(null);
    setSubscriptionInfo(null);
    try {
      const resp = await fetch("/api/commercial/subscriptions/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = (await resp.json().catch(() => ({}))) as CreateSubscriptionResp;
      if (!resp.ok || !data.ok || !data.confirmation_url) {
        throw new Error(data.error || "Не удалось создать оплату тарифа");
      }
      window.location.href = data.confirmation_url;
    } catch (err: any) {
      setSubscriptionError(err?.message || "Не удалось создать оплату тарифа");
    } finally {
      setSubscriptionBusyKey(null);
    }
  }

  async function buyMonthlyPlanFromWallet(planKey: MonthlyPlanKey) {
    if (!session?.access_token) {
      setSubscriptionError("Нужно войти, чтобы купить тариф с баланса.");
      return;
    }

    setSubscriptionBusyKey(`wallet:${planKey}`);
    setSubscriptionError(null);
    setSubscriptionInfo(null);
    try {
      const resp = await fetch("/api/commercial/subscriptions/purchase-from-wallet", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan_key: planKey }),
      });
      const data = (await resp.json().catch(() => ({}))) as WalletSubscriptionPurchaseResp;
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "Не удалось купить тариф с баланса");
      }
      setSubscriptionInfo("Тариф куплен с баланса кошелька и уже активирован.");
      await refresh();
      await loadSubscriptionStatus();
    } catch (err: any) {
      setSubscriptionError(err?.message || "Не удалось купить тариф с баланса");
    } finally {
      setSubscriptionBusyKey(null);
    }
  }

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


  function updateWalletHermesLayout(patch: Partial<WalletHermesLayout>) {
    setWalletHermesLayout((current) => {
      const next = {
        widthPercent: clamp(Number(patch.widthPercent ?? current.widthPercent), 70, 150),
        heightPx: clamp(Number(patch.heightPx ?? current.heightPx), 280, 760),
        offsetX: clamp(Number(patch.offsetX ?? current.offsetX), -220, 220),
        offsetY: clamp(Number(patch.offsetY ?? current.offsetY), -220, 220),
      };
      storeWalletHermesLayout(next);
      return next;
    });
  }

  function resetWalletHermesLayout() {
    setWalletHermesLayout(DEFAULT_WALLET_HERMES_LAYOUT);
    storeWalletHermesLayout(DEFAULT_WALLET_HERMES_LAYOUT);
  }


  return (
    <Layout title="Кошелёк">
      {!user ? (
        <div className={FRAME_CARD}>
          <div className="text-sm text-slate-700">Чтобы пользоваться кошельком — нужно войти.</div>
          <Link href="/auth?next=/wallet" className="mt-3 inline-block btn btn-primary">Вход</Link>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <div className={FRAME_CARD + " relative overflow-hidden"}>
              <div className="pointer-events-none absolute -right-6 -top-10 text-[180px] font-light leading-none text-slate-200/35 select-none">☿</div>
              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Кошелёк</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">
                    {wallet ? (isUnlimited ? "∞" : formatRub(wallet.balance_kopeks)) : "—"}
                  </div>
                  <div className="mt-2 max-w-xl text-sm text-slate-600">
                    Баланс используется для открытия уровней результата, AI-интерпретаций и расширенных функций. Тарифы ниже можно купить онлайн или сразу с внутреннего баланса кошелька.
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

            <div className={FRAME_CARD}>
              <div className="text-sm font-semibold text-emerald-900">Промокод</div>
              <div className="mt-2 text-sm text-slate-600">Здесь можно безопасно повторить активацию. Если код не применился при регистрации или первом входе, он останется сохранён.</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Например: START-500"
                  className="input"
                />
                <button
                  type="button"
                  onClick={() => redeemPromo(promoCode)}
                  disabled={promoBusy || !promoCode.trim()}
                  className="btn btn-primary whitespace-nowrap"
                >
                  {promoBusy ? "Активирую…" : "Активировать"}
                </button>
              </div>
              {promoError ? <div className="mt-2 text-sm text-red-600">{promoError}</div> : null}
              {promoInfo ? <div className="mt-2 text-sm text-emerald-700">{promoInfo}</div> : null}
              {getStoredPromoCode() ? <div className="mt-2 text-xs text-amber-700">Сохранённый код: {getStoredPromoCode()}</div> : null}
            </div>

            <div id="wallet-plans" className={FRAME_CARD}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-900">Ежемесячные тарифы</div>
                  <div className="mt-2 text-sm text-slate-600">Тариф действует 30 дней. Один проект списывается только один раз, дальше внутри него можно открывать весь результат без доплаты. Тариф можно оплатить онлайн или купить сразу с баланса кошелька.</div>
                </div>
                {activeSubscription ? (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">
                    <div className="font-medium">Активен: {activeSubscription.plan_title}</div>
                    <div className="mt-1 text-xs">Осталось: {activeSubscription.projects_remaining} из {activeSubscription.projects_limit} · до {formatMonthlySubscriptionPeriod(activeSubscription.expires_at)}</div>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {MONTHLY_SUBSCRIPTION_PLANS.map((plan) => {
                  const isActive = activeSubscription?.plan_key === plan.key && activeSubscription?.status !== "expired";
                  return (
                    <div key={plan.key} className={`rounded-[28px] border p-4 shadow-sm ${isActive ? "border-emerald-300 bg-emerald-50/60" : "border-[#e5d6bd] bg-white/80"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-950">{plan.projectsLimit} проектов / месяц</div>
                          <div className="mt-1 text-sm text-slate-500">{plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽ / месяц</div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${isActive ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-600"}`}>{plan.effectiveProjectPriceRub} ₽ за проект</span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-600">{plan.description}</div>
                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          className="btn btn-primary w-full"
                          disabled={!!subscriptionBusyKey || (!isUnlimited && Number(wallet?.balance_kopeks ?? 0) < plan.monthlyPriceRub * 100)}
                          onClick={() => buyMonthlyPlanFromWallet(plan.key)}
                        >
                          {subscriptionBusyKey === `wallet:${plan.key}` ? "Покупаю…" : `С баланса · ${plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽`}
                        </button>
                        {PAYMENTS_UI_ENABLED ? (
                          <button
                            type="button"
                            className="btn btn-secondary w-full"
                            disabled={!!subscriptionBusyKey}
                            onClick={() => startMonthlyPlanPurchase(plan.key)}
                          >
                            {subscriptionBusyKey === `online:${plan.key}` ? "Создаю оплату…" : isActive ? "Продлить онлайн" : "Оплатить онлайн"}
                          </button>
                        ) : (
                          <div className="rounded-[20px] border border-[#e5d6bd] bg-[#fffaf2] px-3 py-2 text-xs text-slate-600">
                            Онлайн-оплата выключена. Тариф можно взять с баланса.
                          </div>
                        )}
                        {!isUnlimited && Number(wallet?.balance_kopeks ?? 0) < plan.monthlyPriceRub * 100 ? (
                          <div className="text-xs text-amber-700">На балансе пока меньше стоимости тарифа.</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {subscriptionError ? <div className="mt-3 text-sm text-red-600">{subscriptionError}</div> : null}
              {subscriptionInfo ? <div className="mt-3 text-sm text-emerald-700">{subscriptionInfo}</div> : null}
            </div>

            <div className={FRAME_CARD}>
              <div className="text-sm font-semibold text-emerald-900">Оферта и контакты</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">
                Все реквизиты, условия возврата и контакты вынесены на одну отдельную страницу.
              </div>
              <div className="mt-4">
                <Link href="/legal/offer" className="btn btn-secondary">Открыть страницу условий</Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className={FRAME_CARD + " overflow-hidden p-0"}>
              <div className="border-b border-[#e5d6bd] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#9a7a4b]">Иллюстрация</div>
                  </div>
                  {canManageWalletHermesLayout ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-secondary" onClick={() => setWalletHermesConstructorOpen((v) => !v)}>
                        {walletHermesConstructorOpen ? "Скрыть конструктор" : "Конструктор"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={resetWalletHermesLayout}>
                        Сбросить
                      </button>
                    </div>
                  ) : null}
                </div>
                {walletHermesConstructorOpen ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className={FRAME_SOFT + " p-3"}>
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#9a7a4b]">Размер</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-700">
                        <label className="block">
                          <div className="mb-1 flex items-center justify-between"><span>Ширина</span><span>{walletHermesLayout.widthPercent}%</span></div>
                          <input type="range" min="70" max="150" step="1" value={walletHermesLayout.widthPercent} onChange={(e) => updateWalletHermesLayout({ widthPercent: Number(e.target.value) })} className="w-full" />
                        </label>
                        <label className="block">
                          <div className="mb-1 flex items-center justify-between"><span>Высота блока</span><span>{walletHermesLayout.heightPx}px</span></div>
                          <input type="range" min="280" max="760" step="10" value={walletHermesLayout.heightPx} onChange={(e) => updateWalletHermesLayout({ heightPx: Number(e.target.value) })} className="w-full" />
                        </label>
                      </div>
                    </div>
                    <div className={FRAME_SOFT + " p-3"}>
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#9a7a4b]">Положение</div>
                      <div className="mt-3 space-y-3 text-sm text-slate-700">
                        <label className="block">
                          <div className="mb-1 flex items-center justify-between"><span>Сдвиг по X</span><span>{walletHermesLayout.offsetX}px</span></div>
                          <input type="range" min="-220" max="220" step="2" value={walletHermesLayout.offsetX} onChange={(e) => updateWalletHermesLayout({ offsetX: Number(e.target.value) })} className="w-full" />
                        </label>
                        <label className="block">
                          <div className="mb-1 flex items-center justify-between"><span>Сдвиг по Y</span><span>{walletHermesLayout.offsetY}px</span></div>
                          <input type="range" min="-220" max="220" step="2" value={walletHermesLayout.offsetY} onChange={(e) => updateWalletHermesLayout({ offsetY: Number(e.target.value) })} className="w-full" />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,250,242,0.98)_0%,rgba(246,238,226,0.98)_100%)]" style={{ height: `${walletHermesLayout.heightPx}px` }}>
                <img
                  src="/wallet-hermes-guide.png"
                  alt="Гермес с табличкой"
                  className="absolute left-0 top-0 max-w-none select-none"
                  style={{
                    width: `${walletHermesLayout.widthPercent}%`,
                    transform: `translate(${walletHermesLayout.offsetX}px, ${walletHermesLayout.offsetY}px)`,
                  }}
                />
              </div>
            </div>

            <div className={FRAME_CARD}>
              <div className="text-sm font-semibold text-emerald-900">{PAYMENTS_UI_ENABLED ? "Быстрое пополнение" : "Пополнение временно отключено"}</div>
              {activeSubscription ? <div className="mt-2 text-xs text-emerald-700">Активный тариф: {activeSubscription.plan_title} · осталось {activeSubscription.projects_remaining} проектов.</div> : null}
              <div className="mt-2 text-sm text-slate-600">{PAYMENTS_UI_ENABLED ? "Выбери сумму и сразу перейди к оплате." : "Онлайн-оплата выключена. Пополнение недоступно, но тарифы всё равно можно покупать с уже существующего баланса."}</div>
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

            <div className={FRAME_CARD}>
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
              <div className={FRAME_CARD + " w-full max-w-md shadow-lg"}>
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
