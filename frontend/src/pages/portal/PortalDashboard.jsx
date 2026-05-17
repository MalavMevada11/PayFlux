import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../authContext';
import { api } from '../../api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Building2, FileText, CreditCard, Link2, Copy, Check, Key, Plus } from 'lucide-react';

export default function PortalDashboard() {
  const { user } = useAuth();
  const [links, setLinks] = useState([]);
  const [stats, setStats] = useState({ linked_businesses: 0, total_invoices: 0, pending_amount: 0, total_paid: 0 });
  const [loading, setLoading] = useState(true);

  // Link to business form
  const [companyCode, setCompanyCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  // Generate my code
  const [myCode, setMyCode] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [linksData, statsData] = await Promise.all([
        api('/links'),
        api('/portal/stats'),
      ]);
      setLinks(linksData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLinkBusiness() {
    if (!companyCode.trim()) return;
    setLinkLoading(true);
    setLinkError('');
    setLinkSuccess('');
    try {
      await api('/links/connect', { method: 'POST', body: { code: companyCode.trim() } });
      setLinkSuccess('Successfully linked to business!');
      setCompanyCode('');
      fetchData();
      setTimeout(() => setLinkSuccess(''), 3000);
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleGenerateMyCode() {
    setCodeLoading(true);
    try {
      const res = await api('/links/customer-code', { method: 'POST' });
      setMyCode(res.code);
      setCodeCopied(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setCodeLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(myCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user?.first_name || 'there'}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">Your customer portal overview</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border border-emerald-200 bg-emerald-50/30 hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Linked Businesses</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{links.length}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5 border border-blue-200 bg-blue-50/30 hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Invoices</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{stats.total_invoices}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-5 border border-orange-200 bg-orange-50/30 hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Pending Amount</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">₹{Number(stats.pending_amount).toLocaleString('en-IN')}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-50">
              <CreditCard className="h-5 w-5 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Link to Business + Generate My Code — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-emerald-600" />
            Link to a Business
          </h2>
          <p className="text-sm text-muted-foreground mb-3">Got a company code? Enter it below to connect.</p>
          {linkError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 mb-3">{linkError}</div>}
          {linkSuccess && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200 mb-3">{linkSuccess}</div>}
          <div className="flex gap-2">
            <Input
              placeholder="Enter company code"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
              className="font-mono tracking-wider"
              maxLength={12}
            />
            <Button onClick={handleLinkBusiness} disabled={linkLoading || !companyCode.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {linkLoading ? 'Linking...' : 'Link'}
            </Button>
          </div>
        </Card>

        <Card className="p-5 border">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Key className="h-4 w-4 text-emerald-600" />
            Share Your Code
          </h2>
          <p className="text-sm text-muted-foreground mb-3">Generate a code and share it with a business so they can add you.</p>
          {myCode ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/30">
              <span className="font-mono text-lg font-bold tracking-widest flex-1">{myCode}</span>
              <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
                {codeCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {codeCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleGenerateMyCode} disabled={codeLoading} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {codeLoading ? 'Generating...' : 'Generate My Code'}
            </Button>
          )}
        </Card>
      </div>

      {/* Linked Businesses */}
      <Card className="p-5 border">
        <h2 className="text-base font-semibold mb-4">Your Linked Businesses</h2>

        {links.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No linked businesses yet</p>
            <p className="text-muted-foreground text-xs mt-1">Enter a company code above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-sm border border-blue-200">
                  {(link.business_name || link.business_email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{link.business_name || `${link.business_first_name || ''} ${link.business_last_name || ''}`.trim() || 'Unnamed Business'}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.business_email}</p>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(link.linked_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
