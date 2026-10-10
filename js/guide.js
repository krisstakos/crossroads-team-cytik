/* Commit — task guide: a scripted conversation that suggests tasks. No backend; every rule lives here.
   Loaded after app.js and uses its globals ($, esc, sleep, fmtMoney, state, openAddTask, reduceMotion). */
'use strict';

const GUIDE = (function () {
  // Icons must be the exact strings the mock AI knows, so take them from the shared list.
  const E = MOCK.EMOJIS;
  const IC = { gym: E[0], cook: E[1], code: E[2], tidy: E[3], book: E[4], run: E[5], yoga: E[6], pill: E[7], art: E[8], plant: E[9] };

  /* ---------- the questions ---------- */
  const AREA = {
    id: 'area', title: 'Goal',
    q: 'What do you want to work on?',
    options: [
      { id: 'fitness',  label: 'Get fitter',           keys: ['fit', 'gym', 'run', 'workout', 'exercise', 'sport', 'walk', 'weight', 'strength', 'active'] },
      { id: 'study',    label: 'Study or learn',       keys: ['study', 'learn', 'exam', 'read', 'school', 'course', 'language', 'class', 'book'] },
      { id: 'work',     label: 'Get work done',        keys: ['work', 'code', 'project', 'job', 'email', 'career', 'business', 'app', 'ship', 'focus'] },
      { id: 'home',     label: 'Sort out my home',     keys: ['home', 'clean', 'tidy', 'house', 'cook', 'laundry', 'meal', 'room', 'chore'] },
      { id: 'health',   label: 'Look after my health', keys: ['health', 'sleep', 'vitamin', 'water', 'stress', 'meds', 'medic', 'eat', 'diet', 'rest'] },
      { id: 'creative', label: 'Be more creative',     keys: ['art', 'draw', 'write', 'music', 'paint', 'creative', 'design', 'sketch', 'guitar', 'piano'] },
      { id: 'unsure',   label: "I don't know",         keys: ['not sure', 'dont know', "don't know", 'unsure', 'no idea', 'idk', 'anything', 'whatever'] }
    ]
  };

  // Shown when someone says they are unsure about the goal: pick the sentence closest to their week.
  const UNSURE = {
    id: 'unsure', q: 'Which sounds most like your last week?',
    options: [
      { label: 'I sat down far too much',     area: 'fitness',  keys: ['sat', 'sit', 'sofa', 'desk'] },
      { label: 'I kept putting things off',   area: 'work',     keys: ['putting', 'off', 'delay', 'procrast'] },
      { label: 'My place got messy',          area: 'home',     keys: ['mess', 'dirty', 'untidy', 'place'] },
      { label: 'I wanted to learn something', area: 'study',    keys: ['learn', 'wanted'] },
      { label: 'I felt run down',             area: 'health',   keys: ['run down', 'tired', 'drained', 'ill'] },
      { label: 'I missed making things',      area: 'creative', keys: ['making', 'missed', 'create'] }
    ]
  };

  const BLOCKER = {
    id: 'blocker', title: 'Gets in the way',
    q: 'What gets in the way?',
    options: [
      { id: 'procrastinate', label: 'I put things off',      keys: ['procrast', 'put off', 'putting off', 'delay', 'later', 'start'], fit: 'Short and concrete, so it is hard to put off.' },
      { id: 'energy',        label: 'I run out of energy',   keys: ['tired', 'energy', 'exhaust', 'drained', 'lazy', 'sleepy'], fit: 'Low effort to begin, and it tends to give energy back.' },
      { id: 'busy',          label: 'I am too busy',         keys: ['busy', 'no time', 'schedule', 'packed', 'swamped'], fit: 'Small enough to slot into a gap in your day.' },
      { id: 'forget',        label: 'I forget',              keys: ['forget', 'remember', 'slip'], fit: 'The countdown on screen is your reminder.' },
      { id: 'motivation',    label: 'I lose motivation',     keys: ['motivat', 'bored', 'give up', 'quit', 'stick', 'lose interest'], fit: 'Real money on the line makes skipping cost something.' }
    ],
    // preferred difficulty (1 easy, 3 hard) and a hard cap on task length in minutes
    target: { procrastinate: 1.5, energy: 1, busy: 1, forget: 2, motivation: 2.6 }
  };

  const WHEN = {
    id: 'when', title: 'Free time',
    q: 'When are you free?',
    options: [
      { id: 'morning',   label: 'Mornings',   keys: ['morning', 'am', 'early', 'dawn'] },
      { id: 'afternoon', label: 'Afternoons', keys: ['afternoon', 'lunch', 'midday', 'noon'] },
      { id: 'evening',   label: 'Evenings',   keys: ['evening', 'night', 'after work', 'late', 'pm'] },
      { id: 'varies',    label: 'It varies',  keys: ['vary', 'varies', 'different', 'depends', 'random', 'any'] }
    ]
  };

  const TIME = {
    id: 'time', title: 'Time per task',
    q: 'How long per task?',
    options: [
      { id: 'short', label: '15 to 30 minutes', cap: 30,  keys: ['15', '20', '30', 'short', 'quick', 'half', 'little'] },
      { id: 'hour',  label: 'About an hour',    cap: 60,  keys: ['hour', '45', '60', 'medium'] },
      { id: 'long',  label: 'Two hours or more', cap: 120, keys: ['two', '2 h', 'long', 'lot', 'more', '120', 'plenty'] }
    ]
  };

  const STAKE = {
    id: 'stake', title: 'Stake',
    q: 'How much will you stake per task?',
    options: [10, 15, 20, 50].map(n => ({ id: n, label: '$' + n, keys: [String(n)] })),
    // typed amounts: any whole number from the minimum stake to 100
    parse(text) {
      const m = /(\d{1,3})/.exec(text);
      const n = m ? +m[1] : 0;
      return n >= MIN_STAKE && n <= 100 ? { id: n, label: '$' + n, keys: [] } : null;
    }
  };

  const STEPS = [AREA, BLOCKER, WHEN, TIME, STAKE];

  /* ---------- the task catalogue, by area ---------- */
  // mins: natural length. diff: 1 easy to 3 hard. when: times of day it suits best.
  const T = (name, icon, mins, diff, when, pitch) => ({ name, icon, mins, diff, when, pitch });
  const CATALOGUE = {
    fitness: [
      T('Gym visit',          IC.gym,  120, 3, ['morning', 'evening'],             'A photo of the gym floor is easy proof.'),
      T('Run or jog',         IC.run,  45,  2, ['morning', 'evening'],             'Shoes on, door shut, done.'),
      T('Brisk walk',         IC.run,  30,  1, ['morning', 'afternoon', 'evening'], 'The gentlest way to start moving.'),
      T('Yoga or stretch',    IC.yoga, 30,  1, ['morning', 'evening'],             'A mat on the floor counts.')
    ],
    study: [
      T('Read 20 pages',      IC.book, 30,  1, ['morning', 'evening'],             'A book and a lamp make good proof.'),
      T('Study session',      IC.book, 60,  2, ['afternoon', 'evening'],           'One subject, one sitting.'),
      T('Language practice',  IC.book, 30,  1, ['morning', 'afternoon', 'evening'], 'Short daily practice beats long weekly sessions.'),
      T('Exam revision',      IC.book, 120, 3, ['afternoon', 'evening'],           'A big block with a hard stop.')
    ],
    work: [
      T('Plan tomorrow',      IC.code, 15,  1, ['evening'],                        'Fifteen minutes that make tomorrow easier.'),
      T('Inbox and admin sweep', IC.code, 30, 1, ['morning', 'afternoon'],         'Clear the small things that nag at you.'),
      T('Ship one small thing', IC.code, 60, 2, ['morning', 'afternoon'],          'One finished thing beats five half-started ones.'),
      T('Deep work block',    IC.code, 120, 3, ['morning', 'afternoon'],           'Two focused hours on a single piece of work.')
    ],
    home: [
      T('Tidy the room',      IC.tidy, 30,  1, ['afternoon', 'evening'],           'A before-and-after is satisfying to show.'),
      T('Cook dinner',        IC.cook, 60,  2, ['evening'],                        'Skip the takeout, keep the stake.'),
      T('Laundry and reset',  IC.tidy, 60,  2, ['morning', 'afternoon'],           'Start the load, then finish the job.'),
      T('Meal prep',          IC.cook, 120, 3, ['afternoon'],                      'Future you eats well all week.')
    ],
    health: [
      T('Take your vitamins', IC.pill, 15,  1, ['morning'],                        'A tiny habit that anchors a routine.'),
      T('Fresh air break',    IC.plant, 15, 1, ['morning', 'afternoon'],           'Step outside; a park or a plant is enough proof.'),
      T('Wind-down routine',  IC.yoga, 30,  1, ['evening'],                        'Screens off, a calm half hour before bed.'),
      T('Cook a healthy meal', IC.cook, 60, 2, ['evening', 'afternoon'],           'Real food, made by you.')
    ],
    creative: [
      T('Sketch for 30 minutes', IC.art, 30, 1, ['evening', 'afternoon'],          'A page of sketches is proof enough.'),
      T('Practice an instrument', IC.art, 30, 1, ['evening', 'morning'],           'Little and often builds skill.'),
      T('Write 500 words',    IC.art,  45,  2, ['morning', 'evening'],             'Words on a page, however rough.'),
      T('Make art',           IC.art,  60,  2, ['afternoon', 'evening'],           'An hour at the easel or the desk.')
    ]
  };

  /* ---------- picking three tasks ---------- */
  // `a` holds single answers (the chat: blocker, when, time) or lists (onboarding: blockers, whens).
  // With no time answer, every task keeps its natural length.
  function suggest(a, count = 3) {
    const blockers = a.blockers || (a.blocker ? [a.blocker.id] : []);
    const whens = a.whens || (a.when ? [a.when.id] : []);
    const baseCap = a.time ? a.time.cap : Infinity;
    const cap = Math.min(baseCap, blockers.includes('busy') ? 30 : Infinity);
    const targets = blockers.map(id => BLOCKER.target[id]);
    const target = targets.length ? targets.reduce((x, y) => x + y, 0) / targets.length : 2;      // several blockers: aim for the middle
    const anyTime = !whens.length || whens.includes('varies');
    const roundTo = m => (m <= 15 ? 15 : m <= 30 ? 30 : m <= 45 ? 45 : m <= 60 ? 60 : m <= 90 ? 90 : 120);
    const stake = Math.max(MIN_STAKE, a.stake.id);
    const fitOpt = BLOCKER.options.find(o => o.id === blockers[0]);
    const pool = (CATALOGUE[a.area.id] || []).filter(t => t.mins <= cap * 2);
    return pool
      .map((t, i) => ({ t, i, score: -Math.abs(t.diff - target) + (anyTime || whens.some(w => t.when.includes(w)) ? 0.6 : 0) }))
      .sort((x, y) => y.score - x.score || x.i - y.i)
      .slice(0, count)
      .map(({ t }) => {
        const mins = roundTo(Math.min(t.mins, cap));
        return { name: t.name, icon: t.icon, h: Math.floor(mins / 60), m: mins % 60, stake, pitch: t.pitch, fit: fitOpt && fitOpt.fit };
      });
  }

  /* ---------- conversation engine ---------- */
  let run = 0;            // bumps on restart or close, so a stale async step stops quietly
  let busy = false;       // true while the guide is "typing"
  let current = null;     // the step currently waiting for an answer
  let answers = {};
  let results = [];

  const el = id => document.getElementById(id);
  const log = () => el('guide-log');

  const scrollDown = () => log().scrollTo({ top: log().scrollHeight, behavior: reduceMotion() ? 'auto' : 'smooth' });

  function addMsg(who, html) {
    const row = document.createElement('div');
    row.className = 'msg ' + who;
    row.innerHTML = (who === 'bot' ? '<span class="orb sm" aria-hidden="true"></span>' : '') + `<div class="bubble">${html}</div>`;
    log().appendChild(row);
    scrollDown();
    return row;
  }

  // The guide "types" for a moment, then the message replaces the dots.
  async function say(html, token) {
    const row = addMsg('bot', '<span class="typing" aria-label="Guide is typing"><i></i><i></i><i></i></span>');
    if (!reduceMotion()) await sleep(Math.min(950, 380 + html.length * 9));
    if (token !== run) return false;
    row.querySelector('.bubble').innerHTML = html;
    scrollDown();
    return true;
  }

  function setChips(items) {
    const box = el('guide-chips');
    box.innerHTML = items.map((o, i) => `<button type="button" class="chip" style="--i:${i}" data-gi="${i}"${o.end ? ` data-end="${o.end}"` : ''}>${esc(o.label)}</button>`).join('');
  }

  function setProgress(ix) {
    const total = STEPS.length;
    el('guide-bar-fill').style.width = Math.round((ix / total) * 100) + '%';
    el('guide-progress').textContent = ix >= total ? 'Done' : `${ix + 1} of ${total}`;
  }

  function enableInput(on) {
    el('guide-text').disabled = !on;
    el('guide-send').disabled = !on;
    $$('#guide-chips .chip').forEach(c => { c.disabled = !on; });
  }

  async function ask(step, token) {
    current = null;
    setChips([]);
    enableInput(false);
    if (!(await say(esc(step.q), token))) return;
    current = step;
    setChips(step.options);
    enableInput(true);
  }

  function matchOption(step, text) {
    const t = text.trim().toLowerCase();
    if (!t) return null;
    if (step.parse) { const p = step.parse(t); if (p) return p; }
    return step.options.find(o => o.keys.some(k => t.includes(k)) || o.label.toLowerCase() === t) || null;
  }

  async function answer(step, opt, shown) {
    if (busy || current !== step) return;
    busy = true;
    const token = run;
    current = null;
    setChips([]);
    enableInput(false);
    addMsg('user', esc(shown || opt.label));

    try {
      // "I don't know": narrow it down with a question about their week, then carry on with the area it maps to
      if (step.id === 'area' && opt.id === 'unsure') {
        busy = false;
        return ask(UNSURE, token);
      }
      if (step === UNSURE) {
        const area = AREA.options.find(o => o.id === opt.area);
        answers.area = area;
        return next(1, token);
      }

      answers[step.id] = opt;
      return next(STEPS.indexOf(step) + 1, token);
    } finally {
      if (token === run) busy = false;
    }
  }

  async function next(ix, token) {
    setProgress(ix);
    if (ix < STEPS.length) { busy = false; return ask(STEPS[ix], token); }
    return finish(token);
  }

  async function finish(token) {
    const a = answers;
    results = suggest(a);
    // practical help (nearest place, price, plan) for each suggestion, when we have it
    const prefs = { when: a.when.id, blocker: a.blocker.id };
    await Promise.all(results.map(async r => {
      const mins = r.h * 60 + r.m;
      [r.help, r.where] = await Promise.all([ASSIST.load(r, mins, prefs), ASSIST.whereFor(r, mins, prefs)]);
    }));
    if (token !== run) return;
    if (!(await say('Three tasks for you.', token))) return;

    const wrap = document.createElement('div');
    wrap.className = 'guide-sugg';
    wrap.innerHTML = results.map((r, i) => {
      const len = `${r.h ? r.h + 'h' : ''}${r.m ? (r.h ? ' ' : '') + r.m + 'm' : ''}`;
      return `<article class="reco" style="--i:${i}">
        <div class="reco-top"><div class="reco-icon" aria-hidden="true">${r.icon}</div>
          <div><h3>${esc(r.name)}</h3></div></div>
        <div class="reco-meta"><div><b>${len}</b></div><div><b>${fmtMoney(r.stake)}</b></div></div>
        ${ASSIST.whereHTML(r.where, true)}
        <div class="card-actions"><button class="btn primary sm" data-guide-start="${i}">Start</button>${r.help ? `<button class="btn ghost sm" data-guide-help="${i}">Details</button>` : ''}</div>
      </article>`;
    }).join('');
    log().appendChild(wrap);
    scrollDown();

    setProgress(STEPS.length);
    current = null;
    setChips([{ label: 'Start over', end: 'restart' }, { label: 'Close', end: 'close' }]);
    el('guide-text').disabled = true; el('guide-send').disabled = true;
    $$('#guide-chips .chip').forEach(c => { c.disabled = false; });
    busy = false;
  }

  /* ---------- open, close, restart ---------- */
  async function begin() {
    run++;
    const token = run;
    busy = false; current = null; answers = {}; results = [];
    log().innerHTML = '';
    setChips([]);
    setProgress(0);
    enableInput(false);
    if (!(await say("Hi! A few quick questions, then I'll suggest tasks.", token))) return;
    ask(STEPS[0], token);
  }

  function open() {
    el('overlay-guide').classList.remove('hidden');
    document.body.classList.add('no-scroll');
    begin();
    setTimeout(() => el('overlay-guide').querySelector('.guide-panel').focus(), 40);
  }

  function close() {
    run++;
    el('overlay-guide').classList.add('hidden');
    document.body.classList.remove('no-scroll');
  }

  function bind() {
    el('btn-open-guide').addEventListener('click', open);
    el('btn-guide-close').addEventListener('click', close);
    el('btn-guide-restart').addEventListener('click', begin);
    el('overlay-guide').addEventListener('click', e => { if (e.target.id === 'overlay-guide') close(); });

    el('guide-chips').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      if (b.dataset.end) return b.dataset.end === 'restart' ? begin() : close();   // end-of-chat buttons
      if (current) answer(current, current.options[+b.dataset.gi]);
    });

    el('guide-form').addEventListener('submit', async e => {
      e.preventDefault();
      const input = el('guide-text');
      const text = input.value.trim();
      if (!text || busy || !current) return;
      input.value = '';
      const step = current;
      const opt = matchOption(step, text);
      if (opt) return answer(step, opt, text);
      // no match: say so and keep the same question open
      busy = true;
      const token = run;
      addMsg('user', esc(text));
      await say(step.id === 'stake' ? `Enter a number from ${MIN_STAKE} to 100.` : 'Not sure what you mean. Pick an option.', token);
      if (token === run) busy = false;
    });

    log().addEventListener('click', e => {
      const h = e.target.closest('[data-guide-help]');
      if (h) { const r = results[+h.dataset.guideHelp]; if (r) openHelp({ name: r.name }, r.h * 60 + r.m, { when: answers.when && answers.when.id, blocker: answers.blocker && answers.blocker.id }); return; }
      const b = e.target.closest('[data-guide-start]');
      if (!b) return;
      const r = results[+b.dataset.guideStart];
      if (!r) return;
      close();
      openAddTask({ name: r.name, icon: r.icon, h: r.h, m: r.m, stake: r.stake });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !el('overlay-guide').classList.contains('hidden')) close();
    });
  }

  document.addEventListener('DOMContentLoaded', bind);
  return { open, close, suggest, matchOption, STEPS, AREA, BLOCKER, WHEN, TIME, STAKE, UNSURE };
})();
