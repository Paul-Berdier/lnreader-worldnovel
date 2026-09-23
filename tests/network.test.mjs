import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, syntheticFlight } from './helpers.mjs';

function network(status, body = 'ok', extra = {}) {
  let requests = 0;
  const mod = loadSource('src/network.ts', { '@libs/fetch': { fetchApi: async () => { requests++; return { status, ok: status === 200, text: async () => body, headers: { get: () => null }, ...extra }; } } });
  return { ...mod, requests: () => requests };
}
for (const [status, expected] of [[401,/session expirée/],[403,/403/],[404,/indisponible/],[500,/500/]]) {
  test(`HTTP ${status} remains an error`, async () => assert.rejects(network(status).getPage('https://world-novel.fr/home'), expected));
}
test('429 respects Retry-After without aggressive retries', async () => {
  const n = network(429, '', { headers: { get: () => '120' } });
  await assert.rejects(n.getPage('https://world-novel.fr/home'), /délai/);
  await assert.rejects(n.getPage('https://world-novel.fr/home'), /plus tard/);
  assert.equal(n.requests(), 1);
});
test('empty content, login, challenge and foreign redirects are rejected', async () => {
  for (const [body, pattern] of [['',/vide/],['<form><input type="password"></form>',/connexion requise/],['<title>Just a moment...</title>',/Cloudflare/]]) {
    await assert.rejects(network(200,body).getPage('https://world-novel.fr/home'),pattern);
  }
  await assert.rejects(network(200,'ok',{url:'https://discord.com/invite/example'}).getPage('https://world-novel.fr/home'),/redirige/);
});
test('external URL is never fetched', async () => {
  const n = network(200);
  await assert.rejects(n.getPage('https://example.com/'),/externe/);
  assert.equal(n.requests(),0);
});

test('optional login modal does not reject public Flight data', async () => {
  const body = '<main><a href="/oeuvres/exemple"><h2>Exemple synthétique</h2></a></main>' +
    '<dialog><form><input type="password"></form></dialog>' +
    syntheticFlight({ oeuvre: { id: 'exemple', title: 'Exemple synthétique', volumes: [] } });
  assert.equal(await network(200, body).getPage('https://world-novel.fr/oeuvres/exemple'), body);
});

test('Flight does not override a real HTTP authorization error or Cloudflare challenge', async () => {
  const body = syntheticFlight({ oeuvre: { id: 'exemple' } });
  await assert.rejects(network(401, body).getPage('https://world-novel.fr/home'), /session expirée/);
  await assert.rejects(network(200, '<title>Just a moment</title>' + body).getPage('https://world-novel.fr/home'), /Cloudflare/);
});
