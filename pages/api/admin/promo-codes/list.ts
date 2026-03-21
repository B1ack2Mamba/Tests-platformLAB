import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/serverAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await assertAdmin(req, res);
  if (!admin) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: "Server env missing" });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: codes, error } = await supabase
    .from("promo_codes")
    .select("id, code, amount_kopeks, max_redemptions, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ ok: false, error: error.message });

  const { data: redemptions, error: redemptionsError } = await supabase
    .from("promo_code_redemptions")
    .select("promo_code_id, created_at");
  if (redemptionsError) return res.status(500).json({ ok: false, error: redemptionsError.message });

  const usage = new Map<string, number>();
  for (const row of redemptions || []) usage.set((row as any).promo_code_id, (usage.get((row as any).promo_code_id) || 0) + 1);

  const promos = (codes || []).map((row: any) => ({
    ...row,
    redeemed_count: usage.get(row.id) || 0,
    remaining_count: Math.max((row.max_redemptions || 0) - (usage.get(row.id) || 0), 0),
  }));

  return res.status(200).json({ ok: true, promos });
}
