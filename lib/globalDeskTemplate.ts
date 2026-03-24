export const FOLDER_TEMPLATE_ID = "template:folder";
export const PROJECT_TEMPLATE_ID = "template:project";

export type DeskTemplatePosition = {
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  rotation?: number;
  tiltX?: number;
  tiltY?: number;
  clipTlx?: number;
  clipTly?: number;
  clipTrx?: number;
  clipTry?: number;
  clipBrx?: number;
  clipBry?: number;
  clipBlx?: number;
  clipBly?: number;
};

export type SceneWidgetTemplate = {
  id: string;
  kind?: string;
  text?: string;
  action?: string;
  tone?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  z: number;
};

export type GlobalSceneStandard = {
  positions: Record<string, DeskTemplatePosition>;
  widgets: SceneWidgetTemplate[];
  trayGuideText?: string;
};

export type GlobalDeskTemplates = Record<string, DeskTemplatePosition>;

const POSITION_KEYS: Array<keyof DeskTemplatePosition> = [
  "x",
  "y",
  "z",
  "width",
  "height",
  "rotation",
  "tiltX",
  "tiltY",
  "clipTlx",
  "clipTly",
  "clipTrx",
  "clipTry",
  "clipBrx",
  "clipBry",
  "clipBlx",
  "clipBly",
];

function sanitizeDeskTemplatePosition(value: any): DeskTemplatePosition | null {
  if (!value || typeof value !== "object") return null;
  const next: DeskTemplatePosition = {};
  for (const key of POSITION_KEYS) {
    const raw = (value as any)[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    next[key] = num;
  }
  return Object.keys(next).length ? next : null;
}

function sanitizeSceneWidget(value: any): SceneWidgetTemplate | null {
  if (!value || typeof value !== "object") return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) return null;
  const numericKeys = ["x", "y", "width", "height", "rotation", "fontSize", "z"] as const;
  const next: Partial<SceneWidgetTemplate> = { id };
  for (const key of numericKeys) {
    const raw = (value as any)[key];
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    (next as any)[key] = num;
  }
  if (typeof value.kind === "string" && value.kind.trim()) next.kind = value.kind.trim();
  if (typeof value.text === "string") next.text = value.text;
  if (typeof value.action === "string" && value.action.trim()) next.action = value.action.trim();
  if (typeof value.tone === "string" && value.tone.trim()) next.tone = value.tone.trim();
  return next as SceneWidgetTemplate;
}

function sanitizeSceneWidgets(value: any): SceneWidgetTemplate[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeSceneWidget(item)).filter(Boolean) as SceneWidgetTemplate[];
}

export function pickTemplatePositions(source?: Record<string, any> | null): GlobalDeskTemplates {
  const root = source && typeof source === "object" && source.positions && typeof source.positions === "object"
    ? source.positions
    : source;
  if (!root || typeof root !== "object") return {};
  const next: GlobalDeskTemplates = {};
  const folder = sanitizeDeskTemplatePosition((root as any)[FOLDER_TEMPLATE_ID]);
  const project = sanitizeDeskTemplatePosition((root as any)[PROJECT_TEMPLATE_ID]);
  if (folder) next[FOLDER_TEMPLATE_ID] = folder;
  if (project) next[PROJECT_TEMPLATE_ID] = project;
  return next;
}

export function pickSceneStandard(source?: Record<string, any> | null): GlobalSceneStandard {
  const raw = source && typeof source === "object" && source.standard && typeof source.standard === "object"
    ? source.standard
    : source || {};

  const positionsSource = raw && typeof raw === "object" && raw.positions && typeof raw.positions === "object"
    ? raw.positions
    : raw;

  const positions: Record<string, DeskTemplatePosition> = {};
  if (positionsSource && typeof positionsSource === "object") {
    for (const [key, value] of Object.entries(positionsSource)) {
      const sanitized = sanitizeDeskTemplatePosition(value);
      if (sanitized) positions[key] = sanitized;
    }
  }

  const widgets = sanitizeSceneWidgets((raw as any)?.widgets);
  const trayGuideText = typeof (raw as any)?.trayGuideText === "string" && (raw as any).trayGuideText.trim()
    ? (raw as any).trayGuideText.trim()
    : undefined;

  return { positions, widgets, trayGuideText };
}
