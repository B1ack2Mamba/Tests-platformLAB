import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

const TABLE_NAME = "commercial_global_settings";
const SETTING_KEY = "project_details_template";
const OWNER_EMAIL = "storyguild9@gmail.com";

type TemplateShape = {
  stripX?: number;
  stripY?: number;
  stripScale?: number;
  mainX?: number;
  mainY?: number;
  mainScale?: number;
  profileX?: number;
  profileY?: number;
  profileScale?: number;
  qrX?: number;
  qrY?: number;
  qrScale?: number;
  testsX?: number;
  testsY?: number;
  testsScale?: number;
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeTemplate(value: unknown): Required<TemplateShape> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    stripX: clamp(source.stripX, -400, 500, 188),
    stripY: clamp(source.stripY, -120, 240, 0),
    stripScale: clamp(source.stripScale, 0.6, 1.6, 1),
    mainX: clamp(source.mainX, -300, 300, 0),
    mainY: clamp(source.mainY, 0, 300, 88),
    mainScale: clamp(source.mainScale, 0.7, 1.4, 1),
    profileX: clamp(source.profileX, 620, 1100, 865),
    profileY: clamp(source.profileY, 0, 500, 92),
    profileScale: clamp(source.profileScale, 0.7, 1.3, 0.92),
    qrX: clamp(source.qrX, 620, 1100, 888),
    qrY: clamp(source.qrY, 400, 1300, 674),
    qrScale: clamp(source.qrScale, 0.7, 1.3, 0.94),
    testsX: clamp(source.testsX, -80, 300, 8),
    testsY: clamp(source.testsY, 950, 1700, 1228),
    testsScale: clamp(source.testsScale, 0.7, 1.25, 0.95),
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
