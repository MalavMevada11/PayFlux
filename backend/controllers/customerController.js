const db = require('../db');

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

function create(req, res) {
  const body = req.body || {};
  const errs = validateCustomerBody(body, false);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  try {
    const stmt = db.prepare(`
      INSERT INTO customers (user_id, type, name, email, phone, company_name, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);
    const row = stmt.get(
      req.userId,
      body.type,
      body.name.trim(),
      body.email.trim(),
      typeof body.phone === 'string' ? body.phone : '',
      body.company_name || null,
      body.address || null
    );
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
}

function list(req, res) {
  const rows = db
    .prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId);
  return res.json(rows);
}

function update(req, res) {
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

  const sets = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(patch), id, req.userId];

  try {
    const updated = db
      .prepare(`UPDATE customers SET ${sets} WHERE id = ? AND user_id = ? RETURNING *`)
      .get(...values);
    if (!updated) return res.status(404).json({ error: 'Customer not found' });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
}

function remove(req, res) {
  const { id } = req.params;
  try {
    const result = db
      .prepare('DELETE FROM customers WHERE id = ? AND user_id = ? RETURNING id')
      .get(id, req.userId);
    if (!result) return res.status(404).json({ error: 'Customer not found' });
    return res.status(204).send();
  } catch (err) {
    if (err.message && err.message.includes('FOREIGN KEY')) {
      return res.status(409).json({ error: 'Cannot delete customer with existing invoices' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
}

module.exports = { create, list, update, remove };
