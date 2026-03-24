import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const projectId = String(req.body?.project_id || "").trim();
  const folderIdRaw = req.body?.folder_id;
  const folderId = folderIdRaw ? String(folderIdRaw).trim() : null;
  if (!projectId) return res.status(400).json({ ok: false, error: "Нужен project_id" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);

    if (folderId) {
      const { data: folder, error: folderError } = await authed.supabaseAdmin
        .from("commercial_project_folders")
        .select("id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("id", folderId)
        .maybeSingle();
      if (folderError) throw folderError;
      if (!folder) return res.status(404).json({ ok: false, error: "Папка не найдена" });
    }

    const { error } = await authed.supabaseAdmin
      .from("commercial_projects")
      .update({ folder_id: folderId })
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", projectId);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось переместить проект" });
  }
}
