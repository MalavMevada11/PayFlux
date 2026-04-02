# SPEC.md — PayFlux Invoice Generator

> **Status**: `FINALIZED`

## Vision
PayFlux is a self-hosted, multi-tenant invoice generator for Indian freelancers and small businesses. It replaces a cloud-dependent Supabase backend with a fast local SQLite database, adds a richer invoice lifecycle (draft → sent → paid/overdue), generates professional PDF invoices with INR formatting and complete business branding, and delivers a premium, modern light-theme UI that feels lightweight and responsive.

## Goals
1. **Replace Supabase with SQLite** — eliminate cloud latency and external dependencies; use `better-sqlite3` for synchronous, zero-config local storage.
2. **Expand invoice statuses** — support `draft`, `sent`, `paid`, and `overdue`, with visual status badges in the UI.
3. **Premium PDF invoices** — redesigned PDF template with a "From" (sender) business section, proper bordered tables for line items, INR (₹) currency formatting.
4. **Redesigned UI (light theme)** — modern, aesthetic, premium light-theme UI with Inter font, smooth micro-animations, clean card layouts, and status badge components. Add an Invoice Detail/View page.
5. **Self-contained** — no cloud services required; runs entirely on `localhost`.

## Non-Goals (Out of Scope)
- Email sending / automated invoice delivery
- Multi-currency support (INR only for now)
- Payment gateway integration
- Mobile app
- Role-based permissions (single user per account)
- GST/tax calculation (not in this version)

## Users
Indian freelancers and small business owners who need a fast, local invoice management tool. They manage their own clients (customers), maintain a catalog of goods/services (items), and generate PDF invoices to send manually.

## Constraints
- **Tech stack**: Node.js + Express (backend), React + Vite (frontend) — no changes to framework
- **Database**: SQLite via `better-sqlite3` — replaces `@supabase/supabase-js` entirely
- **PDF generation**: Puppeteer (existing) — keep, but redesign the HTML template
- **Auth**: JWT + bcrypt (existing) — keep as-is
- **Fresh data**: No data migration from Supabase; fresh SQLite DB

## Success Criteria
- [ ] All Supabase references removed from backend; `better-sqlite3` used for all DB operations
- [ ] SQLite DB auto-initializes with schema on first server start (no manual SQL needed)
- [ ] Invoice statuses: `draft`, `sent`, `paid`, `overdue` all work end-to-end
- [ ] PDF invoice includes: sender business info, customer info, bordered line-items table, INR totals
- [ ] Frontend uses a premium light theme (Inter font, clean palette, micro-animations)
- [ ] Invoice Detail page exists at `/invoices/:id`
- [ ] User can store their business profile (name, address, GSTIN) used in PDF header
- [ ] All existing features (CRUD for customers, items, invoices) continue to work
