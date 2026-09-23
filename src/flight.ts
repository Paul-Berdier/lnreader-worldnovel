/**
 * Read the JSON/text subset of React Flight embedded by Next.js.
 * This parses data only: no remote JavaScript, eval, Function, DOM or Node API.
 * Client modules and protocol hints stay opaque; callers still validate data.
 */
export type FlightObject = Record<string, unknown>;

const MAX_HTML_LENGTH = 16 * 1024 * 1024;
const MAX_STREAM_LENGTH = 12 * 1024 * 1024;
const MAX_RECORDS = 50_000;
const MAX_DEPTH = 96;
const MAX_NODES = 500_000;

function structure(detail: string): never {
  throw new Error(`Structure du site modifiée : données Next.js ${detail}.`);
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

function skipSpace(source: string, offset: number): number {
  while (offset < source.length && isSpace(source[offset])) offset++;
  return offset;
}

/** Find the end of an array/object JSON literal without guessing its nesting. */
function compoundEnd(source: string, start: number): number {
  const stack: string[] = [];
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '[' || char === '{') {
      stack.push(char);
      if (stack.length > MAX_DEPTH) structure('trop imbriquées');
    } else if (char === ']' || char === '}') {
      const open = stack.pop();
      if ((char === ']' && open !== '[') || (char === '}' && open !== '{')) {
        structure('mal formées');
      }
      if (stack.length === 0) return i + 1;
    }
  }
  return structure('tronquées');
}

/** Skip a JavaScript quoted literal; its contents are never interpreted. */
function skipQuotedCode(source: string, start: number): number {
  const quote = source[start];
  let escaped = false;
  for (let i = start + 1; i < source.length; i++) {
    if (escaped) escaped = false;
    else if (source[i] === '\\') escaped = true;
    else if (source[i] === quote) return i + 1;
  }
  return source.length;
}

function collectPushes(script: string, fragments: string[]): void {
  const push = /self\s*\.\s*__next_f\s*\.\s*push\s*\(/g;
  let offset = 0;
  while (offset < script.length) {
    const char = script[offset];
    if (char === '"' || char === "'" || char === '`') {
      offset = skipQuotedCode(script, offset);
      continue;
    }
    if (script.startsWith('//', offset)) {
      const end = script.indexOf('\n', offset + 2);
      offset = end < 0 ? script.length : end + 1;
      continue;
    }
    if (script.startsWith('/*', offset)) {
      const end = script.indexOf('*/', offset + 2);
      offset = end < 0 ? script.length : end + 2;
      continue;
    }
    if (
      script.startsWith('self', offset) &&
      (offset === 0 || !/[\w$.]/.test(script[offset - 1]))
    ) {
      push.lastIndex = offset;
      const match = push.exec(script);
      if (match?.index === offset) {
        const start = skipSpace(script, push.lastIndex);
        if (script[start] !== '[') structure('non JSON');
        const end = compoundEnd(script, start);
        let value: unknown;
        try {
          value = JSON.parse(script.slice(start, end));
        } catch {
          structure('non JSON');
        }
        const close = skipSpace(script, end);
        if (script[close] !== ')') structure('non JSON');
        if (!Array.isArray(value)) structure('mal formées');
        if (value[0] === 1) {
          if (value.length !== 2 || typeof value[1] !== 'string') {
            structure('de transport inconnues');
          }
          fragments.push(value[1]);
          if (fragments.length > MAX_RECORDS) structure('trop volumineuses');
        }
        offset = close + 1;
        continue;
      }
    }
    offset++;
  }
}

function extractStream(html: string): string {
  if (html.length > MAX_HTML_LENGTH) structure('trop volumineuses');
  const fragments: string[] = [];
  const openScript = /<script\b[^>]*>/gi;
  const closeScript = /<\/script\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = openScript.exec(html))) {
    const start = openScript.lastIndex;
    closeScript.lastIndex = start;
    const close = closeScript.exec(html);
    if (!close) structure('tronquées');
    // Inert script payloads such as application/json are not executable pushes.
    const type = match[0].match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!type || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(type)) {
      collectPushes(html.slice(start, close.index), fragments);
    }
    openScript.lastIndex = closeScript.lastIndex;
  }
  if (fragments.length === 0) structure('absentes');
  const stream = fragments.join('');
  if (stream.length > MAX_STREAM_LENGTH) structure('trop volumineuses');
  return stream;
}

/** Consume UTF-8 bytes without relying on TextEncoder, absent from some RN builds. */
function utf8End(source: string, offset: number, byteLength: number): number {
  let bytes = 0;
  while (bytes < byteLength && offset < source.length) {
    const first = source.charCodeAt(offset);
    let width = first < 0x80 ? 1 : first < 0x800 ? 2 : 3;
    let units = 1;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = source.charCodeAt(offset + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        width = 4;
        units = 2;
      }
    }
    bytes += width;
    if (bytes > byteLength) structure('de longueur UTF-8 incohérente');
    offset += units;
  }
  if (bytes !== byteLength) structure('tronquées');
  return offset;
}

function readRecords(stream: string): {
  records: Map<string, unknown>;
  textRecords: Set<string>;
} {
  const records = new Map<string, unknown>();
  const textRecords = new Set<string>();
  let offset = 0;
  let count = 0;
  while (offset < stream.length) {
    if (stream[offset] === '\n' || stream[offset] === '\r') {
      offset++;
      continue;
    }
    const colon = stream.indexOf(':', offset);
    if (colon < 0 || colon - offset > 16) structure('de format inconnu');
    const id = stream.slice(offset, colon).toLowerCase();
    if (++count > MAX_RECORDS) structure('trop volumineuses');
    offset = colon + 1;

    // React's wire reader permits an empty row id for resource hints (:HL…).
    // Only accept the known H dispatch tags, validate their JSON and ignore
    // them as metadata. An empty id must never become an implicit data row 0.
    if (id === '') {
      const newline = stream.indexOf('\n', offset);
      if (newline < 0) structure('tronquées');
      const hint = stream.slice(offset, newline).trim();
      if (!/^H[DCLmXSM]/.test(hint)) structure('de format inconnu');
      const payload = hint.slice(2);
      if (payload[0] === '[' && compoundEnd(payload, 0) !== payload.length) {
        structure('mal formées');
      }
      let hintValue: unknown;
      try { hintValue = JSON.parse(payload); }
      catch { structure('non JSON'); }
      if (typeof hintValue !== 'string' && !Array.isArray(hintValue)) {
        structure('de format inconnu');
      }
      offset = newline + 1;
      continue;
    }
    if (!/^[0-9a-f]+$/.test(id)) structure('de format inconnu');

    let value: unknown;
    if (stream[offset] === 'T') {
      const comma = stream.indexOf(',', offset + 1);
      if (comma < 0 || comma - offset > 9) structure('texte de format inconnu');
      const hex = stream.slice(offset + 1, comma);
      if (!/^[0-9a-f]+$/i.test(hex)) structure('texte de longueur inconnue');
      const byteLength = parseInt(hex, 16);
      if (byteLength > MAX_STREAM_LENGTH * 4) structure('trop volumineuses');
      const start = comma + 1;
      offset = utf8End(stream, start, byteLength);
      value = stream.slice(start, offset);
      textRecords.add(id);
    } else {
      const newline = stream.indexOf('\n', offset);
      const end = newline < 0 ? stream.length : newline;
      const payload = stream.slice(offset, end).trim();
      offset = newline < 0 ? stream.length : newline + 1;
      // Module/import/hint/debug records are protocol metadata, not novel data.
      if (!/^[\[\{"0-9tfn-]/.test(payload)) continue;
      if (payload[0] === '[' || payload[0] === '{') {
        const literalEnd = compoundEnd(payload, 0);
        if (literalEnd !== payload.length) structure('mal formées');
      }
      try {
        value = JSON.parse(payload);
      } catch {
        structure('non JSON');
      }
    }
    if (records.has(id)) structure('avec identifiants dupliqués');
    records.set(id, value);
  }
  if (records.size === 0) structure('sans objets lisibles');
  return { records, textRecords };
}

/** Resolve references to data records; unavailable module references stay opaque. */
function resolveRecords(
  records: Map<string, unknown>,
  textRecords: Set<string>,
): unknown[] {
  const resolved = new Map<string, unknown>();
  const resolving = new Set<string>();
  const resolvedObjects = new WeakMap<object, unknown>();
  const resolvingObjects = new WeakSet<object>();
  let nodes = 0;

  function resolveRecord(id: string, depth: number): unknown {
    if (resolved.has(id)) return resolved.get(id);
    if (resolving.has(id)) structure('avec références circulaires');
    resolving.add(id);
    const value = textRecords.has(id) ? records.get(id) : visit(records.get(id), depth);
    resolving.delete(id);
    resolved.set(id, value);
    return value;
  }

  function visit(value: unknown, depth: number): unknown {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) structure('trop complexes');
    if (typeof value === 'string') {
      if (value.startsWith('$$')) return value.slice(1);
      if (value === '$undefined') return undefined;
      // L and @ denote lazy/promise references. Resolve only available data.
      const ref = /^\$(?:L|@)?([0-9a-f]+)(?::(.+))?$/i.exec(value);
      if (!ref || !records.has(ref[1].toLowerCase())) return value;
      const id = ref[1].toLowerCase();
      if (ref[2]) {
        // A reference can select a sibling inside its own record. Traverse the
        // raw path first, instead of resolving its entire containing record.
        let target = records.get(id);
        let alreadyResolved = textRecords.has(id);
        for (const key of ref[2].split(':')) {
          if (!alreadyResolved && typeof target === 'string') {
            target = visit(target, depth + 1);
            alreadyResolved = true;
          }
          if (
            target === null ||
            typeof target !== 'object' ||
            !Object.prototype.hasOwnProperty.call(target, key)
          ) {
            return value;
          }
          target = (target as FlightObject)[key];
        }
        return alreadyResolved ? target : visit(target, depth + 1);
      }
      return resolveRecord(id, depth + 1);
    }
    if (value !== null && typeof value === 'object') {
      if (resolvedObjects.has(value)) return resolvedObjects.get(value);
      if (resolvingObjects.has(value)) structure('avec références circulaires');
      resolvingObjects.add(value);
      let copy: unknown;
      if (Array.isArray(value)) {
        copy = value.map(item => visit(item, depth + 1));
      } else {
        const object: FlightObject = {};
        for (const key of Object.keys(value)) {
          // defineProperty keeps JSON "__proto__" an ordinary own data property.
          Object.defineProperty(object, key, {
            value: visit((value as FlightObject)[key], depth + 1),
            enumerable: true,
            writable: true,
            configurable: true,
          });
        }
        copy = object;
      }
      resolvingObjects.delete(value);
      resolvedObjects.set(value, copy);
      return copy;
    }
    return value;
  }

  return Array.from(records.keys(), id => resolveRecord(id, 0));
}

export function parseFlight(html: string): unknown[] {
  const { records, textRecords } = readRecords(extractStream(html));
  return resolveRecords(records, textRecords);
}

export const parseFlightHtml = parseFlight;

/** Find each object once across resolved records and shared React subtrees. */
export function findObjects(
  root: unknown,
  predicate: (value: FlightObject) => boolean,
): FlightObject[] {
  const found: FlightObject[] = [];
  const seen = new Set<object>();
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const current = stack.pop()!;
    const value = current.value;
    if (value === null || typeof value !== 'object' || seen.has(value)) continue;
    if (current.depth > MAX_DEPTH || ++count > MAX_NODES) structure('trop complexes');
    seen.add(value);
    if (!Array.isArray(value) && predicate(value as FlightObject)) {
      found.push(value as FlightObject);
    }
    const children = Array.isArray(value) ? value : Object.values(value);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ value: children[i], depth: current.depth + 1 });
    }
  }
  return found;
}
