import { useEffect, useState } from 'react';
import { api } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { PackageOpen, Plus, Pencil, Trash2 } from 'lucide-react';

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Items() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/items');
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    setForm({ name: '', type: 'service', price: '', description: '' });
    setEditing('new');
    setFormError('');
    setDialogOpen(true);
  }

  function startEdit(row) {
    setForm({ ...row, price: String(row.price) });
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
      const body = { ...form, price: parseFloat(form.price) || 0 };
      if (editing === 'new') {
        const created = await api('/items', { method: 'POST', body });
        setRows((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const updated = await api(`/items/${editing.id}`, { method: 'PUT', body });
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
    if (!confirm('Delete this item?')) return;
    try {
      await api(`/items/${id}`, { method: 'DELETE' });
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
          <h1 className="text-3xl font-bold tracking-tight">Items &amp; Services</h1>
          <p className="text-muted-foreground mt-1">{rows.length} item{rows.length !== 1 ? 's' : ''} in catalog</p>
        </div>
        <Button onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Modal Dialog for New/Edit Item */}
      <Dialog open={dialogOpen} onOpenChange={cancelEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New Item' : 'Edit Item'}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2">
            {formError && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>}
            <form id="item-form" onSubmit={handleSave} className="grid gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input placeholder="e.g. Web Design" {...f('name')} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select 
                    {...f('type')} 
                    required 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="service">Service</option>
                    <option value="goods">Goods</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Price (₹) *</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...f('price')} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Short description (optional)" {...f('description')} />
                </div>
              </div>
            </form>
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button type="submit" form="item-form" disabled={saving}>
              {saving ? 'Saving…' : 'Save Item'}
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
          <PackageOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">No items yet</h3>
          <p className="text-sm text-muted-foreground mb-4 mt-2">Add reusable items or services to speed up invoice creation.</p>
          <Button onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
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
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{r.name}</td>
                    <td className="px-6 py-4">
                      <Badge variant={r.type === 'goods' ? 'default' : 'secondary'}>
                        {r.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{r.description || '—'}</td>
                    <td className="px-6 py-4 text-right font-semibold">{inr(r.price)}</td>
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
