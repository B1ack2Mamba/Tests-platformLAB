import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { isFolderIconKey } from "@/lib/folderIcons";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const id = String(req.body?.id || "").trim();
  const nameRaw = req.body?.name;
  const iconKeyRaw = req.body?.icon_key;
  if (!id) return res.status(400).json({ ok: false, error: "Нужен id" });

  const patch: Record<string, string> = {};
  if (typeof nameRaw === "string" && nameRaw.trim()) patch.name = nameRaw.trim();
  if (typeof iconKeyRaw === "string" && isFolderIconKey(iconKeyRaw.trim())) patch.icon_key = iconKeyRaw.trim();
  if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: "Нужно передать name или icon_key" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { data, error } = await authed.supabaseAdmin
      .from("commercial_project_folders")
      .update(patch)
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", id)
      .select("id, name, icon_key")
      .single();

    if (error) throw error;
    return res.status(200).json({ ok: true, folder: data });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось обновить папку" });
  }
}
