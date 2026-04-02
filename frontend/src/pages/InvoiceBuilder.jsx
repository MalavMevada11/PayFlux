import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getProfile } from '../api';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function round2(n) { return Math.round(Number(n) * 100) / 100; }
function formatMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const emptyLine = () => ({ item_id: '', name: '', quantity: 1, rate: 0, description: '', type: 'goods' });


export default function InvoiceBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const nav = useNavigate();

  const [settings, setSettings]       = useState({});
  const [customers, setCustomers]     = useState([]);
  const [catalog, setCatalog]         = useState([]);
  const [customerId, setCustomerId]   = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-' + Math.floor(Math.random() * 10000000000));
  
  const formatDateForDisplay = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  const [issueDateText, setIssueDateText]     = useState(formatDateForDisplay(todayISO()));
  const [dueDateText, setDueDateText]         = useState(formatDateForDisplay(addDaysISO(todayISO(), 30)));
  
  const [status, setStatus]           = useState('draft');
  const [discount, setDiscount]       = useState(0);
  const [notes, setNotes]             = useState('Thank you for your business. Please make payment within 30 days. Contact us with any questions regarding this invoice.');
  const [lines, setLines]             = useState([emptyLine()]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, it, prof] = await Promise.all([api('/customers'), api('/items'), getProfile()]);
        if (cancelled) return;
        setCustomers(c || []);
        setCatalog(it || []);
        setSettings(prof || {});
        
        if (isEdit) {
          const inv = await api(`/invoices/${id}`);
          if (cancelled) return;
          setCustomerId(String(inv.customer_id));
          setInvoiceNumber(inv.invoice_number);
          setIssueDateText(formatDateForDisplay(inv.issue_date));
          setDueDateText(formatDateForDisplay(inv.due_date));
          setStatus(inv.status);
          setDiscount(Number(inv.discount));
          setNotes(inv.notes || '');
          setLines((inv.items && inv.items.length > 0 ? inv.items : [emptyLine()]).map((l) => ({
            item_id: l.item_id ? String(l.item_id) : '',
            name: l.name,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            description: l.description || '',
            type: l.type || 'goods'
          })));
        }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const computed = useMemo(() => {
    const itemLines = lines.map((l) => {
      // If service, ignore quantity
      const qty = l.type === 'service' ? 1 : Number(l.quantity);
      const rate = Number(l.rate);
      const amount = round2((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(rate) ? rate : 0));
      return { ...l, amount };
    });
    const subtotal = round2(itemLines.reduce((s, l) => s + l.amount, 0));
    const disc = round2(Number(discount) || 0);
    const total = round2(Math.max(0, subtotal - disc));
    return { itemLines, subtotal, total };
  }, [lines, discount]);

  function updateLine(i, patch) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function handleDateChange(setter, e) {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0,2) + '/' + val.slice(2);
    if (val.length > 5) val = val.slice(0,5) + '/' + val.slice(5, 9);
    setter(val.slice(0, 10));
  }

  function parseDateForApi(ddmmyyyy) {
    const parts = ddmmyyyy.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return ''; // Invalid date format fallback 
  }

  function addRow() { setLines((prev) => [...prev, emptyLine()]); }
  function removeRow(i) { setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i))); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!customerId) { setError('Please select a customer'); return; }
    
    const parsedIssueDate = parseDateForApi(issueDateText);
    const parsedDueDate = parseDateForApi(dueDateText);
    
    if (!parsedIssueDate || !parsedDueDate) {
      setError('Please provide valid dates in DD/MM/YYYY format');
      return;
    }

    const payloadItems = computed.itemLines.map((l) => ({
      item_id: l.item_id ? Number(l.item_id) : null,
      name: l.name.trim(),
      description: l.description || null,
      quantity: l.type === 'service' ? null : l.quantity,
      rate: l.rate,
    }));
    
    if (payloadItems.some((l) => !l.name || (l.quantity !== null && l.quantity <= 0) || l.rate < 0)) {
      setError('Each line needs a name, positive quantity (if required), and non-negative rate');
      return;
    }
    setSaving(true);
    try {
      const body = {
        customer_id: Number(customerId),
        issue_date: parsedIssueDate,
        due_date: parsedDueDate,
        status,
        discount: Number(discount) || 0,
        notes,
        items: payloadItems,
      };
      if (isEdit) {
        await api(`/invoices/${id}`, { method: 'PUT', body });
      } else {
        await api('/invoices', { method: 'POST', body });
      }
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = useMemo(() => customers.find(c => String(c.id) === customerId), [customers, customerId]);

  if (loading) return <div className="loading-page"><div className="spinner" /> Loading…</div>;

  return (
    <div>

      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Create Invoice</h1>
          <p className="page-subtitle">Generate and manage customer invoices quickly and accurately.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn btn-ghost" style={{ background: '#FFF' }}>Add Draft</button>
          <button type="submit" form="invoice-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Sending…' : 'Send Invoice'}
          </button>
        </div>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-layout">
        {/* FORM */}
        <div className="form-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <form id="invoice-form" onSubmit={handleSubmit} className="stack">
            
            {/* Invoice Detail Section */}
            <div className="card">
              <div className="card-header"><span className="card-title">Invoice Detail</span></div>
              <div className="card-body stack">
                <div className="form-group">
                  <label>Billed To</label>
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                    <option value="">Select a customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}{c.company_name ? ` — ${c.company_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Invoice Number</label>
                    <input type="text" value={invoiceNumber} readOnly style={{ background: 'var(--surface-2)' }} />
                  </div>
                  <div className="form-group">
                    <label>Currency</label>
                    <select defaultValue="INR">
                      <option value="INR">🇮🇳 Indian Rupee</option>
                      <option value="USD">🇺🇸 US Dollar</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Issued Date (DD/MM/YYYY)</label>
                    <input type="text" placeholder="DD/MM/YYYY" value={issueDateText} onChange={(e) => handleDateChange(setIssueDateText, e)} required />
                  </div>
                  <div className="form-group">
                    <label>Due Date (DD/MM/YYYY)</label>
                    <input type="text" placeholder="DD/MM/YYYY" value={dueDateText} onChange={(e) => handleDateChange(setDueDateText, e)} required />
                  </div>
                </div>

                {/* Line Items List */}
                <div style={{ marginTop: 12 }}>
                  <div className="line-row" style={{ gridTemplateColumns: 'minmax(140px, 2fr) 90px 100px 90px 30px', marginBottom: 8 }}>
                    <span className="muted">Item</span>
                    <span className="muted text-right">QTY</span>
                    <span className="muted text-right">Cost</span>
                    <span className="muted text-right">Amount</span>
                    <span />
                  </div>

                  <div className="invoice-lines" style={{ gap: 12 }}>
                    {lines.map((line, i) => (
                      <div key={i} className="line-row" style={{ gridTemplateColumns: 'minmax(240px, 2fr) 90px 100px 90px 30px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span style={{ color: '#C0C0C0', marginTop: 10, cursor: 'grab' }}>⋮⋮</span>
                            <select
                              value={line.item_id || 'custom'}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') {
                                  updateLine(i, { item_id: '', name: '', rate: 0, description: '', type: 'goods', quantity: 1 });
                                } else {
                                  const it = catalog.find(x => String(x.id) === val);
                                  if (it) {
                                    updateLine(i, { item_id: String(it.id), name: it.name, rate: Number(it.price), description: it.description || '', type: it.type || 'goods' });
                                  }
                                }
                              }}
                              style={{ width: '130px' }}
                            >
                              <option value="custom">Custom Item...</option>
                              {catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <input
                              placeholder="Item name"
                              value={line.name}
                              onChange={(e) => updateLine(i, { name: e.target.value })}
                              required
                              style={{ flex: 1 }}
                            />
                          </div>
                          <input
                            placeholder="Description (optional)"
                            value={line.description || ''}
                            onChange={(e) => updateLine(i, { description: e.target.value })}
                            style={{ fontSize: 12, marginLeft: 22 }}
                          />
                        </div>
                        
                        {line.type === 'service' ? (
                          <div className="text-right muted" style={{ marginTop: 10 }}>—</div>
                        ) : (
                          <input
                            type="number" min="1" step="1"
                            placeholder="qty"
                            value={line.quantity || ''}
                            className="text-right"
                            onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                          />
                        )}
                        
                        <input
                          type="number" min="0" step="0.01"
                          placeholder="0.00"
                          value={line.rate || ''}
                          className="text-right"
                          onChange={(e) => updateLine(i, { rate: parseFloat(e.target.value) || 0 })}
                        />
                        <div className="line-amount text-right" style={{ paddingTop: 10 }}>{formatMoney(computed.itemLines[i]?.amount ?? 0)}</div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon text-center"
                          onClick={() => removeRow(i)}
                          title="Remove line"
                          style={{ color: 'var(--muted)', borderColor: 'transparent', padding: '0 4px', fontSize: 16 }}
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <button type="button" className="btn btn-ghost" onClick={addRow} style={{ marginTop: 12, padding: '6px 10px', fontSize: 13, border: 'none', fontWeight: 600 }}>
                    + Add Item
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Notes / Terms</span></div>
              <div className="card-body">
                <textarea
                  placeholder="Thank you for your business. Please make payment within 30 days..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', minHeight: '60px', border: 'none', padding: 0, outline: 'none' }}
                />
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
