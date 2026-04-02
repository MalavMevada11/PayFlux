import { useEffect, useRef, useState } from 'react';
import { getProfile, updateProfile, uploadLogo } from '../api';

export default function Profile() {
  const [form, setForm] = useState({
    business_name: '',
    business_address: '',
    gstin: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Logo state
  const [logoPreview, setLogoPreview] = useState('');   // local data URL for preview
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoSuccess, setLogoSuccess] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setForm({
          business_name:    data.business_name    || '',
          business_address: data.business_address || '',
          gstin:            data.gstin            || '',
          phone:            data.phone            || '',
        });
        setLogoPreview(data.logo || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateProfile(form);
      setSuccess('Business profile saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
        // revert preview on error
        setLogoPreview('');
      } finally {
        setLogoUploading(false);
        // Reset file input so same file can be re-selected
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

  const isPng = logoPreview.startsWith('data:image/png');

  const f = (field) => ({
    value: form[field],
    onChange: (e) => setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  if (loading) return <div className="loading-page"><div className="spinner" /> Loading profile…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Profile</h1>
          <p className="page-subtitle">This information appears in your PDF invoices under "From"</p>
        </div>
      </div>

      {/* ── Logo Card ─────────────────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header"><span className="card-title">Company Logo</span></div>
        <div className="card-body">
          {logoError  && <div className="error-msg"   style={{ marginBottom: 14 }}>{logoError}</div>}
          {logoSuccess && <div className="success-msg" style={{ marginBottom: 14 }}>{logoSuccess}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Preview area */}
            <div
              style={{
                width: 120,
                height: 80,
                border: '1.5px dashed var(--border)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg)',
                flexShrink: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company logo preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    // For PNG: use mix-blend-mode so white bg becomes invisible
                    mixBlendMode: isPng ? 'multiply' : 'normal',
                  }}
                />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '0 8px' }}>
                  No logo
                </span>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                ref={fileInputRef}
                id="logo-file-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoFileChange}
              />
              <button
                id="logo-upload-btn"
                type="button"
                className="btn btn-primary"
                disabled={logoUploading}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 13 }}
              >
                {logoUploading ? 'Uploading…' : logoPreview ? '🔄 Change Logo' : '📁 Upload Logo'}
              </button>

              {logoPreview && (
                <button
                  id="logo-remove-btn"
                  type="button"
                  className="btn"
                  disabled={logoUploading}
                  onClick={handleRemoveLogo}
                  style={{
                    fontSize: 13,
                    background: 'transparent',
                    border: '1.5px solid var(--border)',
                    color: 'var(--danger, #DC2626)',
                  }}
                >
                  🗑 Remove Logo
                </button>
              )}

              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                PNG (recommended), JPG, GIF, WebP, SVG<br />
                Max&nbsp;2&nbsp;MB · PNG backgrounds hidden on invoice
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Business Details Card ─────────────────────────────────── */}
      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <div className="card-header"><span className="card-title">Business Details</span></div>
        <div className="card-body">
          {error   && <div className="error-msg"   style={{ marginBottom: 14 }}>{error}</div>}
          {success && <div className="success-msg" style={{ marginBottom: 14 }}>{success}</div>}

          <form onSubmit={handleSubmit} className="form-grid">
            <label>
              Business Name
              <input id="profile-business-name" placeholder="Acme Consulting Pvt Ltd" {...f('business_name')} />
            </label>
            <label>
              GSTIN
              <input
                id="profile-gstin"
                placeholder="22AAAAA0000A1Z5"
                {...f('gstin')}
                style={{ textTransform: 'uppercase' }}
              />
            </label>
            <label>
              Phone
              <input id="profile-phone" placeholder="+91 98765 43210" {...f('phone')} />
            </label>
            <label>
              Business Address
              <textarea
                id="profile-address"
                placeholder={"123 MG Road\nBangalore - 560001\nKarnataka, India"}
                rows={4}
                {...f('business_address')}
              />
            </label>

            <button
              id="profile-save-btn"
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ marginTop: 4 }}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <div className="card-body">
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            💡 <strong>Tip:</strong> Your logo, business name, GSTIN, address, and phone will appear in the <em>From</em> section
            of every PDF invoice you generate. For best results, upload a PNG with a transparent background.
          </div>
        </div>
      </div>
    </div>
  );
}
