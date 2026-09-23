import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { evaluateBundle } from '../tests/helpers.mjs';

const directory = new URL('../dist/', import.meta.url);
await mkdir(directory, { recursive: true });
const result = await build({
  entryPoints: [new URL('../src/plugin.ts', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
  bundle: true, format: 'cjs', platform: 'neutral', target: 'es2020',
  external: ['cheerio', '@libs/fetch', '@libs/storage'], write: false, minify: false,
  footer: { js: 'exports.default = module.exports.default;' },
});
const code = result.outputFiles[0].text;
const { result: plugin, imported } = evaluateBundle(code, {}, true);
if (!plugin || typeof plugin.parseChapter !== 'function') throw Error('Invalid LNReader default export');
if ([...imported].some(name => !['cheerio', '@libs/fetch', '@libs/storage'].includes(name))) throw Error('Unexpected dependency');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (plugin.version !== pkg.version) throw Error('Plugin/package version mismatch');
// These are publication targets, never evidence that publication has occurred.
const base = 'https://raw.githubusercontent.com/Paul-Berdier/lnreader-worldnovel/codex/worldnovel-vnh/dist';
const manifest = [{ id: plugin.id, name: plugin.name, site: plugin.site, lang: plugin.lang, version: plugin.version,
  url: `${base}/worldnovel-vnh.js`, iconUrl: `${base}/${plugin.icon}` }];
await writeFile(new URL('worldnovel-vnh.js', directory), code);
await writeFile(new URL('plugins.min.json', directory), JSON.stringify(manifest));
await writeFile(new URL('plugins.json', directory), JSON.stringify(manifest, null, 2) + '\n');

// Original, code-drawn pixel icon; no downloaded logo or copyrighted artwork.
function crc32(bytes) { let crc = -1; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
function chunk(type, bytes) { const t = Buffer.from(type); const n = Buffer.alloc(4); n.writeUInt32BE(bytes.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, bytes]))); return Buffer.concat([n, t, bytes, crc]); }
const scan = Buffer.alloc(32 * (1 + 32 * 3));
const glyph = ['1000001', '1000001', '1001001', '1010101', '1100011'];
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const gx = Math.floor((x - 5) / 3); const gy = Math.floor((y - 8) / 3);
  const light = gx >= 0 && gx < 7 && gy >= 0 && gy < 5 && glyph[gy][gx] === '1';
  scan.set(light ? [235, 243, 249] : [28, 58, 77], y * 97 + 1 + x * 3);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(32); ihdr.writeUInt32BE(32, 4); ihdr[8] = 8; ihdr[9] = 2;
await writeFile(new URL(plugin.icon, directory), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]));
console.log(`Built ${plugin.id} ${plugin.version}; local manifest only; imports: ${[...imported].join(', ')}`);
