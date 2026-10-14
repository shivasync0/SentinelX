import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Globe2,
  Network,
  Plus,
  Radar,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Badge, EmptyState, SectionHeading, useSentinel } from '../../App';
import { candidateRisk, titleCase, type Asset } from '../../data';

export function BrandDetailPage() {
  const { id } = useParams();
  const { data, saveDemo, notify } = useSentinel();
  const brandId = Number(id);
  const brand = data.brands.find(b => b.id === brandId);

  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'monitoring' | 'history'>('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAssetType, setNewAssetType] = useState('social');
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');

  if (!brand) {
    return (
      <section className="panel">
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="Brand not found"
          description="The requested brand profile does not exist in the current workspace."
        >
          <Link to="/app/brands" className="button secondary">
            Back to brand registry
          </Link>
        </EmptyState>
      </section>
    );
  }

  const brandAssets = data.assets.filter(a => a.brand_id === brand.id);
  const brandCandidates = data.candidates.filter(c => c.brand_id === brand.id);
  const highRiskCandidates = brandCandidates.filter(c => ['high', 'critical'].includes(candidateRisk(c.id, data.scans).label));
  const excludedAssets = brandCandidates.filter(c => candidateRisk(c.id, data.scans).label === 'verified');

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetUrl.trim()) return;

    const newAsset: Asset = {
      id: Math.max(0, ...data.assets.map(a => a.id)) + 1,
      brand_id: brand.id,
      asset_type: newAssetType,
      name: newAssetName.trim() || `${brand.name} ${newAssetType}`,
      url: newAssetUrl.trim(),
      status: 'verified',
      verified_at: new Date().toISOString(),
    };

    saveDemo(prev => ({
      ...prev,
      assets: [...prev.assets, newAsset],
    }));

    notify(`Official asset "${newAsset.name}" added and verified.`);
    setShowAddModal(false);
    setNewAssetName('');
    setNewAssetUrl('');
  };

  const handleDeleteAsset = (assetId: number) => {
    saveDemo(prev => ({
      ...prev,
      assets: prev.assets.filter(a => a.id !== assetId),
    }));
    notify('Official asset removed from baseline.');
  };

  const handleToggleVerify = (asset: Asset) => {
    const nextStatus = asset.status === 'verified' ? 'unverified' : 'verified';
    saveDemo(prev => ({
      ...prev,
      assets: prev.assets.map(a => (a.id === asset.id ? { ...a, status: nextStatus } : a)),
    }));
    notify(`Asset "${asset.name}" status updated to ${nextStatus}.`);
  };

  return (
    <div className="brand-detail-page">
      {/* Brand Hero Header */}
      <div className="brand-detail-hero">
        <div className="hero-top-nav">
          <Link to="/app/brands" className="text-link">
            <ArrowLeft size={14} /> Brand portfolio
          </Link>
        </div>

        <div className="brand-hero-main">
          <div className="brand-detail-avatar">
            {brand.logo || brand.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="brand-hero-text">
            <div className="brand-hero-tags">
              <span className="eyebrow">PROTECTED ENTERPRISE ASSET</span>
              <Badge value="protected" />
              <span className="industry-pill">{brand.industry ?? 'Technology & Services'}</span>
            </div>
            <h1>{brand.name}</h1>
            <p>{brand.description ?? 'Monitored brand identity profile.'}</p>
          </div>

          <div className="brand-hero-actions">
            <Link to={`/app/threat-graph?brand=${brand.id}`} className="button secondary">
              <Network size={15} /> Exposure Graph
            </Link>
            <Link to={`/app/discovery?brand=${brand.id}`} className="button primary">
              <Radar size={15} /> View Findings ({brandCandidates.length})
            </Link>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="brand-kpi-strip">
          <div className="kpi-cell">
            <span>Verified Official Assets</span>
            <strong>{brandAssets.length}</strong>
            <small>Baseline trust records</small>
          </div>
          <div className="kpi-cell">
            <span>Discovered Candidates</span>
            <strong>{brandCandidates.length}</strong>
            <small>Across social, apps &amp; web</small>
          </div>
          <div className="kpi-cell">
            <span>High &amp; Critical Threats</span>
            <strong className="text-red">{highRiskCandidates.length}</strong>
            <small>Requires analyst review</small>
          </div>
          <div className="kpi-cell">
            <span>Excluded Matches</span>
            <strong className="text-green">{excludedAssets.length}</strong>
            <small>Zero-score false alarm prevention</small>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="brand-tabs-strip">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview &amp; Baseline
        </button>
        <button
          className={activeTab === 'assets' ? 'active' : ''}
          onClick={() => setActiveTab('assets')}
        >
          Official Assets Registry ({brandAssets.length})
        </button>
        <button
          className={activeTab === 'monitoring' ? 'active' : ''}
          onClick={() => setActiveTab('monitoring')}
        >
          Detection Scope &amp; Rules
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Audit History &amp; Scans
        </button>
      </div>

      {/* TAB 1: Overview */}
      {activeTab === 'overview' && (
        <div className="brand-tab-body">
          <div className="brand-overview-grid">
            <div className="panel overview-panel">
              <SectionHeading
                title="Approved Infrastructure"
                subtitle="Domains and sanctioned hostnames belonging to this brand."
              />
              <div className="approved-domains-list">
                {brand.domains.map(d => (
                  <div key={d} className="domain-item">
                    <Globe2 size={16} />
                    <span className="mono">{d}</span>
                    <span className="badge badge-verified">Approved Host</span>
                  </div>
                ))}
              </div>

              <div className="exclusion-explanation-box">
                <ShieldCheck size={18} />
                <div>
                  <strong>Why Official Assets Are Excluded:</strong>
                  <p>
                    When SENTINEL X detects any candidate target, it immediately executes an exact match against this registry. Legitimate marketing pages and subdomains are marked &ldquo;VERIFIED&rdquo; and excluded before risk calculation, guaranteeing zero false alerts on your real assets.
                  </p>
                </div>
              </div>
            </div>

            <div className="panel threat-preview-panel">
              <SectionHeading
                title="Active Threat Breakdown"
                subtitle={`Current findings detected for ${brand.name}`}
              >
                <Link to={`/app/discovery?brand=${brand.id}`} className="text-link">
                  View all <ArrowRight size={13} />
                </Link>
              </SectionHeading>

              <div className="brand-threat-list">
                {brandCandidates.slice(0, 4).map(c => {
                  const risk = candidateRisk(c.id, data.scans);
                  return (
                    <div key={c.id} className="threat-summary-row">
                      <div>
                        <strong>{c.name}</strong>
                        <span className="mono">{c.domain ?? c.url ?? titleCase(c.candidate_type)}</span>
                      </div>
                      <Badge value={risk.label} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Official Assets */}
      {activeTab === 'assets' && (
        <div className="brand-tab-body">
          <div className="panel">
            <SectionHeading
              title="Official Asset Registry"
              subtitle="Registered domains, social identities, and app identifiers forming your trust baseline."
            >
              <button className="button primary" onClick={() => setShowAddModal(true)}>
                <Plus size={15} /> Register Official Asset
              </button>
            </SectionHeading>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Official Asset</th>
                    <th>Type</th>
                    <th>Canonical Identity / URL</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brandAssets.map(asset => (
                    <tr key={asset.id}>
                      <td>
                        <div className="table-name">
                          <div className="asset-icon">
                            {asset.asset_type === 'social' ? <Users size={16} /> : asset.asset_type === 'mobile_app' ? <Box size={16} /> : <Globe2 size={16} />}
                          </div>
                          <strong>{asset.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="type-tag">{titleCase(asset.asset_type)}</span>
                      </td>
                      <td className="mono">{asset.url}</td>
                      <td>
                        <button
                          className="badge-btn"
                          title="Click to toggle verification status"
                          onClick={() => handleToggleVerify(asset)}
                        >
                          <Badge value={asset.status} />
                        </button>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          title="Remove asset"
                          onClick={() => handleDeleteAsset(asset.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Monitoring Scope */}
      {activeTab === 'monitoring' && (
        <div className="brand-tab-body">
          <div className="panel monitoring-panel">
            <SectionHeading
              title="Detection Scope &amp; Heuristics"
              subtitle="Active rule sets used to discover impersonators of this brand."
            />
            <div className="rules-grid">
              <div className="rule-card">
                <h4>TYPO-SQUATTING &amp; LOOK-ALIKES</h4>
                <p>Monitors Levenshtein distance &gt;= 0.85, numeral substitutions (leetspeak), and whitespace insertions.</p>
                <span className="rule-status active">ACTIVE</span>
              </div>
              <div className="rule-card">
                <h4>APP STORE PUBLISHER INTEGRITY</h4>
                <p>Flags any mobile app containing brand keywords whose publisher is not registered in official developer aliases.</p>
                <span className="rule-status active">ACTIVE</span>
              </div>
              <div className="rule-card">
                <h4>UNAUTHORIZED SUPPORT IDENTITIES</h4>
                <p>Detects social accounts using brand keywords with &ldquo;support&rdquo;, &ldquo;helpdesk&rdquo;, or &ldquo;claims&rdquo; terms.</p>
                <span className="rule-status active">ACTIVE</span>
              </div>
              <div className="rule-card">
                <h4>SHARED INFRASTRUCTURE CORRELATION</h4>
                <p>Automatically maps candidates referencing identical unverified outbound domains or IP blocks.</p>
                <span className="rule-status active">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: History */}
      {activeTab === 'history' && (
        <div className="brand-tab-body">
          <div className="panel history-panel">
            <SectionHeading
              title="Brand Audit Trail"
              subtitle="Chronological log of asset onboarding, scan executions, and analyst modifications."
            />
            <div className="brand-timeline">
              <div className="timeline-event">
                <span className="time-dot" />
                <div>
                  <strong>Deterministic Scan Executed</strong>
                  <p>Evaluated 13 perimeter candidates against {brandAssets.length} verified official assets.</p>
                  <small>Today, 09:30 AM · Automated Detection Engine</small>
                </div>
              </div>
              <div className="timeline-event">
                <span className="time-dot" />
                <div>
                  <strong>Official Social Asset Registered</strong>
                  <p>Registered @novapay as canonical social identity with automatic exclusion rules.</p>
                  <small>September 1, 2026 · Jordan Davis</small>
                </div>
              </div>
              <div className="timeline-event">
                <span className="time-dot" />
                <div>
                  <strong>Brand Baseline Initialized</strong>
                  <p>Protected brand entity onboarded with 3 apex domains.</p>
                  <small>September 1, 2026 · System Administrator</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Register official asset">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">BASELINE PROTECTION</span>
                <h2>Register Official Asset</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="investigation-form">
              <label>
                Asset Type
                <select value={newAssetType} onChange={e => setNewAssetType(e.target.value)}>
                  <option value="domain">Official Domain / Web Portal</option>
                  <option value="social">Social Media Account / Handle</option>
                  <option value="mobile_app">Mobile Application (Store Package)</option>
                  <option value="support_portal">Designated Support Portal</option>
                </select>
              </label>

              <label>
                Asset Display Name
                <input
                  placeholder="e.g. Official Customer Portal"
                  value={newAssetName}
                  onChange={e => setNewAssetName(e.target.value)}
                />
              </label>

              <label>
                Canonical URL / Identifier <span className="required">*</span>
                <input
                  required
                  placeholder="https://... or @handle"
                  value={newAssetUrl}
                  onChange={e => setNewAssetUrl(e.target.value)}
                />
                <small>Exact string used for automatic zero-score exclusion.</small>
              </label>

              <div className="form-actions">
                <button type="button" className="button secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button primary">
                  <Check size={15} /> Add to Baseline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
