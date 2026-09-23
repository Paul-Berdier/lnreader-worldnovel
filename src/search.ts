// The website's SearchModal stores its Firestore sauvegarde/userpage document
// in localStorage.searchCache. This module reads that one cache from the
// LNReader WebView snapshot; it never reads cookies, auth tokens or IndexedDB.

export interface SearchNovelItem {
  name: string;
  path: string;
  cover?: string;
}

export interface IndexedNovel extends SearchNovelItem {
  author?: string;
  genres?: string;
  tags: string[];
}

export interface SearchIndex {
  items: IndexedNovel[];
  expiresAt: number;
}

const MAX_CACHE_CHARS = 5_000_000;
const MAX_NOVELS = 10_000;
const PAGE_SIZE = 20;
const REFRESH = 'Ouvrez la recherche WorldNovel dans le WebView, attendez son chargement, puis rechargez la page avant de fermer le WebView.';

type RecordValue = Record<string, unknown>;

function invalid(): never {
  throw new Error(`Index de recherche invalide ou structure du site modifiée. ${REFRESH}`);
}

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as RecordValue;
}

function text(value: unknown, maxLength: number, required = false): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) invalid();
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) invalid();
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized && required) invalid();
  return normalized || undefined;
}

function sourcePath(value: unknown): string {
  // IDs are raw Firestore source IDs, not URL components: do not decode them.
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value) || value === '.' || value === '..') invalid();
  try {
    return `/oeuvres/${encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
  } catch {
    return invalid();
  }
}

function imageUrl(value: unknown): string | undefined {
  const image = text(value, 8192);
  if (!image) return undefined;
  if (/[\s\\]/.test(image)) return undefined;
  if (/^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(image)) return image;
  if (/^\/\/[^/?#@]+(?:[/?#]|$)/.test(image)) return `https:${image}`;
  if (/^\/[^/]/.test(image)) return `https://world-novel.fr${image}`;
  return undefined;
}

function tags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) invalid();
  return Array.from(new Set(value.map(tag => text(tag, 256, true)!)));
}

/** Accent-insensitive French search; retain Unicode text outside combining accents. */
export function normalizeIndexSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function readSearchIndex(snapshot: unknown, now = Date.now()): SearchIndex {
  if (!Number.isFinite(now)) throw new Error('Date de validation de la recherche invalide.');
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || !Object.prototype.hasOwnProperty.call(snapshot, 'searchCache')) {
    throw new Error(`Index de recherche absent. ${REFRESH}`);
  }
  const raw = (snapshot as RecordValue).searchCache;
  if (raw === null || raw === undefined || raw === '') {
    throw new Error(`Index de recherche absent. ${REFRESH}`);
  }
  if (typeof raw !== 'string' || raw.length > MAX_CACHE_CHARS) invalid();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid();
  }
  const cache = record(parsed);
  const expires = cache.expiresAt;
  // This exact UTC shape is emitted by the observed site code's toISOString().
  if (typeof expires !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expires)) invalid();
  const expiresAt = Date.parse(expires);
  if (!Number.isFinite(expiresAt) || new Date(expiresAt).toISOString() !== expires) invalid();
  if (now >= expiresAt) {
    throw new Error(`Index de recherche expiré. ${REFRESH}`);
  }
  const data = record(cache.data);
  if (!Array.isArray(data.novels) || data.novels.length > MAX_NOVELS) invalid();
  const byPath = new Map<string, IndexedNovel>();
  for (const rawNovel of data.novels) {
    const source = record(rawNovel);
    const path = sourcePath(source.id);
    const name = text(source.title, 1024, true)!;
    const cover = imageUrl(source.image);
    const author = text(source.auteur, 1024);
    const genres = text(source.genre, 2048);
    const labels = tags(source.tags);
    const existing = byPath.get(path);
    if (existing) {
      if (!existing.cover && cover) existing.cover = cover;
      if (!existing.author && author) existing.author = author;
      if (!existing.genres && genres) existing.genres = genres;
      existing.tags = Array.from(new Set([...existing.tags, ...labels]));
      continue;
    }
    const item: IndexedNovel = { name, path, tags: labels };
    if (cover) item.cover = cover;
    if (author) item.author = author;
    if (genres) item.genres = genres;
    byPath.set(path, item);
  }
  return { items: Array.from(byPath.values()), expiresAt };
}

/** Search the whole site search index, never the homepage's selected titles. */
export function searchCached(snapshot: unknown, query: string, pageNo: number, now = Date.now()): SearchNovelItem[] {
  if (!Number.isSafeInteger(pageNo) || pageNo < 1) throw new Error('Numéro de page de recherche invalide.');
  if (typeof query !== 'string' || query.length > 2048) throw new Error('Recherche invalide : saisissez un texte de 2 048 caractères maximum.');
  const index = readSearchIndex(snapshot, now);
  const term = normalizeIndexSearch(query);
  // The site's SearchModal does not list results for an empty search.
  if (!term) return [];
  const found = index.items.filter(item => {
    const fields = [item.name, item.author || '', item.genres || '', ...item.tags];
    if (fields.some(field => normalizeIndexSearch(field).includes(term))) return true;
    const initials = normalizeIndexSearch(item.name).split(/\s+/).map(word => Array.from(word)[0] || '').join('');
    return initials.includes(term);
  });
  const start = (pageNo - 1) * PAGE_SIZE;
  return found.slice(start, start + PAGE_SIZE).map(item => {
    const result: SearchNovelItem = { name: item.name, path: item.path };
    if (item.cover) result.cover = item.cover;
    return result;
  });
}
