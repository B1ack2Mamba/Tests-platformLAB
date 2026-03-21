const DEFAULT_TEST_UNLIMITED_EMAILS = ["storyguild9@gmail.com"];

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function getTestUnlimitedEmails() {
  const raw = process.env.NEXT_PUBLIC_TEST_UNLIMITED_EMAILS || process.env.TEST_UNLIMITED_EMAILS || "";
  const fromEnv = raw
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_TEST_UNLIMITED_EMAILS, ...fromEnv]));
}

export function isTestUnlimitedEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return !!normalized && getTestUnlimitedEmails().includes(normalized);
}

export const TEST_UNLIMITED_BALANCE_KOPEKS = 999_999_900_00;
