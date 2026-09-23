import { metadata } from './metadata';
import { getPage } from './network';
import { findObjects, parseFlight } from './flight';
import { parseOeuvre } from './novel';
import { extractHomeSelections, paginateSelections } from './catalogue';
import { localStorage } from '@libs/storage';
import { searchCached } from './search';

class WorldNovelVNH {
  readonly id = metadata.id;
  readonly name = metadata.name;
  readonly version = metadata.version;
  readonly site = metadata.site;
  readonly lang = metadata.lang;
  readonly icon = metadata.icon;
  readonly webStorageUtilized = true;
  private homeCache?: { time: number; items: ReturnType<typeof extractHomeSelections> };

  resolveUrl(path: string): string {
    // Paths supplied by the parser are already encoded; do not encode them again.
    if (!/^\/(?:oeuvres\/[^/?#]+|lecture\/[^/?#]+\/volumes\/[^/?#]+\/chapitres\/[^/?#]+)$/.test(path)) {
      throw Error('WorldNovel : chemin invalide.');
    }
    return this.site + path;
  }

  async popularNovels(pageNo: number) {
    if (!Number.isInteger(pageNo) || pageNo < 1) throw Error('WorldNovel : numéro de page invalide.');
    if (!this.homeCache || Date.now() - this.homeCache.time > 600_000) {
      const items = extractHomeSelections(await getPage(this.site + '/home'));
      this.homeCache = { time: Date.now(), items };
    }
    // These are homepage selections. A complete catalogue has not been verified.
    return paginateSelections(this.homeCache.items, pageNo);
  }

  async searchNovels(searchTerm: string, pageNo: number) {
    return searchCached(localStorage.get(), searchTerm, pageNo);
  }

  async parseNovel(path: string) {
    if (!path.startsWith('/oeuvres/')) throw Error('WorldNovel : chemin de fiche invalide.');
    const rows = parseFlight(await getPage(this.resolveUrl(path)));
    const candidates = findObjects(rows, value => typeof value.id === 'string' && Array.isArray(value.volumes) && typeof value.title === 'string');
    const novels = candidates.map(parseOeuvre).filter(novel => novel.path === path);
    if (novels.length !== 1) throw Error('WorldNovel : structure du site modifiée, fiche complète introuvable.');
    return novels[0];
  }

  async parseChapter(path: string): Promise<never> {
    if (!path.startsWith('/lecture/')) throw Error('WorldNovel : chemin de chapitre invalide.');
    this.resolveUrl(path);
    // Verified reader needs Firebase Auth + App Check, outside the stable plugin
    // bridge. Do not make futile calls or report a webpage as downloaded content.
    throw Error('WorldNovel VNH expérimental : lecture indisponible dans le plugin. Le lecteur exige Firebase Auth et App Check ; LNReader 2.1.3 ne fournit pas le pont navigateur nécessaire. Aucun chapitre téléchargé.');
  }
}

export default new WorldNovelVNH();
