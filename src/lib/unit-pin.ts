import { consumeLimit, opaqueKey, securityEvent } from "@/lib/security/controls";
import { RowDataPacket } from "mysql2";
import { pingDb, queryRows, queryExecute } from "@/lib/db";
import {
  getUnitEditPin,
  setUnitEditPin,
  verifyUnitEditPin,
} from "@/lib/data";

/** Xác thực PIN từ MySQL; memory chỉ dành cho demo được bật rõ ràng. */
export async function verifyEditPinAsync(
  unitCode: string,
  pin: string,
): Promise<boolean> {
  const trimmed = pin.trim();
  if (!trimmed || !unitCode) return false;
  if (trimmed.length > 128) return false;
  if (consumeLimit(`pin:${opaqueKey(unitCode)}`, 10, 15 * 60 * 1000)) {
    securityEvent('pin_rate_limited', { status: 429 });
    return false;
  }
  if (!(await pingDb())) return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_AUTH === 'true' && verifyUnitEditPin(unitCode, trimmed);
  try {
    const rows = await queryRows<(RowDataPacket & { edit_pin: string | null })[]>(
      `SELECT edit_pin FROM hierarchy_units WHERE code = ? LIMIT 1`,
      [unitCode],
    );
    const dbPin = rows[0]?.edit_pin ? String(rows[0].edit_pin) : null;
    if (dbPin && dbPin === trimmed) {
      setUnitEditPin(unitCode, dbPin);
      return true;
    }
    return false;
  } catch (e) {
    console.error("verifyEditPinAsync:", e);
    return false;
  }
}

export async function persistUnitEditPin(
  unitCode: string,
  pin: string,
): Promise<boolean> {
  const trimmed = pin.trim();
  if (!unitCode || unitCode === "bo" || !trimmed) return false;
  setUnitEditPin(unitCode, trimmed);
  if (!(await pingDb())) return true;
  try {
    await queryExecute(
      `UPDATE hierarchy_units SET edit_pin = ? WHERE code = ?`,
      [trimmed, unitCode],
    );
    return true;
  } catch (e) {
    console.error("persistUnitEditPin:", e);
    return false;
  }
}

export async function loadUnitEditPin(unitCode: string): Promise<string | null> {
  const mem = getUnitEditPin(unitCode);
  if (mem) return mem;
  if (!(await pingDb())) return null;
  try {
    const rows = await queryRows<(RowDataPacket & { edit_pin: string | null })[]>(
      `SELECT edit_pin FROM hierarchy_units WHERE code = ? LIMIT 1`,
      [unitCode],
    );
    const dbPin = rows[0]?.edit_pin ? String(rows[0].edit_pin) : null;
    if (dbPin) setUnitEditPin(unitCode, dbPin);
    return dbPin;
  } catch {
    return null;
  }
}
