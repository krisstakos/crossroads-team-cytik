// Shot data for the two animatics. Times are seconds from the start of the film; `at` values are relative to the shot.
// Keep this in step with video/option-a-time-travel.md.
const T = (t0, t1, o) => ({ t0, t1, ...o });
const L = (who, text, at) => ({ who, text, ...(at != null ? { at } : {}) });
const BANNER_FINAL = { title: 'Another round of leg day?', body: 'IronWorks Gym · $10 at stake', button: 'Absolutely' };

export const FILM_A = {
  id: 'a', file: 'option-a-where-you-started', label: 'Option A · Where You Started', length: 120,
  scenes: [
    T(0, 5, { id: 1, act: 'Act 1 · Present', mood: 'warm', slug: 'EXT. PARK — GOLDEN HOUR', action: 'Low tracking shot: bright shoes on a park path, long golden shadows.', sfx: [{ type: 'groove-on', at: 0 }] }),
    T(5, 11, { id: 2, act: 'Act 1 · Present', mood: 'warm', slug: 'EXT. PARK — GOLDEN HOUR', action: 'ALEX in profile, easy stride. A scuffed Commit. sticker on his water bottle. A two-finger salute to a passing runner.', lines: [L('ALEX', 'Not bad for a guy who used to do cardio by looking for the remote.', 1.2)] }),
    T(11, 15, { id: 3, act: 'Act 1 · Present', mood: 'warm', slug: 'EXT. PARK', action: 'His phone buzzes in the armband. He slows to a walk, a little too dramatically.', sfx: [{ type: 'chime', at: 1.6 }, { type: 'groove-off', at: 1.8 }] }),
    T(15, 22, { id: 4, act: 'Act 2 · Notification', mood: 'warm', slug: 'LOCK SCREEN', action: 'The Commit. banner on his lock screen.', banner: { title: 'Do you remember where you started?', body: 'Your first task: “Free visit at IronWorks Gym” · 3 years ago · $10 at stake' } }),
    T(22, 28, { id: 5, act: 'Act 2 · Notification', mood: ['warm', 'cold'], slug: 'CLOSE-UP — ALEX', action: '“Oh no” eyebrows, then a curious smile. He taps it. Zoom through the glass; the grade turns cold.', banner: { title: 'Do you remember where you started?', body: 'Your first task: “Free visit at IronWorks Gym” · 3 years ago' }, fx: 'zoomOut', sfx: [{ type: 'vwoop', at: 2.2 }] }),
    T(28, 38, { id: 6, act: 'Act 3 · The past', mood: 'cold', slug: 'INT. APARTMENT — 3 YEARS AGO, 9:05 PM', action: 'The same sofa. PAST ALEX in a baggy hoodie. Present Alex stands beside him, still lit gold.', enter: 'emerge', lines: [L('ALEX (THEN)', 'Tomorrow. Gym. Six a.m.', .8), L('ALEX (NOW)', '…Six a.m.', 2.2), L('DANI', 'You said that last Monday.', 3.4), L('ALEX (THEN)', 'And I meant it last Monday.', 5.0), L('ALEX (NOW)', 'He did mean it. That’s the worst part.', 6.8)] }),
    T(38, 46, { id: 7, act: 'Act 3 · The past', mood: 'cold', slug: 'INT. APARTMENT', action: 'Two-shot. Past Alex waves a membership email. Dani leans on the counter.', lines: [L('ALEX (THEN)', 'I pay thirty-nine dollars a month for a gym I’ve visited twice.', .3), L('DANI', 'So make it cost something you can feel.', 3.0), L('ALEX (NOW)', 'Dani’s right. Dani is always right. It’s exhausting.', 5.0)] }),
    T(46, 56, { id: 8, act: 'Act 3 · The past', mood: 'cold', slug: 'INT. APARTMENT — THE AI CHAT', action: 'He taps the AI banner and picks “A bit stuck”. Present Alex reaches for the screen; his hand passes through.', phones: [{ src: '02-new-task-help-link.png', at: 0, taps: [{ x: .5, y: .24, at: 1.0 }] }, { src: '04-chat-place.png', at: 2.6 }], lines: [L('ALEX (THEN)', 'It gets me.', 3.4), L('DANI', 'It’s known you for four seconds.', 5.0), L('ALEX (NOW)', 'Not “At home”. Never “At home”.', 6.6), L('ALEX (NOW)', '…Thank you.', 8.6)] }),
    T(56, 64, { id: 9, act: 'Act 3 · The past', mood: 'cold', slug: 'INT. APARTMENT — THE OFFER', action: 'The partner offer, then the prefilled task. He presses Start. A ding, and the groove returns.', phones: [{ src: '09-chat-partner-route.png', at: 0, taps: [{ x: .364, y: .603, at: 2.0 }] }, { src: '10-goal-prefilled.png', at: 2.8 }, { src: '12-today-goal-live.png', at: 5.0 }], sfx: [{ type: 'groove-on', at: 5.0 }, { type: 'ding', at: 5.0 }], lines: [L('ALEX (THEN)', 'Free is my favourite price.', .3), L('DANI', 'You’ve got an hour.', 5.2), L('DANI', 'The timer doesn’t know it’s Sunday.', 6.4)] }),
    T(64, 72, { id: 10, act: 'Act 3 · The past', mood: ['cold', 'night'], slug: 'INT. APARTMENT', action: 'He tears the tote off the door. Jackets rain down. Dani catches one without looking up.', lines: [L('ALEX (THEN)', 'That’s been a coat hook since March.', 1.2), L('DANI', 'It’s gone to a good home.', 4.2)] }),
    T(72, 82, { id: 11, act: 'Act 3 · The past', mood: 'gym', slug: 'INT. IRONWORKS GYM — NIGHT', action: 'A huge REGULAR mid-set. Past Alex raises his phone at the dumbbell rack. Present Alex covers his eyes.', phones: [{ src: '13-proof-camera.png', at: 0 }], lines: [L('REGULAR', 'Are you photographing the dumbbells?', .8), L('ALEX (THEN)', 'It’s for work.', 3.0), L('REGULAR', 'What do you do?', 4.4), L('ALEX (THEN)', 'Accountability.', 5.8), L('ALEX (NOW)', 'I still say that. I still say that.', 7.4)] }),
    T(82, 88, { id: 12, act: 'Act 4 · Snap back', mood: 'gym', slug: 'INSERT — VERIFIED', action: 'The same chime that rings in the room pulls him forward. Whip-pan.', phones: [{ src: '15-proof-verified.png', at: 0 }], fx: 'whipOut', sfx: [{ type: 'chime', at: 1.4 }] }),
    T(88, 94, { id: 13, act: 'Act 4 · Snap back', mood: 'warm', slug: 'EXT. PARK — GOLDEN HOUR', action: 'Present again, still holding his phone. He looks down at his legs and pats them, impressed.', enter: 'whip', lines: [L('ALEX', 'Sofa. Still the best seven percent.', 2.4)] }),
    T(94, 100, { id: 14, act: 'Act 4 · Snap back', mood: 'warm', slug: 'INSERT — HISTORY, CHARITY', action: 'Done 15, the first win at the bottom. Then Charity: you gave $10.', phones: [{ src: '17-history.png', at: 0 }, { src: '19-charity.png', at: 3.0 }], sfx: [{ type: 'groove-on', at: 0 }], lines: [L('ALEX', 'I funded a turtle, and I became this.', 3.4)] }),
    T(100, 106, { id: 15, act: 'Act 5 · New challenge', mood: 'warm', slug: 'LOCK SCREEN', action: 'His phone buzzes again.', banner: BANNER_FINAL, sfx: [{ type: 'chime', at: .8 }] }),
    T(106, 112, { id: 16, act: 'Act 5 · New challenge', mood: 'gym', slug: 'INT. IRONWORKS GYM', action: 'Match cut: his running feet become feet stepping onto the gym floor. The Commit. towel on his shoulder.', lines: [L('REGULAR', 'Welcome back.', .5), L('ALEX', 'I’ve never been here.', 1.9), L('REGULAR', 'You were here three years ago. Photographing the dumbbells.', 3.2)] }),
    T(112, 120, { id: 17, act: 'Act 5 · End card', mood: 'end', type: 'end', sfx: [{ type: 'chime', at: 2.4 }] })
  ]
};

// Every film in this file. The tools render and pack whatever is listed here.
export const FILMS = { a: FILM_A };

// Flatten sfx into absolute-time events for the renderer and the score.
export function eventsOf(film) {
  return film.scenes.flatMap(s => (s.sfx || []).map(e => ({ type: e.type, t: s.t0 + e.at }))).sort((a, b) => a.t - b.t);
}
