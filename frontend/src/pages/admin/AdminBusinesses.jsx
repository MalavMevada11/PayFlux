import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Search, ChevronLeft, ChevronRight, FileText, Users, TrendingUp } from 'lucide-react';

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      const data = await api(`/admin/businesses?${params}`);
      setBusinesses(data.businesses);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchBusinesses(); }, [fetchBusinesses]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Businesses</h1>
        <p className="text-muted-foreground mt-1">All registered businesses on the platform</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 h-10"
        />
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent" />
        </div>
      ) : businesses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No businesses found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((b) => (
            <Card key={b.id} className="p-5 hover:shadow-md transition-all duration-200 border">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-sm border border-blue-200">
                  {(b.business_name || b.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{b.business_name || 'Unnamed Business'}</h3>
                  <p className="text-xs text-muted-foreground truncate">{b.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-secondary/50">
                  <FileText className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold">{b.invoice_count}</p>
                  <p className="text-[10px] text-muted-foreground">Invoices</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-secondary/50">
                  <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold">{b.linked_customers}</p>
                  <p className="text-[10px] text-muted-foreground">Customers</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-secondary/50">
                  <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold">₹{Number(b.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>Owner: {b.first_name ? `${b.first_name} ${b.last_name || ''}`.trim() : b.email}</span>
                <span>{new Date(b.created_at).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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
    </div>
  );
}
