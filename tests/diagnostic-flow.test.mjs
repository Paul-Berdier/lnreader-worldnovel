import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPublicHtml, runAuditFlow } from '../tools/diagnostic-flow.mjs';
import { syntheticFlight } from './helpers.mjs';

test('diagnostic flow: public novel report contains counts only', () => {
  const source = { id: 'test-book', title: 'TITLE_SENTINEL', description: 'SUMMARY_SENTINEL', totalChapters: 1,
    volumes: [{ volumeId: 'Volume 1', chapters: [{ id: 'chapitre-1', title: 'CHAPTER_SENTINEL' }] }] };
  const result = inspectPublicHtml(syntheticFlight(source), 'novel');
  assert.deepEqual(result.summary, { flightRecordCount: 1, totalChapters: 1, parsedChapterCount: 1, volumeCount: 1 });
  assert.equal(result.firstChapterPath, '/lecture/test-book/volumes/Volume%201/chapitres/chapitre-1');
  assert.ok(!JSON.stringify(result.summary).includes('SENTINEL'));
  assert.ok(!JSON.stringify(result.summary).includes('test-book'));
});

test('diagnostic flow: home report only exposes counts; navigation stays separate', () => {
  const result = inspectPublicHtml(syntheticFlight({ label: 'not reported' }) + '<a href="/oeuvres/other"><h2>PRIVATE_TITLE_SENTINEL</h2></a>', 'home');
  assert.deepEqual(result.summary, { flightRecordCount: 1, selectionCount: 1 });
  assert.equal(result.secondWorkPath, '/oeuvres/other');
  assert.ok(!JSON.stringify(result.summary).includes('PRIVATE_TITLE_SENTINEL'));
});

test('diagnostic flow: auth redirect stops before any UI action or reading', async () => {
  let checkpoints = 0;
  const report = {};
  const page = { url: () => 'https://discord.com/oauth2/authorize?code=SECRET', locator: () => { throw Error('MUST_NOT_READ'); } };
  await runAuditFlow(page, report, async () => { checkpoints++; });
  assert.deepEqual(report.flow, [{ step: 'home', status: 'BLOCKED', reason: 'AUTHENTICATION_OR_EXTERNAL_REDIRECT' }]);
  assert.equal(checkpoints, 1);
  assert.ok(!JSON.stringify(report).includes('SECRET'));
});

test('diagnostic flow: visible challenge stops without clicks', async () => {
  const report = {};
  const page = {
    url: () => 'https://world-novel.fr/home',
    locator: selector => ({ count: async () => selector.includes('challenge') ? 1 : 0 }),
  };
  await runAuditFlow(page, report, async () => {});
  assert.equal(report.flow[0].status, 'BLOCKED');
  assert.equal(report.flow[0].reason, 'MANUAL_CHALLENGE_REQUIRED');
});
