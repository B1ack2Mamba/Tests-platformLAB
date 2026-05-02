import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "exports", "ai-analysis-knowledge.md");

function readEnv() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return env;
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const end = endMarker ? text.indexOf(endMarker, start) : -1;
  return (end === -1 ? text.slice(start) : text.slice(start, end)).trim();
}

function extractConstArray(text, constName) {
  const startMarker = `export const ${constName} = [`;
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const tail = text.slice(start);
  const end = tail.indexOf("] as const;");
  if (end === -1) return "";
  return tail.slice(0, end + "] as const;".length).trim();
}

function mdCode(code, lang = "ts") {
  return `\`\`\`${lang}\n${String(code || "").trim()}\n\`\`\``;
}

function truncate(value, max = 9000) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

async function loadSupabaseData() {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { competencyPrompts: [], testInterpretationSlugs: [], source: "env-missing" };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: promptRows, error: promptError }, { data: interpretationRows, error: interpretationError }] =
    await Promise.all([
      supabase
        .from("commercial_competency_prompts")
        .select("competency_id, competency_name, competency_cluster, system_prompt, prompt_template, notes, sort_order, is_active")
        .order("sort_order", { ascending: true })
        .order("competency_id", { ascending: true }),
      supabase.from("test_interpretations").select("test_slug").order("test_slug", { ascending: true }),
    ]);

  if (promptError) throw promptError;
  if (interpretationError) throw interpretationError;

  return {
    source: "supabase",
    competencyPrompts: promptRows || [],
    testInterpretationSlugs: (interpretationRows || []).map((row) => row.test_slug),
  };
}

async function main() {
  const commercialEvaluation = readFile("lib/commercialEvaluation.ts");
  const competencyPromptsTs = readFile("lib/competencyPrompts.ts");
  const evaluationApi = readFile("pages/api/commercial/projects/evaluation.ts");
  const serverPrompts = readFile("lib/serverCompetencyPrompts.ts");
  const calibrationJson = JSON.parse(readFile("data/competency-calibration/completed-workbook.json"));

  const supabaseData = await loadSupabaseData();

  const sections = [];
  sections.push("# База AI-анализа результатов тестов");
  sections.push("");
  sections.push(`Сгенерировано: ${new Date().toISOString()}`);
  sections.push("");
  sections.push("Этот файл собирает в одном месте все основные prompt-ы и источники данных, которые участвуют в полном AI-анализе результатов тестов в проекте.");
  sections.push("");

  sections.push("## 1. Где запускается AI-анализ");
  sections.push("- API входа: `pages/api/commercial/projects/evaluation.ts`");
  sections.push("- Основная логика сборки: `lib/commercialEvaluation.ts`");
  sections.push("- Базовые competency prompts: `lib/competencyPrompts.ts`");
  sections.push("- Загрузка живых prompts из Supabase: `lib/serverCompetencyPrompts.ts`");
  sections.push("- Методическая книга компетенций: `data/competency-calibration/completed-workbook.json`");
  sections.push("");
  sections.push("### API-обвязка");
  sections.push(mdCode(extractBetween(evaluationApi, "export default async function handler", "}\n"), "ts"));
  sections.push("");

  sections.push("## 2. Главные prompt-ы общего AI-анализа");
  sections.push("### Общий summary prompt (`buildAiPlusPrompt`)");
  sections.push(mdCode(extractBetween(commercialEvaluation, "async function buildAiPlusPrompt", "async function buildAiPlusFollowupPrompt"), "ts"));
  sections.push("");
  sections.push("### Follow-up prompt для дополнительного запроса (`buildAiPlusFollowupPrompt`)");
  sections.push(mdCode(extractBetween(commercialEvaluation, "async function buildAiPlusFollowupPrompt", "async function buildPremiumInterpretation"), "ts"));
  sections.push("");
  sections.push("### Prompt для интерпретации одного теста (`buildPremiumPrompt`)");
  sections.push(mdCode(extractBetween(commercialEvaluation, "function buildPremiumPrompt", "async function buildAiPlusPrompt"), "ts"));
  sections.push("");
  sections.push("### Prompt для компетенции (`buildCompetencyAiDetail`)");
  sections.push(mdCode(extractBetween(commercialEvaluation, "async function buildCompetencyAiDetail", "function goalLabel"), "ts"));
  sections.push("");
  sections.push("### Prompt для индекса соответствия (`buildCorrespondenceIndex`)");
  sections.push(mdCode(extractBetween(commercialEvaluation, "async function buildCorrespondenceIndex", "function buildPortraitFallback"), "ts"));
  sections.push("");

  sections.push("## 3. Базовый competency prompt из кода");
  sections.push("### Placeholders");
  sections.push(mdCode(extractConstArray(competencyPromptsTs, "COMPETENCY_PROMPT_PLACEHOLDERS"), "ts"));
  sections.push("");
  sections.push("### System prompt и default template");
  sections.push(mdCode(extractBetween(competencyPromptsTs, "export const DEFAULT_COMPETENCY_SYSTEM_PROMPT", "export function buildDefaultCompetencyPromptRows"), "ts"));
  sections.push("");

  sections.push("## 4. Живые competency prompts из Supabase");
  sections.push(`Источник: ${supabaseData.source}`);
  sections.push(`Всего строк: ${supabaseData.competencyPrompts.length}`);
  sections.push("");

  for (const row of supabaseData.competencyPrompts) {
    sections.push(`### ${row.competency_id} — ${row.competency_name}`);
    sections.push(`- Кластер: ${row.competency_cluster}`);
    sections.push(`- Активен: ${row.is_active ? "да" : "нет"}`);
    sections.push(`- sort_order: ${row.sort_order}`);
    sections.push("");
    sections.push("#### system_prompt");
    sections.push(mdCode(row.system_prompt || "", "text"));
    sections.push("");
    sections.push("#### prompt_template");
    sections.push(mdCode(truncate(row.prompt_template || "", 14000), "text"));
    sections.push("");
    sections.push("#### notes");
    sections.push(mdCode(truncate(row.notes || "", 12000), "text"));
    sections.push("");
  }

  sections.push("## 5. Методическая база компетенций");
  sections.push(`Листы в completed workbook: ${Object.keys(calibrationJson.sheets || {}).join(", ")}`);
  sections.push("");
  sections.push("### Rules");
  sections.push(mdCode(JSON.stringify(calibrationJson.sheets?.Rules?.rows || [], null, 2), "json"));
  sections.push("");
  sections.push("### Families");
  sections.push(mdCode(JSON.stringify(calibrationJson.sheets?.Families?.rows || [], null, 2), "json"));
  sections.push("");
  sections.push("### QA_Bundles");
  sections.push(mdCode(JSON.stringify(calibrationJson.sheets?.QA_Bundles?.rows || [], null, 2), "json"));
  sections.push("");

  sections.push("## 6. Источники интерпретации тестов");
  sections.push("### Live `test_interpretations` в Supabase");
  sections.push(mdCode(JSON.stringify(supabaseData.testInterpretationSlugs, null, 2), "json"));
  sections.push("");
  sections.push("### Кодовые fallback-источники");
  sections.push("- `lib/defaultTestInterpretations.ts`");
  sections.push("- `lib/colorTypesInterpretation.ts`");
  sections.push("- `lib/herzbergInterpretation.ts`");
  sections.push("- `lib/pf16InterpretationKeys.ts`");
  sections.push("");
  sections.push("### Как тестовые материалы подмешиваются в summary");
  sections.push(mdCode(extractBetween(commercialEvaluation, "function buildPromptDrivenTestNarratives", "function parseNamedBlocks"), "ts"));
  sections.push("");

  sections.push("## 7. Как живая база prompts подмешивается в runtime");
  sections.push(mdCode(extractBetween(serverPrompts, "function getAdminClient()", "export async function seedCompetencyPromptDefaults"), "ts"));
  sections.push("");

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, sections.join("\n"), "utf8");
  console.log(OUTPUT_PATH);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
