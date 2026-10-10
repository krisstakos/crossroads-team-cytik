// Builds the per-option "insert packs" for the live shoot/edit: every phone screen in the order it appears,
// named by shot, plus a README with timecodes. Generated from video/animatic/scenes.mjs, the same data the animatics use.
// Usage: npm run inserts
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './lib.mjs';
import { FILMS } from '../animatic/scenes.mjs';

const SRC = path.join(REPO, 'video/screens/dark');
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

for (const [key, film] of Object.entries(FILMS)) {
  const dir = `option-${key}`;
  const out = path.join(REPO, 'video/inserts', dir);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const rows = [];
  for (const s of film.scenes) {
    (s.phones || []).forEach((p, i) => {
      const letter = String.fromCharCode(97 + i);
      const name = `shot${String(s.id).padStart(2, '0')}${letter}_${p.src}`;
      fs.copyFileSync(path.join(SRC, p.src), path.join(out, name));
      rows.push({ name, shot: s.id, at: s.t0 + (p.at || 0), slug: s.slug, taps: (p.taps || []).length });
    });
  }
  const md = [
    `# ${film.label}: insert pack`,
    '',
    'Every phone screen used in this film, in order of appearance. Each is a real screenshot of the app (dark theme, 780 x 1688).',
    'Timecodes are for the 2:00 cut. "Hold" is how long the screen should stay up before the next insert or the cut-away.',
    '',
    '| # | File | Shot | Timecode | Scene | Tap on it |',
    '|---|---|---|---|---|---|',
    ...rows.map((r, i) => {
      const next = rows[i + 1];
      return `| ${i + 1} | \`${r.name}\` | ${r.shot} | ${fmt(r.at)} | ${r.slug} | ${r.taps ? 'yes' : '-'} |`;
    }),
    '',
    'Banners (lock-screen props, not app screens) are built by the graphics team from the copy in `VIDEO-SCRIPT.md`.',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(out, 'README.md'), md);
  console.log(dir, rows.length, 'inserts');
}
