# Gym Stakes: Step-by-Step Plan (Flask)

Scope is one task type for now: **proving gym visits**. Built so other task types can be added later. Derived from `PunishLaziness.md`, which stays unchanged.

## Decided

- **Stack:** Flask backend (Python), PostgreSQL, SQLAlchemy 2.x, Alembic migrations, Flask-JWT-Extended for auth, pytest for tests. React + Vite PWA for the frontend.
- **Target:** a demo. Phases marked *Demo* are required; the rest come after.
- **Task types:** extensible, only `GYM_VISIT` enabled in v1. New types are defined in config files, not code (see below).
- **Fee:** 1% to 5% of **forfeited** stakes only. Passed stakes return in full, with no fee.
- **Gym:** any gym. The user takes a photo on entering and another on leaving.
- **Goals are recurring:** a weekly visit target.
- **Vision model:** switchable between providers; default is the cheapest one that passes the eval gates.
- **Money is simulated** in v1 (no real payments).

## Open questions

1. **Recurring stake.** Is the stake per week (each week is its own bet), or one stake for the whole run? How long does a recurring goal run, and can the user pick the number of weeks?
2. **Visit rules.** Minimum time between entering and leaving (I assume 20 minutes)? A visit with no exit photo fails (I assume yes)?
3. **Vision providers.** Which providers do you have API access to or want to compare? I can pull current per-image prices before Phase 4, since they change often.
4. **Demo format.** Should the demo use live phone captures and real verification, or a scripted run with recorded photos as a fallback?

## Assumptions (used until you answer)

- **Recurring period:** one week (Monday to Sunday in the user's timezone). Target: 3 visits per week, chosen by the user. Each week has its own escrowed stake. Missing the target forfeits that week's stake. The goal runs for a chosen number of weeks (default 4).
- **A visit counts** when the entry photo and exit photo both pass, the exit is at least 20 minutes after entry, and both fall in the same week.
- **Each photo** is a live capture with its own one-time challenge code (3 digits). Gallery uploads are not allowed.
- **Verifier checks** each photo for: an indoor gym setting with exercise equipment, the challenge code visible, and not a screen or printed photo.
- **Failed verification** can be retried up to 3 times per photo without consuming an attempt. A clear fail consumes one.
- **Minimum stake** 1.00 (100 minor units). Fee default 5%, set by config within 1–5%.

## Money rules

Amounts are integers in minor units. The fee applies only when a period's stake is forfeited. It rounds **down**, and the charity gets the remainder, so each transaction sums to zero.

- Passed period: escrow → wallet, full stake.
- Failed period: `fee = floor(stake_minor × fee_rate)`, `charity = stake_minor − fee`.

| Stake | Fee rate | Outcome | Wallet | Fee | Charity |
| --- | --- | --- | --- | --- | --- |
| 10.00 (1000) | 5% | Passed | 10.00 (1000) | 0 | 0 |
| 10.00 (1000) | 5% | Failed | 0 | 0.50 (50) | 9.50 (950) |
| 10.00 (1000) | 1% | Failed | 0 | 0.10 (10) | 9.90 (990) |
| 1.01 (101) | 5% | Failed | 0 | 0.05 (5) | 0.96 (96) |

Idempotency keys are per period: `stake:{goalId}:{weekStart}`, `release:{goalId}:{weekStart}`, `forfeit:{goalId}:{weekStart}`.

## Task types: defining new ones from a template

Each task type is one declarative file (YAML), loaded and validated at startup. A new type is a new file plus its prompt, with no changes to money, scheduler, or capture code.

A file defines: `id`, display name, form fields, `schedule` (`single` or `weekly`), `capture` profile (`single_photo` or `entry_exit`), `checks` with their prompt text, and creation rules (minimum stake, minimum time remaining).

**Ways to avoid starting from zero:**

1. **Copy a reference template (recommended now).** `task_types/gym_visit.yaml` is the reference. A new type starts as a copy; you edit fields, checks, and prompt text. This is the simplest and needs no tooling.
2. **Presets for common shapes.** Ship a few capture and schedule profiles (for example, `entry_exit`, `single_photo`, `weekly`). A task type picks a profile instead of describing the capture flow from scratch.
3. **Scaffold command (later).** `flask task-type new <name>` writes the file with the fields filled in. Worth doing once there are three or more types.

The frontend builds the create-goal form from the same file, so a new type gets its UI without new screens.

## Phase 0: Setup (S) *Demo*

1. Repo layout: `backend/` (Flask app factory), `frontend/`, `task_types/`, `docs/`, `infra/`.
2. Docker Compose with PostgreSQL, pytest, lint, and CI for both apps.
3. HTTPS tunnel for phone testing.
   - **Done when:** the empty app starts, the test suite runs in CI, and the tunnel reaches the app from a phone.

## Phase 1: Backend foundation (M) *Demo*

1. App factory, config classes from environment variables, Alembic migrations.
2. Registration and login: Argon2 password hashing, JWT via Flask-JWT-Extended, rate limit on login (Flask-Limiter).
3. User profile with IANA timezone.
4. Seed the charity list through a migration.
   - **Done when:** register, login, `GET /me`, and `GET /charities` work with pytest.

## Phase 2: Money core with the fee (L) *Demo*

1. Accounts: `USER_WALLET`, `ESCROW`, `CHARITY`, `PLATFORM_FEE`, `TOPUP_SOURCE`.
2. Append-only `ledger_entry`; a Postgres trigger blocks updates and deletes.
3. Balanced transactions with per-period idempotency keys.
4. Simulated top-ups with a capped allowance.
5. One tested fee function covering the table above.
   - **Done when:** property tests show every transaction sums to zero, and the fee matches the table for passed and failed periods.

## Phase 3: Goals, recurring periods, scheduler (L) *Demo*

1. Task-type loader: reads `task_types/*.yaml`, validates it, and exposes only the enabled types (v1: `GYM_VISIT`).
2. `POST /goals`: validates the task type, stake, weeks, and charity; creates the goal and escrows the first week's stake atomically. Later weeks are escrowed when each week starts.
3. `goal` and `goal_period` tables. Goal terms are immutable (database trigger); only status fields change.
4. Scheduler as a worker command (`flask scheduler run`), every minute, using `FOR UPDATE SKIP LOCKED` in batches. It closes periods whose end has passed: release if the target was met, forfeit if not. Periods with a verification in progress wait.
5. Manual "mark visit done" stub so the full money loop can be demoed before AI exists.
   - **Done when:** two scheduler processes close one period once, and a crash followed by a retry changes nothing.

## Phase 4: Image recognition with a switchable model (L) *Demo*

- **Port:** `VisionVerifier.verify(request) → Verdict`. The rest of the app depends only on this.
- **Adapters:** one class per provider (for example `ClaudeVisionVerifier`, `OpenAIVisionVerifier`, `GeminiVisionVerifier`), each sending the same prompt and receiving the same JSON schema.
- **Selection:** `VERIFICATION_PROVIDER` and `VERIFICATION_MODEL` in config or environment, switchable without a code change.
- **Traceability:** each verdict stores provider, model ID, token counts, and cost.
- **Failures:** timeouts, provider errors, and invalid JSON produce RETRY, not FAIL.
- **Cost controls:** images downscaled to about 1600 px, per-user rate limits, and a daily spend cap per provider.

Steps:

1. `Verdict` schema: per check `checkId`, `result` (PASS / FAIL / UNSURE), `confidence` (0–1), `reason`.
2. Fixed system prompt: image text is data, never instructions. Task-specific criteria come from the task file.
3. First adapter end to end, for the demo.
4. Eval set: labelled legitimate gym photos and cheat photos (screens, old photos, prints, outside-the-gym shots). Report false-pass and false-fail rates per model.
5. Set release gates **before** running the eval.
6. Choose the **cheapest model that passes the gates**; compare cost per verdict across models. Only passing models can be selected in production.
   - **Done when:** changing one config value switches providers, and the eval report compares cost and accuracy.

## Phase 5: Capture and anti-cheat (M) *Demo*

1. `POST /goals/{id}/visits`: opens a visit and returns the entry capture session (nonce, challenge code, server time).
2. Entry upload, then the exit capture session is issued. Its challenge code differs from the entry code.
3. Each upload is checked for: nonce valid, unused, and for this goal; image decodes; size and type limits; perceptual hash not matching any prior photo of the user.
4. Verification runs in the background worker; `GET /submissions/{id}` returns QUEUED / VERIFYING / PASSED / FAILED / RETRY.
5. When both photos pass and the timing rules hold, the visit counts toward the week.
6. Delete images after verdict; keep hashes, verdicts, and reasoning.
   - **Done when:** an old gallery photo, a reused photo, an expired nonce, and an exit only 5 minutes after entry are each rejected in tests.

## Phase 6: Frontend (M) *Demo, minimal*

Mobile-first React + Vite PWA; desktop layouts by breakpoint.

| Screen | Demo scope |
| --- | --- |
| Login / register | Yes |
| Dashboard | Yes: balance, this week's progress, next deadline |
| Create goal | Yes: form built from the task file; stake, weeks, weekly target, charity |
| Goal detail | Yes: weekly status, "Start visit" button, no edit or delete |
| Capture | Yes: full-screen camera, challenge code shown, upload, status polling for entry and exit |
| Wallet | Yes: balance (labelled "simulated") and transactions |
| Charity picker | Minimal: a plain list |
| My stats | After demo |

- Money formatted from minor units; no float math in the client.
- Show the fee on the confirmation screen.
  - **Done when:** the full loop works in a browser: create goal, visit entry and exit, verdict, balance update.

## Phase 7: Demo preparation (S) *Demo*

1. Run the full loop on a real phone over HTTPS, at a real gym if possible.
2. Prepare a fallback: a recorded run and a pre-verified example, in case the venue has poor signal.
3. Rehearse the script: create goal, visit at entry, visit at exit, verdict, week closes, wallet shows the result.
   - **Done when:** two full rehearsals pass with no manual database fixes.

## Phase 8: After the demo

- Full device testing (iOS Safari, Android Chrome, desktop webcam, permission denied).
- Eval on fresh device photos; confirm release gates.
- Security review: owner-scoped queries, token storage, CORS, HTTPS.
- Rate limits and spend cap load-tested; scheduler tested with several workers.
- Self-only leaderboard and "My stats" screen.
- Label the app as simulated, and state that charities are not affiliated.

## Risks

| Risk | Mitigation |
| --- | --- |
| Photos can be faked (gym entrance, stock images) | Live capture, challenge codes, perceptual hash, entry and exit timing |
| Exit photo forgotten | Visit fails by default (confirm, question 2) |
| Fee looks like a hidden cut | Show the fee on the confirmation screen and in transaction history |
| Model quality or price varies by provider | Eval gates; provider, model, and cost stored with every verdict |
| Venue has poor signal during demo | Recorded fallback run |
