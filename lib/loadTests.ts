import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { AnyTest } from "@/lib/testTypes";
import { createSupabaseClient, getSupabaseEnv } from "@/lib/supabaseClient";
import { getTestDisplayTitle } from "@/lib/testTitles";

const TESTS_DIR = path.join(process.cwd(), "data", "tests");


function createSupabaseReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (typeof window === "undefined" && url && serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  return createSupabaseClient();
}

function normalizeDbRow(row: any): AnyTest | null {
  const raw = row?.json as any;
  const rowSlug = String(row?.slug || raw?.slug || "").trim();
  if (!rowSlug) return null;

  const source = raw && typeof raw === "object" ? raw : {};
  const { interpretation: _i, ...t } = source;
  const test = {
    ...t,
    slug: rowSlug,
    title: String(row?.title || t?.title || rowSlug),
    type: String(row?.type || t?.type || ""),
  } as AnyTest;

  const price = typeof row?.price_rub === "number" ? row.price_rub : test.pricing?.interpretation_rub ?? 0;
  return normalizeLoadedTest(test, price);
}


function normalizeLoadedTest(test: AnyTest, priceOverride?: number): AnyTest {
  const price = typeof priceOverride === "number" ? priceOverride : test.pricing?.interpretation_rub ?? 0;
  const details = test.pricing?.details_rub ?? 49;
  return {
    ...test,
    title: getTestDisplayTitle(test.slug, test.title),
    pricing: { ...test.pricing, interpretation_rub: price, details_rub: details },
    has_interpretation: price > 0,
  };
}

function mergeTests(local: AnyTest[], dbTests: AnyTest[]) {
  const map = new Map<string, AnyTest>();

  for (const t of local) {
    if (!t?.slug || t.slug === "16pf" || t.slug === "16pf-b") continue;
    map.set(t.slug, normalizeLoadedTest(t));
  }

  for (const t of dbTests) {
    if (!t?.slug || t.slug === "16pf" || t.slug === "16pf-b") continue;
    const slug = String(t.slug);
    const existing = map.get(slug);
    map.set(
      slug,
      normalizeLoadedTest({
        ...(existing || {} as AnyTest),
        ...t,
        title: getTestDisplayTitle(slug, t.title || existing?.title),
        pricing: { ...(existing?.pricing || {}), ...(t.pricing || {}) },
      } as AnyTest)
    );
  }

  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

function getAllTestsLocal(): AnyTest[] {
  if (!fs.existsSync(TESTS_DIR)) return [];
  const files = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith(".json"));
  const tests = files.map((file) => {
    const raw = fs.readFileSync(path.join(TESTS_DIR, file), "utf-8");
    const parsed = JSON.parse(raw) as any;
    const { interpretation: _i, ...t } = parsed;
    const test = t as AnyTest;
    return normalizeLoadedTest(test);
  });
  return tests
    .filter((t) => t.slug !== "16pf" && t.slug !== "16pf-b")
    .sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

function getTestBySlugLocal(slug: string): AnyTest | null {
  if (slug === "16pf" || slug === "16pf-b") return null;
  const filePath = path.join(TESTS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as any;
  const { interpretation: _i, ...t } = parsed;
  const test = t as AnyTest;
  return normalizeLoadedTest(test);
}

/**
 * Load all tests.
 *
 * Priority:
 * 1) Supabase table `public.tests` (column `json`) — production source of truth.
 * 2) Local folder `data/tests/*.json` — ONLY if Supabase env is not configured (dev-only).
 */
export async function getAllTests(): Promise<AnyTest[]> {
  const env = getSupabaseEnv();
  const local = getAllTestsLocal();

  if (!env) return local;

  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("tests")
      .select("slug, title, type, json, price_rub, is_published")
      .eq("is_published", true);

    if (error) throw error;

    const dbTests = (data ?? [])
      .map((r: any) => normalizeDbRow(r))
      .filter((t): t is AnyTest => Boolean(t))
      .filter((t) => t.slug !== "16pf" && t.slug !== "16pf-b") as AnyTest[];

    return mergeTests(local, dbTests);
  } catch (e) {
    console.warn("Supabase load failed:", e);
    return local;
  }
}

/**
 * Load one test by slug.
 */
export async function getTestBySlug(slug: string): Promise<AnyTest | null> {
  if (slug === "16pf" || slug === "16pf-b") return null;

  const env = getSupabaseEnv();
  const local = getTestBySlugLocal(slug);

  if (!env) return local;

  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("tests")
      .select("slug, title, type, json, price_rub, is_published")
      .eq("slug", slug)
      .single();

    if (error) return local;

    const test = normalizeDbRow(data as any);
    return test || local;
  } catch (e) {
    console.warn("Supabase load failed:", e);
    return local;
  }
}
