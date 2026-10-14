import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Fingerprint,
  Radar,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Badge, EmptyState, SectionHeading, useSentinel } from '../../App';
import { candidateEvidence, candidateRisk, formatDate, titleCase, type Candidate } from '../../data';

export function SocialMonitoringPage() {
  const { data, openInvestigation, saveDemo, busy, loading, runScan, notify } = useSentinel();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('risk');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Dismiss reason modal state
  const [dismissCandidate, setDismissCandidate] = useState<Candidate | null>(null);
  const [dismissReason, setDismissReason] = useState('Unrelated business');
  const [dismissNotes, setDismissNotes] = useState('');

  const brandParam = params.get('brand') ?? 'all';

  // Filter candidates to social types
  const socialCandidates = useMemo(() => {
    return data.candidates.filter(c =>
      ['social', 'social_account', 'profile'].includes(c.candidate_type) ||
      c.metadata?.platform !== undefined
    );
  }, [data.candidates]);

  const filteredCandidates = useMemo(() => {
    return socialCandidates.filter(c => {
      const matchesBrand = brandParam === 'all' || String(c.brand_id) === brandParam;
      const matchesQuery = !query ||
        `${c.name} ${c.metadata?.handle ?? ''} ${c.url ?? ''} ${c.metadata?.description ?? ''}`.toLowerCase().includes(query.toLowerCase());
      const risk = candidateRisk(c.id, data.scans).label;
      const matchesRisk = riskFilter === 'all' || risk === riskFilter;
      const matchesPlatform = platformFilter === 'all' || (c.metadata?.platform && String(c.metadata.platform).toLowerCase().includes(platformFilter.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchesBrand && matchesQuery && matchesRisk && matchesPlatform && matchesStatus;
    }).sort((a, b) => {
      if (sortOrder === 'risk') {
        const scoreA = candidateRisk(a.id, data.scans).score ?? -1;
        const scoreB = candidateRisk(b.id, data.scans).score ?? -1;
        return scoreB - scoreA;
      }
      if (sortOrder === 'recent') return b.id - a.id;
      return a.name.localeCompare(b.name);
    });
  }, [socialCandidates, brandParam, query, riskFilter, platformFilter, statusFilter, sortOrder, data.scans]);

  // Counts for summary strip
  const totalReviewed = socialCandidates.filter(c => ['suspicious', 'legitimate', 'dismissed'].includes(c.status)).length;
  const awaitingReview = socialCandidates.filter(c => c.status === 'new' || c.status === 'under_review').length;
  const highPriority = socialCandidates.filter(c => ['high', 'critical'].includes(candidateRisk(c.id, data.scans).label)).length;
  const officialExcluded = socialCandidates.filter(c => candidateRisk(c.id, data.scans).label === 'verified').length;

  // Actions on Candidate
  const handleMarkStatus = (candidate: Candidate, newStatus: string) => {
    saveDemo(prev => ({
      ...prev,
      candidates: prev.candidates.map(c => c.id === candidate.id ? { ...c, status: newStatus } : c),
    }));
    notify(`Candidate "${candidate.name}" marked as ${newStatus}.`);
    if (selectedCandidate?.id === candidate.id) {
      setSelectedCandidate(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const handleConfirmDismiss = () => {
    if (!dismissCandidate) return;
    saveDemo(prev => ({
      ...prev,
      candidates: prev.candidates.map(c =>
        c.id === dismissCandidate.id ? {
          ...c,
          status: 'dismissed',
          metadata: { ...c.metadata, review_decision: 'dismissed', dismiss_reason: dismissReason, analyst_note: dismissNotes }
        } : c
      ),
    }));
    notify(`Candidate "${dismissCandidate.name}" dismissed: ${dismissReason}`);
    setDismissCandidate(null);
    setDismissNotes('');
    if (selectedCandidate?.id === dismissCandidate.id) {
      setSelectedCandidate(null);
    }
  };

  const handleApproveAsOfficial = (candidate: Candidate) => {
    if (!candidate.brand_id) return;
    const newAsset = {
      id: Math.max(0, ...data.assets.map(a => a.id)) + 1,
      brand_id: candidate.brand_id,
      asset_type: 'social',
      name: `${candidate.name} (Approved)`,
      url: candidate.url || 'https://social.example/verified',
      identifier: candidate.metadata?.handle as string,
      status: 'verified',
      verified_at: new Date().toISOString(),
    };
    saveDemo(prev => ({
      ...prev,
      assets: [...prev.assets, newAsset],
      candidates: prev.candidates.map(c => c.id === candidate.id ? { ...c, status: 'legitimate', metadata: { ...c.metadata, official: true } } : c),
    }));
    notify(`Candidate "${candidate.name}" approved as official brand asset.`);
  };

  const handleExportCandidate = (candidate: Candidate) => {
    const evidence = candidateEvidence(candidate.id, data.scans);
    const risk = candidateRisk(candidate.id, data.scans);
    const exportData = {
      candidate,
      risk,
      evidence,
      exported_at: new Date().toISOString(),
      platform: 'SENTINEL X Threat Intelligence',
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-x-social-candidate-${candidate.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Candidate threat intelligence dossier exported.');
  };

  const selectedEvidence = selectedCandidate ? candidateEvidence(selectedCandidate.id, data.scans) : [];
  const selectedRisk = selectedCandidate ? candidateRisk(selectedCandidate.id, data.scans) : { label: 'unscanned', score: null };
  const selectedBrand = selectedCandidate ? data.brands.find(b => b.id === selectedCandidate.brand_id) : null;
  const officialAsset = selectedBrand ? data.assets.find(a => a.brand_id === selectedBrand.id && a.asset_type === 'social') : null;

  return (
    <div className="social-monitoring-page">
      {/* Header */}
      <div className="channel-hero social-hero">
        <div className="channel-hero-icon purple-icon">
          <Users size={28} />
        </div>
        <div>
          <h2>Social Monitoring</h2>
          <p>Discover accounts, fake executive pages, and look-alike profiles that may be impersonating your brand.</p>
        </div>
        <div className="heading-actions ml-auto">
          <button className="button secondary" disabled={!!busy || loading} onClick={() => void runScan()}>
            <Radar size={15} /> Run scan
          </button>
          <Link to="/app/brands" className="button secondary">
            <ShieldCheck size={15} /> Manage official profiles
          </Link>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="collection-metrics">
        <div>
          <span>Candidates Reviewed</span>
          <strong>{totalReviewed.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Awaiting Review</span>
          <strong>{awaitingReview.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>High-Priority Findings</span>
          <strong className="text-red">{highPriority.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Official Assets Excluded</span>
          <strong className="text-green">{officialExcluded.toString().padStart(2, '0')}</strong>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="panel mb-4">
        <div className="filter-bar">
          <div className="input-search">
            <Search size={15} />
            <input
              placeholder="Search handle, profile name, bio keyword…"
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
              aria-label="Filter by platform"
              value={platformFilter}
              onChange={e => setPlatformFilter(e.target.value)}
            >
              <option value="all">All Platforms</option>
              <option value="twitter">X / Twitter</option>
              <option value="bluesky">Bluesky</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
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
              <option value="verified">Verified Exclusion</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="under_review">Under Review</option>
              <option value="suspicious">Flagged Suspicious</option>
              <option value="legitimate">Legitimate</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              aria-label="Sort order"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
            >
              <option value="risk">Highest Risk First</option>
              <option value="recent">Newest Discovered</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Candidate Table */}
        {filteredCandidates.length ? (
          <div className="table-scroll">
            <table className="candidate-table">
              <thead>
                <tr>
                  <th>Profile / Handle</th>
                  <th>Protected Brand</th>
                  <th>Platform</th>
                  <th>Risk Score</th>
                  <th>Primary Detection Signal</th>
                  <th>Observed</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map(candidate => {
                  const risk = candidateRisk(candidate.id, data.scans);
                  const evidence = candidateEvidence(candidate.id, data.scans);
                  const primarySignal = evidence[0]?.signal || (risk.label === 'verified' ? 'Verified official asset' : 'Awaiting scan evaluation');
                  const brand = data.brands.find(b => b.id === candidate.brand_id);

                  return (
                    <tr
                      key={candidate.id}
                      className={selectedCandidate?.id === candidate.id ? 'selected-row' : ''}
                      onClick={() => setSelectedCandidate(candidate)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="table-name">
                          <div className="asset-icon purple-icon">
                            <Users size={16} />
                          </div>
                          <div>
                            <strong>{candidate.name}</strong>
                            <small className="mono">
                              {candidate.metadata?.handle || candidate.url || 'No handle recorded'}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{brand?.name ?? 'Unassigned'}</td>

                      <td>
                        <span className="type-tag">
                          {candidate.metadata?.platform || 'Social Network'}
                        </span>
                      </td>

                      <td>
                        <div className="table-score">
                          <strong>{risk.score === null ? '—' : Math.round(risk.score * 100)}</strong>
                          {risk.score !== null && (
                            <span>
                              <i className={risk.label} style={{ width: `${Math.max(10, risk.score * 100)}%` }} />
                            </span>
                          )}
                          <Badge value={risk.label} />
                        </div>
                      </td>

                      <td>
                        <span className="primary-signal-cell" title={primarySignal}>
                          {primarySignal}
                        </span>
                      </td>

                      <td className="nowrap muted">{formatDate(candidate.created_at)}</td>

                      <td>
                        <span className={`status-pill pill-${candidate.status}`}>
                          {titleCase(candidate.status)}
                        </span>
                      </td>

                      <td>
                        <button
                          className="icon-button"
                          title="Inspect evidence"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedCandidate(candidate);
                          }}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Users size={28} />}
            title="No social candidates matching criteria"
            description="Adjust your search query, brand, or platform filter to inspect more findings."
          >
            <button className="button secondary" onClick={() => { setQuery(''); setPlatformFilter('all'); setRiskFilter('all'); setStatusFilter('all'); }}>
              Reset Filters
            </button>
          </EmptyState>
        )}

        <div className="panel-bottom">
          <span>Showing {filteredCandidates.length} of {socialCandidates.length} social findings</span>
          <span>Click any row to open side-by-side evidence inspection</span>
        </div>
      </section>

      {/* DEDICATED SIDE-BY-SIDE EVIDENCE PANEL / DRAWER */}
      {selectedCandidate && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedCandidate(null); }}>
          <div className="modal drawer wide-drawer" role="dialog" aria-modal="true" aria-label="Social candidate evidence">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  <ShieldAlert size={12} /> SOCIAL IDENTITY EVIDENCE INSPECTION
                </span>
                <h2>{selectedCandidate.name}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedCandidate(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Risk Summary Strip */}
              <div className="risk-summary">
                <div>
                  <p>EXPLAINABLE RISK SCORE</p>
                  <strong>
                    {selectedRisk.score === null ? '—' : Math.round(selectedRisk.score * 100)}
                    <small>/ 100</small>
                  </strong>
                </div>
                <div>
                  <Badge value={selectedRisk.label} />
                  <p>
                    {selectedRisk.label === 'verified'
                      ? 'Verified official asset. Excluded from false alarms before threat scoring.'
                      : `${selectedEvidence.length} auditable evidence signals evaluated in latest scan.`}
                  </p>
                </div>
              </div>

              {/* SIDE-BY-SIDE COMPARISON: OFFICIAL VS CANDIDATE */}
              <div className="side-by-side-section">
                <h4>SIDE-BY-SIDE IDENTITY VERIFICATION</h4>
                <div className="side-by-side-grid">
                  {/* Left: Official Asset */}
                  <div className="side-card official-side">
                    <div className="side-card-badge">
                      <ShieldCheck size={14} /> REGISTERED OFFICIAL ASSET
                    </div>
                    <div className="side-identity-header">
                      <div className="side-avatar official">
                        {selectedBrand?.logo || 'NP'}
                      </div>
                      <div>
                        <strong>{selectedBrand?.name ?? 'Official Brand'}</strong>
                        <span className="mono">{officialAsset?.identifier || '@novapay'}</span>
                      </div>
                      <Badge value="verified" label="Authorized" />
                    </div>

                    <div className="side-details">
                      <div className="detail-row">
                        <label>Canonical Platform:</label>
                        <span>Verified Social Handle</span>
                      </div>
                      <div className="detail-row">
                        <label>Approved Link:</label>
                        <span className="mono">{selectedBrand?.domains[0] || 'novapay.example'}</span>
                      </div>
                      <div className="detail-row">
                        <label>Verification:</label>
                        <span>Registered Baseline Baseline Entity</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Candidate Look-Alike */}
                  <div className="side-card candidate-side">
                    <div className="side-card-badge threat">
                      <AlertTriangle size={14} /> FLAGGED LOOK-ALIKE CANDIDATE
                    </div>
                    <div className="side-identity-header">
                      <div className="side-avatar candidate">
                        {selectedCandidate.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{selectedCandidate.name}</strong>
                        <span className="mono">{selectedCandidate.metadata?.handle || 'Unspecified handle'}</span>
                      </div>
                      <Badge value={selectedRisk.label} />
                    </div>

                    <div className="side-details">
                      <div className="detail-row">
                        <label>Observed Platform:</label>
                        <span>{selectedCandidate.metadata?.platform || 'Social Network'}</span>
                      </div>
                      <div className="detail-row">
                        <label>Follower Count:</label>
                        <span>{selectedCandidate.metadata?.followers ? `${selectedCandidate.metadata.followers.toLocaleString()} followers` : 'Unreported'}</span>
                      </div>
                      <div className="detail-row">
                        <label>Observed Links:</label>
                        <span className="mono text-red">
                          {selectedCandidate.metadata?.unapproved_links ? selectedCandidate.metadata.unapproved_links.join(', ') : 'None listed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text Difference Highlighting */}
                {selectedCandidate.metadata?.diff_explanation && (
                  <div className="diff-highlight-box">
                    <div className="diff-badge">
                      <Sparkles size={14} />
                      <span>Variation Analysis: {titleCase(String(selectedCandidate.metadata.diff_type || 'Variation'))}</span>
                    </div>
                    <p>{String(selectedCandidate.metadata.diff_explanation)}</p>
                    <div className="similarity-metrics-row">
                      {selectedCandidate.metadata?.name_similarity !== undefined && (
                        <span>Name Similarity: <strong>{Math.round(Number(selectedCandidate.metadata.name_similarity) * 100)}%</strong></span>
                      )}
                      {selectedCandidate.metadata?.logo_similarity !== undefined && (
                        <span>Logo Match: <strong>{Math.round(Number(selectedCandidate.metadata.logo_similarity) * 100)}%</strong></span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Signals List */}
              <SectionHeading
                title="Auditable Detection Signals"
                subtitle="Weighted signals used to compute this candidate's risk assessment."
              />

              <div className="evidence-list">
                {selectedEvidence.map(finding => (
                  <article
                    key={finding.id}
                    className={`evidence-item ${finding.excluded ? 'is-verified' : ''}`}
                  >
                    <div className="evidence-icon">
                      {finding.excluded ? <ShieldCheck size={18} /> : <Crosshair size={18} />}
                    </div>
                    <div>
                      <div className="evidence-title">
                        <h3>{finding.signal}</h3>
                        <span className="mono">
                          {finding.excluded ? 'EXCLUDED' : `+${Math.round(finding.score_contribution * 100)} pts`}
                        </span>
                      </div>
                      <p>{finding.evidence}</p>
                      <small>Category: {titleCase(finding.category)} · Weight: {finding.weight.toFixed(2)}</small>
                    </div>
                  </article>
                ))}

                {!selectedEvidence.length && (
                  <div className="empty-evidence-prompt">
                    <p>No detection signals recorded yet. Execute a scan to evaluate this candidate.</p>
                  </div>
                )}
              </div>

              {/* Bio & Source Metadata */}
              {selectedCandidate.metadata?.description && (
                <div className="bio-inspection-box">
                  <label>OBSERVED PROFILE BIO:</label>
                  <blockquote>&ldquo;{String(selectedCandidate.metadata.description)}&rdquo;</blockquote>
                </div>
              )}
            </div>

            {/* Candidate Action Buttons */}
            <div className="drawer-actions-bar">
              <div className="action-group-left">
                {selectedCandidate.url && (
                  <a
                    href={selectedCandidate.url}
                    target="_blank"
                    rel="noreferrer"
                    className="button secondary"
                    title="Open original profile URL in safe viewer"
                  >
                    <ExternalLink size={14} /> Open profile URL
                  </a>
                )}
                <button
                  className="button secondary"
                  onClick={() => handleExportCandidate(selectedCandidate)}
                >
                  <ArrowDownToLine size={14} /> Export JSON
                </button>
              </div>

              <div className="action-group-right">
                <button
                  className="button secondary text-red"
                  onClick={() => setDismissCandidate(selectedCandidate)}
                >
                  Dismiss with reason…
                </button>

                <button
                  className="button secondary"
                  onClick={() => handleMarkStatus(selectedCandidate, 'legitimate')}
                >
                  Mark legitimate
                </button>

                <button
                  className="button secondary"
                  onClick={() => handleApproveAsOfficial(selectedCandidate)}
                >
                  Approve as official
                </button>

                <button
                  className="button primary"
                  onClick={() => {
                    openInvestigation([selectedCandidate.id]);
                    setSelectedCandidate(null);
                  }}
                >
                  <Fingerprint size={15} /> Add to investigation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss with Reason Modal */}
      {dismissCandidate && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDismissCandidate(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Dismiss candidate">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">WORKFLOW DECISION</span>
                <h2>Dismiss Candidate #{dismissCandidate.id}</h2>
              </div>
              <button className="icon-button" onClick={() => setDismissCandidate(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="investigation-form">
              <p className="modal-instructions">
                Document why <strong>{dismissCandidate.name}</strong> is being dismissed. The candidate will be marked as dismissed but preserved in the audit log.
              </p>

              <label>
                Dismissal Reason <span className="required">*</span>
                <select value={dismissReason} onChange={e => setDismissReason(e.target.value)}>
                  <option value="Unrelated legitimate business">Unrelated legitimate business (different industry/region)</option>
                  <option value="Authorized agency / marketing partner">Authorized agency or marketing partner</option>
                  <option value="Parody / satire / fan account">Parody, satire, or unofficial fan account</option>
                  <option value="Known false positive detection">False positive detection rule match</option>
                  <option value="Account already suspended by platform">Account already suspended by platform</option>
                </select>
              </label>

              <label>
                Analyst Notes
                <textarea
                  rows={3}
                  placeholder="Provide supporting rationale for audit compliance…"
                  value={dismissNotes}
                  onChange={e => setDismissNotes(e.target.value)}
                />
              </label>

              <div className="form-actions">
                <button className="button secondary" onClick={() => setDismissCandidate(null)}>
                  Cancel
                </button>
                <button className="button primary" onClick={handleConfirmDismiss}>
                  Confirm Dismissal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
