import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/serverAuth";
import { DEFAULT_TEST_INTERPRETATIONS } from "@/lib/defaultTestInterpretations";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const authed = await requireUser(req, res);
  if (!authed) return;

  const attemptId = String(req.body?.attempt_id || "").trim();
  const testSlug = String(req.body?.test_slug || "").trim();
  if (!attemptId || !testSlug) {
    return res.status(400).json({ ok: false, error: "attempt_id and test_slug are required" });
  }

  const { data: attempt, error: attemptError } = await authed.supabaseAdmin
    .from("commercial_attempts")
    .select("id, test_slug")
    .eq("id", attemptId)
    .eq("user_id", authed.user.id)
    .maybeSingle();

  if (attemptError) return res.status(400).json({ ok: false, error: attemptError.message });
  if (!attempt) return res.status(404).json({ ok: false, error: "Attempt not found" });
  if (String((attempt as any).test_slug || "").trim() !== testSlug) {
    return res.status(400).json({ ok: false, error: "Attempt does not match test_slug" });
  }

  const { data: row, error: interpretationError } = await authed.supabaseAdmin
    .from("test_interpretations")
    .select("content")
    .eq("test_slug", testSlug)
    .maybeSingle();

  if (interpretationError) return res.status(400).json({ ok: false, error: interpretationError.message });
  const fallback = DEFAULT_TEST_INTERPRETATIONS[testSlug];
  if (!row && fallback === undefined) {
    return res.status(404).json({ ok: false, error: "Interpretation not found" });
  }

  return res.status(200).json({ ok: true, content: (row as any)?.content ?? fallback ?? null });
}
