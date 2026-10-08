import { getSession } from '@/lib/auth';
import { readPrivateUpload, uploadPath } from '@/lib/private-uploads';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' };

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    if (!await getSession()) return new Response('Unauthorized', { status: 401, headers });
    const params = await context.params;
    const value = `uploads/${params.path.join('/')}`;
    try { uploadPath(value); } catch { return new Response('Not found', { status: 404, headers }); }
    const data = await readPrivateUpload(value);
    const ext = path.extname(value).toLowerCase();
    const types: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf' };
    const type = types[ext] || 'application/octet-stream';
    return new Response(new Uint8Array(data), { headers: {
      ...headers, 'Content-Type': type, 'Content-Length': String(data.length),
      'Content-Disposition': `${types[ext] ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(path.basename(value)).replace(/'/g, '%27')}`,
      'Content-Security-Policy': "sandbox; default-src 'none'",
    } });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    return new Response(missing ? 'Not found' : 'Unable to retrieve file', { status: missing ? 404 : 500, headers });
  }
}
