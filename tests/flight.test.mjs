import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/flight.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2020' });
const { parseFlight, parseFlightHtml, findObjects } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const push = fragment => `<script>self.__next_f.push(${JSON.stringify([1, fragment])})</script>`;
const page = stream => `<html><head></head><body>${push(stream)}</body></html>`;
const objectRecord = (id, value) => `${id}:${JSON.stringify(value)}\n`;
const textRecord = (id, value) => `${id}:T${Buffer.byteLength(value, 'utf8').toString(16)},${value}`;
const modified = /Structure du site modifiée/;

test('extracts fragmented JSON, escaped quotes, braces and Unicode without evaluating code', () => {
  const item = { slug: 'été-après-l’école', title: 'Un titre "{[synthétique]}"', cover: '/étoile.png' };
  const stream = objectRecord('a', { entries: [item], slash: '\\', line: 'x\ny' });
  const chunks = [stream.slice(0, 17), stream.slice(17, 42), stream.slice(42)];
  const parsed = parseFlight(chunks.map(push).join(''));
  assert.deepEqual(parsed, [{ entries: [item], slash: '\\', line: 'x\ny' }]);
  assert.equal(parseFlightHtml, parseFlight);
});

test('resolves forward references, React tuples and property/index reference paths', () => {
  const stream =
    objectRecord('0', ['$', '$L9', null, { payload: '$1', selected: '$2:props:children:1' }]) +
    objectRecord('1', { slug: 'livre-test', title: 'Livre de test', detail: '$a' }) +
    objectRecord('2', { props: { children: ['ignored', '$1'] } }) +
    objectRecord('a', { author: 'Auteur fictif' }) +
    '9:I[123,[],"default"]\n';
  const parsed = parseFlight(page(stream));
  const items = findObjects(parsed, value => value.slug === 'livre-test');
  assert.equal(items.length, 1);
  assert.equal(items[0].detail.author, 'Auteur fictif');
  assert.equal(parsed[0][3].selected, items[0]);
  assert.equal(parsed[0][1], '$L9');
  assert.equal(parsed[0][0], '$');
});

test('resolves sibling paths within the same record without inventing a circular dependency', () => {
  const stream = objectRecord('0', {
    first: '$0:props:children:1',
    props: { children: ['unused', { slug: 'sibling', title: 'Métadonnées synthétiques' }] },
  });
  const parsed = parseFlight(page(stream));
  assert.equal(parsed[0].first, parsed[0].props.children[1]);
  assert.equal(findObjects(parsed, value => value.slug === 'sibling').length, 1);
});

test('follows paths through another reference without decoding escaped dollars twice', () => {
  const stream = objectRecord('0', { selected: '$1:child:title' }) +
    objectRecord('1', { child: '$2' }) + objectRecord('2', { title: '$$3' }) +
    objectRecord('3', 'unrelated');
  assert.equal(parseFlight(page(stream))[0].selected, '$3');
});

test('consumes hexadecimal UTF-8 lengths exactly, including emoji and embedded newlines', () => {
  const text = 'Résumé synthétique éèê € 🌍\n3:{"pas":"un record"}\nfin.';
  const stream = objectRecord('0', { summary: '$a', tail: '$b' }) +
    textRecord('a', text) + objectRecord('b', { done: true });
  const middle = Math.floor(stream.length / 2);
  const parsed = parseFlight(push(stream.slice(0, middle)) + push(stream.slice(middle)));
  assert.equal(parsed[0].summary, text);
  assert.deepEqual(parsed[0].tail, { done: true });
});

test('supports zero-length text records and a final record without a newline', () => {
  assert.deepEqual(parseFlight(page('a:T0,b:{"summary":"$a"}')), ['', { summary: '' }]);
});

test('text records keep dollar-prefixed text literal', () => {
  const stream = textRecord('a', '$undefined') + textRecord('b', '$a') +
    objectRecord('c', { first: '$a', second: '$b' });
  assert.deepEqual(parseFlight(page(stream)), [
    '$undefined', '$a', { first: '$undefined', second: '$a' },
  ]);
});

test('ignores initialization, hints, module records and inert scripts', () => {
  const html = '<script>(self.__next_f=self.__next_f||[]).push([0]);self.__next_f.push([2,null])</script>' +
    '<script type="application/json">self.__next_f.push([1,"0:null\\n"])</script>' +
    page('1:HL["/styles.css","style"]\n2:I[1,[],"A"]\n3:D{"name":"debug"}\n' +
      objectRecord('4', { title: 'Fiche synthétique' }));
  assert.deepEqual(parseFlight(html), [{ title: 'Fiche synthétique' }]);
});

test('accepts resource hints with no row id without replacing data record zero', () => {
  const stream = ':HL["/synthetic.css","style"]\n' +
    ':HD"https://example.test"\n' +
    ':Hm["/synthetic-module.js",{"crossOrigin":""}]\n' +
    objectRecord('0', { title: 'Fiche synthétique', next: '$1' }) +
    ':HC["https://example.test","anonymous"]\n' +
    objectRecord('1', { ok: true });
  const boundary = stream.indexOf('style') + 2;
  assert.deepEqual(parseFlight(push(stream.slice(0, boundary)) + push(stream.slice(boundary))), [
    { title: 'Fiche synthétique', next: { ok: true } }, { ok: true },
  ]);
});

test('rejects empty-id data rows and malformed or unknown resource hints', () => {
  for (const hint of [
    ':{}\n', ':T3,abc', ':I[]\n', ':HZ[]\n', ':HLnot_json\n',
    ':HL["/synthetic.css"] trailing\n', ':HL["truncated"]', ':HLnull\n',
  ]) assert.throws(() => parseFlight(page(hint + objectRecord('0', { ok: true }))), modified);
});

test('ignores markers inside JavaScript string literals and comments', () => {
  const html = '<script>const s=\'self.__next_f.push([1,"0:null\\n"])\';' +
    '// self.__next_f.push([1,"0:null\\n"])\n' +
    '/* self.__next_f.push([1,"0:null\\n"]) */</script>' + page(objectRecord('1', { ok: true }));
  assert.deepEqual(parseFlight(html), [{ ok: true }]);
});

test('accepts whitespace and semicolons in the transport call', () => {
  const payload = JSON.stringify([1, objectRecord('a', { ok: true })]);
  assert.deepEqual(parseFlight(`<script>self . __next_f . push ( ${payload} );</script>`), [{ ok: true }]);
});

test('does not execute script expressions inside a push', () => {
  globalThis.__flightExecuted = false;
  const html = '<script>self.__next_f.push([1,(globalThis.__flightExecuted=true,"0:null\\n")])</script>';
  assert.throws(() => parseFlight(html), modified);
  assert.equal(globalThis.__flightExecuted, false);
  delete globalThis.__flightExecuted;
});

test('preserves escaped dollar strings and opaque or unavailable references', () => {
  const parsed = parseFlight(page(objectRecord('0', { literal: '$$a', missing: '$ff', undef: '$undefined' })));
  assert.deepEqual(parsed, [{ literal: '$a', missing: '$ff', undef: undefined }]);
});

test('never follows inherited object properties or changes prototypes', () => {
  const stream = '1:{"__proto__":{"polluted":true},"value":"test"}\n' +
    objectRecord('2', { own: '$1:__proto__:polluted', inherited: '$1:constructor:prototype' });
  const parsed = parseFlight(page(stream));
  assert.equal(Object.getPrototypeOf(parsed[0]), Object.prototype);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(parsed[1].own, true);
  assert.equal(parsed[1].inherited, '$1:constructor:prototype');
});

test('rejects missing, malformed and truncated Flight without returning page text', () => {
  for (const html of [
    '<html>Connexion requise</html>',
    '<script>self.__next_f.push([1,"0:{"])</script>',
    '<script>self.__next_f.push([1,"0:null\\n"]</script>',
    '<script>self.__next_f.push([1,{}])</script>',
    page('0:{"title":}\n'),
    page('0:{"title":"test"} trailing\n'),
  ]) assert.throws(() => parseFlight(html), modified);
});

test('rejects truncated text and invalid UTF-8 boundaries', () => {
  assert.throws(() => parseFlight(page('1:T3,é')), modified);
  assert.throws(() => parseFlight(page('1:T1,é')), /UTF-8/);
  assert.throws(() => parseFlight(page('1:T3,🌍')), /UTF-8/);
});

test('rejects conflicting records and cyclic references', () => {
  assert.throws(() => parseFlight(page('1:{}\n1:{}\n')), /dupliqués/);
  assert.throws(() => parseFlight(page('1:{"next":"$2"}\n2:{"next":"$1"}\n')), /circulaires/);
});

test('bounds deeply nested payloads and reference chains', () => {
  assert.throws(() => parseFlight(page('0:' + '['.repeat(110) + '0' + ']'.repeat(110) + '\n')), modified);
  let stream = '';
  for (let i = 0; i < 110; i++) stream += objectRecord(i.toString(16), `$${(i + 1).toString(16)}`);
  stream += objectRecord((110).toString(16), { last: true });
  assert.throws(() => parseFlight(page(stream)), /complexes/);
});

test('findObjects returns unique objects and handles a cyclic caller-owned input safely', () => {
  const item = { slug: 'unique' };
  const root = { first: item, duplicate: item };
  root.self = root;
  assert.deepEqual(findObjects(root, value => typeof value.slug === 'string'), [item]);
});
