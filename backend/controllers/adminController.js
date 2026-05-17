const { pool } = require('../db');

// ── Global dashboard stats ──
async function getDashboardStats(req, res) {
  const stats = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'business') AS total_businesses,
      (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_customers,
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM invoices) AS total_invoices,
      (SELECT COALESCE(SUM(total), 0) FROM invoices) AS total_revenue,
      (SELECT COUNT(*) FROM invoices WHERE status = 'paid') AS paid_invoices,
      (SELECT COUNT(*) FROM invoices WHERE status = 'overdue') AS overdue_invoices,
      (SELECT COUNT(*) FROM customer_links) AS total_links,
      (SELECT COALESCE(SUM(amount), 0) FROM payments) AS total_payments_collected
  `);
  return res.json(stats.rows[0]);
}

// ── List all users with role filtering ──
async function listUsers(req, res) {
  const { role, search, page = 1, limit = 25 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (role && ['admin', 'business', 'customer'].includes(role)) {
    conditions.push(`u.role = $${paramIdx++}`);
    params.push(role);
  }

  if (search && typeof search === 'string' && search.trim()) {
    conditions.push(`(LOWER(u.email) LIKE $${paramIdx} OR LOWER(u.first_name) LIKE $${paramIdx} OR LOWER(u.last_name) LIKE $${paramIdx})`);
    params.push(`%${search.trim().toLowerCase()}%`);
    paramIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
            COALESCE(us.business_name, '') AS business_name
     FROM users u
     LEFT JOIN user_settings us ON us.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  return res.json({ users: rows, total, page: parseInt(page), limit: parseInt(limit) });
}

// ── Get single user details ──
async function getUserDetail(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
            us.business_name, us.business_address, us.gstin, us.phone
     FROM users u
     LEFT JOIN user_settings us ON us.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

  const user = rows[0];

  // Get stats based on role
  if (user.role === 'business') {
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM invoices WHERE user_id = $1) AS invoice_count,
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE user_id = $1) AS total_revenue,
        (SELECT COUNT(*) FROM customers WHERE user_id = $1) AS customer_count,
        (SELECT COUNT(*) FROM customer_links WHERE business_user_id = $1) AS linked_customers
    `, [userId]);
    user.stats = statsResult.rows[0];
  } else if (user.role === 'customer') {
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM customer_links WHERE customer_user_id = $1) AS linked_businesses
    `, [userId]);
    user.stats = statsResult.rows[0];
  }

  return res.json(user);
}

// ── Update user role ──
async function updateUserRole(req, res) {
  const userId = parseInt(req.params.id, 10);
  const { role } = req.body || {};

  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
  if (!role || !['admin', 'business', 'customer'].includes(role)) {
    return res.status(400).json({ error: 'Valid role is required (admin, business, customer)' });
  }

  // Prevent admin from removing their own admin role
  if (userId === req.userId && role !== 'admin') {
    return res.status(400).json({ error: 'Cannot remove your own admin role' });
  }

  await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
  return res.json({ message: 'Role updated successfully' });
}

// ── List all businesses with stats ──
async function listBusinesses(req, res) {
  const { search, page = 1, limit = 25 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const conditions = [`u.role = 'business'`];
  const params = [];
  let paramIdx = 1;

  if (search && typeof search === 'string' && search.trim()) {
    conditions.push(`(LOWER(u.email) LIKE $${paramIdx} OR LOWER(COALESCE(us.business_name, '')) LIKE $${paramIdx})`);
    params.push(`%${search.trim().toLowerCase()}%`);
    paramIdx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM users u LEFT JOIN user_settings us ON us.user_id = u.id ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.created_at,
            COALESCE(us.business_name, '') AS business_name,
            COALESCE(us.phone, '') AS phone,
            (SELECT COUNT(*) FROM invoices WHERE user_id = u.id) AS invoice_count,
            (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE user_id = u.id) AS total_revenue,
            (SELECT COUNT(*) FROM customer_links WHERE business_user_id = u.id) AS linked_customers
     FROM users u
     LEFT JOIN user_settings us ON us.user_id = u.id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  return res.json({ businesses: rows, total, page: parseInt(page), limit: parseInt(limit) });
}

// ── Global payments view ──
async function listAllPayments(req, res) {
  const { business_id, status, page = 1, limit = 25 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (business_id) {
    conditions.push(`i.user_id = $${paramIdx++}`);
    params.push(parseInt(business_id));
  }

  if (status) {
    conditions.push(`i.status = $${paramIdx++}`);
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM payments p JOIN invoices i ON i.id = p.invoice_id ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count);

  const { rows } = await pool.query(
    `SELECT p.*, i.invoice_number, i.total AS invoice_total, i.status AS invoice_status,
            i.user_id AS business_user_id,
            COALESCE(us.business_name, bu.email) AS business_name,
            c.name AS customer_name
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN users bu ON bu.id = i.user_id
     LEFT JOIN user_settings us ON us.user_id = i.user_id
     LEFT JOIN customers c ON c.id = i.customer_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, parseInt(limit), offset]
  );

  return res.json({ payments: rows, total, page: parseInt(page), limit: parseInt(limit) });
}

module.exports = { getDashboardStats, listUsers, getUserDetail, updateUserRole, listBusinesses, listAllPayments };
