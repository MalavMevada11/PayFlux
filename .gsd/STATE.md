# STATE.md — Project Memory

> **Project**: PayFlux Invoice Generator
> **Initialized**: 2026-03-30
> **Current Phase**: Phase 1 — SQLite Migration (Not Started)

## Tech Stack
- **Backend**: Node.js + Express, `better-sqlite3`, bcrypt, jsonwebtoken, puppeteer
- **Frontend**: React 18 + Vite, react-router-dom v6, Vanilla CSS
- **DB**: SQLite (file: `backend/payflux.db`)
- **Auth**: JWT (7d expiry), bcrypt (10 rounds)

## Key Paths
- Backend entry: `backend/server.js`
- DB client: `backend/db.js` (new — replaces supabaseClient.js)
- Schema init: `backend/schema.js` (new — auto-runs on startup)
- Frontend entry: `frontend/src/main.jsx`
- API client: `frontend/src/api.js`

## Active Decisions
- See `.gsd/DECISIONS.md` for all ADRs
- Primary keys: INTEGER (not UUID)
- No ORM — plain SQL via better-sqlite3
- Business profile: `user_settings` table, `/auth/profile` endpoint

## Blockers
_None_
