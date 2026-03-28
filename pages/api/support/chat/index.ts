import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import {
  buildSupportTelegramText,
  getOrCreateSupportThread,
  getSupportUserLabel,
  sendTelegramSupportMessage,
} from "@/lib/supportChat";

function trimText(value: unknown) {
  return String(value || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const thread = await getOrCreateSupportThread({
      supabaseAdmin: authed.supabaseAdmin,
      workspaceId: workspace.workspace_id,
      workspaceName: workspace.name,
      user: authed.user,
    });

    if (req.method === "GET") {
    const { data: messages, error } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .select("id, thread_id, sender_type, channel, body, sender_label, delivery_status, telegram_message_id, telegram_reply_to_message_id, created_at, read_by_user_at, read_by_developer_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      return res.status(400).json({ ok: false, error: error.message || "Не удалось загрузить чат" });
    }

    const unreadCount = (messages || []).filter((item: any) => item.sender_type === "developer" && !item.read_by_user_at).length;

    return res.status(200).json({ ok: true, thread, messages: messages || [], unread_count: unreadCount });
  }

  if (req.method === "POST") {
    const message = trimText(req.body?.message);
    if (!message) return res.status(400).json({ ok: false, error: "Напиши сообщение для разработчика" });
    if (message.length > 4000) return res.status(400).json({ ok: false, error: "Сообщение слишком длинное" });

    const senderLabel = getSupportUserLabel(authed.user);
    const { data: inserted, error: insertError } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .insert({
        thread_id: thread.id,
        workspace_id: workspace.workspace_id,
        user_id: authed.user.id,
        sender_type: "user",
        channel: "site",
        sender_label: senderLabel,
        body: message,
        delivery_status: "pending",
        read_by_developer_at: null,
      })
      .select("id, thread_id, sender_type, channel, body, sender_label, delivery_status, telegram_message_id, telegram_reply_to_message_id, created_at, read_by_user_at, read_by_developer_at")
      .single();

    if (insertError || !inserted) {
      return res.status(400).json({ ok: false, error: insertError?.message || "Не удалось сохранить сообщение" });
    }

    const botToken = trimText(process.env.TELEGRAM_SUPPORT_BOT_TOKEN);
    const chatId = trimText(process.env.TELEGRAM_SUPPORT_CHAT_ID);
    const threadId = trimText(process.env.TELEGRAM_SUPPORT_THREAD_ID);
    if (!botToken || !chatId) {
      await authed.supabaseAdmin
        .from("commercial_support_messages")
        .update({ delivery_status: "failed" })
        .eq("id", (inserted as any).id);
      return res.status(500).json({ ok: false, error: "Telegram support is not configured" });
    }

    try {
      const tgJson = await sendTelegramSupportMessage({
        botToken,
        chatId,
        threadId,
        text: buildSupportTelegramText({
          threadId: thread.id,
          workspaceName: workspace.name,
          user: authed.user,
          message,
        }),
      });

      const telegramMessageId = Number((tgJson as any)?.result?.message_id || 0) || null;
      await Promise.all([
        authed.supabaseAdmin
          .from("commercial_support_messages")
          .update({
            delivery_status: "sent",
            telegram_message_id: telegramMessageId,
          })
          .eq("id", (inserted as any).id),
        authed.supabaseAdmin
          .from("commercial_support_threads")
          .update({
            workspace_name: workspace.name,
            user_email: authed.user.email,
            user_name: trimText((authed.user.user_metadata as any)?.full_name) || null,
            company_name: trimText((authed.user.user_metadata as any)?.company_name) || null,
            updated_at: new Date().toISOString(),
            last_user_message_at: new Date().toISOString(),
            telegram_chat_id: Number(chatId),
            telegram_thread_id: threadId ? Number(threadId) : null,
          })
          .eq("id", thread.id),
      ]);

        return res.status(200).json({
        ok: true,
        thread,
        message: {
          ...inserted,
          delivery_status: "sent",
          telegram_message_id: telegramMessageId,
        },
      });
    } catch (err: any) {
      await Promise.all([
        authed.supabaseAdmin
          .from("commercial_support_messages")
          .update({ delivery_status: "failed" })
          .eq("id", (inserted as any).id),
        authed.supabaseAdmin
          .from("commercial_support_threads")
          .update({
            workspace_name: workspace.name,
            user_email: authed.user.email,
            user_name: trimText((authed.user.user_metadata as any)?.full_name) || null,
            company_name: trimText((authed.user.user_metadata as any)?.company_name) || null,
            updated_at: new Date().toISOString(),
            last_user_message_at: new Date().toISOString(),
          })
          .eq("id", thread.id),
      ]);
      return res.status(502).json({ ok: false, error: err?.message || "Не удалось отправить сообщение в Telegram" });
    }
  }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error: any) {
    const code = (error as any)?.code;
    if (code === "42P01") {
      return res.status(500).json({ ok: false, error: "В базе ещё не создан чат поддержки. Примените SQL-файл supabase/commercial_support_chat.sql" });
    }
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось обработать чат поддержки" });
  }
}
