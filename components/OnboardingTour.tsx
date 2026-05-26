import { useCallback, useEffect, useMemo, useState } from "react";

export type OnboardingStep = {
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
};

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const PADDING = 10;
const OPEN_EVENT = "app-open-onboarding-tour";

function storageKey(tourId: string) {
  return `onboarding-tour:${tourId}:completed`;
}

function getTargetRect(target: string): HighlightRect | null {
  if (typeof document === "undefined") return null;
  const element = document.querySelector<HTMLElement>(`[data-onboarding-id="${target}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    left: Math.max(PADDING, rect.left - PADDING),
    top: Math.max(PADDING, rect.top - PADDING),
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

function hasTarget(target: string) {
  if (typeof document === "undefined") return false;
  return !!document.querySelector<HTMLElement>(`[data-onboarding-id="${target}"]`);
}

function scrollTargetIntoView(target: string) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const element = document.querySelector<HTMLElement>(`[data-onboarding-id="${target}"]`);
  if (!element) return;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const viewportPadding = 92;
  const targetCenter = rect.top + rect.height / 2;
  const viewportCenter = window.innerHeight / 2;
  const isComfortablyVisible = rect.top >= viewportPadding && rect.bottom <= window.innerHeight - viewportPadding;

  if (!isComfortablyVisible) {
    window.scrollBy({ top: targetCenter - viewportCenter, behavior: "smooth" });
  }
}

function getPanelStyle(rect: HighlightRect | null, placement: OnboardingStep["placement"]) {
  const maxWidth = 360;
  const gap = 14;

  if (!rect || typeof window === "undefined") {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth,
    } as const;
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const place = placement || (rect.top < vh * 0.5 ? "bottom" : "top");
  const left = Math.min(Math.max(16, rect.left + rect.width / 2 - maxWidth / 2), Math.max(16, vw - maxWidth - 16));

  if (place === "left" && rect.left > maxWidth + 32) {
    return { left: rect.left - maxWidth - gap, top: Math.min(Math.max(16, rect.top), vh - 260), maxWidth } as const;
  }

  if (place === "right" && vw - rect.left - rect.width > maxWidth + 32) {
    return { left: rect.left + rect.width + gap, top: Math.min(Math.max(16, rect.top), vh - 260), maxWidth } as const;
  }

  if (place === "top" && rect.top > 220) {
    return { left, top: Math.max(16, rect.top - 218), maxWidth } as const;
  }

  return { left, top: Math.min(rect.top + rect.height + gap, vh - 240), maxWidth } as const;
}

export function OnboardingTour({
  tourId,
  steps,
  startTarget = null,
  autoStart = true,
}: {
  tourId: string;
  steps: OnboardingStep[];
  startTarget?: string | null;
  autoStart?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = steps[stepIndex] || steps[0];
  const completedKey = useMemo(() => storageKey(tourId), [tourId]);

  const refreshRect = useCallback(() => {
    if (!step) return;
    setRect(getTargetRect(step.target));
  }, [step]);

  useEffect(() => {
    setReady(true);
    try {
      if (autoStart && typeof window !== "undefined" && !startTarget && !window.localStorage.getItem(completedKey)) {
        window.setTimeout(() => setOpen(true), 550);
      }
    } catch {}
  }, [autoStart, completedKey, startTarget]);

  useEffect(() => {
    if (!ready || !startTarget) return;
    const target = startTarget;
    const targetIndex = steps.findIndex((item) => item.target === target);
    if (targetIndex < 0) return;
    let attempts = 0;
    let timer: number | null = null;

    function openWhenTargetReady() {
      attempts += 1;
      if (hasTarget(target) || attempts >= 24) {
        setStepIndex(targetIndex);
        window.setTimeout(() => setOpen(true), 120);
        return;
      }
      timer = window.setTimeout(openWhenTargetReady, 250);
    }

    timer = window.setTimeout(openWhenTargetReady, 250);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [ready, startTarget, steps]);

  useEffect(() => {
    if (!open || !step) return;
    scrollTargetIntoView(step.target);
    const timer = window.setTimeout(refreshRect, 260);
    const finalTimer = window.setTimeout(refreshRect, 720);
    window.addEventListener("resize", refreshRect);
    window.addEventListener("scroll", refreshRect, true);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(finalTimer);
      window.removeEventListener("resize", refreshRect);
      window.removeEventListener("scroll", refreshRect, true);
    };
  }, [open, refreshRect, step]);

  function finish() {
    try {
      window.localStorage.setItem(completedKey, "1");
    } catch {}
    setOpen(false);
  }

  function restart() {
    setStepIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    window.addEventListener(OPEN_EVENT, restart);
    return () => window.removeEventListener(OPEN_EVENT, restart);
  });

  if (!ready || !steps.length || !step) return null;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[950] pointer-events-none">
          <div className="absolute inset-0 bg-slate-950/40" />
          {rect ? (
            <div
              className="absolute rounded-[22px] border-2 border-emerald-300 bg-white/8 shadow-[0_0_0_9999px_rgba(15,23,42,0.28),0_0_0_8px_rgba(16,185,129,0.14),0_22px_44px_rgba(15,23,42,0.22)]"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              }}
            />
          ) : null}

          <div
            className="pointer-events-auto absolute rounded-[22px] border border-emerald-100 bg-white p-4 text-slate-800 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
            style={getPanelStyle(rect, step.placement)}
            role="dialog"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Шаг {stepIndex + 1} из {steps.length}
                </div>
                <div className="mt-1 text-base font-semibold text-slate-950">{step.title}</div>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-500 hover:bg-slate-50"
                onClick={finish}
                aria-label="Закрыть подсказки"
              >
                ×
              </button>
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-600">{step.body}</div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                disabled={stepIndex === 0}
              >
                Назад
              </button>
              <div className="flex items-center gap-1.5">
                {steps.map((item, index) => (
                  <span
                    key={`${item.target}:${index}`}
                    className={`h-2 w-2 rounded-full ${index === stepIndex ? "bg-emerald-600" : "bg-slate-200"}`}
                  />
                ))}
              </div>
              {stepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
                >
                  Далее
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={finish}>
                  Готово
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function openOnboardingTour() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}
