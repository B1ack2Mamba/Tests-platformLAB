import { createClient } from "@supabase/supabase-js";

export const EXECUTIVE_LAB_REF = "qundcddxzlyyzpthifia";

export type ExecutiveLabProject = {
  id: string;
  title: string;
  folderTitle: string;
  participants: number;
  progress: number;
  status: string;
  disposition: "active" | "archived" | "trash";
  date: string;
};

export type ExecutiveLabWorkspace = {
  id: string;
  name: string;
  ownerName: string;
  ownerRole: string;
  balanceKopeks: number;
  aiEfficiency: number;
  projects: ExecutiveLabProject[];
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана переменная ${name}`);
  return value;
}

export function isExecutiveLabEnabled() {
  return process.env.EXECUTIVE_LAB_ENABLED === "1";
}

export function createExecutiveLabAdminClient() {
  const url = required("EXECUTIVE_LAB_SUPABASE_URL");
  const secretKey = required("EXECUTIVE_LAB_SUPABASE_SECRET_KEY");

  if (!url.includes(EXECUTIVE_LAB_REF)) {
    throw new Error("Executive Lab подключён не к разрешённому тестовому Supabase");
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function formatExecutiveDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function executiveLabErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return fallback;
}
