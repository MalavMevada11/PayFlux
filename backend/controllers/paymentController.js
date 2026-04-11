const db = require('../db');

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getInvoiceForUser(userId, invoiceId) {
  return db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(invoiceId, userId);
}

function getPaymentsForInvoice(invoiceId) {
  return db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY date ASC, id ASC').all(invoiceId);
}

function computeTotalPaid(invoiceId) {
  const row = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE invoice_id = ?').get(invoiceId);
  return roundMoney(row.total_paid);
}

function recomputeStatus(invoiceId) {
  const invoice = db.prepare('SELECT total, status FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) return;

  const totalPaid = computeTotalPaid(invoiceId);
  let newStatus;

  if (totalPaid >= invoice.total) {
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
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, invoiceId);
  }

  return newStatus;
}

function buildResponse(invoiceId, invoiceTotal) {
  const payments = getPaymentsForInvoice(invoiceId);
  const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
  const remaining = roundMoney(invoiceTotal - totalPaid);
  return { payments, totalPaid, remaining };
}

// ─── Handlers ─────────────────────────────────────────────────────────────

function listPayments(req, res) {
  try {
    const invoice = getInvoiceForUser(req.userId, req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const result = buildResponse(invoice.id, invoice.total);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load payments' });
  }
}

function addPayment(req, res) {
  try {
    const invoice = getInvoiceForUser(req.userId, req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const { amount, method, date, note } = req.body || {};

    // Validate amount
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Check for overpayment
    const currentPaid = computeTotalPaid(invoice.id);
    const remaining = roundMoney(invoice.total - currentPaid);
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

    const txn = db.transaction(() => {
      db.prepare(
        'INSERT INTO payments (invoice_id, amount, method, date, note) VALUES (?, ?, ?, ?, ?)'
      ).run(invoice.id, roundMoney(parsedAmount), paymentMethod, paymentDate, paymentNote);

      recomputeStatus(invoice.id);
    });
    txn();

    // Return updated state
    const updatedInvoice = db.prepare('SELECT total, status FROM invoices WHERE id = ?').get(invoice.id);
    const result = buildResponse(invoice.id, updatedInvoice.total);
    return res.status(201).json({ ...result, status: updatedInvoice.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to record payment' });
  }
}

function deletePayment(req, res) {
  try {
    const invoice = getInvoiceForUser(req.userId, req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const paymentId = req.params.paymentId;
    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND invoice_id = ?').get(paymentId, invoice.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const txn = db.transaction(() => {
      db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId);
      recomputeStatus(invoice.id);
    });
    txn();

    const updatedInvoice = db.prepare('SELECT total, status FROM invoices WHERE id = ?').get(invoice.id);
    const result = buildResponse(invoice.id, updatedInvoice.total);
    return res.json({ ...result, status: updatedInvoice.status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete payment' });
  }
}

module.exports = { listPayments, addPayment, deletePayment };
