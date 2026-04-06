import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

const TABLE_NAME = "commercial_global_settings";
const SETTING_KEY = "project_details_template";
const OWNER_EMAIL = "storyguild9@gmail.com";

type TemplateShape = {
  mainX?: number;
  mainY?: number;
  mainScale?: number;
  mainWidthScale?: number;
  mainHeightScale?: number;
  mainTextScale?: number;
  mainContentX?: number;
  mainContentY?: number;
  profileX?: number;
  profileY?: number;
  profileScale?: number;
  profileWidthScale?: number;
  profileHeightScale?: number;
  profileTextScale?: number;
  profileContentX?: number;
  profileContentY?: number;
  qrX?: number;
  qrY?: number;
  qrScale?: number;
  qrWidthScale?: number;
  qrHeightScale?: number;
  qrTextScale?: number;
  qrContentX?: number;
  qrContentY?: number;
  testsX?: number;
  testsY?: number;
  testsScale?: number;
  testsWidthScale?: number;
  testsHeightScale?: number;
  testsTextScale?: number;
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
    mainY: clamp(source.mainY, 0, 360, 92),
    mainScale: clamp(source.mainScale, 0.6, 1.4, 0.686),
    mainWidthScale: clamp(source.mainWidthScale, 0.72, 1.8, 1),
    mainHeightScale: clamp(source.mainHeightScale, 0.72, 2.4, 1),
    mainTextScale: clamp(source.mainTextScale, 0.75, 1.8, 1),
    mainContentX: clamp(source.mainContentX, -260, 260, 0),
    mainContentY: clamp(source.mainContentY, -260, 260, 0),
    profileX: clamp(source.profileX, 260, 1100, 612),
    profileY: clamp(source.profileY, 0, 700, 118),
    profileScale: clamp(source.profileScale, 0.3, 1.2, 0.39),
    profileWidthScale: clamp(source.profileWidthScale, 0.72, 1.8, 1),
    profileHeightScale: clamp(source.profileHeightScale, 0.72, 2.4, 1),
    profileTextScale: clamp(source.profileTextScale, 0.75, 1.8, 1),
    profileContentX: clamp(source.profileContentX, -220, 220, 0),
    profileContentY: clamp(source.profileContentY, -220, 220, 0),
    qrX: clamp(source.qrX, 240, 1100, 540),
    qrY: clamp(source.qrY, 120, 1500, 352),
    qrScale: clamp(source.qrScale, 0.3, 1.2, 0.385),
    qrWidthScale: clamp(source.qrWidthScale, 0.72, 1.8, 1),
    qrHeightScale: clamp(source.qrHeightScale, 0.72, 2.4, 1),
    qrTextScale: clamp(source.qrTextScale, 0.75, 1.8, 1),
    qrContentX: clamp(source.qrContentX, -220, 220, 0),
    qrContentY: clamp(source.qrContentY, -260, 260, 0),
    testsX: clamp(source.testsX, -80, 300, 24),
    testsY: clamp(source.testsY, 620, 2200, 1002),
    testsScale: clamp(source.testsScale, 0.6, 1.3, 0.96),
    testsWidthScale: clamp(source.testsWidthScale, 0.72, 1.8, 0.94),
    testsHeightScale: clamp(source.testsHeightScale, 0.72, 2.8, 1),
    testsTextScale: clamp(source.testsTextScale, 0.75, 1.8, 1),
    testsContentX: clamp(source.testsContentX, -260, 260, 0),
    testsContentY: clamp(source.testsContentY, -220, 220, 0),
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
