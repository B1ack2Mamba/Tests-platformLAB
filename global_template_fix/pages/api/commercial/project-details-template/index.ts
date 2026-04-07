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
  resultsX?: number;
  resultsY?: number;
  resultsScale?: number;
  resultsWidthScale?: number;
  resultsHeightScale?: number;
  resultsTextScale?: number;
  resultsContentX?: number;
  resultsContentY?: number;
  counterX?: number;
  counterY?: number;
  counterScale?: number;
  counterWidthScale?: number;
  counterHeightScale?: number;
  counterTextScale?: number;
  counterContentX?: number;
  counterContentY?: number;
};

const DEFAULT_TEMPLATE: Required<TemplateShape> = {
  mainX: 18,
  mainY: 88,
  mainScale: 0.62,
  mainWidthScale: 1,
  mainHeightScale: 1,
  mainTextScale: 1.08,
  mainContentX: 0,
  mainContentY: 0,
  profileX: 34,
  profileY: 182,
  profileScale: 1,
  profileWidthScale: 0.34,
  profileHeightScale: 0.88,
  profileTextScale: 0.96,
  profileContentX: 0,
  profileContentY: 0,
  qrX: 465,
  qrY: 72,
  qrScale: 1,
  qrWidthScale: 0.54,
  qrHeightScale: 0.64,
  qrTextScale: 0.82,
  qrContentX: 0,
  qrContentY: 0,
  testsX: 36,
  testsY: 565,
  testsScale: 1,
  testsWidthScale: 0.62,
  testsHeightScale: 1,
  testsTextScale: 0.9,
  testsContentX: 0,
  testsContentY: 0,
  resultsX: 255,
  resultsY: 236,
  resultsScale: 1,
  resultsWidthScale: 1,
  resultsHeightScale: 1,
  resultsTextScale: 1,
  resultsContentX: 0,
  resultsContentY: 0,
  counterX: 336,
  counterY: 180,
  counterScale: 0.9,
  counterWidthScale: 1,
  counterHeightScale: 1,
  counterTextScale: 0.94,
  counterContentX: 0,
  counterContentY: 0,
};

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeTemplate(value: unknown): Required<TemplateShape> {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    mainX: clamp(source.mainX, -400, 400, DEFAULT_TEMPLATE.mainX),
    mainY: clamp(source.mainY, -40, 420, DEFAULT_TEMPLATE.mainY),
    mainScale: clamp(source.mainScale, 0.45, 1.8, DEFAULT_TEMPLATE.mainScale),
    mainWidthScale: clamp(source.mainWidthScale, 0.5, 2.2, DEFAULT_TEMPLATE.mainWidthScale),
    mainHeightScale: clamp(source.mainHeightScale, 0.5, 2.6, DEFAULT_TEMPLATE.mainHeightScale),
    mainTextScale: clamp(source.mainTextScale, 0.65, 2, DEFAULT_TEMPLATE.mainTextScale),
    mainContentX: clamp(source.mainContentX, -320, 320, DEFAULT_TEMPLATE.mainContentX),
    mainContentY: clamp(source.mainContentY, -320, 320, DEFAULT_TEMPLATE.mainContentY),
    profileX: clamp(source.profileX, -120, 1200, DEFAULT_TEMPLATE.profileX),
    profileY: clamp(source.profileY, -40, 1200, DEFAULT_TEMPLATE.profileY),
    profileScale: clamp(source.profileScale, 0.45, 1.8, DEFAULT_TEMPLATE.profileScale),
    profileWidthScale: clamp(source.profileWidthScale, 0.2, 2.2, DEFAULT_TEMPLATE.profileWidthScale),
    profileHeightScale: clamp(source.profileHeightScale, 0.4, 2.6, DEFAULT_TEMPLATE.profileHeightScale),
    profileTextScale: clamp(source.profileTextScale, 0.65, 2, DEFAULT_TEMPLATE.profileTextScale),
    profileContentX: clamp(source.profileContentX, -320, 320, DEFAULT_TEMPLATE.profileContentX),
    profileContentY: clamp(source.profileContentY, -320, 320, DEFAULT_TEMPLATE.profileContentY),
    qrX: clamp(source.qrX, -120, 1200, DEFAULT_TEMPLATE.qrX),
    qrY: clamp(source.qrY, -40, 1600, DEFAULT_TEMPLATE.qrY),
    qrScale: clamp(source.qrScale, 0.45, 1.8, DEFAULT_TEMPLATE.qrScale),
    qrWidthScale: clamp(source.qrWidthScale, 0.2, 2.2, DEFAULT_TEMPLATE.qrWidthScale),
    qrHeightScale: clamp(source.qrHeightScale, 0.2, 2.6, DEFAULT_TEMPLATE.qrHeightScale),
    qrTextScale: clamp(source.qrTextScale, 0.65, 2, DEFAULT_TEMPLATE.qrTextScale),
    qrContentX: clamp(source.qrContentX, -320, 320, DEFAULT_TEMPLATE.qrContentX),
    qrContentY: clamp(source.qrContentY, -320, 320, DEFAULT_TEMPLATE.qrContentY),
    testsX: clamp(source.testsX, -160, 1200, DEFAULT_TEMPLATE.testsX),
    testsY: clamp(source.testsY, 0, 2400, DEFAULT_TEMPLATE.testsY),
    testsScale: clamp(source.testsScale, 0.45, 1.8, DEFAULT_TEMPLATE.testsScale),
    testsWidthScale: clamp(source.testsWidthScale, 0.2, 2.4, DEFAULT_TEMPLATE.testsWidthScale),
    testsHeightScale: clamp(source.testsHeightScale, 0.4, 3.2, DEFAULT_TEMPLATE.testsHeightScale),
    testsTextScale: clamp(source.testsTextScale, 0.65, 2, DEFAULT_TEMPLATE.testsTextScale),
    testsContentX: clamp(source.testsContentX, -320, 320, DEFAULT_TEMPLATE.testsContentX),
    testsContentY: clamp(source.testsContentY, -320, 320, DEFAULT_TEMPLATE.testsContentY),
    resultsX: clamp(source.resultsX, -160, 1200, DEFAULT_TEMPLATE.resultsX),
    resultsY: clamp(source.resultsY, -40, 1600, DEFAULT_TEMPLATE.resultsY),
    resultsScale: clamp(source.resultsScale, 0.45, 1.8, DEFAULT_TEMPLATE.resultsScale),
    resultsWidthScale: clamp(source.resultsWidthScale, 0.2, 2.4, DEFAULT_TEMPLATE.resultsWidthScale),
    resultsHeightScale: clamp(source.resultsHeightScale, 0.4, 2.8, DEFAULT_TEMPLATE.resultsHeightScale),
    resultsTextScale: clamp(source.resultsTextScale, 0.65, 2, DEFAULT_TEMPLATE.resultsTextScale),
    resultsContentX: clamp(source.resultsContentX, -320, 320, DEFAULT_TEMPLATE.resultsContentX),
    resultsContentY: clamp(source.resultsContentY, -320, 320, DEFAULT_TEMPLATE.resultsContentY),
    counterX: clamp(source.counterX, -160, 1200, DEFAULT_TEMPLATE.counterX),
    counterY: clamp(source.counterY, -40, 1600, DEFAULT_TEMPLATE.counterY),
    counterScale: clamp(source.counterScale, 0.45, 1.8, DEFAULT_TEMPLATE.counterScale),
    counterWidthScale: clamp(source.counterWidthScale, 0.4, 2.2, DEFAULT_TEMPLATE.counterWidthScale),
    counterHeightScale: clamp(source.counterHeightScale, 0.4, 2.2, DEFAULT_TEMPLATE.counterHeightScale),
    counterTextScale: clamp(source.counterTextScale, 0.65, 2, DEFAULT_TEMPLATE.counterTextScale),
    counterContentX: clamp(source.counterContentX, -320, 320, DEFAULT_TEMPLATE.counterContentX),
    counterContentY: clamp(source.counterContentY, -320, 320, DEFAULT_TEMPLATE.counterContentY),
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
