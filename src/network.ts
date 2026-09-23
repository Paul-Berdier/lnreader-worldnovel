import { fetchApi } from '@libs/fetch';

let cooldownUntil = 0;

export function checkPage(html: string): void {
  if (!html.trim()) throw Error('WorldNovel : réponse vide du site.');
  if (/cf-chl-|challenges\.cloudflare\.com|<title>\s*(?:Just a moment|Un instant)/i.test(html)) {
    throw Error('WorldNovel : validation à effectuer dans le navigateur intégré (Cloudflare).');
  }
  // A public Next.js page may include an optional authentication modal. Leave
  // Flight-bearing pages to the catalogue/novel parsers, which validate their
  // actual data; the presence of a password input alone does not gate reading.
  const hasFlightData = /self\s*\.\s*__next_f\s*\.\s*push\s*\(\s*\[\s*1\s*,/.test(html);
  if (!hasFlightData && /<form[^>]*[\s\S]*?type=["']password["']/i.test(html)) {
    throw Error('WorldNovel : connexion requise dans le navigateur intégré.');
  }
}

export async function getPage(url: string): Promise<string> {
  if (!/^https:\/\/world-novel\.fr\//.test(url)) throw Error('WorldNovel : URL externe refusée.');
  if (Date.now() < cooldownUntil) {
    throw Error('WorldNovel : limitation temporaire du nombre de requêtes. Réessayez plus tard.');
  }
  let response: Awaited<ReturnType<typeof fetchApi>>;
  try { response = await fetchApi(url); }
  catch { throw Error('WorldNovel : impossible de joindre le site. Vérifiez le WebView et votre connexion.'); }
  if (response.status === 429) {
    const value = response.headers.get('Retry-After');
    const delay = value && /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value || '') - Date.now();
    cooldownUntil = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 60_000);
    throw Error('WorldNovel : limitation temporaire du nombre de requêtes. Réessayez après le délai du site.');
  }
  if (response.status === 401) throw Error('WorldNovel : connexion requise ou session expirée ; reconnectez-vous dans le navigateur intégré.');
  if (response.status === 404) throw Error('WorldNovel : œuvre ou chapitre indisponible (404).');
  if (response.status === 403) throw Error('WorldNovel : accès refusé (403) ; vérifiez la validation et votre accès dans le navigateur intégré.');
  if (!response.ok) throw Error(`WorldNovel : erreur du site (HTTP ${response.status}).`);
  if (response.url && !/^https:\/\/world-novel\.fr(?:\/|$)/.test(response.url)) {
    throw Error('WorldNovel : le site redirige vers un autre service ; lecture indisponible.');
  }
  const text = await response.text();
  checkPage(text);
  return text;
}
