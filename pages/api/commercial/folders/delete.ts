import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "Нужен id папки" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { error } = await authed.supabaseAdmin
      .from("commercial_project_folders")
      .delete()
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось удалить папку" });
  }
}
