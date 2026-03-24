import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isAdminEmail } from "@/lib/admin";
import { pickSceneStandard, pickTemplatePositions } from "@/lib/globalDeskTemplate";

function parseMaybeJson(value: any): any {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function isEmptyStandard(value: { positions?: Record<string, any>; widgets?: any[]; trayGuideText?: string | undefined }) {
  return !Object.keys(value?.positions || {}).length && !(value?.widgets || []).length && !value?.trayGuideText;
}

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

    const requestBody = parseMaybeJson(req.body) || {};
    const parsedStandardSource = parseMaybeJson((requestBody as any)?.standard ?? requestBody);
    let standard = pickSceneStandard(parsedStandardSource || {});

    if (isEmptyStandard(standard)) {
      const fallbackSource = {
        positions:
          parseMaybeJson((requestBody as any)?.positions) ||
          parseMaybeJson((requestBody as any)?.templates) ||
          parseMaybeJson((requestBody as any)?.standard?.positions) ||
          parseMaybeJson((requestBody as any)?.standard?.templates) ||
          {},
        widgets:
          parseMaybeJson((requestBody as any)?.widgets) ||
          parseMaybeJson((requestBody as any)?.standard?.widgets) ||
          [],
        trayGuideText:
          typeof (requestBody as any)?.trayGuideText === "string"
            ? (requestBody as any).trayGuideText
            : typeof (requestBody as any)?.standard?.trayGuideText === "string"
              ? (requestBody as any).standard.trayGuideText
              : "",
      };
      standard = pickSceneStandard(fallbackSource);
    }

    if (isEmptyStandard(standard)) {
      return res.status(400).json({
        ok: false,
        error: "Нет данных для сохранения общего стандарта",
        debug: {
          requestBodyType: typeof req.body,
          topLevelKeys: Object.keys(requestBody || {}),
          standardKeys: typeof (requestBody as any)?.standard === "object" && (requestBody as any)?.standard
            ? Object.keys((requestBody as any).standard)
            : [],
        },
      });
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
