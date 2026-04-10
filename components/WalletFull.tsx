import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { formatRub, useWallet } from "@/lib/useWallet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PAYMENTS_UI_ENABLED, YOOKASSA_TEST_UI_ENABLED } from "@/lib/payments";
import { isGlobalTemplateOwnerEmail } from "@/lib/admin";
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

const QUICK_AMOUNTS = [3000, 15000, 30000] as const;

const FRAME_CARD = "rounded-[20px] border border-slate-200 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)]";
const FRAME_SOFT = "rounded-[16px] border border-slate-200 bg-slate-50";
const ACTION_PRIMARY = "inline-flex items-center justify-center rounded-[12px] border border-[#264a85] bg-[linear-gradient(180deg,#315ea8_0%,#223f77_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,67,129,0.22)] transition duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55";
const ACTION_SECONDARY = "inline-flex items-center justify-center rounded-[12px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.06)] transition duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55";
const ACTION_CHIP = "inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-55";
const INPUT_CLASS = "h-14 w-full rounded-[12px] border border-slate-200 bg-white px-4 text-[15px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#315ea8] focus:ring-4 focus:ring-[#dbe7ff]";
const PLAN_VISUALS = [
  {
    name: "Старт",
    accent: "30",
    gradient: "bg-[linear-gradient(135deg,#f7ead7_0%,#f1e8c7_36%,#cae5d2_100%)]",
  },
  {
    name: "Профи",
    accent: "50",
    gradient: "bg-[linear-gradient(135deg,#efe3d1_0%,#dfe8d4_40%,#b9dcc7_100%)]",
  },
  {
    name: "Бизнес",
    accent: "100",
    gradient: "bg-[linear-gradient(135deg,#e9decf_0%,#d4e1d1_42%,#a8d3bf_100%)]",
  },
] as const;

const PENDING_PROMO_CODE_KEY = "pending_promo_code";
const PROMO_FLASH_SUCCESS_KEY = "promo_flash_success";
const PROMO_FLASH_ERROR_KEY = "promo_flash_error";
const WALLET_HERMES_LAYOUT_KEY = "wallet_hermes_layout_v1";
const YOOKASSA_PENDING_TOPUP_KEY = "yookassa_pending_topup_payment_id";
const YOOKASSA_PENDING_PLAN_KEY = "yookassa_pending_plan_payment_id";

type WalletHermesLayout = {
  widthPercent: number;
  heightPx: number;
  offsetX: number;
  offsetY: number;
  cardWidthPx: number;
  cardHeightPx: number;
  cardOffsetX: number;
  cardOffsetY: number;
};

const DEFAULT_WALLET_HERMES_LAYOUT: WalletHermesLayout = {
  widthPercent: 100,
  heightPx: 420,
  offsetX: 0,
  offsetY: 0,
  cardWidthPx: 330,
  cardHeightPx: 250,
  cardOffsetX: 0,
  cardOffsetY: -18,
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



function getPendingYooKassaPaymentId(key: string) {
  if (typeof window === "undefined") return "";
  return (window.localStorage.getItem(key) || "").trim();
}

function setPendingYooKassaPaymentId(key: string, value: string) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, value);
}

function clearPendingYooKassaPaymentId(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
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
      cardWidthPx: clamp(Number(parsed.cardWidthPx ?? DEFAULT_WALLET_HERMES_LAYOUT.cardWidthPx), 240, 420),
      cardHeightPx: clamp(Number(parsed.cardHeightPx ?? DEFAULT_WALLET_HERMES_LAYOUT.cardHeightPx), 200, 420),
      cardOffsetX: clamp(Number(parsed.cardOffsetX ?? DEFAULT_WALLET_HERMES_LAYOUT.cardOffsetX), -220, 220),
      cardOffsetY: clamp(Number(parsed.cardOffsetY ?? DEFAULT_WALLET_HERMES_LAYOUT.cardOffsetY), -220, 220),
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
  const SHOW_YOOKASSA_TEST_BUTTONS = YOOKASSA_TEST_UI_ENABLED && !PAYMENTS_UI_ENABLED;

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

  const canManageWalletHermesLayout = isGlobalTemplateOwnerEmail(user?.email);
  const [walletHermesTemplateBusy, setWalletHermesTemplateBusy] = useState(false);
  const [walletHermesTemplateInfo, setWalletHermesTemplateInfo] = useState<string | null>(null);
  const [walletHermesTemplateError, setWalletHermesTemplateError] = useState<string | null>(null);

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
          heightPx: clamp(Number(data.template.heightPx ?? DEFAULT_WALLET_HERMES_LAYOUT.heightPx), isGlobalTemplateOwnerEmail(user?.email) ? 280 : 300, isGlobalTemplateOwnerEmail(user?.email) ? 760 : 380),
          offsetX: clamp(Number(data.template.offsetX ?? DEFAULT_WALLET_HERMES_LAYOUT.offsetX), -220, 220),
          offsetY: clamp(Number(data.template.offsetY ?? DEFAULT_WALLET_HERMES_LAYOUT.offsetY), -220, 220),
          cardWidthPx: clamp(Number(data.template.cardWidthPx ?? DEFAULT_WALLET_HERMES_LAYOUT.cardWidthPx), 240, 420),
          cardHeightPx: clamp(Number(data.template.cardHeightPx ?? DEFAULT_WALLET_HERMES_LAYOUT.cardHeightPx), isGlobalTemplateOwnerEmail(user?.email) ? 200 : 190, isGlobalTemplateOwnerEmail(user?.email) ? 420 : 320),
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
      setWalletHermesTemplateInfo("Шаблон окна оплаты сохранен для всех.");
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

    const planPaymentId = needsPlanPolling ? getPendingYooKassaPaymentId(YOOKASSA_PENDING_PLAN_KEY) : "";
    const walletPaymentId = needsWalletPolling ? getPendingYooKassaPaymentId(YOOKASSA_PENDING_TOPUP_KEY) : "";

    let cancelled = false;
    const ticks = [0, 2500, 6000, 12000];
    ticks.forEach((delay) => {
      window.setTimeout(async () => {
        if (cancelled) return;
        try {
          if (needsWalletPolling && walletPaymentId) {
            const result = await syncReturnedYooKassaPayment(walletPaymentId);
            if (result?.status === "succeeded") {
              clearPendingYooKassaPaymentId(YOOKASSA_PENDING_TOPUP_KEY);
            }
          }
          if (needsPlanPolling && planPaymentId) {
            const result = await syncReturnedYooKassaPayment(planPaymentId);
            if (result?.status === "succeeded") {
              clearPendingYooKassaPaymentId(YOOKASSA_PENDING_PLAN_KEY);
            }
          }
        } catch {}
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

  async function syncReturnedYooKassaPayment(paymentId: string) {
    if (!session?.access_token || !paymentId) return;
    const resp = await fetch("/api/yookassa/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ force: true, payment_id: paymentId }),
    });
    const json = await resp.json().catch(() => ({} as any));
    if (!resp.ok || !json?.ok) {
      throw new Error(json?.error || "Не удалось подтвердить оплату");
    }
    return json;
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
      if (!resp.ok || !data.ok || !data.confirmation_url || !data.payment_id) {
        throw new Error(data.error || "Не удалось создать оплату тарифа");
      }
      setPendingYooKassaPaymentId(YOOKASSA_PENDING_PLAN_KEY, data.payment_id);
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


  function updateWalletHermesLayout(patch: Partial<WalletHermesLayout>) {
    setWalletHermesLayout((current) => {
      const next: WalletHermesLayout = {
        widthPercent: clamp(Number(patch.widthPercent ?? current.widthPercent), 70, 150),
        heightPx: clamp(Number(patch.heightPx ?? current.heightPx), 280, 760),
        offsetX: clamp(Number(patch.offsetX ?? current.offsetX), -220, 220),
        offsetY: clamp(Number(patch.offsetY ?? current.offsetY), -220, 220),
        cardWidthPx: clamp(Number(patch.cardWidthPx ?? current.cardWidthPx), 220, 520),
        cardHeightPx: clamp(Number(patch.cardHeightPx ?? current.cardHeightPx), 160, 420),
        cardOffsetX: clamp(Number(patch.cardOffsetX ?? current.cardOffsetX), -180, 180),
        cardOffsetY: clamp(Number(patch.cardOffsetY ?? current.cardOffsetY), -180, 180),
      };
      storeWalletHermesLayout(next);
      return next;
    });
  }

  function resetWalletHermesLayout() {
    setWalletHermesLayout(DEFAULT_WALLET_HERMES_LAYOUT);
    storeWalletHermesLayout(DEFAULT_WALLET_HERMES_LAYOUT);
  }

  const visibleLedger = ledger.slice(0, 8);
  const canShowInlinePayment = PAYMENTS_UI_ENABLED || SHOW_YOOKASSA_TEST_BUTTONS;
  const activePlanTitle = activeSubscription ? activeSubscription.plan_title : "Пакет не подключен";
  const activePlanMeta = activeSubscription
    ? `${activeSubscription.projects_remaining} из ${activeSubscription.projects_limit} проектов · до ${formatMonthlySubscriptionPeriod(activeSubscription.expires_at)}`
    : "Выбери пакет ниже или пополни баланс для оплаты";


  return (
    <Layout title="Кошелёк">
      {!user ? (
        <>
          <div className={FRAME_CARD + " p-5"}>
            <div className="text-sm text-slate-700">Чтобы пользоваться кошельком — нужно войти.</div>
          </div>
          <Link href="/auth?next=/wallet" className={ACTION_PRIMARY}>Вход</Link>
        </>
      ) : (
        <div className="space-y-5">
          <div className={FRAME_CARD + " px-5 py-5 sm:px-6"}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-8">
                <div>
                  <div className="text-sm font-medium text-slate-600">Ваш баланс</div>
                  <div className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-slate-950">
                    {wallet ? (isUnlimited ? "∞" : formatRub(wallet.balance_kopeks)) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-600">Текущий пакет</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{activeSubscription ? activeSubscription.plan_title : "Не подключён"}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {activeSubscription ? formatMonthlySubscriptionPeriod(activeSubscription.expires_at) : "Выбери пакет ниже"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {!isUnlimited && PAYMENTS_UI_ENABLED ? (
                  <button type="button" onClick={() => setTopupOpen(true)} className={ACTION_SECONDARY}>
                    Пополнить
                  </button>
                ) : null}
                <button type="button" onClick={refresh} className={ACTION_PRIMARY}>
                  Обновить
                </button>
              </div>
            </div>
            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}
            {loading ? <div className="mt-2 text-xs text-slate-500">Загружаю…</div> : null}
          </div>

          <div className={FRAME_CARD + " px-5 py-5 sm:px-6"}>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Введите промокод"
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={() => redeemPromo(promoCode)}
                disabled={promoBusy || !promoCode.trim()}
                className={ACTION_PRIMARY + " whitespace-nowrap"}
              >
                {promoBusy ? "Активирую…" : "Активировать"}
              </button>
            </div>
            {promoError ? <div className="mt-3 text-sm text-red-600">{promoError}</div> : null}
            {promoInfo ? <div className="mt-3 text-sm text-emerald-700">{promoInfo}</div> : null}
            {getStoredPromoCode() ? <div className="mt-2 text-xs text-amber-700">Сохранённый код: {getStoredPromoCode()}</div> : null}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <div id="wallet-plans" className={FRAME_CARD + " px-5 py-5 sm:px-6"}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Пакеты услуг</div>
                  {activeSubscription ? (
                    <div className="text-xs font-medium text-emerald-700">
                      Активен: {activeSubscription.plan_title} · {activeSubscription.projects_remaining}/{activeSubscription.projects_limit}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {MONTHLY_SUBSCRIPTION_PLANS.map((plan) => {
                    const isActive = activeSubscription?.plan_key === plan.key && activeSubscription?.status !== "expired";
                    const insufficientBalance = !isUnlimited && Number(wallet?.balance_kopeks ?? 0) < plan.monthlyPriceRub * 100;
                    return (
                      <div
                        key={plan.key}
                        className={`rounded-[18px] border p-5 ${isActive ? "border-[#bfd7ff] bg-[#f7faff]" : "border-slate-200 bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-semibold text-slate-950">{plan.title}</div>
                            <div className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-slate-950">{plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽</div>
                          </div>
                          {isActive ? (
                            <span className="rounded-full bg-[#e8f1ff] px-3 py-1 text-[11px] font-semibold text-[#315ea8]">Активен</span>
                          ) : null}
                        </div>
                        <div className="mt-3 text-sm text-slate-600">{plan.projectsLimit} проектов, 30 дней</div>
                        <div className="mt-1 text-sm text-slate-500">{plan.effectiveProjectPriceRub} ₽ за проект</div>
                        <div className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</div>

                        <div className="mt-5 grid gap-2">
                          <button
                            type="button"
                            className={ACTION_PRIMARY + " w-full"}
                            disabled={!!subscriptionBusyKey || insufficientBalance}
                            onClick={() => buyMonthlyPlanFromWallet(plan.key)}
                          >
                            {subscriptionBusyKey === `wallet:${plan.key}` ? "Покупаю…" : `Купить`}
                          </button>

                          {PAYMENTS_UI_ENABLED ? (
                            <button
                              type="button"
                              className={ACTION_SECONDARY + " w-full"}
                              disabled={!!subscriptionBusyKey}
                              onClick={() => startMonthlyPlanPurchase(plan.key)}
                            >
                              {subscriptionBusyKey === `online:${plan.key}` ? "Создаю оплату…" : "Оплатить онлайн"}
                            </button>
                          ) : SHOW_YOOKASSA_TEST_BUTTONS ? (
                            <button
                              type="button"
                              className={ACTION_SECONDARY + " w-full"}
                              disabled={!!subscriptionBusyKey}
                              onClick={() => startMonthlyPlanPurchase(plan.key)}
                            >
                              {subscriptionBusyKey === `online:${plan.key}` ? "Создаю тестовую оплату…" : "Тест ЮKassa"}
                            </button>
                          ) : null}

                          {insufficientBalance ? (
                            <div className="text-xs text-amber-700">На балансе пока меньше стоимости пакета.</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {subscriptionError ? <div className="mt-4 text-sm text-red-600">{subscriptionError}</div> : null}
                {subscriptionInfo ? <div className="mt-4 text-sm text-emerald-700">{subscriptionInfo}</div> : null}
              </div>

              <div className={FRAME_CARD + " overflow-hidden px-5 py-5 sm:px-6"}>
                <div className="mb-4 text-sm font-semibold text-slate-900">Последние операции</div>
                <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
                  <div className="overflow-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <tbody>
                        {visibleLedger.map((row) => {
                          const positive = row.amount_kopeks > 0;
                          return (
                            <tr key={row.id} className="border-t border-slate-100 first:border-t-0">
                              <td className="px-4 py-3 text-slate-700">{reasonLabel(row.reason)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{new Date(row.created_at).toLocaleString()}</td>
                              <td className={`px-4 py-3 text-right font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                                {positive ? "+" : ""}{formatRub(row.amount_kopeks)}
                              </td>
                            </tr>
                          );
                        })}
                        {visibleLedger.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-500">Пока пусто</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div id="wallet-topup" className={FRAME_CARD + " overflow-hidden"}>
                <div className="bg-[linear-gradient(180deg,#eef5ff_0%,#f8fbff_100%)] px-5 py-5 sm:px-6">
                  <div className="text-sm font-semibold text-slate-900">Баланс рефил</div>
                  <div className="mt-4 text-sm font-medium text-slate-600">Сумма пополнения</div>
                  <div className="mt-2">
                    <input
                      value={amountRub}
                      onChange={(e) => setAmountRub(e.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      className={INPUT_CLASS + " text-right text-2xl font-semibold"}
                    />
                  </div>

                  {canShowInlinePayment ? (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {QUICK_AMOUNTS.map((a) => (
                          <button key={a} type="button" onClick={() => setAmountRub(String(a))} className={ACTION_CHIP}>
                            +{a}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={isUnlimited || topupBusy || parsedRub === null || parsedRub < 1}
                        onClick={() => startTopup(parsedRub || 0)}
                        className={ACTION_PRIMARY + " mt-4 w-full"}
                      >
                        {isUnlimited ? "∞" : topupBusy ? "Создаю оплату…" : "Пополнить баланс"}
                      </button>
                    </>
                  ) : (
                    <div className="mt-4 rounded-[12px] border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                      Онлайн-оплата сейчас выключена.
                    </div>
                  )}

                  {topupError ? <div className="mt-3 text-sm text-red-600">{topupError}</div> : null}
                </div>
              </div>

              <div className={FRAME_CARD + " px-5 py-5 sm:px-6"}>
                <Link href="/legal/offer" className="text-sm font-medium text-[#315ea8] hover:underline">
                  Оферта и реквизиты
                </Link>
              </div>
            </div>
          </div>

          {isUnlimited || !PAYMENTS_UI_ENABLED ? null : topupOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className={FRAME_CARD + " w-full max-w-md p-5 shadow-lg"}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Пополнить баланс</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Откроем страницу ЮKassa для СБП. После оплаты баланс обновится автоматически.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!topupBusy) {
                        setTopupOpen(false);
                        setTopupError(null);
                      }
                    }}
                    className={ACTION_SECONDARY}
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
                    className={INPUT_CLASS + " mt-1"}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAmountRub(String(a))}
                        className={ACTION_CHIP}
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
                      className={ACTION_SECONDARY}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={topupBusy || parsedRub === null || parsedRub < 1}
                      onClick={() => startTopup(parsedRub || 0)}
                      className={ACTION_PRIMARY}
                    >
                      {topupBusy ? "Создаю оплату…" : "Перейти к оплате"}
                    </button>
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
