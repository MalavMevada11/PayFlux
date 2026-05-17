import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../authContext';
import { api } from '../api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Link2, Copy, Check, Plus, Trash2, Building2, User, Clock, Key } from 'lucide-react';

export default function LinkManager() {
  const { isBusiness, isCustomer } = useAuth();
  const [links, setLinks] = useState([]);
  const [inviteCodes, setInviteCodes] = useState([]);
  const [connectCode, setConnectCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [linksData, codesData] = await Promise.all([
        api('/links'),
        api('/links/invites'),
      ]);
      setLinks(linksData);
      setInviteCodes(codesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const endpoint = isBusiness ? '/links/company-code' : '/links/customer-code';
      await api(endpoint, { method: 'POST' });
      setSuccess('Invite code generated!');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleConnect() {
    if (!connectCode.trim()) return;
    setConnecting(true);
    setError('');
    try {
      await api('/links/connect', { method: 'POST', body: { code: connectCode.trim() } });
      setSuccess('Successfully linked!');
      setConnectCode('');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleRemoveLink(linkId) {
    if (!confirm('Remove this link? This will disconnect the accounts.')) return;
    try {
      await api(`/links/${linkId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  function copyToClipboard(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isBusiness ? 'Customer Links' : 'Business Links'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isBusiness 
            ? 'Share your company code with customers or enter a customer code to link.'
            : 'Enter a company code to link with a business, or share your customer code.'}
        </p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive font-medium border border-destructive/20">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 font-medium border border-green-200">{success}</div>}

      {/* Connect by Code */}
      <Card className="p-5 border">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Connect with Code
        </h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder={isBusiness ? 'Enter customer code...' : 'Enter company code...'}
              value={connectCode}
              onChange={(e) => setConnectCode(e.target.value.toUpperCase())}
              className="h-10 font-mono tracking-wider"
              maxLength={12}
            />
          </div>
          <Button onClick={handleConnect} disabled={connecting || !connectCode.trim()} className="h-10">
            {connecting ? 'Linking...' : 'Connect'}
          </Button>
        </div>
      </Card>

      {/* My Invite Codes */}
      <Card className="p-5 border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            My Invite Codes
          </h2>
          <Button onClick={handleGenerate} disabled={generating} size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {generating ? 'Generating...' : 'Generate New'}
          </Button>
        </div>
        
        {inviteCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No invite codes yet. Generate one to share!</p>
        ) : (
          <div className="space-y-2">
            {inviteCodes.map((inv) => {
              const isUsed = !!inv.used_by;
              const isExpired = new Date(inv.expires_at) < new Date();
              return (
                <div key={inv.id} className={`flex items-center justify-between p-3 rounded-lg border ${isUsed ? 'bg-green-50/50 border-green-200' : isExpired ? 'bg-red-50/50 border-red-200' : 'bg-secondary/30'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-sm font-bold tracking-wider ${isUsed ? 'text-green-700' : isExpired ? 'text-red-500 line-through' : 'text-foreground'}`}>
                      {inv.code}
                    </span>
                    {isUsed && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Used</span>}
                    {isExpired && !isUsed && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Expired</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                    {!isUsed && !isExpired && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(inv.code)}>
                        {copied === inv.code ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Active Links */}
      <Card className="p-5 border">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          {isBusiness ? <User className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
          {isBusiness ? 'Linked Customers' : 'Linked Businesses'}
        </h2>

        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No links yet. Share your code or enter one to get started!</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm border border-primary/20">
                    {isBusiness
                      ? (link.customer_first_name || link.customer_email || '?').charAt(0).toUpperCase()
                      : (link.business_name || link.business_first_name || link.business_email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {isBusiness
                        ? `${link.customer_first_name || ''} ${link.customer_last_name || ''}`.trim() || link.customer_email
                        : link.business_name || `${link.business_first_name || ''} ${link.business_last_name || ''}`.trim() || link.business_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isBusiness ? link.customer_email : link.business_email} • Linked {new Date(link.linked_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveLink(link.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
