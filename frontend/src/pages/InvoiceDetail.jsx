import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, downloadPdf, updateInvoiceStatus } from '../api';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ALL_STATUSES = ['draft', 'sent', 'paid', 'overdue'];

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/invoices/${id}`);
        if (!cancelled) setInv(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handlePdf() {
    setPdfBusy(true);
    try {
      await downloadPdf(id, `${inv.invoice_number}.pdf`);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (newStatus === inv.status) return;
    setStatusBusy(true);
    try {
      const updated = await updateInvoiceStatus(id, newStatus);
      setInv((prev) => ({ ...prev, status: updated.status }));
    } catch (e) {
      alert(e.message);
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    setDeleteBusy(true);
    try {
      await api(`/invoices/${id}`, { method: 'DELETE' });
      nav('/');
    } catch (e) {
      alert(e.message);
      setDeleteBusy(false);
    }
  }

  if (loading) return <div className="loading-page"><div className="spinner" /> Loading invoice…</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!inv) return null;

  const c = inv.customer || {};
  const lines = inv.items || [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{inv.invoice_number}</h1>
            <StatusBadge status={inv.status} />
          </div>
          <p className="page-subtitle">
            Issued {inv.issue_date} · Due {inv.due_date}
          </p>
        </div>
        <div className="row-actions">
          {/* Status changer */}
          <select
            value={inv.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={statusBusy}
            style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', fontSize: 13, cursor: 'pointer' }}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <Link to={`/invoices/${id}/edit`} className="btn btn-ghost">Edit</Link>
          <button className="btn btn-ghost" onClick={handlePdf} disabled={pdfBusy}>
            {pdfBusy ? 'Generating…' : '↓ Download PDF'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleteBusy}>
            {deleteBusy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Customer + meta info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card card-body">
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 10 }}>Bill To</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{c.name || '—'}</div>
          {c.company_name && <div className="muted">{c.company_name}</div>}
          <div className="muted">{c.email || ''}</div>
          {c.address && <div className="muted" style={{ marginTop: 4, whiteSpace: 'pre-line' }}>{c.address}</div>}
        </div>
        <div className="card card-body">
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 10 }}>Invoice Info</div>
          <div className="detail-grid">
            <div>
              <div className="detail-label">Invoice #</div>
              <div className="detail-value">{inv.invoice_number}</div>
            </div>
            <div>
              <div className="detail-label">Status</div>
              <div className="detail-value"><StatusBadge status={inv.status} /></div>
            </div>
            <div>
              <div className="detail-label">Issue Date</div>
              <div className="detail-value">{inv.issue_date}</div>
            </div>
            <div>
              <div className="detail-label">Due Date</div>
              <div className="detail-value">{inv.due_date}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Line Items</span></div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Item / Description</th>
                <th className="right">Qty</th>
                <th className="right">Rate</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{l.name}</td>
                  <td className="right muted">{Number(l.quantity)}</td>
                  <td className="right muted">{inr(l.rate)}</td>
                  <td className="right" style={{ fontWeight: 600 }}>{inr(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px 16px' }}>
          <div className="totals-panel" style={{ width: 260 }}>
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{inr(inv.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>Discount</span>
              <span>− {inr(inv.discount)}</span>
            </div>
            <div className="totals-row grand">
              <span>Total</span>
              <span>{inr(inv.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {inv.notes && (
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 8 }}>Notes</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{inv.notes}</div>
        </div>
      )}

      <div className="row-actions">
        <Link to="/" className="btn btn-ghost">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
