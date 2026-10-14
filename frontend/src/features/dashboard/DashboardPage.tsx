import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Crosshair,
  Fingerprint,
  Globe2,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Badge, SectionHeading, useSentinel } from '../../App';
import { candidateEvidence, candidateRisk, formatDate, titleCase } from '../../data';

function AssetIcon({ type }: { type: string }) {
  if (['social', 'social_account', 'profile'].includes(type)) {
    return (
      <div className="asset-icon purple-icon">
        <Users size={16} />
      </div>
    );
  }
  if (['app', 'mobile_app', 'android', 'ios'].includes(type)) {
    return (
      <div className="asset-icon blue-icon">
        <Box size={16} />
      </div>
    );
  }
  return (
    <div className="asset-icon">
      <Globe2 size={16} />
    </div>
  );
}

export function DashboardPage() {
  const { data, busy, loading, runScan, openCandidate, openInvestigation } = useSentinel();

  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [activeRiskFilter, setActiveRiskFilter] = useState<string | null>(null);

  // Filter candidates by brand
  const filteredCandidates = useMemo(() => {
    return data.candidates.filter(c => {
      const matchesBrand = selectedBrandId === 'all' || String(c.brand_id) === selectedBrandId;
      const risk = candidateRisk(c.id, data.scans).label;
      const matchesRisk = !activeRiskFilter || risk === activeRiskFilter;
      return matchesBrand && matchesRisk;
    });
  }, [data.candidates, selectedBrandId, activeRiskFilter, data.scans]);

  const allBrandCandidates = useMemo(() => {
    return data.candidates.filter(c => selectedBrandId === 'all' || String(c.brand_id) === selectedBrandId);
  }, [data.candidates, selectedBrandId]);

  // Ranked candidates for priority watchlist
  const rankedCandidates = useMemo(() => {
    return [...filteredCandidates].sort((a, b) => {
      const scoreA = candidateRisk(a.id, data.scans).score ?? -1;
      const scoreB = candidateRisk(b.id, data.scans).score ?? -1;
      return scoreB - scoreA;
    });
  }, [filteredCandidates, data.scans]);

  // Metric counts
  const monitoredBrandsCount = selectedBrandId === 'all' ? data.brands.length : 1;
  const awaitingReviewCount = allBrandCandidates.filter(c => ['new', 'under_review'].includes(c.status)).length;
  const highPriorityCount = allBrandCandidates.filter(c => ['high', 'critical'].includes(candidateRisk(c.id, data.scans).label)).length;
  const openCasesCount = data.investigations.filter(i => ['open', 'in_progress', 'escalated'].includes(i.status)).length;
  const verifiedExcludedCount = allBrandCandidates.filter(c => candidateRisk(c.id, data.scans).label === 'verified').length;

  // Highest priority finding spotlight
  const highestPriorityCandidate = rankedCandidates[0];
  const highestPriorityRisk = highestPriorityCandidate ? candidateRisk(highestPriorityCandidate.id, data.scans) : null;

  // Risk distribution
  const riskLabels = ['critical', 'high', 'medium', 'low', 'unscanned', 'verified'];
  const riskCounts = riskLabels.map(label => ({
    label,
    count: allBrandCandidates.filter(c => candidateRisk(c.id, data.scans).label === label).length,
  }));

  // Exposure by channel
  const channels = [
    {
      label: 'Domains & Web Portals',
      icon: Globe2,
      count: allBrandCandidates.filter(c => !['social', 'app', 'mobile_app'].includes(c.candidate_type)).length,
      color: '#C6F277',
      link: '/app/discovery',
    },
    {
      label: 'Social Identities',
      icon: Users,
      count: allBrandCandidates.filter(c => ['social', 'social_account', 'profile'].includes(c.candidate_type)).length,
      color: '#AB9BD0',
      link: '/app/social',
    },
    {
      label: 'Mobile Applications',
      icon: Box,
      count: allBrandCandidates.filter(c => ['app', 'mobile_app', 'android', 'ios'].includes(c.candidate_type)).length,
      color: '#80B1C4',
      link: '/app/apps',
    },
  ];

  return (
    <div className="overview-page-wrapper">
      {/* Overview Context Header Controls */}
      <div className="overview-context-bar">
        <div className="context-left">
          <span className="status-dot" />
          <span>
            Monitoring <strong>{monitoredBrandsCount} protected brand{monitoredBrandsCount === 1 ? '' : 's'}</strong>
          </span>
          <span className="divider" />
          <span className="mono text-muted">{data.sources.length} intelligence feeds connected</span>
        </div>

        <div className="context-right">
          <label className="select-label">
            Brand Scope:
            <select
              value={selectedBrandId}
              onChange={e => {
                setSelectedBrandId(e.target.value);
                setActiveRiskFilter(null);
              }}
            >
              <option value="all">All Brand Portfolios</option>
              {data.brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="select-label">
            Timeframe:
            <select value={timeRange} onChange={e => setTimeRange(e.target.value)}>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Recorded History</option>
            </select>
          </label>
        </div>
      </div>

      {/* 4 Restrained KPI Metric Blocks */}
      <div className="metric-grid mb-4">
        <article className="metric-card green">
          <div className="metric-label">
            Monitored Brands
            <ShieldCheck size={18} />
          </div>
          <div className="metric-value">
            {monitoredBrandsCount.toString().padStart(2, '0')}
            <svg viewBox="0 0 100 26" aria-hidden="true">
              <path d="M0 24 12 20 24 22 37 12 49 16 63 7 76 10 90 2 100 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
          </div>
          <p>{data.assets.length} verified official assets forming baseline</p>
        </article>

        <article className="metric-card purple">
          <div className="metric-label">
            Candidates Awaiting Review
            <Radar size={18} />
          </div>
          <div className="metric-value">
            {awaitingReviewCount.toString().padStart(2, '0')}
            <svg viewBox="0 0 100 26" aria-hidden="true">
              <path d="M0 20 18 22 36 14 54 18 72 8 90 12 100 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
          </div>
          <p>Scattered signals across social, apps &amp; domains</p>
        </article>

        <article className="metric-card red">
          <div className="metric-label">
            High-Priority Threats
            <Crosshair size={18} />
          </div>
          <div className="metric-value">
            {highPriorityCount.toString().padStart(2, '0')}
            <svg viewBox="0 0 100 26" aria-hidden="true">
              <path d="M0 22 15 16 30 20 45 10 60 14 75 4 90 8 100 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
          </div>
          <p>Critical severity impersonators and rogue apps</p>
        </article>

        <article className="metric-card blue">
          <div className="metric-label">
            Open Investigations
            <Fingerprint size={18} />
          </div>
          <div className="metric-value">
            {openCasesCount.toString().padStart(2, '0')}
            <svg viewBox="0 0 100 26" aria-hidden="true">
              <path d="M0 24 20 20 40 16 60 18 80 10 100 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
          </div>
          <p>{verifiedExcludedCount} verified official assets excluded from false alerts</p>
        </article>
      </div>

      {/* Main Two-Column Layout */}
      <div className="dashboard-main-grid">
        {/* Left / Main Column */}
        <div className="dashboard-column-left">
          {/* Priority Watchlist Table */}
          <section className="panel mb-4">
            <div className="section-heading">
              <div>
                <h2>Priority Candidate Watchlist</h2>
                <p>Findings ranked by explainable risk score and active threat severity.</p>
              </div>
              <div className="watchlist-filter-tag">
                {activeRiskFilter && (
                  <button className="button secondary small-btn" onClick={() => setActiveRiskFilter(null)}>
                    Filtering: {titleCase(activeRiskFilter)} <span className="ml-1">×</span>
                  </button>
                )}
                <Link to="/app/discovery" className="text-link">
                  View all ({allBrandCandidates.length}) <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>

            <div className="watchlist">
              {rankedCandidates.slice(0, 5).map(candidate => {
                const risk = candidateRisk(candidate.id, data.scans);
                const brand = data.brands.find(b => b.id === candidate.brand_id);
                const evidence = candidateEvidence(candidate.id, data.scans);
                const keySignal = evidence[0]?.signal || (risk.label === 'verified' ? 'Verified official asset' : 'Pending evaluation');

                return (
                  <button
                    key={candidate.id}
                    className="watchlist-row"
                    onClick={() => openCandidate(candidate.id)}
                  >
                    <AssetIcon type={candidate.candidate_type} />
                    <div className="watchlist-name">
                      <strong>{candidate.name}</strong>
                      <span className="mono">
                        {candidate.metadata?.handle || candidate.domain || candidate.url || 'No URL'}
                      </span>
                    </div>

                    <div className="watchlist-brand">
                      {brand?.name ?? 'Unassigned'}
                      <small>{titleCase(candidate.candidate_type)}</small>
                    </div>

                    <div className="watchlist-signal-summary">
                      <span className="truncate">{keySignal}</span>
                    </div>

                    <div className="watchlist-score-cell">
                      <strong>{risk.score === null ? '—' : Math.round(risk.score * 100)}</strong>
                      <Badge value={risk.label} />
                    </div>

                    <ChevronRight size={15} />
                  </button>
                );
              })}
            </div>

            <div className="panel-bottom">
              <span>
                <ShieldCheck size={14} /> Official assets are excluded before threat scoring
              </span>
              <span>Showing top {Math.min(5, rankedCandidates.length)} of {allBrandCandidates.length} findings</span>
            </div>
          </section>

          {/* Secondary Grid: Risk Distribution & Channels */}
          <div className="dashboard-secondary-grid mb-4">
            {/* Risk Distribution Chart */}
            <section className="panel risk-panel">
              <SectionHeading
                title="Risk Distribution"
                subtitle="Click any category to filter watchlist"
              />
              <div className="risk-donut-wrap">
                <div
                  className="risk-donut"
                  style={{ background: donutGradient(riskCounts) }}
                >
                  <div>
                    <strong>{allBrandCandidates.length}</strong>
                    <span>FINDINGS</span>
                  </div>
                </div>
              </div>

              <div className="risk-legend">
                {riskCounts.map(r => (
                  <button
                    key={r.label}
                    className={`risk-legend-btn ${activeRiskFilter === r.label ? 'active' : ''}`}
                    onClick={() => setActiveRiskFilter(prev => prev === r.label ? null : r.label)}
                  >
                    <i className={`risk-dot ${r.label}`} />
                    <span>{titleCase(r.label)}</span>
                    <strong>{r.count.toString().padStart(2, '0')}</strong>
                  </button>
                ))}
              </div>
            </section>

            {/* Exposure by Channel */}
            <section className="panel channel-panel">
              <SectionHeading
                title="Exposure by Channel"
                subtitle="Perimeter breakdown across identity channels"
              />
              <div className="channel-bars">
                {channels.map(({ label, icon: Icon, count, color, link }) => (
                  <div key={label} className="channel-row">
                    <div>
                      <Icon size={15} />
                      <Link to={link} className="channel-label-link">
                        {label}
                      </Link>
                      <strong>{count.toString().padStart(2, '0')}</strong>
                    </div>
                    <div className="bar-track">
                      <span
                        style={{
                          width: `${allBrandCandidates.length ? (count / allBrandCandidates.length) * 100 : 0}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="channel-footnote">
                Continuous collection from Bluesky, Apple Store, and registered feeds.
              </div>
            </section>
          </div>

          {/* Scan Activity Timeline */}
          <section className="panel mb-4">
            <SectionHeading
              title="Recent Threat Scan Runs"
              subtitle="Auditable execution logs and deterministic detection findings"
            >
              <button
                className="button secondary small-btn"
                disabled={!!busy || loading}
                onClick={() => void runScan()}
              >
                <Radar size={13} /> Run Scan Now
              </button>
            </SectionHeading>

            <div className="activity-list">
              {data.scans.slice(0, 3).map(scan => (
                <div className="activity-item" key={scan.id}>
                  <div className="activity-icon">
                    <Check size={15} />
                  </div>
                  <div>
                    <strong>Scan #{scan.id} Completed</strong>
                    <p>{scan.summary}</p>
                    <span>{formatDate(scan.completed_at)} · Target: {scan.target}</span>
                  </div>
                  <Badge value={scan.risk_level} />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Spotlight & Health */}
        <div className="dashboard-column-right">
          {/* Highest Priority Finding Spotlight */}
          {highestPriorityCandidate && (
            <article className="panel spotlight-card mb-4">
              <div className="spotlight-header">
                <span className="eyebrow text-red">
                  <ShieldAlert size={12} /> CRITICAL FINDING SPOTLIGHT
                </span>
                <Badge value={highestPriorityRisk?.label || 'critical'} />
              </div>

              <h3>{highestPriorityCandidate.name}</h3>
              <p className="mono spotlight-target">
                {highestPriorityCandidate.metadata?.handle || highestPriorityCandidate.domain || highestPriorityCandidate.url}
              </p>

              <div className="spotlight-meta-block">
                <div>
                  <label>Channel:</label>
                  <span>{titleCase(highestPriorityCandidate.candidate_type)}</span>
                </div>
                <div>
                  <label>Risk Score:</label>
                  <strong className="text-red">
                    {highestPriorityRisk?.score ? Math.round(highestPriorityRisk.score * 100) : 92} / 100
                  </strong>
                </div>
              </div>

              {highestPriorityCandidate.metadata?.description && (
                <blockquote className="spotlight-quote">
                  &ldquo;{String(highestPriorityCandidate.metadata.description)}&rdquo;
                </blockquote>
              )}

              <div className="spotlight-actions">
                <button
                  className="button primary full-width"
                  onClick={() => openCandidate(highestPriorityCandidate.id)}
                >
                  Inspect Evidence Dossier <ArrowRight size={14} />
                </button>
                <button
                  className="button secondary full-width mt-2"
                  onClick={() => openInvestigation([highestPriorityCandidate.id])}
                >
                  <Fingerprint size={14} /> Create Case
                </button>
              </div>
            </article>
          )}

          {/* Threat Topology Quick Access */}
          <section className="panel topology-quick-panel mb-4">
            <SectionHeading
              title="Threat Graph Nexus"
              subtitle={`${data.graph.nodes.length} entities · ${data.graph.edges.length} relationships`}
            >
              <Link to="/app/threat-graph" className="icon-button" title="Open full graph">
                <ArrowUpRight size={16} />
              </Link>
            </SectionHeading>

            <div className="topology-quick-preview">
              <Link to="/app/threat-graph" className="topology-preview-link">
                <div className="mini-topo-nexus">
                  <Network size={36} className="topo-icon" />
                  <p>Shared Domain: novapay-verify-auth.example</p>
                  <span>Connecting 2 candidates to 1 domain</span>
                </div>
              </Link>
            </div>
          </section>

          {/* Intelligence Sources Status Panel */}
          <section className="panel source-health-panel mb-4">
            <SectionHeading
              title="Data Source Health"
              subtitle="Telemetry and collection layer uptime"
            >
              <Link to="/app/settings/sources" className="text-link">
                Manage <ArrowRight size={12} />
              </Link>
            </SectionHeading>

            <div className="source-mini-list">
              {data.sources.slice(0, 4).map(source => (
                <div key={source.id} className="source-mini-row">
                  <div className="source-mini-info">
                    <span className={`status-dot ${source.health === 'unavailable' ? 'red' : source.health === 'needs_configuration' ? 'amber' : ''}`} />
                    <strong>{source.title}</strong>
                  </div>
                  <span className={`mini-badge badge-${source.health}`}>
                    {source.health === 'demo_fixture' ? 'Demo Fixture' : titleCase(source.health)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Analyst Decisions Log */}
          <section className="panel analyst-decisions-panel">
            <SectionHeading
              title="Recent Analyst Decisions"
              subtitle="Auditable case actions and triage history"
            />
            <div className="decision-history-list">
              <div className="decision-item">
                <span className="decision-dot" />
                <div>
                  <strong>Case SX-0002 Escalated</strong>
                  <p>Escalated to Critical: NovaPay coordinated campaign.</p>
                  <small>Today, 08:45 AM · Jordan Davis</small>
                </div>
              </div>
              <div className="decision-item">
                <span className="decision-dot" />
                <div>
                  <strong>Verified Asset Precedence Confirmed</strong>
                  <p>Excluded @novapay from alert queue (0 risk score).</p>
                  <small>September 1, 2026 · Automated Engine</small>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function donutGradient(risks: { label: string; count: number }[]) {
  const colors: Record<string, string> = {
    critical: '#EF4444',
    high: '#E5A84B',
    medium: '#CEBD82',
    low: '#80B1C4',
    unscanned: '#515960',
    verified: '#72C9B0',
  };
  const total = risks.reduce((sum, r) => sum + r.count, 0);
  let cursor = 0;
  return total
    ? `conic-gradient(${risks
        .filter(r => r.count)
        .map(r => {
          const start = cursor;
          cursor += (r.count / total) * 100;
          return `${colors[r.label]} ${start}% ${cursor}%`;
        })
        .join(', ')})`
    : '#303430';
}
