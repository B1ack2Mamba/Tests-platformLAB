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

type YooKassaSyncResp = {
  ok: boolean;
  checked?: number;
  credited?: number;
  updated?: number;
  skipped?: boolean;
  status?: string;
  reason?: string;
  error?: string;
  expected_amount_kopeks?: number | null;
  actual_amount_kopeks?: number;
};

const QUICK_AMOUNTS = [3000, 15000, 30000] as const;

const FRAME_CARD = "card rounded-[32px] border border-[#d9c3a0] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe3_100%)] shadow-[0_18px_42px_rgba(137,109,64,0.10)]";
const FRAME_SOFT = "rounded-[26px] border border-[#e6d8be] bg-[rgba(255,255,255,0.78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]";
const ACTION_PRIMARY = "inline-flex items-center justify-center rounded-[16px] border border-[#8fd0aa] bg-[linear-gradient(180deg,#e3f6e8_0%,#bfe7cc_100%)] px-5 py-3 text-sm font-semibold text-[#1f4d36] shadow-[0_10px_22px_rgba(95,148,116,0.18)] transition duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55";
const ACTION_SECONDARY = "inline-flex items-center justify-center rounded-[16px] border border-[#d8ccb7] bg-[linear-gradient(180deg,#fffdfa_0%,#f4ebdf_100%)] px-5 py-3 text-sm font-semibold text-[#59685f] shadow-[0_8px_18px_rgba(132,104,62,0.10)] transition duration-150 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-55";
const ACTION_CHIP = "inline-flex items-center justify-center rounded-[14px] border border-[#d9ccb7] bg-white/90 px-3 py-2 text-sm font-semibold text-[#4f6057] shadow-[0_6px_14px_rgba(132,104,62,0.08)] transition duration-150 hover:border-[#8fd0aa] hover:text-[#1f4d36] disabled:cursor-not-allowed disabled:opacity-55";
const INPUT_CLASS = "h-14 w-full rounded-[18px] border border-[#d9ccb8] bg-white/90 px-4 text-[15px] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] outline-none transition placeholder:text-[#b6b8bf] focus:border-[#92d0ab] focus:ring-4 focus:ring-[#d8efe0]/80";
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

function sanitizeRubInput(value: string) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

function parseRubInput(value: string): number | null {
  const cleaned = sanitizeRubInput(value);
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

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
  const parsedRub = useMemo(() => parseRubInput(amountRub), [amountRub]);
  const paymentPreviewText = parsedRub ? formatRub(parsedRub * 100) : "—";

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
    const lastDelay = ticks[ticks.length - 1];
    ticks.forEach((delay) => {
      window.setTimeout(async () => {
        if (cancelled) return;
        try {
          if (needsWalletPolling && walletPaymentId) {
            const result = await syncReturnedYooKassaPayment(walletPaymentId);
            if (result?.reason === "amount_mismatch") {
              setTopupError("Сумма в YooKassa не совпала с тем, что была запрошена. Автозачисление остановлено — проверь платёж вручную.");
              clearPendingYooKassaPaymentId(YOOKASSA_PENDING_TOPUP_KEY);
            } else if (result?.status === "paid") {
              clearPendingYooKassaPaymentId(YOOKASSA_PENDING_TOPUP_KEY);
              setTopupError(null);
            }
          }
          if (needsPlanPolling && planPaymentId) {
            const result = await syncReturnedYooKassaPayment(planPaymentId);
            if (result?.status === "paid") {
              clearPendingYooKassaPaymentId(YOOKASSA_PENDING_PLAN_KEY);
              setSubscriptionError(null);
            }
          }
        } catch (err: any) {
          if (delay === lastDelay) {
            const message = err?.message || "Автоматическое подтверждение оплаты задержалось";
            if (needsWalletPolling && walletPaymentId) {
              setTopupError(message);
            }
            if (needsPlanPolling && planPaymentId) {
              setSubscriptionError(message);
            }
          }
        }
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
    if (!session?.access_token || !paymentId) return null;
    const resp = await fetch("/api/yookassa/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    const json = (await resp.json().catch(() => ({}))) as YooKassaSyncResp;
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
          <div className={FRAME_CARD}>
            <div className="text-sm text-slate-700">Чтобы пользоваться кошельком — нужно войти.</div>
          </div>
          <Link href="/auth?next=/wallet" className={ACTION_PRIMARY}>Вход</Link>
        </>
      ) : (
        <div className="space-y-5">
<div className={FRAME_CARD + " relative overflow-hidden px-6 py-6 sm:px-7 sm:py-7"}>
  <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] bg-[radial-gradient(circle_at_right_center,rgba(180,223,198,0.32),rgba(180,223,198,0)_72%)]" />
  <div className="pointer-events-none absolute -right-6 top-0 text-[170px] font-light leading-none text-[#d8ccb4]/45 select-none">☿</div>
  <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <div>
        <div className="text-lg font-semibold text-[#4f6658] sm:text-xl">Ваш баланс</div>
        <div className="mt-2 text-5xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
          {wallet ? (isUnlimited ? "∞" : formatRub(wallet.balance_kopeks)) : "—"}
        </div>
      </div>
      <div className="mt-1 hidden h-20 w-px bg-[#e5dbc8] lg:block" />
      <div className="pt-1">
        <div className="text-sm font-medium text-[#59675f]">Текущий пакет</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">{activePlanTitle}</div>
        <div className="mt-2 text-base text-slate-600">{activePlanMeta}</div>
      </div>
    </div>
    <div className="relative flex flex-wrap items-center gap-2">
      {!isUnlimited && PAYMENTS_UI_ENABLED ? (
        <button onClick={() => setTopupOpen(true)} className={ACTION_SECONDARY}>
          Пополнить
        </button>
      ) : null}
      <button onClick={refresh} className={ACTION_PRIMARY}>
        Обновить
      </button>
    </div>
  </div>

  {error ? <div className="relative mt-4 text-sm text-red-600">{error}</div> : null}
  {loading ? <div className="relative mt-2 text-xs text-slate-500">⏳ Загружаю…</div> : null}
</div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
            <div className="space-y-5">
              <div id="wallet-plans" className={FRAME_CARD + " px-5 py-5 sm:px-7"}>
<div className="flex flex-col gap-3">
  <div>
    <div className="text-sm font-semibold text-[#315845]">Пакеты услуг</div>
    <div className="mt-2 text-sm text-slate-600">Выбери нужный пакет и оплати его онлайн или с внутреннего баланса кошелька.</div>
  </div>
</div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  {MONTHLY_SUBSCRIPTION_PLANS.map((plan, index) => {
                    const isActive = activeSubscription?.plan_key === plan.key && activeSubscription?.status !== "expired";
                    const visual = PLAN_VISUALS[index % PLAN_VISUALS.length];
                    return (
                      <div key={plan.key} className={`overflow-hidden rounded-[30px] border shadow-[0_14px_28px_rgba(126,99,57,0.08)] ${isActive ? "border-[#b8dfc5] bg-[linear-gradient(180deg,#f6fcf8_0%,#edf7f1_100%)]" : "border-[#e4d7c0] bg-white/90"}`}>
<div className={`relative h-36 overflow-hidden px-5 py-5 ${visual.gradient}`}>
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.82),rgba(255,255,255,0)_55%)]" />
  <div className="absolute -right-4 -top-5 text-[96px] font-semibold leading-none text-white/55">{visual.accent}</div>
  <div className="relative flex h-full flex-col justify-between">
    <span className="inline-flex w-fit items-center rounded-full border border-white/70 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#57655b] shadow-[0_4px_10px_rgba(255,255,255,0.25)]">{visual.name}</span>
    <div>
      <div className="text-xl font-semibold leading-tight text-[#31493d] sm:text-[22px]">{plan.projectsLimit} проектов в месяц</div>
    </div>
  </div>
</div>

<div className="p-5">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽</div>
      <div className="mt-1 text-sm text-slate-500">в месяц</div>
    </div>
    <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${isActive ? "bg-[#dff2e7] text-[#296244]" : "bg-[#f7f2e9] text-[#6e725f]"}`}>{plan.effectiveProjectPriceRub} ₽ за проект</span>
  </div>
  <div className="mt-5 grid gap-2">
                            <button
                              type="button"
                              className={ACTION_PRIMARY + " w-full"}
                              disabled={!!subscriptionBusyKey || (!isUnlimited && Number(wallet?.balance_kopeks ?? 0) < plan.monthlyPriceRub * 100)}
                              onClick={() => buyMonthlyPlanFromWallet(plan.key)}
                            >
                              {subscriptionBusyKey === `wallet:${plan.key}` ? "Покупаю…" : `С баланса · ${plan.monthlyPriceRub.toLocaleString("ru-RU")} ₽`}
                            </button>
                            {PAYMENTS_UI_ENABLED ? (
                              <button
                                type="button"
                                className={ACTION_SECONDARY + " w-full"}
                                disabled={!!subscriptionBusyKey}
                                onClick={() => startMonthlyPlanPurchase(plan.key)}
                              >
                                {subscriptionBusyKey === `online:${plan.key}` ? "Создаю оплату…" : isActive ? "Продлить онлайн" : "Оплатить онлайн"}
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
                            ) : (
                              <div className="rounded-[18px] border border-[#e5d6bd] bg-[#fffaf2] px-3 py-3 text-xs leading-5 text-slate-600">
                                Онлайн-оплата выключена. Пакет услуг можно оплатить с баланса.
                              </div>
                            )}
                            {!isUnlimited && Number(wallet?.balance_kopeks ?? 0) < plan.monthlyPriceRub * 100 ? (
                              <div className="text-xs text-amber-700">На балансе пока меньше стоимости пакета услуг.</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {subscriptionError ? <div className="mt-4 text-sm text-red-600">{subscriptionError}</div> : null}
                {subscriptionInfo ? <div className="mt-4 text-sm text-emerald-700">{subscriptionInfo}</div> : null}
              </div>

              <div className={FRAME_CARD + " overflow-hidden px-5 py-5 sm:px-7"}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[#42554c]">История операций</div>
                  <div className="text-xs text-slate-500">Свежие записи по кошельку</div>
                </div>
                <div className="mt-4 overflow-hidden rounded-[24px] border border-[#e5d8c4] bg-white/80">
                  <div className="overflow-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="bg-[linear-gradient(180deg,#fbf7f1_0%,#f4eddf_100%)] text-left text-xs uppercase tracking-[0.14em] text-[#8a7d66]">
                        <tr>
                          <th className="px-4 py-3">Дата</th>
                          <th className="px-4 py-3">Сумма</th>
                          <th className="px-4 py-3">Причина</th>
                          <th className="px-4 py-3">Ссылка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLedger.map((row) => {
                          const positive = row.amount_kopeks > 0;
                          return (
                            <tr key={row.id} className="border-t border-[#f0e6d5]">
                              <td className="px-4 py-3 text-xs text-slate-600">{new Date(row.created_at).toLocaleString()}</td>
                              <td className={`px-4 py-3 font-semibold ${positive ? "text-emerald-700" : "text-rose-600"}`}>{positive ? "+" : ""}{formatRub(row.amount_kopeks)}</td>
                              <td className="px-4 py-3 text-slate-700">{reasonLabel(row.reason)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">{row.ref ?? "—"}</td>
                            </tr>
                          );
                        })}
                        {visibleLedger.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-500">Пока пусто</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
</div>

<div className="space-y-5">
  <div className={FRAME_CARD + " overflow-hidden p-0"}>
    <div className="border-b border-[#e4d7c0] px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#315845]">Пополнение баланса</div>
          <div className="mt-1 text-sm text-slate-600">Быстрое пополнение через окно оплаты с Гермесом справа.</div>
        </div>
        {canManageWalletHermesLayout ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ACTION_SECONDARY} onClick={() => setWalletHermesConstructorOpen((v) => !v)}>
              {walletHermesConstructorOpen ? "Скрыть конструктор" : "Конструктор"}
            </button>
            <button type="button" className={ACTION_SECONDARY} onClick={resetWalletHermesLayout}>
              Сбросить
            </button>
            <button
              type="button"
              className={ACTION_SECONDARY}
              disabled={walletHermesTemplateBusy}
              onClick={saveWalletHermesTemplateForAll}
            >
              {walletHermesTemplateBusy ? "Сохранение…" : "Сохранить для всех"}
            </button>
          </div>
        ) : null}
      </div>
      {walletHermesTemplateInfo ? <div className="mt-3 text-[12px] text-[#5f7a4a]">{walletHermesTemplateInfo}</div> : null}
      {walletHermesTemplateError ? <div className="mt-3 text-[12px] text-[#9b4c3d]">{walletHermesTemplateError}</div> : null}
      {walletHermesConstructorOpen ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className={FRAME_SOFT + " p-3"}>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8d7b59]">Композиция</div>
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
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8d7b59]">Положение</div>
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
          <div className={FRAME_SOFT + " p-3 md:col-span-2"}>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-[#8d7b59]">Окно оплаты</div>
            <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 flex items-center justify-between"><span>Ширина окна</span><span>{walletHermesLayout.cardWidthPx}px</span></div>
                <input type="range" min="240" max="420" step="4" value={walletHermesLayout.cardWidthPx} onChange={(e) => updateWalletHermesLayout({ cardWidthPx: Number(e.target.value) })} className="w-full" />
              </label>
              <label className="block">
                <div className="mb-1 flex items-center justify-between"><span>Высота окна</span><span>{walletHermesLayout.cardHeightPx}px</span></div>
                <input type="range" min="200" max="420" step="4" value={walletHermesLayout.cardHeightPx} onChange={(e) => updateWalletHermesLayout({ cardHeightPx: Number(e.target.value) })} className="w-full" />
              </label>
              <label className="block">
                <div className="mb-1 flex items-center justify-between"><span>Окно по X</span><span>{walletHermesLayout.cardOffsetX}px</span></div>
                <input type="range" min="-220" max="220" step="2" value={walletHermesLayout.cardOffsetX} onChange={(e) => updateWalletHermesLayout({ cardOffsetX: Number(e.target.value) })} className="w-full" />
              </label>
              <label className="block">
                <div className="mb-1 flex items-center justify-between"><span>Окно по Y</span><span>{walletHermesLayout.cardOffsetY}px</span></div>
                <input type="range" min="-220" max="220" step="2" value={walletHermesLayout.cardOffsetY} onChange={(e) => updateWalletHermesLayout({ cardOffsetY: Number(e.target.value) })} className="w-full" />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>

    <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fbf7f0_0%,#f3ecdf_100%)]" style={{ minHeight: `${walletHermesLayout.heightPx}px` }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(179,220,195,0.45),rgba(179,220,195,0)_42%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.88),rgba(255,255,255,0)_45%)]" />
      <img
        src="/wallet-hermes-guide-cropped.png"
        alt="Персонаж с табличкой"
        className="absolute left-0 bottom-0 block max-w-none select-none"
        style={{
          width: `${walletHermesLayout.widthPercent}%`,
          transform: `translate(${walletHermesLayout.offsetX}px, ${walletHermesLayout.offsetY}px)`,
        }}
      />

      <div className="relative flex min-h-full items-end justify-end px-4 py-4 pointer-events-none sm:px-5 sm:py-5" style={{ minHeight: `${walletHermesLayout.heightPx}px` }}>
        <div
          className="pointer-events-auto rounded-[28px] border border-[#d8ccb8] bg-[rgba(255,252,246,0.95)] px-5 py-5 shadow-[0_18px_34px_rgba(120,92,44,0.12)] backdrop-blur-[1px]"
          style={{
            width: `${walletHermesLayout.cardWidthPx}px`,
            minHeight: `${walletHermesLayout.cardHeightPx}px`,
            transform: `translate(${walletHermesLayout.cardOffsetX}px, ${walletHermesLayout.cardOffsetY}px)`,
          }}
        >
          <div className="text-xs uppercase tracking-[0.24em] text-[#987b4e]">Оплата</div>
          {activeSubscription ? (
            <div className="mt-2 text-xs leading-5 font-medium text-emerald-700">Активный пакет: {activeSubscription.plan_title}. Осталось {activeSubscription.projects_remaining} проектов.</div>
          ) : null}
          <div className="mt-2 text-sm leading-6 text-slate-600">Выбери сумму и перейди к оплате прямо из окна.</div>
          {canShowInlinePayment ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-2">
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
              <div className="mt-3 space-y-3">
                <input
                  value={amountRub}
                  onChange={(e) => setAmountRub(sanitizeRubInput(e.target.value))}
                  inputMode="numeric"
                  placeholder="3000"
                  className={INPUT_CLASS + " h-12 text-lg font-semibold"}
                />
                <div className="text-sm font-medium text-slate-700">К оплате: <span className="text-[#1f4d36]">{paymentPreviewText}</span></div>
                <button
                  type="button"
                  disabled={isUnlimited || topupBusy || parsedRub === null || parsedRub < 1}
                  onClick={() => startTopup(parsedRub || 0)}
                  className={ACTION_PRIMARY + " w-full"}
                >
                  {isUnlimited ? "∞" : topupBusy ? "Создаю оплату…" : "Пополнить баланс"}
                </button>
              </div>
              <div className="mt-3 text-[11px] leading-4 text-slate-500">Минимум 1 ₽.</div>
              {topupError ? <div className="mt-2 text-xs text-red-600">{topupError}</div> : null}
            </>
          ) : (
            <div className="mt-4 rounded-[18px] border border-[#e5d6bd] bg-white/80 px-3 py-3 text-xs leading-5 text-slate-600">
              Чтобы показать кнопки оплаты, добавь NEXT_PUBLIC_YOOKASSA_TEST_UI_ENABLED=1 или включи боевой UI через NEXT_PUBLIC_PAYMENTS_ENABLED=1.
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

  <div className={FRAME_CARD + " px-5 py-5 sm:px-6"}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-[#315845]">Промокод</div>
        <div className="mt-1 text-sm text-slate-600">Если код не применился при регистрации или первом входе, его можно активировать здесь.</div>
      </div>
      <Link href="/legal/offer" className="text-sm font-medium text-[#4f775f] hover:underline">Оферта и реквизиты</Link>
    </div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <input
        value={promoCode}
        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
        placeholder="Например: START-500"
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
                    className={ACTION_SECONDARY}
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-4">
                  <div className="text-xs text-slate-500">Сумма (₽)</div>
                  <input
                    value={amountRub}
                    onChange={(e) => setAmountRub(sanitizeRubInput(e.target.value))}
                    inputMode="numeric"
                    placeholder="3000"
                    className={INPUT_CLASS + " mt-1"}
                  />
                  <div className="mt-2 text-sm font-medium text-slate-700">К оплате: <span className="text-[#1f4d36]">{paymentPreviewText}</span></div>

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
                      {topupBusy ? "Создаю оплату…" : "Пополнить баланс"}
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
