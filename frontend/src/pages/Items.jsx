import { useEffect, useState } from 'react';
import { api } from '../api';

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Items() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/items');
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm({ name: '', type: 'service', price: '', description: '' });
    setEditing('new');
    setFormError('');
  }

  function startEdit(row) {
    setForm({ ...row, price: String(row.price) });
    setEditing(row);
    setFormError('');
  }

  function cancelEdit() { setEditing(null); setFormError(''); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const body = { ...form, price: parseFloat(form.price) || 0 };
      if (editing === 'new') {
        const created = await api('/items', { method: 'POST', body });
        setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const updated = await api(`/items/${editing.id}`, { method: 'PUT', body });
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
    if (!confirm('Delete this item?')) return;
    try {
      await api(`/items/${id}`, { method: 'DELETE' });
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
          <h1 className="page-title">Items &amp; Services</h1>
          <p className="page-subtitle">{rows.length} item{rows.length !== 1 ? 's' : ''} in catalog</p>
        </div>
        {!editing && (
          <button id="add-item-btn" className="btn btn-primary" onClick={startNew}>
            + Add Item
          </button>
        )}
      </div>

      {/* Form panel */}
      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{editing === 'new' ? 'New Item' : 'Edit Item'}</span>
          </div>
          <div className="card-body">
            {formError && <div className="error-msg" style={{ marginBottom: 12 }}>{formError}</div>}
            <form onSubmit={handleSave} className="form-grid">
              <div className="form-row">
                <label>
                  Name *
                  <input placeholder="e.g. Web Design" {...f('name')} required />
                </label>
                <label>
                  Type
                  <select {...f('type')} required>
                    <option value="service">Service</option>
                    <option value="goods">Goods</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Default Price (₹) *
                  <input type="number" min="0" step="0.01" placeholder="0.00" {...f('price')} required />
                </label>
                <label>
                  Description
                  <input placeholder="Short description (optional)" {...f('description')} />
                </label>
              </div>
              <div className="row-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Item'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
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
            <div className="empty-icon">📦</div>
            <div className="empty-title">No items yet</div>
            <div className="empty-desc">Add reusable items or services to speed up invoice creation.</div>
            <button className="btn btn-primary" onClick={startNew} style={{ marginTop: 16 }}>
              + Add Item
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
                <th>Description</th>
                <th className="right">Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                  <td className="muted">{r.description || '—'}</td>
                  <td className="right" style={{ fontWeight: 600 }}>{inr(r.price)}</td>
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
