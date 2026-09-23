#!/usr/bin/env node
import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { createConnection, createServer } from 'node:net';
import { chromium } from 'playwright';
import {
  classifyContentType, classifyMechanisms, isPublicClientScript,
  sanitiseEndpoint, sanitiseMethod, summariseEmbeddedJson, summariseJson,
} from './diagnostic-redaction.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, '.local');
const reportPath = path.join(local, 'diagnostic-redacted.json');
const publicScriptsPath = path.join(root, '.research', 'site');
const args = new Set(process.argv.slice(2));
const profile = path.join(local, args.has('--manual-browser') ? 'browser-profile-chrome-manual' : args.has('--chrome') ? 'browser-profile-chrome' : 'browser-profile');
const permittedArgs = new Set(['--public-audit', '--audit-flow', '--chapter-audit', '--save-public-scripts', '--chrome', '--edge', '--manual-browser', '--help']);
if ([...args].some(arg => !permittedArgs.has(arg)) || (args.has('--chrome') && args.has('--edge')) || ['--audit-flow','--public-audit','--chapter-audit'].filter(arg => args.has(arg)).length > 1) {
  console.error('Option invalide. Voir node tools/diagnose.mjs --help.');
  process.exit(2);
}
if (args.has('--help')) {
  console.log('node tools/diagnose.mjs [--public-audit|--audit-flow|--chapter-audit] [--save-public-scripts] [--edge|--chrome] [--manual-browser]\nProfil dédié sous .local/. Rapport expurgé .local/diagnostic-redacted.json.\nMode interactif : naviguer normalement puis appuyer sur Entrée dans ce terminal.\n--public-audit : fiche Shadow Slave, observation 12 secondes, fermeture automatique.\n--audit-flow : accueil, recherche Shadow Slave, fiche, une route de chapitre, autre fiche ; arrêt en cas de CAPTCHA/connexion.\n--chapter-audit : fiche, une route de chapitre observée, seconde fiche ; structure uniquement, aucun texte exporté.\n--manual-browser --chrome : Chrome standard dédié, connexion DevTools locale.\n--save-public-scripts : scripts publics /_next/static/*.js dans .research/site.');
  process.exit(0);
}

const report = {
  formatVersion: 1,
  mode: args.has('--chapter-audit') ? 'chapter-audit' : args.has('--audit-flow') ? 'audit-flow' : args.has('--public-audit') ? 'public-audit' : 'interactive',
  generatedAt: new Date().toISOString(),
  privacy: 'No headers, cookies, queries, personal identifiers, payload values, chapter text, screenshots, HAR or session exports.',
  authentication: 'NOT_VERIFIED',
  chapterReading: 'NOT_VERIFIED',
  events: [],
  mechanisms: [],
  document: null,
  publicScriptsSaved: 0,
  warnings: [],
};
const mechanisms = new Set();
const events = new Map();
const pending = new Set();
const savedScripts = new Set();
const scriptManifest = new Map();
let scriptManifestWrites = Promise.resolve();
let context;
let dedicatedBrowser;
let dedicatedPort;
let dedicatedChild;
let stopping = false;
let eventLimitReached = false;
let writes = Promise.resolve();
let sampleChapterPath;
let metadataResolved;
const metadataReady = new Promise(resolve => { metadataResolved = resolve; });

function checkpoint() {
  report.events = [...events.values()];
  report.mechanisms = [...mechanisms].sort();
  const safeJson = JSON.stringify(report, null, 2) + '\n';
  writes = writes.then(async () => {
    await mkdir(local, { recursive: true });
    await writeFile(reportPath + '.tmp', safeJson, { mode: 0o600 });
    await rename(reportPath + '.tmp', reportPath);
  }).catch(() => warn('REPORT_WRITE_FAILED'));
  return writes;
}

async function portIsOpen(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = open => { socket.destroy(); resolve(open); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}

function warn(code) { if (!report.warnings.includes(code)) report.warnings.push(code); }
function track(promise) {
  const safe = promise.catch(() => warn('OBSERVATION_FAILED')).finally(() => pending.delete(safe));
  pending.add(safe);
}

async function findBrowser() {
  const candidates = args.has('--chrome') ? [
    ['chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    ['chrome', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  ] : args.has('--edge') ? [
    ['msedge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    ['msedge', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'],
  ] : [
    ['msedge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    ['msedge', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'],
    ['chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    ['chrome', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  ];
  for (const [channel, executablePath] of candidates) {
    try { await access(executablePath); return { channel, executablePath }; } catch { /* Try the next installed browser. */ }
  }
  throw new Error('BROWSER_NOT_FOUND');
}

async function observeResponse(response) {
  const request = response.request();
  const url = response.url();
  for (const name of classifyMechanisms(url)) mechanisms.add(name);
  const endpoint = sanitiseEndpoint(url);
  if (!endpoint) return;
  // Only the content type is inspected, never authentication or cookie headers.
  const contentType = classifyContentType(await response.headerValue('content-type') || '');
  const status = response.status();
  const method = sanitiseMethod(request.method());
  const resourceType = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'xhr', 'fetch', 'other'].includes(request.resourceType()) ? request.resourceType() : 'other';
  const key = JSON.stringify([endpoint, method, status, contentType, resourceType]);
  let event = events.get(key);
  if (!event) {
    if (events.size >= 300) { eventLimitReached = true; return; }
    event = { ...endpoint, method, status, contentType, resourceType, occurrences: 0 };
    events.set(key, event);
  }
  event.occurrences++;
  const pathname = new URL(url).pathname;
  if (args.has('--chapter-audit') && status === 200 && resourceType === 'document' && contentType === 'html' && pathname.startsWith('/lecture/')) {
    // Inspect structure in memory only, including public code asset URLs. Never
    // export the HTML, chapter strings, title, user identity or inline scripts.
    try {
      const { load } = await import('cheerio');
      const html = await response.text();
      const $ = load(html);
      const assets = [];
      $('script[src]').each((_, element) => {
        try {
          const asset = new URL($(element).attr('src'), 'https://world-novel.fr');
          if (['https://world-novel.fr','https://cdn.world-novel.fr'].includes(asset.origin) && !asset.search && !asset.hash && !asset.username && !asset.password && /\.js$/.test(asset.pathname)) assets.push(asset.origin + asset.pathname);
        } catch { /* Invalid or private URL is excluded. */ }
      });
      report.chapterStructure = {
        hasFlight: html.includes('self.__next_f.push('),
        paragraphCount: $('p').length,
        articleCount: $('article').length,
        scriptSources: [...new Set(assets)],
        inlineScriptCount: $('script:not([src])').length,
        containsAppCheckCode: /appCheck|AppCheck|firebase-app-check/.test(html),
        containsFetchCode: /fetch\s*\(/.test(html),
        containsDiscordRedirect: /(?:location|redirect)[\s\S]{0,180}discord\.(?:gg|com)/.test(html),
      };
      await checkpoint();
    } catch { warn('CHAPTER_STRUCTURE_UNAVAILABLE'); }
  }
  if (status === 200 && resourceType === 'document' && contentType === 'html' &&
      (pathname === '/home' || pathname === '/oeuvres/shadow-slave' || pathname === '/oeuvres/the-mech-touch')) {
    try {
      // Public metadata response only, in memory. Never persist the HTML.
      const { inspectPublicHtml } = await import('./diagnostic-flow.mjs');
      const kind = pathname === '/home' ? 'home' : 'novel';
      const inspection = inspectPublicHtml(await response.text(), kind);
      report.publicMetadata = { kind, status: 'PASS', counts: inspection.summary };
      report.publicMetadataChecks ||= [];
      report.publicMetadataChecks.push({ work: pathname === '/oeuvres/the-mech-touch' ? 'secondary' : 'primary', ...report.publicMetadata });
      if (pathname === '/oeuvres/shadow-slave') sampleChapterPath = inspection.firstChapterPath;
    } catch (error) {
      // Only fixed errors from our parsers can reach the report; no response value.
      const message = String(error?.message || '');
      const safe = /^Structure du site modifiée : données Next\.js [a-zA-ZÀ-ÿ0-9 .-]+\.$/.test(message) ||
        /^Liste des chapitres incomplète : \d+ chapitres uniques reçus sur \d+ annoncés\.$/.test(message);
      report.publicMetadata = { status: 'FAIL', reason: 'PUBLIC_METADATA_PARSE_FAILED', ...(safe ? { parserError: message } : {}) };
    }
    if (pathname === '/oeuvres/shadow-slave') metadataResolved();
    await checkpoint();
  }
  if (status >= 200 && status < 300 && contentType === 'json' && !event.json) {
    try {
      const body = await response.body();
      if (body.length <= 2_000_000) event.json = summariseJson(JSON.parse(body.toString('utf8')));
      else event.jsonInspection = 'SKIPPED_SIZE_LIMIT';
    } catch { event.jsonInspection = 'UNAVAILABLE_OR_NON_JSON'; }
  }
  if (args.has('--save-public-scripts') && status === 200 && contentType === 'javascript' && resourceType === 'script' && isPublicClientScript(url) && !savedScripts.has(url)) {
    savedScripts.add(url);
    if (savedScripts.size > 80) { warn('PUBLIC_SCRIPT_COUNT_LIMIT'); return; }
    try {
      const bytes = await response.body();
      if (bytes.length > 5_000_000) { warn('PUBLIC_SCRIPT_SIZE_LIMIT'); return; }
      const basename = createHash('sha256').update(new URL(url).pathname).digest('hex').slice(0, 24) + '.js';
      await mkdir(publicScriptsPath, { recursive: true });
      await writeFile(path.join(publicScriptsPath, basename), bytes);
      const publicUrl = new URL(url);
      scriptManifest.set(publicUrl.origin + publicUrl.pathname, { url: publicUrl.origin + publicUrl.pathname, filename: basename });
      scriptManifestWrites = scriptManifestWrites.then(() => writeFile(
        path.join(publicScriptsPath, 'scripts-manifest.json'),
        JSON.stringify([...scriptManifest.values()], null, 2) + '\n',
      ));
      await scriptManifestWrites;
      report.publicScriptsSaved++;
    } catch { warn('PUBLIC_SCRIPT_UNAVAILABLE'); }
  }
}

async function inspectDocument(page) {
  // This intentionally ignores text content, titles, form values and storage.
  if (!sanitiseEndpoint(page.url())) return;
  try {
    const observation = await page.evaluate(() => ({
      htmlPresent: Boolean(document.documentElement),
      nextDataPresent: Boolean(document.querySelector('script#__NEXT_DATA__')),
      linkCount: document.querySelectorAll('a[href]').length,
      passwordInputPresent: Boolean(document.querySelector('input[type="password"]')),
      challengeFramePresent: [...document.querySelectorAll('iframe')].some(frame => /challenges\.cloudflare\.com|recaptcha/.test(frame.getAttribute('src') || '')),
      scriptTexts: [...document.scripts]
        .filter(script => script.id === '__NEXT_DATA__' || script.type === 'application/json' || script.textContent?.includes('self.__next_f.push('))
        .slice(0, 300)
        .map(script => (script.textContent || '').slice(0, 4_000_001)),
    }));
    const { scriptTexts, ...safe } = observation;
    report.document = { ...safe, embeddedData: summariseEmbeddedJson(scriptTexts) };
    await checkpoint();
  } catch { warn('DOCUMENT_INSPECTION_UNAVAILABLE'); }
}

async function finish() {
  if (stopping) return;
  stopping = true;
  if (context) {
    context.removeAllListeners('response');
    context.removeAllListeners('request');
  }
  // Give in-flight inspections a bounded window; close then settle all callbacks.
  await Promise.race([Promise.allSettled([...pending]), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (dedicatedBrowser) {
    // Closing a CDP connection alone can leave Chrome and its port open.
    try {
      const session = await dedicatedBrowser.newBrowserCDPSession();
      await session.send('Browser.close');
    } catch { warn('DEDICATED_BROWSER_CLOSE_REQUEST_UNCONFIRMED'); }
    await dedicatedBrowser.close().catch(() => {});
  }
  else if (context) await context.close().catch(() => warn('BROWSER_CLOSE_FAILED'));
  if (!dedicatedBrowser && dedicatedChild && !dedicatedChild.killed) dedicatedChild.kill();
  if (dedicatedPort) {
    for (let attempt = 0; attempt < 10 && await portIsOpen(dedicatedPort); attempt++) await new Promise(resolve => setTimeout(resolve, 200));
    if (await portIsOpen(dedicatedPort)) warn('DEDICATED_DEBUG_PORT_STILL_OPEN_CLOSE_WINDOW_MANUALLY');
  }
  await Promise.allSettled([...pending]);
  report.events = [...events.values()];
  report.mechanisms = [...mechanisms].sort();
  if (eventLimitReached) warn('NETWORK_EVENT_LIMIT');
  await checkpoint();
  console.log('Rapport expurgé enregistré : .local/diagnostic-redacted.json');
  console.log('Session et profil conservés uniquement dans .local/. Lecture et authentification non validées automatiquement.');
}

process.once('SIGINT', () => { void finish().then(() => process.exit(0)); });
process.once('SIGTERM', () => { void finish().then(() => process.exit(0)); });

try {
  const browser = await findBrowser();
  await mkdir(profile, { recursive: true });
  console.log('Ouverture du navigateur avec un profil dédié. Validez vous-même tout CAPTCHA ou connexion.');
  if (args.has('--manual-browser')) {
    if (browser.channel !== 'chrome') throw new Error('MANUAL_MODE_REQUIRES_CHROME');
    const server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    dedicatedPort = port;
    await new Promise(resolve => server.close(resolve));
    // Ordinary Chrome, dedicated profile, standard local DevTools interface.
    // No default-profile access, stealth code, token injection or disabled protections.
    const child = spawn(browser.executablePath, [
      `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
      '--remote-debugging-address=127.0.0.1', '--no-first-run', 'about:blank',
    ], { stdio: 'ignore', windowsHide: false });
    dedicatedChild = child;
    child.on('error', () => warn('BROWSER_LAUNCH_FAILED'));
    child.unref();
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        dedicatedBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 });
        break;
      } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    if (!dedicatedBrowser) throw new Error('LOCAL_BROWSER_CONNECTION_FAILED');
    context = dedicatedBrowser.contexts()[0];
  } else context = await chromium.launchPersistentContext(profile, {
    channel: browser.channel,
    executablePath: browser.executablePath,
    headless: false,
    viewport: null,
    // Normal browser behaviour; no stealth options, token injection or bypass.
  });
  context.on('request', request => {
    for (const name of classifyMechanisms(request.url())) mechanisms.add(name);
  });
  context.on('response', response => track(observeResponse(response)));
  context.on('page', page => page.on('domcontentloaded', () => track(inspectDocument(page))));
  const page = context.pages()[0] || await context.newPage();
  page.on('domcontentloaded', () => track(inspectDocument(page)));
  const target = args.has('--audit-flow') ? 'https://world-novel.fr/home' : args.has('--public-audit') || args.has('--chapter-audit') ? 'https://world-novel.fr/oeuvres/shadow-slave' : 'https://world-novel.fr/';
  try { await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 }); }
  catch { warn('INITIAL_NAVIGATION_NOT_COMPLETED'); }
  if (args.has('--chapter-audit')) {
    // One directly observed chapter route; ordinary navigation, no interception
    // of site guards and no export of chapter HTML, text, screenshots or titles.
    await Promise.race([metadataReady, new Promise(resolve => setTimeout(resolve, 10_000))]);
    if (sampleChapterPath && /^\/lecture\/[^/?#]+\/volumes\/[^/?#]+\/chapitres\/[^/?#]+$/.test(sampleChapterPath)) {
      try {
        const response = await page.goto('https://world-novel.fr' + sampleChapterPath, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await new Promise(resolve => setTimeout(resolve, 3500));
        report.chapterRoute = { status: 'BLOCKED', httpStatus: response?.status(), reason: new URL(page.url()).origin === 'https://world-novel.fr' ? 'TEXT_NOT_VALIDATED' : 'EXTERNAL_REDIRECT' };
      } catch { report.chapterRoute = { status: 'BLOCKED', reason: 'CHAPTER_NAVIGATION_UNAVAILABLE' }; }
    } else report.chapterRoute = { status: 'BLOCKED', reason: 'NO_VALIDATED_CHAPTER_PATH' };
    // Independently verify another public work already linked from the homepage.
    try { await page.goto('https://world-novel.fr/oeuvres/the-mech-touch', { waitUntil: 'domcontentloaded', timeout: 20_000 }); } catch { warn('SECOND_WORK_NAVIGATION_UNAVAILABLE'); }
    await new Promise(resolve => setTimeout(resolve, 3000));
  } else if (args.has('--audit-flow')) {
    const { runAuditFlow } = await import('./diagnostic-flow.mjs');
    await runAuditFlow(page, report, checkpoint);
  } else if (args.has('--public-audit')) {
    await new Promise(resolve => setTimeout(resolve, 12_000));
  } else {
    console.log('Naviguez normalement vers une fiche puis un seul chapitre accessible. Aucun mot de passe à saisir dans le terminal.');
    console.log('Appuyez sur Entrée ici pour enregistrer le diagnostic et fermer le navigateur.');
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    await new Promise(resolve => { terminal.once('line', resolve); terminal.once('close', resolve); context.once('close', resolve); });
    terminal.close();
  }
  await finish();
} catch {
  warn('DIAGNOSTIC_FAILED_CHECK_BROWSER_AND_PROFILE');
  console.error('Diagnostic interrompu. Vérifiez le navigateur installé et fermez toute autre instance utilisant le profil dédié. Aucun détail brut exporté.');
  await finish();
  process.exitCode = 1;
}
