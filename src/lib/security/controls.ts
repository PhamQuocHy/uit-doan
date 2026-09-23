import { createHash } from 'node:crypto';

export class InputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const parsedBodies = new WeakMap<Request, { size: number; value: Record<string, unknown> }>();

export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const cached = parsedBodies.get(request);
  if (cached) {
    if (cached.size > maxBytes) throw new InputError('Dữ liệu quá lớn', 413);
    return cached.value;
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new InputError('Yêu cầu Content-Type application/json', 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Thiếu dữ liệu JSON');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new InputError('Dữ liệu quá lớn', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    parsedBodies.set(request, { size, value });
    return value;
  } catch { throw new InputError('Dữ liệu JSON không hợp lệ'); }
}

export function validLogin(body: Record<string, unknown>): boolean {
  return typeof body.username === 'string' && body.username.length >= 1 && body.username.length <= 100 &&
    typeof body.password === 'string' && body.password.length >= 1 && body.password.length <= 256 &&
    (body.unitCode === undefined || typeof body.unitCode === 'string' && body.unitCode.length <= 100) &&
    (body.functionalRole === undefined || ['tuyen_quan', 'nhan_quan', 'y_te'].includes(String(body.functionalRole)));
}

export function isSameOrigin(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  if (origin) {
    const target = new URL(request.url);
    // Next.js can construct request.url with the bind address (0.0.0.0).
    // Host preserves the authority the browser actually requested. Do not trust
    // forwarded headers supplied by clients to override this CSRF boundary.
    const host = request.headers.get('host');
    if (host) {
      try {
        const external = new URL(`${target.protocol}//${host}`);
        if (external.host !== host.toLowerCase() || external.username || external.password) return false;
        return origin === external.origin;
      } catch { return false; }
    }
    return origin === target.origin;
  }
  // Non-browser clients do not send Origin; cross-site browser requests still fail.
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') return false;
  return !request.headers.get('cookie') || site === 'same-origin';
}

const globalState = globalThis as typeof globalThis & { securityBuckets?: Map<string, { count: number; until: number }> };
const buckets = globalState.securityBuckets ??= new Map();
export function consumeLimit(key: string, limit: number, windowMs: number, now = Date.now()): number {
  for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= 10000) return Math.ceil(windowMs / 1000);
    bucket = { count: 0, until: now + windowMs }; buckets.set(key, bucket);
  }
  if (++bucket.count > limit) return Math.max(1, Math.ceil((bucket.until - now) / 1000));
  return 0;
}
export function opaqueKey(value: string): string { return createHash('sha256').update(value).digest('hex'); }

// Allowlisted fields only: never include credentials, request bodies, CCCD or URLs with query strings.
export function securityEvent(event: string, fields: { actor?: string; status?: number; requestId?: string } = {}) {
  console.warn(JSON.stringify({ type: 'security', event: event.slice(0, 80), time: new Date().toISOString(), ...fields }));
}

export async function validatePdf(file: File): Promise<string | null> {
  if (file.size === 0 || file.size > 10 * 1024 * 1024) return 'PDF phải có dung lượng từ 1 byte đến 10 MB';
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return 'Chỉ chấp nhận file PDF';
  const prefix = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('ascii');
  return prefix === '%PDF-' ? null : 'Nội dung không phải PDF';
}
export function safePdfName(name: string): boolean { return /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf$/i.test(name); }
