function parseAdminEmails(raw: string | null | undefined) {
  return Array.from(
    new Set(
      String(raw || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

const fallbackAdmins = ["storyguild9@gmail.com", "jdanova_2002@mail.ru"];
const configuredAdmins = parseAdminEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL);

export const ADMIN_EMAILS = configuredAdmins.length ? configuredAdmins : fallbackAdmins;
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export function isAdminEmail(email?: string | null) {
  const normalized = (email ?? "").trim().toLowerCase();
  return Boolean(normalized) && ADMIN_EMAILS.includes(normalized);
}
