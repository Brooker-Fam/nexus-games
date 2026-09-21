const assert = require('node:assert/strict');
const test = require('node:test');

// lib/auth-origins.js is an ES module, so load it with a dynamic import.
const load = () => import('../lib/auth-origins.js');

test('the live domain is trusted, so a sign-in POST is accepted instead of rejected', async () => {
  const { resolveTrustedOrigins } = await load();
  const origins = resolveTrustedOrigins({});
  // Better-auth rejects any sign-in whose Origin/callbackURL is not trusted.
  // The site serves both bare and www kittygames.space, so both must pass.
  assert.ok(origins.includes('https://www.kittygames.space'));
  assert.ok(origins.includes('https://kittygames.space'));
});

test('the previous domain stays trusted during the move', async () => {
  const { resolveTrustedOrigins } = await load();
  const origins = resolveTrustedOrigins({});
  assert.ok(origins.includes('https://www.nexusgames.space'));
  assert.ok(origins.includes('https://nexusgames.space'));
});

test('an explicit base URL is added to the trusted origins', async () => {
  const { resolveTrustedOrigins } = await load();
  const origins = resolveTrustedOrigins({ BETTER_AUTH_URL: 'https://preview.example.com' });
  assert.ok(origins.includes('https://preview.example.com'));
});

test('extra trusted origins can be supplied through the environment', async () => {
  const { resolveTrustedOrigins } = await load();
  const origins = resolveTrustedOrigins({ AUTH_TRUSTED_ORIGINS: 'http://localhost:3000, https://a.test' });
  assert.ok(origins.includes('http://localhost:3000'));
  assert.ok(origins.includes('https://a.test'));
});

test('the base URL prefers the environment and falls back to the live domain', async () => {
  const { resolveBaseURL } = await load();
  assert.equal(resolveBaseURL({ BETTER_AUTH_URL: 'https://set.example.com' }), 'https://set.example.com');
  assert.equal(resolveBaseURL({ VERCEL_URL: 'deploy.vercel.app' }), 'https://deploy.vercel.app');
  assert.equal(resolveBaseURL({}), 'https://www.kittygames.space');
});

test('the passkey relying-party id matches the live domain in production', async () => {
  const { resolveRpID } = await load();
  assert.equal(resolveRpID({ VERCEL_ENV: 'production' }), 'kittygames.space');
  assert.equal(resolveRpID({ VERCEL_ENV: 'preview' }), 'localhost');
  assert.equal(resolveRpID({}), 'localhost');
});
