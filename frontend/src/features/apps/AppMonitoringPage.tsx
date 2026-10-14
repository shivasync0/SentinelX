import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Box,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Fingerprint,
  LayoutGrid,
  List,
  Radar,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, EmptyState, SectionHeading, useSentinel } from '../../App';
import { candidateEvidence, candidateRisk, formatDate, titleCase, type Candidate } from '../../data';

export function AppMonitoringPage() {
  const { data, openInvestigation, saveDemo, busy, loading, runScan, notify } = useSentinel();
  const [params, setParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter] = useState('all');
  const [mismatchOnly, setMismatchOnly] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Candidate | null>(null);

  const brandParam = params.get('brand') ?? 'all';

  // Filter candidates to mobile app types
  const appCandidates = useMemo(() => {
    return data.candidates.filter(c =>
      ['app', 'mobile_app', 'android', 'ios'].includes(c.candidate_type) ||
      c.metadata?.store !== undefined ||
      c.metadata?.publisher !== undefined
    );
  }, [data.candidates]);

  const filteredApps = useMemo(() => {
    return appCandidates.filter(c => {
      const matchesBrand = brandParam === 'all' || String(c.brand_id) === brandParam;
      const matchesQuery = !query ||
        `${c.name} ${c.metadata?.publisher ?? ''} ${c.metadata?.store_identifier ?? ''} ${c.metadata?.description ?? ''}`.toLowerCase().includes(query.toLowerCase());
      const risk = candidateRisk(c.id, data.scans).label;
      const matchesRisk = riskFilter === 'all' || risk === riskFilter;
      const matchesStore = storeFilter === 'all' || (c.metadata?.store && String(c.metadata.store).toLowerCase().includes(storeFilter.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesMismatch = !mismatchOnly || c.metadata?.publisher_mismatch === true;

      return matchesBrand && matchesQuery && matchesRisk && matchesStore && matchesStatus && matchesMismatch;
    }).sort((a, b) => {
      const scoreA = candidateRisk(a.id, data.scans).score ?? -1;
      const scoreB = candidateRisk(b.id, data.scans).score ?? -1;
      return scoreB - scoreA;
    });
  }, [appCandidates, brandParam, query, riskFilter, storeFilter, statusFilter, mismatchOnly, data.scans]);

  const publisherMismatchesCount = appCandidates.filter(c => c.metadata?.publisher_mismatch).length;
  const highRiskAppsCount = appCandidates.filter(c => ['high', 'critical'].includes(candidateRisk(c.id, data.scans).label)).length;
  const officialAppsCount = data.assets.filter(a => a.asset_type === 'mobile_app').length;

  const handleExportAppEvidence = (app: Candidate) => {
    const evidence = candidateEvidence(app.id, data.scans);
    const risk = candidateRisk(app.id, data.scans);
    const payload = {
      app,
      risk,
      evidence,
      exported_at: new Date().toISOString(),
      report_type: 'Mobile Application Intelligence Dossier',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-x-app-${app.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Application threat intelligence dossier exported.');
  };

  const selectedEvidence = selectedApp ? candidateEvidence(selectedApp.id, data.scans) : [];
  const selectedRisk = selectedApp ? candidateRisk(selectedApp.id, data.scans) : { label: 'unscanned', score: null };
  const selectedBrand = selectedApp ? data.brands.find(b => b.id === selectedApp.brand_id) : null;
  const officialAppAsset = selectedBrand ? data.assets.find(a => a.brand_id === selectedBrand.id && a.asset_type === 'mobile_app') : null;

  return (
    <div className="app-monitoring-page">
      {/* Header */}
      <div className="channel-hero app-hero">
        <div className="channel-hero-icon blue-icon">
          <Box size={28} />
        </div>
        <div>
          <h2>Mobile Application Monitoring</h2>
          <p>
            Track unauthorized mobile applications, sideloaded APKs, and developer publisher mismatches targeting your brand.
          </p>
        </div>
        <div className="heading-actions ml-auto">
          <button className="button secondary" disabled={!!busy || loading} onClick={() => void runScan()}>
            <Radar size={15} /> Run app scan
          </button>
          <div className="view-toggle-group">
            <button
              className={`icon-button ${viewMode === 'cards' ? 'active' : ''}`}
              title="Card Grid Layout"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`icon-button ${viewMode === 'table' ? 'active' : ''}`}
              title="Table Layout"
              onClick={() => setViewMode('table')}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="collection-metrics">
        <div>
          <span>Monitored App Findings</span>
          <strong>{appCandidates.length.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Publisher Mismatches</span>
          <strong className="text-red">{publisherMismatchesCount.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>High-Risk Look-Alikes</span>
          <strong className="text-red">{highRiskAppsCount.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Verified Official Apps</span>
          <strong className="text-green">{officialAppsCount.toString().padStart(2, '0')}</strong>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="panel mb-4">
        <div className="filter-bar">
          <div className="input-search">
            <Search size={15} />
            <input
              placeholder="Search app title, developer name, package ID…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="filter-controls">
            <SlidersHorizontal size={14} />

            <select
              aria-label="Filter by brand"
              value={brandParam}
              onChange={e => {
                const next = new URLSearchParams(params);
                if (e.target.value === 'all') next.delete('brand');
                else next.set('brand', e.target.value);
                setParams(next);
              }}
            >
              <option value="all">All Brands</option>
              {data.brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select
              aria-label="Filter by store"
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
            >
              <option value="all">All App Marketplaces</option>
              <option value="google">Google Play</option>
              <option value="apple">Apple App Store</option>
              <option value="apk">Third-party APK / Direct</option>
            </select>

            <select
              aria-label="Filter by risk"
              value={riskFilter}
              onChange={e => setRiskFilter(e.target.value)}
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <label className="checkbox-filter-label">
              <input
                type="checkbox"
                checked={mismatchOnly}
                onChange={e => setMismatchOnly(e.target.checked)}
              />
              <span>Publisher Mismatch Only</span>
            </label>
          </div>
        </div>

        {/* View Mode: Card Grid */}
        {viewMode === 'cards' && (
          <div className="app-card-grid p-4">
            {filteredApps.map(app => {
              const risk = candidateRisk(app.id, data.scans);
              const brand = data.brands.find(b => b.id === app.brand_id);
              const isMismatch = app.metadata?.publisher_mismatch === true;

              return (
                <article
                  key={app.id}
                  className={`panel app-inventory-card ${selectedApp?.id === app.id ? 'selected-card' : ''}`}
                  onClick={() => setSelectedApp(app)}
                >
                  <div className="app-card-head">
                    <div className="app-icon-box">
                      <Box size={24} />
                    </div>
                    <div className="app-card-title-group">
                      <h4>{app.name}</h4>
                      <span className="mono">{String(app.metadata?.store_identifier || app.url || 'Unavailable')}</span>
                    </div>
                    <Badge value={risk.label} />
                  </div>

                  <div className="app-card-body">
                    <div className="app-meta-line">
                      <label>Marketplace:</label>
                      <span>{String(app.metadata?.store || 'Android / APK')}</span>
                    </div>

                    <div className="app-meta-line">
                      <label>Developer / Publisher:</label>
                      <strong className={isMismatch ? 'text-red' : ''}>
                        {String(app.metadata?.publisher || 'Unknown Publisher')}
                        {isMismatch && <span className="mismatch-tag">MISMATCH</span>}
                      </strong>
                    </div>

                    <div className="app-meta-line">
                      <label>Target Brand:</label>
                      <span>{brand?.name ?? 'Unassigned'}</span>
                    </div>

                    <div className="app-similarity-bar">
                      <span>Name Match: {Math.round(Number(app.metadata?.name_similarity || 0.8) * 100)}%</span>
                      <span>Icon Match: {Math.round(Number(app.metadata?.icon_similarity || 0.8) * 100)}%</span>
                    </div>
                  </div>

                  <div className="app-card-foot">
                    <span className="muted">{formatDate(app.created_at)}</span>
                    <button className="text-link" onClick={() => setSelectedApp(app)}>
                      Inspect comparison <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* View Mode: Table Layout */}
        {viewMode === 'table' && filteredApps.length > 0 && (
          <div className="table-scroll">
            <table className="candidate-table">
              <thead>
                <tr>
                  <th>Application Listing</th>
                  <th>Store / Platform</th>
                  <th>Developer / Publisher</th>
                  <th>Target Brand</th>
                  <th>Risk Score</th>
                  <th>Publisher Integrity</th>
                  <th>Observed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map(app => {
                  const risk = candidateRisk(app.id, data.scans);
                  const brand = data.brands.find(b => b.id === app.brand_id);
                  const isMismatch = app.metadata?.publisher_mismatch === true;

                  return (
                    <tr
                      key={app.id}
                      className={selectedApp?.id === app.id ? 'selected-row' : ''}
                      onClick={() => setSelectedApp(app)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="table-name">
                          <div className="asset-icon blue-icon">
                            <Box size={16} />
                          </div>
                          <div>
                            <strong>{app.name}</strong>
                            <small className="mono">{String(app.metadata?.store_identifier || 'Unavailable')}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="type-tag">{String(app.metadata?.store || 'App Store')}</span>
                      </td>

                      <td>
                        <strong className={isMismatch ? 'text-red' : ''}>
                          {String(app.metadata?.publisher || 'Unknown')}
                        </strong>
                      </td>

                      <td>{brand?.name ?? 'Unassigned'}</td>

                      <td>
                        <div className="table-score">
                          <strong>{risk.score === null ? '—' : Math.round(risk.score * 100)}</strong>
                          <Badge value={risk.label} />
                        </div>
                      </td>

                      <td>
                        {isMismatch ? (
                          <span className="badge badge-critical">Publisher Mismatch</span>
                        ) : (
                          <span className="badge badge-low">Verified Publisher</span>
                        )}
                      </td>

                      <td className="nowrap muted">{formatDate(app.created_at)}</td>

                      <td>
                        <button className="icon-button" onClick={() => setSelectedApp(app)}>
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!filteredApps.length && (
          <EmptyState
            icon={<Box size={28} />}
            title="No mobile application findings found"
            description="Adjust your search filters or scan the app marketplace feed."
          >
            <button className="button secondary" onClick={() => { setQuery(''); setStoreFilter('all'); setRiskFilter('all'); setMismatchOnly(false); }}>
              Reset Filters
            </button>
          </EmptyState>
        )}

        <div className="panel-bottom">
          <span>Showing {filteredApps.length} of {appCandidates.length} application listings</span>
          <span>Click any card to open the side-by-side app investigation panel</span>
        </div>
      </section>

      {/* DEDICATED SIDE-BY-SIDE APPLICATION INVESTIGATION PANEL */}
      {selectedApp && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedApp(null); }}>
          <div className="modal drawer wide-drawer" role="dialog" aria-modal="true" aria-label="Application investigation">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  <ShieldAlert size={12} /> MOBILE APP THREAT INVESTIGATION
                </span>
                <h2>{selectedApp.name}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedApp(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Risk Summary */}
              <div className="risk-summary">
                <div>
                  <p>APPLICATION RISK ASSESSMENT</p>
                  <strong>
                    {selectedRisk.score === null ? '—' : Math.round(selectedRisk.score * 100)}
                    <small>/ 100</small>
                  </strong>
                </div>
                <div>
                  <Badge value={selectedRisk.label} />
                  <p>
                    {selectedApp.metadata?.publisher_mismatch
                      ? 'CRITICAL MISMATCH: Publisher is not registered in authorized brand developer directory.'
                      : 'Application metadata compared against official store bundle.'}
                  </p>
                </div>
              </div>

              {/* SIDE-BY-SIDE COMPARISON: OFFICIAL APP VS CANDIDATE APP */}
              <div className="side-by-side-section">
                <h4>SIDE-BY-SIDE APPLICATION SPECIFICATION</h4>
                <div className="side-by-side-grid">
                  {/* Left: Official Application */}
                  <div className="side-card official-side">
                    <div className="side-card-badge">
                      <ShieldCheck size={14} /> AUTHORIZED OFFICIAL APPLICATION
                    </div>
                    <div className="side-identity-header">
                      <div className="side-avatar official">
                        <Box size={20} />
                      </div>
                      <div>
                        <strong>NovaPay Mobile Banking</strong>
                        <span className="mono">com.novapay.app</span>
                      </div>
                      <Badge value="verified" label="Authorized" />
                    </div>

                    <div className="side-details">
                      <div className="detail-row">
                        <label>Registered Publisher:</label>
                        <strong>NovaPay Inc. (Corporate)</strong>
                      </div>
                      <div className="detail-row">
                        <label>Package ID:</label>
                        <span className="mono">{officialAppAsset ? (officialAppAsset.identifier || officialAppAsset.name) : 'com.novapay.app'}</span>
                      </div>
                      <div className="detail-row">
                        <label>Official Store Listing:</label>
                        <span className="mono">https://play.google.com/store/apps/details?id=com.novapay.app</span>
                      </div>
                      <div className="detail-row">
                        <label>Approved API Endpoint:</label>
                        <span className="mono">api.novapay.example</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Candidate Look-Alike App */}
                  <div className="side-card candidate-side">
                    <div className="side-card-badge threat">
                      <AlertTriangle size={14} /> FLAGGED CANDIDATE APPLICATION
                    </div>
                    <div className="side-identity-header">
                      <div className="side-avatar candidate">
                        <Box size={20} />
                      </div>
                      <div>
                        <strong>{selectedApp.name}</strong>
                        <span className="mono">{String(selectedApp.metadata?.store_identifier || 'Unavailable')}</span>
                      </div>
                      <Badge value={selectedRisk.label} />
                    </div>

                    <div className="side-details">
                      <div className="detail-row">
                        <label>Observed Developer:</label>
                        <strong className="text-red">
                          {String(selectedApp.metadata?.publisher || 'Unavailable')} (FLAGGED MISMATCH)
                        </strong>
                      </div>
                      <div className="detail-row">
                        <label>Observed Package ID:</label>
                        <span className="mono text-red">
                          {String(selectedApp.metadata?.store_identifier || 'Unavailable')}
                        </span>
                      </div>
                      <div className="detail-row">
                        <label>Marketplace Channel:</label>
                        <span>{String(selectedApp.metadata?.store || 'Third-party APK')}</span>
                      </div>
                      <div className="detail-row">
                        <label>Linked Infrastructure:</label>
                        <span className="mono text-red">
                          {selectedApp.metadata?.linked_domains
                            ? selectedApp.metadata.linked_domains.map(d => d.domain).join(', ')
                            : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Similarity Metrics Strip */}
                <div className="diff-highlight-box mt-3">
                  <div className="diff-badge">
                    <Sparkles size={14} />
                    <span>Multimodal Listing Correlation</span>
                  </div>
                  <div className="similarity-metrics-row">
                    <span>Name Similarity: <strong>{Math.round(Number(selectedApp.metadata?.name_similarity || 0.85) * 100)}%</strong></span>
                    <span>Icon/Visual Match: <strong>{Math.round(Number(selectedApp.metadata?.icon_similarity || 0.88) * 100)}%</strong></span>
                    <span>Publisher Mismatch: <strong className="text-red">DETECTED</strong></span>
                    <span>Domain Link: <strong className="text-red">novapay-verify-auth.example</strong></span>
                  </div>
                </div>
              </div>

              {/* Signals */}
              <SectionHeading
                title="Auditable Detection Signals"
                subtitle="Why this application requires immediate security review."
              />

              <div className="evidence-list">
                {selectedEvidence.map(finding => (
                  <article key={finding.id} className="evidence-item">
                    <div className="evidence-icon">
                      <Crosshair size={18} />
                    </div>
                    <div>
                      <div className="evidence-title">
                        <h3>{finding.signal}</h3>
                        <span className="mono">+{Math.round(finding.score_contribution * 100)} pts</span>
                      </div>
                      <p>{finding.evidence}</p>
                      <small>Category: {titleCase(finding.category)} · Weight: {finding.weight.toFixed(2)}</small>
                    </div>
                  </article>
                ))}
              </div>

              {/* Candidate Description */}
              {selectedApp.metadata?.description && (
                <div className="bio-inspection-box mt-3">
                  <label>STORE LISTING DESCRIPTION:</label>
                  <blockquote>&ldquo;{String(selectedApp.metadata.description)}&rdquo;</blockquote>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="drawer-actions-bar">
              <div className="action-group-left">
                {selectedApp.url && (
                  <a href={selectedApp.url} target="_blank" rel="noreferrer" className="button secondary">
                    <ExternalLink size={14} /> Open store listing
                  </a>
                )}
                <button className="button secondary" onClick={() => handleExportAppEvidence(selectedApp)}>
                  <ArrowDownToLine size={14} /> Export dossier
                </button>
              </div>

              <div className="action-group-right">
                <button
                  className="button secondary"
                  onClick={() => {
                    saveDemo(prev => ({
                      ...prev,
                      candidates: prev.candidates.map(c => c.id === selectedApp.id ? { ...c, status: 'dismissed' } : c),
                    }));
                    notify(`Application "${selectedApp.name}" dismissed.`);
                    setSelectedApp(null);
                  }}
                >
                  Dismiss
                </button>

                <button
                  className="button primary"
                  onClick={() => {
                    openInvestigation([selectedApp.id]);
                    setSelectedApp(null);
                  }}
                >
                  <Fingerprint size={15} /> Add to investigation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
