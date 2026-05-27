import type { NextApiRequest, NextApiResponse } from "next";
import { isAdminEmail } from "@/lib/admin";
import { DASHBOARD_UPDATES_SETTING_KEY, DEFAULT_DASHBOARD_UPDATES, normalizeDashboardUpdates } from "@/lib/dashboardUpdates";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const authed = await requireUser(req, res, { requireEmail: true });
  if (!authed) return;

  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, error: "Недостаточно прав" });
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await authed.supabaseAdmin
        .from("commercial_global_settings")
        .select("setting_value, updated_at")
        .eq("setting_key", DASHBOARD_UPDATES_SETTING_KEY)
        .maybeSingle();

      if (error) {
        if ((error as any)?.code === "42P01") {
          return res.status(200).json({ ok: true, updates: DEFAULT_DASHBOARD_UPDATES, updated_at: null });
        }
        throw error;
      }

      return res.status(200).json({
        ok: true,
        updates: normalizeDashboardUpdates((data as any)?.setting_value || DEFAULT_DASHBOARD_UPDATES),
        updated_at: (data as any)?.updated_at || null,
      });
    }

    const updates = normalizeDashboardUpdates(req.body || {});
    const { data, error } = await authed.supabaseAdmin
      .from("commercial_global_settings")
      .upsert(
        {
          setting_key: DASHBOARD_UPDATES_SETTING_KEY,
          setting_value: updates,
          updated_by: authed.user.id,
        },
        { onConflict: "setting_key" }
      )
      .select("setting_value, updated_at")
      .single();

    if (error) {
      if ((error as any)?.code === "42P01") {
        return res.status(400).json({ ok: false, error: "В базе ещё нет общих настроек. Примените SQL commercial_global_scene_template.sql" });
      }
      throw error;
    }

    return res.status(200).json({
      ok: true,
      updates: normalizeDashboardUpdates((data as any)?.setting_value || updates),
      updated_at: (data as any)?.updated_at || new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(400).json({ ok: false, error: error?.message || "Не удалось сохранить обновления" });
  }
}
