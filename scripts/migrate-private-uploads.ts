import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadEnv } from './load-env';
import { readPrivateUpload, writePrivateUpload } from '../src/lib/private-uploads';

async function main() {
  loadEnv();
  if (!process.env.UPLOADS_ENCRYPTION_KEY && process.argv.includes('--init-key')) {
    const key = randomBytes(32).toString('hex');
    await fs.appendFile('.env', `\nUPLOADS_ENCRYPTION_KEY=${key}\n`, { mode: 0o600 });
    process.env.UPLOADS_ENCRYPTION_KEY = key;
    console.log('Created encryption key in .env (value hidden). Back up this key securely.');
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.UPLOADS_ENCRYPTION_KEY || '')) throw new Error('Configure UPLOADS_ENCRYPTION_KEY first');
  const root = path.resolve('public/uploads');
  let count = 0;
  async function walk(dir: string) {
    // Also reject a symlink at the root; never follow links during migration.
    if ((await fs.lstat(dir)).isSymbolicLink()) throw new Error('Symlink in legacy uploads');
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const source = path.resolve(dir, entry.name);
      if (!source.startsWith(root + path.sep)) throw new Error('Invalid migration path');
      if (entry.isSymbolicLink()) throw new Error('Symlink in legacy uploads');
      if (entry.isDirectory()) { await walk(source); continue; }
      if (!entry.isFile()) throw new Error('Unsupported upload entry');
      const relative = `uploads/${path.relative(root, source).split(path.sep).join('/')}`;
      const data = await fs.readFile(source);
      try { await writePrivateUpload(relative, data); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      if (!(await readPrivateUpload(relative)).equals(data)) throw new Error('Migration verification failed; original retained');
      // Remove only this verified original, never recursively delete directories.
      await fs.unlink(source);
      count++;
    }
  }
  try { await walk(root); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  console.log(`Migrated and verified ${count} uploads. Original URLs are preserved.`);
}
main().catch(() => { console.error('Upload migration failed. Check key, paths and permissions; originals not yet verified are retained.'); process.exitCode = 1; });
