const { pool } = require('../db');

const TYPES = new Set(['business', 'individual']);

function validateCustomerBody(body, partial = false) {
  const errors = [];
  if (!partial || body.type !== undefined) {
    if (!TYPES.has(body.type)) errors.push('type must be business or individual');
  }
  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    }
  }
  if (!partial || body.email !== undefined) {
    if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
      errors.push('email is required');
    }
  }
  if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') {
    errors.push('phone must be a string');
  }
  if (body.company_name !== undefined && body.company_name !== null && typeof body.company_name !== 'string') {
    errors.push('company_name must be a string');
  }
  if (body.address !== undefined && body.address !== null && typeof body.address !== 'string') {
    errors.push('address must be a string');
  }
  return errors;
}

async function create(req, res) {
  const body = req.body || {};
  const errs = validateCustomerBody(body, false);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (user_id, type, name, email, phone, company_name, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.userId,
        body.type,
        body.name.trim(),
        body.email.trim(),
        typeof body.phone === 'string' ? body.phone : '',
        body.company_name || null,
        body.address || null,
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
}

async function list(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customers WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list customers' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const body = req.body || {};
  const errs = validateCustomerBody(body, true);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  const patch = {};
  if (body.type !== undefined) patch.type = body.type;
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.email !== undefined) patch.email = body.email.trim();
  if (body.phone !== undefined) patch.phone = typeof body.phone === 'string' ? body.phone : '';
  if (body.company_name !== undefined) patch.company_name = body.company_name || null;
  if (body.address !== undefined) patch.address = body.address || null;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const keys = Object.keys(patch);
  const values = Object.values(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  values.push(id, req.userId);

  try {
    const { rows } = await pool.query(
      `UPDATE customers SET ${sets} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'DELETE FROM customers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    return res.status(204).send();
  } catch (err) {
    if (err.message && err.message.includes('violates foreign key')) {
      return res.status(409).json({ error: 'Cannot delete customer with existing invoices' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
}

async function getOne(req, res) {
  const { id } = req.params;
  try {
    const { rows: custRows } = await pool.query(
      'SELECT * FROM customers WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (custRows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const { rows: invoices } = await pool.query(`
      SELECT i.*,
             COALESCE(p.total_paid, 0) AS total_paid
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.customer_id = $1 AND i.user_id = $2
      ORDER BY i.created_at DESC
    `, [id, req.userId]);

    const shaped = invoices.map(({ total_paid, ...inv }) => ({
      ...inv,
      totalPaid: Math.round(parseFloat(total_paid) * 100) / 100,
      remaining: Math.round((parseFloat(inv.total) - parseFloat(total_paid)) * 100) / 100,
    }));

    return res.json({ ...custRows[0], invoices: shaped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load customer' });
  }
}

async function getAnalytics(req, res) {
  const { id } = req.params;
  try {
    // Verify customer belongs to user
    const { rows: custCheck } = await pool.query(
      'SELECT id FROM customers WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (custCheck.length === 0) return res.status(404).json({ error: 'Customer not found' });

    // Total revenue + invoice count + status breakdown
    const { rows: invoiceStats } = await pool.query(`
      SELECT
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(i.total), 0) AS total_revenue,
        COUNT(*) FILTER (WHERE i.status = 'paid')::int    AS count_paid,
        COUNT(*) FILTER (WHERE i.status = 'draft')::int   AS count_draft,
        COUNT(*) FILTER (WHERE i.status = 'sent')::int    AS count_sent,
        COUNT(*) FILTER (WHERE i.status = 'overdue')::int AS count_overdue,
        COUNT(*) FILTER (WHERE i.status = 'partial')::int AS count_partial
      FROM invoices i
      WHERE i.customer_id = $1 AND i.user_id = $2
    `, [id, req.userId]);

    const stats = invoiceStats[0];
    const invoiceCount = parseInt(stats.invoice_count);
    const totalRevenue = Math.round(parseFloat(stats.total_revenue) * 100) / 100;
    const avgInvoiceValue = invoiceCount > 0
      ? Math.round((totalRevenue / invoiceCount) * 100) / 100
      : 0;

    // Outstanding balance
    const { rows: outstandingRows } = await pool.query(`
      SELECT COALESCE(SUM(i.total - COALESCE(p.total_paid, 0)), 0) AS outstanding
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE i.customer_id = $1 AND i.user_id = $2
        AND i.status IN ('draft', 'sent', 'overdue', 'partial')
    `, [id, req.userId]);
    const outstandingBalance = Math.round(parseFloat(outstandingRows[0].outstanding) * 100) / 100;

    // Most purchased items (top 5 by total quantity)
    const { rows: topItems } = await pool.query(`
      SELECT ii.name,
             SUM(ii.quantity)::numeric AS total_qty,
             SUM(ii.amount)::numeric AS total_amount,
             COUNT(DISTINCT ii.invoice_id)::int AS invoice_appearances
      FROM invoice_items ii
      INNER JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.customer_id = $1 AND i.user_id = $2
      GROUP BY ii.name
      ORDER BY total_qty DESC
      LIMIT 5
    `, [id, req.userId]);

    // Average payment time (days between issue_date and first payment)
    const { rows: payTimes } = await pool.query(`
      SELECT
        AVG(sub.days)::numeric AS avg_days
      FROM (
        SELECT (MIN(p.date)::date - i.issue_date::date) AS days
        FROM invoices i
        INNER JOIN payments p ON p.invoice_id = i.id
        WHERE i.customer_id = $1 AND i.user_id = $2
        GROUP BY i.id, i.issue_date
        HAVING (MIN(p.date)::date - i.issue_date::date) >= 0
      ) sub
    `, [id, req.userId]);
    const avgPaymentDays = payTimes[0].avg_days !== null
      ? Math.round(parseFloat(payTimes[0].avg_days) * 10) / 10
      : null;

    return res.json({
      totalRevenue,
      invoiceCount,
      avgInvoiceValue,
      outstandingBalance,
      avgPaymentDays,
      statusBreakdown: {
        paid: parseInt(stats.count_paid),
        draft: parseInt(stats.count_draft),
        sent: parseInt(stats.count_sent),
        overdue: parseInt(stats.count_overdue),
        partial: parseInt(stats.count_partial),
      },
      topItems: topItems.map(r => ({
        name: r.name,
        totalQty: parseFloat(r.total_qty),
        totalAmount: Math.round(parseFloat(r.total_amount) * 100) / 100,
        invoiceAppearances: r.invoice_appearances,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to compute customer analytics' });
  }
}

module.exports = { create, list, update, remove, getOne, getAnalytics };
