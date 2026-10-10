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
    ['work',  /\b(deep work|focus|admin|inbox|ship|project|plan tomorrow|code|coding|work block|my app|report|taxes|tax|email|invoice|presentation|slides|proposal)\b/i],
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
      venue.errand = { name: shop.name, distance: distText(shop.km), glyph: 'shop', label: 'Groceries' };
    } else if (HOME_RE.test((task && task.name) || '')) {
      venue = atHome('Nothing to book or travel to.', ['No travel needed']);
      const n = (task && task.name) || '';
      const e = /\b(plants?|water)\b/i.test(n) ? { name: 'Green Corner Garden Centre', km: 0.6, glyph: 'plants' }
        : /\bvitamins?\b/i.test(n) ? { name: 'Corner Pharmacy', km: 0.4, glyph: 'pharmacy' }
        : { name: 'HomeBase Supplies', km: 0.9, glyph: 'shop' };                 // cleaning, laundry, dishes, decluttering
      venue.errand = { name: e.name, distance: distText(e.km), glyph: e.glyph };
      venue.facts = [`Supplies: ${e.name}, ${e.km} km`, 'No travel needed'];
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

  /* ---------- mock map ---------- */
  // A drawn street map, not real data: the same place name always gives the same layout.
  // You are the dot on the left, the venue is the pin, and the dashed line follows the streets between them.
  // The pin carries a glyph for the kind of place, and a run gets a loop through a park instead of a street route.
  const PIN_GLYPH = {
    gym:      '<path d="M3 9v6M6.5 7v10M17.5 7v10M21 9v6M6.5 12h11" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>',
    run:      '<path d="M13.5 3 5 14h6l-1 7 9-12h-6z" fill="#fff"/>',
    study:    '<path d="M4 5.5h6A2 2 0 0 1 12 7.5v12a2 2 0 0 0-2-2H4zM20 5.5h-6A2 2 0 0 0 12 7.5v12a2 2 0 0 1 2-2h6z" fill="#fff"/>',
    work:     '<path d="M4.5 20.5V8.5l7.5-4.5 7.5 4.5v12zM9.5 20.5v-5.5h5v5.5" fill="#fff" fill-rule="evenodd"/>',
    yoga:     '<path d="M12 4c2.4 3 2.4 7.5 0 11-2.4-3.5-2.4-8 0-11zM4.5 9c4.2-.2 7.5 2.8 7.5 7.5-4.2.2-7.5-2.8-7.5-7.5zM19.5 9c-4.2-.2-7.5 2.8-7.5 7.5 4.2.2 7.5-2.8 7.5-7.5z" fill="#fff"/>',
    art:      '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.6 0 2.2-1 1.7-2.1s0-2.2 1.6-2.2h2A3.2 3.2 0 0 0 20.5 12c0-4.7-3.8-8.5-8.5-8.5z" fill="#fff"/>',
    shop:     '<path d="M3 4h3l2.5 11h9L20 7H7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.7" fill="#fff"/><circle cx="17" cy="19" r="1.7" fill="#fff"/>',
    plants:   '<path d="M5 19C5 10 10 5 20 5c0 10-5 15-15 14z" fill="#fff"/>',
    pharmacy: '<path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>'
  };
  function seeded(str) {
    let h = 2166136261;
    for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  }
  // opts: { kind: glyph key, loop: label for a run loop, tall: bigger map }
  function mapHTML(name, distance, opts) {
    const o = opts === true ? { tall: true } : (opts || {});
    const rnd = seeded(String(name));
    const W = 300, H = o.tall ? 170 : 110, f = n => n.toFixed(1);
    const yx = 34 + rnd() * 30, yy = H * (0.62 + rnd() * 0.22);          // you
    let px = 190 + rnd() * 80, py = H * (0.16 + rnd() * 0.24);            // the venue
    if (o.loop) { px = 150; py = H * 0.5; }                               // a run starts at the left edge of the loop
    const roadsX = [yx, px, 20 + rnd() * 60 + 90, 250 + rnd() * 30].filter((v, i, a) => a.findIndex(w => Math.abs(w - v) < 16) === i);
    const roadsY = [yy, py, H * (0.4 + rnd() * 0.2)].filter((v, i, a) => a.findIndex(w => Math.abs(w - v) < 14) === i);
    // scenery: each place gets a different mix, so maps do not look alike
    const pick = rnd();
    let scenery = '';
    if (o.loop) scenery += `<rect class="map-park" x="${px + 4}" y="${H * 0.14}" width="${W - px - 24}" height="${H * 0.72}" rx="22"/>`;
    else if (pick < 0.34) scenery += `<path class="map-water" d="M${W} ${H * 0.45}C${W - 40} ${H * 0.5} ${W - 60} ${H * 0.8} ${W - 110} ${H}L${W} ${H}z"/>`;
    else if (pick < 0.67) scenery += `<rect class="map-park" x="${90 + rnd() * 20}" y="${H * 0.52}" width="64" height="${H * 0.3}" rx="10"/>`;
    else scenery += `<path class="map-rail" d="M0 ${H * 0.9}L${W} ${H * 0.72}"/>`;
    for (let i = 0; i < 6; i++) {                                           // a few building blocks
      const bx = 8 + rnd() * (W - 40), by = 8 + rnd() * (H - 30);
      if (Math.abs(bx - px) < 26 || Math.abs(by - yy) < 14 || Math.abs(bx - yx) < 24) continue;
      scenery += `<rect class="map-block" x="${f(bx)}" y="${f(by)}" width="${f(12 + rnd() * 14)}" height="${f(8 + rnd() * 10)}" rx="2"/>`;
    }
    const roads = roadsX.map(x => `<path class="map-road" d="M${f(x)} 0V${H}"/>`).join('') + roadsY.map(y => `<path class="map-road" d="M0 ${f(y)}H${W}"/>`).join('');
    const label = distance ? String(distance).split(',')[0] : '';
    const route = `<path class="map-route" d="M${f(yx)} ${f(yy)}H${f(px)}V${f(py + 4)}"/>`;
    const loop = o.loop ? `<ellipse class="map-route loop" cx="${f(px + (W - px - 24) / 2 + 4)}" cy="${f(H * 0.5)}" rx="${f((W - px - 24) / 2 - 8)}" ry="${f(H * 0.26)}"/>` : '';
    const mx = (yx + px) / 2, my = yy;
    const pill = (x, y, t) => `<g transform="translate(${f(x)} ${f(y)})"><rect class="map-pill" x="${-(t.length * 2.9 + 8)}" y="-9" width="${f(t.length * 5.8 + 16)}" height="18" rx="9"/><text class="map-pilltext" y="4" text-anchor="middle">${esc(t)}</text></g>`;
    const glyph = PIN_GLYPH[o.kind] ? `<g transform="translate(0 -21) scale(.46) translate(-12 -12)">${PIN_GLYPH[o.kind]}</g>` : '<circle class="map-pin-dot" cy="-21" r="4.5"/>';
    return `<div class="map" role="img" aria-label="Sample map: route from you to ${esc(name)}${distance ? ', ' + esc(distance) : ''}">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect class="map-bg" width="${W}" height="${H}"/>${scenery}${roads}${loop}${route}
        <circle class="map-you-halo" cx="${f(yx)}" cy="${f(yy)}" r="11"/><circle class="map-you" cx="${f(yx)}" cy="${f(yy)}" r="5.5"/>
        <text class="map-tag" x="${f(yx)}" y="${f(yy + 24)}" text-anchor="middle">You</text>
        ${label ? pill(mx, my - 14, label) : ''}${o.loop ? pill(px + (W - px - 24) / 2 + 4, H * 0.5, o.loop) : ''}
        <g transform="translate(${f(px)} ${f(py)})"><path class="map-pin" d="M0 0C-9-10-12-15-12-21a12 12 0 0 1 24 0C12-15 9-10 0 0z"/>${glyph}</g>
      </svg><span class="map-note">Sample map</span></div>`;
  }

  // What to draw for a place: its kind gives the pin glyph, and a run draws its loop.
  const GLYPH_OF = { gym: 'gym', run: 'run', study: 'study', work: 'work', yoga: 'yoga', art: 'art' };
  function mapFor(w, tall) {
    const v = w && w.venue;
    if (!v) return '';
    if (v.home) return v.errand ? `<p class="map-cap">${esc(v.errand.label || 'Supplies')}: <b>${esc(v.errand.name)}</b></p>${mapHTML(v.errand.name, v.errand.distance, { kind: v.errand.glyph, tall })}` : '';
    if (!v.distance) return '';
    return mapHTML(v.name, v.distance, { kind: GLYPH_OF[w.kind], tall, loop: w.kind === 'run' ? v.key && v.key[0] : null });
  }

  function whereHTML(w, compact, withMap) {
    if (!w) return '';
    const v = w.venue;
    const pin = '<svg class="ico pin" aria-hidden="true"><use href="#i-pin"/></svg>';
    if (compact) {
      const km = v.distance ? v.distance.split(',')[0] : '';
      return `<div class="where-wrap"><div class="where compact">${pin}<p><b>${esc(v.name)}</b>${km ? ` <span class="sub">${esc(km)}</span>` : ''}</p></div>${withMap ? mapFor(w) : ''}</div>`;
    }
    return `<div class="where-wrap"><div class="where">${pin}<div class="where-body">
      <p class="where-title"><b>${esc(v.name)}</b>${v.home ? '' : '<span class="nearest">Best match</span>'}</p>
      ${v.distance ? `<p class="where-sub">${esc(v.distance)}</p>` : ''}
      ${v.facts.length ? `<p class="where-facts">${esc(v.facts.join(', '))}</p>` : ''}
      <p class="where-why">${esc(v.reason)}</p>
    </div></div>${mapFor(w, true)}</div>`;
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
      </div></div>${mapFor(help.where, true)}` : '';
    const recipe = help.recipe ? `<p class="help-line"><b>${esc(help.recipe.name)}</b> <span class="sub">${help.recipe.mins} min, ${money(help.recipe.cost)}</span></p>` : '';
    const more = `${v ? `<p class="where-why">${esc(v.reason)}</p>` : ''}
      ${help.plan ? `<p class="help-plan">${esc(help.plan)}</p>` : ''}
      ${help.recipe ? recipeHTML(help.recipe) : ''}
      <div class="help-places">${help.places.slice(0, 2).map(placeHTML).join('')}</div>
      <p class="help-proof">Photo: ${esc(help.proof.replace(/^Photograph /, '').replace(/\.$/, ''))}</p>`;
    return `<div class="help-head"><h3 id="help-title">${esc(help.title)}</h3>${help.sample ? '<span class="sample-tag">Sample</span>' : ''}</div>
      ${best}${recipe}
      <div class="help-more">${more}</div>`;
  }

  /* ---------- follow-up questions for a custom task ---------- */
  // Each kind asks about itself, so a run is asked how far and a meal what it is. `mins` sets the time limit;
  // `add` is appended to the task name. A task we do not recognise gets a size question.
  const Q = (id, q, ...opts) => ({ id, q, options: opts.map(([label, mins, add]) => ({ label, mins, add })) });
  const ASKS = {
    gym:   [Q('focus', 'What are you training?', ['Legs', 90, 'legs'], ['Upper body', 75, 'upper body'], ['Full body', 90, 'full body'], ['Cardio', 45, 'cardio']),
            Q('time', 'How long?', ['30 min', 30], ['1 hour', 60], ['2 hours', 120])],
    run:   [Q('dist', 'How far?', ['3 km', 25, '3 km'], ['5 km', 35, '5 km'], ['10 km', 70, '10 km']),
            Q('pace', 'What pace?', ['Easy', null, 'easy'], ['Steady', null, 'steady'], ['Fast', null, 'fast'])],
    study: [Q('type', 'What kind?', ['Reading', 45, 'reading'], ['Practice problems', 60, 'practice'], ['Revision', 90, 'revision'], ['Writing', 60, 'writing']),
            Q('time', 'How long?', ['25 min', 25], ['1 hour', 60], ['2 hours', 120])],
    cook:  [Q('meal', 'What are you making?', ['Breakfast', 30, 'breakfast'], ['Lunch', 45, 'lunch'], ['Dinner', 60, 'dinner'], ['Meal prep', 120, 'meal prep']),
            Q('size', 'For how many?', ['Just me', null, 'for 1'], ['2 people', null, 'for 2'], ['A group', null, 'for a group'])],
    yoga:  [Q('style', 'Which style?', ['Gentle', 30, 'gentle'], ['Flow', 45, 'flow'], ['Stretch only', 20, 'stretch']),
            Q('time', 'How long?', ['20 min', 20], ['45 min', 45], ['1 hour', 60])],
    work:  [Q('output', 'What will be finished?', ['A draft', 90, 'draft'], ['Some code', 120, 'code'], ['Admin and email', 30, 'admin'], ['A plan', 30, 'plan']),
            Q('time', 'How long?', ['30 min', 30], ['1 hour', 60], ['2 hours', 120])],
    art:   [Q('medium', 'What will you make?', ['A drawing', 45, 'drawing'], ['A painting', 90, 'painting'], ['Music', 45, 'music'], ['Writing', 45, 'writing']),
            Q('time', 'How long?', ['30 min', 30], ['1 hour', 60], ['2 hours', 120])]
  };
  const HOME_ASKS = [Q('room', 'Which part?', ['One room', 45, 'one room'], ['Whole place', 120, 'whole place'], ['Just a surface', 15, 'one surface']),
                     Q('time', 'How long?', ['15 min', 15], ['30 min', 30], ['1 hour', 60])];
  const OTHER_ASKS = [Q('size', 'How big is it?', ['Quick', 30], ['A session', 90], ['Half a day', 240]),
                      Q('where', 'Where will you do it?', ['At home', null, 'at home'], ['Out and about', null, 'out'], ['At work', null, 'at work'])];

  function questionsFor(task) {
    const name = ((task && task.name) || '').trim();
    if (name.length < 3) return [];
    const kind = kindOf(task);
    return kind ? ASKS[kind] : HOME_RE.test(name) ? HOME_ASKS : OTHER_ASKS;
  }

  return { kindOf, load, whereFor, whereHTML, mapHTML, mapFor, fullHTML, setProvider, questionsFor };
})();
