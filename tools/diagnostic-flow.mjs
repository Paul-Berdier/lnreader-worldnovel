import { loadSource } from '../tests/helpers.mjs';

// Only project-controlled source is compiled/executed. Site JavaScript is not.
const { parseFlight, findObjects } = loadSource('src/flight.ts');
const { parseOeuvre } = loadSource('src/novel.ts');
const { extractHomeSelections } = loadSource('src/catalogue.ts');

export function inspectPublicHtml(html, kind) {
  if (typeof html !== 'string' || html.length > 12_000_000) throw Error('PUBLIC_DOCUMENT_SIZE_LIMIT');
  const rows = parseFlight(html);
  if (kind === 'home') {
    const selections = extractHomeSelections(html);
    return {
      summary: { flightRecordCount: rows.length, selectionCount: selections.length },
      // Kept in process memory for navigation only; never put this in a report.
      secondWorkPath: selections.find(item => item.path !== '/oeuvres/shadow-slave')?.path,
    };
  }
  const candidates = findObjects(rows, value => typeof value.id === 'string' && Array.isArray(value.volumes) && typeof value.title === 'string');
  if (candidates.length !== 1) throw Error('PUBLIC_DOCUMENT_AMBIGUOUS');
  const source = candidates[0];
  const parsed = parseOeuvre(source);
  return {
    summary: {
      flightRecordCount: rows.length,
      totalChapters: Number.isSafeInteger(source.totalChapters) && source.totalChapters >= 0 ? source.totalChapters : null,
      parsedChapterCount: parsed.chapters.length,
      volumeCount: source.volumes.length,
    },
    firstChapterPath: (parsed.chapters.find(chapter => chapter.chapterNumber === 1) || parsed.chapters[0])?.path,
  };
}

async function blockingReason(page) {
  let current;
  try { current = new URL(page.url()); } catch { return 'UNEXPECTED_NAVIGATION'; }
  if (current.origin !== 'https://world-novel.fr') return 'AUTHENTICATION_OR_EXTERNAL_REDIRECT';
  if (/\/(?:auth|login|signin|callback)(?:\/|$)/.test(current.pathname)) return 'AUTHENTICATION_REQUIRED';
  if (await page.locator('input[type="password"]:visible').count()) return 'AUTHENTICATION_REQUIRED';
  if (await page.locator('#challenge-form:visible, #cf-challenge-running:visible, iframe[src*="challenges.cloudflare.com"]:visible').count()) return 'MANUAL_CHALLENGE_REQUIRED';
  const title = await page.title();
  if (/just a moment|attention required|vérification de sécurité/i.test(title)) return 'MANUAL_CHALLENGE_REQUIRED';
  return null;
}

export async function runAuditFlow(page, report, checkpoint) {
  report.flow = [];
  let secondWorkPath;
  let firstChapterPath;
  async function step(name, action) {
    const item = { step: name, status: 'NOT_RUN' };
    report.flow.push(item);
    try {
      const blockedBefore = await blockingReason(page);
      if (blockedBefore) { item.status = 'BLOCKED'; item.reason = blockedBefore; return false; }
      await action(item);
      const blockedAfter = await blockingReason(page);
      if (blockedAfter) { item.status = 'BLOCKED'; item.reason = blockedAfter; return false; }
      item.status = 'PASS';
      return true;
    } catch {
      const reason = await blockingReason(page).catch(() => 'NAVIGATION_UNAVAILABLE');
      item.status = reason ? 'BLOCKED' : 'FAIL';
      item.reason = reason || 'EXPECTED_PAGE_OR_STRUCTURE_UNAVAILABLE';
      return false;
    } finally { await checkpoint(); }
  }

  if (!await step('home', async item => {
    await page.locator('button[aria-label="Rechercher"]:visible').first().waitFor({ timeout: 12_000 });
    const observation = inspectPublicHtml(await page.content(), 'home');
    item.counts = observation.summary;
    secondWorkPath = observation.secondWorkPath;
  })) return;

  if (!await step('search', async item => {
    await page.locator('button[aria-label="Rechercher"]:visible').first().click({ timeout: 5000 });
    await page.getByRole('textbox', { name: 'Champ de recherche', exact: true }).fill('Shadow Slave', { timeout: 5000 });
    await page.locator('#AYeIDY a[href="/oeuvres/shadow-slave"]:visible').first().waitFor({ timeout: 12_000 });
    item.evidence = 'SEARCH_RESULT_LINK_OBSERVED';
  })) return;

  if (!await step('novel', async item => {
    await page.locator('#AYeIDY a[href="/oeuvres/shadow-slave"]:visible').first().click({ timeout: 5000 });
    await page.waitForURL('https://world-novel.fr/oeuvres/shadow-slave', { timeout: 15_000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const observation = inspectPublicHtml(await page.content(), 'novel');
    item.counts = observation.summary;
    firstChapterPath = observation.firstChapterPath;
  })) return;

  if (firstChapterPath) {
    if (!await step('chapter-route', async item => {
      if (!/^\/lecture\/[^/?#]+\/volumes\/[^/?#]+\/chapitres\/[^/?#]+$/.test(firstChapterPath)) throw Error('INVALID_CHAPTER_ROUTE');
      // Normal navigation to the first route parsed from the work's own list.
      await page.goto('https://world-novel.fr' + firstChapterPath, { timeout: 20_000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      item.evidence = 'ROUTE_ONLY_CONTENT_NOT_VALIDATED';
      // No chapter DOM, HTML, text, screenshot or title is exported.
    })) return;
  } else {
    report.flow.push({ step: 'chapter-route', status: 'BLOCKED', reason: 'CHAPTER_LIST_EMPTY' });
    await checkpoint();
  }

  if (secondWorkPath && /^\/oeuvres\/[^/?#]+$/.test(secondWorkPath)) {
    await step('second-novel', async item => {
      await page.goto('https://world-novel.fr' + secondWorkPath, { timeout: 20_000, waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      item.counts = inspectPublicHtml(await page.content(), 'novel').summary;
    });
  } else {
    report.flow.push({ step: 'second-novel', status: 'NOT_RUN', reason: 'NO_SECOND_PUBLIC_WORK' });
    await checkpoint();
  }
}
