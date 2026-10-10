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

  // Asked in the chat instead of the setup questions: the profile already answers those.
  const ENERGY = {
    id: 'energy', title: 'Energy',
    q: 'How is your energy right now?',
    options: [
      { id: 'high', label: 'Good',  keys: ['good', 'great', 'energ', 'high', 'fine'] },
      { id: 'ok',   label: 'Okay',  keys: ['ok', 'okay', 'normal', 'average', 'meh'] },
      { id: 'low',  label: 'Low',   keys: ['low', 'tired', 'drained', 'exhaust', 'sleepy'] }
    ]
  };
  const AREA_OTHER = { id: 'other', label: 'Something else', keys: ['else', 'other', 'different', 'new'] };

  const STEPS = [AREA, BLOCKER, WHEN, TIME, STAKE];     // the full set; the chat asks only what it does not know yet

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
    const cap = Math.min(baseCap, blockers.includes('busy') ? 30 : Infinity, a.energy && a.energy.id === 'low' ? 45 : Infinity);
    const targets = blockers.map(id => BLOCKER.target[id]);
    const base = targets.length ? targets.reduce((x, y) => x + y, 0) / targets.length : 2;      // several blockers: aim for the middle
    const shift = { high: 0.7, ok: 0, low: -0.7 }[a.energy && a.energy.id] || 0;                // good energy can take a harder task
    const target = base + shift;
    const anyTime = !whens.length || whens.includes('varies');
    const roundTo = m => (m <= 15 ? 15 : m <= 30 ? 30 : m <= 45 ? 45 : m <= 60 ? 60 : m <= 90 ? 90 : 120);
    const stake = Math.max(MIN_STAKE, a.stake.id);
    const fitOpt = BLOCKER.options.find(o => o.id === blockers[0]);
    const skip = new Set((a.exclude || []).map(n => n.toLowerCase()));                           // already running, so do not suggest it again
    const pool = (CATALOGUE[a.area.id] || []).filter(t => t.mins <= cap * 2 && !skip.has(t.name.toLowerCase()));
    return pool
      .map((t, i) => ({ t, i, score: -Math.abs(t.diff - target) + (anyTime || whens.some(w => t.when.includes(w)) ? 0.6 : 0) }))
      .sort((x, y) => y.score - x.score || x.i - y.i)
      .slice(0, count)
      .map(({ t }) => {
        const mins = roundTo(Math.min(t.mins, cap));
        return { name: t.name, icon: t.icon, h: Math.floor(mins / 60), m: mins % 60, stake, pitch: t.pitch, fit: fitOpt && fitOpt.fit };
      });
  }

  /* ---------- the chat's own flow: finding your NEXT goal ---------- */
  // Different from onboarding (area, blocker, when, stake): this asks about right now and about what you already do.
  const MOOD = {
    id: 'mood', title: 'Mood',
    q: 'How are you feeling right now?',
    options: [
      { id: 'charged', label: 'Full of energy',    e: 3,   blocker: 'motivation',    keys: ['energy', 'energet', 'great', 'pumped', 'good', 'charged'],   reply: 'Great, let us put that energy to use.' },
      { id: 'focused', label: 'Calm and focused',  e: 2,   blocker: 'forget',        keys: ['calm', 'focus', 'fine', 'ok', 'okay', 'steady'],             reply: 'Nice. A steady mood suits a proper block of effort.' },
      { id: 'stuck',   label: 'A bit stuck',       e: 1.5, blocker: 'procrastinate', keys: ['stuck', 'meh', 'unmotivated', 'bored', 'lost', 'procrast'],  reply: 'Happy to help. Small starting points work best when you feel stuck.' },
      { id: 'drained', label: 'Wiped out',         e: 1,   blocker: 'energy',        keys: ['tired', 'wiped', 'drained', 'exhaust', 'sleepy', 'low'],     reply: 'Understood. Nothing heavy, just something gentle that counts.' }
    ]
  };

  const SPOT = {
    id: 'spot', title: 'Where',
    q: 'Where are you right now?',
    options: [
      { id: 'home', label: 'At home',          keys: ['home', 'house', 'flat', 'apartment', 'inside', 'indoor'] },
      { id: 'out',  label: 'Out and about',    keys: ['out', 'outside', 'park', 'street', 'gym', 'travel', 'outdoor'] },
      { id: 'work', label: 'At work or school', keys: ['work', 'office', 'school', 'campus', 'uni', 'desk', 'library'] }
    ]
  };

  const SPARE = {
    id: 'spare', title: 'Time',
    q: 'How much time can you spare?',
    options: [
      { id: 'q15',  label: 'Up to 15 minutes', cap: 15,  keys: ['15', '10', 'few minutes', 'quick', 'little'] },
      { id: 'q30',  label: 'About 30 minutes', cap: 30,  keys: ['30', 'half', '20'] },
      { id: 'q60',  label: 'An hour',          cap: 60,  keys: ['hour', '60', '45'] },
      { id: 'q120', label: 'A good while',     cap: 120, keys: ['long', 'while', 'two', '2 h', 'plenty', 'all'] }
    ]
  };

  const DIRECTION = {
    id: 'direction', title: 'Direction',
    q: 'Build on what you already do, or try something new?',
    options: [
      { id: 'familiar', label: 'More of what I do',  keys: ['more', 'same', 'familiar', 'keep', 'build', 'habit'] },
      { id: 'new',      label: 'Surprise me',        keys: ['new', 'surprise', 'different', 'try', 'change', 'fresh'] }
    ]
  };

  const FLOW = [MOOD, SPOT, SPARE, DIRECTION];

  // name, icon, mins, e (effort 1 gentle to 3 hard), places it suits, pitch
  const C = (name, icon, mins, e, places, pitch) => ({ name, icon, mins, e, places, pitch });
  const IDEAS = [
    C('Ten-minute desk reset',       IC.tidy,  15,  1, ['work', 'home'], 'A clear desk makes the next task easier.'),
    C('Declutter one drawer',        IC.tidy,  15,  1, ['home'],         'Small, finite, and very satisfying.'),
    C('Deep clean the kitchen',      IC.tidy,  60,  3, ['home'],         'A before and after worth showing.'),
    C('Bake something new',          IC.cook,  60,  2, ['home'],         'Follow a recipe you have never tried.'),
    C('Cook from scratch tonight',   IC.cook,  60,  2, ['home'],         'Real ingredients, no delivery app.'),
    C('Water and repot your plants', IC.plant, 30,  1, ['home'],         'Greener room, calmer head.'),
    C('Walk without your phone',     IC.run,   30,  1, ['out'],          'Thirty minutes of just walking.'),
    C('Try a new running route',     IC.run,   45,  2, ['out'],          'Same legs, new streets.'),
    C('Interval run',                IC.run,   30,  3, ['out'],          'Hard, short, and over quickly.'),
    C('Outdoor bodyweight circuit',  IC.gym,   30,  3, ['out'],          'No equipment, a park is enough.'),
    C('Strength session',            IC.gym,   60,  3, ['out'],          'A photo of the gym floor is easy proof.'),
    C('Photo walk',                  IC.art,   45,  1, ['out'],          'Look for five things worth photographing.'),
    C('Learn five new words',        IC.book,  15,  1, ['work', 'home'], 'In any language you are curious about.'),
    C('Read a chapter',              IC.book,  30,  1, ['home', 'work'], 'A book and a lamp make good proof.'),
    C('Finish the thing you avoid',  IC.code,  30,  2, ['work', 'home'], 'You know which one. Thirty minutes, no switching.'),
    C('Write a one-page plan',       IC.code,  30,  2, ['work', 'home'], 'Get the idea out of your head and onto a page.'),
    C('Two-hour focus sprint',       IC.code, 120,  3, ['work', 'home'], 'One piece of work, phone away.'),
    C('Sketch a quick idea',         IC.art,   15,  1, ['work', 'home', 'out'], 'A page of scribbles counts.'),
    C('Practice an instrument',      IC.art,   30,  2, ['home'],         'Little and often builds skill.'),
    C('Mobility flow',               IC.yoga,  15,  1, ['home', 'work'], 'Undo a day of sitting.'),
    C('Guided stretch',              IC.yoga,  30,  1, ['home'],         'A mat on the floor counts.'),
    C('Evening wind-down',           IC.yoga,  30,  1, ['home'],         'Screens off, a calm half hour before bed.'),
    C('Take your vitamins',          IC.pill,  15,  1, ['home', 'work'], 'A tiny habit that anchors a routine.')
  ];


  /* ---------- partner offers ---------- */
  // Sample partners for the demo; none of them are real businesses. Each has its own colour and logo glyph.
  const GLYPH = {
    dumbbell: '<path d="M3 9v6M6.5 7v10M17.5 7v10M21 9v6M6.5 12h11" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    lotus:    '<path d="M12 4c2.4 3 2.4 7.5 0 11-2.4-3.5-2.4-8 0-11zM4.5 9c4.2-.2 7.5 2.8 7.5 7.5-4.2.2-7.5-2.8-7.5-7.5zM19.5 9c-4.2-.2-7.5 2.8-7.5 7.5 4.2.2 7.5-2.8 7.5-7.5z" fill="#fff"/>',
    bolt:     '<path d="M13.5 3 5 14h6l-1 7 9-12h-6z" fill="#fff"/>',
    book:     '<path d="M4 5.5h6A2 2 0 0 1 12 7.5v12a2 2 0 0 0-2-2H4zM20 5.5h-6A2 2 0 0 0 12 7.5v12a2 2 0 0 1 2-2h6z" fill="#fff"/>',
    bowl:     '<path d="M4 12h16a8 8 0 0 1-16 0z" fill="#fff"/><path d="M8 5.5c0 1.5-1 1.5-1 3M12 4.5c0 1.5-1 1.5-1 4M16 5.5c0 1.5-1 1.5-1 3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    leaf:     '<path d="M5 19C5 10 10 5 20 5c0 10-5 15-15 14z" fill="#fff"/><path d="M5 19 13 11" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    palette:  '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.6 0 2.2-1 1.7-2.1s0-2.2 1.6-2.2h2A3.2 3.2 0 0 0 20.5 12c0-4.7-3.8-8.5-8.5-8.5z" fill="#fff"/>',
    building: '<path d="M4.5 20.5V8.5l7.5-4.5 7.5 4.5v12zM9.5 20.5v-5.5h5v5.5" fill="#fff" fill-rule="evenodd"/>',
    sparkle:  '<path d="M12 2.5 14.3 9.7 21.5 12l-7.2 2.3L12 21.5 9.7 14.3 2.5 12l7.2-2.3z" fill="#fff"/>'
  };
  const PARTNERS = [
    { id: 'ironworks', name: 'IronWorks Gym',      icon: IC.gym,   glyph: 'dumbbell', color: ['#ff8a3d', '#e8590c'], offer: 'Free day pass',            detail: 'Try the gym once, on the house.',                 terms: 'One free visit for new members.', task: 'Free visit at IronWorks Gym',  mins: 60,  code: 'IRON-FREE1' },
    { id: 'lotus',     name: 'Lotus Yoga Studio',  icon: IC.yoga,  glyph: 'lotus',    color: ['#9775fa', '#5f3dc4'], offer: 'Intro class $5', was: '$18', detail: 'Your first class at a promotional price.',        terms: 'New students, one class.',       task: 'Intro class at Lotus Yoga',    mins: 60,  code: 'LOTUS-5' },
    { id: 'stride',    name: 'StrideLab Run Club', icon: IC.run,   glyph: 'bolt',     color: ['#22d3ee', '#0c8599'], offer: 'Free group run + fitting', detail: 'Run with the club, get a free shoe fitting.',     terms: 'First run only.',                task: 'Group run at StrideLab',       mins: 60,  code: 'STRIDE-RUN' },
    { id: 'pageturn',  name: 'PageTurner Books',   icon: IC.book,  glyph: 'book',     color: ['#f06595', '#a61e4d'], offer: 'First audiobook free',     detail: 'Pick any title and start listening today.',       terms: 'New listeners.',                 task: 'Start a free audiobook',       mins: 30,  code: 'PAGE-FREE' },
    { id: 'freshcrate',name: 'FreshCrate Meals',   icon: IC.cook,  glyph: 'bowl',     color: ['#69db7c', '#2b8a3e'], offer: '$15 off your first box',   detail: 'Fresh ingredients and a recipe card, delivered.', terms: 'First order, min $30.',          task: 'Cook a FreshCrate meal',       mins: 60,  code: 'FRESH-15' },
    { id: 'bloom',     name: 'Bloom Plant Shop',   icon: IC.plant, glyph: 'leaf',     color: ['#a9e34b', '#5c940d'], offer: 'Free care workshop',       detail: 'A hands-on repotting and care session.',         terms: 'Limited seats weekly.',          task: 'Plant workshop at Bloom',      mins: 45,  code: 'BLOOM-FREE' },
    { id: 'canvas',    name: 'Canvas & Co. Studio', icon: IC.art,  glyph: 'palette',  color: ['#ffa94d', '#d9480f'], offer: 'First session $10', was: '$35', detail: 'Paint with a guide, all materials included.',   terms: 'New guests, one session.',       task: 'Painting session at Canvas & Co', mins: 90, code: 'CANVAS-10' },
    { id: 'nook',      name: 'Nook Cowork',        icon: IC.code,  glyph: 'building', color: ['#4dabf7', '#1864ab'], offer: 'Free focus day',           detail: 'A quiet desk and fast wifi for the day.',         terms: 'One free day per person.',       task: 'Focus day at Nook Cowork',     mins: 120, code: 'NOOK-DAY' },
    { id: 'tidykit',   name: 'TidyKit Supplies',   icon: IC.tidy,  glyph: 'sparkle',  color: ['#63e6be', '#087f5b'], offer: 'Free starter kit',         detail: 'Cloths, spray and gloves with your first order.', terms: 'While stocks last.',             task: 'Deep clean with TidyKit',      mins: 60,  code: 'TIDY-KIT' }
  ];
  const PARTNER_KM = { ironworks: 0.5, lotus: 0.7, stride: 1.1, pageturn: 0.4, freshcrate: 0.0, bloom: 0.9, canvas: 1.2, nook: 0.8, tidykit: 0.6 };
  const PARTNER_GLYPH = { ironworks: 'gym', lotus: 'yoga', stride: 'run', pageturn: 'study', bloom: 'plants', canvas: 'art', nook: 'work', tidykit: 'shop' };
  const partnerWhere = p => (PARTNER_KM[p.id] ? ASSIST.mapHTML(p.name, `${PARTNER_KM[p.id]} km, ${Math.max(1, Math.round(PARTNER_KM[p.id] * 12))} min walk`, { kind: PARTNER_GLYPH[p.id] }) : '');
  // Reveal or hide the route inside a partner card
  function toggleRoute(btn) {
    const slot = btn.closest('article').querySelector('.p-map');
    const show = slot.classList.toggle('hidden') === false;
    btn.setAttribute('aria-expanded', show);
    btn.textContent = show ? 'Hide route' : 'Details';
  }
  const logoSVG = p => `<span class="p-logo" aria-hidden="true" style="--c1:${p.color[0]};--c2:${p.color[1]}"><svg viewBox="0 0 24 24">${GLYPH[p.glyph]}</svg></span>`;

  // Prefer partners that fit the ideas just picked, then the user's habits (or something new, if they asked for that).
  function suggestPartners(ideas, a, count = 2) {
    const ideaIcons = ideas.map(i => i.icon);
    const habits = habitIcons().slice(0, 2);
    const stake = Math.max(MIN_STAKE, state.defaultPenalty || 10);
    return PARTNERS
      .map((p, i) => ({ p, i, sc: (ideaIcons.includes(p.icon) ? 3 : 0) + (habits.includes(p.icon) === (a.direction.id === 'familiar') ? 1 : 0) }))
      .sort((x, y) => y.sc - x.sc || x.i - y.i)
      .slice(0, count)
      .map(({ p }) => ({ ...p, h: Math.floor(p.mins / 60), m: p.mins % 60, stake }));
  }

  function partnerCard(p, i) {
    const len = `${p.h ? p.h + 'h' : ''}${p.m ? (p.h ? ' ' : '') + p.m + 'm' : ''}`;
    return `<article class="reco partner" style="--i:${i};--c1:${p.color[0]};--c2:${p.color[1]}">
      <span class="p-ribbon">Partner offer</span>
      <div class="p-head">${logoSVG(p)}<div><h3>${esc(p.name)}</h3><small>${esc(p.detail)}</small></div></div>
      <div class="p-offer"><b>${esc(p.offer)}</b>${p.was ? `<s>${esc(p.was)}</s>` : ''}</div>
      <div class="reco-meta"><div><b>${len}</b></div><div><b>${fmtMoney(p.stake)}</b></div></div>
      <div class="p-map hidden">${partnerWhere(p)}</div>
      <small class="p-terms">${esc(p.terms)} Code <b>${esc(p.code)}</b></small>
      <div class="card-actions"><button class="btn primary sm" data-guide-claim="${i}">Claim offer</button>${PARTNER_KM[p.id] ? `<button class="btn ghost sm" data-route-toggle aria-expanded="false">Details</button>` : ''}</div>
    </article>`;
  }

  // What the user already does: their most-completed icons, from real history.
  function habitIcons() {
    const n = {};
    state.tasks.filter(t => t.status === 'completed').forEach(t => { n[t.icon] = (n[t.icon] || 0) + 1; });
    return Object.entries(n).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  }

  function suggestNext(a, count = 3) {
    const cap = a.spare.cap;
    const habits = habitIcons().slice(0, 2);
    const stake = Math.max(MIN_STAKE, state.defaultPenalty || 10);
    const score = t => -Math.abs(t.e - a.mood.e) * 1.2
      + (t.places.includes(a.spot.id) ? 3 : 0)
      + (a.direction.id === 'familiar' ? (habits.includes(t.icon) ? 1 : 0) : (habits.includes(t.icon) ? -1 : 0.6))
      + (t.mins <= cap ? 0.5 : -1);
    const running = state.tasks.filter(t => t.status === 'active').map(t => t.name);
    const ranked = IDEAS.filter(t => t.mins <= cap * 2 && !running.includes(t.name)).map((t, i) => ({ t, i, sc: score(t) })).sort((x, y) => y.sc - x.sc || x.i - y.i);
    const out = [];
    for (const { t } of ranked) if (out.length < count && !out.some(o => o.icon === t.icon)) out.push(t);   // spread across icons first
    for (const { t } of ranked) if (out.length < count && !out.includes(t)) out.push(t);
    return out.map(t => {
      const mins = Math.min(t.mins, cap);
      return { name: t.name, icon: t.icon, h: Math.floor(mins / 60), m: mins % 60, stake, pitch: t.pitch };
    });
  }

  // The venue/plan helper wants a time of day and a blocker; take them from the clock and the mood.
  function chatPrefs() {
    const h = new Date().getHours();
    return { when: h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening', blocker: answers.mood ? answers.mood.blocker : 'motivation' };
  }

  /* ---------- conversation engine ---------- */
  let run = 0;            // bumps on restart or close, so a stale async step stops quietly
  let busy = false;       // true while the guide is "typing"
  let current = null;     // the step currently waiting for an answer
  let answers = {};
  let results = [];
  let plan = STEPS;       // the questions for this run, built from what the profile already tells us
  let partnerPicks = [];
  let ctx = {};           // what the suggestions were built from

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

  // Time of day, the profile and past tasks decide what is worth asking.
  const nowWhen = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; };
  const profile = () => (typeof state !== 'undefined' && state && state.profile) || {};
  const taskList = () => (typeof state !== 'undefined' && state && state.tasks) || [];
  const stakeDefault = () => Math.max(MIN_STAKE, profile().stake || (typeof state !== 'undefined' && state && state.defaultPenalty) || MIN_STAKE);

  function buildPlan() {
    const p = profile();
    const areaIds = p.areas || [];
    const area = areaIds.length
      ? { ...AREA, q: 'What is the focus today?', options: [...AREA.options.filter(o => areaIds.includes(o.id)), AREA_OTHER] }
      : AREA;
    const hour = new Date().getHours();
    const time = { ...TIME, q: 'How long do you have?', options: TIME.options.filter(o => !(o.id === 'long' && hour >= 21)) };
    const steps = [area, time, ENERGY];
    if (!(p.blockers && p.blockers.length) && !p.blocker) steps.push(BLOCKER);            // a profile without setup answers still needs this one
    if (!p.stake && !taskList().length) steps.push(STAKE);                                // first task ever: ask what to stake
    return steps;
  }

  function greeting() {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const running = taskList().filter(t => t.status === 'active').length;
    return running ? `${part}. ${running} task${running > 1 ? 's' : ''} running. Let's find one more.` : `${part}. Let's find your next task.`;
  }

  function setProgress(ix) {
    const total = plan.length;
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
      answers[step.id] = opt;
      if (opt.reply && !(await say(esc(opt.reply), token))) return;
      return next(plan.findIndex(x => x.id === step.id) + 1, token);
    } finally {
      if (token === run) busy = false;
    }
  }

  async function next(ix, token) {
    setProgress(ix);
    if (ix < plan.length) { busy = false; return ask(plan[ix], token); }
    return finish(token);
  }

  async function finish(token) {
    results = suggestNext(answers);
    partnerPicks = suggestPartners(results, answers);
    const prefs = chatPrefs();
    ctx = prefs;
    await Promise.all(results.map(async r => {
      const mins = r.h * 60 + r.m;
      [r.help, r.where] = await Promise.all([ASSIST.load(r, mins, prefs), ASSIST.whereFor(r, mins, prefs)]);
    }));
    if (token !== run) return;
    if (!(await say('Our partners have offers you can try right now.', token))) return;
    const pw = document.createElement('div');
    pw.className = 'guide-sugg guide-partners';
    pw.innerHTML = partnerPicks.map(partnerCard).join('');
    log().appendChild(pw);
    scrollDown();
    if (!(await say(answers.direction.id === 'familiar' ? 'Three ideas that build on your habits.' : 'Three ideas to try something different.', token))) return;

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

    setProgress(plan.length);
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
    busy = false; current = null; answers = {}; results = []; partnerPicks = []; plan = FLOW;
    log().innerHTML = '';
    setChips([]);
    setProgress(0);
    enableInput(false);
    if (!(await say(greeting(), token))) return;
    ask(plan[0], token);
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
      if (h) { const r = results[+h.dataset.guideHelp]; if (r) openHelp({ name: r.name }, r.h * 60 + r.m, ctx); return; }
      const rt = e.target.closest('[data-route-toggle]');
      if (rt) return toggleRoute(rt);
      const c = e.target.closest('[data-guide-claim]');
      if (c) {
        const p = partnerPicks[+c.dataset.guideClaim];
        if (!p) return;
        close();
        openAddTask({ name: p.task, icon: p.icon, h: p.h, m: p.m, stake: p.stake });
        toast(`Show code ${p.code} at ${p.name}`, 'success');
        return;
      }
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
  return { open, close, suggest, suggestNext, suggestPartners, PARTNERS, logoSVG, partnerWhere, toggleRoute, matchOption, buildPlan, FLOW, STEPS, AREA, BLOCKER, WHEN, TIME, STAKE, UNSURE, ENERGY };
})();
