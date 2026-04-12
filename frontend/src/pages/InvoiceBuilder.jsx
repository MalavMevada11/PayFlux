import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { formatDate } from '../utils/date';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getProfile, previewHtml as fetchPreviewHtml } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Search, Plus, Trash2, FileText, Send, Eye, EyeOff, Settings, Percent, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function round2(n) { return Math.round(Number(n) * 100) / 100; }
function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const emptyLine = () => ({ item_id: '', name: '', quantity: 1, rate: 0, description: '', type: 'goods' });

/* ─── Item Combobox Component ─────────────────────────────────────────── */
function ItemCombobox({ value, onChange, onSelectCatalogItem, catalog, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapperRef = useRef(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = catalog.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Input
        placeholder="Items"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="flex-1 h-10 w-full font-medium text-base rounded-md border border-input bg-background px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 max-h-48">
            {filtered.length > 0 ? (
              filtered.map(c => (
                <div 
                  key={c.id} 
                  className="px-3 py-3 cursor-pointer hover:bg-secondary/80 border-b border-border/40 last:border-0 transition-colors"
                  onClick={() => {
                    onChange(c.name);
                    onSelectCatalogItem(c);
                    setOpen(false);
                  }}
                >
                  <div className="font-semibold text-sm text-foreground">{c.name}</div>
                  {c.description && <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</div>}
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground italic">Type to add as custom item...</div>
            )}
          </div>
          <div className="p-1 border-t border-border/40 bg-muted/20 mt-auto shrink-0">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-sm h-8 font-medium text-primary hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                if (onAddNew) onAddNew();
              }}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              <span>Add New Item</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Customer Combobox Component ─────────────────────────────────────── */
function CustomerCombobox({ value, onChange, customers, onAddNew }) {
  const [open, setOpen] = useState(false);
  const selectedCustomer = customers.find(c => String(c.id) === String(value));
  const [search, setSearch] = useState(selectedCustomer ? selectedCustomer.name : '');
  const wrapperRef = useRef(null);

  useEffect(() => {
    const sel = customers.find(c => String(c.id) === String(value));
    if (sel) setSearch(sel.name);
    else setSearch('');
  }, [value, customers]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        const sel = customers.find(c => String(c.id) === String(value));
        if (sel) setSearch(sel.name);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, customers]);

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.company_name && c.company_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Input
        placeholder="Search for a customer..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setSearch('');
          setOpen(true);
        }}
        className="flex-1 h-10 w-full font-medium text-base rounded-md border border-input bg-background px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 max-h-48">
            {filtered.length > 0 ? (
              filtered.map(c => (
                <div 
                  key={c.id} 
                  className="px-3 py-3 cursor-pointer hover:bg-secondary/80 border-b border-border/40 last:border-0 transition-colors"
                  onClick={() => {
                    onChange(String(c.id));
                    setSearch(c.name);
                    setOpen(false);
                  }}
                >
                  <div className="font-semibold text-sm text-foreground">{c.name}</div>
                  {c.company_name && <div className="text-xs text-muted-foreground mt-0.5">{c.company_name}</div>}
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-muted-foreground italic">No customers found.</div>
            )}
          </div>
          <div className="p-1 border-t border-border/40 bg-muted/20 mt-auto shrink-0">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-sm h-8 font-medium text-primary hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                if (onAddNew) onAddNew();
              }}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              <span>Add New Customer</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Live PDF Preview (iframe-based, renders actual PDF HTML) ────────── */
function LivePdfPreview({ formData }) {
  const iframeRef = useRef(null);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const debounceRef = useRef(null);

  // Compute scale factor: container width / A4 width (794px at 96dpi)
  const A4_WIDTH = 794;

  useEffect(() => {
    function updateScale() {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setScale(containerWidth / A4_WIDTH);
      }
    }
    updateScale();
    const obs = new ResizeObserver(updateScale);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Debounced fetch of preview HTML
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await fetchPreviewHtml(formData);
        setHtml(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [JSON.stringify(formData)]);

  // Write HTML to iframe
  useEffect(() => {
    if (!html || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="relative overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-slate-900/5"
        style={{
          width: '100%',
          paddingBottom: `${(1123 / A4_WIDTH) * 100}%`, // A4 aspect ratio
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${A4_WIDTH}px`,
            height: '1123px',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            ref={iframeRef}
            title="Invoice Preview"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
          />
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}

/* ─── Main InvoiceBuilder ────────────────────────────────────────────── */
export default function InvoiceBuilder() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const nav = useNavigate();

  const [settings, setSettings]       = useState({});
  const [customers, setCustomers]     = useState([]);
  const [catalog, setCatalog]         = useState([]);
  const [customerId, setCustomerId]   = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  const formatDateForDisplay = formatDate;

  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 30));
  
  const [status, setStatus]           = useState('draft');
  const [discount, setDiscount]       = useState(0);
  const [discountType, setDiscountType] = useState('flat'); // 'flat' | 'percent'
  const [taxes, setTaxes]             = useState([]); // [{name, rate}]
  const [notes, setNotes]             = useState('Thank you for your business. Please make payment within 30 days. Contact us with any questions regarding this invoice.');
  const [lines, setLines]             = useState([emptyLine()]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Modals state
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ type: 'business', name: '', email: '', phone: '', company_name: '', address: '' });
  const [newCustomerSaving, setNewCustomerSaving] = useState(false);
  
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', type: 'service', price: '', description: '' });
  const [newItemSaving, setNewItemSaving] = useState(false);

  // Config State
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm, setConfigForm] = useState({ type: 'sequential', prefix: 'INV-', postfix: '' });
  const [configSaving, setConfigSaving] = useState(false);

  function handleOpenConfig() {
    const savedType = settings.invoice_generation_type;
    const type = savedType === 'manual' || savedType === 'sequential' ? savedType : 'sequential';
    setConfigForm({
      type,
      prefix: typeof settings.invoice_prefix === 'string' ? settings.invoice_prefix : 'INV-',
      postfix: typeof settings.invoice_postfix === 'string' ? settings.invoice_postfix : ''
    });
    setConfigOpen(true);
  }

  // Derived: is the invoice number manually editable?
  const isManualMode = (settings.invoice_generation_type || 'sequential') === 'manual';

  async function handleSaveConfig(e) {
    if (e) e.preventDefault();
    setConfigSaving(true);
    try {
      const updated = await api('/auth/profile', {
        method: 'PUT',
        body: {
          business_name: settings.business_name || '',
          business_address: settings.business_address || '',
          gstin: settings.gstin || '',
          phone: settings.phone || '',
          invoice_generation_type: configForm.type,
          invoice_prefix: configForm.type === 'sequential' ? (configForm.prefix || 'INV-') : 'INV-',
          invoice_postfix: configForm.type === 'sequential' ? (configForm.postfix || '') : ''
        }
      });
      setSettings(updated);
      setConfigOpen(false);
      // Refresh invoice number only for sequential
      if (!isEdit && configForm.type === 'sequential') {
        const data = await api('/invoices/next-number').catch(() => null);
        if (data && data.nextNumber) setInvoiceNumber(data.nextNumber);
      } else if (!isEdit && configForm.type === 'manual') {
        // leave current invoiceNumber as-is so user can type it
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleSaveNewCustomer(e) {
    if (e) e.preventDefault();
    setNewCustomerSaving(true);
    try {
      const created = await api('/customers', { method: 'POST', body: newCustomerForm });
      setCustomers(prev => [...prev, created]);
      setCustomerId(String(created.id));
      setNewCustomerOpen(false);
      setNewCustomerForm({ type: 'business', name: '', email: '', phone: '', company_name: '', address: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setNewCustomerSaving(false);
    }
  }

  async function handleSaveNewItem(e) {
    if (e) e.preventDefault();
    setNewItemSaving(true);
    try {
      const body = { ...newItemForm, price: parseFloat(newItemForm.price) || 0 };
      const created = await api('/items', { method: 'POST', body });
      setCatalog(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewItemOpen(false);
      setNewItemForm({ name: '', type: 'service', price: '', description: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setNewItemSaving(false);
    }
  }

  const customerF = (field) => ({
    value: newCustomerForm[field] ?? '',
    onChange: (e) => setNewCustomerForm((prev) => ({ ...prev, [field]: e.target.value })),
  });
  
  const itemF = (field) => ({
    value: newItemForm[field] ?? '',
    onChange: (e) => setNewItemForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, it, prof, nextNum] = await Promise.all([
          api('/customers'), 
          api('/items'), 
          getProfile(),
          !isEdit ? api('/invoices/next-number').catch(() => null) : Promise.resolve(null)
        ]);
        if (cancelled) return;
        setCustomers(c || []);
        setCatalog(it || []);
        setSettings(prof || {});
        if (!isEdit && nextNum && nextNum.nextNumber) setInvoiceNumber(nextNum.nextNumber);
        
        if (isEdit) {
          const inv = await api(`/invoices/${id}`);
          if (cancelled) return;
          setCustomerId(String(inv.customer_id));
          setInvoiceNumber(inv.invoice_number);
          setIssueDate(inv.issue_date.substring(0, 10));
          setDueDate(inv.due_date.substring(0, 10));
          setStatus(inv.status);
          setDiscount(Number(inv.discount));
          setDiscountType(inv.discount_type || 'flat');
          setTaxes((inv.taxes || []).map(t => ({ name: t.name, rate: Number(t.rate) })));
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
      const qty = l.type === 'service' ? 1 : Number(l.quantity);
      const rate = Number(l.rate);
      const amount = round2((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(rate) ? rate : 0));
      return { ...l, amount };
    });
    const subtotal = round2(itemLines.reduce((s, l) => s + l.amount, 0));
    const discVal = round2(Number(discount) || 0);
    let discountAmount;
    if (discountType === 'percent') {
      discountAmount = round2(subtotal * Math.min(discVal, 100) / 100);
    } else {
      discountAmount = round2(Math.min(discVal, subtotal));
    }
    const taxableAmount = round2(Math.max(0, subtotal - discountAmount));
    const computedTaxes = taxes.map(t => {
      const rate = round2(Number(t.rate) || 0);
      const amount = round2(taxableAmount * rate / 100);
      return { name: t.name, rate, amount };
    });
    const totalTax = round2(computedTaxes.reduce((s, t) => s + t.amount, 0));
    const total = round2(taxableAmount + totalTax);
    return { itemLines, subtotal, discountAmount, discountValue: discVal, discountType, taxes: computedTaxes, totalTax, taxableAmount, total };
  }, [lines, discount, discountType, taxes]);

  function updateLine(i, patch) {
    setLines((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  function addRow() { setLines((prev) => [...prev, emptyLine()]); }
  function removeRow(i) { setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i))); }

  async function handleSubmit(e, overrideStatus = null) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    if (!customerId) { setError('Please select a customer'); return; }
    
    const parsedIssueDate = issueDate;
    const parsedDueDate = dueDate;
    
    if (!parsedIssueDate || !parsedDueDate) {
      setError('Please provide valid dates');
      return;
    }

    const payloadItems = computed.itemLines
      .filter((l) => l.name.trim())
      .map((l) => ({
        item_id: l.item_id ? Number(l.item_id) : null,
        name: l.name.trim(),
        description: l.description || null,
        quantity: l.type === 'service' ? null : l.quantity,
        rate: l.rate,
      }));
    
    if (payloadItems.length === 0) {
      setError('Atleast 1 item should be added');
      return;
    }
    setSaving(true);
    try {
      const body = {
        customer_id: Number(customerId),
        issue_date: parsedIssueDate,
        due_date: parsedDueDate,
        status: overrideStatus || status,
        discount: Number(discount) || 0,
        discount_type: discountType,
        taxes: taxes.filter(t => t.name && Number(t.rate) > 0),
        notes,
        items: payloadItems,
      };
      if (isEdit) {
        await api(`/invoices/${id}`, { method: 'PUT', body });
      } else {
        await api('/invoices', { method: 'POST', body });
      }
      nav('/invoices');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedCustomer = useMemo(() => customers.find(c => String(c.id) === customerId), [customers, customerId]);

  if (loading) return (
    <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Loading editor…
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isEdit ? 'Edit Invoice' : 'Create Invoice'}</h1>
          <p className="text-muted-foreground mt-1">Generate and manage customer invoices quickly and accurately.</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <><EyeOff className="mr-2 h-4 w-4" /> Hide Preview</> : <><Eye className="mr-2 h-4 w-4" /> Show Preview</>}
          </Button>
          <Button 
            type="button" 
            variant="outline"
            disabled={saving}
            onClick={(e) => handleSubmit(e, 'draft')}
          >
            Save Draft
          </Button>
          <Button 
            type="submit" 
            form="invoice-form" 
            disabled={saving}
            onClick={() => setStatus('sent')}
          >
            <Send className="mr-2 h-4 w-4" />
            {saving ? 'Saving…' : 'Save & Send'}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* ─── Split Layout: Form (left) + Preview (right) ─────────────── */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT: Form */}
        <div className="flex-1 w-full space-y-6">
          <form id="invoice-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Invoice Detail Section */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-2 max-w-sm">
                  <Label>Billed To *</Label>
                  <CustomerCombobox 
                    value={customerId} 
                    onChange={setCustomerId} 
                    customers={customers}
                    onAddNew={() => setNewCustomerOpen(true)}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2 relative">
                    <div className="flex justify-between items-center">
                      <Label>Invoice Number</Label>
                      <button type="button" onClick={handleOpenConfig} className="text-muted-foreground hover:text-foreground outline-none">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                    <Input 
                      type="text" 
                      value={invoiceNumber} 
                      readOnly={!isManualMode}
                      onChange={isManualMode ? (e) => setInvoiceNumber(e.target.value) : undefined}
                      className={`font-mono ${!isManualMode ? 'bg-muted text-muted-foreground' : ''}`}
                      placeholder={isManualMode ? 'Enter invoice number' : ''}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Currency</Label>
                    <select defaultValue="INR" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="INR">🇮🇳 Indian Rupee (INR)</option>
                      <option value="USD">🇺🇸 US Dollar (USD)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Issued Date</Label>
                    <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required className="block w-full" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="block w-full" />
                  </div>
                </div>

                {/* Line Items */}
                <div className="pt-4 border-t border-border mt-2">
                  <Label className="mb-4 block text-base font-semibold">Line Items</Label>
                  
                  <div className="hidden md:grid grid-cols-[1fr_80px_100px_90px_40px] gap-3 mb-2 px-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Item Details</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Qty</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Rate</span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Amount</span>
                    <span />
                  </div>

                  <div className="space-y-4">
                    {lines.map((line, i) => (
                      <div key={i} className="flex flex-col md:grid md:grid-cols-[1fr_80px_100px_90px_40px] gap-3 items-start bg-secondary/30 p-3 md:p-2 md:bg-transparent rounded-lg border md:border-none border-border">
                        <div className="flex flex-col gap-2.5 w-full">
                          <ItemCombobox
                            value={line.name}
                            onChange={(val) => {
                              // Just typing, assume it's a custom item unless it matches exactly
                              const it = catalog.find(x => x.name.toLowerCase() === val.toLowerCase());
                              if (it) {
                                updateLine(i, { 
                                  item_id: String(it.id), name: it.name, rate: Number(it.price), 
                                  description: it.description || '', type: it.type || 'goods' 
                                });
                              } else {
                                updateLine(i, { item_id: '', name: val });
                              }
                            }}
                            onSelectCatalogItem={(it) => {
                              updateLine(i, { 
                                item_id: String(it.id), name: it.name, rate: Number(it.price), 
                                description: it.description || '', type: it.type || 'goods' 
                              });
                            }}
                            catalog={catalog}
                            onAddNew={() => setNewItemOpen(true)}
                          />
                          <Input
                            placeholder="Description (optional)"
                            value={line.description || ''}
                            onChange={(e) => updateLine(i, { description: e.target.value })}
                            className="h-9 text-sm bg-muted/40 border-transparent hover:border-border focus:border-border transition-colors"
                          />
                        </div>
                        
                        <div className="flex items-center gap-2 w-full md:w-auto md:block pt-0.5">
                          <Label className="md:hidden w-16 text-xs text-muted-foreground">Qty</Label>
                          {line.type === 'service' ? (
                            <div className="h-10 flex items-center justify-end text-muted-foreground md:w-full w-full px-3">—</div>
                          ) : (
                            <Input
                              type="number" min="1" step="1"
                              placeholder="1"
                              value={line.quantity || ''}
                              onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value, 10) || 0 })}
                              className="text-right h-10 w-full"
                            />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 w-full md:w-auto md:block pt-0.5">
                          <Label className="md:hidden w-16 text-xs text-muted-foreground">Rate</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            placeholder="0.00"
                            value={line.rate || ''}
                            onChange={(e) => updateLine(i, { rate: parseFloat(e.target.value) || 0 })}
                            className="text-right h-10 w-full"
                          />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto md:block pt-0.5">
                          <Label className="md:hidden w-16 text-xs text-muted-foreground">Amount</Label>
                          <div className="md:h-10 flex items-center md:justify-end font-semibold text-base w-full text-right md:px-0">
                            {inr(computed.itemLines[i]?.amount ?? 0)}
                          </div>
                        </div>

                        <div className="flex w-full md:w-auto justify-end md:justify-center md:items-start pt-1 md:pt-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(i)}
                            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            title="Remove item"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addRow} 
                    className="mt-4 border-dashed bg-secondary/20 hover:bg-secondary/60"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add Line Item</span>
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* ─── Totals Summary Card ──────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Subtotal */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground font-medium">Subtotal</span>
                  <span className="font-semibold text-base">{inr(computed.subtotal)}</span>
                </div>

                {/* ── Discount Section ─────────────────────────── */}
                <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Discount</Label>
                    {/* ₹ / % toggle */}
                    <div className="flex items-center bg-background rounded-md border border-input overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setDiscountType('flat'); }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === 'flat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >₹</button>
                      <button
                        type="button"
                        onClick={() => { setDiscountType('percent'); }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >%</button>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number" min="0" step="0.01"
                      max={discountType === 'percent' ? 100 : undefined}
                      placeholder="0.00"
                      value={discount || ''}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="flex-1"
                    />
                    {discountType === 'percent' && (
                      <span className="text-sm text-muted-foreground font-medium shrink-0">= {inr(computed.discountAmount)}</span>
                    )}
                  </div>
                  {/* Quick discount presets */}
                  <div className="flex gap-1.5 flex-wrap">
                    {[10, 20, 50].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => { setDiscountType('percent'); setDiscount(pct); }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                          discountType === 'percent' && discount === pct
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                        }`}
                      >{pct}%</button>
                    ))}
                    {Number(discount) > 0 && (
                      <button
                        type="button"
                        onClick={() => { setDiscount(0); }}
                        className="px-2 py-1 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      >Clear</button>
                    )}
                  </div>
                </div>

                {/* Show discount result */}
                {computed.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-emerald-600">
                    <span>Discount {discountType === 'percent' ? `(${discount}%)` : ''}</span>
                    <span className="font-medium">− {inr(computed.discountAmount)}</span>
                  </div>
                )}

                {/* Taxable Amount (shown when there's discount or taxes) */}
                {(computed.discountAmount > 0 || taxes.length > 0) && (
                  <div className="flex justify-between items-center text-sm border-t pt-3">
                    <span className="text-muted-foreground font-medium">Taxable Amount</span>
                    <span className="font-semibold">{inr(computed.taxableAmount)}</span>
                  </div>
                )}

                {/* ── Tax Section ──────────────────────────────── */}
                <div className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Taxes</Label>
                    <span className="text-xs text-muted-foreground">{taxes.length === 0 ? 'None' : `${taxes.length} tax${taxes.length > 1 ? 'es' : ''}`}</span>
                  </div>

                  {/* Tax rows */}
                  {taxes.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Tax name (e.g. CGST)"
                        value={t.name}
                        onChange={(e) => setTaxes(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="flex-1 h-9 text-sm"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number" min="0" step="0.01" max="100"
                          placeholder="%"
                          value={t.rate || ''}
                          onChange={(e) => setTaxes(prev => prev.map((x, j) => j === i ? { ...x, rate: parseFloat(e.target.value) || 0 } : x))}
                          className="w-20 h-9 text-sm text-right"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground w-24 text-right shrink-0">
                        {inr(computed.taxes[i]?.amount ?? 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTaxes(prev => prev.filter((_, j) => j !== i))}
                        className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {/* Quick-add tax presets */}
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setTaxes(prev => [...prev, { name: '', rate: 0 }])}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-dashed border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Custom
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxes(prev => [...prev, { name: 'CGST', rate: 2.5 }, { name: 'SGST', rate: 2.5 }])}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >GST 5%</button>
                    <button
                      type="button"
                      onClick={() => setTaxes(prev => [...prev, { name: 'CGST', rate: 6 }, { name: 'SGST', rate: 6 }])}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >GST 12%</button>
                    <button
                      type="button"
                      onClick={() => setTaxes(prev => [...prev, { name: 'CGST', rate: 9 }, { name: 'SGST', rate: 9 }])}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >GST 18%</button>
                    <button
                      type="button"
                      onClick={() => setTaxes(prev => [...prev, { name: 'IGST', rate: 18 }])}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                    >IGST 18%</button>
                    {taxes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTaxes([])}
                        className="px-2 py-1 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      >Clear All</button>
                    )}
                  </div>
                </div>

                {/* Tax subtotals */}
                {computed.taxes.length > 0 && computed.taxes.map((t, i) => (
                  <div key={i} className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>{t.name} ({t.rate}%)</span>
                    <span className="font-medium">{inr(t.amount)}</span>
                  </div>
                ))}

                {/* ═══ Grand Total ═══ */}
                <div className="flex justify-between items-center pt-4 border-t-2 border-foreground/80">
                  <span className="text-base font-bold">Total</span>
                  <span className="text-xl font-bold">{inr(computed.total)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes & Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Thank you for your business. Please make payment within 30 days..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>

          </form>
        </div>

        {/* RIGHT: Live Preview */}
        {showPreview && (
          <div className="w-full lg:w-[460px] xl:w-[500px] shrink-0 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="sticky top-20 bg-muted/30 p-4 rounded-xl border border-border">
              <div className="flex items-center gap-2 mb-4 px-1 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Live PDF Preview</span>
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              
              <LivePdfPreview
                formData={{
                  customer_id: customerId ? Number(customerId) : null,
                  invoice_number: invoiceNumber,
                  issue_date: issueDate,
                  due_date: dueDate,
                  status,
                  discount: Number(discount) || 0,
                  discount_type: discountType,
                  taxes: taxes.filter(t => t.name && Number(t.rate) > 0),
                  notes,
                  items: lines
                    .filter(l => l.name.trim())
                    .map(l => ({
                      item_id: l.item_id ? Number(l.item_id) : null,
                      name: l.name.trim(),
                      description: l.description || '',
                      quantity: l.type === 'service' ? 1 : l.quantity,
                      rate: l.rate,
                    })),
                }}
              />
            </div>
          </div>
        )}

      </div>

      {/* Modal Dialog for New Customer */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            <form id="new-customer-form" onSubmit={handleSaveNewCustomer} className="grid gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select 
                    {...customerF('type')} 
                    required 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input placeholder="Full name" {...customerF('name')} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="contact@example.com" {...customerF('email')} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+91 98765 43210" {...customerF('phone')} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input placeholder="Acme Pvt Ltd" {...customerF('company_name')} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input placeholder="123 Main St, City" {...customerF('address')} />
                </div>
              </div>
            </form>
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setNewCustomerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-customer-form" disabled={newCustomerSaving}>
              {newCustomerSaving ? 'Saving…' : 'Save Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog for New Item */}
      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Item</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            <form id="new-item-form" onSubmit={handleSaveNewItem} className="grid gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input placeholder="e.g. Web Design" {...itemF('name')} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select 
                    {...itemF('type')} 
                    required 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="service">Service</option>
                    <option value="goods">Goods</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Price (₹) *</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...itemF('price')} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Short description (optional)" {...itemF('description')} />
                </div>
              </div>
            </form>
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setNewItemOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-item-form" disabled={newItemSaving}>
              {newItemSaving ? 'Saving…' : 'Save Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-semibold">Invoice Number Settings</DialogTitle>
          </DialogHeader>
          <form id="config-form" onSubmit={handleSaveConfig} className="space-y-5 px-6 pt-3 pb-2">
            {/* Generation Type Toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Generation Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfigForm(prev => ({ ...prev, type: 'sequential' }))}
                  className={`rounded-lg border-2 px-4 py-3 text-center font-semibold text-sm transition-colors ${
                    configForm.type === 'sequential'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  Sequential
                </button>
                <button
                  type="button"
                  onClick={() => setConfigForm(prev => ({ ...prev, type: 'manual' }))}
                  className={`rounded-lg border-2 px-4 py-3 text-center font-semibold text-sm transition-colors ${
                    configForm.type === 'manual'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-muted-foreground/40'
                  }`}
                >
                  Enter Manually
                </button>
              </div>
            </div>

            {/* Sequential: prefix + postfix */}
            {configForm.type === 'sequential' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Prefix</Label>
                  <Input
                    value={configForm.prefix}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, prefix: e.target.value }))}
                    placeholder="INV-"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Postfix <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input
                    value={configForm.postfix}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, postfix: e.target.value }))}
                    placeholder="e.g. -2025"
                  />
                </div>
              </div>
            )}
          </form>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button variant="outline" type="button" onClick={() => setConfigOpen(false)} disabled={configSaving}>Cancel</Button>
            <Button type="submit" form="config-form" disabled={configSaving}>
              {configSaving ? 'Saving…' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
