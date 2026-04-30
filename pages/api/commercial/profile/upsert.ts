import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { full_name, company_name } = (req.body || {}) as {
    full_name?: string;
    company_name?: string;
  };

  const { error } = await auth.supabaseAdmin.from("commercial_profiles").upsert(
    {
      id: auth.user.id,
      email: auth.user.email,
      full_name: full_name?.trim() || null,
      company_name: company_name?.trim() || null,
    },
    { onConflict: "id" }
  );

  if (error) return res.status(400).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}
