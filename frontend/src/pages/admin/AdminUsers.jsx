import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Search, ChevronLeft, ChevronRight, Shield, Building2, User } from 'lucide-react';

const ROLE_BADGE = {
  admin: { label: 'Admin', class: 'bg-violet-100 text-violet-700 border-violet-200' },
  business: { label: 'Business', class: 'bg-blue-100 text-blue-700 border-blue-200' },
  customer: { label: 'Customer', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const ROLE_ICON = {
  admin: Shield,
  business: Building2,
  customer: User,
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const data = await api(`/admin/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.ceil(total / 25);

  async function handleRoleChange(userId, newRole) {
    try {
      await api(`/admin/users/${userId}/role`, { method: 'PUT', body: { role: newRole } });
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">Manage all users across the platform</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-2">
          {['', 'admin', 'business', 'customer'].map((r) => (
            <Button
              key={r || 'all'}
              variant={roleFilter === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setRoleFilter(r); setPage(1); }}
              className="h-10"
            >
              {r ? ROLE_BADGE[r].label : 'All'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Business Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Joined</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No users found</td></tr>
              ) : users.map((u) => {
                const RIcon = ROLE_ICON[u.role] || User;
                const badge = ROLE_BADGE[u.role] || ROLE_BADGE.customer;
                return (
                  <tr key={u.id} className="border-b hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground font-semibold text-xs">
                          {(u.first_name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.class}`}>
                        <RIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.business_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="text-xs border rounded-md px-2 py-1.5 bg-background hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="business">Business</option>
                        <option value="customer">Customer</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-secondary/10">
            <span className="text-sm text-muted-foreground">
              Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total}
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
