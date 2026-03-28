import { useEffect, useMemo, useState } from "react";

const DEFAULT_MESSAGES = [
  "Обрабатываем информацию. Это может занять около 5 минут.",
  "Формируем вывод по запросу и собираем связи между результатами.",
  "Сверяем показатели и подготавливаем аккуратную интерпретацию.",
  "AI догружает данные и раскладывает вывод по разделам.",
];

export function ThinkingStatus({
  title = "AI формирует результат",
  messages = DEFAULT_MESSAGES,
  intervalMs = 2400,
}: {
  title?: string;
  messages?: string[];
  intervalMs?: number;
}) {
  const safeMessages = useMemo(() => (messages.length ? messages : DEFAULT_MESSAGES), [messages]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeMessages.length);
    }, Math.max(1200, intervalMs));
    return () => window.clearInterval(timer);
  }, [intervalMs, safeMessages.length]);

  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
          ✦
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">{safeMessages[index]}</div>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
            {safeMessages.map((_, dotIndex) => (
              <span
                key={`thinking-dot-${dotIndex}`}
                className={`h-2.5 w-2.5 rounded-full transition ${dotIndex === index ? "bg-emerald-500" : "bg-emerald-100"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
