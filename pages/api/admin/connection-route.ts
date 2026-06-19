import type { NextApiRequest, NextApiResponse } from "next";
import { ensureRequestId, logApiError } from "@/lib/apiObservability";
import { setNoStore } from "@/lib/apiHardening";
import { isAdminEmail } from "@/lib/admin";
import { requireUser } from "@/lib/serverAuth";

type Place = {
  city: string | null;
  country: string | null;
};

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
  };
  error?: string;
};

const COUNTRY_NAMES: Record<string, string> = {
  AE: "ОАЭ",
  AM: "Армения",
  AU: "Австралия",
  BR: "Бразилия",
  CA: "Канада",
  DE: "Германия",
  ES: "Испания",
  FI: "Финляндия",
  FR: "Франция",
  GB: "Великобритания",
  GE: "Грузия",
  HK: "Гонконг",
  IN: "Индия",
  JP: "Япония",
  KZ: "Казахстан",
  NL: "Нидерланды",
  PL: "Польша",
  RU: "Россия",
  SE: "Швеция",
  SG: "Сингапур",
  TH: "Таиланд",
  TR: "Турция",
  US: "США",
};

const VERCEL_REGION_PLACES: Record<string, Place> = {
  arn1: { city: "Стокгольм", country: "Швеция" },
  bom1: { city: "Мумбаи", country: "Индия" },
  cdg1: { city: "Париж", country: "Франция" },
  cle1: { city: "Кливленд", country: "США" },
  dub1: { city: "Дублин", country: "Ирландия" },
  fra1: { city: "Франкфурт", country: "Германия" },
  gru1: { city: "Сан-Паулу", country: "Бразилия" },
  hnd1: { city: "Токио", country: "Япония" },
  iad1: { city: "Вашингтон, D.C.", country: "США" },
  lhr1: { city: "Лондон", country: "Великобритания" },
  pdx1: { city: "Портленд", country: "США" },
  sfo1: { city: "Сан-Франциско", country: "США" },
  sin1: { city: "Сингапур", country: "Сингапур" },
  syd1: { city: "Сидней", country: "Австралия" },
};

const CLOUDFLARE_COLO_PLACES: Record<string, Place> = {
  AMS: { city: "Амстердам", country: "Нидерланды" },
  ARN: { city: "Стокгольм", country: "Швеция" },
  BOM: { city: "Мумбаи", country: "Индия" },
  CDG: { city: "Париж", country: "Франция" },
  DME: { city: "Москва", country: "Россия" },
  DXB: { city: "Дубай", country: "ОАЭ" },
  FRA: { city: "Франкфурт", country: "Германия" },
  HEL: { city: "Хельсинки", country: "Финляндия" },
  HKG: { city: "Гонконг", country: "Гонконг" },
  IAD: { city: "Ашберн", country: "США" },
  KIX: { city: "Осака", country: "Япония" },
  LED: { city: "Санкт-Петербург", country: "Россия" },
  LHR: { city: "Лондон", country: "Великобритания" },
  MAD: { city: "Мадрид", country: "Испания" },
  NRT: { city: "Токио", country: "Япония" },
  SIN: { city: "Сингапур", country: "Сингапур" },
  SVO: { city: "Москва", country: "Россия" },
  WAW: { city: "Варшава", country: "Польша" },
};

const SUPABASE_REGION_PLACES: Record<string, Place> = {
  "ap-south-1": { city: "Мумбаи", country: "Индия" },
  "ap-northeast-1": { city: "Токио", country: "Япония" },
  "ap-northeast-2": { city: "Сеул", country: "Южная Корея" },
  "ap-southeast-1": { city: "Сингапур", country: "Сингапур" },
  "ap-southeast-2": { city: "Сидней", country: "Австралия" },
  "ca-central-1": { city: "Монреаль", country: "Канада" },
  "eu-central-1": { city: "Франкфурт", country: "Германия" },
  "eu-west-1": { city: "Дублин", country: "Ирландия" },
  "eu-west-2": { city: "Лондон", country: "Великобритания" },
  "eu-west-3": { city: "Париж", country: "Франция" },
  "sa-east-1": { city: "Сан-Паулу", country: "Бразилия" },
  "us-east-1": { city: "Северная Вирджиния", country: "США" },
  "us-west-1": { city: "Северная Калифорния", country: "США" },
  "us-west-2": { city: "Орегон", country: "США" },
};

function getHeaderValue(req: NextApiRequest, name: string) {
  const value = req.headers[name.toLowerCase()];
  const raw = Array.isArray(value) ? value[0] || null : value || null;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseCfColo(cfRay: string | null) {
  if (!cfRay) return null;
  const parts = cfRay.split("-");
  return parts.length > 1 ? parts[parts.length - 1] || null : null;
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/+$/, ""),
    key,
    ref: new URL(url).hostname.split(".")[0] || null,
  };
}

function getProjectRegionFromEnv() {
  const explicitRegion = process.env.SUPABASE_PROJECT_REGION || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REGION || "";
  const poolerUrl = process.env.POSTGRES_POOLER_URL || process.env.SUPABASE_POOLER_URL || "";
  const poolerMatch = poolerUrl.match(/aws-\d+-([a-z0-9-]+)\.pooler\.supabase\.com/i);
  const region = String(explicitRegion || poolerMatch?.[1] || "").trim();
  const place = region ? SUPABASE_REGION_PLACES[region] || { city: region, country: null } : null;
  return {
    region: region || null,
    city: place?.city || null,
    country: place?.country || null,
    source: region
      ? explicitRegion
        ? "SUPABASE_PROJECT_REGION"
        : "POSTGRES_POOLER_URL"
      : "Задайте SUPABASE_PROJECT_REGION, чтобы видеть регион базы",
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
    const cfPlace = cfColo ? CLOUDFLARE_COLO_PLACES[cfColo] : null;

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
        cf_colo_country: cfPlace?.country || null,
        sb_project_ref: response.headers.get("sb-project-ref"),
        server: response.headers.get("server"),
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
      },
      error: error?.message || String(error),
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = ensureRequestId(req, res);
  setNoStore(res);

  if (req.method !== "GET") return res.status(405).json({ ok: false, request_id: requestId, error: "Method not allowed" });

  const authed = await requireUser(req, res, { requireEmail: true });
  if (!authed) return;
  if (!isAdminEmail(authed.user.email)) {
    return res.status(403).json({ ok: false, request_id: requestId, error: "Access denied" });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return res.status(500).json({
      ok: false,
      request_id: requestId,
      error: "Server env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    });
  }

  try {
    const started = Date.now();
    const checks = await Promise.all([
      probe("Vercel server -> Supabase auth settings", `${config.url}/auth/v1/settings`, config.key),
      probe("Vercel server -> Supabase tests REST", `${config.url}/rest/v1/tests?select=slug,title&limit=5`, config.key),
    ]);

    const visitorCountryCode = getHeaderValue(req, "x-vercel-ip-country");
    const visitorCity = getHeaderValue(req, "x-vercel-ip-city");
    const visitorRegion = getHeaderValue(req, "x-vercel-ip-country-region");
    const vercelRegion = process.env.VERCEL_REGION || null;
    const vercelPlace = vercelRegion ? VERCEL_REGION_PLACES[vercelRegion] : null;
    const firstCfColo = checks.find((item) => item.headers.cf_colo)?.headers.cf_colo || null;
    const cfPlace = firstCfColo ? CLOUDFLARE_COLO_PLACES[firstCfColo] : null;
    const projectRegion = getProjectRegionFromEnv();

    return res.status(200).json({
      ok: checks.every((item) => item.ok),
      request_id: requestId,
      checked_at: new Date().toISOString(),
      total_ms: Date.now() - started,
      runtime: process.env.VERCEL ? "vercel" : "local",
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
          city: vercelPlace?.city || null,
          country: vercelPlace?.country || null,
          source: "VERCEL_REGION",
        },
        supabase_edge: {
          cf_colo: firstCfColo,
          city: cfPlace?.city || null,
          country: cfPlace?.country || null,
          source: "Supabase response cf-ray header",
        },
        supabase_project: {
          ref: config.ref,
          ...projectRegion,
        },
      },
      checks,
    });
  } catch (error: any) {
    logApiError("admin.connection-route", requestId, error);
    return res.status(500).json({ ok: false, request_id: requestId, error: error?.message || "Не удалось собрать маршрут подключений" });
  }
}
