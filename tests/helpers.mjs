import { buildSync } from 'esbuild';
import vm from 'node:vm';
import { load } from 'cheerio';
import { fileURLToPath } from 'node:url';

// No Node, DOM, URL, fetch or storage globals are supplied to the plugin.
export function evaluateBundle(code, mocks = {}, official = false) {
  const allowed = {
    cheerio: { load },
    '@libs/fetch': { fetchApi: async () => { throw Error('Unexpected network'); } },
    '@libs/storage': { localStorage: { get: () => undefined } },
    ...mocks,
  };
  const imported = new Set();
  const context = vm.createContext({
    require(name) {
      imported.add(name);
      if (!Object.hasOwn(allowed, name)) throw Error(`Unavailable runtime import: ${name}`);
      return allowed[name];
    },
    module: {},
  }, { codeGeneration: { strings: false, wasm: false } });
  const ending = official ? 'exports.default' : 'module.exports';
  const result = vm.runInContext(`(function(require,module){const exports=module.exports={};\n${code}\n;return ${ending};})(require,module)`, context, { timeout: 5000 });
  return { result, imported };
}

export function loadSource(relativePath, mocks = {}) {
  const path = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const { outputFiles } = buildSync({ entryPoints: [path], bundle: true, platform: 'neutral', format: 'cjs', target: 'es2020', external: ['cheerio', '@libs/*'], write: false });
  return evaluateBundle(outputFiles[0].text, mocks).result;
}

export function syntheticFlight(value) {
  return `<script>self.__next_f.push(${JSON.stringify([1, `a:${JSON.stringify(value)}\n`])})</script>`;
}
