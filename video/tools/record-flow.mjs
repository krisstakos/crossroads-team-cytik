// Records the whole story flow as one moving video (webm) at 780x1688, with a tap ripple so every touch reads on camera.
// Usage: npm run record            (from video/)   ->  video/clips/flow.webm
import fs from 'node:fs';
import path from 'node:path';
import { startServer, openPhone, APP_PATH, REPO } from './lib.mjs';

const OUT = process.argv[2] || path.join(REPO, 'video/clips');
const MOOD = process.env.MOOD || 'A bit stuck';
fs.mkdirSync(OUT, { recursive: true });

const server = await startServer();
const { browser, ctx, page: p } = await openPhone({ recordVideo: { dir: OUT, size: { width: 780, height: 1688 } } });

// Tap ripple: a soft green ring that expands and fades where the finger lands.
await p.addInitScript(() => {
  const css = document.createElement('style');
  css.textContent = '.tap-ripple{position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;background:rgba(32,240,170,.35);border:2px solid rgba(32,240,170,.9);animation:tapr .6s cubic-bezier(.2,.8,.2,1) forwards}@keyframes tapr{from{transform:scale(.4);opacity:1}to{transform:scale(1.8);opacity:0}}';
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(css));
  document.addEventListener('pointerdown', e => {
    const d = document.createElement('div'); d.className = 'tap-ripple';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }, true);
});

const beat = ms => p.waitForTimeout(ms);
const chip = async text => { await beat(2300); await p.locator('#guide-chips .chip', { hasText: text }).first().click(); };

await p.goto(server.url + APP_PATH); await beat(1500);
await p.click('#demo-fill'); await beat(2200);

// the missed list (story beat: the turtle)
await p.click('.bn-item[data-view=record]'); await beat(1200);
await p.click('[data-hf=failed]'); await beat(2200);
await p.click('.bn-item[data-view=home]'); await beat(1200);

// the chat
await p.click('#fab-add'); await beat(1400);
await p.click('#btn-add-guide'); await beat(3200);
await chip(MOOD); await beat(2200);
await chip('Out and about'); await beat(1500);
await chip('An hour'); await beat(1500);
await chip('More of what I do'); await beat(4500);
await p.locator('#guide-log').evaluate(e => e.scrollTo({ top: e.querySelector('.reco.partner').offsetTop - 120, behavior: 'smooth' }));
await beat(1800);
await p.locator('[data-route-toggle]').first().click(); await beat(2200);
await p.locator('[data-guide-claim]').first().click(); await beat(2500);
await p.click('#add-task-form button[type=submit]'); await beat(3800);

// the goal is live, then proof
const card = p.locator('.task-card', { hasText: 'IronWorks' }).first();
await card.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await beat(1800);
await card.locator('button', { hasText: 'Complete' }).click(); await beat(3000);
await p.evaluate(() => { window.__r = 0.65; });
await p.click('#btn-capture'); await beat(6200);
await p.click('#btn-pf-done'); await beat(2600);
await p.click('#btn-done-close'); await beat(1200);

// results
await p.click('.bn-item[data-view=record]'); await beat(2600);
await p.click('.bn-item[data-view=charities]'); await beat(2600);

const video = p.video();
await ctx.close();
await video.saveAs(`${OUT}/flow.webm`);
await browser.close();
await server.close();
console.log('saved', `${OUT}/flow.webm`);
