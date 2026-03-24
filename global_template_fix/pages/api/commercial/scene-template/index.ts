import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";
import { pickTemplatePositions } from "@/lib/globalDeskTemplate";

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
        return res.status(200).json({ ok: true, templates: {}, warning: "Global settings table is not installed yet" });
      }
      return res.status(400).json({ ok: false, error: error.message || "Не удалось загрузить общий шаблон" });
    }

    const templates = pickTemplatePositions((data as any)?.setting_value?.templates || {});
    return res.status(200).json({ ok: true, templates });
  }

  if (req.method === "POST") {
    if (!isAdminEmail(user.email)) {
      return res.status(403).json({ ok: false, error: "Только администратор может сохранить общий стандарт" });
    }

    const templates = pickTemplatePositions(req.body?.templates || {});
    if (!Object.keys(templates).length) {
      return res.status(400).json({ ok: false, error: "Нет шаблона для сохранения" });
    }

    const { error } = await supabaseAdmin.from(TABLE_NAME).upsert(
      {
        setting_key: SETTING_KEY,
        setting_value: { templates },
        updated_by: user.id,
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(500).json({ ok: false, error: "В базе ещё не создана таблица общего стандарта. Примените SQL-файл supabase/commercial_global_scene_template.sql" });
      }
      return res.status(400).json({ ok: false, error: error.message || "Не удалось сохранить общий шаблон" });
    }

    return res.status(200).json({ ok: true, templates });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
