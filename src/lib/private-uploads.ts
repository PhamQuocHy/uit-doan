import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAGIC = Buffer.from('NVQSUP01');
const ROOT = path.resolve(process.cwd(), 'storage', 'uploads');

function key() {
  const value = process.env.UPLOADS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error('UPLOADS_ENCRYPTION_KEY must contain 64 hexadecimal characters');
  }
  return Buffer.from(value, 'hex');
}

export function uploadPath(value: string) {
  const relative = value.replace(/^\//, '');
  if (!relative.startsWith('uploads/')) throw new Error('Invalid upload path');
  const parts = relative.slice(8).split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\\:\x00-\x1f]/.test(p) || /[. ]$/.test(p))) {
    throw new Error('Invalid upload path');
  }
  return { relative, absolute: path.join(ROOT, ...parts) };
}

// Reject symlinks/junctions so even a managed path cannot escape private storage.
async function checkParents(absolute: string) {
  const base = process.cwd();
  let current = base;
  for (const part of path.relative(base, absolute).split(path.sep)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Upload symlinks are forbidden');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export function encryptUpload(data: Buffer, relative: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(relative));
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

export function decryptUpload(data: Buffer, relative: string) {
  if (data.length < 36 || !data.subarray(0, 8).equals(MAGIC)) throw new Error('Invalid encrypted upload');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(8, 20));
  decipher.setAAD(Buffer.from(relative));
  decipher.setAuthTag(data.subarray(20, 36));
  return Buffer.concat([decipher.update(data.subarray(36)), decipher.final()]);
}

export async function writePrivateUpload(value: string, data: Buffer) {
  const { relative, absolute } = uploadPath(value);
  const encrypted = encryptUpload(data, relative);
  await checkParents(absolute);
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  // Unique generated file names; never overwrite an existing encrypted file.
  await fs.writeFile(absolute, encrypted, { flag: 'wx', mode: 0o600 });
}

export async function readPrivateUpload(value: string) {
  const { relative, absolute } = uploadPath(value);
  await checkParents(absolute);
  return decryptUpload(await fs.readFile(absolute), relative);
}

export async function deletePrivateUpload(value: string) {
  const { absolute } = uploadPath(value);
  await checkParents(absolute);
  await fs.unlink(absolute);
}
