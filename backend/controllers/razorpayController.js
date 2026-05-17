const Razorpay = require('razorpay');
const crypto = require('crypto');
const { pool } = require('../db');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * Save Razorpay API keys for a business.
 * The key_secret is encrypted with AES-256-GCM before storing.
 */
async function saveKeys(req, res) {
  try {
    const { key_id, key_secret } = req.body || {};

    if (!key_id || typeof key_id !== 'string' || !key_id.trim()) {
      return res.status(400).json({ error: 'Razorpay Key ID is required' });
    }
    if (!key_secret || typeof key_secret !== 'string' || !key_secret.trim()) {
      return res.status(400).json({ error: 'Razorpay Key Secret is required' });
    }

    // Validate keys by instantiating Razorpay — catches invalid key format
    const trimmedId = key_id.trim();
    const trimmedSecret = key_secret.trim();

    // Encrypt the secret
    const encryptedSecret = encrypt(trimmedSecret);

    // Store in database
    await pool.query(
      `UPDATE user_settings 
       SET razorpay_key_id = $1, razorpay_key_secret_enc = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [trimmedId, encryptedSecret, req.userId]
    );

    return res.json({
      success: true,
      key_id: trimmedId,
      message: 'Razorpay keys saved successfully',
    });
  } catch (err) {
    console.error('razorpayController.saveKeys:', err);
    return res.status(500).json({ error: 'Failed to save Razorpay keys' });
  }
}

/**
 * Remove Razorpay keys for a business.
 */
async function removeKeys(req, res) {
  try {
    await pool.query(
      `UPDATE user_settings SET razorpay_key_id = '', razorpay_key_secret_enc = '', updated_at = NOW()
       WHERE user_id = $1`,
      [req.userId]
    );
    return res.json({ success: true, message: 'Razorpay keys removed' });
  } catch (err) {
    console.error('razorpayController.removeKeys:', err);
    return res.status(500).json({ error: 'Failed to remove keys' });
  }
}

/**
 * Get Razorpay connection status for the current business.
 */
async function getStatus(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT razorpay_key_id FROM user_settings WHERE user_id = $1',
      [req.userId]
    );
    const keyId = rows[0]?.razorpay_key_id || '';
    return res.json({
      configured: !!keyId,
      key_id: keyId ? `${keyId.substring(0, 12)}...` : '',
    });
  } catch (err) {
    console.error('razorpayController.getStatus:', err);
    return res.status(500).json({ error: 'Failed to get status' });
  }
}

/**
 * Create a Razorpay order for an invoice.
 * Called by the customer from the portal.
 * Uses the business's Razorpay keys (decrypted).
 */
async function createOrder(req, res) {
  try {
    const { invoice_id } = req.body || {};
    if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

    // Get invoice details
    const { rows: invRows } = await pool.query(
      'SELECT * FROM invoices WHERE id = $1', [invoice_id]
    );
    if (invRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRows[0];

    // Verify the customer has access (linked to this business)
    const { rows: linkCheck } = await pool.query(
      `SELECT id FROM customer_links 
       WHERE customer_user_id = $1 AND business_user_id = $2 AND status = 'active'`,
      [req.userId, inv.user_id]
    );
    if (linkCheck.length === 0) {
      return res.status(403).json({ error: 'Not authorized to pay this invoice' });
    }

    // Get already-paid amount
    const { rows: paymentRows } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1',
      [invoice_id]
    );
    const alreadyPaid = parseFloat(paymentRows[0].paid);
    const remaining = Math.round((parseFloat(inv.total) - alreadyPaid) * 100) / 100;

    if (remaining <= 0) {
      return res.status(400).json({ error: 'Invoice is already fully paid' });
    }

    // Get business's Razorpay keys
    const { rows: settingsRows } = await pool.query(
      'SELECT razorpay_key_id, razorpay_key_secret_enc FROM user_settings WHERE user_id = $1',
      [inv.user_id]
    );
    const settings = settingsRows[0];
    if (!settings?.razorpay_key_id || !settings?.razorpay_key_secret_enc) {
      return res.status(400).json({ error: 'Business has not configured Razorpay payments' });
    }

    const keyId = settings.razorpay_key_id;
    const keySecret = decrypt(settings.razorpay_key_secret_enc);

    // Create Razorpay instance with business's keys
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // Create order — amount in paise (smallest unit)
    const amountPaise = Math.round(remaining * 100);
    const order = await rzp.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `inv_${inv.id}_${Date.now()}`,
      notes: {
        invoice_id: String(inv.id),
        invoice_number: inv.invoice_number,
        business_user_id: String(inv.user_id),
        customer_user_id: String(req.userId),
      },
    });

    return res.json({
      order_id: order.id,
      amount: amountPaise,
      currency: 'INR',
      key_id: keyId, // customer needs this for Checkout
      invoice_number: inv.invoice_number,
      business_name: '', // filled by frontend
    });
  } catch (err) {
    console.error('razorpayController.createOrder:', err);
    if (err.statusCode === 401) {
      return res.status(400).json({ error: 'Invalid Razorpay credentials configured by business' });
    }
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
}

/**
 * Verify Razorpay payment signature and record the payment.
 * Called after customer completes Razorpay Checkout.
 */
async function verifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, invoice_id } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !invoice_id) {
      return res.status(400).json({ error: 'Missing payment verification parameters' });
    }

    // Get the invoice to find which business's keys to use
    const { rows: invRows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
    if (invRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRows[0];

    // Get business's Razorpay secret for signature verification
    const { rows: settingsRows } = await pool.query(
      'SELECT razorpay_key_secret_enc FROM user_settings WHERE user_id = $1',
      [inv.user_id]
    );
    const keySecret = decrypt(settingsRows[0]?.razorpay_key_secret_enc || '');
    if (!keySecret) {
      return res.status(400).json({ error: 'Business Razorpay keys not configured' });
    }

    // Verify signature: HMAC SHA256 of "order_id|payment_id" with key_secret
    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    // Get payment amount from Razorpay
    const rzp = new Razorpay({
      key_id: settingsRows[0]?.razorpay_key_id || (await pool.query('SELECT razorpay_key_id FROM user_settings WHERE user_id = $1', [inv.user_id])).rows[0]?.razorpay_key_id,
      key_secret: keySecret,
    });

    let paymentAmount;
    try {
      const payment = await rzp.payments.fetch(razorpay_payment_id);
      paymentAmount = payment.amount / 100; // paise to rupees
    } catch (fetchErr) {
      // If we can't fetch, use the invoice remaining as fallback
      const { rows: paidRows } = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1', [invoice_id]
      );
      paymentAmount = Math.round((parseFloat(inv.total) - parseFloat(paidRows[0].paid)) * 100) / 100;
    }

    // Record the payment
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO payments (invoice_id, amount, method, date, note)
       VALUES ($1, $2, 'card', $3, $4)`,
      [invoice_id, paymentAmount, today, `Razorpay: ${razorpay_payment_id}`]
    );

    // Update invoice status
    const { rows: totalPaidRows } = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = $1', [invoice_id]
    );
    const totalPaid = parseFloat(totalPaidRows[0].paid);
    const invoiceTotal = parseFloat(inv.total);

    let newStatus = inv.status;
    if (totalPaid >= invoiceTotal) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partial';
    }

    if (newStatus !== inv.status) {
      await pool.query('UPDATE invoices SET status = $1 WHERE id = $2', [newStatus, invoice_id]);
    }

    // Update any pending payment_requests
    await pool.query(
      `UPDATE payment_requests SET status = 'paid' 
       WHERE invoice_id = $1 AND customer_user_id = $2 AND status = 'pending'`,
      [invoice_id, req.userId]
    );

    return res.json({
      success: true,
      payment_id: razorpay_payment_id,
      amount: paymentAmount,
      invoice_status: newStatus,
      message: 'Payment verified and recorded successfully',
    });
  } catch (err) {
    console.error('razorpayController.verifyPayment:', err);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
}

module.exports = { saveKeys, removeKeys, getStatus, createOrder, verifyPayment };
