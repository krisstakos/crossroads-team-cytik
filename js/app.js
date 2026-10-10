/* Commit — accountability app (mock, no backend). All data lives in localStorage. */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(res => setTimeout(res, ms));
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = n => '$' + (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;                       // more than a day away: minutes and seconds are noise
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
// A deadline in plain words: "6:40 PM", "Tomorrow, 6:40 PM", "Fri 6:40 PM", "Oct 14, 6:40 PM".
function fmtDeadline(ts, now = Date.now()) {
  const day = t => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const diff = Math.round((day(ts) - day(now)) / 86400000);
  const time = fmtClock(ts);
  if (diff <= 0) return time;
  if (diff === 1) return `Tomorrow, ${time}`;
  if (diff < 7) return `${new Date(ts).toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return `${new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}
// "3 days 4 hours", "2 h 15 min", "40 min"
function humanSpan(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  if (d) return `${d} day${d > 1 ? 's' : ''}${h ? ` ${h} hour${h > 1 ? 's' : ''}` : ''}`;
  if (h) return `${h} h${m ? ` ${m} min` : ''}`;
  return `${m} min`;
}
function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

/* ---------- motion helpers ---------- */
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Countdown text as per-character spans so a changed digit can roll in on its own.
const digitsHTML = text => Array.from(text).map((c, i) => `<span class="dg in" style="--d:${i * 18}ms">${c}</span>`).join('');
function setCountdown(el, text) {
  const cur = el.children;
  if (cur.length !== text.length) { el.innerHTML = digitsHTML(text).replace(/ in"/g, ' in t"'); return; }
  Array.from(text).forEach((c, i) => {
    if (cur[i].textContent === c) return;
    const n = document.createElement('span');
    n.className = 'dg in t';
    n.textContent = c;
    cur[i].replaceWith(n);
  });
}

// Count a figure up from zero when its screen opens.
function countUp(el, to, fmt = String, ms = 450) {
  if (reduceMotion()) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min(1, (now - t0) / ms);
    el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const roundMoney = n => fmtMoney(Math.round(n * 100) / 100);

function playRecordCounters() {
  const st = historyStats();
  countUp($('#hero-balance'), state.balance, roundMoney, 500);
  countUp($('#stat-completed'), st.done, n => Math.round(n));
  countUp($('#stat-missed'), st.missed, n => Math.round(n));
  countUp($('#stat-sent'), state.totalSent, roundMoney);
}

function flash() {
  if (reduceMotion()) return;
  const f = document.createElement('div');
  f.className = 'flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

/* ---------- state ---------- */
const LS_STATE = 'commit_state_v1', LS_USER = 'commit_user_v1', LS_USERS = 'commit_users_v1', LS_SESSION = 'commit_session_v1', LS_ONBOARDED = 'commit_onboarded_v1';
let state = null;
let currentUser = null;

// Every account keeps its own data under its own key, so several people can use one browser.
const keyFor = (base, u = currentUser && currentUser.username) => `${base}:${u}`;
function loadState(u) { try { const raw = localStorage.getItem(keyFor(LS_STATE, u)); if (raw) return JSON.parse(raw); } catch (e) {} return null; }
function saveState() {
  if (!currentUser) return;
  try { localStorage.setItem(keyFor(LS_STATE), JSON.stringify(state)); }
  catch (e) { toast('Storage is full', 'error'); }
}
// The demo account keeps its sample tasks; every other account starts clean.
const newStateFor = u => (u === 'demo' ? MOCK.seedState() : MOCK.freshState());
// Saves from older versions lack the newer charity fields and charities. Fill them in without touching the user's numbers.
function normalizeState(st) {
  MOCK.charities().forEach(base => {
    const c = st.charities.find(x => x.id === base.id);
    if (!c) st.charities.push(base);
    else ['category', 'goal', 'impact'].forEach(k => { if (c[k] === undefined) c[k] = base[k]; });
  });
  st.tasks.forEach(t => { if (t.status === 'failed' && !t.charityId) t.charityId = st.selectedCharityId; });
  return st;
}
function initState(u) { state = normalizeState(loadState(u) || newStateFor(u)); saveState(); }
const taskById = id => state.tasks.find(t => t.id === id);
const selectedCharity = () => state.charities.find(c => c.id === state.selectedCharityId) || state.charities[0];

function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}
const hasCamera = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

/* ---------- theme: auto (follows the device), light or dark ---------- */
const LS_THEME = 'commit_theme';
const THEME_COLOR = { light: '#f6f7f6', dark: '#0b0e0c' };
function themeChoice() { const t = localStorage.getItem(LS_THEME); return t === 'light' || t === 'dark' ? t : 'auto'; }
function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'auto') { root.removeAttribute('data-theme'); localStorage.removeItem(LS_THEME); }
  else { root.setAttribute('data-theme', choice); localStorage.setItem(LS_THEME, choice); }
  // browser chrome colour follows the chosen theme (or the device, in auto)
  const mode = choice === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  $$('meta[name="theme-color"]').forEach(m => m.setAttribute('content', THEME_COLOR[mode]));
  $$('#theme-choice .seg-btn').forEach(b => { const on = b.dataset.themeChoice === choice; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
}

/* ---------- toasts ---------- */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 320); }, 3400);
}

/* ---------- auth (mock) ---------- */
const DEMO_USERS = { demo: { password: 'demo123', name: 'Demo' } };
function getUsers() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(LS_USERS)) || {}; } catch (e) {}
  return { ...stored, ...DEMO_USERS };
}

// Older versions kept one account in one place. Move it across so nobody loses their data.
function migrateLegacy() {
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(LS_USER)); } catch (e) {}
  if (!legacy || !legacy.username) return;
  const u = String(legacy.username).trim().toLowerCase();
  const users = getUsers();
  if (!users[u]) {
    const stored = JSON.parse(localStorage.getItem(LS_USERS) || '{}');
    stored[u] = { password: legacy.password, name: String(legacy.username).trim() };
    localStorage.setItem(LS_USERS, JSON.stringify(stored));
  }
  const oldState = localStorage.getItem(LS_STATE);
  if (oldState && !localStorage.getItem(keyFor(LS_STATE, u))) localStorage.setItem(keyFor(LS_STATE, u), oldState);
  localStorage.setItem(keyFor(LS_ONBOARDED, u), '1');           // existing users skip the setup
  if (localStorage.getItem(LS_SESSION)) localStorage.setItem(LS_SESSION, u);
  localStorage.removeItem(LS_USER);
  localStorage.removeItem(LS_STATE);
}

const cap = str => str.charAt(0).toUpperCase() + str.slice(1);
const USERNAME_RE = /^[a-z0-9._-]{2,20}$/;

// Starts a session for an existing account. `registered` means they just created it, so setup follows straight away.
function startSession(u, opts = {}) {
  const user = getUsers()[u] || {};
  currentUser = { username: u, name: user.name || cap(u) };
  localStorage.setItem(LS_SESSION, u);
  initState(u);
  if (u === 'demo') localStorage.setItem(keyFor(LS_ONBOARDED), '1');     // the demo account skips setup
  enterApp(opts);
}

// Sign in only. A username that does not exist is an error, with an offer to create it.
async function handleLogin(rawName, password) {
  const u = rawName.trim().toLowerCase();
  const user = getUsers()[u];
  if (!user) return { message: 'No account with that username', signup: true };
  if (user.password !== password) return { message: 'Wrong password' };
  startSession(u);
  return null;
}

/* ---------- registration ---------- */
// 0 too short, 1 weak, 2 okay, 3 strong
function passwordStrength(pw) {
  if (pw.length < 6) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  if (pw.length >= 12 || (pw.length >= 10 && classes >= 3)) return 3;
  if (pw.length >= 8 && classes >= 2) return 2;
  return 1;
}

// Returns { name?, username?, password?, confirm? } with a message for each problem; empty means valid.
function validateRegistration(v) {
  const e = {};
  const name = (v.name || '').trim(), u = (v.username || '').trim().toLowerCase();
  if (!name) e.name = 'Enter your name';
  else if (name.length > 30) e.name = '30 characters or fewer';
  if (!u) e.username = 'Choose a username';
  else if (!USERNAME_RE.test(u)) e.username = '2 to 20 letters or numbers';
  else if (getUsers()[u]) e.username = 'Username taken';
  if ((v.password || '').length < 6) e.password = 'At least 6 characters';
  else if (v.password.toLowerCase() === u) e.password = 'Cannot match your username';
  if (!v.confirm) e.confirm = 'Repeat your password';
  else if (v.confirm !== v.password) e.confirm = 'Does not match';
  return e;
}

// Creates the account and signs in. Returns null on success, or the validation errors.
function registerAccount(v) {
  const errors = validateRegistration(v);
  if (Object.keys(errors).length) return errors;
  const u = v.username.trim().toLowerCase();
  const stored = JSON.parse(localStorage.getItem(LS_USERS) || '{}');
  stored[u] = { password: v.password, name: v.name.trim(), createdAt: Date.now() };
  localStorage.setItem(LS_USERS, JSON.stringify(stored));
  startSession(u, { registered: true });
  return null;
}

function logout() {
  localStorage.removeItem(LS_SESSION);
  location.reload();
}

/* ---------- app shell / navigation ---------- */
function showView(name) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  const target = $('#view-' + name);
  if (target) target.classList.remove('hidden');
  $$('[data-view]').forEach(b => {
    const on = b.dataset.view === name;
    b.classList.toggle('active', on);
    if (b.classList.contains('nav-item') || b.classList.contains('bn-item')) on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
  });
  window.scrollTo({ top: 0 });
  document.body.dataset.view = name;
  if (name === 'record' && state) playRecordCounters();
}

function enterApp(opts = {}) {
  const name = currentUser.name;
  $('#view-login').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  $('#side-username').textContent = name;
  $('#side-avatar').textContent = name.charAt(0).toUpperCase() || 'A';
  $('#set-avatar').textContent = name.charAt(0).toUpperCase() || 'A';
  renderAll();
  showView('home');
  // accounts that have not done the setup get the questions; a brand new account gets them immediately
  if (!localStorage.getItem(keyFor(LS_ONBOARDED))) {
    if (opts.registered) ONBOARDING.open({ registered: true });
    else setTimeout(() => ONBOARDING.open(), 400);
  }
}

function renderAll() { renderHome(); renderRecord(); renderCharities(); renderSettings(); updateTopbarBalance(); }

/* ---------- today: live timers only ---------- */
const RING_LONG = 5; // countdown strings longer than "mm:ss" get a smaller ring numeral
function taskCardHTML(t, lead) {
  const remaining = t.deadline - Date.now();
  const pct = Math.max(0, Math.min(100, (remaining / t.durationMs) * 100));
  const text = fmtCountdown(remaining);
  const complete = `<button class="btn primary complete-btn" data-complete="${t.id}">Complete</button>`;
  const help = ASSIST.kindOf(t) ? `<button class="btn ghost help-btn" data-help="${t.id}">Help</button>` : '';
  const btn = `<div class="card-actions">${complete}${help}</div>`;
  const del = `<button class="icon-btn delete-btn" data-delete="${t.id}" aria-label="Delete ${esc(t.name)}">✕</button>`;
  const countdown = `<span class="countdown" data-countdown="${t.id}" aria-label="${text} remaining">${digitsHTML(text)}</span>`;

  if (!lead) {
    return `<article class="task-card" data-task-id="${t.id}">
      <div class="task-head">
        <div class="task-title"><h3>${esc(t.name)}</h3><span class="chip stake">${fmtMoney(t.penalty)}</span></div>
        ${del}
      </div>
      <div class="timer-block">
        <div class="timer-row">${countdown}<span class="deadline-label">${fmtDeadline(t.deadline)}</span></div>
        <div class="progress"><div class="progress-fill" data-progress="${t.id}" style="width:${pct}%"></div></div>
      </div>
      ${btn}
    </article>`;
  }

  return `<article class="task-card lead${text.length > RING_LONG ? ' long' : ''}" data-task-id="${t.id}">
    <div class="lead-body">
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="rg-${t.id}" class="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" cx="60" cy="60" r="54" pathLength="100" stroke="url(#rg-${t.id})" data-ring="${t.id}" style="stroke-dashoffset:${(100 - pct).toFixed(2)}"/></svg>
        <div class="ring-center">${countdown}</div>
      </div>
      <div class="lead-info">
        <div class="task-head">
          <div class="task-title"><h3>${esc(t.name)}</h3></div>
          ${del}
        </div>
        <dl class="fact-list">
          <div class="fact"><dt>Stake</dt><dd>${fmtMoney(t.penalty)}</dd></div>
          <div class="fact"><dt>Due</dt><dd>${fmtDeadline(t.deadline)}</dd></div>
        </dl>
        ${btn}
      </div>
    </div>
  </article>`;
}

// What onboarding learned about this person, used to rank venues. Empty until they have answered.
const prefsFromProfile = () => (state && state.profile ? { when: state.profile.when, blocker: state.profile.blocker } : {});

/* ---------- recommended tasks ---------- */
const RECOMMENDED = [
  { name: 'Gym visit',       icon: '🏋️', h: 2, m: 0,  stake: 10 },
  { name: 'Morning run',     icon: '🏃', h: 1, m: 0,  stake: 5 },
  { name: 'Study session',   icon: '📚', h: 1, m: 0,  stake: 5 },
  { name: 'Deep work block', icon: '💻', h: 2, m: 0,  stake: 10 },
  { name: 'Cook dinner',     icon: '🍳', h: 1, m: 0,  stake: 5 },
  { name: 'Tidy the room',   icon: '🧹', h: 0, m: 30, stake: 3 },
  { name: 'Yoga or stretch', icon: '🧘', h: 0, m: 30, stake: 5 },
  { name: 'Water the plants', icon: '🌿', h: 0, m: 30, stake: 3 }
];

function recommendedTasks() {
  const active = state.tasks.filter(t => t.status === 'active');
  const runningNames = new Set(active.map(t => t.name.trim().toLowerCase()));
  const runningIcons = new Set(active.map(t => t.icon));
  const doneBefore = icon => state.tasks.filter(t => t.status === 'completed' && t.icon === icon).length;
  return RECOMMENDED
    .filter(r => !runningNames.has(r.name.toLowerCase()) && !runningIcons.has(r.icon))
    .map((r, i) => ({ r, i, n: doneBefore(r.icon) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)            // things you have finished before come first
    .map(({ r, n }) => ({ ...r, why: n ? `You have finished this ${n} time${n > 1 ? 's' : ''}.` : r.why }));
}

let recoToken = 0;
function renderRecommended() {
  const list = recommendedTasks().slice(0, 7);
  $('#reco-title').classList.toggle('hidden', !list.length);
  $('#recommended').innerHTML = list.map((r, i) => `
    <article class="reco" style="--i:${i + 2}">
      <div class="reco-top">
        <div class="reco-icon" aria-hidden="true">${r.icon}</div>
        <div><h3>${esc(r.name)}</h3></div>
      </div>
      <div class="reco-meta">
        <div><b>${r.h ? r.h + 'h' : ''}${r.m ? (r.h ? ' ' : '') + r.m + 'm' : ''}</b></div>
        <div><b>${fmtMoney(r.stake)}</b></div>
      </div>
      <div class="reco-where" data-where="${i}"></div>
      <button class="btn ghost sm" data-reco="${esc(r.name)}">Start</button>
    </article>`).join('');

  // venues load after the cards appear, so a slow data source never blocks the screen
  const token = ++recoToken;
  Promise.all(list.map(r => ASSIST.whereFor(r, r.h * 60 + r.m, prefsFromProfile()))).then(ws => {
    if (token !== recoToken) return;
    ws.forEach((w, i) => { const slot = document.querySelector(`[data-where="${i}"]`); if (slot) slot.innerHTML = ASSIST.whereHTML(w, true); });
  });
}

function renderHome() {
  const active = state.tasks.filter(t => t.status === 'active').sort((a, b) => a.deadline - b.deadline);
  const atRisk = active.reduce((sum, t) => sum + t.penalty, 0);
  const line = $('#greet-date');
  line.textContent = active.length ? `${active.length} running, ${fmtMoney(atRisk)} at stake` : '';
  line.classList.toggle('hidden', !active.length);

  const list = $('#tasks-active-list');
  list.innerHTML = active.length
    ? taskCardHTML(active[0], true) + (active.length > 1 ? `<div class="rest">${active.slice(1).map(t => taskCardHTML(t, false)).join('')}</div>` : '')
    : '';
  $$('.task-card', list).forEach((c, i) => c.style.setProperty('--i', i));
  $('#no-tasks').classList.toggle('hidden', active.length > 0);
  $$('[data-badge="active"]').forEach(b => { b.textContent = active.length; b.classList.toggle('hidden', !active.length); });
  renderRecommended();
  updateTopbarBalance();
}

/* ---------- history: balance, insights, chart, results, activity ---------- */
const DAY_MS = 86400000;
let historyFilter = 'all', historyLimit = 8;
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const resolvedAt = t => (t.status === 'completed' ? t.completedAt : (t.failedAt || t.deadline));
const resolvedTasks = () => state.tasks.filter(t => t.status !== 'active').sort((a, b) => resolvedAt(b) - resolvedAt(a));

function dayLabel(ts) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY_MS);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(ts).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function historyStats() {
  const list = resolvedTasks();
  const done = list.filter(t => t.status === 'completed');
  let streak = 0;
  for (const t of list) { if (t.status !== 'completed') break; streak++; }   // newest first, stop at the first miss
  return {
    list, done: done.length, missed: list.length - done.length, streak,
    rate: list.length ? Math.round((done.length / list.length) * 100) : null,
    kept: done.reduce((sum, t) => sum + t.penalty, 0)
  };
}

// Two-tone bars for the last 14 days: completed on the bottom, missed stacked above.
function chartData(list) {
  const today = startOfDay(Date.now());
  const days = Array.from({ length: 14 }, (_, i) => ({ ts: today - (13 - i) * DAY_MS, done: 0, missed: 0 }));
  list.forEach(t => {
    const d = days.find(x => x.ts === startOfDay(resolvedAt(t)));
    if (d) t.status === 'completed' ? d.done++ : d.missed++;
  });
  return days;
}
function chartHTML(days) {
  const max = Math.max(1, ...days.map(d => d.done + d.missed));
  return days.map((d, i) => {
    const label = new Date(d.ts).toLocaleDateString([], { weekday: 'narrow' });
    const tip = `${new Date(d.ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.done} completed, ${d.missed} missed`;
    return `<div class="bar${i === 13 ? ' today' : ''}" title="${esc(tip)}">
      <div class="bar-col"><i class="b-miss" style="height:${(d.missed / max) * 100}%"></i><i class="b-done" style="height:${(d.done / max) * 100}%"></i></div>
      <span>${label}</span></div>`;
  }).join('');
}

function historyItemHTML(t) {
  const done = t.status === 'completed';
  const when = resolvedAt(t);
  const charity = state.charities.find(c => c.id === t.charityId);
  const meta = done ? fmtClock(when) : `to ${charity ? charity.name : 'charity'}`;
  const amount = done
    ? `<span class="h-amt keep">+${fmtMoney(t.penalty)}</span>`
    : `<span class="h-amt lost">-${fmtMoney(t.charged || 0)}</span>`;
  return `<div class="history-item ${done ? '' : 'failed'}">
    <span class="h-dot" aria-hidden="true"></span>
    <div class="h-main"><p>${esc(t.name)}</p><small>${esc(meta)}</small></div>
    ${amount}
    ${done && t.proof ? `<button class="thumb" data-report="${t.id}" aria-label="View proof photo"><img src="${t.proof.image}" alt="Proof photo"/></button>` : ''}
  </div>`;
}

function renderRecord() {
  const st = historyStats();
  $('#hero-balance').textContent = fmtMoney(state.balance);
  $('#stat-completed').textContent = st.done;
  $('#stat-missed').textContent = st.missed;
  $('#stat-sent').textContent = fmtMoney(state.totalSent);

  const days = chartData(st.list);
  const dd = days.reduce((n, d) => n + d.done, 0), dm = days.reduce((n, d) => n + d.missed, 0);
  $('#chart').innerHTML = chartHTML(days);
  $('#chart').setAttribute('aria-label', `In the last 14 days you completed ${dd} and missed ${dm} tasks.`);

  // results, filtered and grouped by day
  const shown = st.list.filter(t => historyFilter === 'all' || t.status === historyFilter);
  const page = shown.slice(0, historyLimit);
  let html = '', lastDay = null;
  page.forEach(t => {
    const label = dayLabel(resolvedAt(t));
    if (label !== lastDay) { html += `<h3 class="day-head">${esc(label)}</h3>`; lastDay = label; }
    html += historyItemHTML(t);
  });
  $('#tasks-history-list').innerHTML = html || `<p class="plain-empty">${st.list.length ? 'No matches.' : 'Nothing yet.'}</p>`;
  $('#btn-history-more').classList.toggle('hidden', shown.length <= historyLimit);
  $('#btn-history-more').textContent = 'Show more';
  $$('#history-filter .seg-btn').forEach(b => { const on = b.dataset.hf === historyFilter; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
}

function updateTopbarBalance() { $('#topbar-balance').textContent = fmtMoney(state.balance); }

/* ---------- activity & money flow ---------- */
function pushActivity(icon, text, type) {
  state.activity.unshift({ icon, text, at: Date.now(), type });
  if (state.activity.length > 30) state.activity.length = 30;
}

function failTask(t) {
  const c = selectedCharity();
  const charged = Math.min(t.penalty, Math.max(0, state.balance));
  state.balance -= charged;
  state.totalSent += charged;
  if (charged > 0) c.raised += charged;
  t.status = 'failed';
  t.failedAt = Date.now();
  t.charged = charged;
  t.charityId = c.id;
  pushActivity('💸', `Missed "${t.name}" — ${fmtMoney(charged)} sent to ${c.name}`, 'penalty');
  saveState();
  flash();
  toast(`Missed "${t.name}". ${fmtMoney(charged)} to ${c.name}`, 'warn');
  if (state.balance <= 0) setTimeout(() => toast('Balance is empty', 'error'), 400);
}

function completeTask(t, proof) {
  t.status = 'completed';
  t.completedAt = Date.now();
  if (proof) t.proof = proof;
  pushActivity('✅', `Completed "${t.name}"${proof ? ` · verified ${proof.ai.confidence}% confidence` : ''}`, 'completed');
  saveState();
  renderAll();
  celebrate(t, proof);
}

/* ---------- completion celebration ---------- */
function celebrate(t, proof) {
  const stake = fmtMoney(t.penalty);
  $('#done-stake').textContent = `${stake} kept`;
  $('#overlay-done').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  if (navigator.vibrate) navigator.vibrate([30, 50, 70]);
  setTimeout(() => $('#btn-done-close').focus(), 800);
}

function closeCelebration() {
  $('#overlay-done').classList.add('hidden');
  document.body.classList.remove('no-scroll');
  showView('home');
}

function deleteTask(id) {
  const t = taskById(id);
  if (!t || t.status !== 'active') return;
  state.tasks = state.tasks.filter(x => x.id !== id);
  saveState();
  renderHome();
  toast('Removed', 'info');
}

/* ---------- live timers ---------- */
let tickTimer = null;
function startTick() { if (tickTimer) clearInterval(tickTimer); tickTimer = setInterval(tick, 1000); }

function tick() {
  if (!currentUser) return;   // timers only run (and expire) for a signed-in user
  let expired = false;
  state.tasks.forEach(t => { if (t.status === 'active' && Date.now() >= t.deadline) { failTask(t); expired = true; } });

  $$('.task-card[data-task-id]').forEach(card => {
    const t = taskById(card.dataset.taskId);
    if (!t || t.status !== 'active') return;
    const remaining = Math.max(0, t.deadline - Date.now());
    const pct = Math.max(0, (remaining / t.durationMs) * 100);
    const cd = $(`[data-countdown="${t.id}"]`, card);
    if (cd) { setCountdown(cd, fmtCountdown(remaining)); cd.setAttribute('aria-label', `${fmtCountdown(remaining)} remaining`); }
    const pf = $(`[data-progress="${t.id}"]`, card);
    if (pf) pf.style.width = pct + '%';
    const ring = $(`[data-ring="${t.id}"]`, card);
    if (ring) ring.style.strokeDashoffset = (100 - pct).toFixed(2);
    card.classList.toggle('long', fmtCountdown(remaining).length > RING_LONG);
    const urgentMs = Math.min(t.durationMs * 0.25, 6 * 3600000), criticalMs = Math.min(t.durationMs * 0.10, 3600000);
    card.classList.toggle('urgent', remaining <= urgentMs && remaining > criticalMs);
    card.classList.toggle('critical', remaining <= criticalMs);
  });

  $$('[data-timeago]').forEach(el => { el.textContent = timeAgo(+el.dataset.timeago); });

  if (expired) renderAll();
}

/* ---------- task help (nearby places, prices, plans) ---------- */
function anyOtherOverlayOpen() {
  return !!document.querySelector('.overlay:not(.hidden):not(#overlay-help), .guide-overlay:not(.hidden), .onb-overlay:not(.hidden), .proof-overlay:not(.hidden), .done-overlay:not(.hidden)');
}

async function openHelp(task, mins, prefs) {
  const help = await ASSIST.load(task, mins, prefs || prefsFromProfile());
  $('#help-body').innerHTML = ASSIST.fullHTML(help);
  $('#overlay-help').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}

function closeHelp() {
  $('#overlay-help').classList.add('hidden');
  if (!anyOtherOverlayOpen()) document.body.classList.remove('no-scroll');
}

/* ---------- add task ---------- */
// The mock AI recognises a task by its icon, so pick one from the name instead of asking the person to.
let selectedIcon = null;                 // set when a suggestion brings its own icon
function iconFor(name) {
  const E = MOCK.EMOJIS, kind = ASSIST.kindOf({ name });
  const byKind = { gym: E[0], run: E[5], study: E[4], cook: E[1], yoga: E[6], work: E[2], art: E[8] };
  if (byKind[kind]) return byKind[kind];
  if (/tidy|clean|laundry|declutter|organi[sz]e/i.test(name)) return E[3];
  if (/vitamin|pill|medic/i.test(name)) return E[7];
  if (/plant|water/i.test(name)) return E[9];
  return '📌';
}

// Time limit ("in 2 hours") or due date ("Friday 6 PM"). Both end up as one deadline timestamp.
let addMode = 'duration';
const localDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MIN_LEAD_MS = 5 * 60000, MAX_LEAD_MS = 365 * 86400000;

function computeDeadline() {
  const now = Date.now();
  if (addMode === 'duration') {
    const h = Math.min(72, Math.max(0, +$('#at-hours').value || 0));
    const m = Math.min(59, Math.max(0, +$('#at-minutes').value || 0));
    const ms = (h * 60 + m) * 60000;
    return ms > 0 ? { ok: true, deadline: now + ms, durationMs: ms } : { ok: false, error: 'Set a time limit' };
  }
  const date = $('#at-date').value, time = $('#at-time').value;
  if (!date) return { ok: false, error: 'Pick a due date' };
  if (!time) return { ok: false, error: 'Pick a due time' };
  const [y, mo, d] = date.split('-').map(Number), [hh, mm] = time.split(':').map(Number);
  const ts = new Date(y, mo - 1, d, hh, mm).getTime();
  if (Number.isNaN(ts)) return { ok: false, error: 'Invalid date' };
  if (ts - now < MIN_LEAD_MS) return { ok: false, error: 'Pick a time 5 or more minutes ahead' };
  if (ts - now > MAX_LEAD_MS) return { ok: false, error: 'Up to a year ahead' };
  return { ok: true, deadline: ts, durationMs: ts - now };
}

function updateDuePreview() {
  const r = computeDeadline();
  const box = $('#at-due-preview');
  box.classList.toggle('bad', !r.ok && addMode === 'date' && !!$('#at-date').value);
  if (r.ok) box.textContent = addMode === 'date'
    ? `Due ${fmtDeadline(r.deadline)}`
    : `Ends ${fmtDeadline(r.deadline)}`;
  else box.textContent = addMode === 'date' && $('#at-date').value ? r.error : '';
}

function setAddMode(mode) {
  addMode = mode;
  $$('.seg-btn').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#at-mode-duration').classList.toggle('hidden', mode !== 'duration');
  $('#at-mode-date').classList.toggle('hidden', mode !== 'date');
  updateDuePreview();
  updateAddAssist();
}

// Named shortcuts resolve to a date and a time ("Friday" means Friday 6 PM). Returns null when it is too late for today's.
function dateShortcut(key, now = new Date()) {
  const at = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const soon = t => t.getTime() - now.getTime() < MIN_LEAD_MS;
  if (key === 'tonight') {
    let t = at(now, 21);
    if (soon(t)) t = at(now, 23);
    return soon(t) ? null : t;
  }
  if (key === 'friday') {
    const add = (5 - now.getDay() + 7) % 7;
    let t = at(addDays(now, add), 18);
    if (soon(t)) t = addDays(t, 7);
    return t;
  }
  if (key === 'weekend') {                       // the end of the weekend: Sunday 6 PM
    const add = (7 - now.getDay()) % 7;
    let t = at(addDays(now, add), 18);
    if (soon(t)) t = addDays(t, 7);
    return t;
  }
  if (key === 'monthend') {
    let t = at(new Date(now.getFullYear(), now.getMonth() + 1, 0), 18);
    if (soon(t)) t = at(new Date(now.getFullYear(), now.getMonth() + 2, 0), 18);
    return t;
  }
  return null;
}

function setDateShortcut(key) {
  const t = dateShortcut(key);
  if (!t) return;
  $('#at-date').value = localDate(t);
  $('#at-time').value = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  $$('#date-presets .chip').forEach(c => c.classList.toggle('active', c.dataset.when === key));
  updateDuePreview();
  updateAddAssist();
}

// a shortcut that has no valid time left today (like "Tonight" at midnight) is greyed out
const refreshShortcuts = () => $$('#date-presets [data-when]').forEach(c => { c.disabled = !dateShortcut(c.dataset.when); });

function setDatePreset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  $('#at-date').value = localDate(d);
  if (!$('#at-time').value) $('#at-time').value = '18:00';       // a preset should never leave the time blank
  $$('#date-presets .chip').forEach(c => c.classList.toggle('active', +c.dataset.days === days));
  // a due time that has already passed today would be refused, so move it to the next full hour
  if (days === 0) {
    const [hh, mm] = ($('#at-time').value || '18:00').split(':').map(Number);
    if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm).getTime() - Date.now() < MIN_LEAD_MS) {
      const next = new Date(Date.now() + 3600000);
      $('#at-time').value = `${pad(next.getHours())}:00`;
    }
  }
  updateDuePreview();
  updateAddAssist();
}

function showCustomDuration(on) {
  $('#at-custom').classList.toggle('hidden', !on);
  const custom = $('#duration-presets [data-custom]');
  custom.classList.toggle('active', on);
  if (on) $$('#duration-presets [data-h]').forEach(c => c.classList.remove('active'));
}

// Under the task name: where the task could be done, when we recognise it (gym, run, study, cook, yoga, focus work, art, chores).
let assistToken = 0;
async function updateAddAssist() {
  const box = $('#at-assist');
  const token = ++assistToken;
  const task = { name: $('#at-name').value.trim() };
  const r = computeDeadline();
  const mins = addMode === 'duration' && r.ok ? Math.round(r.durationMs / 60000) : undefined;   // a due date has no fixed session length
  const [where, help] = await Promise.all([ASSIST.whereFor(task, mins, prefsFromProfile()), ASSIST.load(task, mins, prefsFromProfile())]);
  if (token !== assistToken) return;            // a newer edit already replaced this answer
  box.classList.toggle('hidden', !where);
  box.innerHTML = where ? `${ASSIST.whereHTML(where, true)}${help ? '<button type="button" class="link-btn" id="at-assist-more">See details</button>' : ''}` : '';
}

function openAddTask(preset) {
  const p = preset && preset.name ? preset : null;   // click handlers pass an Event; only plain presets count
  const h = p ? p.h : 1, m = p ? p.m : 0;
  $('#at-name').value = p ? p.name : '';
  $('#at-hours').value = h;
  $('#at-minutes').value = m;
  $('#at-penalty').value = p ? p.stake : (state.defaultPenalty || 10);
  selectedIcon = p && p.icon ? p.icon : null;
  const match = $$('#duration-presets [data-h]').find(c => +c.dataset.h === h && +c.dataset.m === m);
  $$('#duration-presets .chip').forEach(c => c.classList.toggle('active', c === match));
  showCustomDuration(!match);                       // a length that is not a preset opens the custom fields
  $('#at-time').value = '18:00';
  $('#at-date').min = localDate(new Date());
  setDatePreset(1);                                  // the date picker starts on tomorrow
  refreshShortcuts();
  setAddMode('duration');
  $('#overlay-add').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  setTimeout(() => $('#at-name').focus(), 60);
}

function closeAddTask() {
  $('#overlay-add').classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

function submitAddTask(e) {
  e.preventDefault();
  const name = $('#at-name').value.trim();
  const penalty = Math.max(1, Math.round(+$('#at-penalty').value) || state.defaultPenalty);
  if (!name) { toast('Name your task', 'error'); return; }
  const when = computeDeadline();
  if (!when.ok) { toast(when.error, 'error'); return; }
  if (penalty > state.balance) { toast(`Stake is above your balance (${fmtMoney(state.balance)})`, 'error'); return; }

  state.tasks.unshift({
    id: uid(), name, icon: selectedIcon || iconFor(name), status: 'active', byDate: addMode === 'date',
    createdAt: Date.now(), deadline: when.deadline, durationMs: when.durationMs, penalty
  });
  saveState();
  closeAddTask();
  renderHome();
  toast(`Started. Due ${fmtDeadline(when.deadline)}`, 'success');
}

/* ---------- charities ---------- */
const yoursFor = id => state.tasks
  .filter(t => t.status === 'failed' && (t.charityId || state.selectedCharityId) === id)
  .reduce((sum, t) => sum + (t.charged || 0), 0);
const goalPct = c => Math.min(100, Math.round((c.raised / c.goal) * 100));

function goalHTML(c) {
  return `<div class="goal"><div class="goal-bar" role="img" aria-label="${goalPct(c)}% of the goal raised"><i style="width:${goalPct(c)}%"></i></div>
    <p><b>${fmtMoney(c.raised)}</b> of ${fmtMoney(c.goal)}</p></div>`;
}

function featureHTML(c) {
  const yours = yoursFor(c.id);
  return `<section class="ch-feature" data-cat="${esc(c.category)}">
    <div class="ch-feature-main">
      <span class="cat">${esc(c.category)}</span>
      <h2>${esc(c.name)}</h2>
      <p class="sub">${esc(c.desc)}</p>
      ${goalHTML(c)}
    </div>
    <dl class="ch-stats">
      <div><dt>You gave</dt><dd>${fmtMoney(yours)}</dd></div>
    </dl>
  </section>`;
}

function charityCardHTML(c, i) {
  return `<article class="charity-card" data-cat="${esc(c.category)}" style="--i:${i + 1}">
    <div class="ch-top"><span class="cat">${esc(c.category)}</span></div>
    <h3>${esc(c.name)}</h3>
    <p class="sub">${esc(c.desc)}</p>
    ${goalHTML(c)}
    <div class="charity-foot"><button class="btn ghost sm" data-select="${c.id}">Choose</button></div>
  </article>`;
}

function renderCharities() {
  $('#charity-feature').innerHTML = featureHTML(selectedCharity());
  $('#charities-list').innerHTML = state.charities.filter(c => c.id !== state.selectedCharityId).map(charityCardHTML).join('');
}

function selectCharity(id) {
  const c = state.charities.find(x => x.id === id);
  if (!c || c.id === state.selectedCharityId) return;
  state.selectedCharityId = id;
  saveState();
  renderCharities();
  renderHome();                                    // the lead task card names the charity
  window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  toast(`Charity: ${c.name}`, 'success');
}

/* ---------- settings ---------- */
function renderSettings() {
  $('#settings-username').textContent = currentUser.name;
  $('#set-balance').textContent = fmtMoney(state.balance);
  $('#default-penalty').value = state.defaultPenalty;
}

function addFunds(amount) {
  const a = Math.round(+amount);
  if (!a || a <= 0) { toast('Enter an amount', 'error'); return; }
  state.balance += a;
  pushActivity('💰', `Added ${fmtMoney(a)} to account`, 'funds');
  saveState();
  renderAll();
  toast(`${fmtMoney(a)} added`, 'success');
}

function resetDemoData() {
  localStorage.removeItem(keyFor(LS_STATE));
  state = newStateFor(currentUser.username);
  saveState();
  renderAll();
  showView('home');
  toast('Reset', 'info');
}

/* ---------- proof flow: camera capture (mobile) ---------- */
const pf = { taskId: null, stream: null, image: null, result: null };

function openProofFlow(taskId) {
  const t = taskById(taskId);
  if (!t || t.status !== 'active') return;
  pf.taskId = taskId;
  pf.image = null;
  pf.result = null;
  $('#pf-task-name').textContent = t.name;
  showPfStage('camera');
  $('#overlay-proof').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  startCamera();
}

function closeProofFlow() {
  stopCamera();
  $('#overlay-proof').classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

function showPfStage(name) {
  $('#pf-camera').classList.toggle('hidden', name !== 'camera');
  $('#pf-analysis').classList.toggle('hidden', name !== 'analysis');
  if (name === 'analysis') resetAnalysisUI();
}

async function startCamera() {
  const video = $('#pf-video');
  const errBox = $('#pf-camera-error');
  try {
    if (!hasCamera()) throw new Error('no camera api');
    pf.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = pf.stream;
    await video.play();
    errBox.classList.add('hidden');
  } catch (e) {
    stopCamera();
    errBox.classList.remove('hidden');
  }
}

function stopCamera() {
  if (pf.stream) { pf.stream.getTracks().forEach(tr => tr.stop()); pf.stream = null; }
  const v = $('#pf-video');
  if (v) v.srcObject = null;
}

function captureFromVideo() {
  const video = $('#pf-video');
  if (!video.videoWidth) { toast('Camera not ready yet', 'error'); return; }
  const maxW = 900;
  let w = video.videoWidth, h = video.videoHeight;
  const scale = Math.min(1, maxW / w);
  w = Math.round(w * scale); h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);
  pf.image = canvas.toDataURL('image/jpeg', 0.85);
  stopCamera();
  runAnalysis();
}

function downscaleFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        let w = img.width, h = img.height;
        const scale = Math.min(1, maxW / w);
        w = Math.round(w * scale); h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- proof flow: mocked AI verification ---------- */
function resetAnalysisUI() {
  $$('#pf-step-list li').forEach(li => li.classList.remove('active', 'done'));
  $('#pf-result').classList.add('hidden');
  $('#btn-pf-done').classList.add('hidden');
  $('#btn-pf-retake').classList.add('hidden');
  $('#pf-conf-fill').style.width = '0%';
}

function pickDetected(t, pass) {
  if (!pass) return ['indistinct objects', 'low match with task context'];
  return MOCK.DETECTIONS[t.icon] || ['scene elements', 'consistent lighting', 'natural composition'];
}

async function runAnalysis() {
  showPfStage('analysis');
  $('#pf-image').src = pf.image;
  const t = taskById(pf.taskId);

  for (const li of $$('#pf-step-list li')) {
    li.classList.add('active');
    await sleep(700 + Math.random() * 500);
    li.classList.remove('active');
    li.classList.add('done');
  }
  await sleep(450);

  const confidence = Math.round(78 + Math.random() * 21);
  const pass = confidence >= 80;
  pf.result = {
    verdict: pass ? 'verified' : 'rejected',
    confidence,
    detected: pickDetected(t, pass),
    note: (pass ? MOCK.NOTES_PASS : MOCK.NOTES_FAIL)[Math.floor(Math.random() * (pass ? MOCK.NOTES_PASS.length : MOCK.NOTES_FAIL.length))],
    at: Date.now()
  };
  renderPfResult();
}

function renderPfResult() {
  const r = pf.result;
  const pass = r.verdict === 'verified';
  const icon = $('#pf-verdict-icon');
  icon.textContent = pass ? '✓' : '✕';
  icon.classList.toggle('fail', !pass);
  $('#pf-verdict-title').textContent = pass ? 'Verified' : "Couldn't verify";
  $('#pf-verdict-sub').textContent = pass ? '' : 'Try again. The timer is still running.';
  $('#pf-conf-text').textContent = r.confidence + '%';
  requestAnimationFrame(() => { $('#pf-conf-fill').style.width = r.confidence + '%'; });
  $('#pf-result').classList.remove('hidden');
  if (pass) $('#btn-pf-done').classList.remove('hidden');
  else $('#btn-pf-retake').classList.remove('hidden');
}

/* ---------- AI report modal ---------- */
function openReport(taskId) {
  const t = taskById(taskId);
  if (!t || !t.proof) return;
  const ai = t.proof.ai;
  $('#report-image').src = t.proof.image;
  $('#report-task-name').textContent = `${t.icon} ${t.name}`;
  $('#report-verdict').textContent = ai.verdict === 'verified' ? 'Verified' : 'Rejected';
  $('#report-confidence').textContent = ai.confidence + '%';
  $('#report-time').textContent = new Date(ai.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  $('#overlay-report').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}

function closeReport() {
  $('#overlay-report').classList.add('hidden');
  if (!$('#overlay-add').classList.contains('hidden') || !$('#overlay-proof').classList.contains('hidden')) return;
  document.body.classList.remove('no-scroll');
}

/* ---------- two-step confirm (reset) ---------- */
function twoStep(btn, fn) {
  if (btn.dataset.armed) {
    delete btn.dataset.armed;
    btn.classList.remove('armed');
    btn.textContent = btn.dataset.orig || '';
    fn();
    return;
  }
  btn.dataset.armed = '1';
  btn.dataset.orig = btn.textContent;
  btn.textContent = 'Tap again to confirm';
  btn.classList.add('armed');
  setTimeout(() => {
    if (btn.isConnected && btn.dataset.armed) {
      delete btn.dataset.armed;
      btn.classList.remove('armed');
      btn.textContent = btn.dataset.orig || '';
    }
  }, 2600);
}

function handleComplete(btn) {
  const t = taskById(btn.dataset.complete);
  if (!t || t.status !== 'active') return;
  if (isMobile()) openProofFlow(t.id);   // mobile: camera + AI proof (photo-library fallback inside)
  else showPhonePrompt();                // desktop: completion must happen on the phone
}

/* ---------- phone prompt (desktop can't complete tasks) ---------- */
function showPhonePrompt() {
  $('#overlay-phone').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}

function closePhonePrompt() {
  $('#overlay-phone').classList.add('hidden');
  if (!$('#overlay-add').classList.contains('hidden') || !$('#overlay-proof').classList.contains('hidden')) return;
  document.body.classList.remove('no-scroll');
}

/* ---------- event bindings ---------- */
function showLoginError(msg, offerSignup = false) {
  const el = $('#login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  $('#login-to-signup').classList.toggle('hidden', !offerSignup);
}

/* ---------- sign in / create account screen ---------- */
let authMode = 'signin';
const regTouched = new Set();
const regValues = () => ({ name: $('#reg-name').value, username: $('#reg-user').value, password: $('#reg-pass').value, confirm: $('#reg-pass2').value });
const REG_FIELDS = { name: 'reg-name', username: 'reg-user', password: 'reg-pass', confirm: 'reg-pass2' };
const STRENGTH_LABEL = ['Too short', 'Weak', 'Okay', 'Strong'];

function setAuthMode(mode) {
  authMode = mode;
  $$('.auth-tabs .seg-btn').forEach(b => { const on = b.dataset.auth === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#auth-signin').classList.toggle('hidden', mode !== 'signin');
  $('#auth-signup').classList.toggle('hidden', mode !== 'signup');
  $('#login-error').classList.add('hidden');
  $('#login-to-signup').classList.add('hidden');
  setTimeout(() => {
    const a = document.activeElement;
    if (!a || a === document.body || a.classList.contains('seg-btn')) $(mode === 'signup' ? '#reg-name' : '#login-user').focus();
  }, 30);
}

// Shows a message under each field that has been touched (or every field, after a submit attempt).
function renderRegister(showAll = false) {
  const v = regValues(), errors = validateRegistration(v);
  Object.entries(REG_FIELDS).forEach(([key, id]) => {
    const input = $('#' + id), msg = $('#err-' + id);
    const show = showAll || (regTouched.has(key) && (key !== 'confirm' || v.confirm));
    const bad = show && errors[key];
    input.classList.toggle('invalid', !!bad);
    input.setAttribute('aria-invalid', bad ? 'true' : 'false');
    msg.classList.remove('ok');
    msg.textContent = bad ? errors[key] : '';
    if (!bad && key === 'username' && regTouched.has(key) && v.username.trim()) { msg.textContent = 'Available'; msg.classList.add('ok'); }
  });
  const level = passwordStrength(v.password);
  $('#pw-meter').dataset.level = v.password ? level : 0;
  return errors;
}

function bindEvents() {
  // sign in / create account
  $$('.auth-tabs .seg-btn').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.auth)));
  $('#login-to-signup').addEventListener('click', () => {
    const typed = $('#login-user').value.trim();
    setAuthMode('signup');
    if (typed) { $('#reg-user').value = typed; regTouched.add('username'); renderRegister(); }
  });
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('#login-user').value.trim(), p = $('#login-pass').value;
    if (!u || !p) return showLoginError('Enter a username and password.');
    const err = await handleLogin(u, p);
    if (err) showLoginError(err.message, !!err.signup);
  });
  $('#btn-toggle-pass').addEventListener('click', () => {
    const i = $('#login-pass');
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    $('#btn-toggle-pass').textContent = show ? 'Hide' : 'Show';
    $('#btn-toggle-pass').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  // registration: check as people type, after they have visited each field
  Object.entries(REG_FIELDS).forEach(([key, id]) => {
    $('#' + id).addEventListener('input', () => { if (key !== 'confirm' || $('#reg-pass2').value) regTouched.add(key); renderRegister(); });
    $('#' + id).addEventListener('blur', () => { if ($('#' + id).value) { regTouched.add(key); renderRegister(); } });
  });
  $('#btn-toggle-reg-pass').addEventListener('click', () => {
    const show = $('#reg-pass').type === 'password';
    ['#reg-pass', '#reg-pass2'].forEach(sel => { $(sel).type = show ? 'text' : 'password'; });
    $('#btn-toggle-reg-pass').textContent = show ? 'Hide' : 'Show';
    $('#btn-toggle-reg-pass').setAttribute('aria-label', show ? 'Hide passwords' : 'Show passwords');
  });
  $('#register-form').addEventListener('submit', e => {
    e.preventDefault();
    const errors = registerAccount(regValues());
    if (!errors) return;
    renderRegister(true);
    const first = Object.keys(REG_FIELDS).find(k => errors[k]);
    $('#' + REG_FIELDS[first]).focus();
  });
  $('#demo-fill').addEventListener('click', () => {
    $('#login-user').value = 'demo';
    $('#login-pass').value = 'demo123';
    $('#login-form').requestSubmit();
  });

  // navigation + logout
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v) showView(v.dataset.view);
  });
  $('#btn-logout').addEventListener('click', logout);
  $('#btn-logout2').addEventListener('click', logout);

  // appearance
  $('#theme-choice').addEventListener('click', e => { const b = e.target.closest('[data-theme-choice]'); if (b) applyTheme(b.dataset.themeChoice); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themeChoice() === 'auto') applyTheme('auto'); });
  applyTheme(themeChoice());

  // history: filter, show more
  $('#history-filter').addEventListener('click', e => {
    const b = e.target.closest('[data-hf]');
    if (!b) return;
    historyFilter = b.dataset.hf; historyLimit = 8;
    renderRecord();
  });
  $('#btn-history-more').addEventListener('click', () => { historyLimit += 8; renderRecord(); });
  // history: add funds lives in settings
  $('#btn-add-funds-hero').addEventListener('click', () => showView('settings'));

  // add task
  $('#fab-add').addEventListener('click', () => openAddTask());
  $('#btn-add-task-desktop').addEventListener('click', () => openAddTask());
  $('#btn-add-task-empty').addEventListener('click', () => openAddTask());
  $('#recommended').addEventListener('click', e => {
    const b = e.target.closest('[data-reco]');
    const r = b && RECOMMENDED.find(x => x.name === b.dataset.reco);
    if (r) openAddTask(r);
  });
  $('#btn-done-close').addEventListener('click', closeCelebration);
  $('#overlay-done').addEventListener('click', e => { if (e.target.id === 'overlay-done') closeCelebration(); });
  $('#btn-cancel-add').addEventListener('click', closeAddTask);
  $('#overlay-add').addEventListener('click', e => { if (e.target.id === 'overlay-add') closeAddTask(); });
  $('#add-task-form').addEventListener('submit', submitAddTask);
  ['#at-name', '#at-hours', '#at-minutes', '#at-date', '#at-time'].forEach(sel => $(sel).addEventListener('input', () => { updateDuePreview(); updateAddAssist(); }));
  $('#at-date').addEventListener('input', () => $$('#date-presets .chip').forEach(c => c.classList.remove('active')));
  $$('.seg-btn').forEach(b => b.addEventListener('click', () => setAddMode(b.dataset.mode)));
  $('#date-presets').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c || c.disabled) return;
    if (c.dataset.when) setDateShortcut(c.dataset.when);
    else if (c.dataset.days) setDatePreset(+c.dataset.days);
  });
  $('#at-assist').addEventListener('click', e => {
    if (!e.target.closest('#at-assist-more')) return;
    const r = computeDeadline();
    openHelp({ name: $('#at-name').value.trim() }, addMode === 'duration' && r.ok ? Math.round(r.durationMs / 60000) : undefined);
  });
  $('#btn-help-close').addEventListener('click', closeHelp);
  $('#overlay-help').addEventListener('click', e => { if (e.target.id === 'overlay-help') closeHelp(); });
  $('#duration-presets').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    if (c.dataset.custom) { showCustomDuration(true); updateDuePreview(); updateAddAssist(); return; }
    $('#at-hours').value = c.dataset.h;
    $('#at-minutes').value = c.dataset.m;
    showCustomDuration(false);
    $$('#duration-presets [data-h]').forEach(x => x.classList.toggle('active', x === c));
    updateDuePreview();
    updateAddAssist();
  });
  // typing a length by hand keeps "Custom" selected
  ['#at-hours', '#at-minutes'].forEach(sel => $(sel).addEventListener('input', () => { showCustomDuration(true); }));

  // home list: complete / delete / report + charity select (delegated)
  document.addEventListener('click', e => {
    const hp = e.target.closest('[data-help]');
    if (hp) { const t = taskById(hp.dataset.help); if (t) openHelp({ name: t.name }, t.byDate ? undefined : Math.round(t.durationMs / 60000)); return; }
    const c = e.target.closest('[data-complete]'); if (c) return handleComplete(c);
    const d = e.target.closest('[data-delete]'); if (d) return deleteTask(d.dataset.delete);
    const r = e.target.closest('[data-report]'); if (r) openReport(r.dataset.report);
    const s = e.target.closest('[data-select]'); if (s) selectCharity(s.dataset.select);
  });

  // settings
  $('#funds-chips').addEventListener('click', e => {
    const c = e.target.closest('[data-amount]');
    if (c) addFunds(c.dataset.amount);
  });
  $('#btn-save-default').addEventListener('click', () => {
    const v = Math.round(+$('#default-penalty').value);
    if (!v || v < 1) return toast('Enter an amount', 'error');
    state.defaultPenalty = v;
    saveState();
    toast('Saved', 'success');
  });
  $('#btn-reset').addEventListener('click', e => twoStep(e.currentTarget, resetDemoData));

  // proof flow
  $('#btn-pf-cancel').addEventListener('click', closeProofFlow);
  $('#btn-capture').addEventListener('click', captureFromVideo);
  $('#pf-file-fallback').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    pf.image = await downscaleFile(f);
    runAnalysis();
  });
  $('#btn-pf-retake').addEventListener('click', () => {
    pf.image = null;
    showPfStage('camera');
    startCamera();
  });
  $('#btn-pf-done').addEventListener('click', () => {
    const t = taskById(pf.taskId);
    if (!t) return;
    closeProofFlow();
    completeTask(t, { image: pf.image, ai: pf.result });
  });

  // report modal
  $('#btn-close-report').addEventListener('click', closeReport);
  $('#overlay-report').addEventListener('click', e => { if (e.target.id === 'overlay-report') closeReport(); });

  // phone prompt (desktop)
  $('#btn-phone-ok').addEventListener('click', closePhonePrompt);
  $('#overlay-phone').addEventListener('click', e => { if (e.target.id === 'overlay-phone') closePhonePrompt(); });

  // escape closes topmost overlay
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#overlay-help').classList.contains('hidden')) closeHelp();
    else if (!$('#overlay-done').classList.contains('hidden')) closeCelebration();
    else if (!$('#overlay-proof').classList.contains('hidden')) closeProofFlow();
    else if (!$('#overlay-phone').classList.contains('hidden')) closePhonePrompt();
    else if (!$('#overlay-report').classList.contains('hidden')) closeReport();
    else if (!$('#overlay-add').classList.contains('hidden')) closeAddTask();
  });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  migrateLegacy();
  bindEvents();
  startTick();
  const session = localStorage.getItem(LS_SESSION);
  if (session && getUsers()[session]) {
    startSession(session);
  }
});
