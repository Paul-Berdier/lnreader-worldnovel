import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource } from './helpers.mjs';

const { extractHomeSelections, paginateSelections, normalizeSearch } = loadSource('src/catalogue.ts');
const plain = value => JSON.parse(JSON.stringify(value));

test('homepage cards use real headings or image labels, never concatenated descriptions', () => {
  const result = extractHomeSelections(`
    <a href="/oeuvres/roman-a"><img alt="Ancien titre" src="https://cdn.example.test/a.webp"><h3> Un héros &amp; une héroïne </h3><p>Un résumé distinct.</p><span>123 chapitres</span></a>
    <a href="/oeuvres/roman-b"><img alt="Étoile de neige" src="/cover-b.png"><p>Résumé.</p></a>
    <a href="/oeuvres/roman-c"><img title="La troisième œuvre" src="//cdn.example.test/c.png"></a>
    <a href="/oeuvres/slug-only"><span>Lire maintenant</span></a>
    <a href="/account"><h2>Mon compte</h2></a>
  `);
  assert.deepEqual(plain(result), [
    { name: 'Un héros & une héroïne', path: '/oeuvres/roman-a', cover: 'https://cdn.example.test/a.webp' },
    { name: 'Étoile de neige', path: '/oeuvres/roman-b', cover: 'https://world-novel.fr/cover-b.png' },
    { name: 'La troisième œuvre', path: '/oeuvres/roman-c', cover: 'https://cdn.example.test/c.png' },
  ]);
});

test('canonical paths decode and encode once, preserving Unicode and reserved source identifiers', () => {
  const result = extractHomeSelections(`
    <a href="/oeuvres/L'%C5%93uvre%20%26%20%C3%A9t%C3%A9?ref=home#chapters"><h2>L’œuvre &amp; été</h2></a>
    <a href="/oeuvres/cent%2520pourcent/"><h3>Cent pourcent</h3></a>
    <a href="/oeuvres/un%2Fdeux"><h3>Un et deux</h3></a>
  `);
  assert.deepEqual(plain(result.map(item => item.path)), [
    '/oeuvres/L%27%C5%93uvre%20%26%20%C3%A9t%C3%A9', '/oeuvres/cent%2520pourcent', '/oeuvres/un%2Fdeux',
  ]);
});

test('deduplicates canonical paths across homepage sections and preserves source ordering', () => {
  const result = extractHomeSelections(`
    <a href="/oeuvres/%C3%A9toile?section=hero"><h3>Étoile</h3></a>
    <a href="/oeuvres/autre"><h3>Autre</h3></a>
    <a href="/oeuvres/étoile#latest"><img alt="Étoile" src="https://cdn.example.test/star.png"></a>
  `);
  assert.deepEqual(plain(result), [
    { name: 'Étoile', path: '/oeuvres/%C3%A9toile', cover: 'https://cdn.example.test/star.png' },
    { name: 'Autre', path: '/oeuvres/autre' },
  ]);
});

test('ignores invalid routes and unsafe cover schemes without inventing missing metadata', () => {
  const result = extractHomeSelections(`
    <a href="/oeuvres/valid"><h3>Valid</h3><img src="javascript:alert(1)"></a>
    <a href="/oeuvres/one/two"><h3>Nested path</h3></a>
    <a href="/oeuvres/%ZZ"><h3>Invalid escape</h3></a>
    <a href="/oeuvres/%2E%2E"><h3>Traversal</h3></a>
    <a href="/oeuvres/%00bad"><h3>Control character</h3></a>
    <a href="/oeuvres/"><h3>No identifier</h3></a>
    <a href="https://other.example/oeuvres/foreign"><h3>Foreign</h3></a>
  `);
  assert.deepEqual(plain(result), [{ name: 'Valid', path: '/oeuvres/valid' }]);
});

test('missing cards, login pages and changed structures produce explicit errors rather than a false empty catalogue', () => {
  for (const html of ['', '<html><title>Connexion</title><form><input type="password"></form></html>', '<main><h2>Nouveau catalogue</h2></main>', '<a href="/oeuvres/no-title"><p>Résumé uniquement</p></a>']) {
    assert.throws(() => extractHomeSelections(html), /Catalogue indisponible/);
  }
});

test('paginates homepage selections in distinct batches of twenty and terminates', () => {
  const items = Array.from({ length: 43 }, (_, index) => ({ name: `Titre ${index}`, path: `/oeuvres/id-${index}` }));
  assert.deepEqual(plain(paginateSelections(items, 1)), items.slice(0, 20));
  assert.deepEqual(plain(paginateSelections(items, 2)), items.slice(20, 40));
  assert.deepEqual(plain(paginateSelections(items, 3)), items.slice(40));
  assert.deepEqual(plain(paginateSelections(items, 4)), []);
  assert.deepEqual(plain(paginateSelections([], 1)), []);
  for (const page of [0, -1, 1.5, NaN, Infinity, '1']) {
    assert.throws(() => paginateSelections(items, page), /page invalide/);
  }
});

test('future search normalization handles accents, whitespace, decomposed Unicode and non-Latin text', () => {
  assert.equal(normalizeSearch('  ÉLÉPHANT\t Bleu \n'), 'elephant bleu');
  assert.equal(normalizeSearch('Cafe\u0301'), normalizeSearch('Café'));
  assert.equal(normalizeSearch(' 星の旅 🌙 '), '星の旅 🌙');
  assert.equal(normalizeSearch('   '), '');
});
