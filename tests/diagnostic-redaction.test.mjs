import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyContentType, classifyMechanisms, isPublicClientScript,
  sanitiseEndpoint, sanitiseMethod, summariseEmbeddedJson, summariseJson,
} from '../tools/diagnostic-redaction.mjs';

test('diagnostic: URL secrets, query values, fragments and dynamic paths do not escape', () => {
  const result = sanitiseEndpoint('https://cdn.world-novel.fr/api/content/private-person%40example.org/eySecret?token=TOP_SECRET&page=4#password');
  assert.deepEqual(result, { origin: 'https://cdn.world-novel.fr', path: '/api/content/:value/:value' });
  for (const secret of ['private-person', 'example.org', 'eySecret', 'TOP_SECRET', 'password', 'page=4']) assert.ok(!JSON.stringify(result).includes(secret));
  assert.deepEqual(sanitiseEndpoint('https://world-novel.fr/oeuvres/shadow-slave'), { origin: 'https://world-novel.fr', path: '/oeuvres/:value' });
  assert.deepEqual(sanitiseEndpoint('https://cdn.world-novel.fr/volumes/12/chapters/3'), { origin: 'https://cdn.world-novel.fr', path: '/volumes/:number/chapters/:number' });
});

test('diagnostic: authentication, analytics, credentials and foreign origins are omitted', () => {
  for (const url of [
    'https://world-novel.fr/api/auth/callback?code=SECRET',
    'https://world-novel.fr/api/users/private-person',
    'https://world-novel.fr/api/%61uth/session',
    'https://world-novel.fr/analytics/collect',
    'https://world-novel.fr.evil.invalid/api/chapters',
    'http://world-novel.fr/api/chapters',
    'https://name:password@world-novel.fr/',
    'https://google-analytics.com/collect?user=SECRET',
    'not a URL',
  ]) assert.equal(sanitiseEndpoint(url), null);
});

test('diagnostic: mechanism detection reports names only', () => {
  assert.deepEqual(classifyMechanisms('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=SECRET'), ['Firebase Authentication']);
  assert.deepEqual(classifyMechanisms('https://firebaseappcheck.googleapis.com/v1/SECRET'), ['Firebase App Check']);
  assert.deepEqual(classifyMechanisms('https://discord.com/oauth2/authorize?client_id=SECRET'), ['Discord OAuth']);
  assert.deepEqual(classifyMechanisms('https://world-novel.fr/cdn-cgi/challenge-platform/private-session'), ['Cloudflare challenge']);
  assert.deepEqual(classifyMechanisms('https://world-novel.fr/oeuvres/shadow-slave'), []);
});

test('diagnostic: JSON summary never exports values or dynamic private keys', () => {
  const payload = {
    data: [{ id: 'PERSONAL_ID', title: 'CHAPTER_TEXT_SENTINEL', content: 'ACTUAL_CHAPTER_SENTINEL',
      token: 'TOKEN_SENTINEL', userId: 'USER_SENTINEL', email: 'EMAIL_SENTINEL',
      'private@example.org': { title: 'PRIVATE_KEY_VALUE_SENTINEL' }, volumeDisplayName: 'VOLUME_TITLE_SENTINEL' }],
    pagination: { page: 2, total: 3, cursor: 'CURSOR_SECRET' },
  };
  const result = summariseJson(payload);
  assert.deepEqual(result.keys, ['content', 'cursor', 'data', 'id', 'page', 'pagination', 'title', 'total', 'volumeDisplayName']);
  assert.equal(result.sensitiveKeyCount, 3);
  assert.equal(result.unlistedKeyCount, 1);
  const serialised = JSON.stringify(result);
  for (const value of ['PERSONAL_ID', 'SENTINEL', 'private@example.org', 'CURSOR_SECRET']) assert.ok(!serialised.includes(value));
  assert.ok(!serialised.includes('userId'));
});

test('diagnostic: structure traversal is bounded and malformed data harmless', () => {
  const array = Array.from({ length: 1000 }, () => ({ title: 'not exported' }));
  assert.equal(summariseJson(array).truncated, true);
  const circular = { title: 'safe' };
  circular.data = circular;
  assert.equal(summariseJson(circular).truncated, true);
  assert.equal(summariseJson(null).rootType, 'null');
});

test('diagnostic: only static JavaScript without query or credentials may be saved', () => {
  assert.equal(isPublicClientScript('https://world-novel.fr/_next/static/chunks/app/oeuvres/%5Bslug%5D/page-deadbeef.js'), true);
  for (const url of [
    'https://world-novel.fr/_next/static/chunks/a.js?token=SECRET',
    'https://world-novel.fr/_next/static/chunks/a.js#SECRET',
    'https://world-novel.fr/api/chapter.js',
    'https://cdn.world-novel.fr/_next/static/chunks/a.js',
    'https://world-novel.fr/_next/static/chunks/a.js.map',
    'https://user:pass@world-novel.fr/_next/static/a.js',
  ]) assert.equal(isPublicClientScript(url), false);
});

test('diagnostic: Next Flight JSON fragments are parsed without executing scripts', () => {
  const flight = 'a:' + JSON.stringify({ title: 'NOVEL_TITLE_SENTINEL', volumes: [{ volumeId: 'VOLUME_SENTINEL', chapters: [{ id: 'CHAPTER_ID_SENTINEL', title: 'CHAPTER_TITLE_SENTINEL' }] }] }) + '\n';
  const split = Math.floor(flight.length / 2);
  const scripts = [
    `self.__next_f.push(${JSON.stringify([1, flight.slice(0, split)])});`,
    `self.__next_f.push(${JSON.stringify([1, flight.slice(split)])});throw new Error('MUST_NOT_EXECUTE');`,
    '{"props":{"title":"DO_NOT_PRINT"}}',
  ];
  const result = summariseEmbeddedJson(scripts);
  assert.equal(result.nextFlightChunks, 2);
  assert.equal(result.jsonPayloads, 2);
  assert.deepEqual(result.keys, ['chapters', 'id', 'props', 'title', 'volumeId', 'volumes']);
  assert.ok(!JSON.stringify(result).includes('SENTINEL'));
  assert.ok(!JSON.stringify(result).includes('DO_NOT_PRINT'));
  assert.equal(summariseEmbeddedJson(['self.__next_f.push([1,window.secret]);']).malformedJsonCandidates, 1);
});

test('diagnostic: content types and methods are finite categories', () => {
  assert.equal(classifyContentType('application/json; charset=utf-8'), 'json');
  assert.equal(classifyContentType('application/problem+json'), 'json');
  assert.equal(classifyContentType('secret/private-data'), 'other');
  assert.equal(sanitiseMethod('GET'), 'GET');
  assert.equal(sanitiseMethod('PRIVATE_SECRET'), 'OTHER');
});
