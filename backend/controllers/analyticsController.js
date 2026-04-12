const { pool } = require('../db');

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function monthRange(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
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

async function computeKpis(userId, dateStart, dateEnd) {
  const today = todayStr();

  const { rows: invoices } = await pool.query(`
    SELECT i.id, i.total, i.status, i.due_date,
           COALESCE(p.total_paid, 0) AS total_paid
    FROM invoices i
    LEFT JOIN (
      SELECT invoice_id, SUM(amount) AS total_paid FROM payments GROUP BY invoice_id
    ) p ON p.invoice_id = i.id
    WHERE i.user_id = $1
      AND i.issue_date >= $2 AND i.issue_date <= $3
  `, [userId, dateStart, dateEnd]);

  let totalRevenue = 0;
  let paidAmount = 0;
  let outstandingAmount = 0;
  let overdueAmount = 0;
  let countPaid = 0;
  let countUnpaid = 0;
  let countPartial = 0;
  let countOverdue = 0;

  for (const inv of invoices) {
    const invTotal = parseFloat(inv.total);
    const invPaid = parseFloat(inv.total_paid);
    totalRevenue += invTotal;
    const paid = Math.min(invPaid, invTotal);
    paidAmount += paid;

    if (inv.status === 'paid') {
      countPaid++;
    } else if (inv.status === 'partial') {
      countPartial++;
      outstandingAmount += (invTotal - paid);
      if (inv.due_date < today) {
        overdueAmount += (invTotal - paid);
      }
    } else if (inv.status === 'overdue') {
      countOverdue++;
      outstandingAmount += (invTotal - paid);
      overdueAmount += (invTotal - paid);
    } else {
      countUnpaid++;
      outstandingAmount += (invTotal - paid);
      if (inv.due_date < today) {
        overdueAmount += (invTotal - paid);
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

async function computeRevenueTimeline(userId, granularity) {
  let groupExpr, labelExpr;
  switch (granularity) {
    case 'daily':
      groupExpr = `i.issue_date`;
      labelExpr = `i.issue_date`;
      break;
    case 'weekly':
      groupExpr = `TO_CHAR(i.issue_date::date, 'IYYY-"W"IW')`;
      labelExpr = `TO_CHAR(i.issue_date::date, 'IYYY-"W"IW')`;
      break;
    case 'monthly':
    default:
      groupExpr = `TO_CHAR(i.issue_date::date, 'YYYY-MM')`;
      labelExpr = `TO_CHAR(i.issue_date::date, 'YYYY-MM')`;
      break;
  }

  const { rows } = await pool.query(`
    SELECT ${labelExpr} AS label,
           SUM(i.total) AS revenue,
           SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS paid,
           SUM(CASE WHEN i.status IN ('draft', 'sent') THEN i.total ELSE 0 END) AS unpaid,
           SUM(CASE WHEN i.status = 'partial' THEN i.total ELSE 0 END) AS partial,
           SUM(CASE WHEN i.status = 'overdue' THEN i.total ELSE 0 END) AS overdue
    FROM invoices i
    WHERE i.user_id = $1
    GROUP BY ${groupExpr}
    ORDER BY ${groupExpr} ASC
  `, [userId]);

  return rows.map(r => ({
    label: r.label,
    revenue: roundMoney(parseFloat(r.revenue) || 0),
    paid: roundMoney(parseFloat(r.paid) || 0),
    unpaid: roundMoney(parseFloat(r.unpaid) || 0),
    partial: roundMoney(parseFloat(r.partial) || 0),
    overdue: roundMoney(parseFloat(r.overdue) || 0),
  }));
}

// ─── Payment Behavior Insights ───────────────────────────────────────────

async function computePaymentInsights(userId) {
  // Average payment time: days between issue_date and first payment date
  const { rows: paymentTimes } = await pool.query(`
    SELECT i.id, i.issue_date, i.due_date,
           MIN(p.date) AS first_payment_date
    FROM invoices i
    INNER JOIN payments p ON p.invoice_id = i.id
    WHERE i.user_id = $1
    GROUP BY i.id, i.issue_date, i.due_date
  `, [userId]);

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
  const { rows: totalRows } = await pool.query(
    'SELECT COUNT(*) AS cnt FROM invoices WHERE user_id = $1',
    [userId]
  );
  const { rows: partialRows } = await pool.query(
    "SELECT COUNT(*) AS cnt FROM invoices WHERE user_id = $1 AND status = 'partial'",
    [userId]
  );
  const totalInvoices = parseInt(totalRows[0].cnt);
  const partialInvoices = parseInt(partialRows[0].cnt);
  const partialPaymentFrequency = totalInvoices > 0
    ? roundMoney((partialInvoices / totalInvoices) * 100)
    : 0;

  // Top 5 fastest-paying customers
  const { rows: fastestPayers } = await pool.query(`
    SELECT c.name, c.company_name,
           ROUND(AVG((MIN_p.first_date::date - i.issue_date::date))::numeric, 1) AS avg_days
    FROM invoices i
    INNER JOIN customers c ON c.id = i.customer_id
    INNER JOIN (
      SELECT invoice_id, MIN(date) AS first_date FROM payments GROUP BY invoice_id
    ) MIN_p ON MIN_p.invoice_id = i.id
    WHERE i.user_id = $1
    GROUP BY c.id, c.name, c.company_name
    HAVING AVG((MIN_p.first_date::date - i.issue_date::date)) >= 0
    ORDER BY avg_days ASC
    LIMIT 5
  `, [userId]);

  // Top 5 slowest-paying customers
  const { rows: slowestPayers } = await pool.query(`
    SELECT c.name, c.company_name,
           ROUND(AVG((MIN_p.first_date::date - i.issue_date::date))::numeric, 1) AS avg_days
    FROM invoices i
    INNER JOIN customers c ON c.id = i.customer_id
    INNER JOIN (
      SELECT invoice_id, MIN(date) AS first_date FROM payments GROUP BY invoice_id
    ) MIN_p ON MIN_p.invoice_id = i.id
    WHERE i.user_id = $1
    GROUP BY c.id, c.name, c.company_name
    HAVING AVG((MIN_p.first_date::date - i.issue_date::date)) >= 0
    ORDER BY avg_days DESC
    LIMIT 5
  `, [userId]);

  return {
    avgPaymentDays,
    latePaymentPercent,
    partialPaymentFrequency,
    fastestPayers: fastestPayers.map(r => ({
      name: r.company_name || r.name,
      avgDays: parseFloat(r.avg_days),
    })),
    slowestPayers: slowestPayers.map(r => ({
      name: r.company_name || r.name,
      avgDays: parseFloat(r.avg_days),
    })),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────

async function getDashboardAnalytics(req, res) {
  try {
    const userId = req.userId;
    const granularity = req.query.granularity || 'monthly';

    const currentMonth = monthRange(0);
    const previousMonth = monthRange(-1);

    const currentKpis = await computeKpis(userId, currentMonth.start, currentMonth.end);
    const previousKpis = await computeKpis(userId, previousMonth.start, previousMonth.end);

    const revenueTimeline = await computeRevenueTimeline(userId, granularity);
    const paymentInsights = await computePaymentInsights(userId);

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
