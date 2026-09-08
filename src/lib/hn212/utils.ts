/** Shared helpers for HN-212 WebSocket client */

export function asRec(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function eventNameOf(raw: unknown): string {
  const rec = asRec(raw);
  return String(rec?.EventName || rec?.eventName || "").toUpperCase();
}

/** Bỏ field ảnh lớn khi log / debug */
export function sanitizeHn212Raw(raw: unknown, depth = 0): unknown {
  if (depth > 8) return "[…]";
  if (Array.isArray(raw)) {
    return raw.slice(0, 20).map((x) => sanitizeHn212Raw(x, depth + 1));
  }
  const rec = asRec(raw);
  if (!rec) return raw;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (
      /framedata|facedata|imgdata|chipface|photo|image|portrait|sod|dscert/i.test(
        k,
      )
    ) {
      out[k] =
        typeof v === "string"
          ? `[binary ${v.length} chars]`
          : "[binary]";
      continue;
    }
    out[k] = sanitizeHn212Raw(v, depth + 1);
  }
  return out;
}
