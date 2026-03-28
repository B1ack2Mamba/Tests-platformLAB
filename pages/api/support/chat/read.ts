import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { getOrCreateSupportThread } from "@/lib/supportChat";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

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

    const now = new Date().toISOString();
    const { error } = await authed.supabaseAdmin
      .from("commercial_support_messages")
      .update({ read_by_user_at: now })
      .eq("thread_id", thread.id)
      .eq("sender_type", "developer")
      .is("read_by_user_at", null);

    if (error) return res.status(400).json({ ok: false, error: error.message || "Не удалось отметить сообщения" });
    return res.status(200).json({ ok: true, thread_id: thread.id, read_at: now });
  } catch (error: any) {
    const code = (error as any)?.code;
    if (code === "42P01") {
      return res.status(500).json({ ok: false, error: "В базе ещё не создан чат поддержки. Примените SQL-файл supabase/commercial_support_chat.sql" });
    }
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось отметить сообщения" });
  }
}
