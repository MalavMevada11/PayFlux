const crypto = require('crypto');
const { pool } = require('../db');

/**
 * Generate a random alphanumeric code (8 chars, uppercase).
 */
function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
}

// ── Generate a company invite code (business only) ──
async function generateCompanyCode(req, res) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await pool.query(
    `INSERT INTO invitations (code, type, inviter_id, expires_at)
     VALUES ($1, 'company_to_customer', $2, $3)`,
    [code, req.userId, expiresAt]
  );

  return res.status(201).json({ code, expires_at: expiresAt.toISOString() });
}

// ── Generate a customer invite code (customer only) ──
async function generateCustomerCode(req, res) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await pool.query(
    `INSERT INTO invitations (code, type, inviter_id, expires_at)
     VALUES ($1, 'customer_to_company', $2, $3)`,
    [code, req.userId, expiresAt]
  );

  return res.status(201).json({ code, expires_at: expiresAt.toISOString() });
}

// ── Connect using an invite code ──
async function connectByCode(req, res) {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  const normalizedCode = code.trim().toUpperCase();

  // Find the invitation
  const { rows } = await pool.query(
    `SELECT * FROM invitations WHERE code = $1 AND used_by IS NULL AND expires_at > NOW()`,
    [normalizedCode]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Invalid, expired, or already used invite code' });
  }

  const invitation = rows[0];

  // Prevent self-linking
  if (invitation.inviter_id === req.userId) {
    return res.status(400).json({ error: 'You cannot use your own invite code' });
  }

  let customerUserId, businessUserId;

  if (invitation.type === 'company_to_customer') {
    // The inviter is a business, the current user must be a customer
    if (req.userRole !== 'customer') {
      return res.status(400).json({ error: 'Only customer accounts can use a company invite code' });
    }
    customerUserId = req.userId;
    businessUserId = invitation.inviter_id;
  } else if (invitation.type === 'customer_to_company') {
    // The inviter is a customer, the current user must be a business
    if (req.userRole !== 'business') {
      return res.status(400).json({ error: 'Only business accounts can use a customer invite code' });
    }
    customerUserId = invitation.inviter_id;
    businessUserId = req.userId;
  } else {
    return res.status(400).json({ error: 'Unknown invitation type' });
  }

  // Check if already linked
  const existing = await pool.query(
    `SELECT id FROM customer_links WHERE customer_user_id = $1 AND business_user_id = $2`,
    [customerUserId, businessUserId]
  );

  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Already linked to this account' });
  }

  // Create the link
  const link = await pool.query(
    `INSERT INTO customer_links (customer_user_id, business_user_id, company_code)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [customerUserId, businessUserId, normalizedCode]
  );

  // Auto-add customer to the business's customers table
  try {
    const custUser = await pool.query(
      `SELECT email, first_name, last_name FROM users WHERE id = $1`,
      [customerUserId]
    );
    if (custUser.rows.length > 0) {
      const cu = custUser.rows[0];
      const fullName = `${cu.first_name || ''} ${cu.last_name || ''}`.trim() || cu.email;
      // Only insert if not already in the business's customers list
      await pool.query(
        `INSERT INTO customers (user_id, type, name, email, phone, company_name, address)
         SELECT $1, 'individual', $2, $3, '', '', ''
         WHERE NOT EXISTS (
           SELECT 1 FROM customers WHERE user_id = $1 AND LOWER(email) = LOWER($3)
         )`,
        [businessUserId, fullName, cu.email]
      );
    }
  } catch (autoAddErr) {
    console.error('Auto-add customer to contacts failed (non-fatal):', autoAddErr.message);
  }

  // Delete the invitation — one-time use, discard after consumed
  await pool.query(`DELETE FROM invitations WHERE id = $1`, [invitation.id]);

  return res.status(201).json({ link: link.rows[0] });
}

// ── Get all links for the current user ──
async function getMyLinks(req, res) {
  let query, params;

  if (req.userRole === 'business') {
    // Business sees their linked customers
    query = `
      SELECT cl.id, cl.status, cl.linked_at, cl.company_code,
             u.id AS customer_id, u.email AS customer_email,
             u.first_name AS customer_first_name, u.last_name AS customer_last_name
      FROM customer_links cl
      JOIN users u ON u.id = cl.customer_user_id
      WHERE cl.business_user_id = $1
      ORDER BY cl.linked_at DESC
    `;
    params = [req.userId];
  } else if (req.userRole === 'customer') {
    // Customer sees their linked businesses
    query = `
      SELECT cl.id, cl.status, cl.linked_at, cl.company_code,
             u.id AS business_id, u.email AS business_email,
             u.first_name AS business_first_name, u.last_name AS business_last_name,
             COALESCE(us.business_name, '') AS business_name
      FROM customer_links cl
      JOIN users u ON u.id = cl.business_user_id
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE cl.customer_user_id = $1
      ORDER BY cl.linked_at DESC
    `;
    params = [req.userId];
  } else if (req.userRole === 'admin') {
    // Admin sees all links
    query = `
      SELECT cl.*,
             cu.email AS customer_email, cu.first_name AS customer_first_name, cu.last_name AS customer_last_name,
             bu.email AS business_email, bu.first_name AS business_first_name, bu.last_name AS business_last_name,
             COALESCE(us.business_name, '') AS business_name
      FROM customer_links cl
      JOIN users cu ON cu.id = cl.customer_user_id
      JOIN users bu ON bu.id = cl.business_user_id
      LEFT JOIN user_settings us ON us.user_id = bu.id
      ORDER BY cl.linked_at DESC
      LIMIT 100
    `;
    params = [];
  } else {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { rows } = await pool.query(query, params);
  return res.json(rows);
}

// ── Remove a link ──
async function removeLink(req, res) {
  const linkId = parseInt(req.params.id, 10);
  if (isNaN(linkId)) {
    return res.status(400).json({ error: 'Invalid link ID' });
  }

  // Verify ownership
  const { rows } = await pool.query(
    `SELECT * FROM customer_links WHERE id = $1`,
    [linkId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const link = rows[0];
  const isOwner = (req.userRole === 'admin') ||
                  (req.userRole === 'business' && link.business_user_id === req.userId) ||
                  (req.userRole === 'customer' && link.customer_user_id === req.userId);

  if (!isOwner) {
    return res.status(403).json({ error: 'Not authorized to remove this link' });
  }

  await pool.query(`DELETE FROM customer_links WHERE id = $1`, [linkId]);
  return res.status(204).end();
}

// ── Get my active invite codes ──
async function getMyInviteCodes(req, res) {
  const { rows } = await pool.query(
    `SELECT id, code, type, invitee_email, used_by, used_at, expires_at, created_at
     FROM invitations
     WHERE inviter_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [req.userId]
  );
  return res.json(rows);
}

module.exports = { generateCompanyCode, generateCustomerCode, connectByCode, getMyLinks, removeLink, getMyInviteCodes };
