import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { isGlobalTemplateOwnerEmail } from "@/lib/admin";

const TABLE_NAME = "commercial_global_settings";
const SETTING_KEY = "wallet_hermes_template";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTemplate(input: any) {
  const source = input && typeof input === "object" ? input : {};
  return {
    widthPercent: clamp(Number(source.widthPercent ?? 100), 70, 150),
    heightPx: clamp(Number(source.heightPx ?? 440), 280, 760),
    offsetX: clamp(Number(source.offsetX ?? 0), -220, 220),
    offsetY: clamp(Number(source.offsetY ?? 0), -220, 220),
    cardWidthPx: clamp(Number(source.cardWidthPx ?? 320), 240, 420),
    cardHeightPx: clamp(Number(source.cardHeightPx ?? 260), 200, 420),
    cardOffsetX: clamp(Number(source.cardOffsetX ?? 0), -220, 220),
    cardOffsetY: clamp(Number(source.cardOffsetY ?? 0), -220, 220),
  };
}

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
      if ((error as any)?.code === "42P01") return res.status(200).json({ ok: true, template: null });
      return res.status(400).json({ ok: false, error: error.message || "Не удалось загрузить шаблон окна Гермеса" });
    }

    return res.status(200).json({ ok: true, template: data?.setting_value ? normalizeTemplate((data as any).setting_value) : null });
  }

  if (req.method === "POST") {
    if (!isGlobalTemplateOwnerEmail(user.email)) {
      return res.status(403).json({ ok: false, error: "Только владелец шаблона может сохранить общий шаблон" });
    }
    const template = normalizeTemplate((req.body as any)?.template ?? req.body);
    const { error } = await supabaseAdmin.from(TABLE_NAME).upsert({
      setting_key: SETTING_KEY,
      setting_value: template,
      updated_by: user.id,
    }, { onConflict: "setting_key" });

    if (error) {
      if ((error as any)?.code === "42P01") return res.status(500).json({ ok: false, error: "В базе ещё не создана таблица общих настроек. Примените SQL-файл supabase/commercial_global_scene_template.sql" });
      return res.status(400).json({ ok: false, error: error.message || "Не удалось сохранить шаблон окна Гермеса" });
    }

    return res.status(200).json({ ok: true, template });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
