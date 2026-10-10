// Shot data for the two animatics. Times are seconds from the start of the film; `at` values are relative to the shot.
// Keep this in step with video/option-b-realistic.md.
const T = (t0, t1, o) => ({ t0, t1, ...o });
const L = (who, text, at) => ({ who, text, ...(at != null ? { at } : {}) });
const BANNER_FINAL = { title: 'Another round of leg day?', body: 'IronWorks Gym · $10 at stake', button: 'Absolutely' };

export const FILM_B = {
  id: 'b', file: 'option-b-starting-monday', label: 'Option B · Starting Monday', length: 120,
  scenes: [
    T(0, 4, { id: 1, act: 'Act 1 · Sunday', mood: 'night', slug: 'INT. APARTMENT — SUNDAY, 9:05 PM', action: 'A thumb scrolls gym ads. Pull back: ALEX is horizontal on the sofa.', lines: [L('ALEX', 'Tomorrow. Gym. Six a.m.', 1.2)] }),
    T(4, 14, { id: 2, act: 'Act 1 · Sunday', mood: 'night', slug: 'INT. APARTMENT', action: 'DANI eats cereal at the counter. Behind the door, a gym tote holds three jackets and a scarf.', lines: [L('DANI', 'You said that last Monday.', .5), L('ALEX', 'And I meant it last Monday.', 3.2), L('DANI', 'You’ve been starting Monday for three years. Monday’s filed a complaint.', 5.4)] }),
    T(14, 22, { id: 3, act: 'Act 1 · Sunday', mood: 'night', slug: 'INT. APARTMENT', action: 'Two-shot. Alex waves a membership email.', lines: [L('ALEX', 'I pay thirty-nine dollars a month for a gym I’ve visited twice. It knows my card better than my face.', .3), L('DANI', 'So make it cost something you can feel.', 5.4)] }),
    T(22, 30, { id: 4, act: 'Act 1 · Sunday', mood: 'night', slug: 'INSERT — MISSED', action: 'The Missed list in Commit.: money sent to a charity.', phones: [{ src: '18-history-missed.png', at: 0 }], lines: [L('ALEX', 'I’m a philanthropist.', 1.4), L('DANI', 'A reluctant one.', 3.2), L('ALEX', 'Somewhere a turtle is eating well because of me.', 4.6)] }),
    T(30, 36, { id: 5, act: 'Act 2 · The chat', mood: 'night', slug: 'INSERT — NEW TASK', action: 'He taps New task and sees the AI banner.', phones: [{ src: '02-new-task-help-link.png', at: 0, taps: [{ x: .5, y: .24, at: 3.4 }] }], lines: [L('ALEX', 'It’s a chatbot. It can’t judge me.', .6), L('DANI', 'I can.', 3.6)] }),
    T(36, 46, { id: 6, act: 'Act 2 · The chat', mood: 'night', slug: 'INSERT — THE AI CHAT', action: 'He picks “A bit stuck”. Out and about. An hour. More of what I do.', phones: [{ src: '03-chat-mood.png', at: 0 }, { src: '04-chat-place.png', at: 1.8 }, { src: '05-chat-time.png', at: 5.0 }, { src: '06-chat-build.png', at: 6.6 }], lines: [L('ALEX', 'It gets me.', 2.6), L('DANI', 'It’s known you for four seconds.', 3.8)] }),
    T(46, 55, { id: 7, act: 'Act 2 · The chat', mood: 'night', slug: 'INSERT — THE OFFER', action: 'The partner offer. He hovers over Claim offer, taps, presses Start. Chime. The R&B groove drops in.', phones: [{ src: '09-chat-partner-route.png', at: 0, taps: [{ x: .364, y: .603, at: 2.4 }] }, { src: '10-goal-prefilled.png', at: 3.2 }, { src: '12-today-goal-live.png', at: 5.2 }], sfx: [{ type: 'chime', at: 5.2 }, { type: 'groove-on', at: 5.2 }], lines: [L('ALEX', 'Free is my favourite price. Ten dollars at stake? That’s exactly what I’d miss.', .2), L('DANI', 'You’ve got an hour.', 5.6), L('ALEX', 'It’s Sunday night.', 6.8), L('DANI', 'The timer doesn’t know that.', 7.8)] }),
    T(55, 63, { id: 8, act: 'Act 3 · The gym', mood: 'night', slug: 'INT. APARTMENT', action: 'The scramble. He tears the tote off the door; jackets and a scarf rain down. Dani catches one without looking up.', lines: [L('ALEX', 'That’s been a coat hook since March.', 1.2), L('DANI', 'It’s gone to a good home.', 4.4)] }),
    T(63, 70, { id: 9, act: 'Act 3 · The gym', mood: 'gym', slug: 'EXT. NIGHT STREET → IRONWORKS GYM', action: 'Neon sign, Alex power-walking, the timer in his hand. Front desk.', lines: [L('DESK', 'First time?', .6), L('ALEX', 'In this building, yes.', 2.0), L('DESK', 'Code?', 3.4), L('ALEX', 'I-R-O-N, free, one.', 4.4)] }),
    T(70, 78, { id: 10, act: 'Act 3 · The gym', mood: 'gym', slug: 'INT. IRONWORKS GYM', action: 'A huge REGULAR mid-set. Alex gives the “I belong here” nod, then raises his phone at the dumbbell rack.', phones: [{ src: '13-proof-camera.png', at: 0 }], lines: [L('REGULAR', 'Are you photographing the dumbbells?', .8), L('ALEX', 'It’s for work.', 2.8), L('REGULAR', 'What do you do?', 4.0), L('ALEX', 'Accountability.', 5.2), L('REGULAR', '…Respect.', 6.6)] }),
    T(78, 85, { id: 11, act: 'Act 3 · The gym', mood: 'gym', slug: 'INSERT — VERIFIED', action: 'Verifying, then Verified 93%. Done, $10 kept.', phones: [{ src: '14-proof-verifying.png', at: 0 }, { src: '15-proof-verified.png', at: 1.6, taps: [{ x: .5, y: .908, at: 4.2 }] }, { src: '16-done.png', at: 4.6 }], sfx: [{ type: 'chime', at: 2.2 }], lines: [L('DANI (TEXT)', 'What’s the other 7%?', 2.8), L('ALEX (TYPING)', 'Sofa.', 4.2), L('REGULAR', 'I’ve got you.', 5.2), L('ALEX', 'It’s two kilos.', 5.9), L('REGULAR', 'Still got you.', 6.4)] }),
    T(85, 92, { id: 12, act: 'Act 4 · Monday', mood: 'dawn', slug: 'EXT. STREET — MONDAY, 6:00 AM', action: 'Blue dawn. Alex in his stride, the Commit. towel on his neck. His lock screen lights up.', banner: BANNER_FINAL, sfx: [{ type: 'chime', at: 1.0 }] }),
    T(92, 100, { id: 13, act: 'Act 4 · Monday', mood: 'dawn', slug: 'EXT. STREET — MONDAY, 6:00 AM', action: 'He taps. Above him a window opens: DANI, in a dressing gown.', lines: [L('DANI', 'It’s six a.m. You said Monday.', .6), L('ALEX', 'I started Sunday. Monday’s just catching up.', 3.0), L('DANI', '…That was good.', 5.4), L('ALEX', 'I’ve been practising.', 6.6)] }),
    T(100, 110, { id: 14, act: 'Act 4 · Monday', mood: 'dawn', slug: 'INSERT — HISTORY, CHARITY', action: 'Done 15, with the new win and its proof photo. Then Charity: you gave $10.', phones: [{ src: '17-history.png', at: 0 }, { src: '19-charity.png', at: 5.0 }], lines: [L('DANI', 'Fifteen.', 1.6), L('ALEX', 'And a turtle’s very disappointed.', 6.0)] }),
    T(110, 120, { id: 15, act: 'Act 5 · End card', mood: 'end', type: 'end', sfx: [{ type: 'chime', at: 2.4 }] })
  ]
};

// Every film in this file. The tools render and pack whatever is listed here.
export const FILMS = { b: FILM_B };

// Flatten sfx into absolute-time events for the renderer and the score.
export function eventsOf(film) {
  return film.scenes.flatMap(s => (s.sfx || []).map(e => ({ type: e.type, t: s.t0 + e.at }))).sort((a, b) => a.t - b.t);
}
