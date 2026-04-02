const db = require('../db');

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

function create(req, res) {
  const body = req.body || {};
  const errs = validateItemBody(body, false);
  if (errs.length) return res.status(400).json({ error: errs.join('; ') });

  try {
    const row = db.prepare(`
      INSERT INTO items (user_id, name, type, price, description)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `).get(
      req.userId,
      body.name.trim(),
      body.type,
      num(body.price),
      body.description || null
    );
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create item' });
  }
}

function list(req, res) {
  const rows = db
    .prepare('SELECT * FROM items WHERE user_id = ? ORDER BY name ASC')
    .all(req.userId);
  return res.json(rows);
}

function update(req, res) {
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

  const sets = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
  const values = [...Object.values(patch), id, req.userId];

  try {
    const updated = db
      .prepare(`UPDATE items SET ${sets} WHERE id = ? AND user_id = ? RETURNING *`)
      .get(...values);
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update item' });
  }
}

function remove(req, res) {
  const { id } = req.params;
  try {
    const result = db
      .prepare('DELETE FROM items WHERE id = ? AND user_id = ? RETURNING id')
      .get(id, req.userId);
    if (!result) return res.status(404).json({ error: 'Item not found' });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete item' });
  }
}

module.exports = { create, list, update, remove };
