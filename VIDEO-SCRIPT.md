# Commit. ad: Option B, "Starting Monday" (realistic), 2:00

**Tagline:** *Put your money where your goals are.*
**The task on screen:** *Free visit at IronWorks Gym*, **$10** stake, one hour. It comes from the app's own AI chat.

This branch carries **Option B** only. The other story, Option A, is on branch `video-option-a-time-travel`; the shared rules, screens and tooling are the same on both.

| What | Where |
|---|---|
| **Screenplay** (what happens, scene by scene) | [`video/screenplays/option-b-starting-monday.md`](video/screenplays/option-b-starting-monday.md) |
| Shot table and joke bank | [`video/option-b-realistic.md`](video/option-b-realistic.md) |
| **Insert pack** (screens for the shoot) | [`video/inserts/option-b/`](video/inserts/option-b/) |
| **Animatic film** (mp4) | `video/films/option-b-starting-monday.mp4` |

Previous draft: `video/archive/VIDEO-SCRIPT-v1-where-you-started.md`.

## Shared rules

- **Alex is a man** (he/him). Nothing on screen may contradict that. The proof photo is a dumbbell rack with no person.
- **R&B score.** A smooth groove: mellow Rhodes keys, round bass, finger-snap backbeat, a little vocal chop. Confident and relaxed, never frantic. Use an original or licensed R&B-style cue, not an existing artist's song.
- **The chime.** One soft two-note tone, always the same, three times in each film. Each time it means "the app approved".
- **Dark UI only.** Every phone insert uses the dark theme. It reads better on camera than white, and the green accent matches the brand dot.
- **In-world branding (light):** the **Commit.** top bar on every in-app shot, the lock-screen banner, the towel over Alex's shoulder, the end card. No wristband, no corner bug.

## Screens (dark theme, `video/screens/dark/`)

**Finding a goal with the AI chat**

| File | Screen |
|---|---|
| `01-login.png` | Login with the **Commit.** wordmark (optional logo reveal) |
| `02-new-task-help-link.png` | New task sheet with the AI banner *"Want some help finding your next goal?"* |
| `03-chat-mood.png` | Chat opener, "How are you feeling right now?" |
| `04-chat-place.png` | "A bit stuck", answered with *"Small starting points work best when you feel stuck."* |
| `05-chat-time.png`, `06-chat-build.png` | Time and build-on questions |
| `07-chat-ideas.png` | Three tailored ideas |
| `08-chat-partner-offer.png` | IronWorks Gym partner card |
| `09-chat-partner-route.png` | Partner card with route, code and **Claim offer** (**hero screen**) |
| `10-goal-prefilled.png` | Goal filled in: *Free visit at IronWorks Gym* |
| `11-goal-created.png` | Goal created, code toast |

**Proof that a goal was done**

| File | Screen |
|---|---|
| `12-today-goal-live.png` | Today, the new goal counting down |
| `13-proof-camera.png` | Mock camera viewfinder, dumbbell rack |
| `14-proof-verifying.png` | The AI steps running |
| `15-proof-verified.png` | **Verified! 93%** (**hero screen**) |
| `16-done.png` | **Done, $10 kept** |

**Results**

| File | Screen |
|---|---|
| `17-history.png` | History, 14-day bars, the new win with its proof thumbnail |
| `18-history-missed.png` | Missed filter, money to Ocean Cleanup Alliance |
| `19-charity.png` | Charity, *You gave $10* |

## In-app copy (the real strings)

| Moment | Text |
|---|---|
| Help banner | Want some help finding your next goal? · Chat with our AI assistant |
| Chat opener | Good evening. 4 tasks running. Let's find one more. · How are you feeling right now? |
| Reply to "A bit stuck" | Happy to help. Small starting points work best when you feel stuck. |
| Chat questions | Where are you right now? · How much time can you spare? · Build on what you already do, or try something new? |
| Partner offer | PARTNER OFFER · IronWorks Gym · Try the gym once, on the house. · Free day pass · 1h · $10 · 0.5 km · Code IRON-FREE1 |
| New task | Free visit at IronWorks Gym · $10 |
| Claim toast | Show code IRON-FREE1 at IronWorks Gym |
| Verified | Scanning photo · Matching task · Checking for edits → Verified! This photo looks like genuine proof of your task. · Confidence 93% |
| Done | Done · $10 kept · **Continue** |
| Missed list | Meal prep · to Ocean Cleanup Alliance · -$10 *(real sample data)* |
| Lock-screen banners | *Props, not app screens:* "Another round of leg day?" · IronWorks Gym · $10 at stake · **Absolutely** |

## Fluid animation (motion spec)

The phone inserts should feel like one continuous, liquid interface, not slides.

| Moment | Motion |
|---|---|
| Phone enters frame | Spring ease (stiffness 220, damping 24), rises from below with about 12 px overshoot, 450 ms. Exits ease-in, 300 ms. |
| Tap | Green ripple 600 ms ease-out. The button presses to 96% scale over 90 ms. |
| Screen to screen | Shared-element slide, 350 ms `cubic-bezier(.2,.8,.2,1)`. Never a hard cut inside an insert. |
| Slow push | Every held insert drifts 3-5% closer over its length, so nothing is ever static. |
| Dialogue captions | Type on at 40 ms per character, fade out in 200 ms. |
| Countdown ring | Ticks smoothly, no steps. |
| Chime | A soft ring pulses from the phone, synced to the two notes. |
| Camera feel | Live action stays handheld with about 0.5 degrees of drift. |
| Delivery | Render at 30 fps. Capture real phone screen recordings at 60 fps for the final cut. |

## Tools, inserts and films

Everything lives in `video/` (see [`video/README.md`](video/README.md)). Nothing depends on files outside the repo.

```
cd video
npm run setup      # once: installs Playwright and its browser
npm run screens    # regenerates the 19 dark screens in video/screens/dark/
npm run inserts    # rebuilds the per-option insert packs in video/inserts/
npm run record     # records the app flow, video/clips/flow.webm
npm run films      # renders the animatic mp4 into video/films/ (needs ffmpeg and python3)
```

**What the films are:** animatics and a screen recording made from the real app. They show the scripted timing, dialogue captions, phone inserts and a synthesized placeholder R&B score. They are **not** live-action footage (no actors, no locations), and the music is a temporary stand-in.

## Avoid

- Mocking anyone's body, ability or fitness level. The joke is the lie, the sofa and the timer.
- Real charity logos. The in-app charities are sample names, so keep the turtle generic.
- Weight-loss claims. Say "start", not "lose".
- Real gym brands on screen. IronWorks Gym is a sample partner.

## Open items

1. "Ocean Cleanup Alliance" is close to a real organisation's name. Do you want a more generic name for the turtle gag?
2. R&B: do you want an original cue commissioned, or a licensed library track?
3. For 60 fps fluid inserts, someone needs to screen-record the app on a real phone, or I can build the motion in an animation tool from the stills.
