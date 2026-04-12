import { useEffect, useState, useMemo } from 'react';
import { formatDate } from '../utils/date';
import { Link } from 'react-router-dom';
import { api, downloadPdf } from '../api';
import { FileText, Plus, Trash2, FileDown, Search, Filter, X, Calendar, ChevronDown } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function customerLabel(row) {
  const c = row.customers;
  if (!c) return '—';
  return c.company_name || c.name || c.email;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
];

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/invoices');
        if (!cancelled) setRows(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => {
    let result = rows;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Search filter (customer name, invoice number)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const customer = customerLabel(r).toLowerCase();
        const invNum = (r.invoice_number || '').toLowerCase();
        return customer.includes(q) || invNum.includes(q);
      });
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter(r => r.issue_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(r => r.issue_date <= dateTo);
    }

    return result;
  }, [rows, statusFilter, searchQuery, dateFrom, dateTo]);

  async function handlePdf(id, invoiceNumber) {
    setPdfBusy(id);
    try {
      await downloadPdf(id, `${invoiceNumber || 'invoice'}.pdf`);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdfBusy(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return;
    try {
      await api(`/invoices/${id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  function clearFilters() {
    setStatusFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  }

  const hasActiveFilters = statusFilter !== 'all' || searchQuery || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all your invoices
            {!loading && <span className="ml-1 text-xs font-medium">({filteredRows.length}{hasActiveFilters ? ` of ${rows.length}` : ''} invoices)</span>}
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/create" className="inline-flex items-center">
            <Plus className="mr-2 h-4 w-4" />
            <span>New Invoice</span>
          </Link>
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by invoice # or customer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="flex h-10 w-full lg:w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none pr-8 cursor-pointer"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>

          {/* Toggle date filters */}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            className="h-10 gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Calendar className="h-4 w-4" />
            Date Range
          </Button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {/* Date range row */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading invoices…
        </div>
      )}
      {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Empty state */}
      {!loading && !error && rows.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">No invoices yet</h3>
          <p className="text-sm text-muted-foreground mb-4 mt-2">Create your first invoice to get started.</p>
          <Button asChild>
            <Link to="/invoices/create" className="inline-flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              <span>New Invoice</span>
            </Link>
          </Button>
        </Card>
      )}

      {/* No results after filtering */}
      {!loading && rows.length > 0 && filteredRows.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <Filter className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-base font-semibold">No matching invoices</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-3">Try adjusting your filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
        </Card>
      )}

      {/* Invoice table */}
      {!loading && filteredRows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Issue Date</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-primary">
                      <Link to={`/invoices/${r.id}`}>{r.invoice_number}</Link>
                    </td>
                    <td className="px-6 py-4 text-foreground font-medium">{customerLabel(r)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(r.issue_date)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(r.due_date)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={r.status === 'paid' ? 'success' : r.status === 'overdue' ? 'destructive' : r.status === 'sent' ? 'default' : r.status === 'partial' ? 'partial' : 'draft'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold">{inr(r.total)}</div>
                      {(r.totalPaid > 0 && r.status !== 'paid') && (
                        <div className="text-xs text-muted-foreground mt-0.5">Paid {inr(r.totalPaid)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/invoices/${r.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pdfBusy === r.id}
                          onClick={() => handlePdf(r.id, r.invoice_number)}
                        >
                          <FileDown className="mr-2 h-4 w-4" />
                          {pdfBusy === r.id ? 'PDF…' : 'PDF'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(r.id)}
                          title="Delete Invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
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
