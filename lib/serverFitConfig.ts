import { createClient } from "@supabase/supabase-js";
import type { FitExpectationTag, FitRoleProfile } from "@/lib/fitProfiles";
import { FIT_EXPECTATION_TAGS, FIT_ROLE_PROFILES } from "@/lib/fitProfiles";

export type FitConfigRow = {
  id: string;
  kind: "role" | "expectation";
  label: string;
  short_label: string | null;
  description: string | null;
  keywords: string[] | null;
  weights: Record<string, number> | null;
  critical: string[] | null;
  sort_order: number | null;
  is_active: boolean | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeWeights(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Array<[string, number]> = Object.entries(value as Record<string, unknown>)
    .map(([key, raw]): [string, number] => [String(key), Math.max(0, Math.min(10, Number(raw) || 0))])
    .filter(([, weight]) => Number.isFinite(weight) && weight > 0);
  return Object.fromEntries(entries);
}

function rowToRole(row: FitConfigRow): FitRoleProfile {
  return {
    id: row.id,
    label: row.label,
    shortLabel: row.short_label || row.label,
    description: row.description || "",
    keywords: normalizeStringArray(row.keywords),
    weights: normalizeWeights(row.weights),
    critical: normalizeStringArray(row.critical),
  };
}

function rowToExpectation(row: FitConfigRow): FitExpectationTag {
  return {
    id: row.id,
    label: row.label,
    keywords: normalizeStringArray(row.keywords),
    weights: normalizeWeights(row.weights),
    critical: normalizeStringArray(row.critical),
  };
}

export async function loadFitConfigSnapshot() {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      profiles: FIT_ROLE_PROFILES,
      expectations: FIT_EXPECTATION_TAGS,
      source: "fallback" as const,
      tableReady: false,
    };
  }

  const { data, error } = await supabase
    .from("commercial_fit_profiles")
    .select("id, kind, label, short_label, description, keywords, weights, critical, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error || !Array.isArray(data) || !data.length) {
    return {
      profiles: FIT_ROLE_PROFILES,
      expectations: FIT_EXPECTATION_TAGS,
      source: "fallback" as const,
      tableReady: false,
    };
  }

  const rows = data as FitConfigRow[];
  const profiles = rows.filter((row) => row.kind === "role").map(rowToRole);
  const expectations = rows.filter((row) => row.kind === "expectation").map(rowToExpectation);

  return {
    profiles: profiles.length ? profiles : FIT_ROLE_PROFILES,
    expectations: expectations.length ? expectations : FIT_EXPECTATION_TAGS,
    source: "db" as const,
    tableReady: true,
  };
}

export async function listFitConfigRows() {
  const supabase = getAdminClient();
  if (!supabase) {
    return {
      rows: [
        ...FIT_ROLE_PROFILES.map((item, index) => ({
          id: item.id,
          kind: "role" as const,
          label: item.label,
          short_label: item.shortLabel,
          description: item.description,
          keywords: item.keywords,
          weights: item.weights,
          critical: item.critical,
          sort_order: index + 1,
          is_active: true,
        })),
        ...FIT_EXPECTATION_TAGS.map((item, index) => ({
          id: item.id,
          kind: "expectation" as const,
          label: item.label,
          short_label: null,
          description: "",
          keywords: item.keywords,
          weights: item.weights,
          critical: item.critical || [],
          sort_order: 100 + index + 1,
          is_active: true,
        })),
      ],
      source: "fallback" as const,
      tableReady: false,
    };
  }

  const { data, error } = await supabase
    .from("commercial_fit_profiles")
    .select("id, kind, label, short_label, description, keywords, weights, critical, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    return { rows: [], source: "error" as const, tableReady: false, error: error.message };
  }

  return { rows: (data || []) as FitConfigRow[], source: "db" as const, tableReady: true };
}

export async function upsertFitConfigRow(input: Partial<FitConfigRow> & { id: string; kind: "role" | "expectation"; updated_by?: string | null }) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error("Server env missing for fit config storage");

  const payload = {
    id: input.id,
    kind: input.kind,
    label: String(input.label || "").trim(),
    short_label: input.kind === "role" ? String(input.short_label || input.label || "").trim() || null : null,
    description: input.kind === "role" ? String(input.description || "").trim() || null : null,
    keywords: normalizeStringArray(input.keywords),
    weights: normalizeWeights(input.weights),
    critical: normalizeStringArray(input.critical),
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 100,
    is_active: input.is_active !== false,
    updated_by: input.updated_by || null,
  };

  if (!payload.label) throw new Error("Label is required");

  const { error } = await supabase.from("commercial_fit_profiles").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return payload;
}

export async function deleteFitConfigRow(id: string) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error("Server env missing for fit config storage");
  const { error } = await supabase.from("commercial_fit_profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function seedFitConfigDefaults(updatedBy?: string | null) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error("Server env missing for fit config storage");
  const rows = [
    ...FIT_ROLE_PROFILES.map((item, index) => ({
      id: item.id,
      kind: "role" as const,
      label: item.label,
      short_label: item.shortLabel,
      description: item.description,
      keywords: item.keywords,
      weights: item.weights,
      critical: item.critical,
      sort_order: index + 1,
      is_active: true,
      updated_by: updatedBy || null,
    })),
    ...FIT_EXPECTATION_TAGS.map((item, index) => ({
      id: item.id,
      kind: "expectation" as const,
      label: item.label,
      short_label: null,
      description: null,
      keywords: item.keywords,
      weights: item.weights,
      critical: item.critical || [],
      sort_order: 100 + index + 1,
      is_active: true,
      updated_by: updatedBy || null,
    })),
  ];
  const { error } = await supabase.from("commercial_fit_profiles").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows.length;
}
