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
    registry?.["Определение"] ? "Есть определение компетенции" : "",
    registry?.["Core-семейства"] ? "Есть ключевые группы тестов" : "",
    registry?.["Linked goals"] ? "Есть связь с целями оценки" : "",
    registry?.["Rule of thumb"] ? "Есть краткое правило интерпретации" : "",
    signals?.["Core-signals"] ? "Есть основные подтверждающие признаки" : "",
    signals?.["Supportive-signals"] ? "Есть дополнительные подтверждающие признаки" : "",
    signals?.["Contra-signals"] ? "Есть признаки, которые снижают уверенность" : "",
    signals?.["Core route"] ? "Есть основной маршрут оценки" : "",
    signals?.["Standard route"] ? "Есть стандартный маршрут оценки" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function requiredAdditions(registry, signals) {
  const additions = [
    "зафиксировать численные веса для основных, дополнительных и сдерживающих признаков",
    "описать, когда сдерживающие признаки должны понижать уровень компетенции",
    "задать отдельные пороги низкого, среднего и высокого уровня именно для этой компетенции",
    "дописать, где возможны ложноположительные и ложноотрицательные выводы",
    "добавить наблюдаемые поведенческие маркеры и вопросы для интервью",
  ];
  if (!signals?.["Что бы вы изменили"]) additions.unshift("заполнить поле с предлагаемым улучшением по этой компетенции");
  if (!signals?.["Причина / риск"]) additions.unshift("заполнить поле с причиной, риском или ограничением вывода");
  if (!registry?.["Комментарий"]) additions.push("при необходимости добавить бизнес-комментарий или контекст применения");
  return additions.join("; ");
}

function whereToWrite(registry, signals) {
  const targets = [];
  if (!signals?.["Что бы вы изменили"]) targets.push("Лист Signals -> колонка «Что бы вы изменили»");
  if (!signals?.["Причина / риск"]) targets.push("Лист Signals -> колонка «Причина / риск»");
  targets.push("Лист Calibration -> колонка «Предлагаемое изменение»");
  targets.push("Лист ChangeLog -> после утверждения изменений");
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
        ? "Сначала дописать методические комментарии и риски"
        : "Сначала перевести признаки в чёткие исполняемые правила",
  };
});

const globalRows = [
  {
    area: "Правила расчёта",
    need: "Задать понятные веса для основных, дополнительных и сдерживающих признаков, а также правила понижения уровня при сильных ограничивающих сигналах.",
    write_to: "Листы Signals и Calibration",
  },
  {
    area: "Пороги уровней",
    need: "Для каждой компетенции отдельно определить, что считать низким, средним и высоким уровнем, и какой минимум данных нужен для уверенного вывода.",
    write_to: "Лист Registry, затем лист Calibration",
  },
  {
    area: "Достаточность данных",
    need: "Отметить, для каких компетенций вывод допустим только при 2 и более независимых группах тестов, и какие группы считаются обязательной опорой.",
    write_to: "Листы Registry и RouterRules",
  },
  {
    area: "Риски качества",
    need: "По каждой компетенции дописать, где система может ошибочно завысить или занизить уровень.",
    write_to: "Лист Signals -> колонка «Причина / риск»",
  },
  {
    area: "Интервью и наблюдение",
    need: "Добавить поведенческие маркеры и 2-4 проверочных вопроса интервью для подтверждения компетенции.",
    write_to: "Лист Signals или отдельная следующая версия workbook",
  },
  {
    area: "Фиксация решений",
    need: "Каждое утверждённое изменение переносить в ChangeLog с описанием эффекта и ответственным.",
    write_to: "Лист ChangeLog",
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
<title>Аудит методических дополнений по компетенциям</title>
<style>
body { font-family: Arial, sans-serif; }
table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
th, td { border: 1px solid #999; padding: 8px; vertical-align: top; text-align: left; }
th { background: #f0f0f0; }
</style>
</head>
<body>
<h1>Аудит методических дополнений по компетенциям</h1>
<table>
<tr><th>Параметр</th><th>Значение</th></tr>
<tr><td>Источник</td><td>${escapeHtml(workbook.source)}</td></tr>
<tr><td>Сгенерировано</td><td>${escapeHtml(workbook.generated_at)}</td></tr>
<tr><td>Компетенций</td><td>${rows.length}</td></tr>
<tr><td>Строк с методическими признаками</td><td>${signalRows.length}</td></tr>
</table>

<p>
Этот файл показывает, что уже есть по каждой компетенции и чего не хватает для более точного и устойчивого вывода.
Если в таблице встречаются слова «основные признаки», это значит самые сильные подтверждения компетенции.
«Дополнительные признаки» усиливают вывод, но сами по себе не должны решать исход.
«Сдерживающие признаки» показывают ограничения и должны понижать уверенность, если выражены сильно.
</p>

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
<th>Ключевые группы тестов</th>
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
