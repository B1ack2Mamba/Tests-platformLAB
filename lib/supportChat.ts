import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthedUser } from "@/lib/serverAuth";

export type SupportChatSender = "user" | "developer";
export type SupportChatDeliveryStatus = "sent" | "failed" | "pending";

export type SupportChatMessage = {
  id: string;
  thread_id: string;
  sender_type: SupportChatSender;
  channel: string;
  body: string;
  sender_label: string | null;
  delivery_status: SupportChatDeliveryStatus;
  telegram_message_id: number | null;
  telegram_reply_to_message_id: number | null;
  created_at: string;
  read_by_user_at: string | null;
  read_by_developer_at: string | null;
};

export type SupportChatThread = {
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

function trimText(value: unknown) {
  return String(value || "").trim();
}

export function getSupportUserLabel(user: AuthedUser) {
  const fullName = trimText((user.user_metadata as any)?.full_name);
  return fullName || user.email || user.id;
}

export async function getOrCreateSupportThread(params: {
  supabaseAdmin: SupabaseClient;
  workspaceId: string;
  workspaceName?: string | null;
  user: AuthedUser;
}) {
  const { supabaseAdmin, workspaceId, workspaceName, user } = params;
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("commercial_support_threads")
    .select("id, workspace_id, workspace_name, user_id, user_email, user_name, company_name, created_at, updated_at, last_user_message_at, last_developer_message_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing as SupportChatThread;

  const insertPayload = {
    workspace_id: workspaceId,
    workspace_name: trimText(workspaceName) || null,
    user_id: user.id,
    user_email: user.email,
    user_name: trimText((user.user_metadata as any)?.full_name) || null,
    company_name: trimText((user.user_metadata as any)?.company_name) || null,
  };

  const { data: created, error: createError } = await supabaseAdmin
    .from("commercial_support_threads")
    .insert(insertPayload)
    .select("id, workspace_id, workspace_name, user_id, user_email, user_name, company_name, created_at, updated_at, last_user_message_at, last_developer_message_at")
    .single();

  if (createError) {
    const { data: fallback, error: fallbackError } = await supabaseAdmin
      .from("commercial_support_threads")
      .select("id, workspace_id, workspace_name, user_id, user_email, user_name, company_name, created_at, updated_at, last_user_message_at, last_developer_message_at")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    if (fallback) return fallback as SupportChatThread;
    throw createError;
  }

  return created as SupportChatThread;
}

export function buildSupportTelegramText(params: {
  threadId: string;
  workspaceName?: string | null;
  user: AuthedUser;
  message: string;
}) {
  const { threadId, workspaceName, user, message } = params;
  const fullName = trimText((user.user_metadata as any)?.full_name);
  const companyName = trimText((user.user_metadata as any)?.company_name);
  const userLabel = fullName || user.email || user.id;
  const ref = threadId.slice(0, 8);

  return [
    `🛠 Сообщение из кабинета [thread:${threadId}]`,
    `Ref: ${ref}`,
    `Пользователь: ${userLabel}`,
    user.email ? `Email: ${user.email}` : "",
    companyName ? `Компания: ${companyName}` : "",
    workspaceName ? `Workspace: ${workspaceName}` : "",
    `User ID: ${user.id}`,
    "",
    "Сообщение:",
    message,
    "",
    "Ответьте reply на это сообщение — ответ придёт обратно в интерфейс сайта.",
  ].filter(Boolean).join("\n");
}

export function getTelegramDisplayName(from: any) {
  const first = trimText(from?.first_name);
  const last = trimText(from?.last_name);
  const username = trimText(from?.username);
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || (username ? `@${username}` : "Разработчик");
}

export function stripThreadPrefix(value: string) {
  return value
    .replace(/^\s*\[(?:thread|чат)\s*:\s*[0-9a-f-]{8,36}\]\s*/i, "")
    .replace(/^\s*#([0-9a-f]{8})\s+/i, "")
    .trim();
}

export async function sendTelegramSupportMessage(params: {
  botToken: string;
  chatId: string;
  threadId?: string | number | null;
  text: string;
}) {
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
  };
  if (params.threadId !== undefined && params.threadId !== null && `${params.threadId}`.trim()) {
    const n = Number(params.threadId);
    if (Number.isFinite(n) && n > 0) payload.message_thread_id = n;
  }

  const tgResp = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const tgJson = await tgResp.json().catch(() => ({} as any));
  if (!tgResp.ok || tgJson?.ok === false) {
    throw new Error(tgJson?.description || "Telegram send failed");
  }

  return tgJson;
}
