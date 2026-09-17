import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { consumeLimit, InputError, isSameOrigin, readJson, validLogin, validatePdf, safePdfName, securityEvent } from './controls';
import { withApiGuard } from './api-guard';
import { hashPassword, verifyPassword } from '../password';
import { encrypt, decrypt } from '../auth';
import { assertSessionToken, hashSecret } from '../mobile/sessions';
import { proxy } from '../../proxy';

const json = (body: string) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

test('CSRF: reject foreign/null origins and cross-site requests; allow same-origin/native', () => {
  for (const origin of ['https://evil.example', 'null']) assert.equal(isSameOrigin(new Request('http://localhost/api/test', { method: 'POST', headers: { origin } })), false);
  assert.equal(isSameOrigin(new Request('http://localhost/api/test', { method: 'POST', headers: { origin: 'http://localhost' } })), true);
  assert.equal(isSameOrigin(json('{}')), true);
  assert.equal(isSameOrigin(new Request('http://localhost/api/test', { method: 'POST', headers: { Cookie: 'session=test' } })), false);
  assert.equal(isSameOrigin(new Request('http://localhost/api/test', { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' } })), false);
});
test('Rate limit: reject beyond budget, reset after window, isolate keys', () => {
  const key = crypto.randomUUID();
  assert.equal(consumeLimit(key, 2, 1000, 100), 0);
  assert.equal(consumeLimit(key, 2, 1000, 100), 0);
  assert.equal(consumeLimit(key, 2, 1000, 100), 1);
  assert.equal(consumeLimit(key + 'other', 2, 1000, 100), 0);
  assert.equal(consumeLimit(key, 2, 1000, 1100), 0);
});
test('JSON: invalid structure, malformed, streamed oversize and smaller second limit', async () => {
  for (const value of ['null', '[]', '{']) await assert.rejects(readJson(json(value)), InputError);
  await assert.rejects(readJson(json('{"text":"1234567890"}'), 8), { status: 413 });
  const request = json('{"ok":true}');
  assert.deepEqual(await readJson(request), { ok: true });
  await assert.rejects(readJson(request, 2), { status: 413 });
  assert.equal(validLogin({ username: { $ne: null }, password: 'x' }), false);
  assert.equal(validLogin({ username: 'test', password: 'x', functionalRole: 'admin' }), false);
});
test('API boundary rejects malformed JSON before invoking handler and redacts unexpected exceptions', async () => {
  let called = false;
  const handler = withApiGuard(async (request: Request) => { called = true; return Response.json(await request.json()); });
  assert.equal((await handler(json('{'))).status, 400);
  assert.equal(called, false);
  const valid = await handler(json('{"ok":true}'));
  assert.deepEqual(await valid.json(), { ok: true });
  assert.equal(valid.headers.get('cache-control'), 'no-store');
  const failure = await withApiGuard(async () => { throw new Error('DB_PASSWORD=secret SQL SELECT'); })();
  assert.equal(failure.status, 500);
  assert.doesNotMatch(await failure.text(), /DB_PASSWORD|SELECT|secret/);
});
test('PDF upload: reject renamed HTML, MIME mismatch, oversize and traversal', async () => {
  assert.ok(await validatePdf(new File(['<html>bad</html>'], 'fake.pdf', { type: 'application/pdf' })));
  assert.ok(await validatePdf(new File(['%PDF-1.7'], 'fake.pdf', { type: 'text/html' })));
  assert.ok(await validatePdf(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })));
  assert.equal(await validatePdf(new File(['%PDF-1.7'], 'test.pdf', { type: 'application/pdf' })), null);
  assert.equal(safePdfName('../../secret.pdf'), false);
  assert.equal(safePdfName('custom-123.pdf'), true);
});
test('Password hash uses random salt; malformed hash and long passwords fail safely', () => {
  const password = 'a-long-test-password';
  const hash = hashPassword(password);
  assert.notEqual(hash, hashPassword(password));
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
  assert.equal(verifyPassword(password, 'scrypt$xx$yy'), false);
  assert.equal(verifyPassword('x'.repeat(257), hash), false);
});
test('JWT requires strong secret, correct signature, issuer, audience and expiry', async () => {
  const old = process.env.JWT_SECRET;
  const payload = { userId: 'test', username: 'test', role: 'user' as const, name: 'Test', hierarchyLevel: 'xa', unitCode: 'test', functionalRole: 'y_te', expiresAt: new Date() };
  try {
    process.env.JWT_SECRET = 'ymsa-secret-key-2024-very-secure';
    await assert.rejects(encrypt(payload));
    process.env.JWT_SECRET = 'random-test-secret-'.repeat(4);
    const token = await encrypt(payload);
    assert.equal((await decrypt(token))?.userId, 'test');
    assert.equal(await decrypt(token + 'tampered'), null);
    const invalid = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer('wrong').setAudience('nvqs-web').setIssuedAt().setJti('x').setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET));
    assert.equal(await decrypt(invalid), null);
    const expired = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuer('nvqs').setAudience('nvqs-web').setIssuedAt().setJti('x').setExpirationTime(1).sign(new TextEncoder().encode(process.env.JWT_SECRET));
    assert.equal(await decrypt(expired), null);
  } finally { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; }
});
test('Mobile token: reject wrong token, expired and disconnected sessions', () => {
  const row = { id: 'x', created_by_user_id: 'u', connection_code: 'ABCDEF', session_token_hash: hashSecret('test-token'), status: 'CONNECTED', expires_at: new Date(Date.now() + 60000), created_at: new Date(), connected_at: null, last_error: null } as Parameters<typeof assertSessionToken>[0];
  assert.equal(assertSessionToken(row, 'test-token'), true);
  assert.equal(assertSessionToken(row, 'wrong'), false);
  assert.equal(assertSessionToken({ ...row, expires_at: new Date(0) }, 'test-token'), false);
  assert.equal(assertSessionToken({ ...row, status: 'DISCONNECTED' }, 'test-token'), false);
});
test('Proxy: protected API also rejects extension suffix and forged cookies', async () => {
  for (const path of ['/api/admin/citizens', '/api/admin/citizens/test.png', '/uploads/avatars/test.jpg']) {
    const res = await proxy(new NextRequest('http://localhost' + path, { headers: { Cookie: 'session=forged' } }));
    assert.equal(res.status, 401);
  }
  const csrf = await proxy(new NextRequest('http://localhost/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example' } }));
  assert.equal(csrf.status, 403);
});
test('Security logs are structured and escape injected newlines', () => {
  const original = console.warn;
  let line = '';
  try {
    console.warn = value => { line = String(value); };
    securityEvent('failed\nfake event', { status: 401, requestId: 'test' });
    assert.equal(line.split('\n').length, 1);
    assert.equal(JSON.parse(line).type, 'security');
    assert.equal(JSON.parse(line).status, 401);
  } finally { console.warn = original; }
});
