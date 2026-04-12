import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft, Trash2, Package, IndianRupee,
  FileText, ShoppingCart, Users, BarChart3, Hash, Layers
} from 'lucide-react';
import { formatDate } from '../utils/date';

function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }) {
  const map = { paid: 'success', overdue: 'destructive', sent: 'default', partial: 'partial', draft: 'draft' };
  return <Badge variant={map[status] || 'draft'} className="capitalize">{status}</Badge>;
}

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [item, setItem] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [itemData, analyticsData] = await Promise.all([
        api(`/items/${id}`),
        api(`/items/${id}/analytics`),
      ]);
      setItem(itemData);
      setAnalytics(analyticsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!confirm('Delete this item?')) return;
    try {
      await api(`/items/${id}`, { method: 'DELETE' });
      nav('/items');
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return (
    <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Loading item…
    </div>
  );
  if (error) return <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (!item) return null;

  const invoices = item.invoices || [];
  const a = analytics || {};

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
            <Link to="/items"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={item.type === 'goods' ? 'default' : 'secondary'} className="capitalize">
                    {item.type}
                  </Badge>
                  <span className="text-sm text-muted-foreground">·</span>
                  <span className="text-sm font-semibold text-foreground">{inr(item.price)}</span>
                  {item.description && (
                    <>
                      <span className="text-sm text-muted-foreground">·</span>
                      <span className="text-sm text-muted-foreground">{item.description}</span>
                    </>
                  )}
                </div>
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

        {/* Total Units Sold */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{a.totalUnitsSold || 0}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Units Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Count */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{a.orderCount || 0}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Avg Qty Per Order */}
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{a.avgQtyPerOrder || 0}</p>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Avg Qty / Order</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Customers + Sales Trend ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!a.topCustomers || a.topCustomers.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No customer data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {a.topCustomers.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 hover:bg-emerald-50 transition-colors cursor-pointer"
                    onClick={() => nav(`/customers/${c.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({c.orderCount} order{c.orderCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-700">{c.totalQty} units</div>
                      <div className="text-xs text-muted-foreground">{inr(c.totalAmount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Monthly Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!a.salesTrend || a.salesTrend.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No sales data yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {a.salesTrend.map((m, i) => {
                  const maxRev = Math.max(...a.salesTrend.map(s => s.revenue), 1);
                  const pct = Math.round((m.revenue / maxRev) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono w-[60px] shrink-0">{m.month}</span>
                      <div className="flex-1 h-7 bg-secondary/50 rounded-md overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-md transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                          {inr(m.revenue)} · {m.qty} units
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Invoice History ──────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b pb-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Order History
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No orders yet</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This item hasn't been included in any invoices yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/10 border-b">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4 text-right">Rate</th>
                  <th className="px-6 py-4 text-right">Line Total</th>
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
                    <td className="px-6 py-4 text-muted-foreground">
                      {inv.customer?.company_name || inv.customer?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                    <td className="px-6 py-4"><StatusBadge status={inv.status} /></td>
                    <td className="px-6 py-4 text-right">{Number(inv.quantity)}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{inr(inv.rate)}</td>
                    <td className="px-6 py-4 text-right font-semibold">{inr(inv.line_amount)}</td>
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
