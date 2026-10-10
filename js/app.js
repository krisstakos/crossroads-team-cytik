/* Commit — accountability app (mock, no backend). All data lives in localStorage. */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(res => setTimeout(res, ms));
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMoney = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtClock(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
const digitsHTML = text => Array.from(text).map((c, i) => `<span class="dg in" style="--d:${i * 70}ms">${c}</span>`).join('');
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
function countUp(el, to, fmt = String, ms = 900) {
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
  countUp($('#hero-balance'), state.balance, roundMoney, 1000);
  countUp($('#stat-completed'), state.tasks.filter(t => t.status === 'completed').length, n => Math.round(n));
  countUp($('#stat-missed'), state.tasks.filter(t => t.status === 'failed').length, n => Math.round(n));
  countUp($('#stat-sent'), state.totalSent, roundMoney);
}

function burst() {
  if (reduceMotion()) return;
  const root = document.createElement('div');
  root.className = 'burst';
  const colors = ['#1ef0a6', '#4cb2ff', '#ffc233', '#a78bff', '#ffffff'];
  for (let i = 0; i < 44; i++) {
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
    const p = document.createElement('i');
    p.style.cssText = `--c:${colors[i % colors.length]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d + 80}px;--r:${Math.random() * 720 - 360}deg;--t:${0.9 + Math.random() * 0.7}s`;
    root.appendChild(p);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 1800);
}

function flash() {
  if (reduceMotion()) return;
  const f = document.createElement('div');
  f.className = 'flash';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 900);
}

/* ---------- state ---------- */
const LS_STATE = 'commit_state_v1', LS_USER = 'commit_user_v1', LS_SESSION = 'commit_session_v1';
let state = null;
let currentUser = null;

function loadState() { try { const raw = localStorage.getItem(LS_STATE); if (raw) return JSON.parse(raw); } catch (e) {} return null; }
function saveState() {
  try { localStorage.setItem(LS_STATE, JSON.stringify(state)); }
  catch (e) { toast('Storage is full — the latest proof image may not persist', 'error'); }
}
const initState = () => { state = loadState() || MOCK.seedState(); if (!loadState()) saveState(); };
const taskById = id => state.tasks.find(t => t.id === id);
const selectedCharity = () => state.charities.find(c => c.id === state.selectedCharityId) || state.charities[0];

function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}
const hasCamera = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

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
function storedUser() { try { return JSON.parse(localStorage.getItem(LS_USER)); } catch (e) { return null; } }

async function handleLogin(u, p) {
  const user = storedUser();
  if (!user) {
    localStorage.setItem(LS_USER, JSON.stringify({ username: u, password: p }));
    currentUser = { username: u };
  } else if (user.username === u && user.password === p) {
    currentUser = { username: u };
  } else return false;
  localStorage.setItem(LS_SESSION, u);
  enterApp();
  return true;
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
  if (name === 'record' && state) playRecordCounters();
}

function enterApp() {
  const name = currentUser.username;
  $('#view-login').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  $('#side-username').textContent = cap;
  $('#set-avatar').textContent = name.charAt(0) || 'A';
  renderAll();
  showView('home');
}

function renderAll() { renderHome(); renderRecord(); renderCharities(); renderSettings(); updateTopbarBalance(); }

/* ---------- today: live timers only ---------- */
const RING_LONG = 5; // countdown strings longer than "mm:ss" get a smaller ring numeral
function taskCardHTML(t, lead) {
  const remaining = t.deadline - Date.now();
  const pct = Math.max(0, Math.min(100, (remaining / t.durationMs) * 100));
  const text = fmtCountdown(remaining);
  const btn = `<button class="btn primary complete-btn" data-complete="${t.id}">${isMobile() ? 'Complete with photo' : 'Complete'}</button>`;
  const del = `<button class="icon-btn delete-btn" data-delete="${t.id}" aria-label="Delete ${esc(t.name)}">✕</button>`;
  const countdown = `<span class="countdown" data-countdown="${t.id}" aria-label="${text} remaining">${digitsHTML(text)}</span>`;

  if (!lead) {
    return `<article class="task-card" data-task-id="${t.id}">
      <div class="task-head">
        <div class="task-title"><h3>${esc(t.name)}</h3><span class="chip stake">${fmtMoney(t.penalty)} on the line</span></div>
        ${del}
      </div>
      <div class="timer-block">
        <div class="timer-row">${countdown}<span class="deadline-label">Ends ${fmtClock(t.deadline)}</span></div>
        <div class="progress"><div class="progress-fill" data-progress="${t.id}" style="width:${pct}%"></div></div>
      </div>
      ${btn}
    </article>`;
  }

  return `<article class="task-card lead${text.length > RING_LONG ? ' long' : ''}" data-task-id="${t.id}">
    <div class="lead-body">
      <div class="ring-wrap">
        <svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="rg-${t.id}" class="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" cx="60" cy="60" r="54" pathLength="100" stroke="url(#rg-${t.id})" data-ring="${t.id}" style="stroke-dashoffset:${(100 - pct).toFixed(2)}"/></svg>
        <div class="ring-center">${countdown}<span class="ring-caption">remaining</span></div>
      </div>
      <div class="lead-info">
        <div class="task-head">
          <div class="task-title"><h3>${esc(t.name)}</h3><span class="chip stake">Up next</span></div>
          ${del}
        </div>
        <dl class="fact-list">
          <div class="fact"><dt>Stake</dt><dd>${fmtMoney(t.penalty)}</dd></div>
          <div class="fact"><dt>Deadline</dt><dd>${fmtClock(t.deadline)}</dd></div>
          <div class="fact wide"><dt>If time runs out</dt><dd>${fmtMoney(t.penalty)} goes to ${esc(selectedCharity().name)}</dd></div>
        </dl>
        ${btn}
      </div>
    </div>
  </article>`;
}

/* ---------- recommended tasks ---------- */
const RECOMMENDED = [
  { name: 'Gym visit',       icon: '🏋️', h: 2, m: 0,  stake: 10, tint: '#ff8a4c', why: 'The classic. Photo of the gym floor.' },
  { name: 'Morning run',     icon: '🏃', h: 1, m: 0,  stake: 5,  tint: '#4cb2ff', why: 'Short, measurable, easy to prove.' },
  { name: 'Study session',   icon: '📚', h: 1, m: 0,  stake: 5,  tint: '#a78bff', why: 'Open books on a desk is enough.' },
  { name: 'Deep work block', icon: '💻', h: 2, m: 0,  stake: 10, tint: '#1ef0a6', why: 'Two focused hours on one thing.' },
  { name: 'Cook dinner',     icon: '🍳', h: 1, m: 0,  stake: 5,  tint: '#ffc233', why: 'Skip the takeout, save the stake.' },
  { name: 'Tidy the room',   icon: '🧹', h: 0, m: 30, stake: 3,  tint: '#3dd9d0', why: 'A small win in 30 minutes.' },
  { name: 'Yoga or stretch', icon: '🧘', h: 0, m: 30, stake: 5,  tint: '#ff6fae', why: 'Mat on the floor counts.' },
  { name: 'Water the plants', icon: '🌿', h: 0, m: 30, stake: 3, tint: '#7be07b', why: 'Easy streak starter.' }
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

function renderRecommended() {
  const list = recommendedTasks().slice(0, 7);
  $('#reco-title').classList.toggle('hidden', !list.length);
  $('#recommended').innerHTML = list.map((r, i) => `
    <article class="reco" style="--tint:${r.tint};--i:${i + 2}">
      <div class="reco-top">
        <div class="reco-icon" aria-hidden="true">${r.icon}</div>
        <div><h3>${esc(r.name)}</h3><p class="sub">${esc(r.why)}</p></div>
      </div>
      <div class="reco-meta">
        <div><b>${r.h ? r.h + 'h' : ''}${r.m ? (r.h ? ' ' : '') + r.m + 'm' : ''}</b><span>Time limit</span></div>
        <div><b>${fmtMoney(r.stake)}</b><span>Stake</span></div>
      </div>
      <button class="btn ghost sm" data-reco="${esc(r.name)}">Start this task</button>
    </article>`).join('');
}

function renderHome() {
  const active = state.tasks.filter(t => t.status === 'active').sort((a, b) => a.deadline - b.deadline);
  const date = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const atRisk = active.reduce((sum, t) => sum + t.penalty, 0);
  $('#greet-date').textContent = active.length
    ? `${date}. ${active.length} running, ${fmtMoney(atRisk)} on the line.`
    : date;

  const list = $('#tasks-active-list');
  list.classList.toggle('solo', active.length <= 1);
  list.innerHTML = active.length
    ? taskCardHTML(active[0], true) + (active.length > 1 ? `<div class="rest">${active.slice(1).map(t => taskCardHTML(t, false)).join('')}</div>` : '')
    : '';
  $$('.task-card', list).forEach((c, i) => c.style.setProperty('--i', i));
  $('#no-tasks').classList.toggle('hidden', active.length > 0);
  renderRecommended();
  updateTopbarBalance();
}

/* ---------- history: balance, results, activity ---------- */
function historyItemHTML(t) {
  const done = t.status === 'completed';
  const when = done ? t.completedAt : (t.failedAt || Date.now());
  const meta = done
    ? (t.proof ? `Verified at ${t.proof.ai.confidence}% confidence` : 'Completed')
    : `${fmtMoney(t.charged || 0)} sent to charity`;
  return `<div class="history-item ${done ? '' : 'failed'}">
    <div class="h-main"><p>${esc(t.name)}</p><small>${meta}, ${timeAgo(when)}</small></div>
    <span class="h-status">${done ? 'Done' : 'Missed'}</span>
    ${done && t.proof ? `<button class="thumb" data-report="${t.id}" aria-label="View AI report"><img src="${t.proof.image}" alt="Proof photo"/></button>` : ''}
  </div>`;
}

function renderRecord() {
  $('#hero-balance').textContent = fmtMoney(state.balance);
  $('#stat-completed').textContent = state.tasks.filter(t => t.status === 'completed').length;
  $('#stat-missed').textContent = state.tasks.filter(t => t.status === 'failed').length;
  $('#stat-sent').textContent = fmtMoney(state.totalSent);

  const history = state.tasks.filter(t => t.status !== 'active')
    .sort((a, b) => ((b.completedAt || b.failedAt) || 0) - ((a.completedAt || a.failedAt) || 0)).slice(0, 12);
  $('#tasks-history-list').innerHTML = history.length
    ? history.map(historyItemHTML).join('')
    : '<p class="plain-empty">No completed or missed tasks yet.</p>';

  const act = state.activity.slice(0, 8);
  $('#activity-list').innerHTML = act.length
    ? act.map(a => `<div class="activity-item"><p>${esc(a.text)}</p><small data-timeago="${a.at}">${timeAgo(a.at)}</small></div>`).join('')
    : '<p class="plain-empty">No activity yet.</p>';
  [$('#tasks-history-list'), $('#activity-list')].forEach(l => Array.from(l.children).forEach((c, i) => c.style.setProperty('--i', i + 4)));
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
  pushActivity('💸', `Missed "${t.name}" — ${fmtMoney(charged)} sent to ${c.name}`, 'penalty');
  saveState();
  flash();
  toast(`Time's up on "${t.name}". ${fmtMoney(charged)} went to ${c.name}.`, 'warn');
  if (state.balance <= 0) setTimeout(() => toast('Account is empty. Add funds in Settings.', 'error'), 400);
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
  $('#done-sub').textContent = proof ? `"${t.name}" verified at ${proof.ai.confidence}% confidence.` : `"${t.name}" is done.`;
  $('#done-stake').textContent = `${stake} stays in your balance`;
  $('#overlay-done').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  if (navigator.vibrate) navigator.vibrate([30, 50, 70]);
  setTimeout(burst, 850);
  setTimeout(() => $('#btn-done-close').focus(), 1500);
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
  toast(`Removed "${t.name}"`, 'info');
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
    card.classList.toggle('urgent', pct <= 25 && pct > 10);
    card.classList.toggle('critical', pct <= 10);
  });

  $$('[data-timeago]').forEach(el => { el.textContent = timeAgo(+el.dataset.timeago); });

  if (expired) renderAll();
}

/* ---------- add task ---------- */
let selectedIcon = MOCK.EMOJIS[0];

function buildIconPicker() {
  $('#at-icon-picker').innerHTML = MOCK.EMOJIS.map(e =>
    `<button type="button" class="icon-pick ${e === selectedIcon ? 'active' : ''}" data-icon="${e}">${e}</button>`).join('');
}

function openAddTask(preset) {
  const p = preset && preset.name ? preset : null;   // click handlers pass an Event; only plain presets count
  const h = p ? p.h : 1, m = p ? p.m : 0;
  $('#at-name').value = p ? p.name : '';
  $('#at-hours').value = h;
  $('#at-minutes').value = m;
  $('#at-penalty').value = p ? p.stake : (state.defaultPenalty || 10);
  selectedIcon = p && p.icon ? p.icon : MOCK.EMOJIS[0];
  buildIconPicker();
  $$('#duration-presets .chip').forEach(c => c.classList.toggle('active', +c.dataset.h === h && +c.dataset.m === m));
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
  const h = Math.min(72, Math.max(0, +$('#at-hours').value || 0));
  const m = Math.min(59, Math.max(0, +$('#at-minutes').value || 0));
  const mins = h * 60 + m;
  const penalty = Math.max(1, Math.round(+$('#at-penalty').value) || state.defaultPenalty);
  if (!name) { toast('Give your task a name', 'error'); return; }
  if (mins <= 0) { toast('Set a time limit (hours or minutes)', 'error'); return; }
  if (penalty > state.balance) { toast(`Your stake is more than your balance (${fmtMoney(state.balance)}). Lower it or add funds.`, 'error'); return; }

  const now = Date.now();
  state.tasks.unshift({
    id: uid(), name, icon: selectedIcon, status: 'active',
    createdAt: now, deadline: now + mins * 60000, durationMs: mins * 60000, penalty
  });
  saveState();
  closeAddTask();
  renderHome();
  toast(`Timer started for "${name}"`, 'success');
}

/* ---------- charities ---------- */
function renderCharities() {
  $('#charities-list').innerHTML = state.charities.map((c, i) => `
    <article class="charity-card ${c.id === state.selectedCharityId ? 'selected' : ''}" style="--i:${i + 1}">
      <h3>${esc(c.name)}</h3>
      <p class="sub">${esc(c.desc)}</p>
      <div class="charity-foot">
        <span class="raised">Raised ${fmtMoney(c.raised)}</span>
        ${c.id === state.selectedCharityId
          ? '<span class="badge-selected">Selected</span>'
          : `<button class="btn ghost sm" data-select="${c.id}">Select</button>`}
      </div>
    </article>`).join('');
}

function selectCharity(id) {
  const c = state.charities.find(x => x.id === id);
  if (!c) return;
  state.selectedCharityId = id;
  saveState();
  renderCharities();
  toast(`Penalties will now go to ${c.name}`, 'success');
}

/* ---------- settings ---------- */
function renderSettings() {
  $('#settings-username').textContent = (currentUser.username || '').charAt(0).toUpperCase() + (currentUser.username || '').slice(1);
  $('#set-balance').textContent = fmtMoney(state.balance);
  $('#set-sent').textContent = fmtMoney(state.totalSent);
  $('#default-penalty').value = state.defaultPenalty;
}

function addFunds(amount) {
  const a = Math.round(+amount);
  if (!a || a <= 0) { toast('Enter a valid amount', 'error'); return; }
  state.balance += a;
  pushActivity('💰', `Added ${fmtMoney(a)} to account`, 'funds');
  saveState();
  renderAll();
  toast(`${fmtMoney(a)} added to your account`, 'success');
}

function resetDemoData() {
  localStorage.removeItem(LS_STATE);
  state = MOCK.seedState();
  saveState();
  renderAll();
  showView('home');
  toast('Demo data has been reset', 'info');
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
  $('#pf-verdict-title').textContent = pass ? 'Verified!' : "Couldn't verify";
  $('#pf-verdict-sub').textContent = pass
    ? 'This photo looks like genuine proof of your task.'
    : 'The AI is not confident this shows the activity. Try again — the timer keeps running.';
  $('#pf-conf-text').textContent = r.confidence + '%';
  requestAnimationFrame(() => { $('#pf-conf-fill').style.width = r.confidence + '%'; });
  $('#pf-detected').innerHTML = r.detected.map(d => `<span class="chip">${esc(d)}</span>`).join('');
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
  $('#report-verdict').textContent = ai.verdict === 'verified' ? 'Verified ✓' : 'Rejected ✗';
  $('#report-confidence').textContent = ai.confidence + '%';
  $('#report-time').textContent = new Date(ai.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  $('#report-detected').innerHTML = ai.detected.map(d => `<span class="chip">${esc(d)}</span>`).join('');
  $('#report-note').textContent = ai.note;
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
function showLoginError(msg) {
  const el = $('#login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  const card = $('#login-card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

function bindEvents() {
  // login
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const u = $('#login-user').value.trim(), p = $('#login-pass').value;
    if (!u || !p) return showLoginError('Enter a username and password.');
    const ok = await handleLogin(u, p);
    if (!ok) showLoginError('Invalid credentials. (The first login creates the account.)');
  });
  $('#btn-toggle-pass').addEventListener('click', () => {
    const i = $('#login-pass');
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    $('#btn-toggle-pass').textContent = show ? 'Hide' : 'Show';
    $('#btn-toggle-pass').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  $('#demo-fill').addEventListener('click', () => {
    $('#login-user').value = 'demo';
    $('#login-pass').value = 'demo123';
    $('#login-form').requestSubmit();
  });

  // pointer spotlight on cards
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.task-card,.reco,.charity-card,.ledger');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  // navigation + logout
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-view]');
    if (v) showView(v.dataset.view);
  });
  $('#btn-logout').addEventListener('click', logout);
  $('#btn-logout2').addEventListener('click', logout);

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
  $('#at-icon-picker').addEventListener('click', e => {
    const b = e.target.closest('[data-icon]');
    if (!b) return;
    selectedIcon = b.dataset.icon;
    $$('#at-icon-picker .icon-pick').forEach(x => x.classList.toggle('active', x === b));
  });
  $('#duration-presets').addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (!c) return;
    $('#at-hours').value = c.dataset.h;
    $('#at-minutes').value = c.dataset.m;
    $$('#duration-presets .chip').forEach(x => x.classList.toggle('active', x === c));
  });
  ['#at-hours', '#at-minutes'].forEach(sel => $(sel).addEventListener('input', () => {
    $$('#duration-presets .chip').forEach(x => x.classList.remove('active'));
  }));

  // home list: complete / delete / report + charity select (delegated)
  document.addEventListener('click', e => {
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
  $('#btn-add-custom').addEventListener('click', () => {
    addFunds($('#custom-funds').value);
    $('#custom-funds').value = '';
  });
  $('#btn-save-default').addEventListener('click', () => {
    const v = Math.round(+$('#default-penalty').value);
    if (!v || v < 1) return toast('Enter a valid amount', 'error');
    state.defaultPenalty = v;
    saveState();
    toast('Default stake saved', 'success');
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
    if (!$('#overlay-done').classList.contains('hidden')) closeCelebration();
    else if (!$('#overlay-proof').classList.contains('hidden')) closeProofFlow();
    else if (!$('#overlay-phone').classList.contains('hidden')) closePhonePrompt();
    else if (!$('#overlay-report').classList.contains('hidden')) closeReport();
    else if (!$('#overlay-add').classList.contains('hidden')) closeAddTask();
  });
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initState();
  bindEvents();
  startTick();
  const session = localStorage.getItem(LS_SESSION);
  const user = storedUser();
  if (session && user && user.username === session) {
    currentUser = { username: user.username };
    enterApp();
  }
});







