const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res) {
  const { email, password } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const normalized = email.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  try {
    const stmt = db.prepare(
      'INSERT INTO users (email, password) VALUES (?, ?) RETURNING id, email'
    );
    const user = stmt.get(normalized, hash);
    // Create empty settings row for the new user
    db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(user.id);
    const token = signToken(user.id);
    return res.status(201).json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
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
  const user = db.prepare('SELECT id, email, password FROM users WHERE email = ?').get(normalized);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(user.id);
  return res.json({ user: { id: user.id, email: user.email }, token });
}

function getProfile(req, res) {
  let settings = db
    .prepare('SELECT * FROM user_settings WHERE user_id = ?')
    .get(req.userId);
  if (!settings) {
    // Create defaults if missing (edge case for old accounts)
    db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(req.userId);
    settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  }
  return res.json(settings);
}

function updateProfile(req, res) {
  const { business_name, business_address, gstin, phone } = req.body || {};
  db.prepare(`
    INSERT INTO user_settings (user_id, business_name, business_address, gstin, phone, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    ON CONFLICT(user_id) DO UPDATE SET
      business_name    = excluded.business_name,
      business_address = excluded.business_address,
      gstin            = excluded.gstin,
      phone            = excluded.phone,
      updated_at       = excluded.updated_at
  `).run(
    req.userId,
    typeof business_name === 'string' ? business_name.trim() : '',
    typeof business_address === 'string' ? business_address.trim() : '',
    typeof gstin === 'string' ? gstin.trim() : '',
    typeof phone === 'string' ? phone.trim() : ''
  );
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  return res.json(settings);
}

// Max logo size: 2 MB in base64 ≈ ~2.7 MB string; we cap at 3 MB string length
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

function uploadLogo(req, res) {
  const { logo } = req.body || {};
  if (logo === '' || logo === null || logo === undefined) {
    // Allow clearing the logo
    db.prepare(
      `UPDATE user_settings SET logo = '', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE user_id = ?`
    ).run(req.userId);
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
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(req.userId);
  db.prepare(
    `UPDATE user_settings SET logo = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE user_id = ?`
  ).run(logo, req.userId);
  return res.json({ logo });
}

module.exports = { register, login, getProfile, updateProfile, uploadLogo };
