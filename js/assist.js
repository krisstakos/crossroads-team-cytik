/* Commit — task assistance: practical help for a task (nearby places, prices, plans, recipes).
   All data comes from a provider. The sample provider below is built in and always labelled as sample data.
   A real provider (maps, places API) can replace it through ASSIST.setProvider() without touching any screen. */
'use strict';

const ASSIST = (function () {
  /* ---------- small helpers ---------- */
  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  const hourText = h => (h === 0 || h === 24 ? 'midnight' : h === 12 ? 'noon' : (h % 12 || 12) + (h < 12 ? ' am' : ' pm'));
  const walkMins = km => Math.max(1, Math.round(km * 12));          // about 5 km/h
  const nearestFirst = list => list.slice().sort((a, b) => a.km - b.km);

  function openStatus(open, close, now) {
    if (open === 0 && close === 24) return { open: true, text: 'Open 24 hours' };
    const h = now.getHours() + now.getMinutes() / 60;
    return h >= open && h < close
      ? { open: true, text: `Open now, until ${hourText(close)}` }
      : { open: false, text: `Closed now, opens ${hourText(open)}` };
  }

  /* ---------- which kind of help fits a task ---------- */
  // Matched on the task name only. The icon is not a reliable signal: new tasks default to the gym icon.
  const KEYWORDS = [
    ['gym',   /\b(gym|workout|work out|lift\w*|weights?|strength|fitness|cardio|crossfit|leg day|bench)\b/i],
    ['run',   /\b(run|running|jog\w*|walk\w*|hike|hiking|5k|10k|marathon|sprint\w*|fresh air)\b/i],
    ['study', /\b(study|studying|read|reading|revis\w*|exam|homework|language|course|learn\w*)\b/i],
    ['cook',  /\b(cook\w*|dinner|lunch|breakfast|meal|recipe|bake|baking)\b/i],
    ['yoga',  /\b(yoga|stretch\w*|pilates|meditat\w*|wind-?down)\b/i],
    ['work',  /\b(deep work|focus|admin|inbox|ship|project|plan tomorrow|code|coding|work block|my app)\b/i],
    ['art',   /\b(sketch\w*|draw\w*|paint\w*|art|write|writing|instrument|guitar|piano|music)\b/i]
  ];
  // Tasks done at home need no venue, but "At home" is still a useful answer to "where".
  const HOME_RE = /\b(tidy\w*|clean\w*|laundry|vitamins?|plants?|water|dishes|declutter\w*|organi[sz]e)\b/i;
  function kindOf(task) {
    const name = (task && task.name) || '';
    for (const [kind, re] of KEYWORDS) if (re.test(name)) return kind;
    return null;
  }
  const hasSignal = task => !!kindOf(task) || HOME_RE.test((task && task.name) || '');

  /* ---------- sample data ---------- */
  const GYMS = [
    { name: 'Ironworks Fitness',          km: 0.4, open: 5,  close: 23, day: 12, month: 39, cardio: '20 treadmills, 14 bikes, 6 rowers', weights: 'Free weights, racks and machines', extras: ['Showers', 'Lockers'] },
    { name: 'Pulse 24/7',                 km: 0.9, open: 0,  close: 24, day: 8,  month: 24, cardio: '12 treadmills, 10 bikes',           weights: 'Machines and dumbbells to 40 kg',  extras: ['Open all night'] },
    { name: 'Studio Loop',                km: 1.6, open: 6,  close: 21, day: 20, month: 79, cardio: null,                                weights: 'Small-group strength classes',     extras: ['Towels included'] },
    { name: 'Riverside Community Centre', km: 2.1, open: 7,  close: 21, day: 6,  month: 19, cardio: '8 treadmills, 6 bikes',             weights: 'Light free weights and machines',  extras: ['Pool', 'Showers'] }
  ];
  const ROUTES = [
    { name: 'Riverside Loop', km: 0.6, dist: 5.2, surface: 'Paved path',  terrain: 'Flat',  lit: true,  track: false },
    { name: 'Oak Hill Park',  km: 1.1, dist: 3.8, surface: 'Mixed trail', terrain: 'Hilly', lit: false, track: false },
    { name: 'Stadium Track',  km: 1.8, dist: 0.4, surface: 'Rubber track', terrain: 'Flat', lit: true,  track: true }
  ];
  const SPOTS = [
    { name: 'Grounds Coffee',          km: 0.3, open: 7, close: 18, cost: 'About $4 for a coffee', wifi: true, quiet: 'Some background noise', power: 'A few sockets' },
    { name: 'Central Library',         km: 0.5, open: 9, close: 20, cost: 'Free',                  wifi: true, quiet: 'Silent floors',          power: 'Plenty of sockets' },
    { name: 'University Reading Room', km: 1.4, open: 8, close: 22, cost: 'Free, public welcome',  wifi: true, quiet: 'Silent',                 power: 'Plenty of sockets' }
  ];
  const STUDIOS = [
    { name: 'Lotus Yoga Studio',          km: 0.7, open: 6, close: 21, dropIn: 15, classes: 'Classes at 7 am and 6 pm',  mats: true },
    { name: 'Riverside Community Centre', km: 2.1, open: 7, close: 21, dropIn: 8,  classes: 'Mon and Thu at 6 pm',       mats: false }
  ];
  const CREATIVE = [
    { name: 'Makers Space Studio', km: 1.2, open: 10, close: 21, cost: '$6 drop-in',             kit: 'Easels, tables and supplies' },
    { name: 'Grounds Coffee',      km: 0.3, open: 7,  close: 18, cost: 'About $4 for a coffee', kit: 'A quiet corner and good light' }
  ];
  const SHOPS = [
    { name: 'Corner Market', km: 0.3, open: 7, close: 22 },
    { name: 'Fresh Mart',    km: 0.8, open: 8, close: 21 }
  ];
  const RECIPES = [
    { name: 'Garlic and chilli pasta', mins: 20, serves: 2, ingredients: [['Spaghetti, 200 g', 1.2], ['Garlic, 4 cloves', 0.4], ['Olive oil and chilli flakes', 0.6], ['Parmesan, 30 g', 1.1], ['Parsley', 0.5]],
      steps: ['Boil the pasta in salted water.', 'Fry sliced garlic and chilli in olive oil.', 'Toss the drained pasta in the pan with a splash of pasta water.', 'Finish with parmesan and parsley.'] },
    { name: 'Sheet-pan chicken and vegetables', mins: 50, serves: 2, ingredients: [['Chicken thighs, 4', 4.5], ['Potatoes, 400 g', 1.2], ['Broccoli, 1 head', 1.8], ['Olive oil and spices', 0.8], ['Lemon', 0.5]],
      steps: ['Heat the oven to 220 C.', 'Chop the potatoes and toss everything in oil and spices.', 'Roast on one tray for 35 minutes, turning once.', 'Squeeze lemon over and serve.'] },
    { name: 'Veggie chilli with rice', mins: 75, serves: 4, ingredients: [['Kidney beans, 2 tins', 2.4], ['Chopped tomatoes, 2 tins', 1.5], ['Onion and peppers', 1.8], ['Chilli, cumin, paprika', 0.8], ['Rice, 300 g', 1.2]],
      steps: ['Soften the onion and peppers.', 'Add spices, beans and tomatoes.', 'Simmer for 40 minutes.', 'Cook the rice and serve together.'] }
  ];

  /* ---------- the sample provider ---------- */
  const PROOF = {
    gym:   'Photograph the gym floor with equipment in view.',
    run:   'Photograph your shoes on the path, or a landmark on your route.',
    study: 'Photograph your open book or notes on the desk.',
    cook:  'Photograph the finished plate.',
    yoga:  'Photograph your mat on the floor.',
    work:  'Photograph your screen or notes with the work in view.',
    art:   'Photograph the work in progress.'
  };

  /* ---------- where to do it: rank venues against what we know about the person ---------- */
  const HOURS = { morning: 8, afternoon: 14, evening: 19 };
  const WHEN_WORD = { morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening' };
  const openAt = (open, close, when) => !HOURS[when] || (HOURS[when] >= open && HOURS[when] < close);
  const rangeText = (o, c) => (o === 0 && c === 24 ? 'open 24 hours' : `open ${hourText(o)} to ${hourText(c)}`);
  const best = (list, score) => list.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => b.s - a.s || a.i - b.i)[0].x;
  const joinWords = parts => (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || '');
  const reasonOf = (parts, fallback) => (parts.length ? `Best match: ${joinWords(parts)}.` : fallback);
  const distText = km => `${km} km, ${walkMins(km)} min walk`;
  const atHome = (reason, facts, alt, key) => ({ name: 'At home', home: true, distance: '', key: key || [], facts, reason, alt: alt || null });

  function whereSample(task, ctx) {
    const kind = kindOf(task);
    const when = ctx.when, blocker = ctx.blocker, mins = ctx.mins || 60;
    const near = list => Math.min(...list.map(x => x.km));
    let venue = null;

    if (kind === 'gym') {
      const g = best(GYMS, x => (x.cardio ? 2 : 0) + (openAt(x.open, x.close, when) ? 2 : 0) - x.day / 10 - x.km);
      venue = { name: g.name, distance: distText(g.km), key: [`${money(g.day)} day pass`, g.cardio ? 'Cardio' : 'No cardio'],
        facts: [rangeText(g.open, g.close), g.cardio ? `cardio: ${g.cardio}` : 'no cardio machines', `${money(g.day)} day pass`, `${money(g.month)} a month`],
        reason: reasonOf([
          WHEN_WORD[when] && openAt(g.open, g.close, when) ? `open ${WHEN_WORD[when]}` : null,
          g.cardio ? 'has cardio machines' : null,
          g.day === Math.min(...GYMS.map(x => x.day)) ? 'the cheapest day pass nearby' : (g.km === near(GYMS) ? 'the closest' : null)
        ].filter(Boolean), 'Best overall for price and distance.') };
    } else if (kind === 'run') {
      const cap = mins / 6.5;
      const r = best(ROUTES, x => (x.lit && when === 'evening' ? 2 : 0) + (blocker === 'energy' && x.terrain === 'Flat' ? 1 : 0) - (x.track ? 1.5 : Math.abs(x.dist - cap) / 2) - x.km * 0.5);
      venue = { name: r.name, distance: distText(r.km), key: [r.track ? '400 m track' : `${r.dist} km loop`, r.lit ? 'Lit' : 'Not lit'],
        facts: [r.track ? '400 m track' : `${r.dist} km loop`, r.surface, r.terrain, r.lit ? 'lit after dark' : 'not lit after dark'],
        reason: reasonOf([
          r.lit && when === 'evening' ? 'lit after dark' : null,
          blocker === 'energy' && r.terrain === 'Flat' ? 'flat, so easy on tired legs' : null,
          !r.track && Math.abs(r.dist - cap) <= 1.5 ? 'about the right length for your time' : null
        ].filter(Boolean), 'The closest good place to run.') };
    } else if (kind === 'study' || kind === 'work') {
      const sp = best(SPOTS, x => (openAt(x.open, x.close, when) ? 2 : 0) + (/^Silent/.test(x.quiet) ? 1.5 : 0) + (/^Free/.test(x.cost) ? 1 : 0) + (kind === 'work' && /^Plenty/.test(x.power) ? 0.5 : 0) - x.km * 0.5);
      venue = { name: sp.name, distance: distText(sp.km), key: [/^Free/.test(sp.cost) ? 'Free' : sp.cost.replace('About ', '').replace(' for a coffee', ' coffee'), sp.wifi ? 'Wi-Fi' : 'No Wi-Fi'], facts: [rangeText(sp.open, sp.close), sp.quiet.toLowerCase(), sp.cost.toLowerCase(), sp.power.toLowerCase()],
        reason: reasonOf([
          WHEN_WORD[when] && openAt(sp.open, sp.close, when) ? `open ${WHEN_WORD[when]}` : null,
          /^Silent/.test(sp.quiet) ? 'silent' : null,
          /^Free/.test(sp.cost) ? 'free to use' : null,
          kind === 'work' && /^Plenty/.test(sp.power) ? 'plenty of sockets' : null
        ].filter(Boolean), 'Close by, with Wi-Fi.') };
    } else if (kind === 'yoga') {
      const st = best(STUDIOS, x => (openAt(x.open, x.close, when) ? 2 : 0) + (x.mats ? 0.5 : 0) - x.dropIn / 20 - x.km * 0.5);
      if (blocker === 'busy' || blocker === 'energy') {
        venue = atHome(blocker === 'busy' ? 'No travel time, so it fits a packed day.' : 'No travel, so it is easier to start when you are tired.',
          ['Free', 'A mat or a towel is enough'], `Or try ${st.name}, ${st.km} km away, ${money(st.dropIn)} drop-in.`);
      } else {
        venue = { name: st.name, distance: distText(st.km), key: [`${money(st.dropIn)} drop-in`, st.mats ? 'Mats' : 'Bring a mat'], facts: [rangeText(st.open, st.close), st.classes, `${money(st.dropIn)} drop-in`, st.mats ? 'mats provided' : 'bring your own mat'],
          reason: reasonOf([WHEN_WORD[when] && openAt(st.open, st.close, when) ? `open ${WHEN_WORD[when]}` : null, st.mats ? 'mats provided' : null].filter(Boolean), 'The closest studio.'),
          alt: 'Or at home for free, a mat or a towel is enough.' };
      }
    } else if (kind === 'art') {
      const c = best(CREATIVE, x => (openAt(x.open, x.close, when) ? 2 : 0) + (mins >= 60 && /supplies/.test(x.kit) ? 1 : 0) - x.km * 0.5);
      venue = { name: c.name, distance: distText(c.km), key: [c.cost.replace('About ', '').replace(' for a coffee', ' coffee')], facts: [rangeText(c.open, c.close), c.cost.toLowerCase(), c.kit.toLowerCase()],
        reason: reasonOf([WHEN_WORD[when] && openAt(c.open, c.close, when) ? `open ${WHEN_WORD[when]}` : null, mins >= 60 && /supplies/.test(c.kit) ? 'supplies on site for a longer session' : null].filter(Boolean), 'Close by, with good light.'),
        alt: 'Or at home at a clear table.' };
    } else if (kind === 'cook') {
      const shop = nearestFirst(SHOPS)[0];
      venue = atHome('Cook in your own kitchen; shop first if you are missing anything.', [`Groceries: ${shop.name}, ${shop.km} km, ${openStatus(shop.open, shop.close, ctx.now || new Date()).text.toLowerCase()}`], null, [`Shop: ${shop.name}`]);
    } else if (HOME_RE.test((task && task.name) || '')) {
      venue = atHome('Nothing to book or travel to.', ['No travel needed']);
    }
    return venue ? { kind: kind || 'home', sample: true, venue, alt: venue.alt || null } : null;
  }

  const sampleProvider = {
    where: whereSample,
    get(kind, ctx) {
      const now = ctx.now || new Date();
      const mins = ctx.mins || 60;

      if (kind === 'gym') {
        const places = nearestFirst(GYMS).slice(0, 3).map(g => {
          const st = openStatus(g.open, g.close, now);
          return {
            name: g.name, distance: `${g.km} km, ${walkMins(g.km)} min walk`, status: st,
            facts: [['Day pass', money(g.day)], ['Monthly', money(g.month)]],
            badges: [
              g.cardio ? { text: `Cardio: ${g.cardio}`, tone: 'ok' } : { text: 'No cardio machines', tone: 'no' },
              { text: g.weights, tone: 'ok' },
              ...g.extras.map(e => ({ text: e, tone: 'plain' }))
            ]
          };
        });
        const first = nearestFirst(GYMS)[0];
        const plan = mins <= 30 ? 'Quick session: 5 min warm-up, 20 min cardio, 5 min stretching.'
          : mins <= 60 ? 'One hour: 5 min warm-up, 20 min cardio, 30 min strength, 5 min stretching.'
          : 'Long session: 10 min warm-up, 25 min cardio, 60 min strength, 10 min stretching.';
        return { kind, title: 'Nearby gyms', sample: true, plan, places, proof: PROOF.gym,
          headline: `Nearest: ${first.name}, ${first.km} km. Day pass ${money(first.day)}. ${first.cardio ? 'Has cardio.' : 'No cardio machines.'}` };
      }

      if (kind === 'run') {
        const capacity = mins / 6.5;                                   // easy pace, minutes per km
        const places = nearestFirst(ROUTES).map(r => ({
          name: r.name, distance: `${r.km} km away, ${walkMins(r.km)} min walk`, status: null,
          facts: r.track
            ? [['Distance', '400 m per lap'], ['Laps in your time', String(Math.max(1, Math.round(capacity / 0.4)))], ['Surface', r.surface]]
            : [['Loop', `${r.dist} km`], ['About', `${Math.round(r.dist * 6.5)} min easy pace`], ['Terrain', `${r.terrain}, ${r.surface.toLowerCase()}`]],
          badges: [{ text: r.lit ? 'Lit after dark' : 'Not lit after dark', tone: r.lit ? 'ok' : 'no' }, { text: 'Free', tone: 'plain' }]
        }));
        const first = nearestFirst(ROUTES)[0];
        return { kind, title: 'Running routes nearby', sample: true, places, proof: PROOF.run,
          plan: `About ${capacity.toFixed(1)} km at an easy pace.`,
          headline: `Nearest: ${first.name}, ${first.km} km away. ${first.dist} km loop, about ${Math.round(first.dist * 6.5)} min at an easy pace.` };
      }

      if (kind === 'study') {
        const places = nearestFirst(SPOTS).map(s => ({
          name: s.name, distance: `${s.km} km, ${walkMins(s.km)} min walk`, status: openStatus(s.open, s.close, now),
          facts: [['Cost', s.cost], ['Noise', s.quiet]],
          badges: [{ text: s.wifi ? 'Wi-Fi' : 'No Wi-Fi', tone: s.wifi ? 'ok' : 'no' }, { text: s.power, tone: 'plain' }]
        }));
        const first = nearestFirst(SPOTS)[0];
        const blocks = Math.max(1, Math.floor(mins / 30));
        return { kind, title: 'Study spots nearby', sample: true, places, proof: PROOF.study,
          plan: `${blocks} focus block${blocks > 1 ? 's' : ''} of 25 min.`,
          headline: `Nearest: ${first.name}, ${first.km} km. ${openStatus(first.open, first.close, now).text}. Wi-Fi available.` };
      }

      if (kind === 'cook') {
        const fits = RECIPES.filter(r => r.mins <= mins);
        const recipe = fits.length ? fits[fits.length - 1] : RECIPES[0];
        const cost = recipe.ingredients.reduce((sum, [, c]) => sum + c, 0);
        const places = nearestFirst(SHOPS).map(s => ({
          name: s.name, distance: `${s.km} km, ${walkMins(s.km)} min walk`, status: openStatus(s.open, s.close, now),
          facts: [], badges: [{ text: 'Groceries', tone: 'plain' }]
        }));
        return { kind, title: 'Recipe and shops nearby', sample: true, places, proof: PROOF.cook,
          recipe: { name: recipe.name, mins: recipe.mins, serves: recipe.serves, cost, ingredients: recipe.ingredients, steps: recipe.steps },
          plan: mins < recipe.mins ? `Needs about ${recipe.mins} min, a bit over your limit.` : '',
          headline: `Try: ${recipe.name}, about ${recipe.mins} min and ${money(cost)} for ${recipe.serves} servings.` };
      }

      if (kind === 'yoga') {
        const places = STUDIOS.map(st => ({
          name: st.name, distance: distText(st.km), status: openStatus(st.open, st.close, now),
          facts: [['Drop-in', money(st.dropIn)], ['Classes', st.classes]],
          badges: [{ text: st.mats ? 'Mats provided' : 'Bring your own mat', tone: st.mats ? 'ok' : 'plain' }]
        }));
        const plan = mins <= 30 ? 'Short flow: 5 min breathing, 20 min sequence, 5 min cool-down.' : 'Longer flow: 10 min warm-up, 35 min sequence, 15 min cool-down and breathing.';
        return { kind, title: 'Yoga and stretching nearby', sample: true, places, plan, proof: PROOF.yoga, headline: `Nearest: ${STUDIOS[0].name}, ${STUDIOS[0].km} km. ${money(STUDIOS[0].dropIn)} drop-in.` };
      }

      if (kind === 'work') {
        const places = nearestFirst(SPOTS).map(sp => ({
          name: sp.name, distance: distText(sp.km), status: openStatus(sp.open, sp.close, now),
          facts: [['Cost', sp.cost], ['Noise', sp.quiet]],
          badges: [{ text: sp.wifi ? 'Wi-Fi' : 'No Wi-Fi', tone: sp.wifi ? 'ok' : 'no' }, { text: sp.power, tone: 'plain' }]
        }));
        const blocks = Math.max(1, Math.floor(mins / 30));
        return { kind, title: 'Places to focus nearby', sample: true, places, proof: PROOF.work,
          plan: `${blocks} focus block${blocks > 1 ? 's' : ''} of 25 min.`, headline: `Nearest: ${nearestFirst(SPOTS)[0].name}, ${nearestFirst(SPOTS)[0].km} km.` };
      }

      if (kind === 'art') {
        const places = nearestFirst(CREATIVE).map(c => ({
          name: c.name, distance: distText(c.km), status: openStatus(c.open, c.close, now),
          facts: [['Cost', c.cost]], badges: [{ text: c.kit, tone: 'plain' }]
        }));
        return { kind, title: 'Creative spaces nearby', sample: true, places, proof: PROOF.art,
          plan: mins <= 30 ? 'Warm up 5 min, then one small piece.' : 'Warm up 10 min, then one focused piece.',
          headline: `Nearest: ${nearestFirst(CREATIVE)[0].name}, ${nearestFirst(CREATIVE)[0].km} km.` };
      }
      return null;
    }
  };

  let provider = sampleProvider;
  const setProvider = p => { provider = p; };

  // Both return Promises so a real provider can fetch over the network. null means "nothing to add for this task".
  // prefs (optional): { when: 'morning' | 'afternoon' | 'evening' | 'varies', blocker: 'busy' | 'energy' | ... }
  function whereFor(task, mins, prefs) {
    if (!hasSignal(task)) return Promise.resolve(null);
    return Promise.resolve(provider.where(task, { mins: mins || 60, now: new Date(), ...(prefs || {}) }));
  }
  async function load(task, mins, prefs) {
    const kind = kindOf(task);
    if (!kind) return null;
    const ctx = { mins: mins || 60, now: new Date(), task, ...(prefs || {}) };
    const [help, where] = await Promise.all([provider.get(kind, ctx), provider.where(task, ctx)]);
    return help ? { ...help, where } : null;
  }

  /* ---------- rendering ---------- */
  // The best place to do the task. Compact (on cards): just the name and distance. Full (help sheet): the reasons too.
  function whereHTML(w, compact) {
    if (!w) return '';
    const v = w.venue;
    const pin = '<svg class="ico pin" aria-hidden="true"><use href="#i-pin"/></svg>';
    if (compact) {
      const km = v.distance ? v.distance.split(',')[0] : '';
      return `<div class="where compact">${pin}<p><b>${esc(v.name)}</b>${km ? ` <span class="sub">${esc(km)}</span>` : ''}</p></div>`;
    }
    return `<div class="where">${pin}<div class="where-body">
      <p class="where-title"><b>${esc(v.name)}</b>${v.home ? '' : '<span class="nearest">Best match</span>'}</p>
      ${v.distance ? `<p class="where-sub">${esc(v.distance)}</p>` : ''}
      ${v.facts.length ? `<p class="where-facts">${esc(v.facts.join(', '))}</p>` : ''}
      <p class="where-why">${esc(v.reason)}</p>
    </div></div>`;
  }

  function placeHTML(p, i) {
    return `<article class="place">
      <div class="place-top">
        <div><h4>${esc(p.name)}</h4><p class="sub">${esc(p.distance)}</p></div>
        ${p.status ? `<span class="status ${p.status.open ? 'open' : 'closed'}">${esc(p.status.text)}</span>` : ''}
      </div>
      ${p.facts.length ? `<dl class="facts">${p.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      <div class="badges">${p.badges.slice(0, 2).map(b => `<span class="badge ${b.tone}">${esc(b.text)}</span>`).join('')}</div>
    </article>`;
  }

  function recipeHTML(r) {
    return `<article class="recipe">
      <h4>${esc(r.name)}</h4>
      <p class="sub">${r.mins} min, ${money(r.cost)}</p>
      <ul class="ingredients">${r.ingredients.map(([n, c]) => `<li><span>${esc(n)}</span><b>${money(c)}</b></li>`).join('')}</ul>
      <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    </article>`;
  }

  // The help sheet is a short answer: the best place and its two key facts. The rest sits behind "More".
  function fullHTML(help) {
    if (!help) return '<p class="sub">No tips for this task.</p>';
    const v = help.where && help.where.venue;
    const pin = '<svg class="ico pin" aria-hidden="true"><use href="#i-pin"/></svg>';
    const pills = v && v.key && v.key.length ? `<div class="badges">${v.key.map(k => `<span class="badge">${esc(k)}</span>`).join('')}</div>` : '';
    const best = v ? `<div class="where">${pin}<div class="where-body">
        <p class="where-title"><b>${esc(v.name)}</b></p>${v.distance ? `<p class="where-sub">${esc(v.distance.split(',')[0])}</p>` : ''}${pills}
      </div></div>` : '';
    const recipe = help.recipe ? `<p class="help-line"><b>${esc(help.recipe.name)}</b> <span class="sub">${help.recipe.mins} min, ${money(help.recipe.cost)}</span></p>` : '';
    const more = `${v ? `<p class="where-why">${esc(v.reason)}</p>` : ''}
      ${help.plan ? `<p class="help-plan">${esc(help.plan)}</p>` : ''}
      ${help.recipe ? recipeHTML(help.recipe) : ''}
      <div class="help-places">${help.places.slice(0, 2).map(placeHTML).join('')}</div>
      <p class="help-proof">Photo: ${esc(help.proof.replace(/^Photograph /, '').replace(/\.$/, ''))}</p>`;
    return `<div class="help-head"><h3 id="help-title">${esc(help.title)}</h3>${help.sample ? '<span class="sample-tag">Sample</span>' : ''}</div>
      ${best}${recipe}
      <details class="help-more"><summary>More</summary>${more}</details>`;
  }

  return { kindOf, load, whereFor, whereHTML, fullHTML, setProvider };
})();
