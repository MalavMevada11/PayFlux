import { useEffect, useState, useCallback } from 'react';
import { formatDate } from '../utils/date';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, downloadPdf, updateInvoiceStatus, addPayment, deletePayment } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Edit, FileDown, Trash2, Plus, CreditCard, Banknote, Smartphone, Building2, FileCheck, MoreHorizontal, X, Calendar, IndianRupee } from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = { paid: 'success', overdue: 'destructive', sent: 'default', partial: 'partial', draft: 'draft' };
  return <Badge variant={map[status] || 'draft'} className="capitalize">{status}</Badge>;
}

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ALL_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue'];

const METHODS = [
  { value: 'cash',           label: 'Cash',          icon: Banknote },
  { value: 'bank_transfer',  label: 'Bank Transfer', icon: Building2 },
  { value: 'upi',            label: 'UPI',           icon: Smartphone },
  { value: 'card',           label: 'Card',          icon: CreditCard },
  { value: 'cheque',         label: 'Cheque',        icon: FileCheck },
  { value: 'other',          label: 'Other',         icon: MoreHorizontal },
];

function methodLabel(m) {
  const found = METHODS.find(x => x.value === m);
  return found ? found.label : m;
}

function today() { return new Date().toISOString().split('T')[0]; }

/* ── Page ────────────────────────────────────────────────────────────── */

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Payment state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payDate, setPayDate] = useState(today);
  const [payNote, setPayNote] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const [delPayBusy, setDelPayBusy] = useState(null);

  const loadInvoice = useCallback(async () => {
    try {
      const data = await api(`/invoices/${id}`);
      setInv(data);
      // Pre-fill amount with remaining balance
      const rem = data.remaining ?? (data.total - (data.totalPaid || 0));
      setPayAmount(rem > 0 ? String(rem) : '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadInvoice(); }, [loadInvoice]);

  /* ── Invoice actions ─────────────────────────────────────────────── */

  async function handlePdf() {
    setPdfBusy(true);
    try { await downloadPdf(id, `${inv.invoice_number}.pdf`); }
    catch (e) { alert(e.message); }
    finally { setPdfBusy(false); }
  }

  async function handleStatusChange(newStatus) {
    if (newStatus === inv.status) return;
    setStatusBusy(true);
    try {
      const updated = await updateInvoiceStatus(id, newStatus);
      setInv(prev => ({ ...prev, status: updated.status }));
    } catch (e) { alert(e.message); }
    finally { setStatusBusy(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    setDeleteBusy(true);
    try { await api(`/invoices/${id}`, { method: 'DELETE' }); nav('/invoices'); }
    catch (e) { alert(e.message); setDeleteBusy(false); }
  }

  /* ── Payment actions ─────────────────────────────────────────────── */

  async function handleAddPayment(e) {
    e.preventDefault();
    setPayError('');
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { setPayError('Enter a valid amount'); return; }
    const remaining = inv.remaining ?? (inv.total - (inv.totalPaid || 0));
    if (amt > remaining + 0.01) { setPayError(`Maximum allowed: ${inr(remaining)}`); return; }

    setPayBusy(true);
    try {
      const result = await addPayment(id, {
        amount: amt,
        method: payMethod,
        date: payDate,
        note: payNote,
      });
      // Update local invoice state with returned data
      setInv(prev => ({
        ...prev,
        status: result.status,
        payments: result.payments,
        totalPaid: result.totalPaid,
        remaining: result.remaining,
      }));
      // Reset form
      setPayAmount(result.remaining > 0 ? String(result.remaining) : '');
      setPayNote('');
      setPayDate(today());
      setPayMethod('cash');
    } catch (e) { setPayError(e.message); }
    finally { setPayBusy(false); }
  }

  async function handleDeletePayment(paymentId) {
    if (!confirm('Remove this payment?')) return;
    setDelPayBusy(paymentId);
    try {
      const result = await deletePayment(id, paymentId);
      setInv(prev => ({
        ...prev,
        status: result.status,
        payments: result.payments,
        totalPaid: result.totalPaid,
        remaining: result.remaining,
      }));
      setPayAmount(result.remaining > 0 ? String(result.remaining) : '');
    } catch (e) { alert(e.message); }
    finally { setDelPayBusy(null); }
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  if (loading) return (
    <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Loading invoice…
    </div>
  );
  if (error) return <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (!inv) return null;

  const c = inv.customer || {};
  const lines = inv.items || [];
  const payments = inv.payments || [];
  const totalPaid = inv.totalPaid ?? 0;
  const remaining = inv.remaining ?? inv.total;
  const paidPercent = inv.total > 0 ? Math.min(100, Math.round((totalPaid / inv.total) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{inv.invoice_number}</h1>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-muted-foreground">
            Issued {formatDate(inv.issue_date)} &middot; Due {formatDate(inv.due_date)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={inv.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={statusBusy}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <Button variant="outline" asChild>
            <Link to={`/invoices/${id}/edit`} className="inline-flex items-center">
              <Edit className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </Link>
          </Button>
          <Button variant="outline" onClick={handlePdf} disabled={pdfBusy}>
            <FileDown className="mr-2 h-4 w-4" /> 
            <span>{pdfBusy ? 'Generating…' : 'Download PDF'}</span>
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteBusy}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>{deleteBusy ? 'Deleting…' : 'Delete'}</span>
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
        {/* ── LEFT COLUMN — Invoice details ──────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* Customer + meta info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs tracking-wider uppercase text-muted-foreground">Bill To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-semibold text-base mb-1">{c.name || '—'}</div>
                {c.company_name && <div className="text-muted-foreground">{c.company_name}</div>}
                <div className="text-muted-foreground">{c.email || ''}</div>
                {c.address && <div className="text-muted-foreground mt-2 whitespace-pre-line">{c.address}</div>}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs tracking-wider uppercase text-muted-foreground">Invoice Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Invoice #</div>
                    <div className="font-medium">{inv.invoice_number}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Status</div>
                    <div><StatusBadge status={inv.status} /></div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Issue Date</div>
                    <div className="font-medium">{formatDate(inv.issue_date)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Due Date</div>
                    <div className="font-medium">{formatDate(inv.due_date)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line items */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-secondary/30 border-b pb-4">
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-secondary/10">
                  <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-4">Item / Description</th>
                    <th className="px-6 py-4 text-right">Qty</th>
                    <th className="px-6 py-4 text-right">Rate</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((l, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">{l.name}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{Number(l.quantity)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{inr(l.rate)}</td>
                      <td className="px-6 py-4 text-right font-semibold">{inr(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t bg-secondary/10 flex justify-end p-6">
              <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{inr(inv.subtotal)}</span>
                </div>
                {Number(inv.discount) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount{inv.discount_type === 'percent' ? ` (${Number(inv.discount)}%)` : ''}</span>
                    <span>− {inv.discount_type === 'percent'
                      ? inr(parseFloat(inv.subtotal) * parseFloat(inv.discount) / 100)
                      : inr(inv.discount)
                    }</span>
                  </div>
                )}
                {(inv.taxes || []).length > 0 && (inv.taxes || []).map((t, i) => (
                  <div key={t.id || i} className="flex justify-between text-sm text-muted-foreground">
                    <span>{t.name} ({Number(t.rate)}%)</span>
                    <span>{inr(t.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t border-border pt-3 font-bold text-lg">
                  <span>Total</span>
                  <span>{inr(inv.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {inv.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs tracking-wider uppercase text-muted-foreground">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{inv.notes}</div>
              </CardContent>
            </Card>
          )}

          <div className="flex pt-4">
            <Button variant="ghost" asChild className="text-muted-foreground">
              <Link to="/invoices" className="inline-flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back to Invoices</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* ── RIGHT COLUMN — Payment Panel ───────────────────────── */}
        <div className="space-y-5">

          {/* Payment Summary */}
          <Card className="overflow-hidden border-none shadow-lg bg-gradient-to-br from-slate-50 to-blue-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm tracking-wider uppercase text-muted-foreground">
                <IndianRupee className="h-4 w-4" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{paidPercent}% paid</span>
                  <span>{inr(totalPaid)} of {inr(inv.total)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${paidPercent}%`,
                      background: paidPercent >= 100
                        ? 'linear-gradient(90deg, #059669, #10b981)'
                        : paidPercent > 0
                        ? 'linear-gradient(90deg, #2563eb, #60a5fa)'
                        : 'transparent',
                    }}
                  />
                </div>
              </div>

              {/* Amount breakdown */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/80 border border-slate-200/60 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total</div>
                  <div className="text-sm font-bold text-foreground">{inr(inv.total)}</div>
                </div>
                <div className="rounded-xl bg-white/80 border border-emerald-200/60 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-600 mb-1">Paid</div>
                  <div className="text-sm font-bold text-emerald-700">{inr(totalPaid)}</div>
                </div>
                <div className={`rounded-xl bg-white/80 border p-3 text-center ${remaining > 0 ? 'border-amber-200/60' : 'border-emerald-200/60'}`}>
                  <div className={`text-[10px] uppercase tracking-wider mb-1 ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Due</div>
                  <div className={`text-sm font-bold ${remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{inr(remaining)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Record Payment Form */}
          {remaining > 0 && (
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm tracking-wider uppercase text-muted-foreground">
                  <Plus className="h-4 w-4" />
                  Record Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddPayment} className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <input
                        id="payment-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={remaining}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-7 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={`Max ${remaining}`}
                        required
                      />
                    </div>
                  </div>

                  {/* Method */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Method</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {METHODS.map(m => {
                        const Icon = m.icon;
                        const active = payMethod === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setPayMethod(m.value)}
                            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-all ${
                              active
                                ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                : 'border-slate-200 text-muted-foreground hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="payment-date"
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        required
                      />
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note <span className="text-muted-foreground/60">(optional)</span></label>
                    <input
                      id="payment-note"
                      type="text"
                      value={payNote}
                      onChange={e => setPayNote(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="e.g. Advance payment"
                    />
                  </div>

                  {payError && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                      {payError}
                    </div>
                  )}

                    <Button type="submit" className="w-full" disabled={payBusy}>
                      {payBusy ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Recording…</span>
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          <span>Record Payment</span>
                        </>
                      )}
                    </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Fully paid banner */}
          {remaining <= 0 && inv.total > 0 && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-800">Fully Paid</div>
                <div className="text-xs text-emerald-600">All payments have been received for this invoice.</div>
              </div>
            </div>
          )}

          {/* Payment History */}
          <Card className="border-none shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm tracking-wider uppercase text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  Payment History
                </span>
                {payments.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">{payments.length} payment{payments.length !== 1 ? 's' : ''}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Banknote className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No payments recorded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((p, i) => (
                    <div
                      key={p.id}
                      className="group flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-3 transition-all hover:bg-white hover:shadow-sm hover:border-slate-200"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      {/* Method icon */}
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {(() => {
                          const M = METHODS.find(x => x.value === p.method);
                          const Icon = M ? M.icon : Banknote;
                          return <Icon className="h-4 w-4 text-primary" />;
                        })()}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{inr(p.amount)}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{methodLabel(p.method)}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <span>{formatDate(p.date)}</span>
                          {p.note && <><span className="text-slate-300">·</span><span className="truncate">{p.note}</span></>}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        disabled={delPayBusy === p.id}
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Remove payment"
                      >
                        {delPayBusy === p.id
                          ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                          : <X className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
