const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res) {
  const { email, password, first_name, last_name } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const normalized = email.trim().toLowerCase();
  const fname = (typeof first_name === 'string' ? first_name.trim() : '');
  const lname = (typeof last_name === 'string' ? last_name.trim() : '');
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
      [normalized, hash, fname, lname]
    );
    const user = rows[0];
    // Create empty settings row for the new user
    await pool.query(
      'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [user.id]
    );
    const token = signToken(user.id);
    return res.status(201).json({ user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name }, token });
  } catch (err) {
    if (err.message && (err.message.includes('unique') || err.message.includes('duplicate'))) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query(
    'SELECT id, email, password, first_name, last_name FROM users WHERE LOWER(email) = $1',
    [normalized]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user.id);
  return res.json({ user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name }, token });
}

async function getProfile(req, res) {
  let { rows } = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [req.userId]
  );
  if (rows.length === 0) {
    // Create defaults if missing (edge case for old accounts)
    await pool.query(
      'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [req.userId]
    );
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    rows = result.rows;
  }
  return res.json(rows[0]);
}

async function updateProfile(req, res) {
  const { 
    business_name, 
    business_address, 
    gstin, 
    phone,
    invoice_generation_type,
    invoice_prefix,
    invoice_postfix,
    bank_account_name,
    bank_account_number,
    bank_ifsc,
    bank_name,
    bank_branch,
    upi_id,
    upi_qr
  } = req.body || {};

  await pool.query(`
    INSERT INTO user_settings (
      user_id, business_name, business_address, gstin, phone, 
      invoice_generation_type, invoice_prefix, invoice_postfix,
      bank_account_name, bank_account_number, bank_ifsc, bank_name, bank_branch,
      upi_id, upi_qr,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
    ON CONFLICT(user_id) DO UPDATE SET
      business_name           = EXCLUDED.business_name,
      business_address        = EXCLUDED.business_address,
      gstin                   = EXCLUDED.gstin,
      phone                   = EXCLUDED.phone,
      invoice_generation_type = EXCLUDED.invoice_generation_type,
      invoice_prefix          = EXCLUDED.invoice_prefix,
      invoice_postfix         = EXCLUDED.invoice_postfix,
      bank_account_name       = EXCLUDED.bank_account_name,
      bank_account_number     = EXCLUDED.bank_account_number,
      bank_ifsc               = EXCLUDED.bank_ifsc,
      bank_name               = EXCLUDED.bank_name,
      bank_branch             = EXCLUDED.bank_branch,
      upi_id                  = EXCLUDED.upi_id,
      upi_qr                  = EXCLUDED.upi_qr,
      updated_at              = EXCLUDED.updated_at
  `, [
    req.userId,
    typeof business_name === 'string' ? business_name.trim() : '',
    typeof business_address === 'string' ? business_address.trim() : '',
    typeof gstin === 'string' ? gstin.trim() : '',
    typeof phone === 'string' ? phone.trim() : '',
    typeof invoice_generation_type === 'string' && ['sequential', 'manual'].includes(invoice_generation_type) ? invoice_generation_type : 'sequential',
    typeof invoice_prefix === 'string' ? invoice_prefix : 'INV-',
    typeof invoice_postfix === 'string' ? invoice_postfix : '',
    typeof bank_account_name === 'string' ? bank_account_name.trim() : '',
    typeof bank_account_number === 'string' ? bank_account_number.trim() : '',
    typeof bank_ifsc === 'string' ? bank_ifsc.trim().toUpperCase() : '',
    typeof bank_name === 'string' ? bank_name.trim() : '',
    typeof bank_branch === 'string' ? bank_branch.trim() : '',
    typeof upi_id === 'string' ? upi_id.trim() : '',
    typeof upi_qr === 'string' ? upi_qr : '',
  ]);
  const { rows } = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.userId]);
  return res.json(rows[0]);
}

// Max logo size: 2 MB in base64 ≈ ~2.7 MB string; we cap at 3 MB string length
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

async function uploadLogo(req, res) {
  const { logo } = req.body || {};
  if (logo === '' || logo === null || logo === undefined) {
    // Allow clearing the logo
    await pool.query(
      `UPDATE user_settings SET logo = '', updated_at = NOW() WHERE user_id = $1`,
      [req.userId]
    );
    return res.json({ logo: '' });
  }
  if (typeof logo !== 'string') {
    return res.status(400).json({ error: 'logo must be a base64 data URL string' });
  }
  // Validate it's an image data URL
  if (!/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/.test(logo)) {
    return res.status(400).json({ error: 'logo must be an image data URL (png, jpeg, gif, webp, svg)' });
  }
  if (logo.length > MAX_LOGO_BYTES) {
    return res.status(400).json({ error: 'Logo image too large (max 2 MB)' });
  }
  // Ensure settings row exists
  await pool.query(
    'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
    [req.userId]
  );
  await pool.query(
    `UPDATE user_settings SET logo = $1, updated_at = NOW() WHERE user_id = $2`,
    [logo, req.userId]
  );
  return res.json({ logo });
}

module.exports = { register, login, getProfile, updateProfile, uploadLogo };
