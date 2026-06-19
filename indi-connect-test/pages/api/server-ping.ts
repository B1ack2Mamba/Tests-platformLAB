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
  headers: {
    cf_ray: string | null;
    cf_colo: string | null;
    cf_colo_country: string | null;
    sb_project_ref: string | null;
    server: string | null;
    x_vercel_id: string | null;
  };
  error?: string;
};

const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AU: "Australia",
  BR: "Brazil",
  CA: "Canada",
  DE: "Germany",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  HK: "Hong Kong",
  IN: "India",
  JP: "Japan",
  NL: "Netherlands",
  PL: "Poland",
  RU: "Russia",
  SE: "Sweden",
  SG: "Singapore",
  US: "United States",
};

const VERCEL_REGION_COUNTRIES: Record<string, { city: string; country: string }> = {
  arn1: { city: "Stockholm", country: "Sweden" },
  bom1: { city: "Mumbai", country: "India" },
  cdg1: { city: "Paris", country: "France" },
  cle1: { city: "Cleveland", country: "United States" },
  dub1: { city: "Dublin", country: "Ireland" },
  fra1: { city: "Frankfurt", country: "Germany" },
  gru1: { city: "Sao Paulo", country: "Brazil" },
  hnd1: { city: "Tokyo", country: "Japan" },
  iad1: { city: "Washington, D.C.", country: "United States" },
  lhr1: { city: "London", country: "United Kingdom" },
  pdx1: { city: "Portland", country: "United States" },
  sfo1: { city: "San Francisco", country: "United States" },
  sin1: { city: "Singapore", country: "Singapore" },
  syd1: { city: "Sydney", country: "Australia" },
};

const CLOUDFLARE_COLO_COUNTRIES: Record<string, { city: string; country: string }> = {
  AMS: { city: "Amsterdam", country: "Netherlands" },
  ARN: { city: "Stockholm", country: "Sweden" },
  BOM: { city: "Mumbai", country: "India" },
  CDG: { city: "Paris", country: "France" },
  DME: { city: "Moscow", country: "Russia" },
  DXB: { city: "Dubai", country: "United Arab Emirates" },
  FRA: { city: "Frankfurt", country: "Germany" },
  HEL: { city: "Helsinki", country: "Finland" },
  HKG: { city: "Hong Kong", country: "Hong Kong" },
  IAD: { city: "Ashburn", country: "United States" },
  KIX: { city: "Osaka", country: "Japan" },
  LED: { city: "Saint Petersburg", country: "Russia" },
  LHR: { city: "London", country: "United Kingdom" },
  MAD: { city: "Madrid", country: "Spain" },
  NRT: { city: "Tokyo", country: "Japan" },
  SIN: { city: "Singapore", country: "Singapore" },
  SVO: { city: "Moscow", country: "Russia" },
  WAW: { city: "Warsaw", country: "Poland" },
};

function getHeaderValue(req: NextApiRequest, name: string) {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function parseCfColo(cfRay: string | null) {
  if (!cfRay) return null;
  const parts = cfRay.split("-");
  return parts.length > 1 ? parts[parts.length - 1] || null : null;
}

function getVercelRegionInfo(region: string | null) {
  if (!region) return null;
  return VERCEL_REGION_COUNTRIES[region] || { city: region, country: "Unknown" };
}

function getCfColoInfo(colo: string | null) {
  if (!colo) return null;
  return CLOUDFLARE_COLO_COUNTRIES[colo] || { city: colo, country: "Unknown" };
}

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
    const cfRay = response.headers.get("cf-ray");
    const cfColo = parseCfColo(cfRay);
    const cfInfo = getCfColoInfo(cfColo);
    return {
      name,
      url,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      bytes: text.length,
      headers: {
        cf_ray: cfRay,
        cf_colo: cfColo,
        cf_colo_country: cfInfo?.country || null,
        sb_project_ref: response.headers.get("sb-project-ref"),
        server: response.headers.get("server"),
        x_vercel_id: response.headers.get("x-vercel-id"),
      },
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
      headers: {
        cf_ray: null,
        cf_colo: null,
        cf_colo_country: null,
        sb_project_ref: null,
        server: null,
        x_vercel_id: null,
      },
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
  const vercelRegion = process.env.VERCEL_REGION || null;
  const visitorCountryCode = getHeaderValue(req, "x-vercel-ip-country");
  const visitorCity = getHeaderValue(req, "x-vercel-ip-city");
  const visitorRegion = getHeaderValue(req, "x-vercel-ip-country-region");
  const firstCfColo = checks.find((item) => item.headers.cf_colo)?.headers.cf_colo || null;
  const firstCfColoInfo = getCfColoInfo(firstCfColo);
  const vercelRegionInfo = getVercelRegionInfo(vercelRegion);

  return res.status(200).json({
    ok: checks.every((item) => item.ok),
    server_time: new Date().toISOString(),
    total_ms: Date.now() - started,
    supabase_ref: "npgrkyqtgdhzdsabkhxg",
    runtime: process.env.VERCEL_REGION ? "vercel" : "local",
    vercel_region: vercelRegion,
    route: {
      visitor: {
        country_code: visitorCountryCode,
        country: visitorCountryCode ? COUNTRY_NAMES[visitorCountryCode] || visitorCountryCode : null,
        region: visitorRegion,
        city: visitorCity,
        source: "Vercel request geolocation headers",
      },
      vercel: {
        region: vercelRegion,
        city: vercelRegionInfo?.city || null,
        country: vercelRegionInfo?.country || null,
        source: "VERCEL_REGION",
      },
      supabase_edge: {
        cf_colo: firstCfColo,
        city: firstCfColoInfo?.city || null,
        country: firstCfColoInfo?.country || null,
        source: "Supabase response cf-ray header",
      },
      supabase_project: {
        ref: "npgrkyqtgdhzdsabkhxg",
        region: "ap-south-1",
        city: "Mumbai",
        country: "India",
        source: "Supabase project region selected for Indi",
      },
    },
    checks,
  });
}
