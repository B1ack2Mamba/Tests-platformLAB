import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";

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
    <div className="card overflow-hidden lg:min-h-[620px] xl:min-h-[660px]">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] xl:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
        <div className="order-2 flex flex-col justify-center lg:order-1">
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
        <div className="order-1 overflow-hidden rounded-[28px] border border-[#cde6de] bg-white p-3 lg:order-2">
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

type Mode = "login" | "signup";

export default function AuthStartPage() {
  const { supabase, user, session, loading: sessionLoading } = useSession();
  const router = useRouter();
  const next = useMemo(() => {
    const n = router.query.next;
    return typeof n === "string" ? n : "/dashboard";
  }, [router.query.next]);

  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!sessionLoading && user && session) {
      const pendingPromo = typeof window !== "undefined" ? window.localStorage.getItem("pending_promo_code") : null;
      if (pendingPromo && session.access_token) {
        fetch("/api/commercial/promo-codes/redeem", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code: pendingPromo }),
        })
          .then((r) => r.json().catch(() => ({})))
          .finally(() => {
            if (typeof window !== "undefined") window.localStorage.removeItem("pending_promo_code");
          });
      }
      router.replace(next);
    }
  }, [user, session, sessionLoading, next, router]);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    setInfo("");

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const pendingPromo = typeof window !== "undefined" ? window.localStorage.getItem("pending_promo_code") : null;
        if (pendingPromo && data.session?.access_token) {
          await redeemPromoWithToken(pendingPromo, data.session.access_token).catch(() => null);
          if (typeof window !== "undefined") window.localStorage.removeItem("pending_promo_code");
        }
        return;
      }

      if (password.length < 8) throw new Error("Пароль должен быть не короче 8 символов.");
      if (password !== password2) throw new Error("Пароли не совпадают.");
      if (!fullName.trim()) throw new Error("Укажи имя и фамилию.");

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SUPABASE_URL);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: siteUrl ? `${siteUrl.replace(/\/$/, "")}/dashboard` : undefined,
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
          },
        },
      });
      if (error) throw error;

      await fetch("/api/commercial/profile/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), company_name: companyName.trim(), email: email.trim() }),
      }).catch(() => null);

      if (promoCode.trim()) {
        if (data.session?.access_token) {
          await redeemPromoWithToken(promoCode, data.session.access_token).catch(() => null);
          setInfo("Аккаунт создан. Промокод добавлен к кабинету. Если подтверждение почты включено — подтверди email.");
        } else {
          if (typeof window !== "undefined") window.localStorage.setItem("pending_promo_code", promoCode.trim().toUpperCase());
          setInfo("Аккаунт создан. Промокод сохранён и применится после первого входа.");
        }
      } else {
        setInfo("Аккаунт создан. Если подтверждение почты включено — подтверди email. Если нет — войди сразу.");
      }

      setMode("login");
    } catch (err: any) {
      setError(err?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="grid gap-5 lg:grid-cols-[0.76fr_1.24fr] xl:grid-cols-[0.72fr_1.28fr]">
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2e7a63]">Старт</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {mode === "signup" ? "Создать кабинет" : "Войти в кабинет"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" onClick={() => setMode("signup")} className={`btn btn-sm w-full sm:w-auto ${mode === "signup" ? "btn-primary" : "btn-secondary"}`}>
                Регистрация
              </button>
              <button type="button" onClick={() => setMode("login")} className={`btn btn-sm w-full sm:w-auto ${mode === "login" ? "btn-primary" : "btn-secondary"}`}>
                Войти
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 grid gap-3">
            {mode === "signup" ? (
              <>
                <label className="grid gap-1">
                  <span className="text-xs text-slate-700">Имя и фамилия</span>
                  <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Например: Александр Иванов" required />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-slate-700">Компания / команда</span>
                  <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Например: Лаборатория кадров" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-slate-700">Промокод (если есть)</span>
                  <input className="input" value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder="Например: START-500" />
                </label>
              </>
            ) : null}

            <label className="grid gap-1">
              <span className="text-xs text-slate-700">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-slate-700">Пароль</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </label>

            {mode === "signup" ? (
              <label className="grid gap-1">
                <span className="text-xs text-slate-700">Повторите пароль</span>
                <input className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" required />
              </label>
            ) : null}

            {error ? <div className="text-sm text-red-600">{error}</div> : null}
            {info ? <div className="text-sm text-slate-700">{info}</div> : null}

            <button disabled={loading} type="submit" className="btn btn-primary w-full">
              {loading ? "…" : mode === "signup" ? "Создать кабинет" : "Войти"}
            </button>
          </form>
        </div>

        <TextSide />
      </div>
    </Layout>
  );
}
