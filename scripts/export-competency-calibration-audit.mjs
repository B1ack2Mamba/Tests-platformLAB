import fs from "fs";
import path from "path";

const workbook = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "competency-calibration", "workbook.json"), "utf8")
);

const registryRows = workbook.sheets?.Registry?.rows || [];
const signalRows = workbook.sheets?.Signals?.rows || [];
const signalMap = new Map(signalRows.map((row) => [row["ID"], row]));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function assetsLabel(registry, signals) {
  return [
    registry?.["Определение"] ? "definition" : "",
    registry?.["Core-семейства"] ? "core_families" : "",
    registry?.["Linked goals"] ? "linked_goals" : "",
    registry?.["Rule of thumb"] ? "rule_of_thumb" : "",
    signals?.["Core-signals"] ? "core_signals" : "",
    signals?.["Supportive-signals"] ? "supportive_signals" : "",
    signals?.["Contra-signals"] ? "contra_signals" : "",
    signals?.["Core route"] ? "core_route" : "",
    signals?.["Standard route"] ? "standard_route" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function requiredAdditions(registry, signals) {
  const additions = [
    "machine-readable weights for core/supportive/contra",
    "explicit downgrade rules for contra-signals",
    "competency-specific high/medium/low thresholds",
    "false positive / false negative notes",
    "observable behaviors / interview probes",
  ];
  if (!signals?.["Что бы вы изменили"]) additions.unshift("fill review suggestion in Signals");
  if (!signals?.["Причина / риск"]) additions.unshift("fill risk note in Signals");
  if (!registry?.["Комментарий"]) additions.push("add competency note / business context");
  return additions.join("; ");
}

function whereToWrite(registry, signals) {
  const targets = [];
  if (!signals?.["Что бы вы изменили"]) targets.push("Signals -> Что бы вы изменили");
  if (!signals?.["Причина / риск"]) targets.push("Signals -> Причина / риск");
  targets.push("Calibration -> Предлагаемое изменение");
  targets.push("ChangeLog -> после утверждения");
  return targets.join(" | ");
}

const rows = registryRows.map((registry) => {
  const signals = signalMap.get(registry["ID"]) || {};
  return {
    id: registry["ID"] || "",
    cluster: registry["Кластер"] || "",
    competency: registry["Компетенция"] || "",
    coreFamilies: splitCsv(registry["Core-семейства"] || "").join(", "),
    currentAssets: assetsLabel(registry, signals),
    additions: requiredAdditions(registry, signals),
    where: whereToWrite(registry, signals),
    priority:
      !signals["Что бы вы изменили"] || !signals["Причина / риск"]
        ? "Сначала закрыть review-поля в Signals"
        : "Сначала перевести сигналы в исполняемые rules",
  };
});

const globalRows = [
  {
    area: "Scoring",
    need: "Завести исполняемые веса core/supportive/contra и downgrade по contra-signals.",
    write_to: "Signals + Calibration",
  },
  {
    area: "Thresholds",
    need: "Для каждой компетенции зафиксировать условия High / Medium / Low и minimum evidence gate.",
    write_to: "Registry -> Rule of thumb, затем Calibration",
  },
  {
    area: "Coverage",
    need: "Отметить, где допустим verdict только при 2+ независимых семействах и какие семьи считать backbone.",
    write_to: "Registry + RouterRules",
  },
  {
    area: "Quality risks",
    need: "Дополнить false positive / false negative комментарии по каждой компетенции.",
    write_to: "Signals -> Причина / риск",
  },
  {
    area: "Interview layer",
    need: "Добавить поведенческие маркеры и 2-4 вопроса интервью на подтверждение компетенции.",
    write_to: "Signals / отдельный workbook next version",
  },
  {
    area: "Approval flow",
    need: "Каждое утверждённое изменение переносить в ChangeLog с эффектом и владельцем.",
    write_to: "ChangeLog",
  },
];

const summaryRows = rows
  .map(
    (row) =>
      `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.cluster)}</td><td>${escapeHtml(row.competency)}</td><td>${escapeHtml(row.coreFamilies)}</td><td>${escapeHtml(row.currentAssets)}</td><td>${escapeHtml(row.additions)}</td><td>${escapeHtml(row.where)}</td><td>${escapeHtml(row.priority)}</td></tr>`
  )
  .join("");

const globalTableRows = globalRows
  .map(
    (row) =>
      `<tr><td>${escapeHtml(row.area)}</td><td>${escapeHtml(row.need)}</td><td>${escapeHtml(row.write_to)}</td></tr>`
  )
  .join("");

const html = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>Competency Calibration Audit</title>
<style>
body { font-family: Arial, sans-serif; }
table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
th, td { border: 1px solid #999; padding: 8px; vertical-align: top; text-align: left; }
th { background: #f0f0f0; }
</style>
</head>
<body>
<h1>Аудит дополнений для competency calibration workbook</h1>
<table>
<tr><th>Параметр</th><th>Значение</th></tr>
<tr><td>Источник</td><td>${escapeHtml(workbook.source)}</td></tr>
<tr><td>Сгенерировано</td><td>${escapeHtml(workbook.generated_at)}</td></tr>
<tr><td>Компетенций</td><td>${rows.length}</td></tr>
<tr><td>Signals rows</td><td>${signalRows.length}</td></tr>
</table>

<h2>Глобально нужно дополнить</h2>
<table>
<tr><th>Зона</th><th>Что дописать</th><th>Куда писать</th></tr>
${globalTableRows}
</table>

<h2>По каждой компетенции</h2>
<table>
<tr>
<th>ID</th>
<th>Кластер</th>
<th>Компетенция</th>
<th>Core-семейства</th>
<th>Что уже есть</th>
<th>Что обязательно дополнить</th>
<th>Куда писать</th>
<th>Приоритет</th>
</tr>
${summaryRows}
</table>
</body>
</html>`;

const outDir = path.join(process.cwd(), "exports");
fs.mkdirSync(outDir, { recursive: true });
const outputPath = path.join(outDir, "competency-calibration-audit.xls");
fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath);
