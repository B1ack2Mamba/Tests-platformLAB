import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { assertAdmin } from "@/lib/serverAdmin";

function normalizeCode(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-ZА-ЯЁ0-9_-]/g, "")
    .slice(0, 40);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const admin = await assertAdmin(req, res);
  if (!admin) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: "Server env missing" });

  const body = req.body || {};
  const code = normalizeCode(String(body.code || ""));
  const amountRub = Math.trunc(Number(body.amount_rub || 0));
  const maxRedemptions = Math.trunc(Number(body.max_redemptions || 0));

  if (!code) return res.status(400).json({ ok: false, error: "Укажи код" });
  if (!Number.isFinite(amountRub) || amountRub <= 0) return res.status(400).json({ ok: false, error: "Сумма должна быть больше 0" });
  if (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0) return res.status(400).json({ ok: false, error: "Количество активаций должно быть больше 0" });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      code,
      amount_kopeks: amountRub * 100,
      max_redemptions: maxRedemptions,
      created_by: admin.user.id,
      is_active: true,
    })
    .select("id, code, amount_kopeks, max_redemptions, is_active, created_at")
    .single();

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true, promo: data });
}
