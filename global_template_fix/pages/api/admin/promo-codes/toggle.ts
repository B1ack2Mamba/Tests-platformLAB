import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/serverAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const admin = await assertAdmin(req, res);
  if (!admin) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: "Server env missing" });

  const { id, is_active } = req.body || {};
  if (!id || typeof is_active !== 'boolean') return res.status(400).json({ ok: false, error: "id и is_active обязательны" });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("promo_codes").update({ is_active }).eq("id", id);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}
