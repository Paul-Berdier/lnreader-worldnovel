import { load } from 'cheerio';

export interface ChapterItem {
  name: string;
  path: string;
  chapterNumber?: number;
  releaseTime?: string;
}

export type NovelStatusValue = 'Unknown' | 'Ongoing' | 'Completed' | 'Licensed' |
  'Publishing Finished' | 'Cancelled' | 'On Hiatus' | 'STUB' | 'Inactive';

export interface SourceNovel {
  name: string;
  path: string;
  cover?: string;
  summary?: string;
  author?: string;
  genres?: string;
  status?: NovelStatusValue;
  chapters: ChapterItem[];
}

type RecordValue = Record<string, unknown>;
type ChapterRecord = {
  chapter: ChapterItem;
  volumeId: string;
  volumeName: string;
  order: number;
};

function object(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Structure du site modifiée : ${label} invalide.`);
  }
  return value as RecordValue;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Structure du site modifiée : ${label} manquant.`);
  }
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Input is always a raw source identifier, never a URL component. */
export function encodePathComponent(value: string): string {
  if (value === '.' || value === '..') {
    throw new Error('Structure du site modifiée : identifiant de chemin invalide.');
  }
  try {
    return encodeURIComponent(value).replace(/[!'()*]/g, char =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  } catch {
    throw new Error('Structure du site modifiée : identifiant Unicode invalide.');
  }
}

export function oeuvrePath(id: string): string {
  return `/oeuvres/${encodePathComponent(id)}`;
}

export function chapterPath(id: string, volumeId: string, chapterId: string): string {
  return `/lecture/${encodePathComponent(id)}/volumes/${encodePathComponent(volumeId)}/chapitres/${encodePathComponent(chapterId)}`;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER
    ? parsed
    : undefined;
}

function sourceChapterNumber(chapter: RecordValue, name: string, id: string): number | undefined {
  for (const key of ['chapterNumber', 'number', 'numero']) {
    if (chapter[key] !== undefined && chapter[key] !== null) {
      const number = finiteNumber(chapter[key]);
      if (number === undefined) {
        throw new Error('Structure du site modifiée : numéro de chapitre invalide.');
      }
      return number;
    }
  }
  for (const text of [name, id]) {
    const match = text.match(/(?:^|[^a-zÀ-ÿ])chapitre[\s_-]*(?:n[°ºo.]?[\s_-]*)?(\d+(?:[.,]\d+)?)(?!\d)/i);
    if (match) return finiteNumber(match[1]);
  }
  return undefined;
}

/** Compare digit runs numerically without depending on a device's locale. */
function naturalCompare(first: string, second: string): number {
  const a = first.toLowerCase().match(/\d+(?:[.,]\d+)?|\D+/g) || [];
  const b = second.toLowerCase().match(/\d+(?:[.,]\d+)?|\D+/g) || [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const an = finiteNumber(a[i]);
    const bn = finiteNumber(b[i]);
    if (an !== undefined && bn !== undefined) {
      if (an !== bn) return an - bn;
      continue;
    }
    return a[i] < b[i] ? -1 : 1;
  }
  return a.length - b.length;
}

function releaseDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!french && !iso) return undefined;
  const year = Number(french ? french[3] : iso![1]);
  const month = Number(french ? french[2] : iso![2]);
  const day = Number(french ? french[1] : iso![3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return undefined;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function summaryText(value: unknown): string | undefined {
  const text = optionalText(value);
  if (!text) return undefined;
  const $ = load(text);
  $('script, style, iframe, object, embed, template, noscript').remove();
  $('br').replaceWith('\n');
  $('p, div, li, section').append('\n\n');
  return $.root().text().replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || undefined;
}

function coverUrl(value: unknown): string | undefined {
  const text = optionalText(value);
  if (!text) return undefined;
  // Reject executable URL schemes without using browser-only URL APIs.
  if (/^https:\/\/[^\s]+$/i.test(text)) return text;
  if (/^\/[^/\s]/.test(text)) return `https://world-novel.fr${text}`;
  return undefined;
}

function sourceStatus(value: unknown): NovelStatusValue | undefined {
  const status = optionalText(value);
  if (!status) return undefined;
  // Exact values from LNReader v2.1.3 src/plugins/types/index.ts. Never infer a
  // status from chapter counts or invent one when the source does not provide it.
  const known: NovelStatusValue[] = ['Unknown', 'Ongoing', 'Completed', 'Licensed', 'Publishing Finished', 'Cancelled', 'On Hiatus', 'STUB', 'Inactive'];
  if (known.includes(status as NovelStatusValue)) return status as NovelStatusValue;
  const french: Record<string, NovelStatusValue> = {
    'en cours': 'Ongoing',
    termine: 'Completed',
    terminee: 'Completed',
    acheve: 'Completed',
    achevee: 'Completed',
    annule: 'Cancelled',
    annulee: 'Cancelled',
    abandonne: 'Cancelled',
    abandonnee: 'Cancelled',
    'en pause': 'On Hiatus',
    'sous licence': 'Licensed',
  };
  const normalized = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(french, normalized) ? french[normalized] : undefined;
}

export function parseOeuvre(value: unknown): SourceNovel {
  const oeuvre = object(value, 'œuvre');
  const id = requiredText(oeuvre.id, 'identifiant de l’œuvre');
  const name = requiredText(oeuvre.title, 'titre de l’œuvre').trim();
  if (!Array.isArray(oeuvre.volumes)) {
    throw new Error('Structure du site modifiée : liste des volumes absente.');
  }
  const records: ChapterRecord[] = [];
  const paths = new Map<string, ChapterRecord>();
  const volumeNames = new Map<string, string>();

  for (const rawVolume of oeuvre.volumes) {
    const volume = object(rawVolume, 'volume');
    const volumeId = requiredText(volume.volumeId, 'identifiant du volume');
    const volumeName = optionalText(volume.volumeDisplayName) || volumeId;
    const previousName = volumeNames.get(volumeId);
    if (previousName !== undefined && previousName !== volumeName) {
      throw new Error('Structure du site modifiée : libellés de volume contradictoires.');
    }
    volumeNames.set(volumeId, volumeName);
    if (!Array.isArray(volume.chapters)) {
      throw new Error('Liste des chapitres incomplète : un volume ne contient pas sa liste.');
    }
    for (const rawChapter of volume.chapters) {
      const item = object(rawChapter, 'chapitre');
      const chapterId = requiredText(item.id, 'identifiant du chapitre');
      if (item.volumeId !== undefined && item.volumeId !== volumeId) {
        throw new Error('Structure du site modifiée : volume du chapitre contradictoire.');
      }
      const title = optionalText(item.title) || chapterId;
      const path = chapterPath(id, volumeId, chapterId);
      const number = sourceChapterNumber(item, title, chapterId);
      const date = releaseDate(item.date);
      const existing = paths.get(path);
      if (existing) {
        if (existing.chapter.name !== title || existing.chapter.chapterNumber !== number) {
          throw new Error('Structure du site modifiée : chapitres dupliqués contradictoires.');
        }
        if (!existing.chapter.releaseTime && date) existing.chapter.releaseTime = date;
        continue;
      }
      const chapter: ChapterItem = { name: title, path };
      if (number !== undefined) chapter.chapterNumber = number;
      if (date) chapter.releaseTime = date;
      const record = { chapter, volumeId, volumeName, order: records.length };
      paths.set(path, record);
      records.push(record);
    }
  }

  if (oeuvre.totalChapters !== undefined && oeuvre.totalChapters !== null) {
    const total = finiteNumber(oeuvre.totalChapters);
    if (total === undefined || !Number.isInteger(total)) {
      throw new Error('Structure du site modifiée : total des chapitres invalide.');
    }
    if (records.length !== total) {
      throw new Error(`Liste des chapitres incomplète : ${records.length} chapitres uniques reçus sur ${total} annoncés.`);
    }
  }

  records.sort((a, b) => {
    if (a.volumeId !== b.volumeId) {
      return naturalCompare(a.volumeName, b.volumeName) || naturalCompare(a.volumeId, b.volumeId) || (a.volumeId < b.volumeId ? -1 : 1);
    }
    return a.order - b.order;
  });

  // Sort the numbered entries in each volume, retaining the source slots of
  // interludes without numbers. Mixing index and numeric comparisons in one
  // comparator would be non-transitive and produce unpredictable ordering.
  for (let start = 0; start < records.length;) {
    let end = start + 1;
    while (end < records.length && records[end].volumeId === records[start].volumeId) end++;
    const numbered = records.slice(start, end).filter(record => record.chapter.chapterNumber !== undefined);
    numbered.sort((a, b) => a.chapter.chapterNumber! - b.chapter.chapterNumber! || a.order - b.order);
    let cursor = 0;
    for (let i = start; i < end; i++) {
      if (records[i].chapter.chapterNumber !== undefined) records[i] = numbered[cursor++];
    }
    start = end;
  }

  // Source numbers are volume-local when they repeat. Never invent global numbers.
  const numberedVolumes = new Map<number, string>();
  let hasVolumeReset = false;
  for (const record of records) {
    const number = record.chapter.chapterNumber;
    if (number === undefined) continue;
    const previousVolume = numberedVolumes.get(number);
    if (previousVolume !== undefined && previousVolume !== record.volumeId) hasVolumeReset = true;
    numberedVolumes.set(number, record.volumeId);
  }
  if (hasVolumeReset) {
    for (const record of records) {
      // Keep authentic volume-local numbers. LNReader would replace an absent
      // number with index + 1, fabricating global numbering (ChapterQueries:78).
      record.chapter.name = `${record.volumeName} — ${record.chapter.name}`;
    }
  }

  const novel: SourceNovel = { name, path: oeuvrePath(id), chapters: records.map(record => record.chapter) };
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
