import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Pencil, Trash2, Mail, Phone, Building2,
  MapPin, Calendar, FileText, IndianRupee, Clock, TrendingUp,
  ShoppingBag, Users, Package
} from 'lucide-react';
import { formatDate } from '../utils/date';

function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const map = { paid: 'success', overdue: 'destructive', sent: 'default', partial: 'partial', draft: 'draft' };
  return <Badge variant={map[status] || 'draft'} className="capitalize">{status}</Badge>;
}

function getInitials(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [custData, analyticsData] = await Promise.all([
        api(`/customers/${id}`),
        api(`/customers/${id}/analytics`),
      ]);
      setCustomer(custData);
      setAnalytics(analyticsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      nav('/customers');
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return (
    <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Loading customer…
    </div>
  );
  if (error) return <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (!customer) return null;

  const invoices = customer.invoices || [];
  const a = analytics || {};
  const sb = a.statusBreakdown || {};

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
            <Link to="/customers"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm uppercase">
                {getInitials(customer.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  <Badge variant={customer.type === 'business' ? 'default' : 'secondary'} className="capitalize mr-2">
                    {customer.type}
                  </Badge>
                  Member since {formatDate(customer.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{inr(a.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Invoices */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{a.invoiceCount || 0}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Invoice Value */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{inr(a.avgInvoiceValue)}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Avg Invoice Value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{inr(a.outstandingBalance)}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Outstanding Balance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Two Column: Contact + Payment Behavior ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{customer.email}</span>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{customer.phone}</span>
              </div>
            )}
            {customer.company_name && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{customer.company_name}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{customer.address}</span>
              </div>
            )}
            {!customer.email && !customer.phone && !customer.company_name && !customer.address && (
              <p className="text-sm text-muted-foreground">No contact details available.</p>
            )}
          </CardContent>
        </Card>

        {/* Payment & Status Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Payment & Status Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Status breakdown */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[
                { label: 'Paid', count: sb.paid || 0, color: 'emerald' },
                { label: 'Draft', count: sb.draft || 0, color: 'slate' },
                { label: 'Sent', count: sb.sent || 0, color: 'blue' },
                { label: 'Partial', count: sb.partial || 0, color: 'amber' },
                { label: 'Overdue', count: sb.overdue || 0, color: 'red' },
              ].map(s => (
                <div key={s.label} className={`text-center rounded-lg bg-${s.color}-50 px-2 py-2.5`}>
                  <div className={`text-lg font-bold text-${s.color}-700`}>{s.count}</div>
                  <div className={`text-[10px] uppercase tracking-wider text-${s.color}-600 font-medium`}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Avg payment time */}
            <div className="rounded-lg bg-secondary/50 px-4 py-3 flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <span className="text-sm font-semibold">
                  {a.avgPaymentDays !== null && a.avgPaymentDays !== undefined ? `${a.avgPaymentDays} days` : 'N/A'}
                </span>
                <span className="text-xs text-muted-foreground ml-2">avg. payment time</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Most Purchased Items ─────────────────────────────────── */}
      {a.topItems && a.topItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-purple-500" />
              Most Purchased Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {a.topItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg bg-purple-50/50 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                      {i + 1}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({item.invoiceAppearances} invoice{item.invoiceAppearances !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-purple-700">{item.totalQty} units</div>
                    <div className="text-xs text-muted-foreground">{inr(item.totalAmount)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Invoice History ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b pb-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Invoice History
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No invoices yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Create an invoice for this customer to see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/10 border-b">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Paid</th>
                  <th className="px-6 py-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => nav(`/invoices/${inv.id}`)}
                  >
                    <td className="px-6 py-4 font-medium text-primary">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.due_date)}</td>
                    <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                    <td className="px-6 py-4 text-right font-semibold">{inr(inv.total)}</td>
                    <td className="px-6 py-4 text-right text-emerald-600">{inr(inv.totalPaid)}</td>
                    <td className="px-6 py-4 text-right text-amber-600">{inr(inv.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
