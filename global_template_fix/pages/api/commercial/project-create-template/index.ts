import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

const TABLE_NAME = "commercial_global_settings";
const SETTING_KEY = "project_create_template";
const OWNER_EMAIL = "storyguild9@gmail.com";

type TemplateShape = {
  tabletX?: number;
  tabletY?: number;
  tabletScale?: number;
  pageX?: number;
  pageY?: number;
  pageScale?: number;
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeTemplate(value: unknown): Required<TemplateShape> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    tabletX: clamp(source.tabletX, -400, 400, 0),
    tabletY: clamp(source.tabletY, -400, 400, 0),
    tabletScale: clamp(source.tabletScale, 0.7, 1.45, 1),
    pageX: clamp(source.pageX, -260, 260, 0),
    pageY: clamp(source.pageY, -260, 260, 0),
    pageScale: clamp(source.pageScale, 0.72, 1.35, 1),
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
      if ((error as any)?.code === "42P01") {
        return res.status(200).json({ ok: true, template: normalizeTemplate({}) });
      }
      return res.status(400).json({ ok: false, error: error.message || "Не удалось загрузить шаблон страницы" });
    }

    return res.status(200).json({ ok: true, template: normalizeTemplate((data as any)?.setting_value?.template || (data as any)?.setting_value || {}) });
  }

  if (req.method === "POST") {
    if ((user.email || "").toLowerCase() !== OWNER_EMAIL) {
      return res.status(403).json({ ok: false, error: "Только владелец профиля может сохранять глобальный шаблон страницы" });
    }

    const template = normalizeTemplate((req.body as any)?.template || req.body || {});

    const { error } = await supabaseAdmin.from(TABLE_NAME).upsert(
      {
        setting_key: SETTING_KEY,
        setting_value: { template },
        updated_by: user.id,
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(500).json({ ok: false, error: "В базе ещё не создана таблица общих настроек. Примените SQL-файл supabase/commercial_global_scene_template.sql" });
      }
      return res.status(400).json({ ok: false, error: error.message || "Не удалось сохранить глобальный шаблон страницы" });
    }

    return res.status(200).json({ ok: true, template });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
