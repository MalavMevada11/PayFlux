import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadPdf } from '../api';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function customerLabel(row) {
  const c = row.customers;
  if (!c) return '—';
  return c.company_name || c.name || c.email;
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/invoices');
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handlePdf(id, invoiceNumber) {
    setPdfBusy(id);
    try {
      await downloadPdf(id, `${invoiceNumber || 'invoice'}.pdf`);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  // Compute stats
  const total    = rows.length;
  const paid     = rows.filter((r) => r.status === 'paid').length;
  const sent     = rows.filter((r) => r.status === 'sent').length;
  const overdue  = rows.filter((r) => r.status === 'overdue').length;
  const draft    = rows.filter((r) => r.status === 'draft').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your invoice overview</p>
        </div>
        <Link to="/invoices/new" className="btn btn-primary" id="new-invoice-btn">
          + New Invoice
        </Link>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon indigo">📄</div>
          <div className="stat-label">Total Invoices</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-label">Paid</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{paid}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">📤</div>
          <div className="stat-label">Sent</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{sent}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⚠️</div>
          <div className="stat-label">Draft / Overdue</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{draft + overdue}</div>
        </div>
      </div>

      {/* Invoice table */}
      {loading && (
        <div className="loading-page"><div className="spinner" /> Loading invoices…</div>
      )}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <div className="empty-title">No invoices yet</div>
            <div className="empty-desc">Create your first invoice to get started.</div>
            <Link to="/invoices/new" className="btn btn-primary" style={{ marginTop: 16 }}>
              + New Invoice
            </Link>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/invoices/${r.id}`} style={{ fontWeight: 600, color: 'var(--accent)' }}>
                      {r.invoice_number}
                    </Link>
                  </td>
                  <td>{customerLabel(r)}</td>
                  <td className="muted">{r.issue_date}</td>
                  <td className="muted">{r.due_date}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="right" style={{ fontWeight: 600 }}>{inr(r.total)}</td>
                  <td>
                    <div className="row-actions">
                      <Link
                        to={`/invoices/${r.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={pdfBusy === r.id}
                        onClick={() => handlePdf(r.id, r.invoice_number)}
                      >
                        {pdfBusy === r.id ? 'PDF…' : '↓ PDF'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
