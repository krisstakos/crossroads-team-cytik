---
name: database-schema
description: Design database schemas and write migrations — tables, keys, constraints, indexes, column changes, and zero-downtime rollout. Use when creating or altering tables, adding columns or indexes, writing migration files, or changing data models.
---

# Database schema and migrations

## Before changing anything
1. Find the migration tool and its directory (Prisma, Alembic, Flyway, Liquibase, golang-migrate, Knex, Rails, Diesel, etc.). Use that tool and its naming convention. Never hand-edit the database.
2. Read the most recent few migrations to learn the conventions (ID format, timestamps, naming, soft vs hard delete, `created_at`/`updated_at`).
3. Identify the database engine and version. Syntax and locking behavior differ (PostgreSQL, MySQL, SQLite).
4. Never edit a migration that has already been applied anywhere shared. Add a new one.

## Schema design rules
- **Primary keys** on every table, using the project's convention. Use a stable surrogate key; do not use mutable natural keys as PKs.
- **Foreign keys** with explicit `ON DELETE` behavior. Index the referencing column (most engines do not do this automatically).
- **NOT NULL by default.** Allow NULL only when absence is a real state. Add `CHECK` constraints for enums and ranges where the engine supports them.
- **Unique constraints in the database**, not only in application code. Application checks race.
- **Types:** use exact types for money (`NUMERIC`/`DECIMAL` or integer minor units, never float). Use timezone-aware timestamps (`timestamptz`/UTC). Use `text`/`varchar` with a length only when a real limit exists.
- **Timestamps:** include `created_at` and `updated_at` unless the table is append-only or the project says otherwise.
- **Don't store derived data** unless you have a measured reason. If you do, document how it is kept consistent.
- **Name things consistently** with the existing schema (snake_case, plural or singular — match what is there).

## Writing a migration
- **Keep migrations small and single-purpose.** One logical change per file.
- **Make it reversible** when possible: write the down/rollback step, and say so if it is not reversible (data-dropping steps).
- **Expand, migrate, contract** for breaking changes:
  1. Add the new column/table (nullable or with default), deploy code that writes both.
  2. Backfill in batches, not one giant `UPDATE`.
  3. Switch reads to the new column, then enforce NOT NULL / drop the old one in a later migration.
- **Avoid long locks on big tables.** On PostgreSQL, create indexes `CONCURRENTLY`; add columns with defaults in a way that does not rewrite the table (version-dependent — check). On MySQL, check whether the change is an online DDL.
- **Set lock/statement timeouts** for risky migrations so they fail fast instead of blocking traffic.
- **Don't mix schema and large data changes** in the same migration.

## Verification
- Run the migration up and down against a local or disposable database. Confirm the result with the engine's schema inspection (`\d table`, `DESCRIBE`, etc.).
- Run the test suite against the migrated schema.
- Report the actual commands run and their output. If you could not run them, say so.

## Done checklist
- [ ] Used the project's migration tool and naming convention
- [ ] Constraints, FK indexes, and NOT NULL decisions made explicitly
- [ ] Money and timestamps use correct types
- [ ] Rollback written or irreversibility stated
- [ ] Large-table changes checked for locking and backfilled in batches
- [ ] Applied up and down on a disposable database; output reported
