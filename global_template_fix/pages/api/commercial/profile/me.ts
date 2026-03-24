import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const { user, supabaseAdmin } = authed;

  const [{ data: profile }, { count }, { data: uniqRows }] = await Promise.all([
    supabaseAdmin.from("commercial_profiles").select("id, email, full_name, company_name").eq("id", user.id).maybeSingle(),
    supabaseAdmin.from("commercial_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabaseAdmin.from("commercial_attempts").select("test_slug").eq("user_id", user.id),
  ]);

  return res.status(200).json({
    ok: true,
    profile: profile || {
      email: user.email,
      full_name: (user.user_metadata as any)?.full_name || null,
      company_name: (user.user_metadata as any)?.company_name || null,
    },
    stats: {
      attempts_count: count || 0,
      unique_tests_count: new Set((uniqRows || []).map((x: any) => String(x.test_slug))).size,
    },
  });
}
