"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/plugin.ts
var plugin_exports = {};
__export(plugin_exports, {
  default: () => plugin_default
});
module.exports = __toCommonJS(plugin_exports);

// src/metadata.ts
var metadata = {
  id: "worldnovel-vnh",
  name: "WorldNovel VNH",
  site: "https://world-novel.fr",
  lang: "Fran\xE7ais",
  version: "0.1.0",
  icon: "worldnovel-vnh.png"
};

// src/network.ts
var import_fetch = require("@libs/fetch");
var cooldownUntil = 0;
function checkPage(html) {
  if (!html.trim()) throw Error("WorldNovel : r\xE9ponse vide du site.");
  if (/cf-chl-|challenges\.cloudflare\.com|<title>\s*(?:Just a moment|Un instant)/i.test(html)) {
    throw Error("WorldNovel : validation \xE0 effectuer dans le navigateur int\xE9gr\xE9 (Cloudflare).");
  }
  const hasFlightData = /self\s*\.\s*__next_f\s*\.\s*push\s*\(\s*\[\s*1\s*,/.test(html);
  if (!hasFlightData && /<form[^>]*[\s\S]*?type=["']password["']/i.test(html)) {
    throw Error("WorldNovel : connexion requise dans le navigateur int\xE9gr\xE9.");
  }
}
async function getPage(url) {
  if (!/^https:\/\/world-novel\.fr\//.test(url)) throw Error("WorldNovel : URL externe refus\xE9e.");
  if (Date.now() < cooldownUntil) {
    throw Error("WorldNovel : limitation temporaire du nombre de requ\xEAtes. R\xE9essayez plus tard.");
  }
  let response;
  try {
    response = await (0, import_fetch.fetchApi)(url);
  } catch {
    throw Error("WorldNovel : impossible de joindre le site. V\xE9rifiez le WebView et votre connexion.");
  }
  if (response.status === 429) {
    const value = response.headers.get("Retry-After");
    const delay = value && /^\d+$/.test(value) ? Number(value) * 1e3 : Date.parse(value || "") - Date.now();
    cooldownUntil = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 6e4);
    throw Error("WorldNovel : limitation temporaire du nombre de requ\xEAtes. R\xE9essayez apr\xE8s le d\xE9lai du site.");
  }
  if (response.status === 401) throw Error("WorldNovel : connexion requise ou session expir\xE9e ; reconnectez-vous dans le navigateur int\xE9gr\xE9.");
  if (response.status === 404) throw Error("WorldNovel : \u0153uvre ou chapitre indisponible (404).");
  if (response.status === 403) throw Error("WorldNovel : acc\xE8s refus\xE9 (403) ; v\xE9rifiez la validation et votre acc\xE8s dans le navigateur int\xE9gr\xE9.");
  if (!response.ok) throw Error(`WorldNovel : erreur du site (HTTP ${response.status}).`);
  if (response.url && !/^https:\/\/world-novel\.fr(?:\/|$)/.test(response.url)) {
    throw Error("WorldNovel : le site redirige vers un autre service ; lecture indisponible.");
  }
  const text2 = await response.text();
  checkPage(text2);
  return text2;
}

// src/flight.ts
var MAX_HTML_LENGTH = 16 * 1024 * 1024;
var MAX_STREAM_LENGTH = 12 * 1024 * 1024;
var MAX_RECORDS = 5e4;
var MAX_DEPTH = 96;
var MAX_NODES = 5e5;
function structure(detail) {
  throw new Error(`Structure du site modifi\xE9e : donn\xE9es Next.js ${detail}.`);
}
function isSpace(char) {
  return char !== void 0 && /\s/.test(char);
}
function skipSpace(source, offset) {
  while (offset < source.length && isSpace(source[offset])) offset++;
  return offset;
}
function compoundEnd(source, start) {
  const stack = [];
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "[" || char === "{") {
      stack.push(char);
      if (stack.length > MAX_DEPTH) structure("trop imbriqu\xE9es");
    } else if (char === "]" || char === "}") {
      const open = stack.pop();
      if (char === "]" && open !== "[" || char === "}" && open !== "{") {
        structure("mal form\xE9es");
      }
      if (stack.length === 0) return i + 1;
    }
  }
  return structure("tronqu\xE9es");
}
function skipQuotedCode(source, start) {
  const quote = source[start];
  let escaped = false;
  for (let i = start + 1; i < source.length; i++) {
    if (escaped) escaped = false;
    else if (source[i] === "\\") escaped = true;
    else if (source[i] === quote) return i + 1;
  }
  return source.length;
}
function collectPushes(script, fragments) {
  const push = /self\s*\.\s*__next_f\s*\.\s*push\s*\(/g;
  let offset = 0;
  while (offset < script.length) {
    const char = script[offset];
    if (char === '"' || char === "'" || char === "`") {
      offset = skipQuotedCode(script, offset);
      continue;
    }
    if (script.startsWith("//", offset)) {
      const end = script.indexOf("\n", offset + 2);
      offset = end < 0 ? script.length : end + 1;
      continue;
    }
    if (script.startsWith("/*", offset)) {
      const end = script.indexOf("*/", offset + 2);
      offset = end < 0 ? script.length : end + 2;
      continue;
    }
    if (script.startsWith("self", offset) && (offset === 0 || !/[\w$.]/.test(script[offset - 1]))) {
      push.lastIndex = offset;
      const match = push.exec(script);
      if (match?.index === offset) {
        const start = skipSpace(script, push.lastIndex);
        if (script[start] !== "[") structure("non JSON");
        const end = compoundEnd(script, start);
        let value;
        try {
          value = JSON.parse(script.slice(start, end));
        } catch {
          structure("non JSON");
        }
        const close = skipSpace(script, end);
        if (script[close] !== ")") structure("non JSON");
        if (!Array.isArray(value)) structure("mal form\xE9es");
        if (value[0] === 1) {
          if (value.length !== 2 || typeof value[1] !== "string") {
            structure("de transport inconnues");
          }
          fragments.push(value[1]);
          if (fragments.length > MAX_RECORDS) structure("trop volumineuses");
        }
        offset = close + 1;
        continue;
      }
    }
    offset++;
  }
}
function extractStream(html) {
  if (html.length > MAX_HTML_LENGTH) structure("trop volumineuses");
  const fragments = [];
  const openScript = /<script\b[^>]*>/gi;
  const closeScript = /<\/script\s*>/gi;
  let match;
  while (match = openScript.exec(html)) {
    const start = openScript.lastIndex;
    closeScript.lastIndex = start;
    const close = closeScript.exec(html);
    if (!close) structure("tronqu\xE9es");
    const type = match[0].match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!type || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(type)) {
      collectPushes(html.slice(start, close.index), fragments);
    }
    openScript.lastIndex = closeScript.lastIndex;
  }
  if (fragments.length === 0) structure("absentes");
  const stream = fragments.join("");
  if (stream.length > MAX_STREAM_LENGTH) structure("trop volumineuses");
  return stream;
}
function utf8End(source, offset, byteLength) {
  let bytes = 0;
  while (bytes < byteLength && offset < source.length) {
    const first = source.charCodeAt(offset);
    let width = first < 128 ? 1 : first < 2048 ? 2 : 3;
    let units = 1;
    if (first >= 55296 && first <= 56319) {
      const second = source.charCodeAt(offset + 1);
      if (second >= 56320 && second <= 57343) {
        width = 4;
        units = 2;
      }
    }
    bytes += width;
    if (bytes > byteLength) structure("de longueur UTF-8 incoh\xE9rente");
    offset += units;
  }
  if (bytes !== byteLength) structure("tronqu\xE9es");
  return offset;
}
function readRecords(stream) {
  const records = /* @__PURE__ */ new Map();
  const textRecords = /* @__PURE__ */ new Set();
  let offset = 0;
  let count = 0;
  while (offset < stream.length) {
    if (stream[offset] === "\n" || stream[offset] === "\r") {
      offset++;
      continue;
    }
    const colon = stream.indexOf(":", offset);
    if (colon < 0 || colon - offset > 16) structure("de format inconnu");
    const id = stream.slice(offset, colon).toLowerCase();
    if (++count > MAX_RECORDS) structure("trop volumineuses");
    offset = colon + 1;
    if (id === "") {
      const newline = stream.indexOf("\n", offset);
      if (newline < 0) structure("tronqu\xE9es");
      const hint = stream.slice(offset, newline).trim();
      if (!/^H[DCLmXSM]/.test(hint)) structure("de format inconnu");
      const payload = hint.slice(2);
      if (payload[0] === "[" && compoundEnd(payload, 0) !== payload.length) {
        structure("mal form\xE9es");
      }
      let hintValue;
      try {
        hintValue = JSON.parse(payload);
      } catch {
        structure("non JSON");
      }
      if (typeof hintValue !== "string" && !Array.isArray(hintValue)) {
        structure("de format inconnu");
      }
      offset = newline + 1;
      continue;
    }
    if (!/^[0-9a-f]+$/.test(id)) structure("de format inconnu");
    let value;
    if (stream[offset] === "T") {
      const comma = stream.indexOf(",", offset + 1);
      if (comma < 0 || comma - offset > 9) structure("texte de format inconnu");
      const hex = stream.slice(offset + 1, comma);
      if (!/^[0-9a-f]+$/i.test(hex)) structure("texte de longueur inconnue");
      const byteLength = parseInt(hex, 16);
      if (byteLength > MAX_STREAM_LENGTH * 4) structure("trop volumineuses");
      const start = comma + 1;
      offset = utf8End(stream, start, byteLength);
      value = stream.slice(start, offset);
      textRecords.add(id);
    } else {
      const newline = stream.indexOf("\n", offset);
      const end = newline < 0 ? stream.length : newline;
      const payload = stream.slice(offset, end).trim();
      offset = newline < 0 ? stream.length : newline + 1;
      if (!/^[\[\{"0-9tfn-]/.test(payload)) continue;
      if (payload[0] === "[" || payload[0] === "{") {
        const literalEnd = compoundEnd(payload, 0);
        if (literalEnd !== payload.length) structure("mal form\xE9es");
      }
      try {
        value = JSON.parse(payload);
      } catch {
        structure("non JSON");
      }
    }
    if (records.has(id)) structure("avec identifiants dupliqu\xE9s");
    records.set(id, value);
  }
  if (records.size === 0) structure("sans objets lisibles");
  return { records, textRecords };
}
function resolveRecords(records, textRecords) {
  const resolved = /* @__PURE__ */ new Map();
  const resolving = /* @__PURE__ */ new Set();
  const resolvedObjects = /* @__PURE__ */ new WeakMap();
  const resolvingObjects = /* @__PURE__ */ new WeakSet();
  let nodes = 0;
  function resolveRecord(id, depth) {
    if (resolved.has(id)) return resolved.get(id);
    if (resolving.has(id)) structure("avec r\xE9f\xE9rences circulaires");
    resolving.add(id);
    const value = textRecords.has(id) ? records.get(id) : visit(records.get(id), depth);
    resolving.delete(id);
    resolved.set(id, value);
    return value;
  }
  function visit(value, depth) {
    if (depth > MAX_DEPTH || ++nodes > MAX_NODES) structure("trop complexes");
    if (typeof value === "string") {
      if (value.startsWith("$$")) return value.slice(1);
      if (value === "$undefined") return void 0;
      const ref = /^\$(?:L|@)?([0-9a-f]+)(?::(.+))?$/i.exec(value);
      if (!ref || !records.has(ref[1].toLowerCase())) return value;
      const id = ref[1].toLowerCase();
      if (ref[2]) {
        let target = records.get(id);
        let alreadyResolved = textRecords.has(id);
        for (const key of ref[2].split(":")) {
          if (!alreadyResolved && typeof target === "string") {
            target = visit(target, depth + 1);
            alreadyResolved = true;
          }
          if (target === null || typeof target !== "object" || !Object.prototype.hasOwnProperty.call(target, key)) {
            return value;
          }
          target = target[key];
        }
        return alreadyResolved ? target : visit(target, depth + 1);
      }
      return resolveRecord(id, depth + 1);
    }
    if (value !== null && typeof value === "object") {
      if (resolvedObjects.has(value)) return resolvedObjects.get(value);
      if (resolvingObjects.has(value)) structure("avec r\xE9f\xE9rences circulaires");
      resolvingObjects.add(value);
      let copy;
      if (Array.isArray(value)) {
        copy = value.map((item) => visit(item, depth + 1));
      } else {
        const object2 = {};
        for (const key of Object.keys(value)) {
          Object.defineProperty(object2, key, {
            value: visit(value[key], depth + 1),
            enumerable: true,
            writable: true,
            configurable: true
          });
        }
        copy = object2;
      }
      resolvingObjects.delete(value);
      resolvedObjects.set(value, copy);
      return copy;
    }
    return value;
  }
  return Array.from(records.keys(), (id) => resolveRecord(id, 0));
}
function parseFlight(html) {
  const { records, textRecords } = readRecords(extractStream(html));
  return resolveRecords(records, textRecords);
}
function findObjects(root, predicate) {
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  const stack = [{ value: root, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    const value = current.value;
    if (value === null || typeof value !== "object" || seen.has(value)) continue;
    if (current.depth > MAX_DEPTH || ++count > MAX_NODES) structure("trop complexes");
    seen.add(value);
    if (!Array.isArray(value) && predicate(value)) {
      found.push(value);
    }
    const children = Array.isArray(value) ? value : Object.values(value);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ value: children[i], depth: current.depth + 1 });
    }
  }
  return found;
}

// src/novel.ts
var import_cheerio = require("cheerio");
function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Structure du site modifi\xE9e : ${label} invalide.`);
  }
  return value;
}
function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Structure du site modifi\xE9e : ${label} manquant.`);
  }
  return value;
}
function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function encodePathComponent(value) {
  if (value === "." || value === "..") {
    throw new Error("Structure du site modifi\xE9e : identifiant de chemin invalide.");
  }
  try {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
  } catch {
    throw new Error("Structure du site modifi\xE9e : identifiant Unicode invalide.");
  }
}
function oeuvrePath(id) {
  return `/oeuvres/${encodePathComponent(id)}`;
}
function chapterPath(id, volumeId, chapterId) {
  return `/lecture/${encodePathComponent(id)}/volumes/${encodePathComponent(volumeId)}/chapitres/${encodePathComponent(chapterId)}`;
}
function finiteNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return void 0;
  if (typeof value === "string" && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return void 0;
  const parsed = typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER ? parsed : void 0;
}
function sourceChapterNumber(chapter, name, id) {
  for (const key of ["chapterNumber", "number", "numero"]) {
    if (chapter[key] !== void 0 && chapter[key] !== null) {
      const number = finiteNumber(chapter[key]);
      if (number === void 0) {
        throw new Error("Structure du site modifi\xE9e : num\xE9ro de chapitre invalide.");
      }
      return number;
    }
  }
  for (const text2 of [name, id]) {
    const match = text2.match(/(?:^|[^a-zÀ-ÿ])chapitre[\s_-]*(?:n[°ºo.]?[\s_-]*)?(\d+(?:[.,]\d+)?)(?!\d)/i);
    if (match) return finiteNumber(match[1]);
  }
  return void 0;
}
function naturalCompare(first, second) {
  const a = first.toLowerCase().match(/\d+(?:[.,]\d+)?|\D+/g) || [];
  const b = second.toLowerCase().match(/\d+(?:[.,]\d+)?|\D+/g) || [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const an = finiteNumber(a[i]);
    const bn = finiteNumber(b[i]);
    if (an !== void 0 && bn !== void 0) {
      if (an !== bn) return an - bn;
      continue;
    }
    return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}
function releaseDate(value) {
  if (typeof value !== "string") return void 0;
  const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!french && !iso) return void 0;
  const year = Number(french ? french[3] : iso[1]);
  const month = Number(french ? french[2] : iso[2]);
  const day = Number(french ? french[1] : iso[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return void 0;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function summaryText(value) {
  const text2 = optionalText(value);
  if (!text2) return void 0;
  const $ = (0, import_cheerio.load)(text2);
  $("script, style, iframe, object, embed, template, noscript").remove();
  $("br").replaceWith("\n");
  $("p, div, li, section").append("\n\n");
  return $.root().text().replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim() || void 0;
}
function coverUrl(value) {
  const text2 = optionalText(value);
  if (!text2) return void 0;
  if (/^https:\/\/[^\s]+$/i.test(text2)) return text2;
  if (/^\/[^/\s]/.test(text2)) return `https://world-novel.fr${text2}`;
  return void 0;
}
function sourceStatus(value) {
  const status = optionalText(value);
  if (!status) return void 0;
  const known = ["Unknown", "Ongoing", "Completed", "Licensed", "Publishing Finished", "Cancelled", "On Hiatus", "STUB", "Inactive"];
  if (known.includes(status)) return status;
  const french = {
    "en cours": "Ongoing",
    termine: "Completed",
    terminee: "Completed",
    acheve: "Completed",
    achevee: "Completed",
    annule: "Cancelled",
    annulee: "Cancelled",
    abandonne: "Cancelled",
    abandonnee: "Cancelled",
    "en pause": "On Hiatus",
    "sous licence": "Licensed"
  };
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(french, normalized) ? french[normalized] : void 0;
}
function parseOeuvre(value) {
  const oeuvre = object(value, "\u0153uvre");
  const id = requiredText(oeuvre.id, "identifiant de l\u2019\u0153uvre");
  const name = requiredText(oeuvre.title, "titre de l\u2019\u0153uvre").trim();
  if (!Array.isArray(oeuvre.volumes)) {
    throw new Error("Structure du site modifi\xE9e : liste des volumes absente.");
  }
  const records = [];
  const paths = /* @__PURE__ */ new Map();
  const volumeNames = /* @__PURE__ */ new Map();
  for (const rawVolume of oeuvre.volumes) {
    const volume = object(rawVolume, "volume");
    const volumeId = requiredText(volume.volumeId, "identifiant du volume");
    const volumeName = optionalText(volume.volumeDisplayName) || volumeId;
    const previousName = volumeNames.get(volumeId);
    if (previousName !== void 0 && previousName !== volumeName) {
      throw new Error("Structure du site modifi\xE9e : libell\xE9s de volume contradictoires.");
    }
    volumeNames.set(volumeId, volumeName);
    if (!Array.isArray(volume.chapters)) {
      throw new Error("Liste des chapitres incompl\xE8te : un volume ne contient pas sa liste.");
    }
    for (const rawChapter of volume.chapters) {
      const item = object(rawChapter, "chapitre");
      const chapterId = requiredText(item.id, "identifiant du chapitre");
      if (item.volumeId !== void 0 && item.volumeId !== volumeId) {
        throw new Error("Structure du site modifi\xE9e : volume du chapitre contradictoire.");
      }
      const title = optionalText(item.title) || chapterId;
      const path = chapterPath(id, volumeId, chapterId);
      const number = sourceChapterNumber(item, title, chapterId);
      const date = releaseDate(item.date);
      const existing = paths.get(path);
      if (existing) {
        if (existing.chapter.name !== title || existing.chapter.chapterNumber !== number) {
          throw new Error("Structure du site modifi\xE9e : chapitres dupliqu\xE9s contradictoires.");
        }
        if (!existing.chapter.releaseTime && date) existing.chapter.releaseTime = date;
        continue;
      }
      const chapter = { name: title, path };
      if (number !== void 0) chapter.chapterNumber = number;
      if (date) chapter.releaseTime = date;
      const record2 = { chapter, volumeId, volumeName, order: records.length };
      paths.set(path, record2);
      records.push(record2);
    }
  }
  if (oeuvre.totalChapters !== void 0 && oeuvre.totalChapters !== null) {
    const total = finiteNumber(oeuvre.totalChapters);
    if (total === void 0 || !Number.isInteger(total)) {
      throw new Error("Structure du site modifi\xE9e : total des chapitres invalide.");
    }
    if (records.length !== total) {
      throw new Error(`Liste des chapitres incompl\xE8te : ${records.length} chapitres uniques re\xE7us sur ${total} annonc\xE9s.`);
    }
  }
  records.sort((a, b) => {
    if (a.volumeId !== b.volumeId) {
      return naturalCompare(a.volumeName, b.volumeName) || naturalCompare(a.volumeId, b.volumeId) || (a.volumeId < b.volumeId ? -1 : 1);
    }
    return a.order - b.order;
  });
  for (let start = 0; start < records.length; ) {
    let end = start + 1;
    while (end < records.length && records[end].volumeId === records[start].volumeId) end++;
    const numbered = records.slice(start, end).filter((record2) => record2.chapter.chapterNumber !== void 0);
    numbered.sort((a, b) => a.chapter.chapterNumber - b.chapter.chapterNumber || a.order - b.order);
    let cursor = 0;
    for (let i = start; i < end; i++) {
      if (records[i].chapter.chapterNumber !== void 0) records[i] = numbered[cursor++];
    }
    start = end;
  }
  const numberedVolumes = /* @__PURE__ */ new Map();
  let hasVolumeReset = false;
  for (const record2 of records) {
    const number = record2.chapter.chapterNumber;
    if (number === void 0) continue;
    const previousVolume = numberedVolumes.get(number);
    if (previousVolume !== void 0 && previousVolume !== record2.volumeId) hasVolumeReset = true;
    numberedVolumes.set(number, record2.volumeId);
  }
  if (hasVolumeReset) {
    for (const record2 of records) {
      record2.chapter.name = `${record2.volumeName} \u2014 ${record2.chapter.name}`;
    }
  }
  const novel = { name, path: oeuvrePath(id), chapters: records.map((record2) => record2.chapter) };
  const cover = coverUrl(oeuvre.image);
  const summary = summaryText(oeuvre.description);
  const author = optionalText(oeuvre.auteur);
  const genres = optionalText(oeuvre.genre);
  const status = sourceStatus(oeuvre.status) || sourceStatus(oeuvre.statut);
  if (cover) novel.cover = cover;
  if (summary) novel.summary = summary;
  if (author) novel.author = author;
  if (genres) novel.genres = genres;
  if (status) novel.status = status;
  return novel;
}

// src/catalogue.ts
var import_cheerio2 = require("cheerio");
var SELECTION_PAGE_SIZE = 20;
function cleanText(text2) {
  return (text2 || "").replace(/\s+/g, " ").trim();
}
function canonicalOeuvrePath(href) {
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return void 0;
  const pathname = href.split(/[?#]/, 1)[0];
  const match = /^\/oeuvres\/([^/]+)\/?$/.exec(pathname);
  if (!match) return void 0;
  try {
    const id = decodeURIComponent(match[1]);
    if (!id.trim() || /[\u0000-\u001f\u007f\\]/.test(id)) return void 0;
    return oeuvrePath(id);
  } catch {
    return void 0;
  }
}
function coverUrl2(src) {
  if (!src || /[\s\u0000-\u001f\u007f\\]/.test(src)) return void 0;
  if (/^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(src)) return src;
  if (/^\/\/[^/?#@]+(?:[/?#]|$)/.test(src)) return `https:${src}`;
  if (/^\/[^/]/.test(src)) return `https://world-novel.fr${src}`;
  return void 0;
}
function extractHomeSelections(html) {
  if (typeof html !== "string") {
    throw new Error("Catalogue indisponible : r\xE9ponse HTML absente.");
  }
  const $ = (0, import_cheerio2.load)(html);
  $("script, style, template, noscript").remove();
  const selections = /* @__PURE__ */ new Map();
  $('a[href^="/oeuvres/"]').each((_, element) => {
    const link = $(element);
    const path = canonicalOeuvrePath(link.attr("href"));
    if (!path) return;
    const image = link.find("img").first();
    const name = cleanText(link.find("h2, h3").first().text()) || cleanText(image.attr("alt")) || cleanText(image.attr("title"));
    if (!name) return;
    const cover = coverUrl2(image.attr("src"));
    const existing = selections.get(path);
    if (existing) {
      if (!existing.cover && cover) existing.cover = cover;
      return;
    }
    const novel = { name, path };
    if (cover) novel.cover = cover;
    selections.set(path, novel);
  });
  if (!selections.size) {
    throw new Error("Catalogue indisponible : aucune s\xE9lection d\u2019accueil lisible. Une validation du site peut \xEAtre n\xE9cessaire, ou sa structure a chang\xE9.");
  }
  return Array.from(selections.values());
}
function paginateSelections(selections, pageNo) {
  if (!Number.isSafeInteger(pageNo) || pageNo < 1) {
    throw new Error("Num\xE9ro de page invalide : un entier positif est requis.");
  }
  const start = (pageNo - 1) * SELECTION_PAGE_SIZE;
  return selections.slice(start, start + SELECTION_PAGE_SIZE);
}

// src/plugin.ts
var import_storage = require("@libs/storage");

// src/search.ts
var MAX_CACHE_CHARS = 5e6;
var MAX_NOVELS = 1e4;
var PAGE_SIZE = 20;
var REFRESH = "Ouvrez la recherche WorldNovel dans le WebView, attendez son chargement, puis rechargez la page avant de fermer le WebView.";
function invalid() {
  throw new Error(`Index de recherche invalide ou structure du site modifi\xE9e. ${REFRESH}`);
}
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value;
}
function text(value, maxLength, required = false) {
  if (value === void 0 || value === null || value === "") {
    if (required) invalid();
    return void 0;
  }
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) invalid();
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized && required) invalid();
  return normalized || void 0;
}
function sourcePath(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value) || value === "." || value === "..") invalid();
  try {
    return `/oeuvres/${encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
  } catch {
    return invalid();
  }
}
function imageUrl(value) {
  const image = text(value, 8192);
  if (!image) return void 0;
  if (/[\s\\]/.test(image)) return void 0;
  if (/^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(image)) return image;
  if (/^\/\/[^/?#@]+(?:[/?#]|$)/.test(image)) return `https:${image}`;
  if (/^\/[^/]/.test(image)) return `https://world-novel.fr${image}`;
  return void 0;
}
function tags(value) {
  if (value === void 0 || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) invalid();
  return Array.from(new Set(value.map((tag) => text(tag, 256, true))));
}
function normalizeIndexSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function readSearchIndex(snapshot, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error("Date de validation de la recherche invalide.");
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || !Object.prototype.hasOwnProperty.call(snapshot, "searchCache")) {
    throw new Error(`Index de recherche absent. ${REFRESH}`);
  }
  const raw = snapshot.searchCache;
  if (raw === null || raw === void 0 || raw === "") {
    throw new Error(`Index de recherche absent. ${REFRESH}`);
  }
  if (typeof raw !== "string" || raw.length > MAX_CACHE_CHARS) invalid();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid();
  }
  const cache = record(parsed);
  const expires = cache.expiresAt;
  if (typeof expires !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expires)) invalid();
  const expiresAt = Date.parse(expires);
  if (!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString() !== expires) invalid();
  if (now >= expiresAt) {
    throw new Error(`Index de recherche expir\xE9. ${REFRESH}`);
  }
  const data = record(cache.data);
  if (!Array.isArray(data.novels) || data.novels.length > MAX_NOVELS) invalid();
  const byPath = /* @__PURE__ */ new Map();
  for (const rawNovel of data.novels) {
    const source = record(rawNovel);
    const path = sourcePath(source.id);
    const name = text(source.title, 1024, true);
    const cover = imageUrl(source.image);
    const author = text(source.auteur, 1024);
    const genres = text(source.genre, 2048);
    const labels = tags(source.tags);
    const existing = byPath.get(path);
    if (existing) {
      if (!existing.cover && cover) existing.cover = cover;
      if (!existing.author && author) existing.author = author;
      if (!existing.genres && genres) existing.genres = genres;
      existing.tags = Array.from(/* @__PURE__ */ new Set([...existing.tags, ...labels]));
      continue;
    }
    const item = { name, path, tags: labels };
    if (cover) item.cover = cover;
    if (author) item.author = author;
    if (genres) item.genres = genres;
    byPath.set(path, item);
  }
  return { items: Array.from(byPath.values()), expiresAt };
}
function searchCached(snapshot, query, pageNo, now = Date.now()) {
  if (!Number.isSafeInteger(pageNo) || pageNo < 1) throw new Error("Num\xE9ro de page de recherche invalide.");
  if (typeof query !== "string" || query.length > 2048) throw new Error("Recherche invalide : saisissez un texte de 2 048 caract\xE8res maximum.");
  const index = readSearchIndex(snapshot, now);
  const term = normalizeIndexSearch(query);
  if (!term) return [];
  const found = index.items.filter((item) => {
    const fields = [item.name, item.author || "", item.genres || "", ...item.tags];
    if (fields.some((field) => normalizeIndexSearch(field).includes(term))) return true;
    const initials = normalizeIndexSearch(item.name).split(/\s+/).map((word) => Array.from(word)[0] || "").join("");
    return initials.includes(term);
  });
  const start = (pageNo - 1) * PAGE_SIZE;
  return found.slice(start, start + PAGE_SIZE).map((item) => {
    const result = { name: item.name, path: item.path };
    if (item.cover) result.cover = item.cover;
    return result;
  });
}

// src/plugin.ts
var WorldNovelVNH = class {
  constructor() {
    this.id = metadata.id;
    this.name = metadata.name;
    this.version = metadata.version;
    this.site = metadata.site;
    this.lang = metadata.lang;
    this.icon = metadata.icon;
    this.webStorageUtilized = true;
  }
  resolveUrl(path) {
    if (!/^\/(?:oeuvres\/[^/?#]+|lecture\/[^/?#]+\/volumes\/[^/?#]+\/chapitres\/[^/?#]+)$/.test(path)) {
      throw Error("WorldNovel : chemin invalide.");
    }
    return this.site + path;
  }
  async popularNovels(pageNo) {
    if (!Number.isInteger(pageNo) || pageNo < 1) throw Error("WorldNovel : num\xE9ro de page invalide.");
    if (!this.homeCache || Date.now() - this.homeCache.time > 6e5) {
      const items = extractHomeSelections(await getPage(this.site + "/home"));
      this.homeCache = { time: Date.now(), items };
    }
    return paginateSelections(this.homeCache.items, pageNo);
  }
  async searchNovels(searchTerm, pageNo) {
    return searchCached(import_storage.localStorage.get(), searchTerm, pageNo);
  }
  async parseNovel(path) {
    if (!path.startsWith("/oeuvres/")) throw Error("WorldNovel : chemin de fiche invalide.");
    const rows = parseFlight(await getPage(this.resolveUrl(path)));
    const candidates = findObjects(rows, (value) => typeof value.id === "string" && Array.isArray(value.volumes) && typeof value.title === "string");
    const novels = candidates.map(parseOeuvre).filter((novel) => novel.path === path);
    if (novels.length !== 1) throw Error("WorldNovel : structure du site modifi\xE9e, fiche compl\xE8te introuvable.");
    return novels[0];
  }
  async parseChapter(path) {
    if (!path.startsWith("/lecture/")) throw Error("WorldNovel : chemin de chapitre invalide.");
    this.resolveUrl(path);
    throw Error("WorldNovel VNH exp\xE9rimental : lecture indisponible dans le plugin. Le lecteur exige Firebase Auth et App Check ; LNReader 2.1.3 ne fournit pas le pont navigateur n\xE9cessaire. Aucun chapitre t\xE9l\xE9charg\xE9.");
  }
};
var plugin_default = new WorldNovelVNH();
exports.default = module.exports.default;
