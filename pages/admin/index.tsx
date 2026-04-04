import Link from "next/link";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin";

type PromoCodeRow = {
  id: string;
  code: string;
  amount_kopeks: number;
  max_redemptions: number;
  redeemed_count: number;
  remaining_count: number;
  is_active: boolean;
  created_at: string;
};

export default function AdminPage() {
  const { user, session, loading, envOk } = useSession();
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([]);
  const [promoCodeValue, setPromoCodeValue] = useState("");
  const [promoAmountRub, setPromoAmountRub] = useState("500");
  const [promoUses, setPromoUses] = useState("5");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");

  const canUseAdmin = isAdminEmail(user?.email);

  async function loadPromos() {
    if (!session || !canUseAdmin) return;
    setPromoBusy(true);
    try {
      const resp = await fetch("/api/admin/promo-codes/list", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить промокоды");
      setPromoCodes(Array.isArray(json.promos) ? json.promos : []);
    } catch (e: any) {
      setPromoMessage(e?.message || "Ошибка загрузки промокодов");
    } finally {
      setPromoBusy(false);
    }
  }

  useEffect(() => {
    if (!session || !canUseAdmin) return;
    loadPromos();
  }, [session, canUseAdmin]);

  async function createPromoCode() {
    if (!session || !canUseAdmin) return;
    setPromoBusy(true);
    setPromoMessage("");
    try {
      const resp = await fetch("/api/admin/promo-codes/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code: promoCodeValue,
          amount_rub: Number(promoAmountRub),
          max_redemptions: Number(promoUses),
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось создать промокод");
      setPromoMessage(`Создан промокод ${json?.promo?.code || promoCodeValue}`);
      setPromoCodeValue("");
      await loadPromos();
    } catch (e: any) {
      setPromoMessage(e?.message || "Ошибка создания промокода");
      setPromoBusy(false);
    }
  }

  async function togglePromoCode(id: string, isActive: boolean) {
    if (!session || !canUseAdmin) return;
    setPromoBusy(true);
    setPromoMessage("");
    try {
      const resp = await fetch("/api/admin/promo-codes/toggle", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, is_active: isActive }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось обновить промокод");
      await loadPromos();
    } catch (e: any) {
      setPromoMessage(e?.message || "Ошибка обновления промокода");
      setPromoBusy(false);
    }
  }

  return (
    <Layout title="Админ-панель">
      {!envOk ? (
        <div className="card text-sm text-zinc-600">
          Supabase не настроен. Добавь переменные из <code className="rounded bg-white/60 px-1">.env.example</code>.
        </div>
      ) : loading ? (
        <div className="card text-sm text-zinc-600">Загрузка…</div>
      ) : !user ? (
        <div className="card text-sm text-zinc-600">
          Нужен вход. Перейди в <a className="underline" href="/auth">/auth</a>.
        </div>
      ) : !canUseAdmin ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Доступ запрещён. Админы: <span className="font-mono">{ADMIN_EMAILS.join(", ")}</span>
        </div>
      ) : (
        <div className="grid gap-4">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Служебные инструменты</div>
                <div className="mt-1 text-sm text-slate-500">Отдельная вкладка только для администратора. Промокоды больше не размазаны по кабинету специалиста.</div>
              </div>
              <Link href="/dashboard" className="btn btn-secondary btn-sm">Назад в кабинет</Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Link href="/admin" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-950 shadow-sm">
                Промокоды
                <div className="mt-1 text-xs font-normal text-emerald-800">Создание и включение кодов</div>
              </Link>
              <Link href="/admin/import" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm">
                Импорт теста
                <div className="mt-1 text-xs font-normal text-slate-500">Загрузка JSON в базу</div>
              </Link>
              <Link href="/admin/credit" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm">
                Начисление в кошелёк
                <div className="mt-1 text-xs font-normal text-slate-500">Служебное пополнение баланса</div>
              </Link>
              <Link href="/admin/support" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm">
                Диалоги поддержки
                <div className="mt-1 text-xs font-normal text-slate-500">Переписка с пользователями внутри сайта</div>
              </Link>
              <Link href="/admin/fit-config" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm">
                Матрица соответствия
                <div className="mt-1 text-xs font-normal text-slate-500">Роли, ожидания, веса и критичные сигналы</div>
              </Link>
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Промокоды</div>
                <div className="mt-1 text-sm text-slate-500">Создание ограниченных кодов по сумме депозита и количеству активаций.</div>
              </div>
              <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">
                {promoCodes.length} кодов
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-emerald-100 bg-white p-4">
                <div className="grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-600">Код</span>
                    <input className="input" value={promoCodeValue} onChange={(e) => setPromoCodeValue(e.target.value.toUpperCase())} placeholder="Например: SPRING-500" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600">Депозит, ₽</span>
                      <input className="input" inputMode="numeric" value={promoAmountRub} onChange={(e) => setPromoAmountRub(e.target.value)} placeholder="500" />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600">Количество активаций</span>
                      <input className="input" inputMode="numeric" value={promoUses} onChange={(e) => setPromoUses(e.target.value)} placeholder="5" />
                    </label>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={createPromoCode} disabled={promoBusy || !promoCodeValue.trim()}>
                    {promoBusy ? "Создаём…" : "Создать промокод"}
                  </button>
                  {promoMessage ? <div className="text-sm text-slate-700">{promoMessage}</div> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white/85 p-4">
                <div className="max-h-[420px] overflow-auto">
                  <div className="grid gap-2">
                    {promoCodes.length ? promoCodes.map((promo) => (
                      <div key={promo.id} className="rounded-2xl border border-emerald-100 bg-white px-3 py-3 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{promo.code}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {Math.floor(promo.amount_kopeks / 100)} ₽ · {promo.redeemed_count}/{promo.max_redemptions} активаций
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={promoBusy}
                            onClick={() => togglePromoCode(promo.id, !promo.is_active)}
                          >
                            {promo.is_active ? "Отключить" : "Включить"}
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-slate-500">Промокодов пока нет.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
