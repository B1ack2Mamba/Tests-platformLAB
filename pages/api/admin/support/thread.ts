import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";

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
    const threadId = trimText(req.query.thread_id);
    if (!threadId) return res.status(400).json({ ok: false, error: "thread_id is required" });

    const { data: thread, error: threadError } = await authed.supabaseAdmin
      .from("commercial_support_threads")
      .select("id, workspace_id, workspace_name, user_id, user_email, user_name, company_name, created_at, updated_at, last_user_message_at, last_developer_message_at")
      .eq("id", threadId)
      .maybeSingle();

    if (threadError) return res.status(400).json({ ok: false, error: threadError.message || "Не удалось загрузить диалог" });
    if (!thread) return res.status(404).json({ ok: false, error: "Диалог не найден" });

    const { data: messages, error: messagesError } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .select("id, thread_id, sender_type, channel, body, sender_label, delivery_status, telegram_message_id, telegram_reply_to_message_id, created_at, read_by_user_at, read_by_developer_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (messagesError) return res.status(400).json({ ok: false, error: messagesError.message || "Не удалось загрузить сообщения" });

    return res.status(200).json({ ok: true, thread, messages: messages || [] });
  } catch (error: any) {
    const code = error?.code;
    if (code === "42P01") {
      return res.status(500).json({ ok: false, error: "В базе ещё не создан чат поддержки. Примените SQL-файл supabase/commercial_support_chat.sql" });
    }
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось загрузить диалог" });
  }
}
