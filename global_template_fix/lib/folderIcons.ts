export const FOLDER_ICON_KEYS = [
  "folder",
  "briefcase",
  "target",
  "leaf",
  "spark",
  "diamond",
  "grid",
  "shield",
] as const;

export type FolderIconKey = (typeof FOLDER_ICON_KEYS)[number];

export type FolderIconDefinition = {
  key: FolderIconKey;
  label: string;
  symbol: string;
  tileClass: string;
  ringClass: string;
};

export const FOLDER_ICONS: FolderIconDefinition[] = [
  { key: "folder", label: "Папка", symbol: "📁", tileClass: "from-emerald-200 via-green-100 to-white text-emerald-950", ringClass: "ring-emerald-300" },
  { key: "briefcase", label: "Кейс", symbol: "💼", tileClass: "from-teal-200 via-emerald-100 to-white text-teal-950", ringClass: "ring-teal-300" },
  { key: "target", label: "Цель", symbol: "🎯", tileClass: "from-lime-200 via-emerald-100 to-white text-lime-950", ringClass: "ring-lime-300" },
  { key: "leaf", label: "Рост", symbol: "🌿", tileClass: "from-green-200 via-emerald-100 to-white text-green-950", ringClass: "ring-green-300" },
  { key: "spark", label: "Идея", symbol: "✨", tileClass: "from-emerald-200 via-teal-100 to-white text-emerald-950", ringClass: "ring-emerald-300" },
  { key: "diamond", label: "Фокус", symbol: "◆", tileClass: "from-slate-200 via-emerald-50 to-white text-slate-900", ringClass: "ring-slate-300" },
  { key: "grid", label: "Система", symbol: "▣", tileClass: "from-emerald-100 via-lime-50 to-white text-emerald-950", ringClass: "ring-emerald-300" },
  { key: "shield", label: "Опора", symbol: "🛡️", tileClass: "from-teal-100 via-emerald-50 to-white text-teal-950", ringClass: "ring-teal-300" },
];

export function isFolderIconKey(value: string): value is FolderIconKey {
  return (FOLDER_ICON_KEYS as readonly string[]).includes(value);
}

export function getFolderIcon(key?: string | null): FolderIconDefinition {
  return FOLDER_ICONS.find((item) => item.key === key) || FOLDER_ICONS[0];
}
