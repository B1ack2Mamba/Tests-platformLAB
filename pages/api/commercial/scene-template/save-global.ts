import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";

type IncomingTemplate = {
  sceneWidgets?: any[];
  trayGuideText?: string;
  trayGuidePosition?: Record<string, any> | null;
  trashGuidePosition?: Record<string, any> | null;
  folderTemplate?: Record<string, any> | null;
  projectTemplate?: Record<string, any> | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res, { requireEmail: true });
  if (!authed) return;

  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, error: "Недостаточно прав" });
  }

  const body = (req.body || {}) as IncomingTemplate;

  try {
    let existing: any = null;
    let existingError: any = null;

    ({ data: existing, error: existingError } = await authed.supabaseAdmin
      .from("commercial_scene_templates")
      .select("version")
      .eq("template_key", "global_default")
      .maybeSingle());

    const missingVersionColumn = (existingError as any)?.code === "42703" || String((existingError as any)?.message || "").includes("commercial_scene_templates.version");

    if (missingVersionColumn) {
      existing = null;
      existingError = null;
    }

    if (existingError && (existingError as any)?.code !== "PGRST116" && (existingError as any)?.code !== "42P01") {
      throw existingError;
    }

    const nextVersion = Number((existing as any)?.version || 0) + 1;

    const basePayload = {
      template_key: "global_default",
      scene_widgets: Array.isArray(body.sceneWidgets) ? body.sceneWidgets : [],
      tray_guide_text: (body.trayGuideText || "Создать новую папку проектов").trim(),
      tray_guide_position: body.trayGuidePosition || null,
      trash_guide_position: body.trashGuidePosition || null,
      folder_template: body.folderTemplate || null,
      project_template: body.projectTemplate || null,
      updated_by: authed.user.id,
      updated_at: new Date().toISOString(),
    };

    const payloadWithVersion = {
      ...basePayload,
      version: nextVersion,
    };

    let data: any = null;
    let error: any = null;

    ({ data, error } = await authed.supabaseAdmin
      .from("commercial_scene_templates")
      .upsert(payloadWithVersion, { onConflict: "template_key" })
      .select("version, scene_widgets, tray_guide_text, tray_guide_position, trash_guide_position, folder_template, project_template, updated_at")
      .single());

    if ((error as any)?.code === "42703" || String((error as any)?.message || "").includes("commercial_scene_templates.version")) {
      ({ data, error } = await authed.supabaseAdmin
        .from("commercial_scene_templates")
        .upsert(basePayload, { onConflict: "template_key" })
        .select("scene_widgets, tray_guide_text, tray_guide_position, trash_guide_position, folder_template, project_template, updated_at")
        .single());

      if (!error && data) {
        data = { version: 1, ...data };
      }
    }

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(400).json({ ok: false, error: "Сначала примени SQL commercial_scene_template.sql в Supabase" });
      }
      throw error;
    }

    return res.status(200).json({
      ok: true,
      template: {
        version: Number((data as any)?.version || nextVersion || 1),
        sceneWidgets: Array.isArray((data as any)?.scene_widgets) ? (data as any).scene_widgets : [],
        trayGuideText: (data as any)?.tray_guide_text || "Создать новую папку проектов",
        trayGuidePosition: (data as any)?.tray_guide_position || null,
        trashGuidePosition: (data as any)?.trash_guide_position || null,
        folderTemplate: (data as any)?.folder_template || null,
        projectTemplate: (data as any)?.project_template || null,
        updatedAt: (data as any)?.updated_at || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сохранить шаблон сцены" });
  }
}
