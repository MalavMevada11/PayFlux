const { pool } = require('../db');

const TYPES = new Set(['goods', 'service']);

function num(v) {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function validateItemBody(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    }
  }
  if (!partial || body.type !== undefined) {
    if (!TYPES.has(body.type)) errors.push('type must be goods or service');
  }
  if (!partial || body.price !== undefined) {
    const p = num(body.price);
    if (!Number.isFinite(p) || p < 0) errors.push('price must be a non-negative number');
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    errors.push('description must be a string');
  }
  return errors;
}

async function create(req, res) {
  const body = req.body || {};
  const errs = validateItemBody(body, false);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  try {
    const { rows } = await pool.query(
      `INSERT INTO items (user_id, name, type, price, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, body.name.trim(), body.type, num(body.price), body.description || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create item' });
  }
}

async function list(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM items WHERE user_id = $1 ORDER BY name ASC',
      [req.userId]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list items' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const body = req.body || {};
  const errs = validateItemBody(body, true);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  const patch = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.type !== undefined) patch.type = body.type;
  if (body.price !== undefined) patch.price = num(body.price);
  if (body.description !== undefined) patch.description = body.description || null;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const keys = Object.keys(patch);
  const values = Object.values(patch);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  values.push(id, req.userId);

  try {
    const { rows } = await pool.query(
      `UPDATE items SET ${sets} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update item' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'DELETE FROM items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete item' });
  }
}

module.exports = { create, list, update, remove, getOne, getAnalytics };

async function getOne(req, res) {
  const { id } = req.params;
  try {
    const { rows: itemRows } = await pool.query(
      'SELECT * FROM items WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (itemRows.length === 0) return res.status(404).json({ error: 'Item not found' });

    // Invoices containing this item
    const { rows: invoices } = await pool.query(`
      SELECT DISTINCT i.id, i.invoice_number, i.issue_date, i.due_date,
             i.status, i.total, i.created_at,
             c.name AS customer_name, c.company_name AS customer_company,
             ii.quantity, ii.rate, ii.amount AS line_amount,
             COALESCE(p.total_paid, 0) AS total_paid
      FROM invoice_items ii
      INNER JOIN invoices i ON i.id = ii.invoice_id
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE ii.item_id = $1 AND i.user_id = $2
      ORDER BY i.created_at DESC
    `, [id, req.userId]);

    const shaped = invoices.map(({ total_paid, customer_name, customer_company, ...inv }) => ({
      ...inv,
      customer: { name: customer_name, company_name: customer_company },
      totalPaid: Math.round(parseFloat(total_paid) * 100) / 100,
      remaining: Math.round((parseFloat(inv.total) - parseFloat(total_paid)) * 100) / 100,
    }));

    return res.json({ ...itemRows[0], invoices: shaped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load item' });
  }
}

async function getAnalytics(req, res) {
  const { id } = req.params;
  try {
    // Verify item belongs to user
    const { rows: itemCheck } = await pool.query(
      'SELECT id FROM items WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (itemCheck.length === 0) return res.status(404).json({ error: 'Item not found' });

    // Total units sold + total revenue + order count
    const { rows: salesStats } = await pool.query(`
      SELECT
        COALESCE(SUM(ii.quantity), 0)::numeric AS total_qty,
        COALESCE(SUM(ii.amount), 0)::numeric   AS total_revenue,
        COUNT(DISTINCT ii.invoice_id)::int      AS order_count
      FROM invoice_items ii
      INNER JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.item_id = $1 AND i.user_id = $2
    `, [id, req.userId]);

    const s = salesStats[0];
    const totalQty = parseFloat(s.total_qty);
    const totalRevenue = Math.round(parseFloat(s.total_revenue) * 100) / 100;
    const orderCount = s.order_count;
    const avgQtyPerOrder = orderCount > 0
      ? Math.round((totalQty / orderCount) * 100) / 100
      : 0;

    // Top customers buying this item (top 5 by quantity)
    const { rows: topCustomers } = await pool.query(`
      SELECT c.id, c.name, c.company_name,
             SUM(ii.quantity)::numeric AS total_qty,
             SUM(ii.amount)::numeric   AS total_amount,
             COUNT(DISTINCT ii.invoice_id)::int AS order_count
      FROM invoice_items ii
      INNER JOIN invoices i ON i.id = ii.invoice_id
      INNER JOIN customers c ON c.id = i.customer_id
      WHERE ii.item_id = $1 AND i.user_id = $2
      GROUP BY c.id, c.name, c.company_name
      ORDER BY total_qty DESC
      LIMIT 5
    `, [id, req.userId]);

    // Monthly sales trend (last 12 months)
    const { rows: salesTrend } = await pool.query(`
      SELECT TO_CHAR(i.issue_date::date, 'YYYY-MM') AS month,
             SUM(ii.quantity)::numeric AS qty,
             SUM(ii.amount)::numeric   AS revenue
      FROM invoice_items ii
      INNER JOIN invoices i ON i.id = ii.invoice_id
      WHERE ii.item_id = $1 AND i.user_id = $2
      GROUP BY TO_CHAR(i.issue_date::date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `, [id, req.userId]);

    return res.json({
      totalUnitsSold: totalQty,
      totalRevenue,
      orderCount,
      avgQtyPerOrder,
      topCustomers: topCustomers.map(r => ({
        id: r.id,
        name: r.company_name || r.name,
        totalQty: parseFloat(r.total_qty),
        totalAmount: Math.round(parseFloat(r.total_amount) * 100) / 100,
        orderCount: r.order_count,
      })),
      salesTrend: salesTrend.reverse().map(r => ({
        month: r.month,
        qty: parseFloat(r.qty),
        revenue: Math.round(parseFloat(r.revenue) * 100) / 100,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to compute item analytics' });
  }
}
