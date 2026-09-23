import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers.mjs';

const { readSearchIndex, searchCached, normalizeIndexSearch } = loadSource('src/search.ts');
const now = Date.parse('2026-09-23T14:00:00.000Z');
const expiresAt = '2026-09-24T14:00:00.000Z';
const snapshot = (novels, expiry = expiresAt, extra = {}) => ({ searchCache: JSON.stringify({ data: { novels }, expiresAt: expiry }), ...extra });
const novel = (id, title = `Roman ${id}`, extra = {}) => ({ id, title, ...extra });
const plain = value => JSON.parse(JSON.stringify(value));

test('reads only the site search cache and returns available metadata without session data', () => {
  const source = snapshot([novel('etoile', 'Étoile', { image: 'https://cdn.example.test/a.png', auteur: 'Autrice', genre: 'Fantaisie', tags: ['Aventure'] })], expiresAt, { authToken: 'SYNTHETIC-SHOULD-NOT-APPEAR' });
  const result = readSearchIndex(source, now);
  assert.deepEqual(plain(result), { expiresAt: Date.parse(expiresAt), items: [{ name: 'Étoile', path: '/oeuvres/etoile', cover: 'https://cdn.example.test/a.png', author: 'Autrice', genres: 'Fantaisie', tags: ['Aventure'] }] });
  assert.equal(JSON.stringify(result).includes('SYNTHETIC-SHOULD-NOT-APPEAR'), false);
  assert.deepEqual(plain(searchCached(source, 'étoile', 1, now)), [{ name: 'Étoile', path: '/oeuvres/etoile', cover: 'https://cdn.example.test/a.png' }]);
});

test('absence, malformed cache and expiry are distinct explicit errors', () => {
  for (const value of [undefined, null, [], {}, { searchCache: '' }]) assert.throws(() => readSearchIndex(value, now), /Index de recherche absent/);
  for (const raw of ['{broken', '{}', 'null', JSON.stringify({ data: {}, expiresAt }), JSON.stringify({ data: { novels: [] }, expiresAt: 'tomorrow' })]) {
    assert.throws(() => readSearchIndex({ searchCache: raw }, now), /Index de recherche invalide/);
  }
  assert.throws(() => readSearchIndex(snapshot([], '2026-09-23T14:00:00.000Z'), now), /Index de recherche expiré/);
  assert.throws(() => readSearchIndex(snapshot([], '2026-09-23T13:59:59.999Z'), now), /Index de recherche expiré/);
  assert.equal(readSearchIndex(snapshot([], '2026-09-23T14:00:00.001Z'), now).items.length, 0);
  assert.throws(() => readSearchIndex(snapshot([], '2026-02-30T14:00:00.000Z'), now), /invalide/);
});

test('searches title, author, genre, tags and title initials across the actual search index', () => {
  const data = snapshot([
    novel('far-away', 'La Lune Cachée', { auteur: 'Émilie', genre: 'Fantaisie', tags: ['Héroïne'] }),
    novel('other', 'Un autre roman'),
  ]);
  for (const query of ['lune', '  EMILIE ', 'fantaisie', 'heroine', 'llc']) {
    assert.deepEqual(plain(searchCached(data, query, 1, now).map(item => item.path)), ['/oeuvres/far-away']);
  }
  assert.deepEqual(plain(searchCached(data, 'aucun résultat', 1, now)), []);
  assert.deepEqual(plain(searchCached(data, ' \t ', 1, now)), []);
});

test('processes entries beyond the site UI top ten, paginates twenty and terminates', () => {
  const data = snapshot(Array.from({ length: 45 }, (_, index) => novel(`id-${index}`, `Cycle ${index}`)));
  const pages = [1, 2, 3, 4].map(page => searchCached(data, 'cycle', page, now));
  assert.deepEqual(pages.map(page => page.length), [20, 20, 5, 0]);
  assert.equal(pages[1][0].path, '/oeuvres/id-20');
  assert.equal(pages[2][4].path, '/oeuvres/id-44');
  assert.equal(new Set(pages.flat().map(item => item.path)).size, 45);
  assert.equal(searchCached(data, 'cycle 44', 1, now)[0].path, '/oeuvres/id-44');
});

test('deduplicates raw identifiers, encodes each component once and retains source order', () => {
  const id = "L'œuvre /100%20";
  const result = readSearchIndex(snapshot([
    novel(id, 'Œuvre'), novel('deux', 'Deux'), novel(id, 'Œuvre', { image: '/cover.png', tags: ['Mystère'] }),
  ]), now).items;
  assert.equal(result.length, 2);
  assert.equal(result[0].path, '/oeuvres/L%27%C5%93uvre%20%2F100%2520');
  assert.equal(result[0].cover, 'https://world-novel.fr/cover.png');
  assert.deepEqual(plain(result[0].tags), ['Mystère']);
  assert.equal(result[1].path, '/oeuvres/deux');
});

test('normalizes composed accents, spacing and case while preserving non-Latin Unicode', () => {
  assert.equal(normalizeIndexSearch(' ÉLÉPHANT\tBleu '), 'elephant bleu');
  assert.equal(normalizeIndexSearch('Cafe\u0301'), normalizeIndexSearch('Café'));
  const data = snapshot([novel('etoile', '星の旅 🌙'), novel('cafe', 'Le Café')]);
  assert.equal(searchCached(data, '星の旅', 1, now)[0].path, '/oeuvres/etoile');
  assert.equal(searchCached(data, 'cafe\u0301', 1, now)[0].path, '/oeuvres/cafe');
});

test('refuses malformed entries instead of silently dropping novels from an allegedly complete index', () => {
  for (const item of [null, { id: 'x' }, novel('..'), novel('\ud800'), novel('x', 'Title', { auteur: {} }), novel('x', 'Title', { genre: [] }), novel('x', 'Title', { tags: 'string' }), novel('x', 'Title', { tags: [42] })]) {
    assert.throws(() => readSearchIndex(snapshot([item]), now), /Index de recherche invalide/);
  }
});

test('bounds cache size, index length, input lengths and page numbers', () => {
  assert.throws(() => readSearchIndex({ searchCache: ' '.repeat(5_000_001) }, now), /invalide/);
  assert.throws(() => readSearchIndex(snapshot(Array.from({ length: 10_001 }, (_, index) => novel(`${index}`))), now), /invalide/);
  assert.throws(() => readSearchIndex(snapshot([novel('x', 'a'.repeat(1025))]), now), /invalide/);
  for (const page of [0, -1, 1.5, Infinity, NaN, '1']) assert.throws(() => searchCached(snapshot([]), 'a', page, now), /page de recherche invalide/);
  assert.throws(() => searchCached(snapshot([]), 'a'.repeat(2049), 1, now), /Recherche invalide/);
});

test('never returns executable image URLs or fabricated cover metadata', () => {
  const data = snapshot([novel('a', 'Roman A', { image: 'javascript:alert(1)' }), novel('b', 'Roman B')]);
  const result = searchCached(data, 'roman', 1, now);
  assert.equal(result.every(item => !('cover' in item)), true);
});
