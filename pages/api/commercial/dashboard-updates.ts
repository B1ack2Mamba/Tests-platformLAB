import type { NextApiRequest, NextApiResponse } from "next";
import { DASHBOARD_UPDATES_SETTING_KEY, DEFAULT_DASHBOARD_UPDATES, normalizeDashboardUpdates } from "@/lib/dashboardUpdates";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  try {
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
  } catch (error: any) {
    return res.status(200).json({
      ok: true,
      updates: DEFAULT_DASHBOARD_UPDATES,
      updated_at: null,
      warning: error?.message || "updates unavailable",
    });
  }
}
