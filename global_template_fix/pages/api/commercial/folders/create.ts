import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { isFolderIconKey } from "@/lib/folderIcons";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const name = String(req.body?.name || "").trim();
  const iconKeyRaw = String(req.body?.icon_key || "folder").trim();
  const iconKey = isFolderIconKey(iconKeyRaw) ? iconKeyRaw : "folder";
  if (!name) return res.status(400).json({ ok: false, error: "Укажи название папки" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);
    const { data: maxRow } = await authed.supabaseAdmin
      .from("commercial_project_folders")
      .select("sort_order")
      .eq("workspace_id", workspace.workspace_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await authed.supabaseAdmin
      .from("commercial_project_folders")
      .insert({
        workspace_id: workspace.workspace_id,
        created_by: authed.user.id,
        name,
        icon_key: iconKey,
        sort_order: Number((maxRow as any)?.sort_order || 0) + 1,
      })
      .select("id, name, icon_key, sort_order, created_at")
      .single();

    if (error) throw error;
    return res.status(200).json({ ok: true, folder: data });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось создать папку" });
  }
}
