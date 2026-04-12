const { pool, getClient } = require('../db');
const { generatePdf } = require('../browserPool');

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
      quantity = 1;
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

/**
 * Calculate totals with: Subtotal → Discount → Taxable Amount → Taxes → Total
 * @param {Array} lines - parsed line items
 * @param {number} discountRaw - discount value (flat amount or percentage)
 * @param {string} discountType - 'flat' or 'percent'
 * @param {Array} taxes - [{name, rate}] invoice-level taxes
 */
function calculateTotals(lines, discountRaw, discountType = 'flat', taxes = []) {
  const subtotal = roundMoney(
    lines.reduce((s, l) => {
      const amt = l.amount !== undefined && l.amount !== null
        ? num(l.amount)
        : roundMoney(num(l.quantity) * num(l.rate));
      return s + (Number.isFinite(amt) ? amt : 0);
    }, 0)
  );

  // Compute discount
  let discountAmount;
  if (discountType === 'percent') {
    const pct = roundMoney(num(discountRaw));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { error: 'discount percent must be between 0 and 100' };
    }
    discountAmount = roundMoney(subtotal * pct / 100);
  } else {
    discountAmount = roundMoney(num(discountRaw));
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return { error: 'discount must be a non-negative number' };
    }
  }

  const discountValue = roundMoney(num(discountRaw)); // raw value stored
  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));

  // Calculate taxes on taxable amount
  const computedTaxes = [];
  let totalTax = 0;
  for (const t of taxes) {
    const rate = roundMoney(num(t.rate));
    if (!Number.isFinite(rate) || rate < 0) continue;
    const amount = roundMoney(taxableAmount * rate / 100);
    computedTaxes.push({ name: t.name || 'Tax', rate, amount });
    totalTax = roundMoney(totalTax + amount);
  }

  const total = roundMoney(taxableAmount + totalTax);
  return {
    subtotal,
    discount: discountValue,
    discount_type: discountType,
    discount_amount: discountAmount,
    tax_amount: totalTax,
    taxes: computedTaxes,
    total,
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────

async function nextInvoiceNumber(userId) {
  const { rows: settingsRows } = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  const settings = settingsRows[0] || {};
  const type = settings.invoice_generation_type || 'sequential';
  
  if (type === 'manual') {
    return '';
  }

  const prefix = settings.invoice_prefix ?? 'INV-';
  const postfix = settings.invoice_postfix ?? '';

  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`^${escapeRegExp(prefix)}(\\d+)${escapeRegExp(postfix)}$`);

  const { rows } = await pool.query(
    'SELECT invoice_number FROM invoices WHERE user_id = $1 ORDER BY id DESC LIMIT 20',
    [userId]
  );

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

async function getNextNumber(req, res) {
  try {
    const num = await nextInvoiceNumber(req.userId);
    return res.json({ nextNumber: num });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate number' });
  }
}

async function assertCustomerOwned(userId, customerId) {
  const { rows } = await pool.query(
    'SELECT id FROM customers WHERE id = $1 AND user_id = $2',
    [customerId, userId]
  );
  return rows.length > 0;
}

async function assertItemsOwned(userId, itemIds) {
  const unique = [...new Set(itemIds.filter(Boolean))];
  if (unique.length === 0) return true;
  const placeholders = unique.map((_, i) => `$${i + 2}`).join(',');
  const { rows } = await pool.query(
    `SELECT id FROM items WHERE user_id = $1 AND id IN (${placeholders})`,
    [userId, ...unique]
  );
  return rows.length === unique.length;
}

async function fetchInvoiceFull(userId, invoiceId) {
  const { rows: invRows } = await pool.query(
    'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
    [invoiceId, userId]
  );
  const inv = invRows[0];
  if (!inv) return null;

  const { rows: lines } = await pool.query(
    'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC',
    [invoiceId]
  );
  const { rows: custRows } = await pool.query(
    'SELECT * FROM customers WHERE id = $1',
    [inv.customer_id]
  );
  const { rows: taxRows } = await pool.query(
    'SELECT * FROM invoice_taxes WHERE invoice_id = $1 ORDER BY id ASC',
    [invoiceId]
  );
  const { rows: payments } = await pool.query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY date ASC, id ASC',
    [invoiceId]
  );
  const totalPaid = roundMoney(payments.reduce((s, p) => s + parseFloat(p.amount), 0));
  const remaining = roundMoney(parseFloat(inv.total) - totalPaid);
  return {
    ...inv,
    items: lines,
    taxes: taxRows,
    customer: custRows[0] || null,
    payments,
    totalPaid,
    remaining,
  };
}

// ─── CRUD handlers ────────────────────────────────────────────────────────

async function create(req, res) {
  try {
    const body = req.body || {};
    const { customer_id, issue_date, due_date, status, discount, discount_type, taxes, notes } = body;
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
    if (!(await assertCustomerOwned(req.userId, customer_id))) {
      return res.status(400).json({ error: 'Customer not found' });
    }
    const parsed = parseLines(body.items);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await assertItemsOwned(req.userId, parsed.lines.map((l) => l.item_id)))) {
      return res.status(400).json({ error: 'One or more item_id values are invalid' });
    }

    const dType = discount_type === 'percent' ? 'percent' : 'flat';
    const taxArr = Array.isArray(taxes) ? taxes : [];
    const t = calculateTotals(parsed.lines, discount !== undefined ? discount : 0, dType, taxArr);
    if (t.error) return res.status(400).json({ error: t.error });

    const invoice_number = await nextInvoiceNumber(req.userId);

    const client = await getClient();
    let invoiceId;
    try {
      await client.query('BEGIN');

      const { rows: invRows } = await client.query(
        `INSERT INTO invoices
          (user_id, customer_id, invoice_number, issue_date, due_date, status,
           subtotal, discount, discount_type, tax_amount, total, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          req.userId, customer_id, invoice_number, issue_date, due_date, status,
          t.subtotal, t.discount, dType, t.tax_amount, t.total,
          typeof notes === 'string' ? notes : '',
        ]
      );
      invoiceId = invRows[0].id;

      for (const l of parsed.lines) {
        await client.query(
          'INSERT INTO invoice_items (invoice_id, item_id, name, quantity, rate, amount) VALUES ($1, $2, $3, $4, $5, $6)',
          [invoiceId, l.item_id, l.name, l.quantity, l.rate, l.amount]
        );
      }

      // Insert tax rows
      for (const tx of t.taxes) {
        await client.query(
          'INSERT INTO invoice_taxes (invoice_id, name, rate, amount) VALUES ($1, $2, $3, $4)',
          [invoiceId, tx.name, tx.rate, tx.amount]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const full = await fetchInvoiceFull(req.userId, invoiceId);
    return res.status(201).json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create invoice' });
  }
}

async function list(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT i.*,
             c.name AS customer_name, c.email AS customer_email, c.company_name AS customer_company,
             COALESCE(p.total_paid, 0) AS total_paid
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
    `, [req.userId]);

    const shaped = rows.map(({ customer_name, customer_email, customer_company, total_paid, ...inv }) => ({
      ...inv,
      customers: { name: customer_name, email: customer_email, company_name: customer_company },
      totalPaid: roundMoney(parseFloat(total_paid)),
      remaining: roundMoney(parseFloat(inv.total) - parseFloat(total_paid)),
    }));
    return res.json(shaped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list invoices' });
  }
}

async function getOne(req, res) {
  try {
    const full = await fetchInvoiceFull(req.userId, req.params.id);
    if (!full) return res.status(404).json({ error: 'Invoice not found' });
    return res.json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load invoice' });
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await fetchInvoiceFull(req.userId, id);
    if (!existing) return res.status(404).json({ error: 'Invoice not found' });

    const body = req.body || {};
    const patch = {};

    if (body.customer_id !== undefined) {
      if (!(await assertCustomerOwned(req.userId, body.customer_id))) {
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

    let newLines = null;
    let newTaxes = null;

    // Recalculate totals if items, discount, or taxes changed
    const needsRecalc = body.items !== undefined || body.discount !== undefined || body.taxes !== undefined || body.discount_type !== undefined;

    if (needsRecalc) {
      let lines;
      if (body.items !== undefined) {
        const parsed = parseLines(body.items);
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        if (!(await assertItemsOwned(req.userId, parsed.lines.map((l) => l.item_id)))) {
          return res.status(400).json({ error: 'One or more item_id values are invalid' });
        }
        newLines = parsed.lines;
        lines = parsed.lines;
      } else {
        lines = existing.items || [];
      }

      const disc = body.discount !== undefined ? body.discount : existing.discount;
      const dType = body.discount_type !== undefined ? body.discount_type : (existing.discount_type || 'flat');
      const taxArr = body.taxes !== undefined ? (Array.isArray(body.taxes) ? body.taxes : []) : (existing.taxes || []);

      const t = calculateTotals(lines, disc, dType, taxArr);
      if (t.error) return res.status(400).json({ error: t.error });

      patch.subtotal = t.subtotal;
      patch.discount = t.discount;
      patch.discount_type = t.discount_type;
      patch.tax_amount = t.tax_amount;
      patch.total = t.total;
      newTaxes = t.taxes;
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      if (Object.keys(patch).length > 0) {
        const keys = Object.keys(patch);
        const values = Object.values(patch);
        const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        values.push(id, req.userId);
        await client.query(
          `UPDATE invoices SET ${sets} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}`,
          values
        );
      }

      if (newLines) {
        await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
        for (const l of newLines) {
          await client.query(
            'INSERT INTO invoice_items (invoice_id, item_id, name, quantity, rate, amount) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, l.item_id, l.name, l.quantity, l.rate, l.amount]
          );
        }
      }

      if (newTaxes !== null) {
        await client.query('DELETE FROM invoice_taxes WHERE invoice_id = $1', [id]);
        for (const tx of newTaxes) {
          await client.query(
            'INSERT INTO invoice_taxes (invoice_id, name, rate, amount) VALUES ($1, $2, $3, $4)',
            [id, tx.name, tx.rate, tx.amount]
          );
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const full = await fetchInvoiceFull(req.userId, id);
    return res.json(full);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update invoice' });
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
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

function inrToWords(num) {
  num = Math.floor(Number(num));
  if (num === 0) return 'Zero Rupees Only';
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  let str = '';
  if ((Math.abs(num)).toString().length > 9) return 'Overflow';
  let n = ('000000000' + Math.abs(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'And ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return 'INR ' + str.trim() + ' Rupees Only';
}

function invoiceHtml(inv, settings = {}) {
  const c = inv.customer || {};
  const lines = inv.items || [];
  const taxes = inv.taxes || [];
  const from = settings;

  let totalQty = 0;

  const lineRows = lines.map((l, idx) => {
    totalQty += Number(l.quantity);
    return `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <div class="item-name">${escapeHtml(l.name)}</div>
        <div style="font-size: 8px; color: #555;">HSN: N/A</div>
      </td>
      <td class="right">${inr(l.rate).replace('₹', '')}</td>
      <td class="right">${Number(l.quantity)}</td>
      <td class="right">${inr(l.amount).replace('₹', '')}</td>
      <td class="right amount">${inr(l.amount).replace('₹', '')}</td>
    </tr>
  `}).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Helvetica:wght@400;700&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Helvetica', Arial, sans-serif;
      color: #111827;
      background: #fff;
      padding: 40px;
      font-size: 11px;
      line-height: 1.4;
    }

    /* ── Header ── */
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 20px;
    }
    .tax-invoice-label {
      font-size: 14px;
      font-weight: bold;
      color: #1e3a8b;
      letter-spacing: 1px;
    }
    .original-recipient {
      font-size: 11px;
      font-weight: bold;
      color: #4b5563;
    }

    .header-main {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 15px;
    }
    .biz-details { max-width: 60%; }
    .biz-name { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
    .biz-meta { font-size: 10px; color: #374151; }
    .logo-container img {
      max-height: 60px;
      max-width: 200px;
      object-fit: contain;
    }

    .invoice-meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 15px;
    }

    .address-row {
      display: flex;
      margin-bottom: 15px;
      border-bottom: 1px solid #111;
      padding-bottom: 10px;
    }
    .address-col { flex: 1; padding-right: 15px; }
    .address-col:last-child { padding-right: 0; }
    .address-label { font-size: 10px; color: #111; margin-bottom: 5px; }
    .address-content { font-size: 10px; line-height: 1.4; color: #111; }

    /* ── Line items table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 10px;
      border-bottom: 1px solid #111;
      border-top: 1px solid #111;
    }
    thead th {
      text-align: left;
      padding: 6px 4px;
      border-bottom: 1px solid #111;
      font-weight: bold;
    }
    thead th.right { text-align: right; }
    tbody td {
      padding: 6px 4px;
      vertical-align: top;
    }
    tbody td.right { text-align: right; }
    .item-name { font-weight: normal; margin-bottom: 2px; }

    /* ── Totals ── */
    .totals-area {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 10px;
    }
    .totals-words {
      font-size: 10px;
      color: #6b7280;
      padding-top: 5px;
    }
    .totals-block { width: 300px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
    }
    .totals-row.grand {
      font-size: 13px;
      font-weight: bold;
      border-top: 1px solid #111;
      border-bottom: 1px solid #111;
      padding: 4px 0;
      margin-top: 2px;
    }
    .totals-row.payable {
      font-size: 11px;
      display: flex;
      justify-content: flex-end;
      gap: 30px;
      padding-top: 6px;
    }

    /* ── Payment & Footer ── */
    .payment-row {
      display: flex;
      margin-top: 20px;
      font-size: 10px;
    }
    .payment-qr { width: 120px; padding-right: 20px; }
    .payment-qr img { width: 100px; height: 100px; }
    .bank-details { flex: 1; }
    .bank-row {
      display: flex;
      margin-bottom: 3px;
    }
    .bank-label { width: 60px; color: #111; font-weight: bold; }
    .bank-val { font-weight: normal; }

    .signature-block {
      width: 150px;
      text-align: right;
      margin-top: 10px;
    }
    .stamp-circle {
      border: 1px dashed #1e3a8a;
      color: #1e3a8a;
      border-radius: 50%;
      width: 80px;
      height: 80px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 5px;
      margin-right: 15px;
      transform: rotate(-15deg);
      opacity: 0.6;
    }
    .auth-sign-label { font-size: 10px; color: #555; margin-right: 15px; }

    .notes {
      margin-top: 20px;
      font-size: 9px;
      color: #111;
    }
    .notes ol {
      padding-left: 15px;
      margin-top: 4px;
    }

    .footer {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #9CA3AF;
      font-size: 9px;
    }
  </style>
</head>
<body>

  <!-- Header Top -->
  <div class="header-top">
    <div class="tax-invoice-label">TAX INVOICE</div>
    <div class="original-recipient">ORIGINAL FOR RECIPIENT</div>
  </div>

  <!-- Header Main -->
  <div class="header-main">
    <div class="biz-details">
      <div class="biz-name">${escapeHtml(from.business_name || 'Your Business')}</div>
      <div class="biz-meta">
        ${from.gstin ? `<strong>GSTIN</strong> ${escapeHtml(from.gstin)}<br/>` : ''}
        ${escapeHtml(from.business_address || '').replace(/\n/g, '<br/>')}<br/>
        ${from.phone ? `<strong>Mobile</strong> ${escapeHtml(from.phone)}` : ''}
      </div>
    </div>
    <div class="logo-container">
      ${from.logo
        ? (() => {
            const isPng = from.logo.startsWith('data:image/png');
            return `<img src="${from.logo}" class="${isPng ? 'is-png' : ''}" alt="${escapeHtml(from.business_name || 'Logo')}" />`;
          })()
        : `<div class="biz-name" style="font-size: 40px; margin: 0;">${escapeHtml(from.business_name || 'PayFlux')}</div>`
      }
    </div>
  </div>

  <!-- Meta -->
  <div class="invoice-meta-row">
    <div>Invoice #: ${escapeHtml(inv.invoice_number)}</div>
    <div>Invoice Date: ${fmtDate(inv.issue_date)}</div>
    <div>Due Date: ${fmtDate(inv.due_date)}</div>
  </div>

  <!-- Addresses -->
  <div class="address-row">
    <div class="address-col">
      <div class="address-label">Customer Details:</div>
      <div class="address-content">
        <strong>${escapeHtml(c.name || '')}</strong><br/>
        ${c.company_name ? `${escapeHtml(c.company_name)}<br/>` : ''}
        ${c.phone ? `Ph: ${escapeHtml(c.phone)}<br/>` : ''}
        <br/>
        Place of Supply: <strong>LOCAL</strong>
      </div>
    </div>
    <div class="address-col">
      <div class="address-label">Billing address:</div>
      <div class="address-content">
        ${escapeHtml(c.address || '').replace(/\n/g, '<br/>')}
      </div>
    </div>
    <div class="address-col">
      <div class="address-label">Shipping address:</div>
      <div class="address-content">
        ${escapeHtml(c.address || '').replace(/\n/g, '<br/>')}
      </div>
    </div>
  </div>

  <!-- Items -->
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th class="right">Rate/Item</th>
        <th class="right">Qty</th>
        <th class="right">Taxable Value</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-area">
    <div class="totals-words">
      Total Items / Qty : ${lines.length} / ${totalQty.toFixed(3)}<br/><br/>
      Total amount (in words): ${inrToWords(inv.total)}
    </div>
    <div class="totals-block">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${inr(inv.subtotal)}</span>
      </div>
      ${Number(inv.discount) > 0 ? `
      <div class="totals-row">
        <span>Discount${inv.discount_type === 'percent' ? ` (${Number(inv.discount)}%)` : ''}</span>
        <span>- ${inv.discount_type === 'percent' ? inr(roundMoney(parseFloat(inv.subtotal) * parseFloat(inv.discount) / 100)) : inr(inv.discount)}</span>
      </div>` : ''}
      ${taxes.length > 0 ? taxes.map(t => `
      <div class="totals-row">
        <span>${escapeHtml(t.name)} (${Number(t.rate)}%)</span>
        <span>${inr(t.amount)}</span>
      </div>`).join('') : ''}
      <div class="totals-row grand">
        <span>Total</span>
        <span>${inr(inv.total)}</span>
      </div>
      <div class="totals-row payable">
        <span>Amount Payable:</span>
        <span style="font-weight: bold;">${inr(inv.remaining !== undefined ? inv.remaining : inv.total)}</span>
      </div>
    </div>
  </div>

  <!-- Payment & Bank -->
  <div class="payment-row">
    ${from.upi_id || from.upi_qr ? `
    <div class="payment-qr">
      <strong>Pay using UPI:</strong><br/>
      ${from.upi_qr ? `<img src="${from.upi_qr}" alt="UPI QR"/>` : ''}
    </div>` : ''}

    <div class="bank-details">
      ${from.bank_account_number ? `
      <strong>Bank Details:</strong>
      <div style="margin-top: 5px;">
        ${from.bank_name ? `<div class="bank-row"><div class="bank-label">Bank:</div><div class="bank-val">${escapeHtml(from.bank_name)}</div></div>` : ''}
        <div class="bank-row"><div class="bank-label">Account #:</div><div class="bank-val">${escapeHtml(from.bank_account_number)}</div></div>
        ${from.bank_ifsc ? `<div class="bank-row"><div class="bank-label">IFSC:</div><div class="bank-val">${escapeHtml(from.bank_ifsc)}</div></div>` : ''}
        ${from.bank_branch ? `<div class="bank-row"><div class="bank-label">Branch:</div><div class="bank-val">${escapeHtml(from.bank_branch)}</div></div>` : ''}
      </div>` : ''}
    </div>

    <!-- Signature Block -->
    <div class="signature-block">
      <div style="margin-bottom: 25px; margin-right: 5px;">For ${escapeHtml(from.business_name || 'Business')}</div>
      <div class="stamp-circle">SIGNATURE</div>
      <div class="auth-sign-label">Authorized Signatory</div>
    </div>
  </div>

  <!-- Notes -->
  <div class="notes">
    ${inv.notes ? `<strong>Notes:</strong><br/>${escapeHtml(inv.notes).replace(/\n/g, '<br/>')}<br/><br/>` : ''}
    <strong>Terms and Conditions:</strong>
    <ol>
      <li>Goods once sold cannot be taken back or exchanged.</li>
      <li>We are not the manufacturers, company will stand for warranty as per their terms and conditions.</li>
      <li>Interest @24% p.a. will be charged for uncleared bills beyond 15 days.</li>
      <li>Subject to local jurisdiction.</li>
    </ol>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Page 1 / 1</div>
    <div>This is a digitally signed document. Generated by PayFlux.</div>
  </div>

</body>
</html>`;
}

async function pdf(req, res) {
  try {
    const full = await fetchInvoiceFull(req.userId, req.params.id);
    if (!full) return res.status(404).json({ error: 'Invoice not found' });

    // Load user business settings for PDF "From" header
    const { rows: settingsRows } = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    const settings = settingsRows[0] || {};

    const html = invoiceHtml(full, settings);
    const buf = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${full.invoice_number}.pdf"`);
    return res.send(buf);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

module.exports = { create, list, getOne, update, remove, pdf, getNextNumber };
