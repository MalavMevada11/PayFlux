import { useEffect, useRef, useState } from 'react';
import { getProfile, updateProfile, uploadLogo } from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Upload, Trash2, Lightbulb, LogOut, Building2, Smartphone, QrCode } from 'lucide-react';
import { useAuth } from '../authContext';

export default function Profile() {
  const { logout } = useAuth();
  const [form, setForm] = useState({
    business_name: '',
    business_address: '',
    gstin: '',
    phone: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    bank_name: '',
    bank_branch: '',
    upi_id: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // Logo state
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState('');
  const fileInputRef = useRef(null);

  // UPI QR state
  const [upiQrPreview, setUpiQrPreview] = useState('');
  const [upiQrUploading, setUpiQrUploading] = useState(false);
  const [upiQrError, setUpiQrError] = useState('');
  const [upiQrSuccess, setUpiQrSuccess] = useState('');
  const qrFileInputRef = useRef(null);

  // All settings reference (for preserving fields on partial saves)
  const allSettingsRef = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        allSettingsRef.current = data;
        setForm({
          business_name:    data.business_name    || '',
          business_address: data.business_address || '',
          gstin:            data.gstin            || '',
          phone:            data.phone            || '',
        });
        setPaymentForm({
          bank_account_name:   data.bank_account_name   || '',
          bank_account_number: data.bank_account_number || '',
          bank_ifsc:           data.bank_ifsc           || '',
          bank_name:           data.bank_name           || '',
          bank_branch:         data.bank_branch         || '',
          upi_id:              data.upi_id              || '',
        });
        setLogoPreview(data.logo || '');
        setUpiQrPreview(data.upi_qr || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build a full settings payload merging current DB state with overrides
  function buildPayload(overrides) {
    const s = allSettingsRef.current;
    return {
      business_name:          s.business_name          || '',
      business_address:       s.business_address       || '',
      gstin:                  s.gstin                  || '',
      phone:                  s.phone                  || '',
      invoice_generation_type: s.invoice_generation_type || 'sequential',
      invoice_prefix:         s.invoice_prefix         || 'INV-',
      invoice_postfix:        s.invoice_postfix        || '',
      bank_account_name:      s.bank_account_name      || '',
      bank_account_number:    s.bank_account_number    || '',
      bank_ifsc:              s.bank_ifsc              || '',
      bank_name:              s.bank_name              || '',
      bank_branch:            s.bank_branch            || '',
      upi_id:                 s.upi_id                 || '',
      upi_qr:                 s.upi_qr                 || '',
      ...overrides,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateProfile(buildPayload(form));
      allSettingsRef.current = updated;
      setSuccess('Business profile saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    setPaymentSaving(true);
    setPaymentError('');
    setPaymentSuccess('');
    try {
      const updated = await updateProfile(buildPayload({
        ...paymentForm,
        upi_qr: upiQrPreview || '',
      }));
      allSettingsRef.current = updated;
      setPaymentSuccess('Payment information saved successfully!');
    } catch (err) {
      setPaymentError(err.message);
    } finally {
      setPaymentSaving(false);
    }
  }

  // ── Logo handlers ───────────────────────────────────────────────────────

  function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError('');
    setLogoSuccess('');

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select an image file (PNG, JPG, GIF, WebP, SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Image too large — maximum size is 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setLogoPreview(dataUrl);
      setLogoUploading(true);
      try {
        await uploadLogo(dataUrl);
        setLogoSuccess('Logo uploaded successfully!');
      } catch (err) {
        setLogoError(err.message);
        setLogoPreview('');
      } finally {
        setLogoUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveLogo() {
    setLogoError('');
    setLogoSuccess('');
    setLogoUploading(true);
    try {
      await uploadLogo('');
      setLogoPreview('');
      setLogoSuccess('Logo removed.');
    } catch (err) {
      setLogoError(err.message);
    } finally {
      setLogoUploading(false);
    }
  }

  // ── UPI QR handlers ─────────────────────────────────────────────────────

  function handleQrFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUpiQrError('');
    setUpiQrSuccess('');

    if (!file.type.startsWith('image/')) {
      setUpiQrError('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUpiQrError('Image too large — maximum size is 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setUpiQrPreview(ev.target.result);
      setUpiQrSuccess('QR code loaded — click Save Payment Info to persist.');
      if (qrFileInputRef.current) qrFileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveQr() {
    setUpiQrPreview('');
    setUpiQrError('');
    setUpiQrSuccess('QR removed — click Save Payment Info to persist.');
    if (qrFileInputRef.current) qrFileInputRef.current.value = '';
  }

  const isPng = logoPreview.startsWith('data:image/png');

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  const pf = (field) => ({
    value: paymentForm[field],
    onChange: (e) => setPaymentForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  if (loading) return (
    <div className="flex justify-center p-12 text-muted-foreground text-sm items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Loading profile…
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your business identity and payment information</p>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN — Business Info ─────────────────────────────── */}
        <div className="space-y-6">
          {/* Logo Card */}
          <Card>
            <CardHeader>
              <CardTitle>Company Logo</CardTitle>
              <CardDescription>Upload a logo to professionalize your invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {logoError  && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{logoError}</div>}
              {logoSuccess && <div className="mb-4 rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">{logoSuccess}</div>}

              <div className="flex flex-col sm:flex-row items-start gap-6">
                {/* Preview area */}
                <div className="relative flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-dashed bg-secondary/50">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Company logo preview"
                      className="max-h-full max-w-full object-contain p-2"
                      style={{ mixBlendMode: isPng ? 'multiply' : 'normal' }}
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-muted-foreground">
                      No logo
                    </span>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    id="logo-file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      id="logo-upload-btn"
                      type="button"
                      disabled={logoUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {logoUploading ? 'Uploading…' : logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </Button>

                    {logoPreview && (
                      <Button
                        id="logo-remove-btn"
                        type="button"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={logoUploading}
                        onClick={handleRemoveLogo}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove Logo
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    PNG (recommended), JPG, GIF, WebP, SVG<br />
                    Max 2 MB · Transparent PNG backgrounds supported
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>Update your billing information and business identity</CardDescription>
            </CardHeader>
            <CardContent>
              {error   && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              {success && <div className="mb-4 rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">{success}</div>}

              <form onSubmit={handleSubmit} className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="profile-business-name">Business Name</Label>
                  <Input id="profile-business-name" placeholder="Acme Consulting Pvt Ltd" {...f('business_name')} />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="profile-gstin">GSTIN / Tax ID</Label>
                    <Input
                      id="profile-gstin"
                      placeholder="22AAAAA0000A1Z5"
                      className="uppercase"
                      {...f('gstin')}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input id="profile-phone" placeholder="+91 98765 43210" {...f('phone')} />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="profile-address">Business Address</Label>
                  <textarea
                    id="profile-address"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={"123 MG Road\nBangalore - 560001\nKarnataka, India"}
                    rows={4}
                    {...f('business_address')}
                  />
                </div>

                <div className="pt-2">
                  <Button
                    id="profile-save-btn"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Profile'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex gap-3 p-4">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm text-foreground/80 leading-relaxed">
                <strong>Tip:</strong> Your logo, business name, GSTIN, address, and phone will appear in the <em>From</em> section
                of every PDF invoice you generate. For best results, upload a PNG with a transparent background.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN — Payment Info ─────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Bank Details
              </CardTitle>
              <CardDescription>Add your bank account information for invoice payments</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentError   && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{paymentError}</div>}
              {paymentSuccess && <div className="mb-4 rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">{paymentSuccess}</div>}

              <form onSubmit={handlePaymentSubmit} id="payment-info-form" className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="bank-account-name">Account Holder Name</Label>
                  <Input id="bank-account-name" placeholder="Acme Consulting Pvt Ltd" {...pf('bank_account_name')} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bank-account-number">Account Number</Label>
                    <Input id="bank-account-number" placeholder="1234567890123456" className="font-mono" {...pf('bank_account_number')} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bank-ifsc">IFSC Code</Label>
                    <Input id="bank-ifsc" placeholder="SBIN0001234" className="uppercase font-mono" {...pf('bank_ifsc')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <Input id="bank-name" placeholder="State Bank of India" {...pf('bank_name')} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bank-branch">Branch Name</Label>
                    <Input id="bank-branch" placeholder="MG Road Branch" {...pf('bank_branch')} />
                  </div>
                </div>

                {/* ── UPI Section ─────────────────────────────────────── */}
                <div className="pt-4 mt-2 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-semibold tracking-tight">UPI Details</h3>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-2">
                      <Label htmlFor="upi-id">UPI ID</Label>
                      <Input id="upi-id" placeholder="yourname@upi" {...pf('upi_id')} />
                    </div>

                    <div className="grid gap-2">
                      <Label>UPI QR Code</Label>
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {/* QR Preview */}
                        <div className="relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-secondary/50">
                          {upiQrPreview ? (
                            <img
                              src={upiQrPreview}
                              alt="UPI QR code"
                              className="max-h-full max-w-full object-contain p-1"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                              <QrCode className="h-8 w-8 opacity-40" />
                              <span className="text-[10px]">No QR</span>
                            </div>
                          )}
                        </div>

                        {/* QR Controls */}
                        <div className="flex flex-col gap-3">
                          {upiQrError   && <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{upiQrError}</div>}
                          {upiQrSuccess && <div className="rounded-md bg-emerald-100 p-2 text-xs text-emerald-700">{upiQrSuccess}</div>}
                          <input
                            ref={qrFileInputRef}
                            id="qr-file-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleQrFileChange}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              id="qr-upload-btn"
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={upiQrUploading}
                              onClick={() => qrFileInputRef.current?.click()}
                            >
                              <Upload className="mr-2 h-3.5 w-3.5" />
                              {upiQrPreview ? 'Change QR' : 'Upload QR'}
                            </Button>
                            {upiQrPreview && (
                              <Button
                                id="qr-remove-btn"
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={handleRemoveQr}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Remove
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Upload your UPI payment QR code<br />
                            PNG or JPG · Max 2 MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    id="payment-save-btn"
                    type="submit"
                    disabled={paymentSaving}
                  >
                    {paymentSaving ? 'Saving…' : 'Save Payment Info'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/60 border-amber-200/50">
            <CardContent className="flex gap-3 p-4">
              <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900/80 leading-relaxed">
                <strong>Coming soon:</strong> Bank details and UPI information will appear in your PDF invoices,
                making it easier for customers to pay you directly.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Logout button ──────────────────────────────────────────────── */}
      <div className="flex justify-start">
        <Button variant="destructive" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
