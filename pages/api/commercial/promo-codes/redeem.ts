import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const auth = await requireUser(req, res, { requireEmail: true });
  if (!auth) return;

  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ ok: false, error: "Укажи промокод" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: "Server env missing" });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await supabase.rpc("redeem_promo_code", { p_user_id: auth.user.id, p_code: code });
  if (error) return res.status(400).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, data });
}
