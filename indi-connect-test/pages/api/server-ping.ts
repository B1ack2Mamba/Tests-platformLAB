import type { NextApiRequest, NextApiResponse } from "next";

const DEFAULT_SUPABASE_URL = "https://npgrkyqtgdhzdsabkhxg.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_cxQoCPqxNwDa1krM-C8jyA_TXEt21Sr";

type ProbeResult = {
  name: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  bytes: number;
  error?: string;
};

function getSupabaseConfig() {
  return {
    url: (process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, ""),
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY,
  };
}

async function probe(name: string, url: string, key: string): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    return {
      name,
      url,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      bytes: text.length,
      error: response.ok ? undefined : text.slice(0, 240),
    };
  } catch (error: any) {
    return {
      name,
      url,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      bytes: 0,
      error: error?.message || String(error),
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { url, key } = getSupabaseConfig();
  const started = Date.now();
  const checks = await Promise.all([
    probe("server -> Supabase auth settings", `${url}/auth/v1/settings`, key),
    probe("server -> Supabase tests REST", `${url}/rest/v1/tests?select=slug,title&limit=5`, key),
  ]);

  return res.status(200).json({
    ok: checks.every((item) => item.ok),
    server_time: new Date().toISOString(),
    total_ms: Date.now() - started,
    supabase_ref: "npgrkyqtgdhzdsabkhxg",
    runtime: process.env.VERCEL_REGION ? "vercel" : "local",
    vercel_region: process.env.VERCEL_REGION || null,
    checks,
  });
}
