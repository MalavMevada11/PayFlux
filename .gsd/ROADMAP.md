# ROADMAP.md

> **Current Phase**: Phase 1 — SQLite Migration
> **Milestone**: v1.0 — PayFlux Production-Ready

## Must-Haves (from SPEC)
- [x] Supabase fully removed from backend
- [ ] SQLite auto-initializes on first `npm run dev`
- [ ] Invoice statuses: draft, sent, paid, overdue
- [ ] PDF with INR formatting, business "From" header, bordered table
- [ ] Premium light-theme UI (Inter font, modern palette)
- [ ] Invoice Detail/View page
- [ ] Business profile settings page

---

## Phases

### Phase 1: SQLite Migration
**Status**: ⬜ Not Started
**Objective**: Replace all Supabase calls with `better-sqlite3`. The app must work identically after this phase — same API surface, same data model, no frontend changes.
**Deliverables**:
- `backend/db.js` — SQLite singleton with connection setup
- `backend/schema.js` — auto-creates all tables on startup (users, customers, items, invoices, invoice_items, user_settings)
- Rewrite all 4 controllers (auth, customer, item, invoice) to use synchronous SQLite queries
- Remove `@supabase/supabase-js` and `supabaseClient.js`
- Add `better-sqlite3` dependency
- Update `backend/.env` / `backend/.env.example`

### Phase 2: Feature Expansion
**Status**: ⬜ Not Started  
**Objective**: Add the new features on top of the working SQLite backend.
**Deliverables**:
- Expand invoice statuses to: `draft`, `sent`, `paid`, `overdue`
- Add `user_settings` table + `/auth/profile` GET+PUT endpoints
- Redesigned PDF template: branded header (From), bordered line-items table, INR (₹) currency
- New backend routes for profile

### Phase 3: UI Overhaul
**Status**: ⬜ Not Started
**Objective**: Complete frontend redesign. Premium light theme. All pages updated.
**Deliverables**:
- New `index.css` — Inter font, curated light palette, smooth animations, status badge styles
- Redesigned `App.jsx` — new sidebar/header nav with PayFlux branding
- Updated `Dashboard.jsx` — stats cards, improved invoice table with status badges
- Updated `Customers.jsx` — premium card/table layout
- Updated `Items.jsx` — premium card/table layout
- Updated `InvoiceBuilder.jsx` — clean form layout, better line-item UX
- New `InvoiceDetail.jsx` — view invoice, download PDF, change status
- New `Profile.jsx` — business settings form (name, address, GSTIN, phone)
- Updated `Login.jsx` + `Register.jsx` — centered auth pages with PayFlux branding

### Phase 4: Polish & Validation
**Status**: ⬜ Not Started
**Objective**: Test all flows end-to-end, fix any bugs, validate PDF output, ensure the app starts cleanly.
**Deliverables**:
- End-to-end smoke test: register → login → add customer → add item → create invoice → download PDF
- Verify SQLite DB auto-creates on fresh start
- Verify all 4 statuses render correctly
- Verify PDF includes business info
- Clean up any console errors

---

### Phase 5: Date Format Standardization (DD/MM/YYYY)
**Status**: ✅ Complete
**Objective**: Ensure all dates displayed anywhere in the app use the `DD/MM/YYYY` format consistently.
**Depends on**: Phase 4

**Tasks**:
- [x] Extract shared `formatDate(iso)` utility to a common module (`frontend/src/utils/date.js`)
- [x] `Invoices.jsx` — format `r.issue_date` and `r.due_date` in the table
- [x] `InvoiceDetail.jsx` — format `inv.issue_date` and `inv.due_date` in header and info card
- [x] `InvoiceDetail.jsx` — format `p.date` in payment history entries
- [x] `InvoiceBuilder.jsx` — replace inline `formatDateForDisplay` with shared utility
- [x] `invoiceController.js` — add `fmtDate()` helper; format dates in PDF template

**Verification**:
- All date columns in Invoices list show DD/MM/YYYY
- InvoiceDetail header and info card show DD/MM/YYYY
- Payment history dates show DD/MM/YYYY
- PDF output shows DD/MM/YYYY for issue/due dates and payment dates
- Date picker inputs remain in native ISO format (no change needed)
