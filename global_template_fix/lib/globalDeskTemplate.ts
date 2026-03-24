export const FOLDER_TEMPLATE_ID = "template:folder";
export const PROJECT_TEMPLATE_ID = "template:project";

export type DeskTemplatePosition = {
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

export type GlobalDeskTemplates = Record<string, DeskTemplatePosition>;

const NUMERIC_KEYS: Array<keyof DeskTemplatePosition> = [
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
  for (const key of NUMERIC_KEYS) {
    const raw = (value as any)[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    next[key] = num;
  }
  return Object.keys(next).length ? next : null;
}

export function pickTemplatePositions(source?: Record<string, any> | null): GlobalDeskTemplates {
  if (!source || typeof source !== "object") return {};
  const next: GlobalDeskTemplates = {};
  const folder = sanitizeDeskTemplatePosition(source[FOLDER_TEMPLATE_ID]);
  const project = sanitizeDeskTemplatePosition(source[PROJECT_TEMPLATE_ID]);
  if (folder) next[FOLDER_TEMPLATE_ID] = folder;
  if (project) next[PROJECT_TEMPLATE_ID] = project;
  return next;
}
