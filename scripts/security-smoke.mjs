import assert from 'node:assert/strict';
const base = process.env.SECURITY_TEST_URL || 'http://127.0.0.1:5316';
async function check(name, path, options, expected) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', ...options });
  assert.equal(response.status, expected, `${name}: expected ${expected}, got ${response.status}`);
  console.log(`PASS ${name} (${expected})`);
  return response;
}
await check('Anonymous admin API', '/api/admin/citizens', {}, 401);
await check('Extension suffix cannot bypass authentication', '/api/admin/citizens/fake.png', {}, 401);
await check('Anonymous upload download', '/uploads/avatars/security-test.jpg', {}, 401);
await check('Cross-origin login rejected', '/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }, 403);
await check('Malformed JSON', '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, 400);
await check('Object username rejected', '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: { $ne: null }, password: 'test' }) }, 400);
await check('Login body limit', '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test', password: 'x'.repeat(5000) }) }, 413);
await check('Invalid CCCD', '/api/public/tra-cuu?cccd=123456789OR1&fullName=test', {}, 400);
const page = await check('Login page', '/login', {}, 200);
assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
assert.equal(page.headers.get('x-frame-options'), 'DENY');
assert.match(page.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
assert.equal(page.headers.get('x-powered-by'), null);
console.log('PASS security headers');
