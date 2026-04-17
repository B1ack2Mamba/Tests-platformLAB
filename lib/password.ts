import crypto from "crypto";

export type PasswordHash = string;

/**
 * Hash password using scrypt. Stored as: scrypt$<saltB64>$<hashB64>
 * (Not reversible; safe to store.)
 */
export function hashPassword(password: string): PasswordHash {
  const pwd = (password || "").trim();
  if (pwd.length < 4) throw new Error("Пароль слишком короткий (минимум 4 символа)");
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pwd, salt, 32);
  return `scrypt$${salt.toString("base64")}$${Buffer.from(key).toString("base64")}`;
}

export function verifyPassword(password: string, stored: PasswordHash): boolean {
  try {
    const parts = String(stored || "").split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;

    const salt = Buffer.from(parts[1], "base64");
    const hashBytes = Uint8Array.from(Buffer.from(parts[2], "base64"));
    const keyBytes = Uint8Array.from(crypto.scryptSync((password || "").trim(), salt, 32));

    if (keyBytes.length !== hashBytes.length) return false;
    return crypto.timingSafeEqual(keyBytes, hashBytes);
  } catch {
    return false;
  }
}
