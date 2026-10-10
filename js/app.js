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

/* ---------- state ---------- */
const LS_STATE = 'commit_state_v1', LS_USER = 'commit_user_v1', LS_SESSION = 'commit_session_v1', LS_HIW = 'commit_hiw_dismissed';
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
  const icons = { success: '✅', warn: '⚠️', error: '⛔', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><p style="flex:1">${esc(msg)}</p>`;
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
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo({ top: 0 });
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

function renderAll() { renderHome(); renderCharities(); renderSettings(); updateTopbarBalance(); }

/* ---------- home rendering ---------- */
function taskCardHTML(t) {
  const remaining = t.deadline - Date.now();
  const pct = Math.max(0, Math.min(100, (remaining / t.durationMs) * 100));
  return `<article class="task-card" data-task-id="${t.id}">
    <div class="task-head">
      <div class="task-icon">${t.icon}</div>
      <div class="task-title"><h3>${esc(t.name)}</h3><span class="chip stake">${fmtMoney(t.penalty)} at stake</span></div>
      <button class="icon-btn sm delete-btn" data-delete="${t.id}" aria-label="Delete task">✕</button>
    </div>
    <div class="timer-block">
      <div class="timer-row"><span class="countdown" data-countdown="${t.id}">${fmtCountdown(remaining)}</span><span class="deadline-label">ends ${fmtClock(t.deadline)} · ${Math.round(pct)}%</span></div>
      <div class="progress"><div class="progress-fill" data-progress="${t.id}" style="width:${pct}%"></div></div>
    </div>
    <button class="btn primary complete-btn" data-complete="${t.id}">${isMobile() ? 'Complete 📷' : 'Complete ✓'}</button>
  </article>`;
}

function historyItemHTML(t) {
  const done = t.status === 'completed';
  const when = done ? t.completedAt : (t.failedAt || Date.now());
  const meta = done
    ? (t.proof ? `Verified · ${t.proof.ai.confidence}% confidence` : 'Completed')
    : `Missed · ${fmtMoney(t.charged || 0)} sent to charity`;
  return `<div class="history-item ${done ? '' : 'failed'}">
    <div class="h-icon">${done ? '✅' : '❌'}</div>
    <div class="h-main"><p>${esc(t.name)}</p><small>${meta} · ${timeAgo(when)}</small></div>
    ${done && t.proof ? `<button class="thumb" data-report="${t.id}" aria-label="View AI report"><img src="${t.proof.image}" alt="proof"/></button>` : ''}
  </div>`;
}

function renderHome() {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  $('#greeting').textContent = `Good ${part}, ${(currentUser.username || '').charAt(0).toUpperCase()} 👋`;
  $('#greet-date').textContent = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  $('#hero-balance').textContent = fmtMoney(state.balance);
  const active = state.tasks.filter(t => t.status === 'active');
  $('#stat-active').textContent = active.length;
  $('#stat-completed').textContent = state.tasks.filter(t => t.status === 'completed').length;
  $('#stat-sent').textContent = fmtMoney(state.totalSent);

  if (!localStorage.getItem(LS_HIW)) $('#how-it-works').classList.remove('hidden');

  const list = $('#tasks-active-list');
  list.innerHTML = active.map(taskCardHTML).join('');
  $('#active-count').textContent = active.length;
  $('#no-tasks').classList.toggle('hidden', active.length > 0);

  const history = state.tasks.filter(t => t.status !== 'active')
    .sort((a, b) => ((b.completedAt || b.failedAt) || 0) - ((a.completedAt || a.failedAt) || 0)).slice(0, 12);
  $('#tasks-history-list').innerHTML = history.length
    ? history.map(historyItemHTML).join('')
    : '<p class="sub" style="padding:16px">No completed or missed tasks yet.</p>';

  const act = state.activity.slice(0, 8);
  $('#activity-list').innerHTML = act.length
    ? act.map(a => `<div class="activity-item"><span class="a-icon">${a.icon}</span><p>${esc(a.text)}</p><small data-timeago="${a.at}">${timeAgo(a.at)}</small></div>`).join('')
    : '<p class="sub" style="padding:16px">Nothing yet.</p>';

  updateTopbarBalance();
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
  toast(`⏰ Time's up on "${t.name}" — ${fmtMoney(charged)} went to ${c.name}`, 'warn');
  if (state.balance <= 0) setTimeout(() => toast('Account is empty. Add funds in Settings.', 'error'), 400);
}

function completeTask(t, proof) {
  t.status = 'completed';
  t.completedAt = Date.now();
  if (proof) t.proof = proof;
  pushActivity('✅', `Completed "${t.name}"${proof ? ` · verified ${proof.ai.confidence}% confidence` : ''}`, 'completed');
  saveState();
  renderAll();
  toast(proof ? `Verified! "${t.name}" is done 🎉` : `"${t.name}" marked complete ✓`, 'success');
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
  let expired = false;
  state.tasks.forEach(t => { if (t.status === 'active' && Date.now() >= t.deadline) { failTask(t); expired = true; } });

  $$('.task-card[data-task-id]').forEach(card => {
    const t = taskById(card.dataset.taskId);
    if (!t || t.status !== 'active') return;
    const remaining = Math.max(0, t.deadline - Date.now());
    const pct = Math.max(0, (remaining / t.durationMs) * 100);
    const cd = $(`[data-countdown="${t.id}"]`, card);
    if (cd) cd.textContent = fmtCountdown(remaining);
    const pf = $(`[data-progress="${t.id}"]`, card);
    if (pf) pf.style.width = pct + '%';
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

function openAddTask() {
  $('#at-name').value = '';
  $('#at-hours').value = 1;
  $('#at-minutes').value = 0;
  $('#at-penalty').value = state.defaultPenalty || 10;
  selectedIcon = MOCK.EMOJIS[0];
  buildIconPicker();
  $$('#duration-presets .chip').forEach(c => c.classList.toggle('active', c.dataset.h === '1' && c.dataset.m === '0'));
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
  const h = Math.max(0, +$('#at-hours').value || 0);
  const m = Math.min(59, Math.max(0, +$('#at-minutes').value || 0));
  const mins = h * 60 + m;
  const penalty = Math.max(1, Math.round(+$('#at-penalty').value) || state.defaultPenalty);
  if (!name) { toast('Give your task a name', 'error'); return; }
  if (mins <= 0) { toast('Set a time limit (hours or minutes)', 'error'); return; }

  const now = Date.now();
  state.tasks.unshift({
    id: uid(), name, icon: selectedIcon, status: 'active',
    createdAt: now, deadline: now + mins * 60000, durationMs: mins * 60000, penalty
  });
  saveState();
  closeAddTask();
  renderHome();
  toast(`Timer started for "${name}" ⏱️`, 'success');
}

/* ---------- charities ---------- */
function renderCharities() {
  $('#charities-list').innerHTML = state.charities.map(c => `
    <article class="charity-card ${c.id === state.selectedCharityId ? 'selected' : ''}">
      <div class="charity-avatar">${c.emoji}</div>
      <h3>${esc(c.name)}</h3>
      <p class="sub">${esc(c.desc)}</p>
      <div class="charity-foot">
        <span class="raised">Raised ${fmtMoney(c.raised)}</span>
        ${c.id === state.selectedCharityId
          ? '<span class="badge-selected">✓ Selected</span>'
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
  renderSettings();
  renderHome();
  toast(`${fmtMoney(a)} added to your account 💰`, 'success');
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
  icon.textContent = pass ? '✅' : '❌';
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
    $('#btn-toggle-pass').textContent = show ? '🙈' : '👁';
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

  // how-it-works banner
  $('#hiw-dismiss').addEventListener('click', () => {
    localStorage.setItem(LS_HIW, '1');
    $('#how-it-works').classList.add('hidden');
  });

  // add task
  $('#fab-add').addEventListener('click', openAddTask);
  $('#btn-add-task-desktop').addEventListener('click', openAddTask);
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
    completeTask(t, { image: pf.image, ai: pf.result });
    closeProofFlow();
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
    if (!$('#overlay-proof').classList.contains('hidden')) closeProofFlow();
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







