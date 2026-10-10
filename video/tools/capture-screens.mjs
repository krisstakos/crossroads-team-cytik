// Captures the 19 dark-theme story screens into video/screens/dark/.
// Usage: npm run screens            (from video/)
//        MOOD="Full of energy" npm run screens   to answer the chat differently
import fs from 'node:fs';
import path from 'node:path';
import { startServer, openPhone, APP_PATH, REPO } from './lib.mjs';

const OUT = process.argv[2] || path.join(REPO, 'video/screens/dark');
const MOOD = process.env.MOOD || 'A bit stuck';
fs.mkdirSync(OUT, { recursive: true });

const server = await startServer();
const { browser, page: p } = await openPhone();

const shot = async (name, wait = 700) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
const chip = async text => { await p.waitForTimeout(2300); await p.locator('#guide-chips .chip', { hasText: text }).first().click(); };

await p.goto(server.url + APP_PATH);
await p.waitForTimeout(1200);
await shot('01-login');
await p.click('#demo-fill'); await p.waitForTimeout(1500);

// ---- chat: finding a goal ----
await p.click('#fab-add'); await p.waitForTimeout(700);
await shot('02-new-task-help-link');
await p.click('#btn-add-guide'); await p.waitForTimeout(2600);
await shot('03-chat-mood');
await chip(MOOD); await p.waitForTimeout(1800);
await shot('04-chat-place');
await chip('Out and about'); await p.waitForTimeout(1800);
await shot('05-chat-time');
await chip('An hour'); await p.waitForTimeout(1800);
await shot('06-chat-build');
await chip('More of what I do'); await p.waitForTimeout(4500);
await shot('07-chat-ideas');
await p.locator('#guide-log').evaluate(e => { e.scrollTop = e.querySelector('.reco.partner').offsetTop - 120; });
await shot('08-chat-partner-offer');
await p.locator('[data-route-toggle]').first().click();
await p.locator('#guide-log').evaluate(e => { e.scrollTop = e.querySelector('.reco.partner').offsetTop - 120; });
await shot('09-chat-partner-route');
await p.locator('[data-guide-claim]').first().click(); await p.waitForTimeout(900);
await shot('10-goal-prefilled');
await p.click('#add-task-form button[type=submit]'); await p.waitForTimeout(500);
await shot('11-goal-created');

// ---- the goal is live ----
await p.waitForTimeout(3500);
const card = p.locator('.task-card', { hasText: 'IronWorks' }).first();
await card.evaluate(e => e.scrollIntoView({ block: 'center' }));
await shot('12-today-goal-live');

// ---- proof ----
await p.waitForTimeout(400);
await card.locator('button', { hasText: 'Complete' }).click();
await shot('13-proof-camera', 1500);
await p.evaluate(() => { window.__r = 0.65; });
await p.click('#btn-capture'); await p.waitForTimeout(1000);
await shot('14-proof-verifying', 500);
await p.waitForTimeout(4200);
await shot('15-proof-verified');
await p.click('#btn-pf-done');
await shot('16-done', 1400);
await p.click('#btn-done-close'); await p.waitForTimeout(800);

// ---- results ----
await p.click('.bn-item[data-view=record]');
await shot('17-history');
await p.click('[data-hf=failed]');
await shot('18-history-missed');
await p.click('.bn-item[data-view=charities]');
await shot('19-charity');

await browser.close();
await server.close();
