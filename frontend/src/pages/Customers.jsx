import { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';

function getInitials(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | rowObject
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/customers');
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm({ type: 'business', name: '', email: '', phone: '', company_name: '', address: '' });
    setEditing('new');
    setFormError('');
    setDialogOpen(true);
  }

  function startEdit(row) {
    setForm({ ...row });
    setEditing(row);
    setFormError('');
    setDialogOpen(true);
  }

  function cancelEdit() {
    setDialogOpen(false);
    setEditing(null);
    setFormError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        const created = await api('/customers', { method: 'POST', body: form });
        setRows((prev) => [created, ...prev]);
      } else {
        const updated = await api(`/customers/${editing.id}`, { method: 'PUT', body: form });
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await api(`/customers/${id}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  const f = (field) => ({
    value: form[field] ?? '',
    onChange: (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1">{rows.length} customer{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Modal Dialog for New/Edit Customer */}
      <Dialog open={dialogOpen} onOpenChange={cancelEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New Customer' : 'Edit Customer'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            {formError && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
            <form id="customer-form" onSubmit={handleSave} className="grid gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select 
                    {...f('type')} 
                    required 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input placeholder="Full name" {...f('name')} required />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="contact@example.com" {...f('email')} required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+91 98765 43210" {...f('phone')} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input placeholder="Acme Pvt Ltd" {...f('company_name')} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input placeholder="123 Main St, City" {...f('address')} />
                </div>
              </div>
            </form>
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" disabled={saving}>
              {saving ? 'Saving…' : 'Save Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading…
        </div>
      )}
      
      {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">No customers yet</h3>
          <p className="text-sm text-muted-foreground mb-4 mt-2">Add your first customer to start creating invoices.</p>
          <Button onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        </Card>
      )}

      {!loading && rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b">
                <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Company</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                          {getInitials(r.name)}
                        </div>
                        <span className="font-medium">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={r.type === 'business' ? 'default' : 'secondary'}>
                        {r.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{r.email}</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.phone || '—'}</td>
                    <td className="px-6 py-4 text-muted-foreground">{r.company_name || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(r)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete">
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
