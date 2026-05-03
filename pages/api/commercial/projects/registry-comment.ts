import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { ensureWorkspaceForUser } from "@/lib/commercialWorkspace";
import { isRegistrySchemaMissing } from "@/lib/registrySchema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res);
  if (!authed) return;

  const projectId = req.method === "GET"
    ? typeof req.query.id === "string" ? req.query.id.trim() : ""
    : String((req.body || {}).project_id || "").trim();

  if (!projectId) return res.status(400).json({ ok: false, error: "project_id/id is required" });

  try {
    const workspace = await ensureWorkspaceForUser(authed.supabaseAdmin, authed.user);

    if (req.method === "GET") {
      const { data, error } = await authed.supabaseAdmin
        .from("commercial_projects")
        .select("id, registry_comment, registry_comment_updated_at")
        .eq("workspace_id", workspace.workspace_id)
        .eq("id", projectId)
        .maybeSingle();
      if (isRegistrySchemaMissing(error)) {
        return res.status(503).json({ ok: false, error: "SQL-миграция registry_comment ещё не применена в базе" });
      }
      if (error) throw error;
      if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });
      return res.status(200).json({ ok: true, registry_comment: (data as any).registry_comment || "", registry_comment_updated_at: (data as any).registry_comment_updated_at || null });
    }

    const comment = String((req.body || {}).registry_comment || "").trim() || null;
    const { data, error } = await authed.supabaseAdmin
      .from("commercial_projects")
      .update({
        registry_comment: comment,
        registry_comment_updated_at: new Date().toISOString(),
        registry_comment_updated_by: authed.user.id,
      })
      .eq("workspace_id", workspace.workspace_id)
      .eq("id", projectId)
      .select("id, registry_comment, registry_comment_updated_at")
      .maybeSingle();
    if (isRegistrySchemaMissing(error)) {
      return res.status(503).json({ ok: false, error: "SQL-миграция registry_comment ещё не применена в базе" });
    }

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Проект не найден" });

    return res.status(200).json({ ok: true, registry_comment: (data as any).registry_comment || "", registry_comment_updated_at: (data as any).registry_comment_updated_at || null });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сохранить комментарий Registry" });
  }
}
