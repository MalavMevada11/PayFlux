const { pool, getClient } = require('../db');

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getInvoiceForUser(userId, invoiceId) {
  const { rows } = await pool.query(
    'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
    [invoiceId, userId]
  );
  return rows[0] || null;
}

async function getPaymentsForInvoice(invoiceId) {
  const { rows } = await pool.query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY date ASC, id ASC',
    [invoiceId]
  );
  return rows;
}

async function computeTotalPaid(invoiceId) {
  const { rows } = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1',
    [invoiceId]
  );
  return roundMoney(parseFloat(rows[0].total_paid));
}

async function recomputeStatus(client, invoiceId) {
  const { rows: invRows } = await client.query(
    'SELECT total, status FROM invoices WHERE id = $1',
    [invoiceId]
  );
  const invoice = invRows[0];
  if (!invoice) return;

  const { rows: paidRows } = await client.query(
    'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = $1',
    [invoiceId]
  );
  const totalPaid = roundMoney(parseFloat(paidRows[0].total_paid));

  let newStatus;

  if (totalPaid >= parseFloat(invoice.total)) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partial';
  } else {
    // No payments — restore to a sensible status; keep current unless it was 'partial' or 'paid'
    if (invoice.status === 'partial' || invoice.status === 'paid') {
      newStatus = 'draft';
    } else {
      newStatus = invoice.status; // keep as-is (sent, overdue, draft)
    }
  }

  if (newStatus !== invoice.status) {
    await client.query('UPDATE invoices SET status = $1 WHERE id = $2', [newStatus, invoiceId]);
  }

  return newStatus;
}

async function buildResponse(invoiceId, invoiceTotal) {
  const payments = await getPaymentsForInvoice(invoiceId);
  const totalPaid = roundMoney(payments.reduce((s, p) => s + parseFloat(p.amount), 0));
  const remaining = roundMoney(parseFloat(invoiceTotal) - totalPaid);
  return { payments, totalPaid, remaining };
}

// ─── Handlers ─────────────────────────────────────────────────────────────

async function listPayments(req, res) {
  try {
    const invoice = await getInvoiceForUser(req.userId, req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const result = await buildResponse(invoice.id, invoice.total);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load payments' });
  }
}

async function addPayment(req, res) {
  try {
    const invoice = await getInvoiceForUser(req.userId, req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { amount, method, date, note } = req.body || {};

    // Validate amount
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Check for overpayment
    const currentPaid = await computeTotalPaid(invoice.id);
    const remaining = roundMoney(parseFloat(invoice.total) - currentPaid);
    if (roundMoney(parsedAmount) > remaining) {
      return res.status(400).json({
        error: `Payment exceeds remaining balance. Maximum allowed: ₹${remaining.toFixed(2)}`,
        maxAmount: remaining,
      });
    }

    // Validate method
    const METHODS = new Set(['cash', 'bank_transfer', 'upi', 'card', 'cheque', 'other']);
    const paymentMethod = method && METHODS.has(method) ? method : 'cash';

    // Validate date
    const paymentDate = (date && typeof date === 'string') ? date : new Date().toISOString().split('T')[0];

    const paymentNote = typeof note === 'string' ? note.trim() : '';

    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(
        'INSERT INTO payments (invoice_id, amount, method, date, note) VALUES ($1, $2, $3, $4, $5)',
        [invoice.id, roundMoney(parsedAmount), paymentMethod, paymentDate, paymentNote]
      );

      await recomputeStatus(client, invoice.id);

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Return updated state
    const { rows: updatedRows } = await pool.query(
      'SELECT total, status FROM invoices WHERE id = $1',
      [invoice.id]
    );
    const updatedInvoice = updatedRows[0];
    const result = await buildResponse(invoice.id, updatedInvoice.total);
    return res.status(201).json({ ...result, status: updatedInvoice.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to record payment' });
  }
}

async function deletePayment(req, res) {
  try {
    const invoice = await getInvoiceForUser(req.userId, req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const paymentId = req.params.paymentId;
    const { rows: payRows } = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND invoice_id = $2',
      [paymentId, invoice.id]
    );
    if (payRows.length === 0) return res.status(404).json({ error: 'Payment not found' });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payments WHERE id = $1', [paymentId]);
      await recomputeStatus(client, invoice.id);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const { rows: updatedRows } = await pool.query(
      'SELECT total, status FROM invoices WHERE id = $1',
      [invoice.id]
    );
    const updatedInvoice = updatedRows[0];
    const result = await buildResponse(invoice.id, updatedInvoice.total);
    return res.json({ ...result, status: updatedInvoice.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete payment' });
  }
}

module.exports = { listPayments, addPayment, deletePayment };
