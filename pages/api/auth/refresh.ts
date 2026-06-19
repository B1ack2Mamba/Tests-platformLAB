import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { setNoStore } from "@/lib/apiHardening";
import { ensureRequestId } from "@/lib/apiObservability";

type Body = {
  refresh_token?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  setNoStore(res);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return res.status(500).json({
      ok: false,
      request_id: requestId,
      error: "Server env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    });
  }

  const body: Body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const refreshToken = String(body.refresh_token || "").trim();
  if (!refreshToken) {
    return res.status(400).json({ ok: false, request_id: requestId, error: "Missing refresh token" });
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      return res.status(401).json({ ok: false, request_id: requestId, error: error?.message || "Invalid refresh token" });
    }

    return res.status(200).json({ ok: true, request_id: requestId, session: data.session, user: data.user });
  } catch (error: any) {
    return res.status(502).json({ ok: false, request_id: requestId, error: error?.message || "Session refresh failed" });
  }
}
