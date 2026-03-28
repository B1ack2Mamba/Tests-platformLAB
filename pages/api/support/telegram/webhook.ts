import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getTelegramDisplayName, stripThreadPrefix } from "@/lib/supportChat";

function trimText(value: unknown) {
  return String(value || "").trim();
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const secret = trimText(process.env.TELEGRAM_SUPPORT_WEBHOOK_SECRET);
  if (secret) {
    const headerSecret = trimText(req.headers["x-telegram-bot-api-secret-token"]);
    if (headerSecret !== secret) return res.status(401).json({ ok: false, error: "Invalid Telegram secret" });
  }

  const configuredChatId = trimText(process.env.TELEGRAM_SUPPORT_CHAT_ID);
  const update = req.body || {};
  const message = update?.message || update?.edited_message;
  if (!message) return res.status(200).json({ ok: true, ignored: true, reason: "no-message" });

  const chatId = String(message?.chat?.id || "").trim();
  if (!configuredChatId || !chatId || chatId !== configuredChatId) {
    return res.status(200).json({ ok: true, ignored: true, reason: "unexpected-chat" });
  }

  if (message?.from?.is_bot) {
    return res.status(200).json({ ok: true, ignored: true, reason: "bot-message" });
  }

  const text = trimText(message?.text || message?.caption);
  if (!text) return res.status(200).json({ ok: true, ignored: true, reason: "empty-text" });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(500).json({ ok: false, error: "Supabase env missing" });

  const replyMessageId = Number(message?.reply_to_message?.message_id || 0) || null;
  let threadId: string | null = null;
  let threadRow: any = null;

  if (replyMessageId) {
    const { data: parentMessage, error: parentError } = await supabaseAdmin
      .from("commercial_support_messages")
      .select("thread_id")
      .eq("telegram_message_id", replyMessageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (parentError) return res.status(400).json({ ok: false, error: parentError.message || "Не удалось найти ветку ответа" });
    if (parentMessage?.thread_id) threadId = String(parentMessage.thread_id);
  }

  if (!threadId) {
    const explicitMatch = text.match(/\[(?:thread|чат)\s*:\s*([0-9a-f-]{8,36})\]/i);
    const shortMatch = text.match(/#([0-9a-f]{8})\b/i);
    const ref = explicitMatch?.[1] || shortMatch?.[1] || null;
    if (ref) {
      const { data: matchedThread, error: threadError } = await supabaseAdmin
        .from("commercial_support_threads")
        .select("id, workspace_id, user_id")
        .ilike("id", `${ref}%`)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (threadError) return res.status(400).json({ ok: false, error: threadError.message || "Не удалось определить чат" });
      if (matchedThread?.id) {
        threadId = String(matchedThread.id);
        threadRow = matchedThread;
      }
    }
  }

  if (!threadId) {
    return res.status(200).json({ ok: true, ignored: true, reason: "thread-not-found" });
  }

  if (!threadRow) {
    const { data: loadedThread, error: loadThreadError } = await supabaseAdmin
      .from("commercial_support_threads")
      .select("id, workspace_id, user_id")
      .eq("id", threadId)
      .maybeSingle();
    if (loadThreadError) return res.status(400).json({ ok: false, error: loadThreadError.message || "Не удалось загрузить чат" });
    if (!loadedThread) return res.status(200).json({ ok: true, ignored: true, reason: "thread-missing" });
    threadRow = loadedThread;
  }

  const cleanBody = stripThreadPrefix(text);
  if (!cleanBody) return res.status(200).json({ ok: true, ignored: true, reason: "body-empty" });

  const senderLabel = getTelegramDisplayName(message?.from);
  const createdAt = new Date((Number(message?.date || 0) || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const telegramMessageId = Number(message?.message_id || 0) || null;
  const telegramReplyToMessageId = Number(message?.reply_to_message?.message_id || 0) || null;

  const { error: insertError } = await supabaseAdmin
    .from("commercial_support_messages")
    .insert({
      thread_id: threadRow.id,
      workspace_id: threadRow.workspace_id,
      user_id: threadRow.user_id,
      sender_type: "developer",
      channel: "telegram",
      sender_label: senderLabel,
      body: cleanBody,
      delivery_status: "sent",
      telegram_message_id: telegramMessageId,
      telegram_reply_to_message_id: telegramReplyToMessageId,
      read_by_developer_at: new Date().toISOString(),
      created_at: createdAt,
      metadata: {
        telegram_chat_id: chatId,
        telegram_from_id: message?.from?.id || null,
        telegram_username: message?.from?.username || null,
      },
    });

  if (insertError && (insertError as any)?.code !== "23505") {
    return res.status(400).json({ ok: false, error: insertError.message || "Не удалось сохранить ответ разработчика" });
  }

  const { error: updateError } = await supabaseAdmin
    .from("commercial_support_threads")
    .update({
      updated_at: createdAt,
      last_developer_message_at: createdAt,
    })
    .eq("id", threadRow.id);

  if (updateError) return res.status(400).json({ ok: false, error: updateError.message || "Не удалось обновить чат" });

  return res.status(200).json({ ok: true, thread_id: threadRow.id });
}
