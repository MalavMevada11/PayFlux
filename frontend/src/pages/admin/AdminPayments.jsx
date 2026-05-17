import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';

const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
};

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      const data = await api(`/admin/payments?${params}`);
      setPayments(data.payments);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Global Payments</h1>
        <p className="text-muted-foreground mt-1">All payments across all businesses</p>
      </div>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Payment</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Business</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Invoice</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Method</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No payments found</td></tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="border-b hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-green-50">
                        <DollarSign className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <span className="font-mono text-xs">#{p.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-sm">{p.business_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.customer_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.invoice_number}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-secondary border capitalize">{(p.method || '').replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${STATUS_BADGE[p.invoice_status] || STATUS_BADGE.draft}`}>
                      {p.invoice_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.date || p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-secondary/10">
            <span className="text-sm text-muted-foreground">
              {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
