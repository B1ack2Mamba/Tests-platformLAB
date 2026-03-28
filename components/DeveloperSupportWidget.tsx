import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/useSession";
import type { SupportChatMessage, SupportChatThread } from "@/lib/supportChat";

type ChatLoadResp = {
  ok: boolean;
  error?: string;
  thread?: SupportChatThread;
  messages?: SupportChatMessage[];
  unread_count?: number;
};

type ChatSendResp = {
  ok: boolean;
  error?: string;
  thread?: SupportChatThread;
  message?: SupportChatMessage;
};

type SetWebhookResp = {
  ok: boolean;
  error?: string;
  webhook_url?: string;
};

function formatMessageTime(value: string) {
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function DeveloperSupportWidget() {
  const { session, user } = useSession();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<SupportChatThread | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const userLabel = useMemo(() => {
    const fullName = ((user?.user_metadata as any)?.full_name || "").toString().trim();
    return fullName || user?.email || "Пользователь";
  }, [user?.email, user?.user_metadata]);
  const isSupportAdmin = (user?.email || "").toLowerCase() === "storyguild9@gmail.com";

  async function loadChat(markRead = false, silent = false) {
    if (!session?.access_token) {
      setThread(null);
      setMessages([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const resp = await fetch("/api/support/chat", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as ChatLoadResp;
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось загрузить чат с разработчиком");
      }
      setThread(json.thread || null);
      setMessages(json.messages || []);
      setUnreadCount(Number(json.unread_count || 0));
      if (markRead && Number(json.unread_count || 0) > 0) {
        await fetch("/api/support/chat/read", {
          method: "POST",
          headers: { authorization: `Bearer ${session.access_token}` },
        }).catch(() => null);
        setUnreadCount(0);
        setMessages((prev) => prev.map((item) => item.sender_type === "developer" ? { ...item, read_by_user_at: item.read_by_user_at || new Date().toISOString() } : item));
      }
    } catch (err: any) {
      setError((current) => current || err?.message || "Не удалось загрузить чат с разработчиком");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function configureTelegramWebhook() {
    if (!session?.access_token || !isSupportAdmin) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const resp = await fetch("/api/support/telegram/set-webhook", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as SetWebhookResp;
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось подключить webhook Telegram");
      setInfo(`Webhook Telegram подключён: ${json.webhook_url || "ok"}`);
    } catch (err: any) {
      setError(err?.message || "Не удалось подключить webhook Telegram");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = message.trim();
    if (!body) {
      setError("Напиши, что нужно убрать, подправить или добавить.");
      return;
    }
    if (!session?.access_token || !user) {
      setError("Для связи с разработчиком нужен вход в кабинет.");
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const resp = await fetch("/api/support/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: body }),
      });
      const json = (await resp.json().catch(() => ({}))) as ChatSendResp;
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Не удалось отправить сообщение разработчику");
      }
      setMessage("");
      setInfo("Сообщение отправлено. Ответ разработчика появится здесь и придёт из Telegram.");
      await loadChat(true, true);
    } catch (err: any) {
      setError(err?.message || "Не удалось отправить сообщение разработчику");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token) return;
    loadChat(false, true);
    const interval = window.setInterval(() => {
      loadChat(open, true);
    }, open ? 6000 : 30000);
    return () => window.clearInterval(interval);
  }, [open, session?.access_token]);

  useEffect(() => {
    if (open && session?.access_token) {
      setError(null);
      loadChat(true);
    }
  }, [open, session?.access_token]);

  useEffect(() => {
    if (!open || !viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[95] rounded-full border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-900 shadow-lg backdrop-blur hover:border-emerald-300 hover:text-emerald-900"
      >
        <span className="relative inline-flex items-center gap-2">
          <span>Связь с разработчиком</span>
          {unreadCount > 0 ? (
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-end bg-slate-950/30 p-4 backdrop-blur-[2px] sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Чат с разработчиком</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  Если нужно что-то убрать, подправить или добавить новую функцию — напиши здесь. Сообщение уйдёт в Telegram, а ответ вернётся обратно прямо в интерфейс.
                </div>
              </div>
              <button type="button" className="rounded-full border border-slate-200 px-2.5 py-1 text-sm text-slate-500" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                Отправитель: <span className="font-medium text-slate-900">{userLabel}</span>
                {user?.email ? <div className="mt-1">Email: <span className="font-medium text-slate-900">{user.email}</span></div> : null}
                {thread?.id ? <div className="mt-1">Номер диалога: <span className="font-medium text-slate-900">{thread.id.slice(0, 8)}</span></div> : null}
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs leading-5 text-emerald-900">
                Ответы разработчика приходят сюда из Telegram. Можно писать прямо в сайт, а разработчик отвечает реплаем у себя в Telegram.
              </div>
            </div>

            <div ref={viewportRef} className="mt-4 max-h-[320px] min-h-[220px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3">
              {loading ? <div className="px-2 py-3 text-sm text-slate-500">Загружаем диалог…</div> : null}
              {!loading && !messages.length ? (
                <div className="px-2 py-6 text-sm leading-6 text-slate-500">
                  Пока сообщений нет. Напиши задачу, замечание или идею — она уйдёт в Telegram, а ответ появится здесь.
                </div>
              ) : null}
              <div className="space-y-3">
                {messages.map((item) => {
                  const fromDeveloper = item.sender_type === "developer";
                  return (
                    <div key={item.id} className={`flex ${fromDeveloper ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm ${fromDeveloper ? "border border-emerald-100 bg-white text-slate-900" : "bg-emerald-600 text-white"}`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${fromDeveloper ? "text-emerald-700" : "text-white/70"}`}>
                          {fromDeveloper ? (item.sender_label || "Разработчик") : "Вы"}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.body}</div>
                        <div className={`mt-2 flex items-center gap-2 text-[11px] ${fromDeveloper ? "text-slate-400" : "text-white/70"}`}>
                          <span>{formatMessageTime(item.created_at)}</span>
                          {!fromDeveloper && item.delivery_status === "failed" ? <span>· не ушло в Telegram</span> : null}
                          {!fromDeveloper && item.delivery_status === "pending" ? <span>· отправляем…</span> : null}
                          {fromDeveloper ? <span>· из Telegram</span> : <span>· сайт → Telegram</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <textarea
              className="input mt-4 min-h-[150px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Например: добавьте отдельный блок с тарифами, уберите лишнее поле или доработайте механику отчёта."
            />

            {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
            {info ? <div className="mt-3 text-sm text-emerald-700">{info}</div> : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {isSupportAdmin ? (
                <>
                  <Link href="/admin/support" className="btn btn-secondary" onClick={() => setOpen(false)}>
                    Все диалоги
                  </Link>
                  <button type="button" className="btn btn-secondary" onClick={configureTelegramWebhook} disabled={busy || loading}>
                    Подключить Telegram webhook
                  </button>
                </>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={() => loadChat(open, false)} disabled={busy || loading}>Обновить</button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Закрыть</button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !message.trim()}>
                {busy ? "Отправляем…" : "Отправить разработчику"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
