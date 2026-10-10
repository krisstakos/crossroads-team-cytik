# Goal Stakes App: Development Plan

Oct 10, 2026 · @Hawckc

## Overview and decisions

V1 is a responsive web app (PWA) where users stake simulated money on goals proven with a live photo; success returns the stake, failure donates it to a charity the user picked.

**Decided**

- Wallet is simulated (no real money in v1) but behaves like real money: free stake amount, integer minor units, escrow.
- A missed deadline forfeits the stake to the charity chosen at goal creation.
- Proof is a photo captured live in the browser; no gallery uploads.
- Deadline is the end of a chosen calendar day in the user's timezone; same-day goals are allowed if at least 60 minutes remain.
- Goals are immutable after creation. The only change is a status transition, including fulfilling early.
- Charities come from a seeded preset list of well-known organizations.
- Leaderboard is self only in v1 (donated total, goals fulfilled).
- Desktop dashboard also works well on mobile: create goals, finish them, update wallet details, pick a charity.

**Out of scope for v1:** real payments and KYC, global leaderboard, video or wearable proof, admin UI for charities.

## Architecture and stack

A modular Spring Boot monolith with one asynchronous worker path for AI verification keeps v1 simple and leaves clean seams for later extraction.

| Layer | Choice | Why |
| --- | --- | --- |
| Backend | Java 21, Spring Boot 3 | Matches existing skills; strong transactional support |
| Database | PostgreSQL | ACID ledger, `SKIP LOCKED` for the scheduler, triggers for immutability |
| Migrations | Flyway | Versioned schema plus charity seed data |
| Object storage | S3 or MinIO | Temporary photo storage, deleted after verdict |
| Async work | Postgres-backed job table (or Spring events + a worker pool) | Avoids adding a broker in v1 |
| AI | Vision LLM with structured JSON output | One call per submission, per-check verdicts |
| Frontend | React + Vite, PWA manifest, service worker | One responsive codebase for phone and desktop |
| Auth | Email + password or OAuth, JWT session | Needed to own wallets and goals |
| Hosting | Any HTTPS host | Browsers only expose the camera in a secure context |

**Modules:** `identity`, `wallet` (ledger), `goals`, `charities`, `verification` (capture sessions, AI pipeline), `leaderboard`, `scheduler`. Modules talk through service interfaces, never through each other's tables.

## Data model

Money lives only in an append-only double-entry ledger; balances are always derived, and every amount is an integer in minor units with a currency code.

| Table | Key columns | Notes |
| --- | --- | --- |
| `user` | id, email, password\_hash, timezone | Timezone is an IANA ID, e.g. Europe/Sofia |
| `account` | id, owner\_type, owner\_id, kind | Kinds: USER\_WALLET, ESCROW, CHARITY, TOPUP\_SOURCE |
| `ledger_entry` | id, txn\_id, account\_id, amount\_minor, currency, idempotency\_key, created\_at | Each txn sums to zero; never updated or deleted |
| `charity` | id, slug, name, category, short\_description, website\_url, active | Seeded by Flyway |
| `goal` | id, user\_id, title, description, stake\_minor, currency, charity\_id, deadline\_at, timezone, checks\_json, status, template\_id | Immutable except `status` and `resolved_at` |
| `capture_session` | id, goal\_id, nonce, challenge\_code, issued\_at, expires\_at, used\_at | One-time, short-lived |
| `submission` | id, goal\_id, capture\_session\_id, image\_key, phash, status, verdict\_json, attempt\_no | Image deleted after verdict; hash and verdict kept |
| `goal_template` | id, name, checks\_json, default\_attempts | e.g. Gym visit |

**Enforcement in the database**

- A trigger on `goal` rejects any update that changes a column other than `status` and `resolved_at`, and rejects deletes.
- A trigger on `ledger_entry` rejects updates and deletes.
- `UNIQUE(idempotency_key)` on `ledger_entry` makes stake, refund and forfeit operations safe to retry.
- `UNIQUE(goal_id, attempt_no)` on `submission` with a cap check (assumed 3 attempts).
- Leaderboard figures are derived from `goal` and `ledger_entry`, not stored counters.

## Goal lifecycle, escrow and scheduler

A goal moves through three states, each transition is one database transaction, and every money movement is a balanced ledger transaction with an idempotency key.

| Event | Status change | Ledger transaction | Idempotency key |
| --- | --- | --- | --- |
| Goal created | none → ACTIVE | Wallet → Escrow (stake) | `stake:{goalId}` |
| Verification passes (any time before deadline) | ACTIVE → FULFILLED | Escrow → Wallet (stake returned) | `release:{goalId}` |
| Deadline passes with no passing submission | ACTIVE → FORFEITED | Escrow → Charity account (stake) | `forfeit:{goalId}` |
| Wallet top-up | n/a | Top-up source → Wallet | client-supplied |

**Creation rules (server-validated)**

- Stake is greater than the minimum (assumed 1.00) and not above the available balance.
- Deadline date is today or later in the user's timezone, with at least 60 minutes remaining, stored as UTC plus the timezone ID.
- Charity must exist and be active; template and feasibility check must have passed.

**Deadline scheduler**

1. Every minute, select `ACTIVE` goals with `deadline_at < now()` using `FOR UPDATE SKIP LOCKED`, in small batches, so several instances never process the same goal.
2. Skip goals that have a submission in `VERIFYING`; they are re-checked when the verdict lands.
3. Forfeit with the idempotency key above; a retry after a crash is a no-op.

**Boundary rule:** a submission counts if the server received the upload before the deadline, even if the AI verdict arrives afterward.

**Top-ups:** a capped allowance (daily or lifetime, to be set) so the donated total on the leaderboard stays meaningful. The UI labels all funds as simulated.

## AI verification and goal creation

The pipeline splits into a creation-time half (define and freeze the checks) and a submission-time half (run them), so checks cannot be tuned after a failed attempt.

**At goal creation**

1. **Path choice:** the user picks a predefined template, free text, or the AI interview.
2. **Interview (optional):** a multi-turn LLM conversation that narrows a vague aim into one verifiable, time-bounded goal and returns a draft for the user to confirm.
3. **Feasibility validation:** the LLM scores whether the goal is achievable by the deadline and provable by a photo; vague goals like 'be happier' are rejected with a reason.
4. **Check generation:** the LLM produces a list of checks specific to this goal (unique tasks get unique checks), stored as `checks_json` and frozen with the goal. Templates ship with fixed checks instead.

**At submission**

1. **Structure checks (no AI):** valid capture session, one-time nonce unused, server receipt time inside the window, image decodes, and not a duplicate of any prior submission (perceptual hash).
2. **AI verification:** one vision call with the goal text, the frozen checks and the challenge code; the model returns structured JSON.
3. **Decision:** all required checks pass at or above the confidence threshold means FULFILLED; a clear fail consumes an attempt; low confidence allows a bounded retry without consuming one.
4. **Cleanup:** the image is deleted; hash, verdict and reasoning are kept for audit and appeals.

**Verdict contract, per check:** `checkId`, `result` (PASS, FAIL or UNSURE), `confidence` (0 to 1), and a short `reason`.

**Controls:** text inside the image is treated as data, never as instructions (prompt-injection guard); the model must return schema-valid JSON or the call is retried; every call is logged with a cost counter and a per-user rate limit.

## Camera capture and anti-cheat

The site must open on any camera-capable device, so capture happens in the browser with live video only, and freshness is proven by the server, not by the image.

**Capture flow**

1. Client requests a capture session for a goal; the server records the time and returns a one-time nonce and a random challenge code (3 digits).
2. The page opens the camera with `getUserMedia` (HTTPS required, user tap to start, `playsinline` for iOS Safari) and shows the code to include in the shot.
3. On tap, the frame is drawn to a canvas, downscaled to about 1600 px on the long edge and encoded as JPEG at quality 0.8.
4. The upload carries the nonce; the server rejects it if the session is expired (assumed 10 minutes), already used, or for another goal.

**Why not a file input:** `capture` on a file input is only a hint, and gallery choice stays available on some devices, which defeats the freshness guarantee.

**Consequence:** canvas capture drops EXIF, so the 'taken today' check relies on the server-side session time, not on metadata.

| Threat | Mitigation |
| --- | --- |
| Old or gallery photo | Live capture only, session time window, challenge code in frame |
| Same photo reused | Perceptual hash against all prior submissions |
| Photo of a screen or print | Vision check for moiré, bezel and glare cues, plus the challenge code |
| Quick drive-by (gym entrance shot) | Template can require two captures at least 20 minutes apart |
| Location faking | Optional geolocation as a low-weight signal only |
| Strangers in photos | Image deleted after verdict; notice shown on the capture screen |

**Fallbacks:** clear messages for denied permission or no camera; desktop webcams work through the same flow.

## API contracts

REST over JSON under `/api/v1`, authenticated with a bearer token; every state-changing money call requires an `Idempotency-Key` header.

| Method and path | Purpose | Key rules |
| --- | --- | --- |
| `POST /auth/register`, `/auth/login` | Account and session | Rate limited |
| `GET /me` | Profile, timezone, wallet balance | Balance derived from ledger |
| `POST /wallet/topups` | Add simulated funds | Capped allowance; idempotent |
| `GET /wallet/transactions` | Ledger history | Paged, newest first |
| `GET /charities` | Preset charity list | Active only |
| `GET /templates` | Predefined goal templates | Includes fixed checks |
| `POST /goals/interview` | One turn of the AI interview | Returns next question or a draft goal |
| `POST /goals/validate` | Feasibility score and generated checks | Does not move money |
| `POST /goals` | Create goal and escrow stake | Atomic; 422 on failed validation or low balance |
| `GET /goals`, `GET /goals/{id}` | List and detail | No PUT, PATCH or DELETE exists |
| `POST /goals/{id}/capture-sessions` | Start capture; get nonce and code | Only for ACTIVE goals |
| `POST /goals/{id}/submissions` | Upload photo with nonce | Returns 202 with a submission id |
| `GET /submissions/{id}` | Poll verdict | Status: QUEUED, VERIFYING, PASSED, FAILED, RETRY |
| `POST /goals/{id}/fulfill` | Early fulfilment | Only after a PASSED submission; idempotent |
| `GET /leaderboard/me` | Donated total, goals fulfilled, success rate | Derived from ledger and goals |

**Errors** use a single shape: `code`, `message`, and `details`. Money errors use stable codes such as `INSUFFICIENT_FUNDS`, `DEADLINE_TOO_SOON`, `ATTEMPTS_EXHAUSTED`, `CAPTURE_SESSION_EXPIRED`.

## Frontend: dashboard, mobile and PWA

One mobile-first React app serves both the phone capture flow and the desktop dashboard; layouts adapt by breakpoint rather than shipping two apps.

| Screen | What the user does | Mobile note |
| --- | --- | --- |
| Dashboard | See balance, active goals, deadlines, quick stats | Cards stack; balance pinned at top |
| Wallet | View drawn balance, transactions, top up simulated funds | Balance drawn as an animated gauge or coin stack; label 'simulated' |
| Create goal | Pick template, free text or interview; set stake, deadline, charity | Stepper, one decision per screen |
| Charity picker | Choose from the preset list | Searchable cards, category filter |
| Goal detail | Status, checks, attempts left, countdown, finish early | Primary action: Capture proof |
| Capture | Live camera, challenge code, retake, submit | Full-screen, thumb-reachable shutter |
| My stats | Donated total, goals fulfilled, success rate | Self leaderboard only |

**Rules in the UI**

- After creation the goal screen has no edit or delete controls, and the creation form shows a clear 'cannot be changed' confirmation before submit.
- Money is formatted from minor units with the currency code; the client never does float arithmetic on amounts.
- PWA: web manifest and service worker for install-to-home-screen; the camera still requires online HTTPS, so offline mode only shows cached read-only views.
- Test on real iOS Safari and Android Chrome, plus a desktop webcam.

## Security, privacy and abuse

The highest-impact risks are ledger integrity, photo privacy, and users gaming verification or top-ups.

| Area | Control |
| --- | --- |
| Authentication | Hashed passwords (Argon2 or bcrypt), short-lived JWT plus refresh, login rate limits |
| Authorization | Every goal, submission and wallet query is scoped to the owner; no ID-guessable access |
| Ledger integrity | Append-only triggers, balanced transactions, idempotency keys, serializable or row-locked balance checks on escrow |
| Input validation | Server-side validation of amounts, dates, charity IDs; image type, size and decode checks |
| Photo privacy | Private bucket, signed URLs, deletion after verdict, no public image access, on-screen notice about bystanders |
| Prompt injection | Image text treated as data; fixed system prompt; schema-validated output; no tool access for the verifying model |
| Abuse | Per-user rate limits on uploads, interviews and top-ups; attempt cap per goal; cost ceilings on LLM calls |
| Transport | HTTPS everywhere, HSTS, strict CORS, secure cookies if cookies are used |
| Dependencies | Pinned versions, automated vulnerability scanning in CI |
| Auditability | Verdicts, reasons and ledger history retained; a manual review queue for appeals |

**Honest labelling:** the app states that funds and donations are simulated and that listed charities are not affiliated; only names and text are used, no logos.

## Phases and task breakdown

Five phases, ordered so the money core exists before the AI, and a manual-verify stub lets the whole loop be demoed early; sizes are relative (S, M, L), not dates.

**Phase 1: Foundation (M)**

- [ ] Repo, CI, Spring Boot skeleton, Postgres, Flyway
- [ ] Auth and user profile with timezone
- [ ] HTTPS dev setup (tunnel) for phone testing
- [ ] Charity table and seed migration

**Phase 2: Money core (L)**

- [ ] Accounts and double-entry ledger with immutability triggers
- [ ] Simulated top-ups with allowance cap
- [ ] Goal creation with validation and atomic stake escrow
- [ ] Goal immutability trigger and status transitions
- [ ] Deadline scheduler with `SKIP LOCKED` and idempotent forfeit
- [ ] Manual 'mark fulfilled' stub to demo the loop

**Phase 3: Capture and AI verification (L)**

- [ ] Capture session and nonce endpoints
- [ ] Browser camera component (`getUserMedia`, compression, upload)
- [ ] Structure checks and perceptual-hash duplicate detection
- [ ] Vision LLM verification with structured output and retry rules
- [ ] Attempt cap, async status polling, image deletion, audit log

**Phase 4: Goal creation AI and templates (M)**

- [ ] Feasibility validation endpoint
- [ ] Per-goal check generation, frozen at creation
- [ ] Gym visit template with the two-capture option
- [ ] AI interview flow that outputs a draft goal

**Phase 5: Dashboard, polish and hardening (M)**

- [ ] Dashboard, wallet drawing, charity picker, goal detail
- [ ] Self leaderboard from ledger and goals
- [ ] PWA manifest and service worker; real-device mobile testing
- [ ] Rate limits, LLM cost caps, security review, load test of the scheduler

**Hackathon cut:** phases 1 to 3 plus the Gym visit template and a minimal dashboard form a complete demo; the interview and polish can follow.

## Testing strategy

Test money and state transitions hardest, the AI against a labelled photo set, and the camera on real devices.

| Area | Test type | Cases |
| --- | --- | --- |
| Ledger | Unit and property tests | Every transaction sums to zero; balance equals sum of entries; updates and deletes are rejected |
| Goal creation | Integration (Testcontainers Postgres) | Happy path; insufficient funds; deadline too soon; unknown charity; double submit with the same idempotency key |
| Immutability | Integration | Direct SQL update of stake or deadline fails; only status changes |
| Scheduler | Integration and concurrency | Two instances, one forfeit; crash and retry is a no-op; deadline boundary with in-flight verification |
| Capture | Unit and integration | Expired, reused and wrong-goal nonces rejected; duplicate image detected |
| AI verification | Offline eval set | Labelled legit and cheat photos (screens, old photos, entrance-only); track false pass and false fail rates before launch |
| Prompt injection | Adversarial cases | Images containing instruction text must not change the verdict |
| Frontend | Component and end-to-end | Create goal, capture, fulfil; no edit controls after creation |
| Devices | Manual | iOS Safari, Android Chrome, desktop webcam, permission denied path |

The AI pass rate on legitimate photos and the cheat catch rate are the two release gates; decide the thresholds before running the eval set.

## Risks and open questions

The largest risk is that a single photo is weak proof, so verification quality, not infrastructure, decides whether the app feels fair.

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Cheating with screens, old photos or drive-by shots | High | Live capture, challenge code, pHash, multi-capture templates |
| False fails on honest users cause distrust | Medium | Confidence threshold, bounded retries, appeal queue |
| LLM cost and latency | Medium | Async verification, image downscaling, rate limits, cost caps |
| Deadline boundary disputes | Medium | Receipt-time rule and skipping goals with in-flight verification |
| Unlimited fake top-ups make rankings meaningless | Medium | Capped allowance; rank on fulfilment rate as well as donated total |
| Bystander privacy in photos | Medium | Delete after verdict, on-screen notice |
| iOS camera quirks | Medium | Real-device testing early in phase 3 |

**Assumptions to confirm**

- [ ] Attempts per goal capped at 3
- [ ] Minimum stake of 1.00 and 60 minutes minimum remaining for same-day goals
- [ ] Top-up allowance size (daily or lifetime)
- [ ] Capture session window of 10 minutes
- [ ] Timeline: hackathon-sized MVP covering phases 1 to 3
- [ ] Login method: email and password, or OAuth
- [ ] Whether to add the challenge code in v1 or defer it

**Deferred beyond v1:** real payments and KYC, global leaderboard (opt-in, pseudonymous), video or wearable proof, admin UI for charities, appeals workflow beyond a manual queue.
