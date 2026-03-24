import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(500).json({ ok: false, error: "Server env missing" });
  }

  const { full_name, company_name, email } = (req.body || {}) as {
    full_name?: string;
    company_name?: string;
    email?: string;
  };

  if (!email || !String(email).trim()) {
    return res.status(400).json({ ok: false, error: "Email is required" });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const normalizedEmail = String(email).trim().toLowerCase();

  const usersResp = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = (usersResp.data?.users || []).find((x) => String(x.email || "").toLowerCase() === normalizedEmail);
  if (!user) return res.status(404).json({ ok: false, error: "User not found in auth.users yet" });

  const { error } = await supabase.from("commercial_profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: full_name?.trim() || null,
      company_name: company_name?.trim() || null,
    },
    { onConflict: "id" }
  );

  if (error) return res.status(400).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}
