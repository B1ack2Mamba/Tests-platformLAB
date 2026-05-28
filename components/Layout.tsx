import Link from "next/link";
import { useRouter } from "next/router";
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

const GlobalHintsButtonNoSSR = dynamic(
  () => import("@/components/GlobalHintsButton").then((m) => m.GlobalHintsButton),
  { ssr: false, loading: () => null }
);

export function Layout({
  title,
  children,
  candidateMode,
}: {
  title?: string;
  children: React.ReactNode;
  candidateMode?: boolean;
}) {
  const router = useRouter();
  const detectedCandidateMode =
    router.pathname.startsWith("/invite/") ||
    (router.pathname === "/tests/[slug]/take" && typeof router.query.invite === "string" && router.query.invite.trim().length > 0);
  const isCandidateMode = candidateMode ?? detectedCandidateMode;

  return (
    <div className="min-h-screen bg-clean-white text-slate-950">
      <header className="app-header border-b border-slate-200 bg-white shadow-sm">
        <div className="app-header-inner mx-auto flex max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            onClick={(event) => {
              if (isCandidateMode) event.preventDefault();
            }}
            className="flex items-center gap-3 font-semibold tracking-tight app-brand"
            aria-disabled={isCandidateMode}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#b9efcf] bg-[#dffce9] text-[#0f8a55] shadow-sm">
              ЛК
            </div>
            <div>
              <div className="text-sm sm:text-base font-semibold text-slate-950">Лаборатория кадров</div>
              <div className="text-[11px] sm:text-xs text-slate-500">{isCandidateMode ? "Оценка сотрудника" : "Кабинет оценки персонала"}</div>
            </div>
          </Link>

          {!isCandidateMode ? (
            <nav className="app-header-nav flex flex-wrap items-center gap-2 sm:justify-end">
              <Link href="/dashboard?desktop=scheme" className="btn btn-secondary btn-sm">Кабинет</Link>
              <Link href="/wallet" className="btn btn-secondary btn-sm">Кошелёк</Link>
              <AdminNavNoSSR />
              <AuthNavNoSSR />
            </nav>
          ) : null}
        </div>
      </header>

      <main className="app-main mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        {title ? <h1 className="app-page-title mb-4 text-2xl font-semibold tracking-tight text-[#1f6b55]">{title}</h1> : null}
        {children}
      </main>

      {!isCandidateMode ? (
        <>
          <DeveloperSupportWidgetNoSSR />
          <GlobalHintsButtonNoSSR />
        </>
      ) : null}

      <footer className="border-t border-slate-200 bg-white">
        <div className={`app-footer-inner mx-auto flex max-w-7xl flex-col gap-3 px-3 py-4 text-xs text-slate-500 sm:px-4 sm:py-5 ${isCandidateMode ? "items-center" : "md:flex-row md:items-center md:justify-between"}`}>
          {!isCandidateMode ? (
            <div>
              Жданов Александр Андреевич · самозанятый · ИНН 027803490580
            </div>
          ) : null}
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${isCandidateMode ? "justify-center" : ""}`}>
            {!isCandidateMode ? <Link href="/legal/offer" className="underline underline-offset-2">Оферта · возврат · контакты</Link> : null}
            <Link href="/legal/privacy" className="underline underline-offset-2">Политика данных</Link>
            <Link href="/legal/personal-data-consent" className="underline underline-offset-2">Согласие ПДн</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
