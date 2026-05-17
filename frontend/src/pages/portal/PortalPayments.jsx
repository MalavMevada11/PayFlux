import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { CreditCard, Search, Building2, CheckCircle2 } from 'lucide-react';

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

const methodLabels = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

export default function PortalPayments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/portal/payments');
      setPayments(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

  const filtered = search
    ? payments.filter(p =>
        p.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.business_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.method?.toLowerCase().includes(search.toLowerCase())
      )
    : payments;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
        <p className="text-muted-foreground mt-1">All payments across your linked businesses</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 border border-green-200 bg-green-50/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Paid</p>
              <p className="text-2xl font-bold mt-1 text-green-600">{inr(totalPaid)}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-green-50">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5 border border-blue-200 bg-blue-50/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Transactions</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{payments.length}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice #, business, method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          Loading payments…
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold">No payments found</h3>
          <p className="text-sm text-muted-foreground mt-2">Payment records will appear here once invoices are paid.</p>
        </Card>
      )}

      {/* Payments List */}
      {!loading && filtered.length > 0 && (
        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.invoice_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground truncate max-w-[140px]">{p.business_name || p.business_email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">{methodLabels[p.method] || p.method}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">{inr(p.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-[150px] truncate">{p.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
