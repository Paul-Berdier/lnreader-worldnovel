import { load } from 'cheerio';
import { oeuvrePath } from './novel';

export interface NovelItem {
  name: string;
  path: string;
  cover?: string;
}

const SELECTION_PAGE_SIZE = 20;

function cleanText(text: string | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function canonicalOeuvrePath(href: string | undefined): string | undefined {
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return undefined;
  // Only the observed relative work routes are accepted. Queries and fragments
  // affect navigation, not the identity of a work.
  const pathname = href.split(/[?#]/, 1)[0];
  const match = /^\/oeuvres\/([^/]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  try {
    const id = decodeURIComponent(match[1]);
    if (!id.trim() || /[\u0000-\u001f\u007f\\]/.test(id)) return undefined;
    return oeuvrePath(id);
  } catch {
    return undefined;
  }
}

function coverUrl(src: string | undefined): string | undefined {
  if (!src || /[\s\u0000-\u001f\u007f\\]/.test(src)) return undefined;
  if (/^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(src)) return src;
  if (/^\/\/[^/?#@]+(?:[/?#]|$)/.test(src)) return `https:${src}`;
  if (/^\/[^/]/.test(src)) return `https://world-novel.fr${src}`;
  return undefined;
}

/** Extract only selections actually linked on the homepage, not a full catalogue. */
export function extractHomeSelections(html: string): NovelItem[] {
  if (typeof html !== 'string') {
    throw new Error('Catalogue indisponible : réponse HTML absente.');
  }
  const $ = load(html);
  $('script, style, template, noscript').remove();
  const selections = new Map<string, NovelItem>();
  $('a[href^="/oeuvres/"]').each((_, element) => {
    const link = $(element);
    const path = canonicalOeuvrePath(link.attr('href'));
    if (!path) return;
    const image = link.find('img').first();
    const name = cleanText(link.find('h2, h3').first().text()) ||
      cleanText(image.attr('alt')) || cleanText(image.attr('title'));
    // Neither a URL slug nor all the text of a card is a reliable title.
    if (!name) return;
    const cover = coverUrl(image.attr('src'));
    const existing = selections.get(path);
    if (existing) {
      if (!existing.cover && cover) existing.cover = cover;
      return;
    }
    const novel: NovelItem = { name, path };
    if (cover) novel.cover = cover;
    selections.set(path, novel);
  });
  if (!selections.size) {
    throw new Error('Catalogue indisponible : aucune sélection d’accueil lisible. Une validation du site peut être nécessaire, ou sa structure a changé.');
  }
  return Array.from(selections.values());
}

/** Local pagination of the extracted homepage selections only. */
export function paginateSelections(selections: NovelItem[], pageNo: number): NovelItem[] {
  if (!Number.isSafeInteger(pageNo) || pageNo < 1) {
    throw new Error('Numéro de page invalide : un entier positif est requis.');
  }
  const start = (pageNo - 1) * SELECTION_PAGE_SIZE;
  return selections.slice(start, start + SELECTION_PAGE_SIZE);
}

/** Future search helper; it does not establish or query a complete catalogue. */
export function normalizeSearch(text: string): string {
  return cleanText(text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}
