import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptUpload, decryptUpload, uploadPath } from '../private-uploads';
import { portraitFileFromBase64 } from '../portrait-file';

test('Scanned portraits accept raw/data URL images and reject invalid payloads', async () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
  for (const value of [bytes.toString('base64'), `data:image/jpeg;base64,${bytes.toString('base64')}`]) {
    const file = portraitFileFromBase64(value);
    assert.equal(file.type, 'image/jpeg');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  }
  assert.throws(() => portraitFileFromBase64('data:text/html;base64,PGh0bWw+'));
  assert.throws(() => portraitFileFromBase64(Buffer.from('<html>').toString('base64')));
});

test('Encrypted uploads require the right key and path; tampering is rejected', () => {
  const previous = process.env.UPLOADS_ENCRYPTION_KEY;
  try {
    process.env.UPLOADS_ENCRYPTION_KEY = '12'.repeat(32);
    const plain = Buffer.from('private CCCD portrait');
    const name = 'uploads/avatars/test.jpg';
    const encrypted = encryptUpload(plain, name);
    assert.ok(!encrypted.includes(plain));
    assert.deepEqual(decryptUpload(encrypted, name), plain);
    assert.notDeepEqual(encryptUpload(plain, name), encrypted);
    assert.throws(() => decryptUpload(encrypted, 'uploads/avatars/other.jpg'));
    const modified = Buffer.from(encrypted); modified[modified.length - 1] ^= 1;
    assert.throws(() => decryptUpload(modified, name));
    process.env.UPLOADS_ENCRYPTION_KEY = '34'.repeat(32);
    assert.throws(() => decryptUpload(encrypted, name));
    delete process.env.UPLOADS_ENCRYPTION_KEY;
    assert.throws(() => encryptUpload(plain, name));
    assert.throws(() => decryptUpload(plain, name));
  } finally {
    if (previous === undefined) delete process.env.UPLOADS_ENCRYPTION_KEY;
    else process.env.UPLOADS_ENCRYPTION_KEY = previous;
  }
});

test('Upload paths reject traversal, absolute paths and Windows alternate streams', () => {
  for (const value of ['uploads/../.env', 'uploads/a/../../secret', 'uploads/a\\secret', 'uploads/C:/secret', 'uploads/a:secret', '/etc/passwd', 'uploads//a', 'uploads/a./x', 'uploads/a /x', 'uploads/a\0']) {
    assert.throws(() => uploadPath(value), value);
  }
  assert.equal(uploadPath('/uploads/avatars/test.jpg').relative, 'uploads/avatars/test.jpg');
});
