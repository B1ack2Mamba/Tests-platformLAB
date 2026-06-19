import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { CONNECTION_TROUBLE_HINT, friendlyErrorMessage } from "@/lib/friendlyErrors";

function TextSide() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = muted;
  }, [muted]);

  function toggleSound() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (!videoRef.current) return;
    videoRef.current.muted = nextMuted;
    if (!nextMuted) {
      videoRef.current.play().catch(() => null);
    }
  }

  return (
    <div className="auth-intro-card card overflow-hidden lg:min-h-[620px] xl:min-h-[660px]">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
        <div className="auth-intro-copy order-2 flex flex-col justify-center lg:order-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2e7a63]">Лаборатория кадров</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#138a57] sm:text-4xl lg:text-[3.2rem] lg:leading-[1.05]">
            Весь опыт работы — в одной лаборатории оценки.
          </h1>
          <div className="mt-5 max-w-[34rem] text-[15px] leading-7 text-slate-700">
            Мы решили собрать весь опыт работы в эту лабораторию, подключив нейросеть. Нейросеть не принимает кадровых решений и не определяет судьбу человека. Здесь она используется как сложный аналитический инструмент: обрабатывает большие сочетания результатов через алгоритмические матрицы и промпты, составленные мной — Еленой Ждановой — на основе более чем 25 лет практики.
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[#2d7a63]">Подбор</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[#2d7a63]">Оценка</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[#2d7a63]">Мотивация</span>
          </div>
        </div>
        <div className="auth-intro-media order-1 overflow-hidden rounded-[28px] border border-[#cde6de] bg-white p-3 lg:order-2">
          <div className="relative h-full min-h-[320px] overflow-hidden rounded-[22px] bg-white shadow-sm sm:min-h-[380px] lg:min-h-[590px]">
            <video
              ref={videoRef}
              className="h-full w-full object-cover object-center"
              autoPlay
              muted={muted}
              loop
              playsInline
              preload="metadata"
              poster="/elena-zhdanova.jpg"
            >
              <source src="/elena.mp4" type="video/mp4" />
            </video>
            <button
              type="button"
              onClick={toggleSound}
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/65 bg-white/82 text-xl text-[#138a57] shadow-sm backdrop-blur transition hover:bg-white"
              aria-label={muted ? "Включить звук" : "Выключить звук"}
              title={muted ? "Включить звук" : "Выключить звук"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

type Mode = "login" | "signup" | "reset";
type AuthMethod = "email" | "name";


const PENDING_PROMO_CODE_KEY = "pending_promo_code";
const PROMO_FLASH_SUCCESS_KEY = "promo_flash_success";
const PROMO_FLASH_ERROR_KEY = "promo_flash_error";
const DASHBOARD_FIRST_LOGIN_ONBOARDING_KEY = "dashboard-first-login-onboarding";
const LOGIN_RETRY_ATTEMPTS = 4;
const LOGIN_RETRY_DELAYS_MS = [700, 1400, 2400];

type EmailLoginResult = {
  ok?: boolean;
  error?: string;
  session?: {
    access_token?: string;
    refresh_token?: string;
  } | null;
};

type EmailLoginSession = {
  access_token: string;
  refresh_token: string;
};

type AuthSessionLike = {
  access_token?: string;
  refresh_token?: string;
} | null | undefined;

type NameAuthResult = {
  ok?: boolean;
  error?: string;
  session?: AuthSessionLike;
  display_name?: string;
};

type AuthErrorHelp = {
  reason: string;
  actions: string[];
  showConnectionSupport?: boolean;
};

function isFetchNetworkError(err: any) {
  const message = String(err?.message || err || "");
  const name = String(err?.name || "");
  return /failed to fetch|fetch failed|load failed|network|timeout|ERR_NETWORK_CHANGED/i.test(`${name} ${message}`);
}

function isRetryableLoginError(err: any) {
  const message = String(err?.message || err || "");
  const name = String(err?.name || "");
  if (/invalid login credentials|invalid credentials|email not confirmed|неверный email|неверный пароль/i.test(message)) return false;
  return /failed to fetch|fetch failed|load failed|network|timeout|econn|etimedout|сервером авторизации|временно недоступ|502|503|504/i.test(`${name} ${message}`);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAuthError(err: any) {
  const message = String(err?.message || err || "").trim();
  if (/invalid login credentials|invalid credentials|email not confirmed/i.test(message)) {
    return "Неверный email или пароль. Проверьте данные и попробуйте ещё раз.";
  }
  if (isFetchNetworkError(err)) {
    return friendlyErrorMessage(err, "Не удалось связаться с сервером авторизации.");
  }
  return message || "Ошибка";
}

function getAuthErrorHelp(error: string): AuthErrorHelp | null {
  const message = String(error || "").trim();
  if (!message) return null;
  const source = message.toLowerCase();

  if (/неверный|invalid login credentials|invalid credentials/.test(source)) {
    return {
      reason: "Email или пароль не совпали с данными кабинета.",
      actions: [
        "Проверьте раскладку, Caps Lock и лишние пробелы в email.",
        "Если пароль забыли, нажмите «Восстановить пароль».",
      ],
    };
  }

  if (/email not confirmed|почт|подтверд/i.test(message)) {
    return {
      reason: "Email ещё не подтверждён.",
      actions: [
        "Откройте письмо от сервиса и подтвердите почту.",
        "Проверьте папки «Спам» и «Промоакции».",
      ],
    };
  }

  if (/сервером авторизации|failed to fetch|fetch failed|load failed|network|timeout/i.test(message)) {
    return {
      reason: "Браузер или сеть не смогли связаться с авторизацией.",
      actions: [
        "Обновите страницу через Ctrl+F5 и попробуйте снова.",
        "Обновите страницу через Ctrl+F5 и попробуйте снова.",
        CONNECTION_TROUBLE_HINT,
        "Если не помогло, попробуйте другой браузер.",
      ],
      showConnectionSupport: true,
    };
  }

  if (/too many|rate limit|слишком много|част/i.test(message)) {
    return {
      reason: "Слишком много попыток входа подряд.",
      actions: [
        "Подождите несколько минут и попробуйте снова.",
        "Не обновляйте страницу много раз подряд во время входа.",
      ],
    };
  }

  if (/server env missing|not configured|недоступ|502|503/i.test(message)) {
    return {
      reason: "Сервер авторизации временно недоступен или настроен некорректно.",
      actions: [
        "Повторите вход через пару минут.",
        "Если ошибка повторяется, отправьте администратору скриншот этой ошибки.",
      ],
      showConnectionSupport: true,
    };
  }

  return {
    reason: "Не удалось завершить вход.",
    actions: [
      "Проверьте email и пароль, затем попробуйте снова.",
      "Если ошибка повторяется, отправьте администратору скриншот.",
    ],
  };
}

async function loginWithServerFallback(email: string, password: string): Promise<EmailLoginSession> {
  const response = await fetch("/api/auth/email-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json().catch(() => ({}))) as EmailLoginResult;
  if (!response.ok || !data?.ok || !data.session?.access_token || !data.session.refresh_token) {
    throw new Error(data?.error || "Не удалось войти. Попробуйте ещё раз.");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

async function loginWithNameServer(firstName: string, lastName: string, password: string): Promise<EmailLoginSession> {
  const response = await fetch("/api/auth/name-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ first_name: firstName, last_name: lastName, password }),
  });
  const data = (await response.json().catch(() => ({}))) as NameAuthResult;
  if (!response.ok || !data?.ok || !data.session?.access_token || !data.session.refresh_token) {
    throw new Error(data?.error || "Не удалось войти по имени и паролю. Проверьте данные и попробуйте ещё раз.");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

function safeLocalStorageGet(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeLocalStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore blocked storage environments.
  }
}

function safeLocalStorageRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore blocked storage environments.
  }
}

function getPendingPromoCode() {
  return safeLocalStorageGet(PENDING_PROMO_CODE_KEY).trim().toUpperCase();
}

function clearPendingPromoCode() {
  safeLocalStorageRemove(PENDING_PROMO_CODE_KEY);
}

function setPromoFlashSuccess(message: string) {
  safeLocalStorageSet(PROMO_FLASH_SUCCESS_KEY, message);
  safeLocalStorageRemove(PROMO_FLASH_ERROR_KEY);
}

function setPromoFlashError(message: string) {
  safeLocalStorageSet(PROMO_FLASH_ERROR_KEY, message);
}

async function syncCommercialProfile(accessToken: string, fullName: string, companyName: string) {
  await fetch("/api/commercial/profile/upsert", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      full_name: fullName.trim(),
      company_name: companyName.trim(),
    }),
  }).catch(() => null);
}

export default function AuthStartPage() {
  const { supabase, user, session, loading: sessionLoading } = useSession();
  const router = useRouter();
  const isPasswordReset = router.query.reset === "1";
  const next = useMemo(() => {
    const n = router.query.next;
    return typeof n === "string" ? n : "/dashboard";
  }, [router.query.next]);

  const [mode, setMode] = useState<Mode>("signup");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [, setLoginAttempt] = useState(0);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const authErrorHelp = useMemo(() => getAuthErrorHelp(error), [error]);
  const autoRedeemAttemptRef = useRef<string>("");
  const profileSyncAttemptRef = useRef<string>("");
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    if (isPasswordReset) setMode("reset");
  }, [isPasswordReset]);

  useEffect(() => {
    if (sessionLoading || !session?.access_token || !user) return;

    const metadata = (user.user_metadata || {}) as { full_name?: string; company_name?: string; display_name?: string; first_name?: string; last_name?: string };
    const fullName = String(metadata.full_name || metadata.display_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ")).trim();
    const companyName = String(metadata.company_name || "").trim();
    const syncKey = `${user.id}:${fullName}:${companyName}`;
    if (profileSyncAttemptRef.current === syncKey) return;
    profileSyncAttemptRef.current = syncKey;

    syncCommercialProfile(session.access_token, fullName, companyName);
  }, [sessionLoading, session, user]);

  useEffect(() => {
    if (sessionLoading || !user || !session) return;
    if (isPasswordReset || mode === "reset") return;

    const pendingPromo = getPendingPromoCode();
    if (!pendingPromo || !session.access_token) {
      router.replace(next);
      return;
    }

    const attemptKey = `${user.id}:${pendingPromo}`;
    if (autoRedeemAttemptRef.current === attemptKey) return;
    autoRedeemAttemptRef.current = attemptKey;

    let cancelled = false;
    (async () => {
      try {
        await redeemPromoWithToken(pendingPromo, session.access_token);
        clearPendingPromoCode();
        setPromoFlashSuccess(`Промокод ${pendingPromo} успешно активирован.`);
      } catch (err: any) {
        setPromoFlashError(friendlyErrorMessage(err, `Не удалось активировать промокод ${pendingPromo}. Он сохранён, попробуй ещё раз в кошельке.`));
      } finally {
        if (!cancelled) router.replace(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, session, sessionLoading, next, router, isPasswordReset, mode]);

  async function redeemPromoWithToken(code: string, accessToken: string) {
    const r = await fetch("/api/commercial/promo-codes/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await r.json().catch(() => ({} as any));
    if (!r.ok || !data?.ok) throw new Error(data?.error || "Не удалось активировать промокод");
  }

  function openPasswordReset() {
    setMode("reset");
    setAuthMethod("email");
    setError("");
    setInfo("");
    setPassword("");
    setPassword2("");
  }

  async function loginOnce(authClient: NonNullable<typeof supabase>, loginEmail: string, loginPassword: string): Promise<EmailLoginSession> {
    const serverSession = await loginWithServerFallback(loginEmail, loginPassword);
    await authClient.auth.setSession({
      access_token: serverSession.access_token,
      refresh_token: serverSession.refresh_token,
    });
    return serverSession;
  }

  async function loginWithRetry(authClient: NonNullable<typeof supabase>, loginEmail: string, loginPassword: string): Promise<EmailLoginSession> {
    let lastError: any = null;
    for (let attempt = 1; attempt <= LOGIN_RETRY_ATTEMPTS; attempt += 1) {
      setLoginAttempt(attempt);
      try {
        return await loginOnce(authClient, loginEmail, loginPassword);
      } catch (err: any) {
        lastError = err;
        if (attempt >= LOGIN_RETRY_ATTEMPTS || !isRetryableLoginError(err)) throw err;
        await wait(LOGIN_RETRY_DELAYS_MS[attempt - 1] ?? 1800);
      }
    }
    throw lastError || new Error("Не удалось войти. Попробуйте ещё раз.");
  }

  async function applyAuthSession(authClient: NonNullable<typeof supabase>, authSession: AuthSessionLike) {
    if (!authSession?.access_token) return "";
    if (authSession.refresh_token) {
      await authClient.auth.setSession({
        access_token: authSession.access_token,
        refresh_token: authSession.refresh_token,
      });
    }
    return authSession.access_token;
  }

  async function finishSignup(accessToken: string, profileName: string) {
    if (accessToken) {
      await syncCommercialProfile(accessToken, profileName, "");
    }

    setInfo(accessToken ? "Кабинет создан. Входим..." : "Кабинет создан. Теперь войдите.");
    safeLocalStorageSet(DASHBOARD_FIRST_LOGIN_ONBOARDING_KEY, "1");
    if (!accessToken) setMode("login");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const authClient = supabase;
    if (!authClient) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setLoading(true);
    setLoginAttempt(0);
    setError("");
    setInfo("");
    const passwordValue = password.trim();
    const password2Value = password2.trim();
    if (passwordValue !== password) setPassword(passwordValue);
    if (password2Value !== password2) setPassword2(password2Value);

    try {
      if (mode === "login") {
        const loginSession =
          authMethod === "name"
            ? await loginWithNameServer(firstName.trim(), lastName.trim(), passwordValue)
            : await loginWithRetry(authClient, email.trim(), passwordValue);
        if (authMethod === "name") {
          await authClient.auth.setSession({
            access_token: loginSession.access_token,
            refresh_token: loginSession.refresh_token,
          });
        }
        const sessionAccessToken = loginSession.access_token || "";
        const pendingPromo = getPendingPromoCode();
        if (pendingPromo && sessionAccessToken) {
          setInfo(`Промокод ${pendingPromo} проверяется и применится после входа.`);
        }
        return;
      }

      if (mode === "reset") {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SUPABASE_URL);
        const redirectTo = siteUrl ? `${siteUrl.replace(/\/$/, "")}/auth?reset=1` : undefined;

        if (session?.access_token) {
          if (passwordValue.length < 8) throw new Error("Новый пароль должен быть не короче 8 символов.");
          if (passwordValue !== password2Value) throw new Error("Пароли не совпадают.");
          const { error } = await authClient.auth.updateUser({ password: passwordValue });
          if (error) throw error;
          setInfo("Пароль изменён. Теперь можно войти с новым паролем.");
          setError("");
          setPassword("");
          setPassword2("");
          setMode("login");
          await router.replace("/auth", undefined, { shallow: true });
          return;
        }

        if (!email.trim()) throw new Error("Укажи email, к которому привязан кабинет.");
        const { error } = await authClient.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setInfo("Отправили письмо для изменения пароля. Открой ссылку из письма и задай новый пароль.");
        return;
      }

      if (passwordValue.length < 8) throw new Error("Пароль должен быть не короче 8 символов.");
      if (passwordValue !== password2Value) throw new Error("Пароли не совпадают.");
      if (authMethod === "name") {
        if (!firstName.trim() || !lastName.trim()) throw new Error("Укажи имя и фамилию.");
        const signupResp = await fetch("/api/auth/name-signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            password: passwordValue,
          }),
        });
        const signupJson = (await signupResp.json().catch(() => ({}))) as NameAuthResult;
        if (!signupResp.ok || !signupJson?.ok) {
          throw new Error(signupJson?.error || "Не удалось создать кабинет. Попробуйте ещё раз.");
        }
        const accessToken = await applyAuthSession(authClient, signupJson.session);
        await finishSignup(accessToken, [firstName.trim(), lastName.trim()].filter(Boolean).join(" "));
        return;
      }

      if (!email.trim()) throw new Error("Укажи email.");

      const signupResp = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: passwordValue,
        }),
      });
      const signupJson = await signupResp.json().catch(() => ({}));
      if (!signupResp.ok || !signupJson?.ok) {
        throw new Error(signupJson?.error || "Не удалось создать кабинет. Попробуйте ещё раз.");
      }
      const data = signupJson as { session?: AuthSessionLike };
      const accessToken = await applyAuthSession(authClient, data.session);
      await finishSignup(accessToken, "");
    } catch (err: any) {
      setError(normalizeAuthError(err));
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
      setLoginAttempt(0);
    }
  }

  return (
    <Layout>
      <div className="auth-start-page grid gap-5 lg:grid-cols-[0.76fr_1.24fr] xl:grid-cols-[0.72fr_1.28fr]">
        <div className="auth-form-card card">
          <div className="auth-form-header flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2e7a63]">Старт</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {mode === "signup" ? "Создать кабинет" : mode === "reset" ? "Изменить пароль" : "Войти в кабинет"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" disabled={loading} onClick={() => { setMode("signup"); setInfo(""); }} className={`btn btn-sm w-full sm:w-auto disabled:opacity-60 ${mode === "signup" ? "btn-primary" : "btn-secondary"}`}>
                Регистрация
              </button>
              <button type="button" disabled={loading} onClick={() => { setMode("login"); setInfo(""); }} className={`btn btn-sm w-full sm:w-auto disabled:opacity-60 ${mode === "login" ? "btn-primary" : "btn-secondary"}`}>
                Войти
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 grid gap-3">
            {mode !== "reset" ? (
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setAuthMethod("email"); setError(""); setInfo(""); }}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${authMethod === "email" ? "bg-white text-[#167a5a] shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
                >
                  По email
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setAuthMethod("name"); setError(""); setInfo(""); }}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${authMethod === "name" ? "bg-white text-[#167a5a] shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
                >
                  По имени
                </button>
              </div>
            ) : null}
            {mode !== "reset" && authMethod === "name" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                Вход по имени проще для тех, у кого нет email. Имя и фамилию нужно вводить так же, как при регистрации; для восстановления пароля проще и безопаснее регистрация по email.
              </div>
            ) : null}

            {mode === "login" && getPendingPromoCode() ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Сохранён промокод <b>{getPendingPromoCode()}</b>. После входа попробуем активировать его автоматически. Если не сработает — он останется доступен в кошельке.
              </div>
            ) : null}

            {mode === "reset" && session?.access_token ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                Задай новый пароль для кабинета. После сохранения вернём тебя на вход.
              </div>
            ) : null}

            {mode === "reset" && !session?.access_token ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                Укажи email кабинета, и мы отправим ссылку для изменения пароля.
              </div>
            ) : null}

            {mode !== "reset" || !session?.access_token ? (
              mode !== "reset" && authMethod === "name" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-700">Имя</span>
                    <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Александр" required />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-700">Фамилия</span>
                    <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванов" required />
                  </label>
                </div>
              ) : (
                <label className="grid gap-1">
                  <span className="text-xs text-slate-700">Email</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </label>
              )
            ) : null}

            {mode !== "reset" || session?.access_token ? (
              <label className="grid gap-1">
                <span className="text-xs text-slate-700">{mode === "reset" ? "Новый пароль" : "Пароль"}</span>
                <div className="relative">
                  <input
                    className="input pr-24"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={showPassword ? "Введите пароль" : "••••••••"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:text-[#167a5a]"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
                <span className="text-[11px] leading-4 text-slate-500">
                  Пароль виден, чтобы можно было проверить написание. Пробелы по краям уберём автоматически.
                </span>
              </label>
            ) : null}

            {mode === "signup" || (mode === "reset" && session?.access_token) ? (
              <label className="grid gap-1">
                <span className="text-xs text-slate-700">{mode === "reset" ? "Повторите новый пароль" : "Повторите пароль"}</span>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder={showPassword ? "Повторите пароль" : "••••••••"}
                  autoComplete="new-password"
                  required
                />
              </label>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">
                <div className="font-medium">{error}</div>
                {authErrorHelp ? (
                  <div className="mt-2 border-t border-red-100 pt-2 text-xs leading-5 text-red-800">
                    <div>
                      <span className="font-semibold">Причина:</span> {authErrorHelp.reason}
                    </div>
                    <div className="mt-1 font-semibold">Что сделать:</div>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {authErrorHelp.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                    {authErrorHelp.showConnectionSupport ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950">
                        <div className="font-semibold">Проблемы со связью</div>
                        <div className="mt-1">
                          {CONNECTION_TROUBLE_HINT} Если решить проблему не удалось, напишите мне лично в Telegram.
                        </div>
                        <a
                          href="https://t.me/BalancEcnalab"
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary btn-sm mt-3 w-full justify-center sm:w-auto"
                        >
                          Написать @BalancEcnalab
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {mode === "login" ? (
                  <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={openPasswordReset}>
                    Восстановить пароль
                  </button>
                ) : null}
              </div>
            ) : null}
            {info ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950 whitespace-pre-line">
                {info}
              </div>
            ) : null}

            <button disabled={loading} type="submit" className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" aria-busy={loading ? "true" : "false"}>
              {loading ? (mode === "login" ? "Входим..." : "...") : mode === "signup" ? "Создать кабинет" : mode === "reset" && session?.access_token ? "Сохранить новый пароль" : mode === "reset" ? "Отправить ссылку" : "Войти"}
            </button>

            {mode === "login" ? (
              <button type="button" disabled={loading} className="btn btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60" onClick={openPasswordReset}>
                Забыли пароль? Восстановить
              </button>
            ) : null}

            {mode === "reset" && !session?.access_token ? (
              <button type="button" className="text-left text-sm text-slate-600 underline underline-offset-4" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>
                Вернуться ко входу
              </button>
            ) : null}
          </form>
        </div>

        <TextSide />
      </div>
    </Layout>
  );
}
