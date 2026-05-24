import { useEffect, useMemo, useState } from "react";

type PriceHoldCountdownProps = {
  until: string;
  compact?: boolean;
};

function getRemainingParts(until: string, nowMs = Date.now()) {
  const deadline = new Date(until).getTime();
  const diff = Math.max(0, deadline - nowMs);
  const totalHours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours, expired: diff <= 0 };
}

export function PriceHoldCountdown({ until, compact = false }: PriceHoldCountdownProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const untilLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(until));
    } catch {
      return "указанной даты";
    }
  }, [until]);
  const remaining = useMemo(() => getRemainingParts(until, nowMs), [until, nowMs]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (remaining.expired) {
    return (
      <div className={compact ? "text-xs font-medium text-amber-700" : "text-sm font-medium text-amber-800"}>
        Период текущих цен завершён.
      </div>
    );
  }

  return (
    <div className={compact ? "text-xs font-medium text-emerald-800" : "text-sm font-medium text-emerald-900"}>
      Текущие цены держатся до {untilLabel}: осталось {remaining.days} дн. {remaining.hours} ч.
    </div>
  );
}
