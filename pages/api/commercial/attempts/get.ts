import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const { user, supabaseAdmin } = authed;
  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ ok: false, error: "id is required" });

  const { data, error } = await supabaseAdmin
    .from("commercial_attempts")
    .select("id, test_slug, test_title, result, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return res.status(400).json({ ok: false, error: error.message });
  if (!data) return res.status(404).json({ ok: false, error: "Attempt not found" });

  return res.status(200).json({ ok: true, attempt: data });
}
