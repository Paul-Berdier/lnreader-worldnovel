import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateBundle, syntheticFlight } from './helpers.mjs';

const code = await readFile(new URL('../dist/worldnovel-vnh.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../dist/plugins.min.json', import.meta.url), 'utf8'));
function pluginFor(body, status = 200) {
  return evaluateBundle(code, { '@libs/fetch': { fetchApi: async () => ({ status, ok: status === 200, headers: { get: () => null }, text: async () => body }) } }, true);
}
test('official LNReader exports.default wrapper; only injected dependencies', () => {
  const { result: plugin, imported } = pluginFor('');
  assert.ok(plugin);
  assert.deepEqual([...imported].sort(), ['@libs/fetch','@libs/storage','cheerio']);
  for (const key of ['id','name','version','site','lang']) assert.equal(plugin[key],manifest[0][key]);
  for (const method of ['popularNovels','parseNovel','parseChapter','searchNovels']) assert.equal(typeof plugin[method],'function');
  assert.equal(plugin.id, 'worldnovel-vnh');
  assert.equal(manifest.length,1);
});
test('bundle parses a synthetic full novel with real-shaped Flight data', async () => {
  const body = syntheticFlight({ oeuvre: { id:'exemple',title:'Exemple',volumes:[{volumeId:'Volume 1',volumeDisplayName:'Volume 1',chapters:[{id:'Chapitre 1 – Été',title:'Chapitre 1 – Été'}]}],totalChapters:1 } });
  const {result:p} = pluginFor(body);
  const novel = await p.parseNovel('/oeuvres/exemple');
  assert.equal(novel.chapters.length,1);
  assert.match(novel.chapters[0].path, /%C3%89t%C3%A9$/);
});
test('missing full search index is explicit; search never silently scans homepage', async () => {
  const {result:p} = pluginFor('');
  await assert.rejects(p.searchNovels('Été',1),/Index de recherche absent/);
  await assert.rejects(p.searchNovels('no result',2),/Index de recherche absent/);
});
test('bundle reads the official snapshot wrapper and searches the site index', async () => {
  const snapshot = { searchCache: JSON.stringify({ expiresAt: new Date(Date.now()+60_000).toISOString(), data:{novels:[{id:'ete',title:'Été',image:'https://cdn.world-novel.fr/example.webp'}]} }) };
  const {result:p} = evaluateBundle(code, {'@libs/storage':{localStorage:{get:()=>snapshot}}},true);
  assert.equal(p.webStorageUtilized,true);
  assert.equal((await p.searchNovels('ete',1))[0].name,'Été');
  assert.equal((await p.searchNovels('sans resultat',1)).length,0);
  assert.equal((await p.searchNovels('ete',2)).length,0);
});
test('chapter shell, preview, legal notice, login and captcha never succeed', async () => {
  for (const body of ['<main>Aperçu seulement</main>','<p>Tous droits réservés</p>','<form><input type="password"></form>','<title>Just a moment...</title>','<main>Navigation</main>']) {
    const {result:p} = pluginFor(body);
    await assert.rejects(p.parseChapter('/lecture/exemple/volumes/1/chapitres/1'));
  }
});
test('known missing browser capability fails before any chapter request', async () => {
  const {result:p} = evaluateBundle(code, {}, true);
  await assert.rejects(p.parseChapter('/lecture/exemple/volumes/1/chapitres/1'),/Firebase Auth et App Check/);
});
test('no unavailable external import can be hidden by the test runtime', () => {
  assert.throws(() => evaluateBundle('require("fs")'),/Unavailable runtime import/);
});
test('unsafe or incorrectly shaped URLs are rejected before fetching', () => {
  const {result:p} = pluginFor('');
  for (const path of ['https://example.com/','//example.com/a','/oeuvres/a?token=secret','/lecture/a']) assert.throws(() => p.resolveUrl(path),/chemin invalide/);
});
