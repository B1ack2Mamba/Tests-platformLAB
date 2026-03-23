import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

type SceneTemplateRow = {
  version?: number | null;
  scene_widgets: any[] | null;
  tray_guide_text: string | null;
  tray_guide_position: Record<string, any> | null;
  trash_guide_position: Record<string, any> | null;
  folder_template: Record<string, any> | null;
  project_template: Record<string, any> | null;
  updated_at: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
    let data: any = null;
    let error: any = null;

    ({ data, error } = await authed.supabaseAdmin
      .from("commercial_scene_templates")
      .select("version, scene_widgets, tray_guide_text, tray_guide_position, trash_guide_position, folder_template, project_template, updated_at")
      .eq("template_key", "global_default")
      .maybeSingle());

    const missingVersionColumn = (error as any)?.code === "42703" || String((error as any)?.message || "").includes("commercial_scene_templates.version");

    if (missingVersionColumn) {
      ({ data, error } = await authed.supabaseAdmin
        .from("commercial_scene_templates")
        .select("scene_widgets, tray_guide_text, tray_guide_position, trash_guide_position, folder_template, project_template, updated_at")
        .eq("template_key", "global_default")
        .maybeSingle());

      if (!error && data) {
        data = { version: 1, ...data };
      }
    }

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(200).json({ ok: true, template: null });
      }
      throw error;
    }

    if (!data) return res.status(200).json({ ok: true, template: null });

    const row = data as SceneTemplateRow;
    return res.status(200).json({
      ok: true,
      template: {
        version: Number(row.version || 1),
        sceneWidgets: Array.isArray(row.scene_widgets) ? row.scene_widgets : [],
        trayGuideText: row.tray_guide_text || "Создать новую папку проектов",
        trayGuidePosition: row.tray_guide_position || null,
        trashGuidePosition: row.trash_guide_position || null,
        folderTemplate: row.folder_template || null,
        projectTemplate: row.project_template || null,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: any) {
    return res.status(200).json({ ok: true, template: null, warning: error?.message || "template unavailable" });
  }
}
