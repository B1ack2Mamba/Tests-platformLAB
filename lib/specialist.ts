/**
 * Specialist role.
 *
 * Server routes use SPECIALIST_EMAILS (comma-separated) OR admin allowlist fallback.
 * Client UI can use NEXT_PUBLIC_SPECIALIST_EMAILS to show links, but server is authoritative.
 */
import { ADMIN_EMAILS } from "@/lib/admin";

export function normalizeEmail(email: string | null | undefined) {
  return (email || "").trim().toLowerCase();
}

export function isSpecialistEmail(email: string | null | undefined) {
  const e = normalizeEmail(email);
  if (!e) return false;

  const serverList = (process.env.SPECIALIST_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (serverList.length && serverList.includes(e)) return true;

  const publicList = (process.env.NEXT_PUBLIC_SPECIALIST_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (publicList.length && publicList.includes(e)) return true;

  return ADMIN_EMAILS.includes(e);
}

export function isSpecialistUser(user: any): boolean {
  const role = user?.app_metadata?.role || user?.user_metadata?.role;
  if (role === "specialist") return true;
  return isSpecialistEmail(user?.email);
}
