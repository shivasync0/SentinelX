import { FormEvent, useState } from 'react';
import { ArrowLeft, Globe2, Plus, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { request } from './api';
import { useSentinel } from './App';

export function BrandCreatePage() {
  const { mode, refresh, notify } = useSentinel();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  const [description, setDescription] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [assetType, setAssetType] = useState('domain');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode !== 'live') { setError('Connect the API to register a persisted brand. Offline demo records are read-only.'); return; }
    if (!name.trim()) { setError('Company name is required.'); return; }
    setSaving(true); setError('');
    try {
      const domainList = domains.split(',').map(value => value.trim()).filter(Boolean);
      const brand = await request<{ id: number }>('/brands', { method: 'POST', body: JSON.stringify({ name: name.trim(), domains: domainList, description: description.trim() || null }) });
      if (assetUrl.trim()) await request('/official-assets', { method: 'POST', body: JSON.stringify({ brand_id: brand.id, asset_type: assetType, name: assetName.trim() || name.trim(), url: assetUrl.trim(), status: 'verified' }) });
      await refresh();
      notify(`Protected brand ${name.trim()} registered${assetUrl.trim() ? ' with its first official asset' : ''}.`);
      navigate('/brands');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not register the brand.'); }
    finally { setSaving(false); }
  }

  return <section className="panel form-page">
    <div className="form-page-header"><div><Link className="text-link" to="/brands"><ArrowLeft size={15} />Brand portfolio</Link><span className="eyebrow"><ShieldCheck size={13} />REGISTERED IDENTITY</span><h2>Protect a new brand</h2><p>Define the identity baseline used to exclude official assets before detection.</p></div><div className="form-page-symbol"><ShieldCheck size={30} /></div></div>
    {mode !== 'live' && <div className="notice"><Globe2 size={16} /><span>Brand registration writes to the connected API. Start FastAPI and retry; offline fixtures remain clearly labeled and read-only.</span></div>}
    <form className="investigation-form" onSubmit={event => void submit(event)}>
      <div className="form-grid"><label>Company name<input aria-label="Company name" required maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. NovaPay" /></label><label>Approved domains<input aria-label="Approved domains" value={domains} onChange={event => setDomains(event.target.value)} placeholder="novapay.com, support.novapay.com" /><small>Comma-separated hosts. No network request is made.</small></label></div>
      <label>Brand description<textarea aria-label="Brand description" rows={4} maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the legitimate company identity and expected digital footprint…" /></label>
      <fieldset><legend>First official asset <span className="muted">optional</span></legend><div className="form-grid"><label>Asset type<select aria-label="Asset type" value={assetType} onChange={event => setAssetType(event.target.value)}><option value="domain">Official domain</option><option value="social">Social account</option><option value="mobile_app">Mobile application</option></select></label><label>Asset name<input aria-label="Asset name" value={assetName} onChange={event => setAssetName(event.target.value)} placeholder="Official listing or account name" /></label></div><label>Canonical URL<input aria-label="Canonical URL" type="url" value={assetUrl} onChange={event => setAssetUrl(event.target.value)} placeholder="https://example.com/official" /></label></fieldset>
      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="form-actions"><Link className="button secondary" to="/brands">Cancel</Link><button className="button primary" disabled={saving || mode !== 'live'}>{saving ? 'Registering…' : <><Plus size={16} />Register brand</>}</button></div>
    </form>
  </section>;
}
