import type { NextApiRequest, NextApiResponse } from "next";
import { assertAdmin } from "@/lib/serverAdmin";

function trimText(value: unknown) {
  return String(value || "").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const admin = await assertAdmin(req, res);
  if (!admin) return;

  const botToken = trimText(process.env.TELEGRAM_SUPPORT_BOT_TOKEN);
  const baseUrl = trimText(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL);
  const secret = trimText(process.env.TELEGRAM_SUPPORT_WEBHOOK_SECRET);
  if (!botToken || !baseUrl) {
    return res.status(500).json({ ok: false, error: "Set TELEGRAM_SUPPORT_BOT_TOKEN and APP_BASE_URL (or NEXT_PUBLIC_SITE_URL)" });
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/support/telegram/webhook`;
  const payload: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: false,
  };
  if (secret) payload.secret_token = secret;

  const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const tgJson = await tgResp.json().catch(() => ({} as any));
  if (!tgResp.ok || tgJson?.ok === false) {
    return res.status(502).json({ ok: false, error: tgJson?.description || "Не удалось установить webhook" });
  }

  return res.status(200).json({ ok: true, webhook_url: webhookUrl, telegram: tgJson?.result || null });
}
