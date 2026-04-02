# DECISIONS.md — Architecture Decision Records

## ADR-001: SQLite via better-sqlite3 over Prisma/Knex
**Date**: 2026-03-30
**Status**: Accepted
**Context**: Need to replace Supabase with a local DB. Options: raw sqlite3 (async callback), better-sqlite3 (sync), Prisma (ORM + migration system), Knex (query builder).
**Decision**: Use `better-sqlite3` directly with hand-written SQL and a JS schema initializer.
**Rationale**: The existing codebase is small, the schema is simple (5 tables), and `better-sqlite3` is synchronous which eliminates callback/promise complexity in controllers. Avoids introducing a heavy ORM or migration toolchain for a project of this scale.
**Consequences**: Schema migrations are manual JS scripts; no auto-generated types.

## ADR-002: Integer primary keys (rowid alias) instead of UUIDs
**Date**: 2026-03-30
**Status**: Accepted
**Context**: Supabase schema used UUID primary keys. SQLite has no native UUID function without extensions.
**Decision**: Use `INTEGER PRIMARY KEY` (rowid alias) for all tables instead of UUIDs.
**Rationale**: SQLite's built-in auto-increment integer IDs are the idiomatic choice. The app is single-user-per-deployment; there is no need for globally unique IDs. Simplifies queries and removes uuid dependency.
**Consequences**: IDs in API responses will be integers, not UUID strings. Frontend must treat IDs as opaque values (it already does).

## ADR-003: Business profile stored in a settings table (single-row)
**Date**: 2026-03-30
**Status**: Accepted
**Context**: PDF invoices need a "From" sender section with business name, address, GSTIN. Currently no such data exists.
**Decision**: Add a `user_settings` table (one row per user) storing `business_name`, `business_address`, `gstin`, `phone`. Expose a `/auth/profile` GET+PUT endpoint.
**Rationale**: Keeps the data model clean and scoped to the user. A settings page in the frontend can let users fill it in once.

## ADR-004: UI redesign — light theme with Inter font
**Date**: 2026-03-30
**Status**: Accepted
**Context**: User wants a modern, premium light-theme UI (not dark/purple).
**Decision**: Redesign `index.css` with a curated light palette (#F8F9FC background, white surfaces, indigo/violet accent), Inter font from Google Fonts, smooth transitions, and status badge components.
