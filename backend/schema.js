const db = require('./db');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password     TEXT    NOT NULL,
      first_name   TEXT    NOT NULL DEFAULT '',
      last_name    TEXT    NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS payments (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount     REAL    NOT NULL CHECK (amount > 0),
      method     TEXT    NOT NULL DEFAULT 'cash'
                   CHECK (method IN ('cash','bank_transfer','upi','card','cheque','other')),
      date       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      note       TEXT    NOT NULL DEFAULT '',
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
  `);

  // Migration: update invoices status CHECK to include 'partial'
  // IMPORTANT: foreign_keys must be OFF during table-rename migrations,
  // otherwise SQLite rewrites FK targets in other tables to point at the
  // renamed table, leaving dangling references after the old table is dropped.
  try {
    const cols = db.prepare("PRAGMA table_info(invoices)").all();
    const statusCol = cols.find(c => c.name === 'status');
    if (statusCol) {
      // Test if 'partial' is accepted
      let needsMigration = false;
      try {
        db.exec(`SAVEPOINT status_test`);
        db.exec(`INSERT INTO invoices (user_id, customer_id, invoice_number, issue_date, due_date, status, subtotal, discount, total)
                 VALUES (0, 0, '__test_partial__', '2000-01-01', '2000-01-01', 'partial', 0, 0, 0)`);
        db.exec(`DELETE FROM invoices WHERE invoice_number = '__test_partial__'`);
        db.exec(`RELEASE status_test`);
      } catch (_testErr) {
        needsMigration = true;
        try { db.exec(`ROLLBACK TO status_test`); } catch (_) {}
        try { db.exec(`RELEASE status_test`); } catch (_) {}
      }

      if (needsMigration) {
        db.pragma('foreign_keys = OFF');
        db.exec(`
          ALTER TABLE invoices RENAME TO _invoices_old;
          CREATE TABLE invoices (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
            invoice_number TEXT    NOT NULL,
            issue_date     TEXT    NOT NULL,
            due_date       TEXT    NOT NULL,
            status         TEXT    NOT NULL DEFAULT 'draft'
                                     CHECK (status IN ('draft','sent','paid','overdue','partial')),
            subtotal       REAL    NOT NULL DEFAULT 0,
            discount       REAL    NOT NULL DEFAULT 0 CHECK (discount >= 0),
            total          REAL    NOT NULL DEFAULT 0,
            notes          TEXT    NOT NULL DEFAULT '',
            created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            UNIQUE (user_id, invoice_number)
          );
          INSERT INTO invoices SELECT * FROM _invoices_old;
          DROP TABLE _invoices_old;
          CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
          CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
        `);
        db.pragma('foreign_keys = ON');
        console.log('✓ Migrated invoices: added partial status');
      }
    }
  } catch (migErr) {
    console.error('Invoice status migration error:', migErr.message);
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }

  // Recovery: fix FK references broken by a previous invoices rename migration.
  // If an earlier run renamed invoices without disabling foreign_keys, SQLite
  // silently rewired FKs in invoice_items/payments to point at the old name.
  try {
    const brokenTables = [];
    for (const tbl of ['invoice_items', 'payments']) {
      const fks = db.pragma(`foreign_key_list(${tbl})`);
      if (fks.some(fk => fk.table !== 'invoices' && fk.from === 'invoice_id')) {
        brokenTables.push(tbl);
      }
    }
    if (brokenTables.length > 0) {
      db.pragma('foreign_keys = OFF');
      if (brokenTables.includes('invoice_items')) {
        db.exec(`
          CREATE TABLE _invoice_items_fix (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            item_id    INTEGER REFERENCES items(id) ON DELETE SET NULL,
            name       TEXT    NOT NULL,
            quantity   REAL    NOT NULL CHECK (quantity > 0),
            rate       REAL    NOT NULL CHECK (rate >= 0),
            amount     REAL    NOT NULL CHECK (amount >= 0)
          );
          INSERT INTO _invoice_items_fix SELECT * FROM invoice_items;
          DROP TABLE invoice_items;
          ALTER TABLE _invoice_items_fix RENAME TO invoice_items;
          CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
        `);
      }
      if (brokenTables.includes('payments')) {
        db.exec(`
          CREATE TABLE _payments_fix (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            amount     REAL    NOT NULL CHECK (amount > 0),
            method     TEXT    NOT NULL DEFAULT 'cash'
                         CHECK (method IN ('cash','bank_transfer','upi','card','cheque','other')),
            date       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            note       TEXT    NOT NULL DEFAULT '',
            created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
          );
          INSERT INTO _payments_fix SELECT * FROM payments;
          DROP TABLE payments;
          ALTER TABLE _payments_fix RENAME TO payments;
          CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
        `);
      }
      db.pragma('foreign_keys = ON');
      console.log('✓ Fixed FK references for:', brokenTables.join(', '));
    }
  } catch (fkErr) {
    console.error('FK recovery error:', fkErr.message);
    try { db.pragma('foreign_keys = ON'); } catch (_) {}
  }

  // Migration: add logo column to existing databases that don't have it
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN logo TEXT NOT NULL DEFAULT ''`);
    console.log('✓ Migrated user_settings: added logo column');
  } catch (_) {
    // Column already exists — safe to ignore
  }

  // Migration: add first_name and last_name to users table
  try {
    db.exec(`ALTER TABLE users ADD COLUMN first_name TEXT NOT NULL DEFAULT ''`);
    console.log('✓ Migrated users: added first_name column');
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''`);
    console.log('✓ Migrated users: added last_name column');
  } catch (_) {}

  // Migration: add invoice configuration columns to user_settings
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN invoice_generation_type TEXT NOT NULL DEFAULT 'sequential'`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN invoice_prefix TEXT NOT NULL DEFAULT 'INV-'`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN invoice_postfix TEXT NOT NULL DEFAULT ''`);
    console.log('✓ Migrated user_settings: added invoice format columns');
  } catch (_) {}

  // Migration: add payment info columns to user_settings
  try {
    db.exec(`ALTER TABLE user_settings ADD COLUMN bank_account_name TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN bank_account_number TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN bank_ifsc TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN bank_name TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN bank_branch TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN upi_id TEXT NOT NULL DEFAULT ''`);
    db.exec(`ALTER TABLE user_settings ADD COLUMN upi_qr TEXT NOT NULL DEFAULT ''`);
    console.log('✓ Migrated user_settings: added payment info columns');
  } catch (_) {}

  console.log('✓ SQLite schema ready');
}

module.exports = { initSchema };
