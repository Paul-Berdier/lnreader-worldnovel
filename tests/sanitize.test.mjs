import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers.mjs';
const { sanitizeChapter } = loadSource('src/sanitize.ts');
test('preserves synthetic prose, numbers, emphasis and separators', () => {
  assert.equal(sanitizeChapter('<p>« ÉTÉ 123 — Salut ! » <em>Oui.</em></p><hr><p><sup>2</sup> &amp; trois.</p>'), '<p>« ÉTÉ 123 — Salut ! » <em>Oui.</em></p><hr><p><sup>2</sup> &amp; trois.</p>');
});
test('removes active markup, hidden content, navigation and dangerous URLs', () => {
  const result = sanitizeChapter('<script>alert(1)</script><nav>Menu</nav><p onclick="bad()">Texte<img src="javascript:bad" onerror="bad()"><a href="java&#x73;cript:bad()">lien</a></p><p hidden>masqué</p><span style="display: none">masqué</span><img src="https://cdn.world-novel.fr/image.webp" alt="Illustration">');
  assert.equal(result,'<p>Texte<a>lien</a></p><img src="https://cdn.world-novel.fr/image.webp" alt="Illustration">');
});
test('does not guess obfuscated CSS classes or remove short/uppercase elements', () => {
  assert.equal(sanitizeChapter('<span class="unknown">A</span><b>42</b>'), '<span>A</span><b>42</b>');
});
test('empty cleaned body is an error', () => assert.throws(() => sanitizeChapter('<script>bad()</script>'),/vide/));
