const db = require('../db');

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function monthRange(offset = 0) {
  // offset: 0 = current month, -1 = previous month, etc.
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset; // 0-indexed
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0); // last day of that month
  const fmt = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };
  return { start: fmt(start), end: fmt(end) };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── KPI computation ─────────────────────────────────────────────────────

function computeKpis(userId, dateStart, dateEnd) {
  const today = todayStr();

  // All invoices in the date range
  const invoices = db.prepare(`
    SELECT i.id, i.total, i.status, i.due_date,
           COALESCE(p.total_paid, 0) AS total_paid
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.user_id = ?
      AND i.issue_date >= ? AND i.issue_date <= ?
  `).all(userId, dateStart, dateEnd);

  let totalRevenue = 0;
  let paidAmount = 0;
  let outstandingAmount = 0;
  let overdueAmount = 0;
  let countPaid = 0;
  let countUnpaid = 0; // draft + sent
  let countPartial = 0;
  let countOverdue = 0;

  for (const inv of invoices) {
    totalRevenue += inv.total;
    const paid = Math.min(inv.total_paid, inv.total); // cap at total to handle overpayments
    paidAmount += paid;

    if (inv.status === 'paid') {
      countPaid++;
    } else if (inv.status === 'partial') {
      countPartial++;
      outstandingAmount += (inv.total - paid);
      if (inv.due_date < today) {
        overdueAmount += (inv.total - paid);
      }
    } else if (inv.status === 'overdue') {
      countOverdue++;
      outstandingAmount += (inv.total - paid);
      overdueAmount += (inv.total - paid);
    } else {
      // draft, sent → "unpaid"
      countUnpaid++;
      outstandingAmount += (inv.total - paid);
      if (inv.due_date < today) {
        overdueAmount += (inv.total - paid);
      }
    }
  }

  return {
    totalRevenue: roundMoney(totalRevenue),
    paidAmount: roundMoney(paidAmount),
    outstandingAmount: roundMoney(outstandingAmount),
    overdueAmount: roundMoney(overdueAmount),
    counts: {
      paid: countPaid,
      unpaid: countUnpaid,
      partial: countPartial,
      overdue: countOverdue,
    },
    invoiceCount: invoices.length,
  };
}

// ─── Revenue Timeline ────────────────────────────────────────────────────

function computeRevenueTimeline(userId, granularity) {
  // granularity: 'daily', 'weekly', 'monthly'
  let groupExpr, labelExpr;
  switch (granularity) {
    case 'daily':
      groupExpr = `i.issue_date`;
      labelExpr = `i.issue_date`;
      break;
    case 'weekly':
      groupExpr = `strftime('%Y-%W', i.issue_date)`;
      labelExpr = `strftime('%Y-W%W', i.issue_date)`;
      break;
    case 'monthly':
    default:
      groupExpr = `strftime('%Y-%m', i.issue_date)`;
      labelExpr = `strftime('%Y-%m', i.issue_date)`;
      break;
  }

  const rows = db.prepare(`
    SELECT ${labelExpr} AS label,
           SUM(i.total) AS revenue,
           SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS paid,
           SUM(CASE WHEN i.status IN ('draft', 'sent') THEN i.total ELSE 0 END) AS unpaid,
           SUM(CASE WHEN i.status = 'partial' THEN i.total ELSE 0 END) AS partial,
           SUM(CASE WHEN i.status = 'overdue' THEN i.total ELSE 0 END) AS overdue
    FROM invoices i
    WHERE i.user_id = ?
    GROUP BY ${groupExpr}
    ORDER BY ${groupExpr} ASC
  `).all(userId);

  return rows.map(r => ({
    label: r.label,
    revenue: roundMoney(r.revenue || 0),
    paid: roundMoney(r.paid || 0),
    unpaid: roundMoney(r.unpaid || 0),
    partial: roundMoney(r.partial || 0),
    overdue: roundMoney(r.overdue || 0),
  }));
}

// ─── Payment Behavior Insights ───────────────────────────────────────────

function computePaymentInsights(userId) {
  const today = todayStr();

  // Average payment time: days between issue_date and first payment date
  const paymentTimes = db.prepare(`
    SELECT i.id, i.issue_date, i.due_date,
           MIN(p.date) AS first_payment_date
    FROM invoices i
    INNER JOIN payments p ON p.invoice_id = i.id
    WHERE i.user_id = ?
    GROUP BY i.id
  `).all(userId);

  let totalDays = 0;
  let paymentCount = 0;
  let lateCount = 0;

  for (const row of paymentTimes) {
    const issue = new Date(row.issue_date);
    const firstPay = new Date(row.first_payment_date);
    const due = new Date(row.due_date);
    const days = Math.max(0, Math.round((firstPay - issue) / (1000 * 60 * 60 * 24)));
    totalDays += days;
    paymentCount++;
    if (firstPay > due) {
      lateCount++;
    }
  }

  const avgPaymentDays = paymentCount > 0 ? roundMoney(totalDays / paymentCount) : 0;
  const latePaymentPercent = paymentCount > 0 ? roundMoney((lateCount / paymentCount) * 100) : 0;

  // Partial payment frequency
  const totalInvoices = db.prepare(
    'SELECT COUNT(*) AS cnt FROM invoices WHERE user_id = ?'
  ).get(userId);
  const partialInvoices = db.prepare(
    "SELECT COUNT(*) AS cnt FROM invoices WHERE user_id = ? AND status = 'partial'"
  ).get(userId);
  const partialPaymentFrequency = totalInvoices.cnt > 0
    ? roundMoney((partialInvoices.cnt / totalInvoices.cnt) * 100)
    : 0;

  // Top 5 fastest-paying customers
  const fastestPayers = db.prepare(`
    SELECT c.name, c.company_name,
           ROUND(AVG(JULIANDAY(MIN_p.first_date) - JULIANDAY(i.issue_date)), 1) AS avg_days
    FROM invoices i
    INNER JOIN customers c ON c.id = i.customer_id
    INNER JOIN (
      SELECT invoice_id, MIN(date) AS first_date FROM payments GROUP BY invoice_id
    ) MIN_p ON MIN_p.invoice_id = i.id
    WHERE i.user_id = ?
    GROUP BY c.id
    HAVING avg_days >= 0
    ORDER BY avg_days ASC
    LIMIT 5
  `).all(userId);

  // Top 5 slowest-paying customers
  const slowestPayers = db.prepare(`
    SELECT c.name, c.company_name,
           ROUND(AVG(JULIANDAY(MIN_p.first_date) - JULIANDAY(i.issue_date)), 1) AS avg_days
    FROM invoices i
    INNER JOIN customers c ON c.id = i.customer_id
    INNER JOIN (
      SELECT invoice_id, MIN(date) AS first_date FROM payments GROUP BY invoice_id
    ) MIN_p ON MIN_p.invoice_id = i.id
    WHERE i.user_id = ?
    GROUP BY c.id
    HAVING avg_days >= 0
    ORDER BY avg_days DESC
    LIMIT 5
  `).all(userId);

  return {
    avgPaymentDays,
    latePaymentPercent,
    partialPaymentFrequency,
    fastestPayers: fastestPayers.map(r => ({
      name: r.company_name || r.name,
      avgDays: r.avg_days,
    })),
    slowestPayers: slowestPayers.map(r => ({
      name: r.company_name || r.name,
      avgDays: r.avg_days,
    })),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────

function getDashboardAnalytics(req, res) {
  try {
    const userId = req.userId;
    const granularity = req.query.granularity || 'monthly';

    // Current and previous month ranges
    const currentMonth = monthRange(0);
    const previousMonth = monthRange(-1);

    const currentKpis = computeKpis(userId, currentMonth.start, currentMonth.end);
    const previousKpis = computeKpis(userId, previousMonth.start, previousMonth.end);

    const revenueTimeline = computeRevenueTimeline(userId, granularity);
    const paymentInsights = computePaymentInsights(userId);

    return res.json({
      kpis: {
        currentMonth: currentKpis,
        previousMonth: previousKpis,
        period: {
          current: { start: currentMonth.start, end: currentMonth.end },
          previous: { start: previousMonth.start, end: previousMonth.end },
        },
      },
      revenueTimeline,
      paymentInsights,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ error: 'Failed to compute analytics' });
  }
}

module.exports = { getDashboardAnalytics };
