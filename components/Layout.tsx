import Link from "next/link";
import React from "react";
import dynamic from "next/dynamic";

const AuthNavNoSSR = dynamic(
  () => import("@/components/AuthNav").then((m) => m.AuthNav),
  { ssr: false, loading: () => <span className="text-xs text-slate-500">…</span> }
);

const AdminNavNoSSR = dynamic(
  () => import("@/components/AdminNav").then((m) => m.AdminNav),
  { ssr: false, loading: () => null }
);

const DeveloperSupportWidgetNoSSR = dynamic(
  () => import("@/components/DeveloperSupportWidget").then((m) => m.DeveloperSupportWidget),
  { ssr: false, loading: () => null }
);

export function Layout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-clean-white text-slate-950">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight app-brand">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#b9efcf] bg-[#dffce9] text-[#0f8a55] shadow-sm">
              ЛК
            </div>
            <div>
              <div className="text-sm sm:text-base font-semibold text-slate-950">Лаборатория кадров</div>
              <div className="text-[11px] sm:text-xs text-slate-500">Кабинет оценки персонала</div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Link href="/dashboard" className="btn btn-secondary btn-sm">Кабинет</Link>
            <Link href="/wallet" className="btn btn-secondary btn-sm">Кошелёк</Link>
            <AdminNavNoSSR />
            <AuthNavNoSSR />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {title ? <h1 className="mb-4 text-2xl font-semibold tracking-tight text-[#1f6b55]">{title}</h1> : null}
        {children}
      </main>

      <DeveloperSupportWidgetNoSSR />

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-4 text-xs text-slate-500 sm:px-4 sm:py-5 md:flex-row md:items-center md:justify-between">
          <div>
            Жданов Александр Андреевич · самозанятый · ИНН 027803490580
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/legal/offer" className="underline underline-offset-2">Оферта · возврат · контакты</Link>
            <Link href="/legal/privacy" className="underline underline-offset-2">Политика данных</Link>
            <Link href="/legal/personal-data-consent" className="underline underline-offset-2">Согласие ПДн</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
