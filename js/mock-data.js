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

  function seedState() {
    const now = Date.now();
    return {
      balance: 250,            // prefilled mock account
      totalSent: 0,            // total penalties sent to charity by this user
      defaultPenalty: 10,
      selectedCharityId: 'ocean',
      charities: [
        { id: 'ocean', name: 'Ocean Cleanup Alliance', emoji: '🌊', desc: 'Removing plastic from oceans and rivers worldwide.', raised: 1240 },
        { id: 'food', name: 'Food for All', emoji: '🍲', desc: 'Serving hot meals to families facing hunger.', raised: 865 },
        { id: 'green', name: 'Green Earth Initiative', emoji: '🌱', desc: 'Planting trees and restoring damaged habitats.', raised: 530 }
      ],
      tasks: [
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

  return { EMOJIS, DETECTIONS, NOTES_PASS, NOTES_FAIL, seedState };
})();
