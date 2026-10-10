---
name: query-performance
description: Diagnose and fix slow database queries — read EXPLAIN plans, add or fix indexes, remove N+1 queries, and rewrite inefficient SQL or ORM calls. Use when a query, endpoint, or job is slow, or when writing a query over a large or growing table.
---

# Query performance

## Principle
Measure first. Do not add indexes or rewrite queries on a hunch. Get the actual query, the actual plan, and realistic data volume before changing anything.

## Steps
1. **Capture the query.** Get the exact SQL the application runs. For ORMs, enable query logging for the code path (or inspect the generated SQL) rather than guessing from the model code.
2. **Get the plan.** Run `EXPLAIN` (PostgreSQL: `EXPLAIN (ANALYZE, BUFFERS)` on a copy or non-destructive query; MySQL: `EXPLAIN ANALYZE` or `EXPLAIN FORMAT=JSON`). Use representative data. A plan on a 100-row dev table tells you little.
3. **Read the plan for these signals:**
   - Sequential/full table scan on a large table with a selective filter → likely missing index.
   - Large gap between estimated and actual rows → stale statistics (`ANALYZE`) or a bad estimate.
   - Sort or hash spilling to disk → increase work memory or reduce rows earlier.
   - Nested loop over large sets → missing join index or a join that should be restructured.
   - Index exists but is not used → check the predicate (function on column, type mismatch, leading-column order, `LIKE '%x'`, OR across columns).
4. **Fix the cause, the smallest way that works:**
   - **Index:** composite indexes follow the query: equality columns first, then range/sort columns. Consider covering indexes for hot read paths. Use partial indexes for common filters. Check write cost on heavy-write tables.
   - **N+1:** replace per-row queries with a join, a batch query (`WHERE id IN (...)`), or eager loading. Verify the query count dropped.
   - **Over-fetching:** select only needed columns; avoid `SELECT *` on wide tables in hot paths.
   - **Pagination:** replace large `OFFSET` with keyset pagination.
   - **Unbounded results:** add a `LIMIT` and a max page size.
   - **Caching:** only after the query itself is as good as it can be, and only with a defined invalidation rule.
5. **Verify.** Re-run `EXPLAIN` and time the query before and after with the same data. Confirm the index is actually used. Check the change does not regress write paths or other queries.

## Rules
- Adding an index to a big table in production must use an online/concurrent method (see the `database-schema` skill).
- Don't remove an index without checking that no query, constraint, or foreign key depends on it.
- Watch for `count(*)` on large tables in hot paths; consider approximate counts or maintained counters if exact counts are not required.
- Keep time zones, collations, and parameter types consistent across the query and the column, or the index may be skipped.

## Report format
- Query before (SQL + plan summary + timing)
- Root cause in one sentence
- Change made
- Query after (plan summary + timing), with the data size used
