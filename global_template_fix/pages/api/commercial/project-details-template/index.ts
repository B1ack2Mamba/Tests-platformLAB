import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

const TABLE_NAME = "commercial_global_settings";
const SETTING_KEY = "project_details_template";
const OWNER_EMAIL = "storyguild9@gmail.com";

type TemplateShape = {
  mainX?: number;
  mainY?: number;
  mainScale?: number;
  mainContentX?: number;
  mainContentY?: number;
  profileX?: number;
  profileY?: number;
  profileScale?: number;
  profileContentX?: number;
  profileContentY?: number;
  qrX?: number;
  qrY?: number;
  qrScale?: number;
  qrContentX?: number;
  qrContentY?: number;
  testsX?: number;
  testsY?: number;
  testsScale?: number;
  testsContentX?: number;
  testsContentY?: number;
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeTemplate(value: unknown): Required<TemplateShape> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    mainX: clamp(source.mainX, -300, 300, 8),
    mainY: clamp(source.mainY, 0, 300, 92),
    mainScale: clamp(source.mainScale, 0.6, 1.4, 0.686),
    mainContentX: clamp(source.mainContentX, -220, 220, 0),
    mainContentY: clamp(source.mainContentY, -220, 220, 0),
    profileX: clamp(source.profileX, 620, 1100, 855),
    profileY: clamp(source.profileY, 0, 500, 120),
    profileScale: clamp(source.profileScale, 0.3, 1.2, 0.39),
    profileContentX: clamp(source.profileContentX, -160, 160, 0),
    profileContentY: clamp(source.profileContentY, -160, 160, 0),
    qrX: clamp(source.qrX, 620, 1100, 880),
    qrY: clamp(source.qrY, 200, 1300, 360),
    qrScale: clamp(source.qrScale, 0.3, 1.2, 0.385),
    qrContentX: clamp(source.qrContentX, -180, 180, 0),
    qrContentY: clamp(source.qrContentY, -220, 220, 0),
    testsX: clamp(source.testsX, -80, 300, 24),
    testsY: clamp(source.testsY, 700, 1700, 1018),
    testsScale: clamp(source.testsScale, 0.6, 1.3, 1),
    testsContentX: clamp(source.testsContentX, -220, 220, 0),
    testsContentY: clamp(source.testsContentY, -160, 160, 0),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authed = await requireUser(req, res, { requireEmail: true });
  if (!authed) return;
  const { user, supabaseAdmin } = authed;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin.from(TABLE_NAME).select("setting_value").eq("setting_key", SETTING_KEY).maybeSingle();
    if (error) {
      if ((error as any)?.code === "42P01") return res.status(200).json({ ok: true, template: normalizeTemplate({}) });
      return res.status(400).json({ ok: false, error: error.message || "Не удалось загрузить шаблон страницы проекта" });
    }
    return res.status(200).json({ ok: true, template: normalizeTemplate((data as any)?.setting_value?.template || (data as any)?.setting_value || {}) });
  }

  if (req.method === "POST") {
    if ((user.email || "").toLowerCase() !== OWNER_EMAIL) return res.status(403).json({ ok: false, error: "Только владелец профиля может сохранять шаблон страницы проекта" });
    const template = normalizeTemplate((req.body as any)?.template || req.body || {});
    const { error } = await supabaseAdmin.from(TABLE_NAME).upsert({ setting_key: SETTING_KEY, setting_value: { template }, updated_by: user.id }, { onConflict: "setting_key" });
    if (error) {
      if ((error as any)?.code === "42P01") return res.status(500).json({ ok: false, error: "В базе ещё не создана таблица общих настроек. Примените SQL-файл supabase/commercial_global_scene_template.sql" });
      return res.status(400).json({ ok: false, error: error.message || "Не удалось сохранить шаблон страницы проекта" });
    }
    return res.status(200).json({ ok: true, template });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
