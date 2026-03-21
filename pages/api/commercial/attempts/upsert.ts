import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const authed = await requireUser(req, res);
  if (!authed) return;

  const { user, supabaseAdmin } = authed;
  const { attempt_id, test_slug, test_title, result } = req.body || {};

  if (!attempt_id || !test_slug || !result) {
    return res.status(400).json({ ok: false, error: "attempt_id, test_slug and result are required" });
  }

  const payload = {
    id: String(attempt_id),
    user_id: user.id,
    test_slug: String(test_slug),
    test_title: String(test_title || test_slug),
    result,
    source: "local_runtime",
  };

  const { error } = await supabaseAdmin.from("commercial_attempts").upsert(payload, { onConflict: "id" });
  if (error) return res.status(400).json({ ok: false, error: error.message });

  return res.status(200).json({ ok: true, attempt_id: payload.id });
}
