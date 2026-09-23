// Temporary local Android validation only. Never a runtime requirement for the phone.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = 8087;
const files = new Map([
  ['/worldnovel-vnh.js', 'text/javascript; charset=utf-8'],
  ['/worldnovel-vnh.png', 'image/png'],
]);
const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (request.url === '/plugins.min.json') {
      const entries = JSON.parse(await readFile(new URL('../dist/plugins.min.json', import.meta.url), 'utf8'));
      for (const entry of entries) {
        entry.url = `http://127.0.0.1:${port}/worldnovel-vnh.js`;
        entry.iconUrl = `http://127.0.0.1:${port}/worldnovel-vnh.png`;
      }
      response.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(entries));
    } else if (files.has(request.url)) {
      const body = await readFile(new URL('../dist' + request.url, import.meta.url));
      response.writeHead(200, {'Content-Type':files.get(request.url),'Cache-Control':'no-store'}).end(body);
    } else response.writeHead(404).end();
  } catch { response.writeHead(500).end(); }
});
server.listen(port, '127.0.0.1', () => console.log(`Development-only manifest: http://127.0.0.1:${port}/plugins.min.json (15-minute limit)`));
const timer = setTimeout(() => server.close(), 15 * 60 * 1000);
timer.unref();
process.once('SIGINT', () => { clearTimeout(timer); server.close(); });
process.once('SIGTERM', () => { clearTimeout(timer); server.close(); });
