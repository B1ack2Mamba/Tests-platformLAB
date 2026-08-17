import { useCallback, useEffect, useMemo, useState } from "react";

export type OnboardingStep = {
  target: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  guideImageSrc?: string;
  guideSide?: "left" | "right";
};

export type OnboardingGuide = {
  imageSrc: string;
  imageAlt?: string;
  name?: string;
  welcomeTitle?: string;
  welcomeBody?: string;
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

function getVisibleTarget(target: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const elements = Array.from(document.querySelectorAll<HTMLElement>(`[data-onboarding-id="${target}"]`));
  return elements.find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) || null;
}

function getTargetRect(target: string): HighlightRect | null {
  const element = getVisibleTarget(target);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: Math.max(PADDING, rect.left - PADDING),
    top: Math.max(PADDING, rect.top - PADDING),
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

function hasTarget(target: string) {
  return !!getVisibleTarget(target);
}

function scrollTargetIntoView(target: string) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const element = getVisibleTarget(target);
  if (!element) return;
  const rect = element.getBoundingClientRect();

  const viewportPadding = 92;
  const targetCenter = rect.top + rect.height / 2;
  const viewportCenter = window.innerHeight / 2;
  const isComfortablyVisible = rect.top >= viewportPadding && rect.bottom <= window.innerHeight - viewportPadding;

  if (!isComfortablyVisible) {
    window.scrollBy({ top: targetCenter - viewportCenter, behavior: "smooth" });
  }
}

function getPanelStyle(rect: HighlightRect | null, placement: OnboardingStep["placement"], hasGuide = false) {
  const maxWidth = hasGuide ? 460 : 360;
  const panelHeight = hasGuide ? 300 : 260;
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
    return { left: rect.left - maxWidth - gap, top: Math.min(Math.max(16, rect.top), vh - panelHeight), maxWidth } as const;
  }

  if (place === "right" && vw - rect.left - rect.width > maxWidth + 32) {
    return { left: rect.left + rect.width + gap, top: Math.min(Math.max(16, rect.top), vh - panelHeight), maxWidth } as const;
  }

  if (place === "top" && rect.top > panelHeight - 40) {
    return { left, top: Math.max(16, rect.top - panelHeight + 28), maxWidth } as const;
  }

  return { left, top: Math.min(rect.top + rect.height + gap, vh - panelHeight + 20), maxWidth } as const;
}

export function OnboardingTour({
  tourId,
  steps,
  startTarget = null,
  autoStart = true,
  guide = null,
}: {
  tourId: string;
  steps: OnboardingStep[];
  startTarget?: string | null;
  autoStart?: boolean;
  guide?: OnboardingGuide | null;
}) {
  const [open, setOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [ready, setReady] = useState(false);

  const step = steps[stepIndex] || steps[0];
  const stepGuideImageSrc = step?.guideImageSrc || guide?.imageSrc || "";
  const stepGuideSide = step?.guideSide || (step?.placement === "left" ? "right" : "left");
  const completedKey = useMemo(() => storageKey(tourId), [tourId]);

  const refreshRect = useCallback(() => {
    if (!step) return;
    setRect(getTargetRect(step.target));
  }, [step]);

  useEffect(() => {
    setReady(true);
    try {
      if (autoStart && typeof window !== "undefined" && !startTarget && !window.localStorage.getItem(completedKey)) {
        window.setTimeout(() => {
          if (guide?.imageSrc) setWelcomeOpen(true);
          else setOpen(true);
        }, 550);
      }
    } catch {}
  }, [autoStart, completedKey, guide?.imageSrc, startTarget]);

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
    setWelcomeOpen(false);
  }

  function restart() {
    setWelcomeOpen(false);
    setStepIndex(0);
    setOpen(true);
  }

  function startTour() {
    setWelcomeOpen(false);
    setStepIndex(0);
    window.setTimeout(() => setOpen(true), 120);
  }

  useEffect(() => {
    window.addEventListener(OPEN_EVENT, restart);
    return () => window.removeEventListener(OPEN_EVENT, restart);
  });

  if (!ready || !steps.length || !step) return null;

  return (
    <>
      {welcomeOpen && guide ? (
        <div className="fixed inset-0 z-[950] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div
            className="relative grid w-full max-w-[610px] overflow-hidden rounded-[30px] border border-emerald-100 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.3)] sm:grid-cols-[210px_minmax(0,1fr)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${tourId}-welcome-title`}
          >
            <div className="relative hidden min-h-[360px] overflow-hidden bg-[radial-gradient(circle_at_50%_32%,#effaf1_0%,#dcefe1_52%,#c9e3d0_100%)] sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={guide.imageSrc}
                alt={guide.imageAlt || "Помощник по работе с платформой"}
                className="absolute bottom-[-42px] left-1/2 h-[390px] w-auto max-w-none -translate-x-1/2 object-contain drop-shadow-[0_20px_28px_rgba(21,78,45,0.2)]"
              />
            </div>
            <div className="flex min-h-[330px] flex-col justify-center px-6 py-7 sm:px-8">
              <button
                type="button"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 hover:bg-slate-50"
                onClick={finish}
                aria-label="Закрыть приветствие"
              >
                ×
              </button>
              <div className="mb-4 flex justify-center sm:hidden">
                <div className="relative h-32 w-32 overflow-hidden rounded-full bg-[#e3f2e6]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={guide.imageSrc}
                    alt=""
                    className="absolute left-1/2 top-0 h-[250px] w-auto max-w-none -translate-x-1/2 object-contain"
                  />
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {guide.name || "Помощник платформы"}
              </div>
              <h2 id={`${tourId}-welcome-title`} className="mt-2 text-2xl font-semibold leading-tight text-slate-950">
                {guide.welcomeTitle || "Помочь разобраться с платформой?"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {guide.welcomeBody || "Я покажу основные разделы и помогу начать работу. Экскурсия займёт меньше минуты."}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button type="button" className="btn btn-primary" onClick={startTour}>
                  Начать экскурсию
                </button>
                <button type="button" className="btn btn-secondary" onClick={finish}>
                  Пока не нужно
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
            style={getPanelStyle(rect, step.placement, Boolean(stepGuideImageSrc))}
            role="dialog"
            aria-live="polite"
          >
            <div className={stepGuideImageSrc ? `flex items-end gap-3 ${stepGuideSide === "right" ? "flex-row-reverse" : ""}` : ""}>
              {stepGuideImageSrc ? (
                <div className="relative h-[108px] w-[64px] shrink-0 overflow-visible sm:h-[170px] sm:w-[98px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={stepGuideImageSrc}
                    alt=""
                    className="absolute bottom-[-12px] left-1/2 h-[126px] w-auto max-w-none -translate-x-1/2 object-contain drop-shadow-[0_12px_18px_rgba(21,78,45,0.16)] sm:bottom-[-16px] sm:h-[190px]"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
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
