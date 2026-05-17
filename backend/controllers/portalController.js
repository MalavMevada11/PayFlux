const { pool } = require('../db');
const { generatePdf } = require('../browserPool');

// Import the shared HTML builder from invoiceController
const { buildInvoiceHtml } = require('./invoiceController');

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Get all invoices for the authenticated customer across linked businesses.
 * Returns invoices where the customer's email matches the customer record on the invoice.
 */
async function getMyInvoices(req, res) {
  try {
    const { status, business_id, sort } = req.query;

    // Get customer's email
    const { rows: userRows } = await pool.query(
      'SELECT email FROM users WHERE id = $1', [req.userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const customerEmail = userRows[0].email;

    // Get all linked business IDs
    const { rows: linkRows } = await pool.query(
      `SELECT business_user_id FROM customer_links 
       WHERE customer_user_id = $1 AND status = 'active'`,
      [req.userId]
    );
    const bizIds = linkRows.map(r => r.business_user_id);

    if (bizIds.length === 0) {
      return res.json([]);
    }

    // Build query: find invoices from linked businesses where customer email matches
    let conditions = [`i.user_id = ANY($1::int[])`];
    let params = [bizIds];
    let paramIdx = 2;

    // Match on customer email 
    conditions.push(`LOWER(c.email) = LOWER($${paramIdx})`);
    params.push(customerEmail);
    paramIdx++;

    if (status && ['draft', 'sent', 'paid', 'overdue', 'partial'].includes(status)) {
      conditions.push(`i.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    if (business_id) {
      conditions.push(`i.user_id = $${paramIdx}`);
      params.push(parseInt(business_id, 10));
      paramIdx++;
    }

    // Don't show drafts to customers
    conditions.push(`i.status != 'draft'`);

    const orderBy = sort === 'oldest' ? 'ASC' : 'DESC';

    const { rows } = await pool.query(`
      SELECT i.*, 
             c.name AS customer_name, c.email AS customer_email,
             COALESCE(us.business_name, '') AS business_name,
             bu.email AS business_email,
             COALESCE(p.total_paid, 0) AS total_paid
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      JOIN users bu ON bu.id = i.user_id
      LEFT JOIN user_settings us ON us.user_id = i.user_id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
      ) p ON p.invoice_id = i.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY i.created_at ${orderBy}
    `, params);

    const shaped = rows.map(row => ({
      id: row.id,
      invoice_number: row.invoice_number,
      issue_date: row.issue_date,
      due_date: row.due_date,
      status: row.status,
      subtotal: row.subtotal,
      discount: row.discount,
      discount_type: row.discount_type,
      tax_amount: row.tax_amount,
      total: row.total,
      notes: row.notes,
      created_at: row.created_at,
      business_name: row.business_name,
      business_email: row.business_email,
      business_id: row.user_id,
      customer_name: row.customer_name,
      total_paid: roundMoney(parseFloat(row.total_paid)),
      remaining: roundMoney(parseFloat(row.total) - parseFloat(row.total_paid)),
    }));

    return res.json(shaped);
  } catch (err) {
    console.error('portalController.getMyInvoices:', err);
    return res.status(500).json({ error: 'Failed to load invoices' });
  }
}

/**
 * Get full invoice detail (read-only for customer).
 * Verifies the customer has access via their linked business.
 */
async function getInvoiceDetail(req, res) {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    if (isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice ID' });

    const { rows: userRows } = await pool.query(
      'SELECT email FROM users WHERE id = $1', [req.userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const customerEmail = userRows[0].email;

    // Get invoice
    const { rows: invRows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (invRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRows[0];

    // Check: invoice must belong to a linked business
    const { rows: linkCheck } = await pool.query(
      `SELECT id FROM customer_links 
       WHERE customer_user_id = $1 AND business_user_id = $2 AND status = 'active'`,
      [req.userId, inv.user_id]
    );
    if (linkCheck.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view this invoice' });
    }

    // Check: customer email matches the invoice's customer record
    const { rows: custRows } = await pool.query(
      'SELECT * FROM customers WHERE id = $1', [inv.customer_id]
    );
    const customer = custRows[0] || {};
    if (customer.email && customer.email.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized to view this invoice' });
    }

    // Don't show drafts
    if (inv.status === 'draft') {
      return res.status(403).json({ error: 'This invoice is not yet available' });
    }

    // Get line items
    const { rows: lines } = await pool.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [invoiceId]
    );

    // Get taxes
    const { rows: taxRows } = await pool.query(
      'SELECT * FROM invoice_taxes WHERE invoice_id = $1 ORDER BY id ASC', [invoiceId]
    );

    // Get payments
    const { rows: payments } = await pool.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY date ASC, id ASC', [invoiceId]
    );
    const totalPaid = roundMoney(payments.reduce((s, p) => s + parseFloat(p.amount), 0));
    const remaining = roundMoney(parseFloat(inv.total) - totalPaid);

    // Get business settings (for display)
    const { rows: settingsRows } = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1', [inv.user_id]
    );
    const settings = settingsRows[0] || {};

    // Get payment requests for this invoice
    const { rows: prRows } = await pool.query(
      `SELECT * FROM payment_requests 
       WHERE invoice_id = $1 AND customer_user_id = $2
       ORDER BY created_at DESC`,
      [invoiceId, req.userId]
    );

    return res.json({
      ...inv,
      items: lines,
      taxes: taxRows,
      customer,
      payments,
      totalPaid,
      remaining,
      payment_requests: prRows,
      business: {
        name: settings.business_name || '',
        address: settings.business_address || '',
        gstin: settings.gstin || '',
        phone: settings.phone || '',
        logo: settings.logo || '',
      },
    });
  } catch (err) {
    console.error('portalController.getInvoiceDetail:', err);
    return res.status(500).json({ error: 'Failed to load invoice' });
  }
}

/**
 * Get all payments made on invoices belonging to the customer.
 */
async function getMyPayments(req, res) {
  try {
    const { rows: userRows } = await pool.query(
      'SELECT email FROM users WHERE id = $1', [req.userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const customerEmail = userRows[0].email;

    const { rows: linkRows } = await pool.query(
      `SELECT business_user_id FROM customer_links 
       WHERE customer_user_id = $1 AND status = 'active'`,
      [req.userId]
    );
    const bizIds = linkRows.map(r => r.business_user_id);
    if (bizIds.length === 0) return res.json([]);

    const { rows } = await pool.query(`
      SELECT p.*, 
             i.invoice_number, i.total AS invoice_total, i.status AS invoice_status,
             COALESCE(us.business_name, '') AS business_name,
             bu.email AS business_email
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN customers c ON c.id = i.customer_id
      JOIN users bu ON bu.id = i.user_id
      LEFT JOIN user_settings us ON us.user_id = i.user_id
      WHERE i.user_id = ANY($1::int[])
        AND LOWER(c.email) = LOWER($2)
      ORDER BY p.created_at DESC
    `, [bizIds, customerEmail]);

    return res.json(rows);
  } catch (err) {
    console.error('portalController.getMyPayments:', err);
    return res.status(500).json({ error: 'Failed to load payments' });
  }
}

/**
 * Get portal dashboard stats for the customer.
 */
async function getDashboardStats(req, res) {
  try {
    const { rows: userRows } = await pool.query(
      'SELECT email FROM users WHERE id = $1', [req.userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const customerEmail = userRows[0].email;

    const { rows: linkRows } = await pool.query(
      `SELECT business_user_id FROM customer_links 
       WHERE customer_user_id = $1 AND status = 'active'`,
      [req.userId]
    );
    const bizIds = linkRows.map(r => r.business_user_id);

    if (bizIds.length === 0) {
      return res.json({
        linked_businesses: 0,
        total_invoices: 0,
        pending_amount: 0,
        total_paid: 0,
      });
    }

    // Count invoices + payment stats
    const { rows: stats } = await pool.query(`
      SELECT 
        COUNT(i.id) AS total_invoices,
        COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue','partial') THEN i.total ELSE 0 END), 0) AS pending_total,
        COALESCE(SUM(CASE WHEN i.status IN ('sent','overdue','partial') THEN COALESCE(pp.paid, 0) ELSE 0 END), 0) AS pending_paid,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END), 0) AS total_paid
      FROM invoices i
      JOIN customers c ON c.id = i.customer_id
      LEFT JOIN (
        SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id
      ) pp ON pp.invoice_id = i.id
      WHERE i.user_id = ANY($1::int[])
        AND LOWER(c.email) = LOWER($2)
        AND i.status != 'draft'
    `, [bizIds, customerEmail]);

    const s = stats[0] || {};
    return res.json({
      linked_businesses: bizIds.length,
      total_invoices: parseInt(s.total_invoices) || 0,
      pending_amount: roundMoney(parseFloat(s.pending_total || 0) - parseFloat(s.pending_paid || 0)),
      total_paid: roundMoney(parseFloat(s.total_paid || 0)),
    });
  } catch (err) {
    console.error('portalController.getDashboardStats:', err);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
}

/**
 * Generate and download a PDF for a customer-portal invoice.
 * Verifies customer access via linked businesses.
 * For fully paid invoices, overlays a "PAID" watermark stamp.
 */
async function portalPdf(req, res) {
  try {
    const invoiceId = parseInt(req.params.id, 10);
    if (isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid invoice ID' });

    const { rows: userRows } = await pool.query(
      'SELECT email FROM users WHERE id = $1', [req.userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const customerEmail = userRows[0].email;

    // Get invoice
    const { rows: invRows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
    if (invRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRows[0];

    // Check: invoice must belong to a linked business
    const { rows: linkCheck } = await pool.query(
      `SELECT id FROM customer_links 
       WHERE customer_user_id = $1 AND business_user_id = $2 AND status = 'active'`,
      [req.userId, inv.user_id]
    );
    if (linkCheck.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view this invoice' });
    }

    // Check: customer email matches the invoice's customer record
    const { rows: custRows } = await pool.query(
      'SELECT * FROM customers WHERE id = $1', [inv.customer_id]
    );
    const customer = custRows[0] || {};
    if (customer.email && customer.email.toLowerCase() !== customerEmail.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized to view this invoice' });
    }

    // Don't allow draft downloads
    if (inv.status === 'draft') {
      return res.status(403).json({ error: 'This invoice is not yet available' });
    }

    // Get line items
    const { rows: lines } = await pool.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [invoiceId]
    );

    // Get taxes
    const { rows: taxRows } = await pool.query(
      'SELECT * FROM invoice_taxes WHERE invoice_id = $1 ORDER BY id ASC', [invoiceId]
    );

    // Get payments
    const { rows: payments } = await pool.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY date ASC, id ASC', [invoiceId]
    );
    const totalPaid = roundMoney(payments.reduce((s, p) => s + parseFloat(p.amount), 0));
    const remaining = roundMoney(parseFloat(inv.total) - totalPaid);

    // Get business settings (for display)
    const { rows: settingsRows } = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1', [inv.user_id]
    );
    const settings = settingsRows[0] || {};

    const fullInvoice = {
      ...inv,
      items: lines,
      taxes: taxRows,
      customer,
      payments,
      totalPaid,
      remaining,
    };

    // Generate the base HTML
    let html = buildInvoiceHtml(fullInvoice, settings);

    // If fully paid, inject a "PAID" watermark stamp overlay
    if (inv.status === 'paid') {
      const paidWatermark = `
        <style>
          .paid-watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            z-index: 9999;
            pointer-events: none;
          }
          .paid-stamp {
            border: 6px solid rgba(5, 150, 105, 0.35);
            border-radius: 20px;
            padding: 15px 50px;
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 80px;
            font-weight: 900;
            color: rgba(5, 150, 105, 0.35);
            letter-spacing: 12px;
            text-transform: uppercase;
            text-align: center;
            line-height: 1;
          }
          .paid-date {
            text-align: center;
            font-family: 'Helvetica', Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            color: rgba(5, 150, 105, 0.35);
            margin-top: 4px;
            letter-spacing: 2px;
          }
        </style>
        <div class="paid-watermark">
          <div class="paid-stamp">PAID</div>
          <div class="paid-date">PAYMENT RECEIVED</div>
        </div>
      `;
      // Inject right after <body>
      html = html.replace('<body>', '<body>' + paidWatermark);
    }

    const buf = await generatePdf(html);
    const filename = inv.status === 'paid'
      ? `${inv.invoice_number}-receipt.pdf`
      : `${inv.invoice_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (err) {
    console.error('portalController.portalPdf:', err);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

module.exports = { getMyInvoices, getInvoiceDetail, getMyPayments, getDashboardStats, portalPdf };
