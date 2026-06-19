import type { NextApiRequest, NextApiResponse } from "next";

const DEFAULT_SUPABASE_URL = "https://npgrkyqtgdhzdsabkhxg.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_cxQoCPqxNwDa1krM-C8jyA_TXEt21Sr";

function getSupabaseConfig() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY,
  };
}

function parseCfColo(cfRay: string | null) {
  if (!cfRay) return null;
  return cfRay.split("-").pop() || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { url, key } = getSupabaseConfig();
  const started = Date.now();

  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    const cfRay = response.headers.get("cf-ray");
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 500);
    }

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      vercel_region: process.env.VERCEL_REGION || null,
      supabase_cf_ray: cfRay,
      supabase_cf_colo: parseCfColo(cfRay),
      supabase_project_ref: response.headers.get("sb-project-ref"),
      body,
    });
  } catch (error: any) {
    return res.status(200).json({
      ok: false,
      status: 0,
      ms: Date.now() - started,
      vercel_region: process.env.VERCEL_REGION || null,
      error: error?.message || String(error),
    });
  }
}
