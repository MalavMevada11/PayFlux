/**
 * Seed script — creates sample data for testing.
 * Run with: node seed.js
 *
 * Creates:
 *   1. Admin user
 *   2. Two business users (with profile, customers, items, invoices)
 *   3. Two customer users
 *   4. Links between businesses and customers
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const { initSchema } = require('./schema');

const SALT_ROUNDS = 10;

async function seed() {
  console.log('🌱 Starting seed...');
  await initSchema();

  // ── 1. Create users ─────────────────────────────
  const hash = await bcrypt.hash('Pass@123', SALT_ROUNDS);

  const users = [
    { email: 'admin@payflux.com',       first_name: 'Malav',   last_name: 'Mevada',   role: 'admin' },
    { email: 'nexus@business.com',       first_name: 'Arjun',   last_name: 'Sharma',   role: 'business' },
    { email: 'vertex@business.com',      first_name: 'Priya',   last_name: 'Patel',    role: 'business' },
    { email: 'rahul@customer.com',       first_name: 'Rahul',   last_name: 'Verma',    role: 'customer' },
    { email: 'sneha@customer.com',       first_name: 'Sneha',   last_name: 'Iyer',     role: 'customer' },
  ];

  const createdUsers = {};
  for (const u of users) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
    if (existing.rows.length > 0) {
      createdUsers[u.email] = existing.rows[0].id;
      console.log(`  ↻ User ${u.email} already exists (id ${existing.rows[0].id})`);
    } else {
      const { rows } = await pool.query(
        `INSERT INTO users (email, password, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [u.email, hash, u.first_name, u.last_name, u.role]
      );
      createdUsers[u.email] = rows[0].id;
      console.log(`  ✓ Created ${u.role}: ${u.email} (id ${rows[0].id})`);
    }
  }

  const bizNexusId = createdUsers['nexus@business.com'];
  const bizVertexId = createdUsers['vertex@business.com'];
  const custRahulId = createdUsers['rahul@customer.com'];
  const custSnehaId = createdUsers['sneha@customer.com'];

  // ── 2. Business profiles ─────────────────────────
  for (const [userId, bizName, gstin, fullAddr, phone] of [
    [bizNexusId, 'Nexus Technologies',  '27AABCT1234F1ZH', '42 Tech Park, Whitefield, Bangalore, Karnataka 560066', '+91 98765 00001'],
    [bizVertexId, 'Vertex Design Studio', '24AADCV5678G2ZP', '18 Design District, Andheri, Mumbai, Maharashtra 400053', '+91 98765 00002'],
  ]) {
    await pool.query(
      `INSERT INTO user_settings (user_id, business_name, gstin, business_address, phone)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET business_name=$2, gstin=$3, business_address=$4, phone=$5`,
      [userId, bizName, gstin, fullAddr, phone]
    );
  }
  console.log('  ✓ Business profiles set');

  // ── 3. Customers (contacts) for each business ────
  const nexusCustomers = [
    { type: 'business', name: 'Rahul Verma',    email: 'rahul@customer.com',    phone: '+91 91234 56001', company_name: 'Verma Enterprises',    address: 'Plot 7, Industrial Area, Delhi' },
    { type: 'individual', name: 'Sneha Iyer',   email: 'sneha@customer.com',    phone: '+91 91234 56002', company_name: '',                     address: 'Flat 302, Rose Apts, Chennai' },
    { type: 'business', name: 'TechGlobal Inc', email: 'orders@techglobal.com', phone: '+91 91234 56003', company_name: 'TechGlobal Inc',       address: '99 MG Road, Pune' },
  ];

  const vertexCustomers = [
    { type: 'individual', name: 'Rahul Verma', email: 'rahul@customer.com',     phone: '+91 91234 56001', company_name: '',                     address: 'Plot 7, Industrial Area, Delhi' },
    { type: 'business', name: 'MediaCraft LLP', email: 'hello@mediacraft.com',  phone: '+91 91234 56004', company_name: 'MediaCraft LLP',       address: '8 Film City Complex, Noida' },
  ];

  async function insertCustomers(userId, list) {
    const ids = [];
    for (const c of list) {
      const existing = await pool.query(
        'SELECT id FROM customers WHERE user_id = $1 AND LOWER(email) = LOWER($2)',
        [userId, c.email]
      );
      if (existing.rows.length > 0) {
        ids.push(existing.rows[0].id);
      } else {
        const { rows } = await pool.query(
          `INSERT INTO customers (user_id, type, name, email, phone, company_name, address)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [userId, c.type, c.name, c.email, c.phone, c.company_name, c.address]
        );
        ids.push(rows[0].id);
      }
    }
    return ids;
  }

  const nexusCustIds = await insertCustomers(bizNexusId, nexusCustomers);
  const vertexCustIds = await insertCustomers(bizVertexId, vertexCustomers);
  console.log(`  ✓ Customers: Nexus(${nexusCustIds.length}), Vertex(${vertexCustIds.length})`);

  // ── 4. Items for each business ───────────────────
  const nexusItems = [
    { name: 'Web Development',         type: 'service', price: 75000,  description: 'Full-stack web application development' },
    { name: 'UI/UX Consultation',      type: 'service', price: 3500,   description: 'Expert UI/UX design consultation (per hour)' },
    { name: 'Cloud Hosting (Monthly)', type: 'service', price: 4999,   description: 'AWS/GCP cloud hosting and management' },
    { name: 'API Integration',         type: 'service', price: 25000,  description: 'Third-party API integration service' },
  ];

  const vertexItems = [
    { name: 'Brand Identity Package',  type: 'service', price: 50000,  description: 'Logo, colors, typography, brand guide' },
    { name: 'Social Media Creatives',  type: 'service', price: 8000,   description: 'Set of 10 social media post designs' },
    { name: 'Packaging Design',        type: 'goods',   price: 35000,  description: 'Product packaging design with 3D mockups' },
  ];

  async function insertItems(userId, list) {
    const ids = [];
    for (const it of list) {
      const existing = await pool.query(
        'SELECT id FROM items WHERE user_id = $1 AND name = $2', [userId, it.name]
      );
      if (existing.rows.length > 0) {
        ids.push(existing.rows[0].id);
      } else {
        const { rows } = await pool.query(
          `INSERT INTO items (user_id, name, type, price, description)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [userId, it.name, it.type, it.price, it.description]
        );
        ids.push(rows[0].id);
      }
    }
    return ids;
  }

  const nexusItemIds = await insertItems(bizNexusId, nexusItems);
  const vertexItemIds = await insertItems(bizVertexId, vertexItems);
  console.log(`  ✓ Items: Nexus(${nexusItemIds.length}), Vertex(${vertexItemIds.length})`);

  // ── 5. Invoices ──────────────────────────────────
  async function createInvoice(userId, custId, number, lineItems, status, dueDate, issueDate) {
    const existing = await pool.query(
      'SELECT id FROM invoices WHERE user_id = $1 AND invoice_number = $2', [userId, number]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxRate = 18; // 18% GST
    const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
    const total = subtotal + taxAmount;

    const { rows } = await pool.query(
      `INSERT INTO invoices (user_id, customer_id, invoice_number, issue_date, due_date, status,
                             subtotal, tax_amount, total, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [userId, custId, number, issueDate, dueDate, status,
       subtotal, taxAmount, total, 'Thank you for your business!']
    );
    const invoiceId = rows[0].id;

    // Insert line items
    for (const li of lineItems) {
      await pool.query(
        `INSERT INTO invoice_items (invoice_id, name, quantity, rate, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoiceId, li.name, li.quantity, li.rate, li.quantity * li.rate]
      );
    }

    // Insert tax
    await pool.query(
      `INSERT INTO invoice_taxes (invoice_id, name, rate, amount)
       VALUES ($1, 'GST', $2, $3)`,
      [invoiceId, taxRate, taxAmount]
    );

    return invoiceId;
  }

  const d = (daysFromNow) => new Date(Date.now() + daysFromNow * 86400000).toISOString().split('T')[0];

  // Nexus invoices
  await createInvoice(bizNexusId, nexusCustIds[0], 'NXT-001',
    [{ name: 'Web Development', quantity: 1, rate: 75000 }],
    'paid', d(-5), d(-35));

  await createInvoice(bizNexusId, nexusCustIds[0], 'NXT-002',
    [{ name: 'API Integration', quantity: 2, rate: 25000 }],
    'sent', d(15), d(-5));

  await createInvoice(bizNexusId, nexusCustIds[1], 'NXT-003',
    [{ name: 'UI/UX Consultation', quantity: 8, rate: 3500 },
     { name: 'Cloud Hosting (Monthly)', quantity: 3, rate: 4999 }],
    'sent', d(20), d(-2));

  await createInvoice(bizNexusId, nexusCustIds[2], 'NXT-004',
    [{ name: 'Cloud Hosting (Monthly)', quantity: 6, rate: 4999 }],
    'overdue', d(-10), d(-40));

  // Vertex invoices
  await createInvoice(bizVertexId, vertexCustIds[0], 'VTX-001',
    [{ name: 'Brand Identity Package', quantity: 1, rate: 50000 }],
    'paid', d(-15), d(-45));

  await createInvoice(bizVertexId, vertexCustIds[0], 'VTX-002',
    [{ name: 'Social Media Creatives', quantity: 4, rate: 8000 }],
    'sent', d(10), d(-3));

  await createInvoice(bizVertexId, vertexCustIds[1], 'VTX-003',
    [{ name: 'Packaging Design', quantity: 1, rate: 35000 },
     { name: 'Brand Identity Package', quantity: 1, rate: 50000 }],
    'draft', d(30), d(0));

  console.log('  ✓ Invoices created');

  // ── 6. Payments for paid invoices ────────────────
  const paidInvoices = await pool.query(
    "SELECT id, total FROM invoices WHERE status = 'paid' AND user_id IN ($1, $2)", [bizNexusId, bizVertexId]
  );
  for (const inv of paidInvoices.rows) {
    const existing = await pool.query('SELECT id FROM payments WHERE invoice_id = $1', [inv.id]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO payments (invoice_id, amount, method, date, note)
         VALUES ($1, $2, 'bank_transfer', $3, 'Full payment received')`,
        [inv.id, inv.total, d(-5)]
      );
    }
  }
  console.log('  ✓ Payments recorded');

  // ── 7. Customer-Business links ───────────────────
  async function createLink(custUserId, bizUserId) {
    const existing = await pool.query(
      'SELECT id FROM customer_links WHERE customer_user_id = $1 AND business_user_id = $2',
      [custUserId, bizUserId]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO customer_links (customer_user_id, business_user_id, company_code)
         VALUES ($1, $2, $3)`,
        [custUserId, bizUserId, 'SEED' + Math.random().toString(36).slice(2, 6).toUpperCase()]
      );
    }
  }

  // Rahul linked to both businesses, Sneha linked to Nexus
  await createLink(custRahulId, bizNexusId);
  await createLink(custRahulId, bizVertexId);
  await createLink(custSnehaId, bizNexusId);
  console.log('  ✓ Customer-Business links created');

  // ── Done ─────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      LOGIN CREDENTIALS                     ║');
  console.log('║  All passwords: Pass@123                                   ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  ADMIN     │ admin@payflux.com                             ║');
  console.log('║  BUSINESS  │ nexus@business.com   (Nexus Technologies)     ║');
  console.log('║  BUSINESS  │ vertex@business.com  (Vertex Design Studio)   ║');
  console.log('║  CUSTOMER  │ rahul@customer.com   (linked to both biz)     ║');
  console.log('║  CUSTOMER  │ sneha@customer.com   (linked to Nexus)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
