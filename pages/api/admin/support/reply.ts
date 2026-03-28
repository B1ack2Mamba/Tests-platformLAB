import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";
import { sendTelegramSupportMessage } from "@/lib/supportChat";

function trimText(value: unknown) {
  return String(value || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;
  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, error: "Доступ только для администратора" });
  }

  try {
    const threadId = trimText(req.body?.thread_id);
    const body = trimText(req.body?.message);
    if (!threadId) return res.status(400).json({ ok: false, error: "thread_id is required" });
    if (!body) return res.status(400).json({ ok: false, error: "message is required" });

    const { data: thread, error: threadError } = await authed.supabaseAdmin
      .from("commercial_support_threads")
      .select("id, workspace_id, workspace_name, user_id, telegram_chat_id, telegram_thread_id")
      .eq("id", threadId)
      .maybeSingle();

    if (threadError) return res.status(400).json({ ok: false, error: threadError.message || "Не удалось загрузить диалог" });
    if (!thread) return res.status(404).json({ ok: false, error: "Диалог не найден" });

    const now = new Date().toISOString();
    const insertPayload = {
      thread_id: String(thread.id),
      workspace_id: String((thread as any).workspace_id),
      user_id: String((thread as any).user_id),
      sender_type: "developer",
      channel: "site",
      sender_label: "Разработчик",
      body,
      delivery_status: "sent",
      read_by_developer_at: now,
    };

    const { data: inserted, error: insertError } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .insert(insertPayload)
      .select("id, thread_id, sender_type, channel, body, sender_label, delivery_status, telegram_message_id, telegram_reply_to_message_id, created_at, read_by_user_at, read_by_developer_at")
      .single();

    if (insertError) return res.status(400).json({ ok: false, error: insertError.message || "Не удалось отправить ответ" });

    await Promise.all([
      authed.supabaseAdmin
        .from("commercial_support_threads")
        .update({
          updated_at: now,
          last_developer_message_at: now,
        })
        .eq("id", String(thread.id)),
      authed.supabaseAdmin
        .from("commercial_support_messages")
        .update({ read_by_developer_at: now })
        .eq("thread_id", String(thread.id))
        .eq("sender_type", "user")
        .is("read_by_developer_at", null),
    ]);

    const botToken = trimText(process.env.TELEGRAM_SUPPORT_BOT_TOKEN);
    const chatId = trimText(process.env.TELEGRAM_SUPPORT_CHAT_ID);
    const messageThreadId = (thread as any)?.telegram_thread_id || trimText(process.env.TELEGRAM_SUPPORT_THREAD_ID) || null;
    let telegramMirrored = false;
    let telegramError: string | null = null;

    if (botToken && chatId) {
      try {
        await sendTelegramSupportMessage({
          botToken,
          chatId,
          threadId: messageThreadId,
          text: [
            `💬 Ответ из админ-панели [thread:${String(thread.id)}]`,
            `Ref: ${String(thread.id).slice(0, 8)}`,
            thread.workspace_name ? `Workspace: ${thread.workspace_name}` : "",
            "",
            body,
          ].filter(Boolean).join("\n"),
        });
        telegramMirrored = true;
      } catch (err: any) {
        telegramError = err?.message || "Не удалось продублировать ответ в Telegram";
      }
    }

    return res.status(200).json({
      ok: true,
      message: inserted,
      telegram_mirrored: telegramMirrored,
      telegram_error: telegramError,
    });
  } catch (error: any) {
    const code = error?.code;
    if (code === "42P01") {
      return res.status(500).json({ ok: false, error: "В базе ещё не создан чат поддержки. Примените SQL-файл supabase/commercial_support_chat.sql" });
    }
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось отправить ответ" });
  }
}
