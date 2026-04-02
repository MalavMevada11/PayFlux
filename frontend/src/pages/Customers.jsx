import { useEffect, useState } from 'react';
import { api } from '../api';

function getInitials(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | rowObject
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/customers');
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm({ type: 'business', name: '', email: '', phone: '', company_name: '', address: '' });
    setEditing('new');
    setFormError('');
  }

  function startEdit(row) {
    setForm({ ...row });
    setEditing(row);
    setFormError('');
  }

  function cancelEdit() {
    setEditing(null);
    setFormError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        const created = await api('/customers', { method: 'POST', body: form });
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api(`/customers/${editing.id}`, { method: 'PUT', body: form });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
      setEditing(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const f = (field) => ({
    value: form[field] ?? '',
    onChange: (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{rows.length} customer{rows.length !== 1 ? 's' : ''}</p>
        </div>
        {!editing && (
          <button id="add-customer-btn" className="btn btn-primary" onClick={startNew}>
            + Add Customer
          </button>
        )}
      </div>

      {/* Form panel */}
      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{editing === 'new' ? 'New Customer' : 'Edit Customer'}</span>
          </div>
          <div className="card-body">
            {formError && <div className="error-msg" style={{ marginBottom: 12 }}>{formError}</div>}
            <form onSubmit={handleSave} className="form-grid">
              <div className="form-row">
                <label>
                  Type
                  <select {...f('type')} required>
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </label>
                <label>
                  Name *
                  <input placeholder="Full name" {...f('name')} required />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Email *
                  <input type="email" placeholder="contact@example.com" {...f('email')} required />
                </label>
                <label>
                  Phone
                  <input placeholder="+91 98765 43210" {...f('phone')} />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Company Name
                  <input placeholder="Acme Pvt Ltd" {...f('company_name')} />
                </label>
                <label>
                  Address
                  <input placeholder="123 Main St, City" {...f('address')} />
                </label>
              </div>
              <div className="row-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Customer'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && <div className="loading-page"><div className="spinner" /> Loading…</div>}
      {error && <div className="error-msg">{error}</div>}

      {!loading && !error && rows.length === 0 && !editing && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-title">No customers yet</div>
            <div className="empty-desc">Add your first customer to start creating invoices.</div>
            <button className="btn btn-primary" onClick={startNew} style={{ marginTop: 16 }}>
              + Add Customer
            </button>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Company</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar">{getInitials(r.name)}</div>
                      <span style={{ fontWeight: 500 }}>{r.name}</span>
                    </div>
                  </td>
                  <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                  <td className="muted">{r.email}</td>
                  <td className="muted">{r.phone || '—'}</td>
                  <td className="muted">{r.company_name || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
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
