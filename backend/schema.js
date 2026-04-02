const db = require('./db');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password     TEXT    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      business_name    TEXT    NOT NULL DEFAULT '',
      business_address TEXT    NOT NULL DEFAULT '',
      gstin            TEXT    NOT NULL DEFAULT '',
      phone            TEXT    NOT NULL DEFAULT '',
      logo             TEXT    NOT NULL DEFAULT '',
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type         TEXT    NOT NULL CHECK (type IN ('business','individual')),
      name         TEXT    NOT NULL,
      email        TEXT    NOT NULL,
      phone        TEXT    NOT NULL DEFAULT '',
      company_name TEXT,
      address      TEXT,
      created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

    CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK (type IN ('goods','service')),
      price       REAL    NOT NULL CHECK (price >= 0),
      description TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      invoice_number TEXT    NOT NULL,
      issue_date     TEXT    NOT NULL,
      due_date       TEXT    NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sent','paid','overdue')),
      subtotal       REAL    NOT NULL DEFAULT 0,
      discount       REAL    NOT NULL DEFAULT 0 CHECK (discount >= 0),
      total          REAL    NOT NULL DEFAULT 0,
      notes          TEXT    NOT NULL DEFAULT '',
      created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      UNIQUE (user_id, invoice_number)
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

    CREATE TABLE IF NOT EXISTS invoice_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
      name       TEXT    NOT NULL,
      quantity   REAL    NOT NULL CHECK (quantity > 0),
      rate       REAL    NOT NULL CHECK (rate >= 0),
      amount     REAL    NOT NULL CHECK (amount >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
  `);

  // Migration: add logo column to existing databases that don't have it
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN logo TEXT NOT NULL DEFAULT ''`);
    console.log('✓ Migrated user_settings: added logo column');
  } catch (_) {
    // Column already exists — safe to ignore
  }

  console.log('✓ SQLite schema ready');
}

module.exports = { initSchema };
