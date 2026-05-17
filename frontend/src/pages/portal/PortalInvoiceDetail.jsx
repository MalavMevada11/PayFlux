import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, downloadPdf } from '../../api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  ArrowLeft, Download, Building2, Calendar, FileText,
  CreditCard, CheckCircle2, Clock, AlertTriangle
} from 'lucide-react';

const statusConfig = {
  sent:    { label: 'Sent',    color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  paid:    { label: 'Paid',    color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CreditCard },
};

function inr(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PortalInvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/portal/invoices/${id}`);
      setInv(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadPdf(id, `${inv?.invoice_number || 'invoice'}.pdf`);
    } catch (err) {
      alert('PDF download is not available for portal users yet.');
    } finally {
      setDownloading(false);
    }
  }

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        return resolve(true);
      }
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function handlePayNow() {
    setPaying(true);
    setPayError('');
    setPaySuccess('');
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay. Check your internet connection.');

      // Create order
      const order = await api('/razorpay/create-order', {
        method: 'POST',
        body: { invoice_id: parseInt(id, 10) },
      });

      // Open Razorpay Checkout
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: inv.business?.name || 'Business',
        description: `Invoice ${order.invoice_number}`,
        order_id: order.order_id,
        handler: async function (response) {
          // Verify payment
          try {
            const result = await api('/razorpay/verify', {
              method: 'POST',
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                invoice_id: parseInt(id, 10),
              },
            });
            setPaySuccess(`Payment of ${inr(result.amount)} successful! Transaction: ${result.payment_id}`);
            fetchInvoice(); // Refresh invoice data
          } catch (verifyErr) {
            setPayError(verifyErr.message);
          }
        },
        prefill: {
          name: inv.customer?.name || '',
          email: inv.customer?.email || '',
          contact: inv.customer?.phone || '',
        },
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => setPaying(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setPayError(resp.error?.description || 'Payment failed. Please try again.');
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      setPayError(err.message);
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => nav('/portal/invoices')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      </div>
    );
  }

  if (!inv) return null;

  const sc = statusConfig[inv.status] || statusConfig.sent;
  const StatusIcon = sc.icon;
  const items = inv.items || [];
  const taxes = inv.taxes || [];
  const payments = inv.payments || [];
  const business = inv.business || {};
  const customer = inv.customer || {};

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => nav('/portal/invoices')} className="gap-1.5 -ml-2 mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            {inv.invoice_number}
          </h1>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
            <Building2 className="h-3.5 w-3.5" />
            {business.name || 'Business'}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Badge className={`text-xs px-2 py-1 border ${sc.color} gap-1`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {sc.label}
          </Badge>
        </div>
      </div>

      {/* Amount Summary Card */}
      <Card className="p-5 border-emerald-200 bg-emerald-50/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Amount</p>
            <p className="text-xl font-bold mt-0.5">{inr(inv.total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Paid</p>
            <p className="text-xl font-bold mt-0.5 text-green-600">{inr(inv.totalPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Remaining</p>
            <p className={`text-xl font-bold mt-0.5 ${inv.remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {inr(inv.remaining)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Due Date</p>
            <p className={`text-xl font-bold mt-0.5 ${inv.status === 'overdue' ? 'text-red-600' : ''}`}>
              {fmtDate(inv.due_date)}
            </p>
          </div>
        </div>
      </Card>

      {/* Pay Now + Download */}
      {inv.remaining > 0 && inv.status !== 'paid' && (
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
            disabled={paying}
            onClick={handlePayNow}
          >
            <CreditCard className="h-4 w-4" />
            {paying ? 'Processing…' : `Pay ${inr(inv.remaining)}`}
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading} className="gap-1.5">
            <Download className="h-4 w-4" />
            {downloading ? 'Downloading…' : 'PDF'}
          </Button>
        </div>
      )}
      {payError && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{payError}</div>}
      {paySuccess && <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-700">{paySuccess}</div>}

      {inv.status === 'paid' && (
        <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading} className="gap-1.5">
          <Download className="h-4 w-4" />
          {downloading ? 'Downloading…' : 'Download Receipt PDF'}
        </Button>
      )}

      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* From */}
        <Card className="p-4 border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">From</h3>
          <p className="font-semibold">{business.name || '—'}</p>
          {business.gstin && <p className="text-xs text-muted-foreground mt-1">GSTIN: {business.gstin}</p>}
          {business.address && <p className="text-xs text-muted-foreground mt-0.5">{business.address}</p>}
          {business.phone && <p className="text-xs text-muted-foreground mt-0.5">Ph: {business.phone}</p>}
        </Card>

        {/* To */}
        <Card className="p-4 border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</h3>
          <p className="font-semibold">{customer.name || '—'}</p>
          {customer.company_name && <p className="text-xs text-muted-foreground mt-1">{customer.company_name}</p>}
          {customer.email && <p className="text-xs text-muted-foreground mt-0.5">{customer.email}</p>}
          {customer.phone && <p className="text-xs text-muted-foreground mt-0.5">Ph: {customer.phone}</p>}
        </Card>
      </div>

      {/* Dates */}
      <Card className="p-4 border">
        <div className="flex gap-8 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Issued:</span>
            <span className="font-medium">{fmtDate(inv.issue_date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Due:</span>
            <span className={`font-medium ${inv.status === 'overdue' ? 'text-red-600' : ''}`}>{fmtDate(inv.due_date)}</span>
          </div>
        </div>
      </Card>

      {/* Line Items */}
      <Card className="overflow-hidden border">
        <div className="px-4 py-3 border-b bg-secondary/30">
          <h3 className="text-sm font-semibold">Line Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20 border-b">
              <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{inr(item.rate)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{Number(item.quantity)}</td>
                  <td className="px-4 py-3 text-right font-medium">{inr(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="border-t px-4 py-4 bg-secondary/10">
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex justify-between w-60">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{inr(inv.subtotal)}</span>
            </div>
            {parseFloat(inv.discount) > 0 && (
              <div className="flex justify-between w-60 text-green-600">
                <span>Discount {inv.discount_type === 'percent' ? `(${inv.discount}%)` : ''}</span>
                <span>-{inr(inv.discount_type === 'percent' ? (parseFloat(inv.subtotal) * parseFloat(inv.discount) / 100) : inv.discount)}</span>
              </div>
            )}
            {taxes.map((t, i) => (
              <div key={i} className="flex justify-between w-60 text-muted-foreground">
                <span>{t.name} ({Number(t.rate)}%)</span>
                <span>{inr(t.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between w-60 pt-2 border-t border-dashed font-bold text-base">
              <span>Total</span>
              <span>{inr(inv.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card className="overflow-hidden border">
          <div className="px-4 py-3 border-b bg-secondary/30">
            <h3 className="text-sm font-semibold">Payment History</h3>
          </div>
          <div className="divide-y">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inr(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{p.method.replace('_', ' ')} • {fmtDate(p.date)}</p>
                  </div>
                </div>
                {p.note && <span className="text-xs text-muted-foreground">{p.note}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notes */}
      {inv.notes && (
        <Card className="p-4 border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inv.notes}</p>
        </Card>
      )}
    </div>
  );
}
