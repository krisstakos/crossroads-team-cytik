/* Commit — mock data (no backend). Seed state + AI detection tables. */
'use strict';

const MOCK = (function () {
  const EMOJIS = ['🏋️', '🍳', '💻', '🧹', '📚', '🏃', '🧘', '💊', '🎨', '🌿'];

  // What the (mock) AI "detects" in a photo, keyed by task icon.
  const DETECTIONS = {
    '🏋️': ['dumbbells', 'treadmill', 'workout gear'],
    '🍳': ['stovetop', 'fresh ingredients', 'kitchen counter'],
    '💻': ['laptop', 'code editor', 'workspace setup'],
    '🧹': ['clean surfaces', 'organized room', 'vacuum cleaner'],
    '📚': ['open books', 'notebook', 'desk lamp'],
    '🏃': ['running shoes', 'outdoor path', 'sportswear'],
    '🧘': ['yoga mat', 'calm indoor setting'],
    '💊': ['pill bottle', 'glass of water'],
    '🎨': ['canvas', 'paint brushes', 'easel'],
    '🌿': ['houseplants', 'watering can']
  };

  const NOTES_PASS = [
    'Natural lighting and consistent scene geometry.',
    'No signs of editing, screenshots or image reuse detected.',
    'Scene matches the expected context for this task.'
  ];
  const NOTES_FAIL = [
    'The captured scene does not clearly show the activity for this task.',
    'Low match between image content and task context. Try a clearer photo.'
  ];

  // Sample charities for the demo; none of them are real organisations.
  const charities = () => [
    { id: 'ocean', name: 'Ocean Cleanup Alliance', category: 'Environment', desc: 'Removing plastic from oceans and rivers worldwide.', raised: 1240, goal: 2000, impact: { per: 10, text: 'removes about 20 kg of plastic from rivers' } },
    { id: 'food',  name: 'Food for All',           category: 'Hunger',      desc: 'Serving hot meals to families facing hunger.',        raised: 865,  goal: 1500, impact: { per: 10, text: 'provides about 4 hot meals' } },
    { id: 'green', name: 'Green Earth Initiative', category: 'Environment', desc: 'Planting trees and restoring damaged habitats.',      raised: 530,  goal: 1000, impact: { per: 10, text: 'plants about 5 trees' } },
    { id: 'read',  name: 'Read Together',          category: 'Education',   desc: 'Putting books in the hands of children who have none.', raised: 410, goal: 800,  impact: { per: 10, text: 'buys about 3 children\'s books' } },
    { id: 'water', name: 'Clean Water Now',        category: 'Health',      desc: 'Building wells and filters for villages without safe water.', raised: 720, goal: 1200, impact: { per: 10, text: 'gives one person clean water for a year' } },
    { id: 'clinic', name: 'Health Bridge',         category: 'Health',      desc: 'Mobile clinics bringing basic care to remote areas.', raised: 300,  goal: 900,  impact: { per: 10, text: 'covers about 2 clinic visits' } }
  ];

  // A newly created account: some starting funds, no tasks, so the setup suggestions are what fills the screen.
  function freshState() {
    return {
      balance: 500, tickets: 0, totalSent: 0, defaultPenalty: 10, selectedCharityId: 'ocean', charities: charities(), tasks: [],
      activity: [{ icon: '💰', text: 'Account funded with $500.00', at: Date.now(), type: 'funds' }]
    };
  }

  // Past results so History and the charity totals have something to show.
  function history(now) {
    const H = 3600000, D = 86400000;
    const past = (id, name, icon, penalty, ago, status, charityId) => {
      const at = now - ago;
      const t = { id, name, icon, status, penalty, createdAt: at - 2 * H, durationMs: 2 * H, deadline: at };
      if (status === 'completed') t.completedAt = at - 25 * 60000;
      else { t.failedAt = at; t.charged = penalty; t.charityId = charityId; }
      return t;
    };
    return [
      past('h1', 'Stretch break',   EMOJIS[6], 5,  3 * H,        'completed'),
      past('h2', 'Morning run',     EMOJIS[5], 5,  1 * D + 2 * H, 'completed'),
      past('h3', 'Study session',   EMOJIS[4], 5,  2 * D + 5 * H, 'completed'),
      past('h4', 'Meal prep',       EMOJIS[1], 10, 3 * D + 1 * H, 'failed', 'ocean'),
      past('h5', 'Gym visit',       EMOJIS[0], 10, 4 * D + 4 * H, 'completed'),
      past('h6', 'Read 20 pages',   EMOJIS[4], 5,  5 * D + 6 * H, 'completed'),
      past('h7', 'Tidy the room',   EMOJIS[3], 5,  8 * D + 2 * H, 'failed', 'food'),
      past('h8', 'Cook dinner',     EMOJIS[1], 5,  9 * D + 3 * H, 'completed'),
      past('h9', 'Deep work block', EMOJIS[2], 10, 11 * D + 1 * H, 'completed')
    ];
  }

  function seedState() {
    const now = Date.now();
    return {
      tickets: 1,              // the demo account starts with one bail-out ticket
      balance: 235,            // prefilled mock account ($250 funded, $15 already sent to charity)
      totalSent: 15,           // total penalties sent to charity by this user
      defaultPenalty: 10,
      selectedCharityId: 'ocean',
      charities: charities(),
      tasks: [
        ...history(now),
        { id: 't1', name: 'Morning workout', icon: '🏋️', status: 'active', createdAt: now - 20 * 60000, durationMs: 45 * 60000, deadline: now + 25 * 60000, penalty: 10 },
        { id: 't2', name: 'Cook dinner', icon: '🍳', status: 'active', createdAt: now - 10 * 60000, durationMs: 2 * 3600000, deadline: now + 110 * 60000, penalty: 15 },
        { id: 't3', name: 'Work on my app', icon: '💻', status: 'active', createdAt: now - 30 * 60000, durationMs: 6 * 3600000, deadline: now + 330 * 60000, penalty: 20 },
        { id: 't4', name: 'Clean the home', icon: '🧹', status: 'active', createdAt: now - 5 * 60000, durationMs: 8 * 3600000, deadline: now + 475 * 60000, penalty: 12 }
      ],
      activity: [
        { icon: '💰', text: 'Account funded with $250.00', at: now - 90 * 60000, type: 'funds' },
        { icon: '✅', text: 'Completed "Stretch break" · verified 94% confidence', at: now - 180 * 60000, type: 'completed' }
      ]
    };
  }

  return { EMOJIS, DETECTIONS, NOTES_PASS, NOTES_FAIL, seedState, freshState, charities };
})();
