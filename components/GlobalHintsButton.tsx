import { useState } from "react";
import { openOnboardingTour } from "@/components/OnboardingTour";

export function GlobalHintsButton() {
  const [notice, setNotice] = useState(false);

  function onClick() {
    openOnboardingTour();
    setNotice(true);
    window.setTimeout(() => setNotice(false), 2200);
  }

  return (
    <>
      <button
        type="button"
        className="global-hints-trigger fixed bottom-[82px] right-5 z-[900] rounded-full border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-900 shadow-lg backdrop-blur transition hover:border-emerald-300 hover:text-emerald-900"
        onClick={onClick}
      >
        Подсказки
      </button>
      {notice ? (
        <div className="global-hints-notice fixed bottom-[132px] right-5 z-[900] max-w-[260px] rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm leading-5 text-slate-700 shadow-lg backdrop-blur">
          Если на этой странице есть подсказки, они откроются сейчас.
        </div>
      ) : null}
    </>
  );
}
