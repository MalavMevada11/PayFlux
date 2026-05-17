import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { FileText, Search, Building2, ArrowUpDown, Filter } from 'lucide-react';

const statusConfig = {
  sent:    { label: 'Sent',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  paid:    { label: 'Paid',    color: 'bg-green-100 text-green-700 border-green-200' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 border-red-200' },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

function inr(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PortalInvoices() {
  const nav = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (sortOrder === 'oldest') params.set('sort', 'oldest');
      const qs = params.toString();
      const data = await api(`/portal/invoices${qs ? '?' + qs : ''}`);
      setInvoices(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortOrder]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = search
    ? invoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        inv.business_name.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer_name?.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  const statuses = ['sent', 'paid', 'overdue', 'partial'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Invoices</h1>
        <p className="text-muted-foreground mt-1">Invoices from your linked businesses</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by invoice #, business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            title={`Sort: ${sortOrder}`}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          Loading invoices…
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold">No invoices found</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {invoices.length === 0
              ? 'Your linked businesses haven\'t sent you any invoices yet.'
              : 'No invoices match your current filters.'}
          </p>
        </Card>
      )}

      {/* Invoice Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(inv => {
            const sc = statusConfig[inv.status] || statusConfig.sent;
            return (
              <Card
                key={inv.id}
                className="p-4 hover:shadow-md transition-all cursor-pointer border hover:border-emerald-200"
                onClick={() => nav(`/portal/invoices/${inv.id}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Left: invoice info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{inv.invoice_number}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 border ${sc.color}`}>{sc.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate">{inv.business_name || inv.business_email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: amounts + dates */}
                  <div className="flex items-center gap-6 sm:gap-8 text-sm">
                    <div className="text-right">
                      <p className="font-bold text-base">{inr(inv.total)}</p>
                      {inv.remaining > 0 && inv.status !== 'paid' && (
                        <p className="text-xs text-orange-600 font-medium">Due: {inr(inv.remaining)}</p>
                      )}
                      {inv.status === 'paid' && (
                        <p className="text-xs text-green-600 font-medium">Fully Paid</p>
                      )}
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Issued</p>
                      <p className="text-sm font-medium">{new Date(inv.issue_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">Due</p>
                      <p className={`text-sm font-medium ${inv.status === 'overdue' ? 'text-red-600' : ''}`}>
                        {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
