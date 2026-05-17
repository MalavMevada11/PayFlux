const { pool } = require('./db');

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      email        TEXT    NOT NULL,
      password     TEXT    NOT NULL,
      first_name   TEXT    NOT NULL DEFAULT '',
      last_name    TEXT    NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

    CREATE TABLE IF NOT EXISTS user_settings (
      id                      SERIAL PRIMARY KEY,
      user_id                 INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      business_name           TEXT    NOT NULL DEFAULT '',
      business_address        TEXT    NOT NULL DEFAULT '',
      gstin                   TEXT    NOT NULL DEFAULT '',
      phone                   TEXT    NOT NULL DEFAULT '',
      logo                    TEXT    NOT NULL DEFAULT '',
      invoice_generation_type TEXT    NOT NULL DEFAULT 'sequential',
      invoice_prefix          TEXT    NOT NULL DEFAULT 'INV-',
      invoice_postfix         TEXT    NOT NULL DEFAULT '',
      bank_account_name       TEXT    NOT NULL DEFAULT '',
      bank_account_number     TEXT    NOT NULL DEFAULT '',
      bank_ifsc               TEXT    NOT NULL DEFAULT '',
      bank_name               TEXT    NOT NULL DEFAULT '',
      bank_branch             TEXT    NOT NULL DEFAULT '',
      upi_id                  TEXT    NOT NULL DEFAULT '',
      upi_qr                  TEXT    NOT NULL DEFAULT '',
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type         TEXT    NOT NULL CHECK (type IN ('business','individual')),
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL,
      phone        TEXT    NOT NULL DEFAULT '',
      company_name TEXT,
      address      TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

    CREATE TABLE IF NOT EXISTS items (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK (type IN ('goods','service')),
      price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
      description TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      invoice_number TEXT    NOT NULL,
      issue_date     TEXT    NOT NULL,
      due_date       TEXT    NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sent','paid','overdue','partial')),
      subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
      discount_type  TEXT    NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat','percent')),
      tax_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
      total          NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes          TEXT    NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, invoice_number)
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

    CREATE TABLE IF NOT EXISTS invoice_items (
      id         SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
      name       TEXT    NOT NULL,
      quantity   NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
      rate       NUMERIC(12,2) NOT NULL CHECK (rate >= 0),
      amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

    CREATE TABLE IF NOT EXISTS invoice_taxes (
      id         SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      rate       NUMERIC(6,2) NOT NULL CHECK (rate >= 0),
      amount     NUMERIC(12,2) NOT NULL CHECK (amount >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_taxes_invoice_id ON invoice_taxes(invoice_id);

    CREATE TABLE IF NOT EXISTS payments (
      id         SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      method     TEXT    NOT NULL DEFAULT 'cash'
                   CHECK (method IN ('cash','bank_transfer','upi','card','cheque','other')),
      date       TEXT    NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      note       TEXT    NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

    -- ── RBAC: Customer-Business linking (M:N) ──
    CREATE TABLE IF NOT EXISTS customer_links (
      id                SERIAL PRIMARY KEY,
      customer_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_code      TEXT    NOT NULL DEFAULT '',
      status            TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      linked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(customer_user_id, business_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_links_customer ON customer_links(customer_user_id);
    CREATE INDEX IF NOT EXISTS idx_customer_links_business ON customer_links(business_user_id);

    -- ── RBAC: Invitation codes ──
    CREATE TABLE IF NOT EXISTS invitations (
      id              SERIAL PRIMARY KEY,
      code            TEXT    NOT NULL UNIQUE,
      type            TEXT    NOT NULL CHECK (type IN ('company_to_customer','customer_to_company')),
      inviter_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitee_email   TEXT,
      used_by         INTEGER REFERENCES users(id),
      used_at         TIMESTAMPTZ,
      expires_at      TIMESTAMPTZ NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);
    CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON invitations(inviter_id);

    -- ── Phase B: Payment requests ──
    CREATE TABLE IF NOT EXISTS payment_requests (
      id                SERIAL PRIMARY KEY,
      invoice_id        INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      business_user_id  INTEGER NOT NULL REFERENCES users(id),
      customer_user_id  INTEGER NOT NULL REFERENCES users(id),
      amount            NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      message           TEXT NOT NULL DEFAULT '',
      status            TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','cancelled','expired')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payment_requests_customer ON payment_requests(customer_user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_requests_invoice ON payment_requests(invoice_id);
  `);

  // Migrations for existing databases — safe to re-run
  const migrations = [
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'flat'`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0`,
    // Phase A: RBAC role column
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'business'`,
    // Phase D: Razorpay keys per business
    `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS razorpay_key_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS razorpay_key_secret_enc TEXT NOT NULL DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (e) { /* column may already exist */ }
  }

  console.log('✓ PostgreSQL schema ready');
}

module.exports = { initSchema };
