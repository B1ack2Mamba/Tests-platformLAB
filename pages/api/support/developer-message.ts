import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

function trimText(value: unknown) {
  return String(value || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const message = trimText(req.body?.message);
  if (!message) return res.status(400).json({ ok: false, error: "message is required" });
  if (message.length > 4000) return res.status(400).json({ ok: false, error: "Сообщение слишком длинное" });

  const botToken = trimText(process.env.TELEGRAM_SUPPORT_BOT_TOKEN);
  const chatId = trimText(process.env.TELEGRAM_SUPPORT_CHAT_ID);
  const threadId = trimText(process.env.TELEGRAM_SUPPORT_THREAD_ID);
  if (!botToken || !chatId) {
    return res.status(500).json({ ok: false, error: "Telegram support is not configured" });
  }

  const fullName = trimText((authed.user.user_metadata as any)?.full_name);
  const companyName = trimText((authed.user.user_metadata as any)?.company_name);
  const userLabel = fullName || authed.user.email || authed.user.id;

  const textLines = [
    "🛠 Новое сообщение из кабинета",
    `Пользователь: ${userLabel}`,
    authed.user.email ? `Email: ${authed.user.email}` : "",
    companyName ? `Компания: ${companyName}` : "",
    `User ID: ${authed.user.id}`,
    "",
    "Сообщение:",
    message,
  ].filter(Boolean);

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: textLines.join("\n"),
  };
  if (threadId) {
    const n = Number(threadId);
    if (Number.isFinite(n) && n > 0) payload.message_thread_id = n;
  }

  const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const tgJson = await tgResp.json().catch(() => ({} as any));
  if (!tgResp.ok || tgJson?.ok === false) {
    return res.status(502).json({ ok: false, error: tgJson?.description || "Telegram send failed" });
  }

  return res.status(200).json({ ok: true });
}
