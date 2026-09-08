import { createHash, randomBytes, randomInt } from "crypto";
import type { RowDataPacket } from "mysql2";
import { queryExecute, queryRows } from "@/lib/db";
import type {
  MobileSession,
  MobileSessionStatus,
  ScanResultPayload,
} from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_TTL_MS = 10 * 60 * 1000;

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPersonalId(id: string): string {
  return createHash("sha256").update(`cccd:${id}`).digest("hex");
}

function generateConnectionCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function toIso(d: string | Date): string {
  if (d instanceof Date) return d.toISOString();
  const s = String(d);
  if (s.includes("T")) return new Date(s).toISOString();
  return new Date(s.replace(" ", "T") + "Z").toISOString();
}

type SessionRow = RowDataPacket & {
  id: string;
  connection_code: string;
  status: MobileSessionStatus;
  session_token_hash: string;
  last_error: string | null;
  created_at: string | Date;
  expires_at: string | Date;
  connected_at: string | Date | null;
};

function mapSession(row: SessionRow): MobileSession {
  return {
    sessionId: row.id,
    connectionCode: row.connection_code,
    status: row.status,
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at),
    connectedAt: row.connected_at ? toIso(row.connected_at) : null,
    lastError: row.last_error,
  };
}

export async function expireStaleSessions(): Promise<void> {
  await queryExecute(
    `UPDATE mobile_sessions
     SET status = 'EXPIRED'
     WHERE status IN ('WAITING','CONNECTED','SCANNING','PROCESSING')
       AND expires_at < UTC_TIMESTAMP()`,
  );
}

export async function createMobileSession(createdByUserId?: string): Promise<{
  session: MobileSession;
  sessionToken: string;
}> {
  await expireStaleSessions();

  const sessionId = crypto.randomUUID();
  const sessionToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  let connectionCode = generateConnectionCode();
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await queryExecute(
        `INSERT INTO mobile_sessions
          (id, connection_code, status, session_token_hash, created_by_user_id, expires_at)
         VALUES (?, ?, 'WAITING', ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
        [
          sessionId,
          connectionCode,
          hashSecret(sessionToken),
          createdByUserId ?? null,
        ],
      );
      return {
        session: {
          sessionId,
          connectionCode,
          status: "WAITING",
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          connectedAt: null,
          lastError: null,
        },
        sessionToken,
      };
    } catch {
      connectionCode = generateConnectionCode();
    }
  }
  throw new Error("Unable to allocate connection code");
}

export async function getSessionByCode(code: string): Promise<SessionRow | null> {
  await expireStaleSessions();
  const rows = await queryRows<SessionRow[]>(
    `SELECT * FROM mobile_sessions
     WHERE connection_code = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [code.trim().toUpperCase()],
  );
  return rows[0] ?? null;
}

export async function getSessionById(sessionId: string): Promise<SessionRow | null> {
  await expireStaleSessions();
  const rows = await queryRows<SessionRow[]>(
    `SELECT * FROM mobile_sessions WHERE id = ? LIMIT 1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export function publicSession(row: SessionRow): MobileSession {
  if (new Date(row.expires_at).getTime() < Date.now() && row.status !== "COMPLETED") {
    return { ...mapSession(row), status: "EXPIRED" };
  }
  return mapSession(row);
}

export async function connectSession(code: string, platform?: string): Promise<{
  session: MobileSession;
  sessionToken: string;
} | null> {
  const row = await getSessionByCode(code);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await queryExecute(
      `UPDATE mobile_sessions SET status = 'EXPIRED' WHERE id = ?`,
      [row.id],
    );
    return null;
  }
  if (row.status === "DISCONNECTED" || row.status === "EXPIRED" || row.status === "ERROR") {
    return null;
  }

  const sessionToken = generateToken();
  await queryExecute(
    `UPDATE mobile_sessions
     SET status = 'CONNECTED',
         session_token_hash = ?,
         device_platform = ?,
         connected_at = UTC_TIMESTAMP(),
         last_error = NULL
     WHERE id = ? AND status IN ('WAITING','CONNECTED')`,
    [hashSecret(sessionToken), platform ?? "ios", row.id],
  );

  const updated = await getSessionById(row.id);
  if (!updated) return null;
  return { session: publicSession(updated), sessionToken };
}

export function assertSessionToken(row: SessionRow, token: string | null): boolean {
  if (!token) return false;
  return row.session_token_hash === hashSecret(token);
}

export async function updateSessionStatus(
  sessionId: string,
  status: MobileSessionStatus,
  lastError?: string | null,
): Promise<void> {
  await queryExecute(
    `UPDATE mobile_sessions SET status = ?, last_error = ? WHERE id = ?`,
    [status, lastError ?? null, sessionId],
  );
}

export async function disconnectSession(sessionId: string): Promise<void> {
  await queryExecute(
    `UPDATE mobile_sessions SET status = 'DISCONNECTED' WHERE id = ? AND status NOT IN ('COMPLETED','EXPIRED')`,
    [sessionId],
  );
}

export async function saveScanResult(
  payload: ScanResultPayload,
): Promise<{ duplicate: boolean; citizenFound: boolean; citizen?: Record<string, string> }> {
  const existing = await queryRows<RowDataPacket[]>(
    `SELECT scan_id FROM mobile_scans WHERE scan_id = ? LIMIT 1`,
    [payload.scanId],
  );
  if (existing.length > 0) {
    return { duplicate: true, citizenFound: false };
  }

  const personalId = String(payload.nfc.personalId || payload.ocr.personalId || "").replace(/\D/g, "");
  let citizen: Record<string, string> | undefined;
  if (personalId) {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT id, full_name, cccd, date_of_birth, gender, permanent_address, current_address, military_status
       FROM citizens WHERE cccd = ? LIMIT 1`,
      [personalId],
    );
    const row = rows[0];
    if (row) {
      citizen = {
        id: String(row.id),
        fullName: String(row.full_name ?? ""),
        cccd: String(row.cccd ?? ""),
        dateOfBirth: String(row.date_of_birth ?? "").slice(0, 10),
        gender: String(row.gender ?? ""),
        address: String(row.permanent_address || row.current_address || ""),
        militaryStatus: String(row.military_status ?? ""),
      };
    }
  }

  await queryExecute(
    `INSERT INTO mobile_scans
      (scan_id, session_id, nfc_json, ocr_json, verification_json, device_json, citizen_id, personal_id_hash, matched)
     VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
    [
      payload.scanId,
      payload.sessionId,
      JSON.stringify(redactCitizenPayload(payload.nfc)),
      JSON.stringify(redactCitizenPayload(payload.ocr)),
      JSON.stringify(payload.verification),
      JSON.stringify(payload.device ?? { platform: "ios" }),
      citizen?.id ?? null,
      personalId ? hashPersonalId(personalId) : null,
      payload.verification.matched ? 1 : 0,
    ],
  );

  await updateSessionStatus(
    payload.sessionId,
    payload.verification.matched ? "COMPLETED" : "COMPLETED",
  );

  return { duplicate: false, citizenFound: Boolean(citizen), citizen };
}

function redactCitizenPayload(data: Record<string, unknown>) {
  const allowed = [
    "fullName",
    "personalId",
    "dateOfBirth",
    "gender",
    "nationality",
    "placeOfOrigin",
    "placeOfResidence",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (data[key] != null) out[key] = data[key];
  }
  return out;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

export async function getLatestScan(sessionId: string) {
  const rows = await queryRows<RowDataPacket[]>(
    `SELECT scan_id, nfc_json, ocr_json, verification_json, citizen_id, matched, created_at
     FROM mobile_scans WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
    [sessionId],
  );
  const row = rows[0];
  if (!row) return null;

  let citizen: Record<string, string> | null = null;
  if (row.citizen_id) {
    const found = await queryRows<RowDataPacket[]>(
      `SELECT id, full_name, cccd, date_of_birth, gender, permanent_address, current_address, military_status
       FROM citizens WHERE id = ? LIMIT 1`,
      [row.citizen_id],
    );
    const c = found[0];
    if (c) {
      citizen = {
        id: String(c.id),
        fullName: String(c.full_name ?? ""),
        cccd: String(c.cccd ?? ""),
        dateOfBirth: String(c.date_of_birth ?? "").slice(0, 10),
        address: String(c.permanent_address || c.current_address || ""),
        militaryStatus: String(c.military_status ?? ""),
      };
    }
  }

  return {
    scan_id: String(row.scan_id),
    nfc_json: asObject(row.nfc_json),
    ocr_json: asObject(row.ocr_json),
    verification_json: asObject(row.verification_json),
    citizen_id: row.citizen_id ? String(row.citizen_id) : null,
    matched: Boolean(row.matched),
    created_at: row.created_at,
    citizen,
  };
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}
