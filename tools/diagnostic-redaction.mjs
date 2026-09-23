/** Reporting helpers: no raw URL, arbitrary key, header or payload value survives. */
export const SITE_ORIGINS = new Set([
  'https://world-novel.fr',
  'https://cdn.world-novel.fr',
]);

const PATH_WORDS = new Set([
  'api', 'v1', 'v2', 'oeuvres', 'oeuvre', 'lecture', 'catalogue', 'catalog',
  'search', 'recherche', 'novels', 'novel', 'books', 'book', 'volumes', 'volume',
  'chapters', 'chapter', 'chapitres', 'chapitre', 'content', 'read', 'reader',
  'index', 'list', 'all', 'latest', 'popular', 'details', 'metadata', 'genres',
  'tags', 'covers', 'images', 'image', 'assets', '_next', 'static', 'chunks',
  'app', 'pages', 'data', 'works', 'work', 'get', 'public',
]);

const JSON_KEYS = new Set([
  'id', 'slug', 'title', 'name', 'url', 'path', 'href', 'type', 'data', 'items',
  'results', 'result', 'pagination', 'page', 'pageSize', 'perPage', 'limit',
  'offset', 'total', 'count', 'totalPages', 'hasNext', 'hasMore', 'nextPage',
  'nextCursor', 'cursor', 'prevPage', 'previousPage', 'novels', 'novel', 'books',
  'book', 'works', 'work', 'oeuvres', 'oeuvre', 'description', 'summary',
  'synopsis', 'author', 'authors', 'artist', 'cover', 'coverUrl', 'coverURL',
  'image', 'imageUrl', 'imageURL', 'thumbnail', 'genres', 'genre', 'tags',
  'status', 'language', 'lang', 'volumes', 'volume', 'volumeId', 'volumeName',
  'volumeDisplayName', 'chapters', 'chapter', 'chapterId', 'chapterNumber',
  'chapterTitle', 'number', 'index', 'order', 'totalChapters', 'lastChapter',
  'date', 'ts', 'createdAt', 'updatedAt', 'publishedAt', 'releaseDate',
  'content', 'html', 'text', 'body', 'paragraphs', 'preview', 'isPreview',
  'locked', 'isLocked', 'available', 'isAvailable', 'success', 'error',
  'errors', 'message', 'code', 'detail', 'props', 'pageProps', 'children',
  'initialData', 'initialWorks', 'initialNovel', 'initialChapters',
]);

const SENSITIVE_KEY = /(?:token|secret|passw|cookie|authorization|credential|email|phone|address|session|uid|userid|user_id|username|displayname|account|csrf|apikey|api_key|attestation)/i;
const PRIVATE_PATH = /(?:^|\/)(?:auth|authentication|login|logout|signin|signout|callback|oauth|oauth2|session|token|accounts?|profiles?|users?|me|analytics|tracking|telemetry|collect)(?:\/|$)/i;

function asUrl(value) {
  try { return new URL(value); } catch { return undefined; }
}

/** Mechanism labels only. Host, path and parameter values are never returned. */
export function classifyMechanisms(value) {
  const url = asUrl(value);
  if (!url) return [];
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const names = new Set();
  if (host === 'identitytoolkit.googleapis.com' || host === 'securetoken.googleapis.com') names.add('Firebase Authentication');
  if (host === 'firebaseappcheck.googleapis.com') names.add('Firebase App Check');
  if ((host === 'discord.com' || host === 'discordapp.com') && /oauth|authorize|login/.test(path)) names.add('Discord OAuth');
  if (host === 'challenges.cloudflare.com' || /\/cdn-cgi\/challenge-platform\//.test(path)) names.add('Cloudflare challenge');
  if ((host.endsWith('.google.com') || host.endsWith('.gstatic.com') || host === 'recaptcha.net') && /recaptcha/.test(path)) names.add('reCAPTCHA');
  if (/(?:^|\.)(?:google-analytics\.com|googletagmanager\.com|cloudflareinsights\.com|clarity\.ms|doubleclick\.net)$/.test(host) || /(?:^|\/)(?:analytics|tracking|telemetry|collect)(?:\/|$)/.test(path)) names.add('Analytics');
  if (SITE_ORIGINS.has(url.origin) && /(?:^|\/)(?:auth|login|signin|oauth|callback|session|token)(?:\/|$)/.test(path)) names.add('Site authentication route');
  return [...names].sort();
}

/** Only allowlisted origins and route words. All query strings are discarded. */
export function sanitiseEndpoint(value) {
  const url = asUrl(value);
  if (!url || !SITE_ORIGINS.has(url.origin) || url.username || url.password) return null;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return null; }
  if (PRIVATE_PATH.test(path) || classifyMechanisms(value).length) return null;
  const parts = path.split('/').filter(Boolean).map(part => {
    if (PATH_WORDS.has(part)) return part;
    if (/^\d+$/.test(part)) return ':number';
    if (/\.js$/i.test(part)) return ':script.js';
    if (/\.(?:jpg|jpeg|png|webp|avif|gif|svg)$/i.test(part)) return ':image';
    return ':value';
  });
  return { origin: url.origin, path: '/' + parts.join('/') };
}

export function sanitiseMethod(value) {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(value) ? value : 'OTHER';
}

export function classifyContentType(value = '') {
  const mime = value.toLowerCase().split(';')[0].trim();
  if (mime === 'application/json' || mime.endsWith('+json')) return 'json';
  if (mime === 'text/html') return 'html';
  if (['application/javascript', 'text/javascript', 'application/x-javascript'].includes(mime)) return 'javascript';
  if (mime === 'text/css') return 'css';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('font/')) return 'font';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}

/** Collect structure, never values; dynamic object keys are also confidential. */
export function summariseJson(value) {
  const keys = new Set();
  const types = new Set();
  let visited = 0;
  let unlistedKeyCount = 0;
  let sensitiveKeyCount = 0;
  let truncated = false;
  const typeOf = item => item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item;
  function visit(item, depth) {
    if (++visited > 500 || depth > 8) { truncated = true; return; }
    types.add(typeOf(item));
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      if (item.length > 3) truncated = true;
      for (const entry of item.slice(0, 3)) visit(entry, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      // A known, non-personal volumeDisplayName is a schema name, never its value.
      if (key !== 'volumeDisplayName' && SENSITIVE_KEY.test(key)) { sensitiveKeyCount++; continue; }
      if (!JSON_KEYS.has(key)) { unlistedKeyCount++; continue; }
      keys.add(key);
      visit(child, depth + 1);
      if (visited > 500) break;
    }
  }
  visit(value, 0);
  return { rootType: typeOf(value), keys: [...keys].sort(), valueTypes: [...types].sort(), unlistedKeyCount, sensitiveKeyCount, truncated };
}

export function isPublicClientScript(value) {
  const url = asUrl(value);
  return Boolean(url && url.origin === 'https://world-novel.fr' && !url.username && !url.password && !url.search && !url.hash
    && /^\/_next\/static\/[A-Za-z0-9_./%\[\]@()+-]+\.js$/.test(url.pathname));
}

/** Parse only JSON push arguments. No eval/Function or execution of page scripts. */
export function summariseEmbeddedJson(scriptTexts) {
  const summaries = [];
  let nextFlightChunks = 0;
  let malformedJsonCandidates = 0;
  let flight = '';
  for (const text of scriptTexts.slice(0, 300)) {
    if (typeof text !== 'string' || text.length > 4_000_000) continue;
    if (/^\s*[\[{]/.test(text)) {
      try { summaries.push(summariseJson(JSON.parse(text))); } catch { malformedJsonCandidates++; }
      continue;
    }
    const marker = 'self.__next_f.push(';
    let start = text.indexOf(marker);
    while (start !== -1) {
      const jsonStart = start + marker.length;
      let quoted = false;
      let escaped = false;
      let depth = 0;
      let end = -1;
      for (let i = jsonStart; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === '[' || char === '{') depth++;
        else if (char === ']' || char === '}') { if (--depth === 0) { end = i + 1; break; } }
      }
      if (end === -1) { malformedJsonCandidates++; break; }
      try {
        const args = JSON.parse(text.slice(jsonStart, end));
        if (Array.isArray(args) && args[0] === 1 && typeof args[1] === 'string') {
          nextFlightChunks++;
          if (flight.length + args[1].length <= 8_000_000) flight += args[1];
        }
      } catch { malformedJsonCandidates++; }
      start = text.indexOf(marker, end);
    }
  }
  for (const row of flight.split('\n').slice(0, 3000)) {
    const colon = row.indexOf(':');
    if (colon < 1 || !/^[a-f0-9]+$/i.test(row.slice(0, colon))) continue;
    const candidate = row.slice(colon + 1);
    if (!/^[\[{]/.test(candidate)) continue;
    try { summaries.push(summariseJson(JSON.parse(candidate))); } catch { malformedJsonCandidates++; }
  }
  return { nextFlightChunks, jsonPayloads: summaries.length, keys: [...new Set(summaries.flatMap(summary => summary.keys))].sort(), malformedJsonCandidates };
}
