---
name: backend-testing
description: Write and run backend tests — unit, integration with a real database, and API tests — with isolated data and deterministic fixtures. Use when adding tests for services, data access, or endpoints, or when a backend test is flaky or failing.
---

# Backend testing

## Before writing tests
1. Find the existing test setup: runner, directory layout, fixture/factory helpers, and how the database is started for tests. Follow it.
2. Find the test command(s) in the manifest or CI config and run the existing suite once to get a baseline. Report any pre-existing failures separately.

## Test layers
- **Unit:** pure business logic in the service layer. No network, no database. Fast. Mock only at true boundaries (external APIs, clock, randomness).
- **Integration:** data access and queries against a **real** database engine of the same type and version as production. Do not substitute a different engine (e.g. SQLite for PostgreSQL) for these tests.
- **API:** exercise the HTTP layer end to end through the app's test client, with the real validation, auth, and error mapping.

Test the behavior that matters: the boundary of validation, authorization denial, not-found, conflicts, and the happy path. Don't test framework internals.

## Isolation and determinism
- **Each test owns its data.** Use transactions rolled back at the end, or truncate/recreate between tests. Never depend on rows left by another test or by ordering.
- **Use factories/builders** for fixtures so each test states only what it cares about.
- **Control time and randomness.** Inject the clock; seed or fix random values; don't assert on wall-clock timestamps without tolerance.
- **No real external calls.** Stub outbound HTTP at the client boundary with a fake or recorded response.
- **No sleeps for synchronization.** Wait on a condition or use the library's async helpers.

## Writing a good test
- Name it by behavior: `returns 404 when the order belongs to another user`.
- Arrange / act / assert, one behavior per test.
- Assert on the outcome that matters (status, response shape, persisted state), not on incidental implementation calls.
- For bugs, write the failing test first, then fix.

## Flaky test triage
1. Run the single test repeatedly (e.g. 20×) to reproduce.
2. Look for shared state, ordering dependence, real time, unawaited async work, or unseeded randomness.
3. Fix the cause. Do not add retries or increase timeouts as the fix.

## Done checklist
- [ ] Tests at the right layer; integration tests use the production database engine
- [ ] Validation, authorization, not-found, and conflict cases covered where relevant
- [ ] Each test isolates its own data; order does not matter
- [ ] No real network calls; time and randomness controlled
- [ ] Full relevant test suite run; the actual pass/fail output reported
