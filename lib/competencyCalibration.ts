import workbook from "@/data/competency-calibration/workbook.json";

type WorkbookRow = Record<string, string>;

type CalibrationSheet = {
  header: string[];
  rows: WorkbookRow[];
  target: string;
};

type WorkbookShape = {
  source: string;
  generated_at: string;
  sheets: Record<string, CalibrationSheet>;
};

const DATA = workbook as WorkbookShape;

const TEST_SLUG_TO_FAMILY: Record<string, string> = {
  "16pf-a": "16PF",
  "16pf-b": "16PF",
  emin: "ЭМИН",
  usk: "УСК",
  "situational-guidance": "Ситуативное руководство",
  "negotiation-style": "Переговорный стиль",
  belbin: "Belbin",
  "motivation-cards": "Мотивационные карты",
  "time-management": "Тайм-менеджмент",
  "learning-typology": "Типология обучения",
  "color-types": "Цветотипы",
};

function rows(sheetName: string) {
  return DATA.sheets[sheetName]?.rows || [];
}

function splitCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const REGISTRY_ROWS = rows("Registry");
const SIGNAL_ROWS = rows("Signals");
const FAMILY_ROWS = rows("Families");
const QA_BUNDLE_ROWS = rows("QA_Bundles");
const REGISTRY_MAP = new Map(REGISTRY_ROWS.map((row) => [row["ID"], row] as const));
const SIGNAL_MAP = new Map(SIGNAL_ROWS.map((row) => [row["ID"], row] as const));

export function getCalibrationWorkbookMeta() {
  return {
    source: DATA.source,
    generatedAt: DATA.generated_at,
  };
}

export function getCalibrationRegistryRow(id: string) {
  return REGISTRY_MAP.get(id) || null;
}

export function getCalibrationSignalRow(id: string) {
  return SIGNAL_MAP.get(id) || null;
}

export function getCalibrationFamilies() {
  return FAMILY_ROWS;
}

export function getCalibrationBundles() {
  return QA_BUNDLE_ROWS;
}

export function getCalibrationMinimumIndependentFamilies() {
  return 2;
}

export function getTestFamilyBySlug(slug: string | null | undefined) {
  return TEST_SLUG_TO_FAMILY[String(slug || "").trim()] || null;
}

export function getCompetencyCalibrationPacket(id: string) {
  const registry = getCalibrationRegistryRow(id);
  const signals = getCalibrationSignalRow(id);
  if (!registry && !signals) return null;

  return {
    id,
    competency: registry?.["Компетенция"] || signals?.["Компетенция"] || id,
    cluster: registry?.["Кластер"] || "",
    definition: registry?.["Определение"] || "",
    coreFamilies: splitCsv(registry?.["Core-семейства"] || ""),
    linkedGoals: splitCsv(registry?.["Linked goals"] || ""),
    evidenceStrength: registry?.["Сила доказательств"] || "",
    ruleOfThumb: registry?.["Rule of thumb"] || "",
    coreSignals: signals?.["Core-signals"] || "",
    supportiveSignals: signals?.["Supportive-signals"] || "",
    contraSignals: signals?.["Contra-signals"] || "",
    coreRoute: splitCsv(signals?.["Core route"] || ""),
    standardRoute: splitCsv(signals?.["Standard route"] || ""),
    changeRequest: signals?.["Что бы вы изменили"] || "",
    riskComment: signals?.["Причина / риск"] || "",
  };
}

export function buildCompetencyEvidencePromptPacket(
  id: string,
  relevantSlugs: readonly string[] = []
) {
  const packet = getCompetencyCalibrationPacket(id);
  if (!packet) return "Для этой компетенции пока нет отдельного calibration-packet из workbook.";

  const presentFamilies = Array.from(
    new Set(relevantSlugs.map((slug) => getTestFamilyBySlug(slug)).filter(Boolean))
  ) as string[];
  const coveredCoreFamilies = packet.coreFamilies.filter((family) => presentFamilies.includes(family));

  return [
    `Методический пакет: ${packet.competency}.`,
    packet.definition ? `Определение: ${packet.definition}` : "",
    packet.evidenceStrength ? `Сила доказательств: ${packet.evidenceStrength}.` : "",
    packet.ruleOfThumb ? `Rule of thumb: ${packet.ruleOfThumb}` : "",
    packet.coreFamilies.length ? `Core-семейства: ${packet.coreFamilies.join(", ")}.` : "",
    packet.linkedGoals.length ? `Linked goals: ${packet.linkedGoals.join(", ")}.` : "",
    packet.coreSignals ? `Core-signals: ${packet.coreSignals}` : "",
    packet.supportiveSignals ? `Supportive-signals: ${packet.supportiveSignals}` : "",
    packet.contraSignals ? `Contra-signals: ${packet.contraSignals}` : "",
    packet.coreRoute.length ? `Core route: ${packet.coreRoute.join(", ")}.` : "",
    packet.standardRoute.length ? `Standard route: ${packet.standardRoute.join(", ")}.` : "",
    presentFamilies.length
      ? `Покрытие по текущим пройденным тестам: ${presentFamilies.join(", ")}.`
      : "Покрытие по текущим пройденным тестам: пока нет релевантных семейств.",
    coveredCoreFamilies.length
      ? `Из core-семейств уже покрыты: ${coveredCoreFamilies.join(", ")}.`
      : "Из core-семейств пока ничего не покрыто.",
    `Методический минимум: не подтверждай компетенцию жёстко, если нет хотя бы ${getCalibrationMinimumIndependentFamilies()} независимых семейств данных.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function evaluateCompetencyCoverage(id: string, relevantSlugs: readonly string[] = []) {
  const packet = getCompetencyCalibrationPacket(id);
  const presentFamilies = Array.from(
    new Set(relevantSlugs.map((slug) => getTestFamilyBySlug(slug)).filter(Boolean))
  ) as string[];
  const independentFamilies = presentFamilies.length;
  const coreFamilies = packet?.coreFamilies || [];
  const coveredCoreFamilies = coreFamilies.filter((family) => presentFamilies.includes(family));
  return {
    independentFamilies,
    presentFamilies,
    coreFamilies,
    coveredCoreFamilies,
    hasMinimumCoverage: independentFamilies >= getCalibrationMinimumIndependentFamilies(),
  };
}

export function buildCalibrationSupplementRows() {
  return REGISTRY_ROWS.map((registry) => {
    const id = registry["ID"];
    const packet = getCompetencyCalibrationPacket(id);
    const needsSignalsComment = !packet?.changeRequest && !packet?.riskComment;
    return {
      id,
      cluster: registry["Кластер"] || "",
      competency: registry["Компетенция"] || "",
      current_assets: [
        packet?.definition ? "definition" : "",
        packet?.coreFamilies.length ? "core_families" : "",
        packet?.ruleOfThumb ? "rule_of_thumb" : "",
        packet?.coreSignals ? "core_signals" : "",
        packet?.supportiveSignals ? "supportive_signals" : "",
        packet?.contraSignals ? "contra_signals" : "",
      ].filter(Boolean).join(", "),
      required_additions: [
        "machine-readable weights for core/supportive/contra",
        "explicit downgrade rules for contra-signals",
        "competency-specific high/medium/low thresholds",
        "false positive / false negative notes",
        "interview probes or observable behavioral markers",
      ].join("; "),
      where_to_write: [
        "Signals -> Что бы вы изменили",
        "Signals -> Причина / риск",
        "Calibration -> Предлагаемое изменение",
        "ChangeLog -> после утверждения",
      ].join(" | "),
      priority_note: needsSignalsComment
        ? "Сначала заполнить комментарии по рискам и изменениям в Signals."
        : "Сначала перевести сигналы в исполняемые rules/weights.",
    };
  });
}
