/* Commit — onboarding: a short setup, one question per screen, that ends on suggested activities.
   Not a chat. Reuses the guide's questions and suggestion rules (GUIDE) and the task help (ASSIST).
   Loaded after app.js and guide.js; uses their globals ($, esc, fmtMoney, state, uid, toast, saveState, renderAll, showView). */
'use strict';

const ONBOARDING = (function () {
  const E = MOCK.EMOJIS;
  const MAX_AREAS = 3;

  /* ---------- the screens ---------- */
  // Tiles reuse the guide's option data, with a little extra copy for the tile layout.
  const AREA_TILES = [
    { id: 'fitness',  icon: E[0]},
    { id: 'study',    icon: E[4]},
    { id: 'work',     icon: E[2]},
    { id: 'home',     icon: E[3]},
    { id: 'health',   icon: E[7]},
    { id: 'creative', icon: E[8]},
    { id: 'unsure',   icon: '🎲'}
  ];
  const WHEN_ICON = { morning: '🌅', afternoon: '☀️', evening: '🌙', varies: '🔀' };

  const STEPS = [
    { id: 'welcome' },
    { id: 'area', multi: true, title: 'What do you want to work on?' },
    { id: 'blocker', multi: true, title: 'What gets in the way?' },
    { id: 'when', multi: true, title: 'When are you free?' },
    { id: 'stake', title: 'How much will you stake?' },
    { id: 'results' }
  ];

  /* ---------- state ---------- */
  let step = 0;
  let dir = 1;                         // 1 forward, -1 back, for the slide direction
  let sel = {};                        // answers: areas[], blockers[], whens[], stake
  let picks = [];                      // suggested activities on the last screen
  let chosen = new Set();              // indexes of the ones ticked
  let renderToken = 0;
  let fresh = false;                   // true right after registration

  const el = id => document.getElementById(id);
  const optionsFor = id => ({ area: GUIDE.AREA.options, blocker: GUIDE.BLOCKER.options, when: GUIDE.WHEN.options, stake: GUIDE.STAKE.options }[id]);
  // The three multiple-choice questions keep a list of answers. One option on each is exclusive.
  const MULTI = { area: { key: 'areas', exclusive: 'unsure' }, blocker: { key: 'blockers', exclusive: null }, when: { key: 'whens', exclusive: 'varies' } };
  // What the venue ranking needs: one time of day and one main blocker, drawn from the lists.
  const prefs = () => ({
    when: sel.whens.length === 1 ? sel.whens[0] : 'varies',
    blocker: sel.blockers.includes('busy') ? 'busy' : sel.blockers.includes('energy') ? 'energy' : sel.blockers[0]
  });

  /* ---------- picking activities ---------- */
  function activities() {
    const areas = sel.areas.includes('unsure') ? ['fitness', 'home', 'study'] : sel.areas;
    const base = { blockers: sel.blockers, whens: sel.whens, stake: sel.stake };
    const lists = areas.map(id => GUIDE.suggest({ ...base, area: { id } }, 3));
    const out = [];
    for (let i = 0; i < 3; i++) {                          // take one from each area in turn
      for (const l of lists) if (l[i] && !out.some(o => o.name === l[i].name)) out.push(l[i]);
    }
    return out.slice(0, 4);
  }

  const lenText = r => `${r.h ? r.h + 'h' : ''}${r.m ? (r.h ? ' ' : '') + r.m + 'm' : ''}`;
  const totalStake = () => [...chosen].reduce((sum, i) => sum + picks[i].stake, 0);

  /* ---------- rendering ---------- */
  function tileHTML(t, selected, multi) {
    return `<button type="button" class="tile${selected ? ' on' : ''}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${selected}" data-v="${esc(String(t.value))}">
      ${t.icon ? `<span class="tile-ico" aria-hidden="true">${t.icon}</span>` : ''}
      <b>${esc(t.label)}</b>${t.hint ? `<small>${esc(t.hint)}</small>` : ''}
      <i class="tile-check" aria-hidden="true"></i>
    </button>`;
  }

  function questionHTML(s, n) {
    let tiles;
    if (s.id === 'area') {
      tiles = AREA_TILES.map(t => tileHTML({ value: t.id, icon: t.icon, label: GUIDE.AREA.options.find(o => o.id === t.id).label }, sel.areas.includes(t.id), true)).join('');
    } else if (s.id === 'stake') {
      tiles = GUIDE.STAKE.options.map(o => tileHTML({ value: o.id, label: o.label }, sel.stake && sel.stake.id === o.id && !sel.customStake, false)).join('');
    } else {
      tiles = optionsFor(s.id).map(o => tileHTML({ value: o.id, label: o.label, icon: s.id === 'when' ? WHEN_ICON[o.id] : '' }, sel[MULTI[s.id].key].includes(o.id), true)).join('');
    }
    const custom = s.id === 'stake'
      ? `<label class="onb-custom"><span>Other amount</span><div><b>$</b><input id="onb-custom-stake" type="number" min="1" max="100" inputmode="numeric" value="${sel.customStake || ''}"/></div></label>`
      : '';
    return `<p class="onb-count">${n} of 4${s.multi ? ', pick any' : ''}</p>
      <h1 id="onb-title">${esc(s.title)}</h1>
      ${s.id === 'stake' ? '<p class="sub onb-note">Your stake is the money you put on the line for each task. Finish it on time and you keep it. Miss the deadline and it goes to your chosen charity.</p>' : ''}
      <div class="tiles${s.multi ? ' multi' : ''}" role="${s.multi ? 'group' : 'radiogroup'}" aria-labelledby="onb-title">${tiles}</div>${custom}`;
  }

  function welcomeHTML() {
    return `<div class="onb-welcome"><span class="gyro-wrap lg" aria-hidden="true"><span class="gyro"><i></i><i></i><i></i><b></b></span></span>
      ${fresh ? `<p class="onb-done-pill"><svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Account created</p>` : ''}
      <h1 id="onb-title">${fresh && currentUser ? `Welcome, ${esc(currentUser.name.split(' ')[0])}` : 'Find your tasks'}</h1>
      <p class="sub">Four quick questions.</p></div>`;
  }

  async function resultsHTML(token) {
    picks = activities();
    const pf = prefs();
    await Promise.all(picks.map(async r => {
      const mins = r.h * 60 + r.m;
      [r.help, r.where] = await Promise.all([ASSIST.load(r, mins, pf), ASSIST.whereFor(r, mins, pf)]);
    }));
    if (token !== renderToken) return null;
    if (!chosen.size) picks.slice(0, 2).forEach((_, i) => chosen.add(i));      // start with the first two ticked
    const cards = picks.map((r, i) => `
      <article class="reco pick${chosen.has(i) ? ' on' : ''}" style="--i:${i}">
        <button type="button" class="pick-main" role="checkbox" aria-checked="${chosen.has(i)}" data-pick="${i}">
          <span class="reco-icon" aria-hidden="true">${r.icon}</span>
          <span class="pick-text"><b>${esc(r.name)}</b></span>
          <span class="reco-meta-inline"><b>${lenText(r)}</b><small>${fmtMoney(r.stake)}</small></span>
          <i class="tile-check" aria-hidden="true"></i>
        </button>
        ${ASSIST.whereHTML(r.where, true)}${r.help ? `<button type="button" class="link-btn" data-pick-help="${i}">Details</button>` : ''}
      </article>`).join('');
    return `<h1 id="onb-title">Picked for you</h1>
      <div class="picks">${cards}</div>`;
  }

  async function render() {
    const token = ++renderToken;
    const s = STEPS[step];
    const stage = el('onb-stage');
    const body = s.id === 'welcome' ? welcomeHTML() : s.id === 'results' ? await resultsHTML(token) : questionHTML(s, step);
    if (body === null || token !== renderToken) return;
    stage.innerHTML = `<div class="onb-step ${dir < 0 ? 'back' : ''}">${body}</div>`;
    stage.scrollTop = 0;

    // top bar: segmented progress, back button
    const total = STEPS.length - 1;
    el('onb-dots').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < step ? 'done' : i === step ? 'now' : ''}"></i>`).join('');
    el('onb-back').classList.toggle('invisible', step === 0);
    el('onb-skip').classList.toggle('hidden', step === STEPS.length - 1);
    refreshFooter();
  }

  function answered() {
    const s = STEPS[step];
    if (s.id === 'welcome') return true;
    if (s.id === 'results') return chosen.size > 0 && totalStake() <= state.balance;
    if (MULTI[s.id]) return sel[MULTI[s.id].key].length > 0;
    return !!sel[s.id];
  }

  function refreshFooter() {
    const s = STEPS[step];
    const next = el('onb-next');
    const note = el('onb-note');
    note.textContent = '';
    note.classList.remove('bad');
    if (s.id === 'welcome') next.textContent = 'Get started';
    else if (s.id === 'stake') next.textContent = 'See suggestions';
    else if (s.id === 'results') {
      next.textContent = chosen.size ? `Start ${chosen.size} task${chosen.size > 1 ? 's' : ''}` : 'Choose one';
      if (chosen.size && totalStake() > state.balance) {
        note.textContent = `${fmtMoney(totalStake())} is more than your balance (${fmtMoney(state.balance)})`;
        note.classList.add('bad');
      } else if (chosen.size) note.textContent = `${fmtMoney(totalStake())} at stake`;
    } else next.textContent = 'Continue';
    next.disabled = !answered();
  }

  /* ---------- interaction ---------- */
  function choose(value) {
    const s = STEPS[step];
    const paint = on => $$('#onb-stage .tile').forEach(t => { const v = on(t.dataset.v); t.classList.toggle('on', v); t.setAttribute('aria-checked', v); });
    if (MULTI[s.id]) {
      const { key, exclusive } = MULTI[s.id];
      const has = sel[key].includes(value);
      if (exclusive && value === exclusive) sel[key] = has ? [] : [exclusive];
      else {
        let next = sel[key].filter(v => v !== exclusive);              // picking something specific drops the "none of these" option
        if (has) next = next.filter(v => v !== value);
        else if (s.id === 'area' && next.length >= MAX_AREAS) { toast(`Up to ${MAX_AREAS}`, 'info'); return; }
        else next.push(value);
        sel[key] = next;
      }
      paint(v => sel[key].includes(v));
    } else {                                                           // stake: one answer
      sel.stake = GUIDE.STAKE.options.find(o => String(o.id) === value);
      sel.customStake = '';
      el('onb-custom-stake').value = '';
      paint(v => v === value);
    }
    refreshFooter();
  }

  function togglePick(i) {
    chosen.has(i) ? chosen.delete(i) : chosen.add(i);
    const card = document.querySelector(`[data-pick="${i}"]`);
    card.setAttribute('aria-checked', chosen.has(i));
    card.closest('.pick').classList.toggle('on', chosen.has(i));
    refreshFooter();
  }

  function go(delta) {
    dir = delta;
    step = Math.max(0, Math.min(STEPS.length - 1, step + delta));
    render();
  }

  function startChosen() {
    const now = Date.now();
    const list = [...chosen].sort().map(i => picks[i]);
    list.forEach(r => {
      const ms = (r.h * 60 + r.m) * 60000;
      state.tasks.unshift({ id: uid(), name: r.name, icon: r.icon, status: 'active', createdAt: now, deadline: now + ms, durationMs: ms, penalty: r.stake });
    });
    state.defaultPenalty = sel.stake ? sel.stake.id : state.defaultPenalty;      // remember their comfortable stake
    state.profile = { areas: sel.areas, blockers: sel.blockers, whens: sel.whens, blocker: prefs().blocker, when: prefs().when, stake: sel.stake && sel.stake.id };
    saveState();
    finish();
    renderAll();
    showView('home');
    toast(`Started ${list.length}`, 'success');
  }

  function finish() {
    localStorage.setItem(keyFor(LS_ONBOARDED), '1');
    el('overlay-onb').classList.add('hidden');
    document.body.classList.remove('no-scroll');
  }

  function open(opts) {
    fresh = !!(opts && opts.registered);
    step = 0; dir = 1; sel = { areas: [], blockers: [], whens: [] }; picks = []; chosen = new Set();
    el('overlay-onb').classList.remove('hidden');
    document.body.classList.add('no-scroll');
    render();
    setTimeout(() => el('overlay-onb').querySelector('.onb-panel').focus(), 40);
  }

  function bind() {
    el('onb-next').addEventListener('click', () => {
      if (!answered()) return;
      STEPS[step].id === 'results' ? startChosen() : go(1);
    });
    el('onb-back').addEventListener('click', () => go(-1));
    el('onb-skip').addEventListener('click', finish);

    el('onb-stage').addEventListener('click', e => {
      const t = e.target.closest('.tile');
      if (t) return choose(t.dataset.v);
      const p = e.target.closest('[data-pick]');
      if (p) return togglePick(+p.dataset.pick);
      const h = e.target.closest('[data-pick-help]');
      if (h) { const r = picks[+h.dataset.pickHelp]; openHelp({ name: r.name }, r.h * 60 + r.m, prefs()); }
    });

    // a typed stake overrides the tiles
    el('onb-stage').addEventListener('input', e => {
      if (e.target.id !== 'onb-custom-stake') return;
      const n = Math.round(+e.target.value);
      sel.customStake = e.target.value;
      sel.stake = n >= 1 && n <= 100 ? { id: n, label: '$' + n } : null;
      $$('#onb-stage .tile').forEach(t => { t.classList.remove('on'); t.setAttribute('aria-checked', 'false'); });
      refreshFooter();
    });
    el('onb-stage').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.id === 'onb-custom-stake') { e.preventDefault(); if (answered()) go(1); }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !el('overlay-onb').classList.contains('hidden') && el('overlay-help').classList.contains('hidden')) finish();
    });
    const redo = el('btn-redo-onboarding');
    if (redo) redo.addEventListener('click', open);
  }

  document.addEventListener('DOMContentLoaded', bind);
  return { open, finish };
})();
