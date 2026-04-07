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
const PENDING_PROMO_CODE_KEY = "pending_promo_code";
const PROMO_FLASH_SUCCESS_KEY = "promo_flash_success";
const PROMO_FLASH_ERROR_KEY = "promo_flash_error";

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

  useEffect(() => {
    setPromoCode(getStoredPromoCode());
    const promoSuccess = readAndClearPromoFlash(PROMO_FLASH_SUCCESS_KEY);
    const promoErrorText = readAndClearPromoFlash(PROMO_FLASH_ERROR_KEY);
    if (promoSuccess) setPromoInfo(promoSuccess);
    if (promoErrorText) setPromoError(promoErrorText);

    if (typeof window !== "undefined") {
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

  const walletBalance = Number(wallet?.balance_kopeks ?? 0);
  const balanceLabel = wallet ? (isUnlimited ? "∞" : formatRub(wallet.balance_kopeks)) : "—";
  const activePlanTitle = activeSubscription?.plan_title || "Без активного тарифа";
  const remainingProjectsLabel = activeSubscription
    ? `${activeSubscription.projects_remaining} из ${activeSubscription.projects_limit}`
    : "—";
  const expiryLabel = activeSubscription ? formatMonthlySubscriptionPeriod(activeSubscription.expires_at) : "—";
  const usagePercent = activeSubscription && activeSubscription.projects_limit > 0
    ? Math.max(0, Math.min(100, Math.round(((activeSubscription.projects_limit - activeSubscription.projects_remaining) / activeSubscription.projects_limit) * 100)))
    : 0;
  const suggestedPlan = useMemo(() => {
    if (!activeSubscription) return MONTHLY_SUBSCRIPTION_PLANS[0];
    const current = MONTHLY_SUBSCRIPTION_PLANS.find((plan) => plan.key === activeSubscription.plan_key);
    const idx = current ? MONTHLY_SUBSCRIPTION_PLANS.findIndex((plan) => plan.key === current.key) : -1;
    return MONTHLY_SUBSCRIPTION_PLANS[Math.min(MONTHLY_SUBSCRIPTION_PLANS.length - 1, Math.max(0, idx + 1))];
  }, [activeSubscription]);

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
        <div className="grid gap-5">
          <section className="card relative overflow-hidden border-[#d8c3a0] bg-[linear-gradient(180deg,#fffaf2_0%,#f5efe6_100%)]">
            <div className="absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top_right,rgba(212,190,153,0.26),transparent_58%)] lg:block" />
            <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-[#8d6b43]">Кошелёк и пакеты доступа</div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2f5d3a] sm:text-4xl">Ресурсы, лимиты и апгрейд — в одном месте</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6f6557] sm:text-[15px]">
                  Здесь видно баланс, активный тариф, остаток проектов и ближайшее действие. Без бухгалтерского тумана: минимум шума, максимум смысла.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {!isUnlimited && PAYMENTS_UI_ENABLED ? (
                    <button type="button" onClick={() => setTopupOpen(true)} className="btn btn-primary">
                      Пополнить баланс
                    </button>
                  ) : null}
                  <button type="button" onClick={refresh} className="btn btn-secondary">
                    Обновить статус
                  </button>
                  <Link href="#wallet-plans" className="btn btn-secondary">Открыть тарифы</Link>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#6f6557]">
                  {isUnlimited ? <span className="rounded-full border border-[#d8c3a0] bg-white/80 px-3 py-1">Тестовый безлимит</span> : null}
                  {activeSubscription ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                      Активен {activeSubscription.plan_title} до {expiryLabel}
                    </span>
                  ) : (
                    <span className="rounded-full border border-[#d8c3a0] bg-white/80 px-3 py-1">Тариф пока не подключён</span>
                  )}
                </div>
                {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
                {loading ? <div className="mt-2 text-xs text-slate-500">⏳ Загружаю…</div> : null}
              </div>

              <div className="relative min-h-[320px] lg:min-h-[360px]">
                <div className="relative mx-auto max-w-[620px]">
                  <img
                    src="/wallet-hermes-guide.png"
                    alt="Гермес с табличкой для кошелька"
                    className="w-full max-w-[620px] object-contain drop-shadow-[0_22px_32px_rgba(122,94,53,0.18)]"
                  />
                  <div className="absolute right-[7%] top-[28%] w-[35%] min-w-[180px] rounded-[26px] border border-[#d8c3a0] bg-white/92 p-4 shadow-[0_16px_30px_rgba(122,94,53,0.12)] backdrop-blur">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7a4b]">Кратко</div>
                    <div className="mt-2 text-xl font-semibold text-[#2f5d3a]">{activeSubscription ? activeSubscription.plan_title : "Выбери пакет"}</div>
                    <div className="mt-2 text-sm text-[#6f6557]">
                      {activeSubscription
                        ? `Осталось ${activeSubscription.projects_remaining} проектов до ${expiryLabel}.`
                        : `Сейчас можно пополнить баланс и выбрать удобный пакет без лишнего меню.`}
                    </div>
                    <div className="mt-3 rounded-2xl border border-[#eadcc6] bg-[#fffaf2] px-3 py-2 text-xs text-[#6f6557]">
                      {activeSubscription
                        ? usagePercent >= 80
                          ? "Лимит уже поджимает — логично смотреть апгрейд."
                          : "Запас по лимиту есть, но тарифы ниже можно сравнить по цене за проект."
                        : `Стартовый ориентир: ${suggestedPlan.projectsLimit} проектов за ${suggestedPlan.monthlyPriceRub.toLocaleString("ru-RU")} ₽.`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Баланс", value: balanceLabel, note: isUnlimited ? "Без ограничений" : "Готов к списаниям и покупкам" },
              { label: "Активный пакет", value: activePlanTitle, note: activeSubscription ? `До ${expiryLabel}` : "Можно выбрать ниже" },
              { label: "Остаток проектов", value: remainingProjectsLabel, note: activeSubscription ? `${usagePercent}% уже использовано` : "Появится после покупки" },
              { label: "Следующее действие", value: activeSubscription ? (usagePercent >= 80 ? "Продлить / улучшить" : "Работать дальше") : "Пополнить / выбрать", note: activeSubscription ? "Тариф и лимиты под рукой" : "Кошелёк уже готов" },
            ].map((item) => (
              <div key={item.label} className="card border-[#e2d2b7] bg-white">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#9a7a4b]">{item.label}</div>
                <div className="mt-3 text-2xl font-semibold leading-tight text-[#2f2a24]">{item.value}</div>
                <div className="mt-2 text-sm text-[#766c5f]">{item.note}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-4">
              <div className="card border-[#e2d2b7] bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#2f5d3a]">Промокод</div>
                    <div className="mt-2 text-sm text-[#6f6557]">Если код не применился раньше, можно спокойно добить его здесь без повторной регистрации.</div>
                  </div>
                  {getStoredPromoCode() ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">Сохранён: {getStoredPromoCode()}</span> : null}
                </div>
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
              </div>

              <div className="card border-[#e2d2b7] bg-white">
                <div className="text-sm font-semibold text-[#2f5d3a]">Лимиты и логика работы</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#ece2d1] bg-[#fffaf2] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9a7a4b]">Списания</div>
                    <div className="mt-2 text-sm text-[#6f6557]">Один проект списывается один раз. Дальше внутри проекта можно открывать уровни результата без повторной оплаты проекта.</div>
                  </div>
                  <div className="rounded-2xl border border-[#ece2d1] bg-[#fffaf2] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[#9a7a4b]">Тариф</div>
                    <div className="mt-2 text-sm text-[#6f6557]">Месячный пакет действует 30 дней и показывает понятный остаток по проектам, а не абстрактную магию в вакууме.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-[#e2d2b7] bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#2f5d3a]">Быстрое действие</div>
                  <div className="mt-2 text-sm text-[#6f6557]">
                    {PAYMENTS_UI_ENABLED
                      ? "Выбери сумму и сразу переходи к оплате. Если баланс уже есть, тарифы ниже можно купить прямо с него."
                      : "Онлайн-оплата пока выключена, но страница уже готова под тарифы и лимиты."}
                  </div>
                </div>
                {activeSubscription ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <div className="font-medium">Активен: {activeSubscription.plan_title}</div>
                    <div className="mt-1 text-xs">Осталось {activeSubscription.projects_remaining} из {activeSubscription.projects_limit}</div>
                  </div>
                ) : null}
              </div>
              {PAYMENTS_UI_ENABLED ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {QUICK_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAmountRub(String(a))}
                        className="btn btn-secondary btn-pill"
                      >
                        {a.toLocaleString("ru-RU")} ₽
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
                      {isUnlimited ? "∞" : topupBusy ? "Создаю…" : "Пополнить"}
                    </button>
                  </div>
                  <div className="mt-3 text-[11px] text-[#8a806f]">Минимум 1 ₽. Для тестового безлимита оплата не нужна.</div>
                  {topupError ? <div className="mt-2 text-sm text-red-600">{topupError}</div> : null}
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-[#ece2d1] bg-[#fffaf2] p-4 text-sm text-[#6f6557]">
                  Как только ЮKassa будет подключена, сюда без боли встанут быстрые суммы и кнопка оплаты.
                </div>
              )}
            </div>
          </section>

          <section id="wallet-plans" className="card border-[#d8c3a0] bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#2f5d3a]">Пакеты оценки</div>
                <div className="mt-2 max-w-3xl text-sm text-[#6f6557]">Пакет живёт 30 дней. Ниже — нормальное сравнение по лимиту, цене и следующему действию. Без пряток в кошельке, как и должно быть.</div>
              </div>
              {activeSubscription ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <div className="font-medium">Активен: {activeSubscription.plan_title}</div>
                  <div className="mt-1 text-xs">До {expiryLabel} · остаток {activeSubscription.projects_remaining} из {activeSubscription.projects_limit}</div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {MONTHLY_SUBSCRIPTION_PLANS.map((plan) => {
                const isActive = activeSubscription?.plan_key === plan.key && activeSubscription?.status !== "expired";
                const canAfford = isUnlimited || walletBalance >= plan.monthlyPriceRub * 100;
                return (
                  <div key={plan.key} className={`rounded-[28px] border p-5 shadow-sm ${isActive ? "border-emerald-300 bg-emerald-50/60" : "border-[#e4d4b9] bg-[#fffaf2]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.18em] text-[#9a7a4b]">Пакет</div>
                        <div className="mt-2 text-xl font-semibold text-[#2f2a24]">{plan.projectsLimit} проектов / месяц</div>
                        <div className="mt-1 text-sm text-[#7d7264]">{plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽ / месяц</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${isActive ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-600"}`}>{plan.effectiveProjectPriceRub} ₽ за проект</span>
                    </div>
                    <div className="mt-4 text-sm leading-6 text-[#6f6557]">{plan.description}</div>
                    <div className="mt-4 rounded-2xl border border-[#eadcc6] bg-white/80 px-3 py-2 text-xs text-[#6f6557]">
                      {isActive ? "Этот пакет уже активен. Можно продлить или перескочить выше." : `Если работаешь стабильно, этот пакет уже выглядит честнее по цене за проект.`}
                    </div>
                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        className="btn btn-primary w-full"
                        disabled={!!subscriptionBusyKey || !canAfford}
                        onClick={() => buyMonthlyPlanFromWallet(plan.key)}
                      >
                        {subscriptionBusyKey === `wallet:${plan.key}` ? "Покупаю с баланса…" : `Купить с баланса · ${plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽`}
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
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          Онлайн-оплата сейчас выключена, но покупка с баланса уже работает.
                        </div>
                      )}
                      {!canAfford ? <div className="text-xs text-amber-700">На балансе пока меньше стоимости пакета.</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {subscriptionError ? <div className="mt-3 text-sm text-red-600">{subscriptionError}</div> : null}
            {subscriptionInfo ? <div className="mt-3 text-sm text-emerald-700">{subscriptionInfo}</div> : null}
          </section>

          <section className="card border-[#e2d2b7] bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[#2f5d3a]">История операций</div>
                <div className="mt-2 text-sm text-[#6f6557]">Все пополнения, покупки и списания — в одном списке. Без квеста с поиском, куда делись деньги.</div>
              </div>
              <div className="rounded-2xl border border-[#ece2d1] bg-[#fffaf2] px-4 py-3 text-xs text-[#6f6557]">
                Записей: {ledger.length}
              </div>
            </div>
            <div className="mt-4 max-h-[460px] overflow-auto rounded-3xl border border-[#efe6d8]">
              <table className="w-full text-sm">
                <thead className="bg-[#fffaf2] text-left text-xs uppercase tracking-[0.14em] text-[#9a7a4b]">
                  <tr>
                    <th className="px-4 py-3">Дата</th>
                    <th className="px-4 py-3">Сумма</th>
                    <th className="px-4 py-3">Причина</th>
                    <th className="px-4 py-3">Ссылка</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={row.id} className="border-t border-[#f1e8db] text-[#51483c]">
                      <td className="px-4 py-3 text-xs text-[#7b7265]">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{formatRub(row.amount_kopeks)}</td>
                      <td className="px-4 py-3">{reasonLabel(row.reason)}</td>
                      <td className="px-4 py-3 text-xs text-[#7b7265]">{row.ref ?? "—"}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#8a806f]">Пока пусто</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {isUnlimited || !PAYMENTS_UI_ENABLED ? null : topupOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-md card shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Пополнить баланс</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Откроем страницу ЮKassa для СБП (QR). После оплаты вернёшься назад, а баланс обновится автоматически.
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

                  {topupError ? <div className="mt-3 text-sm text-red-600">{topupError}</div> : null}

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

                  <div className="mt-3 text-[11px] text-slate-500">Минимум 1 ₽. Комиссии и чек — по настройкам ЮKassa.</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Layout>
  );
}
