import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;
  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, error: "Доступ только для администратора" });
  }

  try {
    const threadId = String(req.body?.thread_id || "").trim();
    if (!threadId) return res.status(400).json({ ok: false, error: "thread_id is required" });

    const now = new Date().toISOString();
    const { error } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .update({ read_by_developer_at: now })
      .eq("thread_id", threadId)
      .eq("sender_type", "user")
      .is("read_by_developer_at", null);

    if (error) return res.status(400).json({ ok: false, error: error.message || "Не удалось отметить сообщения" });
    return res.status(200).json({ ok: true, thread_id: threadId, read_at: now });
  } catch (error: any) {
    const code = error?.code;
    if (code === "42P01") {
      return res.status(500).json({ ok: false, error: "В базе ещё не создан чат поддержки. Примените SQL-файл supabase/commercial_support_chat.sql" });
    }
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось отметить сообщения" });
  }
}
