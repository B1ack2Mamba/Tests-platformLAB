import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";
import { pickSceneStandard, pickTemplatePositions } from "@/lib/globalDeskTemplate";

const SETTING_KEY = "desk_templates";
const TABLE_NAME = "commercial_global_settings";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authed = await requireUser(req, res, { requireEmail: true });
  if (!authed) return;

  const { user, supabaseAdmin } = authed;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .select("setting_value")
      .eq("setting_key", SETTING_KEY)
      .maybeSingle();

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(200).json({ ok: true, standard: { positions: {}, widgets: [] }, templates: {}, warning: "Global settings table is not installed yet" });
      }
      return res.status(400).json({ ok: false, error: error.message || "Не удалось загрузить общий стандарт сцены" });
    }

    const standard = pickSceneStandard((data as any)?.setting_value?.standard || (data as any)?.setting_value || {});
    return res.status(200).json({ ok: true, standard, templates: pickTemplatePositions(standard.positions) });
  }

  if (req.method === "POST") {
    if (!isAdminEmail(user.email)) {
      return res.status(403).json({ ok: false, error: "Только администратор может сохранить общий стандарт" });
    }

    const standard = pickSceneStandard(req.body?.standard || req.body || {});
    if (!Object.keys(standard.positions).length && !standard.widgets.length && !standard.trayGuideText) {
      return res.status(400).json({ ok: false, error: "Нет данных для сохранения общего стандарта" });
    }

    const { error } = await supabaseAdmin.from(TABLE_NAME).upsert(
      {
        setting_key: SETTING_KEY,
        setting_value: {
          standard,
          templates: pickTemplatePositions(standard.positions),
        },
        updated_by: user.id,
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(500).json({ ok: false, error: "В базе ещё не создана таблица общего стандарта. Примените SQL-файл supabase/commercial_global_scene_template.sql" });
      }
      return res.status(400).json({ ok: false, error: error.message || "Не удалось сохранить общий стандарт" });
    }

    return res.status(200).json({ ok: true, standard, templates: pickTemplatePositions(standard.positions) });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
