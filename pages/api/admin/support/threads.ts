import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";

type ThreadRow = {
  id: string;
  workspace_id: string;
  workspace_name: string | null;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
  last_user_message_at: string | null;
  last_developer_message_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_type: "user" | "developer";
  body: string;
  created_at: string;
  read_by_developer_at: string | null;
};

function trimText(value: unknown) {
  return String(value || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;
  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, error: "Доступ только для администратора" });
  }

  try {
    const search = trimText(req.query.search);
    const onlyUnread = trimText(req.query.unread) === "1";
    const limit = Math.min(Math.max(Number(req.query.limit || 50) || 50, 1), 200);

    let query = authed.supabaseAdmin
      .from("commercial_support_threads")
      .select("id, workspace_id, workspace_name, user_id, user_email, user_name, company_name, created_at, updated_at, last_user_message_at, last_developer_message_at")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (search) {
      const escaped = search.replace(/[,%]/g, " ").trim();
      if (escaped) {
        query = query.or([
          `user_email.ilike.%${escaped}%`,
          `user_name.ilike.%${escaped}%`,
          `company_name.ilike.%${escaped}%`,
          `workspace_name.ilike.%${escaped}%`,
        ].join(","));
      }
    }

    const { data: threads, error: threadsError } = await query;
    if (threadsError) return res.status(400).json({ ok: false, error: threadsError.message || "Не удалось загрузить диалоги" });

    const typedThreads = (threads || []) as ThreadRow[];
    const threadIds = typedThreads.map((item) => item.id);
    if (!threadIds.length) {
      return res.status(200).json({ ok: true, threads: [] });
    }

    const { data: messages, error: messagesError } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .select("id, thread_id, sender_type, body, created_at, read_by_developer_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    if (messagesError) return res.status(400).json({ ok: false, error: messagesError.message || "Не удалось загрузить сообщения" });

    const typedMessages = (messages || []) as MessageRow[];
    const summaryMap = new Map<string, { last_message: MessageRow | null; unread_count: number }>();

    for (const item of typedMessages) {
      const current = summaryMap.get(item.thread_id) || { last_message: null, unread_count: 0 };
      if (!current.last_message) current.last_message = item;
      if (item.sender_type === "user" && !item.read_by_developer_at) current.unread_count += 1;
      summaryMap.set(item.thread_id, current);
    }

    const result = typedThreads
      .map((thread) => {
        const summary = summaryMap.get(thread.id) || { last_message: null, unread_count: 0 };
        return {
          ...thread,
          unread_count: summary.unread_count,
          last_message_preview: summary.last_message?.body || "",
          last_message_sender_type: summary.last_message?.sender_type || null,
          last_message_at: summary.last_message?.created_at || thread.updated_at,
        };
      })
      .filter((thread) => !onlyUnread || Number(thread.unread_count || 0) > 0);

    return res.status(200).json({ ok: true, threads: result });
  } catch (error: any) {
    const code = error?.code;
    if (code === "42P01") {
      return res.status(500).json({ ok: false, error: "В базе ещё не создан чат поддержки. Примените SQL-файл supabase/commercial_support_chat.sql" });
    }
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось загрузить диалоги" });
  }
}
