// Renders the animatics to MP4 (720x1280, 30 fps, H.264 + AAC).
// Usage:  npm run films                       renders both
//         node tools/render-animatic.mjs a    renders one film by its key (a or b)
//         node tools/render-animatic.mjs b --stills 5,48,80   writes PNG stills at those seconds instead (quick look check)
// Needs ffmpeg and python3 on PATH, or set FFMPEG=/path/to/ffmpeg and PYTHON=/path/to/python3.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer, REPO } from './lib.mjs';
import { FILMS, eventsOf } from '../animatic/scenes.mjs';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PYTHON = process.env.PYTHON || 'python3';
const FPS = 30;
const args = process.argv.slice(2);
const which = args.find(a => a === 'all' || a in FILMS) || 'all';
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
const films = FILMS;
const todo = which === 'all' ? Object.keys(FILMS) : [which];

const OUT = path.join(REPO, 'video/films');
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();

for (const key of todo) {
  const film = films[key];
  const events = eventsOf(film);
  const data = { scenes: film.scenes, length: film.length, label: film.label, events };
  const page = await (await browser.newContext({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(server.url + '/video/animatic/index.html');
  await page.evaluate(d => window.load(d), data);

  if (stillsArg) {
    const dir = path.join(os.tmpdir(), `commit-animatic-${key}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of stillsArg.split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), s);
      await page.screenshot({ path: `${dir}/${key}-${String(s).padStart(3, '0')}.png` });
    }
    console.log('stills in', dir);
    continue;
  }

  // 1. score
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-score-'));
  fs.writeFileSync(`${tmp}/events.json`, JSON.stringify({ length: film.length, events }));
  const sc = spawnSync(PYTHON, [path.join(REPO, 'video/tools/make-score.py'), `${tmp}/events.json`, `${tmp}/score.wav`], { stdio: 'inherit' });
  if (sc.status !== 0) throw new Error('score failed');

  // 2. frames -> ffmpeg
  const outFile = `${OUT}/${film.file}.mp4`;
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', `${tmp}/score.wav`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', outFile],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(res => ff.on('close', res));
  const frames = film.length * FPS;
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.renderAt(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`${key}: ${Math.round((i / frames) * 100)}%`);
  }
  ff.stdin.end();
  await done;
  console.log('wrote', outFile);
}
await browser.close();
await server.close();
