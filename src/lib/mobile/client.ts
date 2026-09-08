import type { CitizenData, VerificationResult } from "@/lib/mobile/types";

const STORAGE_KEY = "nvqs.mobile.session";

export type StoredMobileSession = {
  sessionId: string;
  connectionCode: string;
  sessionToken: string;
  expiresAt: string;
};

export function loadStoredSession(): StoredMobileSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMobileSession;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredMobileSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw last;
}

export async function connectWithCode(connectionCode: string) {
  const data = await withRetry(() =>
    fetch("/api/mobile/session/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionCode: connectionCode.trim().toUpperCase(),
        device: { platform: "ios" },
      }),
    }).then(parseJson),
  );

  const stored: StoredMobileSession = {
    sessionId: data.sessionId,
    connectionCode: data.connectionCode,
    sessionToken: data.sessionToken,
    expiresAt: data.expiresAt,
  };
  saveStoredSession(stored);
  return stored;
}

export async function fetchSessionStatus(stored: StoredMobileSession) {
  return withRetry(() =>
    fetch(`/api/mobile/session/status?sessionId=${encodeURIComponent(stored.sessionId)}`, {
      headers: { Authorization: `Bearer ${stored.sessionToken}` },
    }).then(parseJson),
  );
}

export async function requestScanId(stored: StoredMobileSession): Promise<string> {
  const data = await withRetry(() =>
    fetch("/api/mobile/scan-id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.sessionToken}`,
      },
      body: JSON.stringify({ sessionId: stored.sessionId }),
    }).then(parseJson),
  );
  return data.scanId as string;
}

export async function submitScanResult(args: {
  stored: StoredMobileSession;
  scanId: string;
  nfc: Partial<CitizenData>;
  ocr: Partial<CitizenData>;
  verification: VerificationResult;
}) {
  return withRetry(() =>
    fetch("/api/mobile/scan-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.stored.sessionToken}`,
      },
      body: JSON.stringify({
        sessionId: args.stored.sessionId,
        scanId: args.scanId,
        nfc: args.nfc,
        ocr: args.ocr,
        verification: args.verification,
        device: { platform: "ios" },
      }),
    }).then(parseJson),
  );
}

export async function ocrOnServer(
  stored: StoredMobileSession,
  imageBase64: string,
  side: "front" | "back",
) {
  return withRetry(() =>
    fetch("/api/mobile/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.sessionToken}`,
      },
      body: JSON.stringify({
        sessionId: stored.sessionId,
        imageBase64,
        side,
      }),
    }).then(parseJson),
  );
}

export async function disconnectSession(stored: StoredMobileSession) {
  try {
    await fetch("/api/mobile/session/disconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${stored.sessionToken}`,
      },
      body: JSON.stringify({ sessionId: stored.sessionId }),
    });
  } finally {
    clearStoredSession();
  }
}
