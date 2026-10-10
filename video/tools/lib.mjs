// Shared helpers for the video tools: a tiny static server for the app, and a phone-sized dark-mode browser context.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export const REPO = path.resolve(import.meta.dirname, '../..');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon'
};

// Serves the repo root on a free port, so nothing else needs to be running.
export function startServer(root = REPO) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(root, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise(r => server.close(r)) });
  }));
}

// iPhone-sized, dark theme, touch input. Pass extra context options (e.g. recordVideo).
export async function openPhone(extra = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    ...extra
  });
  const page = await ctx.newPage();
  // The app's mock AI and mock camera read Math.random. Pin it so every run is identical:
  //   __r = 0.1  -> picks img/proof/gym.jpg (a dumbbell rack, no person)
  //   __r = 0.65 -> verification passes at 93%
  await page.addInitScript(() => {
    localStorage.setItem('commit_theme', 'dark');
    window.__r = 0.1;
    Math.random = () => window.__r;
  });
  return { browser, ctx, page };
}

export const APP_PATH = '/index.html?nophone&embed=1&mockcam';
