const db = require('../db');
const puppeteer = require('puppeteer');

const STATUSES = new Set(['draft', 'sent', 'paid', 'overdue', 'partial']);

function num(v) {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function inr(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Validation helpers ────────────────────────────────────────────────────

function parseLines(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'At least one line item is required' };
  }
  const lines = [];
  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i];
    if (!row || typeof row !== 'object') {
      return { error: `Invalid item at index ${i}` };
    }
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return { error: `Line ${i + 1}: name is required` };
    let quantity = num(row.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      quantity = 1; // Fallback to 1 to bypass DB constraint check and avoid errors
    }
    let rate = num(row.rate);
    if (!Number.isFinite(rate) || rate < 0) {
      rate = 0;
    }
    const amount = roundMoney(quantity * rate);
    const itemId = (row.item_id !== undefined && row.item_id !== null && row.item_id !== '')
      ? Number(row.item_id) || null
      : null;
    lines.push({ item_id: itemId, name, quantity, rate: roundMoney(rate), amount });
  }
  return { lines };
}

function totalsFromLines(lines, discountRaw) {
  const subtotal = roundMoney(
    lines.reduce((s, l) => {
      const amt = l.amount !== undefined && l.amount !== null
        ? num(l.amount)
        : roundMoney(num(l.quantity) * num(l.rate));
      return s + (Number.isFinite(amt) ? amt : 0);
    }, 0)
  );
  const discount = roundMoney(num(discountRaw));
  if (!Number.isFinite(discount) || discount < 0) {
    return { error: 'discount must be a non-negative number' };
  }
  const total = roundMoney(Math.max(0, subtotal - discount));
  return { subtotal, discount, total };
}

// ─── DB helpers ───────────────────────────────────────────────────────────

function nextInvoiceNumber(userId) {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) || {};
  const type = settings.invoice_generation_type || 'sequential';
  
  // For manual mode, return a blank placeholder (frontend handles it)
  if (type === 'manual') {
    return '';
  }

  // Sequential: uses user-defined prefix/postfix with 6-digit zero-padded counter
  const prefix = settings.invoice_prefix ?? 'INV-';
  const postfix = settings.invoice_postfix ?? '';

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`^${escapeRegExp(prefix)}(\\d+)${escapeRegExp(postfix)}$`);

  const rows = db
    .prepare(`SELECT invoice_number FROM invoices WHERE user_id = ? ORDER BY id DESC LIMIT 20`)
    .all(userId);

  let n = 1;
  for (const r of rows) {
    const m = rx.exec(r.invoice_number);
    if (m) {
      n = parseInt(m[1], 10) + 1;
      break;
    }
  }

  return `${prefix}${String(n).padStart(6, '0')}${postfix}`;
}

function getNextNumber(req, res) {
  try {
    const num = nextInvoiceNumber(req.userId);
    return res.json({ nextNumber: num });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate number' });
  }
}

function assertCustomerOwned(userId, customerId) {
  return !!db
    .prepare('SELECT id FROM customers WHERE id = ? AND user_id = ?')
    .get(customerId, userId);
}

function assertItemsOwned(userId, itemIds) {
  const unique = [...new Set(itemIds.filter(Boolean))];
  if (unique.length === 0) return true;
  const placeholders = unique.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id FROM items WHERE user_id = ? AND id IN (${placeholders})`)
    .all(userId, ...unique);
  return rows.length === unique.length;
}

function fetchInvoiceFull(userId, invoiceId) {
  const inv = db
    .prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?')
    .get(invoiceId, userId);
  if (!inv) return null;
  const lines = db
    .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC')
    .all(invoiceId);
  const customer = db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .get(inv.customer_id);
  const payments = db
    .prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY date ASC, id ASC')
    .all(invoiceId);
  const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  const remaining = roundMoney(inv.total - totalPaid);
  return { ...inv, items: lines, customer: customer || null, payments, totalPaid, remaining };
}

// ─── CRUD handlers ────────────────────────────────────────────────────────

function create(req, res) {
  try {
    const body = req.body || {};
    const { customer_id, issue_date, due_date, status, discount, notes } = body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!issue_date || typeof issue_date !== 'string') {
      return res.status(400).json({ error: 'issue_date is required (YYYY-MM-DD)' });
    }
    if (!due_date || typeof due_date !== 'string') {
      return res.status(400).json({ error: 'due_date is required (YYYY-MM-DD)' });
    }
    if (!STATUSES.has(status)) {
      return res.status(400).json({ error: 'status must be draft, sent, paid, or overdue' });
    }
    if (!assertCustomerOwned(req.userId, customer_id)) {
      return res.status(400).json({ error: 'Customer not found' });
    }
    const parsed = parseLines(body.items);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!assertItemsOwned(req.userId, parsed.lines.map((l) => l.item_id))) {
      return res.status(400).json({ error: 'One or more item_id values are invalid' });
    }
    const t = totalsFromLines(parsed.lines, discount !== undefined ? discount : 0);
    if (t.error) return res.status(400).json({ error: t.error });

    const invoice_number = nextInvoiceNumber(req.userId);

    const insertInvoice = db.prepare(`
      INSERT INTO invoices
        (user_id, customer_id, invoice_number, issue_date, due_date, status,
         subtotal, discount, total, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLine = db.prepare(`
      INSERT INTO invoice_items (invoice_id, item_id, name, quantity, rate, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const txn = db.transaction(() => {
      const info = insertInvoice.run(
        req.userId, customer_id, invoice_number, issue_date, due_date, status,
        t.subtotal, t.discount, t.total,
        typeof notes === 'string' ? notes : ''
      );
      const invoiceId = info.lastInsertRowid;
      for (const l of parsed.lines) {
        insertLine.run(invoiceId, l.item_id, l.name, l.quantity, l.rate, l.amount);
      }
      return invoiceId;
    });

    const invoiceId = txn();
    const full = fetchInvoiceFull(req.userId, invoiceId);
    return res.status(201).json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create invoice' });
  }
}

function list(req, res) {
  try {
    const rows = db.prepare(`
      SELECT i.*,
             c.name AS customer_name, c.email AS customer_email, c.company_name AS customer_company,
             COALESCE(p.total_paid, 0) AS total_paid
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.user_id = ?
      ORDER BY i.created_at DESC
    `).all(req.userId);
    const shaped = rows.map(({ customer_name, customer_email, customer_company, total_paid, ...inv }) => ({
      ...inv,
      customers: { name: customer_name, email: customer_email, company_name: customer_company },
      totalPaid: roundMoney(total_paid),
      remaining: roundMoney(inv.total - total_paid),
    }));
    return res.json(shaped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list invoices' });
  }
}

function getOne(req, res) {
  try {
    const full = fetchInvoiceFull(req.userId, req.params.id);
    if (!full) return res.status(404).json({ error: 'Invoice not found' });
    return res.json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load invoice' });
  }
}

function update(req, res) {
  try {
    const { id } = req.params;
    const existing = fetchInvoiceFull(req.userId, id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const body = req.body || {};
    const patch = {};

    if (body.customer_id !== undefined) {
      if (!assertCustomerOwned(req.userId, body.customer_id)) {
        return res.status(400).json({ error: 'Customer not found' });
      }
      patch.customer_id = body.customer_id;
    }
    if (body.issue_date !== undefined) patch.issue_date = body.issue_date;
    if (body.due_date !== undefined) patch.due_date = body.due_date;
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) {
        return res.status(400).json({ error: 'status must be draft, sent, paid, or overdue' });
      }
      patch.status = body.status;
    }
    if (body.notes !== undefined) patch.notes = typeof body.notes === 'string' ? body.notes : '';

    let subtotal = existing.subtotal;
    let discount = existing.discount;
    let total = existing.total;
    let newLines = null;

    if (body.items !== undefined) {
      const parsed = parseLines(body.items);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      if (!assertItemsOwned(req.userId, parsed.lines.map((l) => l.item_id))) {
        return res.status(400).json({ error: 'One or more item_id values are invalid' });
      }
      const disc = body.discount !== undefined ? body.discount : existing.discount;
      const t = totalsFromLines(parsed.lines, disc);
      if (t.error) return res.status(400).json({ error: t.error });
      subtotal = t.subtotal;
      discount = t.discount;
      total = t.total;
      patch.subtotal = subtotal;
      patch.discount = discount;
      patch.total = total;
      newLines = parsed.lines;
    } else if (body.discount !== undefined) {
      const t = totalsFromLines(existing.items || [], body.discount);
      if (t.error) return res.status(400).json({ error: t.error });
      patch.subtotal = t.subtotal;
      patch.discount = t.discount;
      patch.total = t.total;
    }

    const txn = db.transaction(() => {
      if (Object.keys(patch).length > 0) {
        const sets = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
        db.prepare(`UPDATE invoices SET ${sets} WHERE id = ? AND user_id = ?`)
          .run(...Object.values(patch), id, req.userId);
      }
      if (newLines) {
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
        const insertLine = db.prepare(
          'INSERT INTO invoice_items (invoice_id, item_id, name, quantity, rate, amount) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const l of newLines) {
          insertLine.run(id, l.item_id, l.name, l.quantity, l.rate, l.amount);
        }
      }
    });
    txn();

    const full = fetchInvoiceFull(req.userId, id);
    return res.json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update invoice' });
  }
}

function remove(req, res) {
  try {
    const { id } = req.params;
    const result = db
      .prepare('DELETE FROM invoices WHERE id = ? AND user_id = ? RETURNING id')
      .get(id, req.userId);
    if (!result) return res.status(404).json({ error: 'Invoice not found' });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete invoice' });
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function statusColor(status) {
  switch (status) {
    case 'paid':    return '#059669';
    case 'partial': return '#2563EB';
    case 'sent':    return '#D97706';
    case 'overdue': return '#DC2626';
    default:        return '#6B7280';
  }
}

function invoiceHtml(inv, settings = {}) {
  const c = inv.customer || {};
  const lines = inv.items || [];
  const from = settings;

  const lineRows = lines.map((l) => `
    <tr>
      <td>${escapeHtml(l.name)}</td>
      <td class="right">${Number(l.quantity)}</td>
      <td class="right">${inr(l.rate)}</td>
      <td class="right amount">${inr(l.amount)}</td>
    </tr>
  `).join('');

  const statusBg = statusColor(inv.status);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      color: #111827;
      background: #fff;
      padding: 48px;
      font-size: 13px;
      line-height: 1.6;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #4F46E5;
    }
    .brand { font-size: 26px; font-weight: 700; color: #4F46E5; letter-spacing: -0.5px; }
    .brand span { color: #111827; }
    .logo-img {
      max-height: 64px;
      max-width: 200px;
      object-fit: contain;
      display: block;
    }
    .logo-img.is-png {
      mix-blend-mode: multiply;
      background: transparent;
    }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: 18px; font-weight: 700; color: #111827; }
    .status-badge {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #fff;
      background: ${statusBg};
    }
    .invoice-date { margin-top: 6px; color: #6B7280; font-size: 12px; }

    /* ── Party cards ── */
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 36px;
    }
    .party-card {
      background: #F8F9FC;
      border: 1px solid #E4E7F0;
      border-radius: 8px;
      padding: 16px 20px;
    }
    .party-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4F46E5;
      margin-bottom: 8px;
    }
    .party-name { font-weight: 600; font-size: 14px; color: #111827; }
    .party-detail { color: #6B7280; margin-top: 2px; }

    /* ── Line items table ── */
    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6B7280;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead tr {
      background: #4F46E5;
      color: #fff;
    }
    thead th {
      padding: 10px 14px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    thead th.right { text-align: right; }
    tbody tr {
      border-bottom: 1px solid #E4E7F0;
    }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:nth-child(even) { background: #F8F9FC; }
    td {
      padding: 10px 14px;
      vertical-align: middle;
    }
    td.right { text-align: right; }
    td.amount { font-weight: 500; }
    .table-outer {
      border: 1px solid #E4E7F0;
      border-radius: 8px;
      overflow: hidden;
    }

    /* ── Totals ── */
    .totals-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 36px;
    }
    .totals {
      width: 280px;
      border: 1px solid #E4E7F0;
      border-radius: 8px;
      overflow: hidden;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 9px 16px;
      font-size: 13px;
      border-bottom: 1px solid #E4E7F0;
    }
    .totals-row:last-child { border-bottom: none; }
    .totals-row.grand {
      background: #4F46E5;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
    }
    .totals-label { color: inherit; }
    .totals-value { font-weight: 500; }

    /* ── Notes ── */
    .notes {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 32px;
      font-size: 13px;
      color: #92400E;
    }
    .notes-label { font-weight: 600; margin-bottom: 4px; }

    /* ── Footer ── */
    .footer {
      border-top: 1px solid #E4E7F0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #9CA3AF;
      font-size: 11px;
    }
    .footer-thanks { font-weight: 500; color: #6B7280; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      ${from.logo
        ? (() => {
            const isPng = from.logo.startsWith('data:image/png');
            return `<img src="${from.logo}" class="logo-img${isPng ? ' is-png' : ''}" alt="${escapeHtml(from.business_name || 'Company Logo')}" />`;
          })()
        : `<div class="brand">Pay<span>Flux</span></div>`
      }
      ${from.gstin ? `<div style="margin-top:4px;color:#6B7280;font-size:12px;">GSTIN: ${escapeHtml(from.gstin)}</div>` : ''}
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">${escapeHtml(inv.invoice_number)}</div>
      <div><span class="status-badge">${escapeHtml(inv.status)}</span></div>
      <div class="invoice-date">
        Issue: ${fmtDate(inv.issue_date)} &nbsp;·&nbsp; Due: ${fmtDate(inv.due_date)}
      </div>
    </div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="party-card">
      <div class="party-label">From</div>
      <div class="party-name">${escapeHtml(from.business_name || 'Your Business')}</div>
      ${from.phone ? `<div class="party-detail">${escapeHtml(from.phone)}</div>` : ''}
      ${from.business_address
          ? `<div class="party-detail">${escapeHtml(from.business_address).replace(/\n/g, '<br/>')}</div>`
          : ''}
    </div>
    <div class="party-card">
      <div class="party-label">Bill To</div>
      <div class="party-name">${escapeHtml(c.name || '')}</div>
      ${c.company_name ? `<div class="party-detail">${escapeHtml(c.company_name)}</div>` : ''}
      <div class="party-detail">${escapeHtml(c.email || '')}</div>
      ${c.address
          ? `<div class="party-detail">${escapeHtml(c.address).replace(/\n/g, '<br/>')}</div>`
          : ''}
    </div>
  </div>

  <!-- Line items -->
  <div class="section-title">Line Items</div>
  <div class="table-outer">
    <table>
      <thead>
        <tr>
          <th>Item / Description</th>
          <th class="right">Qty</th>
          <th class="right">Rate</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
  </div>

   <!-- Totals -->
   <div class="totals-wrapper">
     <div class="totals">
       <div class="totals-row">
         <span class="totals-label">Subtotal</span>
         <span class="totals-value">${inr(inv.subtotal)}</span>
       </div>
       <div class="totals-row">
         <span class="totals-label">Discount</span>
         <span class="totals-value">− ${inr(inv.discount)}</span>
       </div>
       <div class="totals-row grand">
         <span class="totals-label">Total</span>
         <span class="totals-value">${inr(inv.total)}</span>
       </div>
       ${(inv.payments && inv.payments.length > 0) ? `
       <div class="totals-row" style="border-top:2px solid #E4E7F0;">
         <span class="totals-label">Amount Paid</span>
         <span class="totals-value" style="color:#059669;font-weight:600;">− ${inr(inv.totalPaid || 0)}</span>
       </div>
       <div class="totals-row" style="background:#FEF3C7;font-weight:700;">
         <span class="totals-label">Balance Due</span>
         <span class="totals-value">${inr(inv.remaining || 0)}</span>
       </div>` : ''}
     </div>
   </div>

   ${(inv.payments && inv.payments.length > 0) ? `
   <div class="section-title" style="margin-top:12px;">Payment History</div>
   <div class="table-outer">
     <table>
       <thead>
         <tr>
           <th>Date</th>
           <th>Method</th>
           <th class="right">Amount</th>
           <th>Note</th>
         </tr>
       </thead>
       <tbody>
         ${inv.payments.map(p => `
           <tr>
             <td>${fmtDate(p.date)}</td>
             <td style="text-transform:capitalize;">${escapeHtml(p.method.replace('_', ' '))}</td>
             <td class="right amount">${inr(p.amount)}</td>
             <td style="color:#6B7280;">${escapeHtml(p.note || '—')}</td>
           </tr>
         `).join('')}
       </tbody>
     </table>
   </div>` : ''}

  ${inv.notes ? `
  <div class="notes">
    <div class="notes-label">Notes</div>
    ${escapeHtml(inv.notes).replace(/\n/g, '<br/>')}
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="footer-thanks">Thank you for your business!</div>
    <div>Generated by PayFlux</div>
  </div>

</body>
</html>`;
}

async function pdf(req, res) {
  let browser;
  try {
    const full = fetchInvoiceFull(req.userId, req.params.id);
    if (!full) return res.status(404).json({ error: 'Invoice not found' });

    // Load user business settings for PDF "From" header
    const settings = db
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(req.userId) || {};

    const html = invoiceHtml(full, settings);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    await browser.close();
    browser = null;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${full.invoice_number}.pdf"`);
    return res.send(Buffer.from(buf));
  } catch (err) {
    console.error(err);
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

module.exports = { create, list, getOne, update, remove, pdf, getNextNumber };
