import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { useSession } from "@/lib/useSession";
import { ADMIN_EMAIL, isAdminEmail } from "@/lib/admin";
import type { SupportChatMessage, SupportChatThread } from "@/lib/supportChat";

type AdminThreadSummary = SupportChatThread & {
  unread_count: number;
  last_message_preview: string;
  last_message_sender_type: "user" | "developer" | null;
  last_message_at: string | null;
};

type ThreadsResponse = { ok: boolean; error?: string; threads?: AdminThreadSummary[] };
type ThreadResponse = { ok: boolean; error?: string; thread?: SupportChatThread; messages?: SupportChatMessage[] };
type ReplyResponse = { ok: boolean; error?: string; message?: SupportChatMessage; telegram_mirrored?: boolean; telegram_error?: string | null };

function formatDate(value?: string | null) {
  if (!value) return "";
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

function compactText(value: string, max = 90) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

export default function AdminSupportPage() {
  const { user, session, loading, envOk } = useSession();
  const canUseAdmin = isAdminEmail(user?.email);
  const [threads, setThreads] = useState<AdminThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [selectedThread, setSelectedThread] = useState<SupportChatThread | null>(null);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const selectedSummary = useMemo(
    () => threads.find((item) => item.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  async function loadThreads(silent = false) {
    if (!session?.access_token || !canUseAdmin) return;
    if (!silent) setThreadsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (onlyUnread) params.set("unread", "1");
      const resp = await fetch(`/api/admin/support/threads${params.toString() ? `?${params.toString()}` : ""}`, {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as ThreadsResponse;
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить диалоги");
      const nextThreads = Array.isArray(json.threads) ? json.threads : [];
      setThreads(nextThreads);
      if (nextThreads.length && !nextThreads.some((item) => item.id === selectedThreadId)) {
        setSelectedThreadId(nextThreads[0].id);
      }
      if (!nextThreads.length) {
        setSelectedThreadId("");
        setSelectedThread(null);
        setMessages([]);
      }
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить диалоги");
    } finally {
      if (!silent) setThreadsLoading(false);
    }
  }

  async function loadThread(threadId: string, silent = false) {
    if (!session?.access_token || !threadId || !canUseAdmin) return;
    if (!silent) setThreadLoading(true);
    try {
      const resp = await fetch(`/api/admin/support/thread?thread_id=${encodeURIComponent(threadId)}`, {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const json = (await resp.json().catch(() => ({}))) as ThreadResponse;
      if (!resp.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить переписку");
      setSelectedThread(json.thread || null);
      setMessages(Array.isArray(json.messages) ? json.messages : []);
      await fetch("/api/admin/support/read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ thread_id: threadId }),
      }).catch(() => null);
      setThreads((prev) => prev.map((item) => item.id === threadId ? { ...item, unread_count: 0 } : item));
    } catch (err: any) {
      setError(err?.message || "Не удалось загрузить переписку");
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }

  async function sendReply() {
    const body = replyText.trim();
    if (!session?.access_token || !selectedThreadId) return;
    if (!body) {
      setError("Напиши ответ пользователю.");
      return;
    }
    setReplyBusy(true);
    setError("");
    setInfo("");
    try {
      const resp = await fetch("/api/admin/support/reply", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ thread_id: selectedThreadId, message: body }),
      });
      const json = (await resp.json().catch(() => ({}))) as ReplyResponse;
      if (!resp.ok || !json?.ok || !json.message) {
        throw new Error(json?.error || "Не удалось отправить ответ");
      }
      setMessages((prev) => [...prev, json.message as SupportChatMessage]);
      setThreads((prev) => prev.map((item) => item.id === selectedThreadId ? {
        ...item,
        updated_at: (json.message as SupportChatMessage).created_at,
        last_developer_message_at: (json.message as SupportChatMessage).created_at,
        last_message_preview: (json.message as SupportChatMessage).body,
        last_message_sender_type: "developer",
        last_message_at: (json.message as SupportChatMessage).created_at,
      } : item));
      setReplyText("");
      setInfo(json.telegram_error ? `Ответ сохранён в сайт, но Telegram не подтвердил зеркало: ${json.telegram_error}` : "Ответ отправлен пользователю.");
    } catch (err: any) {
      setError(err?.message || "Не удалось отправить ответ");
    } finally {
      setReplyBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    loadThreads();
  }, [session?.access_token, canUseAdmin, onlyUnread]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (session?.access_token && canUseAdmin) loadThreads(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, session?.access_token, canUseAdmin]);

  useEffect(() => {
    if (session?.access_token && canUseAdmin && selectedThreadId) {
      setError("");
      loadThread(selectedThreadId);
    }
  }, [selectedThreadId, session?.access_token, canUseAdmin]);

  useEffect(() => {
    if (!session?.access_token || !canUseAdmin) return;
    const interval = window.setInterval(() => {
      loadThreads(true);
      if (selectedThreadId) loadThread(selectedThreadId, true);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [session?.access_token, canUseAdmin, selectedThreadId, search, onlyUnread]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, selectedThreadId]);

  return (
    <Layout title="Диалоги поддержки">
      {!envOk ? (
        <div className="card text-sm text-zinc-600">Supabase не настроен. Добавь переменные из <code className="rounded bg-white/60 px-1">.env.example</code>.</div>
      ) : loading ? (
        <div className="card text-sm text-zinc-600">Загрузка…</div>
      ) : !user ? (
        <div className="card text-sm text-zinc-600">Нужен вход. Перейди в <a className="underline" href="/auth">/auth</a>.</div>
      ) : !canUseAdmin ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Доступ запрещён. Админ: <span className="font-mono">{ADMIN_EMAIL}</span></div>
      ) : (
        <div className="grid gap-4">
          <section className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Поддержка внутри сайта</div>
                <div className="mt-1 text-sm text-slate-500">Все пользовательские диалоги в одном месте. Можно смотреть историю, отвечать прямо отсюда и не жить только в Telegram.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin" className="btn btn-secondary btn-sm">Назад в админку</Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setError(""); setInfo(""); loadThreads(); if (selectedThreadId) loadThread(selectedThreadId); }}>
                  Обновить
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Список диалогов</div>
                  <div className="text-xs text-slate-500">{threads.length} в выборке</div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
                  Только непрочитанные
                </label>
              </div>

              <input
                className="input mt-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по email, имени, компании, workspace"
              />

              <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {threadsLoading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">Загружаем диалоги…</div> : null}
                {!threadsLoading && !threads.length ? <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-sm text-slate-500">Диалогов пока нет.</div> : null}
                {threads.map((thread) => {
                  const active = thread.id === selectedThreadId;
                  const title = thread.user_name || thread.user_email || thread.company_name || "Без имени";
                  return (
                    <button
                      type="button"
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${active ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">{thread.user_email || thread.company_name || thread.workspace_name || "Без email"}</div>
                        </div>
                        {thread.unread_count > 0 ? <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">{thread.unread_count}</span> : null}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{thread.workspace_name || "Без названия workspace"}</div>
                      <div className="mt-2 text-sm leading-5 text-slate-700">{compactText(thread.last_message_preview || "Сообщений пока нет", 110)}</div>
                      <div className="mt-2 text-[11px] text-slate-400">{formatDate(thread.last_message_at || thread.updated_at)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              {selectedSummary ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">{selectedSummary.user_name || selectedSummary.user_email || "Без имени"}</div>
                      <div className="mt-1 text-sm text-slate-500">{selectedSummary.user_email || "Без email"}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Workspace: {selectedSummary.workspace_name || "—"}</span>
                        {selectedSummary.company_name ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Компания: {selectedSummary.company_name}</span> : null}
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Диалог: {selectedSummary.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Последнее обновление</div>
                      <div className="mt-1 font-medium text-slate-800">{formatDate(selectedSummary.updated_at)}</div>
                    </div>
                  </div>

                  <div ref={viewportRef} className="mt-4 max-h-[55vh] min-h-[320px] overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 px-3 py-3">
                    {threadLoading ? <div className="px-2 py-3 text-sm text-slate-500">Загружаем переписку…</div> : null}
                    {!threadLoading && !messages.length ? <div className="px-2 py-6 text-sm leading-6 text-slate-500">У этого диалога пока нет сообщений.</div> : null}
                    <div className="space-y-3">
                      {messages.map((item) => {
                        const fromDeveloper = item.sender_type === "developer";
                        return (
                          <div key={item.id} className={`flex ${fromDeveloper ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-[24px] px-4 py-3 shadow-sm ${fromDeveloper ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
                              <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${fromDeveloper ? "text-white/70" : "text-emerald-700"}`}>
                                {fromDeveloper ? (item.sender_label || "Разработчик") : (selectedSummary.user_name || "Пользователь")}
                              </div>
                              <div className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.body}</div>
                              <div className={`mt-2 text-[11px] ${fromDeveloper ? "text-white/70" : "text-slate-400"}`}>
                                {formatDate(item.created_at)}
                                {fromDeveloper ? ` · ${item.channel === "telegram" ? "из Telegram" : "из сайта"}` : " · пользователь"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[28px] border border-emerald-100 bg-emerald-50/40 p-4">
                    <div className="text-sm font-semibold text-slate-900">Ответ пользователю</div>
                    <div className="mt-1 text-sm text-slate-500">Сообщение сразу появится в интерфейсе сайта. Telegram тоже попробуем обновить, чтобы каналы не расходились.</div>
                    <textarea
                      className="input mt-3 min-h-[160px]"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Напиши ответ, уточнение или инструкцию для пользователя."
                    />
                    {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
                    {info ? <div className="mt-3 text-sm text-emerald-700">{info}</div> : null}
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button type="button" className="btn btn-secondary" onClick={() => loadThread(selectedThreadId)} disabled={replyBusy || threadLoading}>Обновить переписку</button>
                      <button type="button" className="btn btn-primary" onClick={sendReply} disabled={replyBusy || !replyText.trim()}>{replyBusy ? "Отправляем…" : "Ответить из сайта"}</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">Выбери диалог слева.</div>
              )}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
