import { FormEvent, useState } from 'react';
import { AlertTriangle, Check, CircleHelp, Clock3, Crosshair, ExternalLink, FileSearch, Globe2, Link2, Loader2, Shield, ShieldCheck, X } from 'lucide-react';
import { errorMessage, SectionHeading, useSentinel } from './App';
import { request } from './api';
import { titleCase } from './data';

type AssetType = 'website' | 'social' | 'mobile_app';

interface LiveSignal {
  value: string | null;
  normalized: string | null;
  matched: boolean;
  similarity: number | null;
  evidence: string[];
}

interface LiveDetectionSignal {
  category: string;
  signal: string;
  evidence: string;
  weight: number;
}

interface LiveCheckResult {
  source_url: string;
  final_url: string | null;
  observed_at: string;
  http_status: number | null;
  content_type: string | null;
  title: string | null;
  description: string | null;
  provider: string | null;
  domain: string | null;
  asset_type: AssetType;
  mode: 'live';
  status: 'ok' | 'blocked' | 'error';
  blocked: boolean;
  error: string | null;
  changed: boolean;
  changed_fields: string[];
  previous_observed_at: string | null;
  change_summary: Record<string, unknown>;
  signals: {
    brand: LiveSignal;
    name: LiveSignal;
    link: LiveSignal;
    detection: LiveDetectionSignal[];
  };
}

const statusCopy: Record<LiveCheckResult['status'], { label: string; description: string }> = {
  ok: { label: 'Observation complete', description: 'The public response was collected and its metadata was compared with the selected context.' },
  blocked: { label: 'Request blocked', description: 'The request was stopped by the public-URL safety checks before a page observation could complete.' },
  error: { label: 'Observation incomplete', description: 'The endpoint returned a structured observation, but the page could not be fully collected.' },
};

export function VerifyPage() {
  const { data, mode } = useSentinel();
  const [url, setUrl] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('website');
  const [brandId, setBrandId] = useState('');
  const [result, setResult] = useState<LiveCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Enter a public HTTP or HTTPS URL to verify.');
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError('Use a complete public URL that starts with http:// or https://.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const payload = {
        url: trimmedUrl,
        ...(brandId ? { brand_id: Number(brandId) } : {}),
        asset_type: assetType,
      };
      const observation = await request<LiveCheckResult>('/live-check', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(observation);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  const selectedBrand = data.brands.find(brand => String(brand.id) === brandId);
  const resultStatus = result ? statusCopy[result.status] : null;

  return <div className="verify-page">
    <section className="verify-intro">
      <div>
        <div className="eyebrow"><span className="status-dot" /> LIVE / PUBLIC URL OBSERVATION</div>
        <h2>Verify one public asset.<br /><span>Keep the evidence.</span></h2>
        <p>Inspect a URL at collection time, capture where it resolved, and compare deterministic signals with an optional protected brand.</p>
      </div>
      <div className="verify-intro-mark" aria-hidden="true"><Crosshair size={30} /><span>LIVE</span><small>METADATA ONLY</small></div>
    </section>

    <section className="verify-layout">
      <form className="panel verify-form" onSubmit={event => void submit(event)} noValidate>
        <SectionHeading title="Start a live verification" subtitle="Only public HTTP(S) URLs are accepted. No credentials or page scripts are used." />
        <label className="verify-field">Public profile, app, or site URL
          <div className="input-with-icon"><Link2 size={16} /><input aria-label="Public profile, app, or site URL" type="url" inputMode="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com/profile" autoComplete="url" required /></div>
          <small>Redirects and the final public URL are recorded in the evidence below.</small>
        </label>
        <div className="verify-form-grid">
          <label className="verify-field">Asset type
            <select aria-label="Asset type" value={assetType} onChange={event => setAssetType(event.target.value as AssetType)}>
              <option value="website">Website</option>
              <option value="social">Social profile</option>
              <option value="mobile_app">Mobile app listing</option>
            </select>
            <small>Used to describe the observed asset in the result.</small>
          </label>
          <label className="verify-field">Protected brand <span className="optional">Optional</span>
            <select aria-label="Protected brand" value={brandId} onChange={event => setBrandId(event.target.value)}>
              <option value="">No brand comparison</option>
              {data.brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
            <small>{selectedBrand ? `Compare against ${selectedBrand.domains.join(', ')}.` : 'Add a brand comparison for name and domain signals.'}</small>
          </label>
        </div>
        {mode === 'demo' && <div className="verify-connection-note"><CircleHelp size={15} /><span>Live verification needs the connected API. The available brand list may be demo data until the backend is running.</span></div>}
        {error && <div role="alert" className="verify-error"><AlertTriangle size={16} /><span>{error}</span></div>}
        <div className="verify-form-actions"><span className="verify-contract"><code>POST /api/live-check</code><span>mode returned as live</span></span><button className="button primary" type="submit" disabled={loading}>{loading ? <Loader2 size={16} className="spin" /> : <Globe2 size={16} />}{loading ? 'Collecting observation…' : 'Verify URL'}</button></div>
      </form>

      <aside className="verify-explainer">
        <div className="eyebrow">WHAT YOU GET BACK</div>
        <h3>Evidence with a timestamp.</h3>
        <p>Every response keeps the source URL, final URL, response metadata, and deterministic signals together for review.</p>
        <ul><li><Clock3 size={15} />Observed time and HTTP status</li><li><FileSearch size={15} />Title, description, domain, and provider</li><li><ShieldCheck size={15} />Brand and final-link comparisons</li><li><Crosshair size={15} />Explainable signal evidence</li></ul>
        <div className="notice"><Shield size={15} /><span>This is a live observation, not a maliciousness verdict. Investigate the evidence in context.</span></div>
      </aside>
    </section>

    {result && resultStatus && <LiveResult result={result} status={resultStatus} />}
  </div>;
}

function LiveResult({ result, status }: { result: LiveCheckResult; status: { label: string; description: string } }) {
  const isBlocked = result.blocked || result.status === 'blocked';
  const resultClass = isBlocked ? 'blocked' : result.status === 'error' ? 'error' : 'success';
  const signalRows: { label: string; signal: LiveSignal; explanation: string }[] = [
    { label: 'Protected brand', signal: result.signals.brand, explanation: result.signals.brand.matched ? 'A brand comparison signal matched.' : 'No protected-brand match was observed.' },
    { label: 'Observed name', signal: result.signals.name, explanation: result.signals.name.matched ? 'The observed title or domain resembles the selected brand.' : 'No strong name similarity was observed.' },
    { label: 'Final link', signal: result.signals.link, explanation: result.signals.link.matched ? 'The final domain matches a registered brand domain.' : 'The final domain did not match a registered brand domain.' },
  ];

  return <section className={`panel verify-result ${resultClass}`} aria-live="polite">
    <div className="verify-result-heading"><div><div className="eyebrow"><span className={`status-dot ${isBlocked ? 'amber' : result.status === 'error' ? 'amber' : ''}`} /> LIVE RESULT / {result.mode.toUpperCase()}</div><h2>{status.label}</h2><p>{status.description}</p></div><div className="verify-status-icon">{isBlocked ? <X size={22} /> : result.status === 'error' ? <AlertTriangle size={22} /> : <Check size={22} />}</div></div>
     {result.error && <div className="verify-result-message"><AlertTriangle size={16} /><span>{formatLiveError(result.error)}</span></div>}
     {result.changed && <div className="verify-change-banner"><Crosshair size={16} /><div><strong>Changed since the previous observation</strong><span>{result.changed_fields.map(field => titleCase(field)).join(' · ') || 'Metadata changed'}{result.previous_observed_at ? ` · Previous check ${formatObservedTime(result.previous_observed_at)}` : ''}</span></div></div>}
     <div className="provenance-heading"><SectionHeading title="Exact provenance" subtitle="Recorded from this live response." /><span className="mode-chip"><span className="status-dot" />mode: live</span></div>
    <div className="provenance-grid">
      <ProvenanceItem label="Source URL" value={result.source_url} mono link />
      <ProvenanceItem label="Final URL" value={result.final_url ?? 'Not reached'} mono link={!!result.final_url} />
      <ProvenanceItem label="Observed" value={formatObservedTime(result.observed_at)} />
      <ProvenanceItem label="HTTP status" value={result.http_status === null ? 'Not received' : String(result.http_status)} />
      <ProvenanceItem label="Content type" value={result.content_type ?? 'Not reported'} mono />
      <ProvenanceItem label="Asset type" value={titleCase(result.asset_type)} />
      <ProvenanceItem label="Domain" value={result.domain ?? 'Not resolved'} mono />
      <ProvenanceItem label="Provider" value={result.provider ?? 'Not identified'} mono />
    </div>
    <div className="metadata-summary"><div><h3>{result.title || 'No page title observed'}</h3><p>{result.description || 'No description metadata observed.'}</p></div><span className="type-tag">{titleCase(result.asset_type)}</span></div>
    <div className="verify-evidence-grid">
      <section><SectionHeading title="Deterministic signals" subtitle="Signals explain what matched; they do not assign malicious intent." /><div className="live-signal-list">{signalRows.map(({ label, signal, explanation }) => <article className={`live-signal ${signal.matched ? 'matched' : ''}`} key={label}><div className="live-signal-icon">{signal.matched ? <Check size={15} /> : <Crosshair size={15} />}</div><div><div className="live-signal-title"><strong>{label}</strong><span>{signal.matched ? 'MATCHED' : 'NO MATCH'}</span></div><p>{explanation}</p>{signal.value && <small className="mono">Observed: {signal.value}</small>}{signal.evidence.map(item => <small key={item}>{item}</small>)}{signal.similarity !== null && <small>Similarity: {Math.round(signal.similarity * 100)}%</small>}</div></article>)}</div></section>
      <section><SectionHeading title="Detection evidence" subtitle={`${result.signals.detection.length} deterministic finding${result.signals.detection.length === 1 ? '' : 's'} returned`} />{result.signals.detection.length ? <div className="detection-list">{result.signals.detection.map((signal, index) => <article key={`${signal.category}-${signal.signal}-${index}`}><div className="detection-number">{String(index + 1).padStart(2, '0')}</div><div><strong>{signal.signal}</strong><p>{signal.evidence}</p><small>{titleCase(signal.category)} · weight {signal.weight.toFixed(2)}</small></div></article>)}</div> : <div className="verify-empty-evidence"><Check size={16} /><span>No detection findings were returned for this observation.</span></div>}</section>
    </div>
    <div className="verify-result-footer"><span><Shield size={15} />Use this observation to guide investigation and preserve context.</span>{result.final_url && <a className="text-link" href={result.final_url} target="_blank" rel="noreferrer">Open final URL <ExternalLink size={13} /></a>}</div>
  </section>;
}

function ProvenanceItem({ label, value, mono = false, link = false }: { label: string; value: string; mono?: boolean; link?: boolean }) {
  return <div className="provenance-item"><span>{label}</span>{link && value.startsWith('http') ? <a className={mono ? 'mono' : ''} href={value} target="_blank" rel="noreferrer">{value}<ExternalLink size={12} /></a> : <strong className={mono ? 'mono' : ''}>{value}</strong>}</div>;
}

function formatObservedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return `${date.toLocaleString()} · ${date.toISOString()}`;
}

function formatLiveError(error: string) {
  const messages: Record<string, string> = {
    redirect_target_blocked: 'A redirect target was blocked because it did not meet the public URL safety policy.',
    redirect_without_location: 'The server returned a redirect without a destination.',
    request_timeout: 'The public server did not respond within the collection window.',
    request_failed: 'The public request could not be completed.',
    response_too_large: 'The response exceeded the metadata collection limit.',
    too_many_redirects: 'The URL exceeded the bounded redirect limit.',
  };
  return messages[error] ?? error;
}
