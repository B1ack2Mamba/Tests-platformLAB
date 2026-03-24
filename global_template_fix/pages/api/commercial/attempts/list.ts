import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { getTestDisplayTitle } from "@/lib/testTitles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const { user, supabaseAdmin } = authed;
  const { data, error } = await supabaseAdmin
    .from("commercial_attempts")
    .select("id, test_slug, test_title, result, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ ok: false, error: error.message });
  return res.status(200).json({
    ok: true,
    attempts: (data || []).map((item: any) => ({
      ...item,
      test_title: getTestDisplayTitle(item?.test_slug, item?.test_title),
    })),
  });
}
