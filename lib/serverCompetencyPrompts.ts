import { createClient } from "@supabase/supabase-js";
import {
  buildDefaultCompetencyPromptRows,
  getCompetencyRouteOrNull,
  normalizePromptText,
  normalizePracticalExperience,
  type CompetencyPromptRow,
} from "@/lib/competencyPrompts";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function normalizeRow(input: Partial<CompetencyPromptRow> & { competency_id: string }): CompetencyPromptRow {
  const route = getCompetencyRouteOrNull(input.competency_id);
  const fallback = buildDefaultCompetencyPromptRows().find((item) => item.competency_id === input.competency_id) || null;
  return {
    competency_id: input.competency_id,
    competency_name: normalizePromptText(input.competency_name) || route?.name || fallback?.competency_name || input.competency_id,
    competency_cluster: normalizePromptText(input.competency_cluster) || route?.cluster || fallback?.competency_cluster || "Компетенции",
    system_prompt: normalizePromptText(input.system_prompt) || fallback?.system_prompt || "",
    prompt_template: normalizePromptText(input.prompt_template) || fallback?.prompt_template || "",
    notes: normalizePracticalExperience(input.notes) || fallback?.notes || null,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : fallback?.sort_order || 999,
    is_active: input.is_active !== false,
  };
}

function sortRows(rows: CompetencyPromptRow[]) {
  return [...rows].sort((a, b) => {
    const delta = a.sort_order - b.sort_order;
    if (delta !== 0) return delta;
    return a.competency_id.localeCompare(b.competency_id, "ru");
  });
}

export async function listCompetencyPromptRows() {
  const defaults = buildDefaultCompetencyPromptRows();
  const supabase = getAdminClient();
  if (!supabase) {
    return { rows: defaults, source: "fallback" as const, tableReady: false };
  }

  const { data, error } = await supabase
    .from("commercial_competency_prompts")
    .select("competency_id, competency_name, competency_cluster, system_prompt, prompt_template, notes, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("competency_id", { ascending: true });

  if (error) {
    return { rows: defaults, source: "error" as const, tableReady: false, error: error.message };
  }

  const byId = new Map(defaults.map((item) => [item.competency_id, item]));
  for (const raw of (data || []) as Array<any>) {
    byId.set(String(raw.competency_id), normalizeRow(raw));
  }

  return { rows: sortRows(Array.from(byId.values())), source: "db" as const, tableReady: true };
}

export async function loadCompetencyPromptMap(ids?: readonly string[] | null) {
  const defaults = buildDefaultCompetencyPromptRows();
  const filteredDefaults = ids?.length ? defaults.filter((item) => ids.includes(item.competency_id)) : defaults;
  const supabase = getAdminClient();
  if (!supabase) {
    return Object.fromEntries(filteredDefaults.map((item) => [item.competency_id, item]));
  }

  let query = supabase
    .from("commercial_competency_prompts")
    .select("competency_id, competency_name, competency_cluster, system_prompt, prompt_template, notes, sort_order, is_active")
    ;

  if (ids?.length) query = query.in("competency_id", [...ids]);

  const { data, error } = await query;
  if (error) {
    return Object.fromEntries(filteredDefaults.map((item) => [item.competency_id, item]));
  }

  const map = new Map(filteredDefaults.map((item) => [item.competency_id, item]));
  for (const raw of (data || []) as Array<any>) {
    const row = normalizeRow(raw);
    map.set(row.competency_id, row);
  }
  return Object.fromEntries(Array.from(map.entries()));
}

export async function upsertCompetencyPromptRow(input: Partial<CompetencyPromptRow> & { competency_id: string; updated_by?: string | null }) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error("Server env missing for competency prompt storage");
  const payload = {
    ...normalizeRow(input),
    updated_by: input.updated_by || null,
  };
  const { error } = await supabase.from("commercial_competency_prompts").upsert(payload, { onConflict: "competency_id" });
  if (error) throw error;
  return payload;
}

export async function seedCompetencyPromptDefaults(updatedBy?: string | null) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error("Server env missing for competency prompt storage");
  const rows = buildDefaultCompetencyPromptRows().map((item) => ({ ...item, updated_by: updatedBy || null }));
  const { error } = await supabase.from("commercial_competency_prompts").upsert(rows, { onConflict: "competency_id" });
  if (error) throw error;
  return rows.length;
}
