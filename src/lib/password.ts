import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const ALGO = "scrypt";
const KEYLEN = 64;

/** Băm mật khẩu: `scrypt$<salt-hex>$<hash-hex>` */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEYLEN).toString("hex");
  return `${ALGO}$${salt}$${derived}`;
}

export function isHashed(stored: string): boolean {
  return stored.startsWith(`${ALGO}$`);
}

/**
 * So khớp mật khẩu.
 * - stored dạng hash → kiểm tra scrypt + salt.
 * - stored dạng legacy (plaintext cũ trong DB) → so sánh timing-safe,
 *   route đăng nhập sẽ tự nâng cấp lên hash sau khi khớp.
 */
export function verifyPassword(plain: string, stored: string): boolean {
  if (isHashed(stored)) {
    const [, salt, hash] = stored.split("$");
    if (!salt || !hash) return false;
    const derived = scryptSync(plain, salt, KEYLEN).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(derived, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const a = createHash("sha256").update(plain).digest();
  const b = createHash("sha256").update(stored).digest();
  return timingSafeEqual(a, b);
}
