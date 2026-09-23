import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers.mjs';

const { parseOeuvre, encodePathComponent } = await loadSource('src/novel.ts');

const chapter = (id, title = id, extra = {}) => ({ id, title, ...extra });
const volume = (volumeId, chapters, volumeDisplayName = volumeId) => ({ volumeId, volumeDisplayName, chapters });
const oeuvre = (volumes, extra = {}) => ({ id: 'roman-test', title: 'Roman de test', volumes, ...extra });
const plain = value => JSON.parse(JSON.stringify(value));

test('extracts available metadata and cleans only the synthetic summary', () => {
  const result = parseOeuvre(oeuvre([], {
    description: '<p>Une <em>héroïne</em> &amp; ses amis.</p><script>danger()</script><p>Suite.<br>Fin.</p>',
    image: '/cover.png', auteur: 'Une autrice', genre: 'Fantaisie, Aventure', statut: 'En cours', totalChapters: 0,
  }));
  assert.deepEqual(plain(result), {
    name: 'Roman de test', path: '/oeuvres/roman-test', chapters: [], cover: 'https://world-novel.fr/cover.png',
    summary: 'Une héroïne & ses amis.\n\nSuite.\nFin.', author: 'Une autrice', genres: 'Fantaisie, Aventure', status: 'Ongoing',
  });
  const missing = parseOeuvre(oeuvre([]));
  for (const key of ['cover', 'summary', 'author', 'genres', 'status']) assert.equal(key in missing, false);
});

test('encodes every raw path component exactly once, including reserved characters and Unicode', () => {
  const id = "L'œuvre / 100% ?#";
  const volumeId = 'Volume #2/é';
  const chapterId = "Chapitre 1 : l'été & 100%20";
  const result = parseOeuvre(oeuvre([volume(volumeId, [chapter(chapterId)])], { id }));
  assert.equal(result.path, '/oeuvres/L%27%C5%93uvre%20%2F%20100%25%20%3F%23');
  assert.equal(result.chapters[0].path, '/lecture/L%27%C5%93uvre%20%2F%20100%25%20%3F%23/volumes/Volume%20%232%2F%C3%A9/chapitres/Chapitre%201%20%3A%20l%27%C3%A9t%C3%A9%20%26%20100%2520');
  assert.equal(encodePathComponent("!'()*"), '%21%27%28%29%2A');
  assert.throws(() => encodePathComponent('\ud800'), /Unicode invalide/);
  assert.throws(() => encodePathComponent('..'), /chemin invalide/);
});

test('orders volumes and source chapter numbers numerically and deduplicates paths', () => {
  const first = chapter('a', 'Chapitre 10', { date: '10/04/2026' });
  const result = parseOeuvre(oeuvre([
    volume('v10', [chapter('b', 'Chapitre 100')], 'Volume 10'),
    volume('v2', [first, chapter('c', 'Chapitre 2,5'), chapter('d', 'Chapitre 2'), first], 'Volume 2'),
  ], { totalChapters: 4 }));
  assert.deepEqual(plain(result.chapters.map(item => item.chapterNumber)), [2, 2.5, 10, 100]);
  assert.equal(result.chapters[2].releaseTime, '2026-04-10');
  assert.equal(new Set(result.chapters.map(item => item.path)).size, 4);
});

test('provided numbers win over names; source ids may contain an explicit chapter number', () => {
  const result = parseOeuvre(oeuvre([volume('v1', [
    chapter('Chapitre 30', 'Titre sans numéro'), chapter('a', 'Chapitre 10', { chapterNumber: 3.5 }),
  ])]));
  assert.deepEqual(plain(result.chapters.map(item => item.chapterNumber)), [3.5, 30]);
});

test('mixed numbered chapters and interludes have deterministic ordering without invented numbers', () => {
  const result = parseOeuvre(oeuvre([volume('v1', [
    chapter('c10', 'Chapitre 10'), chapter('interlude', 'Interlude'), chapter('c1', 'Chapitre 1'),
  ])]));
  assert.deepEqual(plain(result.chapters.map(item => item.name)), ['Chapitre 1', 'Interlude', 'Chapitre 10']);
  assert.equal('chapterNumber' in result.chapters[1], false);
});

test('does not invent chapter numbers, timestamps, or publication dates', () => {
  const result = parseOeuvre(oeuvre([volume('v1', [
    chapter('uuid-a', 'Interlude', { ts: 1775779200000 }),
    chapter('uuid-b', 'Épilogue', { date: '31/02/2026' }),
    chapter('uuid-c', 'Bonus', { date: '29/02/2024' }),
  ])]));
  assert.equal(result.chapters[0].name, 'Interlude');
  for (const item of result.chapters) assert.equal('chapterNumber' in item, false);
  assert.equal('releaseTime' in result.chapters[0], false);
  assert.equal('releaseTime' in result.chapters[1], false);
  assert.equal(result.chapters[2].releaseTime, '2024-02-29');
});

test('volume-local number resets retain authentic numbers and distinguish names by volume', () => {
  const result = parseOeuvre(oeuvre([
    volume('v2', [chapter('c2', 'Chapitre 2'), chapter('c1', 'Chapitre 1')], 'Volume 2'),
    volume('v1', [chapter('c2', 'Chapitre 2'), chapter('c1', 'Chapitre 1')], 'Volume 1'),
  ]));
  assert.deepEqual(plain(result.chapters.map(item => item.name)), [
    'Volume 1 — Chapitre 1', 'Volume 1 — Chapitre 2', 'Volume 2 — Chapitre 1', 'Volume 2 — Chapitre 2',
  ]);
  assert.deepEqual(plain(result.chapters.map(item => item.chapterNumber)), [1, 2, 1, 2]);
  assert.equal(new Set(result.chapters.map(item => item.path)).size, 4);
});

test('status is absent when unknown and otherwise uses only the verified LNReader enum', () => {
  assert.equal(parseOeuvre(oeuvre([], { statut: 'Terminée' })).status, 'Completed');
  assert.equal(parseOeuvre(oeuvre([], { status: 'On Hiatus' })).status, 'On Hiatus');
  assert.equal(parseOeuvre(oeuvre([], { statut: 'En pause' })).status, 'On Hiatus');
  assert.equal('status' in parseOeuvre(oeuvre([], { statut: 'Un statut inconnu' })), false);
  assert.equal('status' in parseOeuvre(oeuvre([], { status: 'toString' })), false);
  assert.equal('status' in parseOeuvre(oeuvre([], { totalChapters: 0 })), false);
});

test('announced total counts unique chapters and refuses a silently incomplete list', () => {
  const duplicate = chapter('c1', 'Chapitre 1');
  assert.throws(() => parseOeuvre(oeuvre([volume('v1', [duplicate, duplicate])], { totalChapters: 2 })), /1 chapitres uniques reçus sur 2/);
  assert.throws(() => parseOeuvre(oeuvre([volume('v1', [])], { totalChapters: 3 })), /incomplète/);
  assert.throws(() => parseOeuvre(oeuvre([], { totalChapters: 1.5 })), /total.*invalide/);
});

test('fails explicitly for absent, malformed and contradictory source data', () => {
  assert.throws(() => parseOeuvre(null), /œuvre invalide/);
  assert.throws(() => parseOeuvre({ title: 'A', volumes: [] }), /identifiant/);
  assert.throws(() => parseOeuvre({ id: 'a', title: 'A' }), /volumes absente/);
  assert.throws(() => parseOeuvre(oeuvre([{ volumeId: 'v1' }])), /liste des chapitres/i);
  assert.throws(() => parseOeuvre(oeuvre([volume('v1', [chapter('c1', 'Chapitre 1', { volumeId: 'v2' })])])), /contradictoire/);
  assert.throws(() => parseOeuvre(oeuvre([volume('v1', [chapter('c1', 'Chapitre 1'), chapter('c1', 'Chapitre 2')])])), /dupliqués contradictoires/);
  assert.throws(() => parseOeuvre(oeuvre([volume('v1', [chapter('c1', 'Chapitre 1', { number: -2 })])])), /numéro.*invalide/);
});

test('does not return executable cover URLs', () => {
  assert.equal('cover' in parseOeuvre(oeuvre([], { image: 'javascript:alert(1)' })), false);
});
