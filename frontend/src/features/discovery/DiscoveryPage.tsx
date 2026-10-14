import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  ChevronRight,
  Fingerprint,
  Globe2,
  Radar,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Badge, EmptyState, useSentinel } from '../../App';
import { candidateRisk, formatDate, titleCase } from '../../data';

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

export function DiscoveryPage() {
  const { data, openCandidate, openInvestigation, busy, loading } = useSentinel();
  const [params, setParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'all' | 'social' | 'apps' | 'excluded'>('all');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('risk');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const brandParam = params.get('brand') ?? 'all';

  // Excluded candidates are those with verified risk label or metadata.official = true
  const excludedCandidates = useMemo(() => {
    return data.candidates.filter(c =>
      candidateRisk(c.id, data.scans).label === 'verified' ||
      c.metadata?.official === true ||
      c.metadata?.verified_match === true
    );
  }, [data.candidates, data.scans]);

  const activeCandidates = useMemo(() => {
    if (activeTab === 'excluded') {
      return excludedCandidates;
    }
    if (activeTab === 'social') {
      return data.candidates.filter(c =>
        ['social', 'social_account', 'profile'].includes(c.candidate_type) ||
        c.metadata?.platform !== undefined
      );
    }
    if (activeTab === 'apps') {
      return data.candidates.filter(c =>
        ['app', 'mobile_app', 'android', 'ios'].includes(c.candidate_type) ||
        c.metadata?.store !== undefined ||
        c.metadata?.publisher !== undefined
      );
    }
    return data.candidates;
  }, [activeTab, data.candidates, excludedCandidates]);

  const filteredCandidates = useMemo(() => {
    return activeCandidates.filter(c => {
      const matchesBrand = brandParam === 'all' || String(c.brand_id) === brandParam;
      const matchesQuery = !query ||
        `${c.name} ${c.domain ?? ''} ${c.url ?? ''} ${c.metadata?.handle ?? ''} ${c.metadata?.publisher ?? ''}`.toLowerCase().includes(query.toLowerCase());
      const risk = candidateRisk(c.id, data.scans).label;
      const matchesRisk = riskFilter === 'all' || risk === riskFilter;
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

      return matchesBrand && matchesQuery && matchesRisk && matchesStatus;
    }).sort((a, b) => {
      if (sortOrder === 'risk') {
        const scoreA = candidateRisk(a.id, data.scans).score ?? -1;
        const scoreB = candidateRisk(b.id, data.scans).score ?? -1;
        return scoreB - scoreA;
      }
      if (sortOrder === 'recent') return b.id - a.id;
      return a.name.localeCompare(b.name);
    });
  }, [activeCandidates, brandParam, query, riskFilter, statusFilter, sortOrder, data.scans]);

  const allVisibleSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredCandidates.some(c => c.id === id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredCandidates.map(c => c.id)])]);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  return (
    <div className="discovery-page-container">
      {/* Hero Overview */}
      <div className="channel-hero discovery-hero">
        <div className="channel-hero-icon green-icon">
          <Radar size={28} />
        </div>
        <div>
          <h2>Unified Threat Discovery</h2>
          <p>
            Cross-platform candidate explorer combining web domains, social accounts, and mobile applications with explainable signals.
          </p>
        </div>
        <div className="heading-actions ml-auto">
          <button
            className="button primary"
            disabled={!selectedIds.length || !!busy || loading}
            onClick={() => openInvestigation(selectedIds)}
          >
            <Fingerprint size={15} /> Investigate Selected ({selectedIds.length})
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="brand-tabs-strip mb-4">
        <button
          className={activeTab === 'all' ? 'active' : ''}
          onClick={() => { setActiveTab('all'); setSelectedIds([]); }}
        >
          All Findings ({data.candidates.length})
        </button>
        <button
          className={activeTab === 'social' ? 'active' : ''}
          onClick={() => { setActiveTab('social'); setSelectedIds([]); }}
        >
          Social Profiles ({data.candidates.filter(c => ['social', 'social_account', 'profile'].includes(c.candidate_type)).length})
        </button>
        <button
          className={activeTab === 'apps' ? 'active' : ''}
          onClick={() => { setActiveTab('apps'); setSelectedIds([]); }}
        >
          Applications ({data.candidates.filter(c => ['app', 'mobile_app', 'android', 'ios'].includes(c.candidate_type)).length})
        </button>
        <button
          className={activeTab === 'excluded' ? 'active' : ''}
          onClick={() => { setActiveTab('excluded'); setSelectedIds([]); }}
        >
          Excluded Official Assets ({excludedCandidates.length})
        </button>
      </div>

      {/* Exclusion Explanation Callout when in Excluded Tab */}
      {activeTab === 'excluded' && (
        <div className="exclusion-callout-panel mb-4">
          <ShieldCheck size={20} className="text-green" />
          <div>
            <strong>Verified Asset Exclusion Register (Zero-Score Rule):</strong>
            <p>
              These records match official registered assets in the brand portfolio. To guarantee that legitimate marketing pages and corporate assets are never falsely flagged, SENTINEL X excludes exact verified matches from threat risk calculations before scoring.
            </p>
          </div>
        </div>
      )}

      {/* Main Table Panel */}
      <section className="panel mb-4">
        <div className="filter-bar">
          <div className="input-search">
            <Search size={15} />
            <input
              placeholder="Search candidate name, domain, URL, handle…"
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

            {activeTab !== 'excluded' && (
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
            )}

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
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all visible candidates"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Candidate / Asset</th>
                  <th>Target Brand</th>
                  <th>Type</th>
                  {activeTab === 'excluded' ? <th>Exclusion Justification</th> : <th>Risk Assessment</th>}
                  <th>Score</th>
                  <th>Observed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map(candidate => {
                  const risk = candidateRisk(candidate.id, data.scans);
                  const brand = data.brands.find(b => b.id === candidate.brand_id);
                  const isSelected = selectedIds.includes(candidate.id);
                  const isExcluded = risk.label === 'verified' || candidate.metadata?.official;

                  return (
                    <tr
                      key={candidate.id}
                      className={`${isSelected ? 'selected-row' : ''} ${isExcluded ? 'excluded-row' : ''}`.trim()}
                      onClick={() => openCandidate(candidate.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${candidate.name}`}
                          checked={isSelected}
                          onChange={() => toggleSelect(candidate.id)}
                        />
                      </td>

                      <td>
                        <button
                          className="table-name table-button"
                          onClick={() => openCandidate(candidate.id)}
                        >
                          <AssetIcon type={candidate.candidate_type} />
                          <div>
                            <strong>{candidate.name}</strong>
                            <small className="mono">
                              {candidate.domain ?? candidate.url ?? titleCase(candidate.candidate_type)}
                            </small>
                          </div>
                        </button>
                      </td>

                      <td>{brand?.name ?? 'Unassigned'}</td>

                      <td>
                        <span className="type-tag">{titleCase(candidate.candidate_type)}</span>
                      </td>

                      {activeTab === 'excluded' ? (
                        <td>
                          <span className="exclusion-reason-tag">
                            <ShieldCheck size={13} className="text-green" />
                            {candidate.id === 2
                              ? 'Exact domain match to registered official asset (acme.security)'
                              : candidate.id === 13
                              ? 'Exact handle match to registered official social account (@novapay)'
                              : 'Registered brand baseline entity'}
                          </span>
                        </td>
                      ) : (
                        <td>
                          <Badge value={risk.label} />
                        </td>
                      )}

                      <td>
                        <div className="table-score">
                          <strong>{risk.score === null ? '—' : Math.round(risk.score * 100)}</strong>
                          {risk.score !== null && (
                            <span>
                              <i className={risk.label} style={{ width: `${Math.max(10, risk.score * 100)}%` }} />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="nowrap muted">{formatDate(candidate.created_at)}</td>

                      <td>
                        <button
                          className="icon-button"
                          title="Inspect candidate"
                          onClick={e => {
                            e.stopPropagation();
                            openCandidate(candidate.id);
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
            icon={<Radar size={28} />}
            title="No candidates found"
            description="Adjust your search query or filters to inspect candidates."
          >
            <button className="button secondary" onClick={() => { setQuery(''); setRiskFilter('all'); setStatusFilter('all'); }}>
              Reset Filters
            </button>
          </EmptyState>
        )}

        <div className="panel-bottom">
          <span>Showing {filteredCandidates.length} of {activeCandidates.length} candidates</span>
          <span>{selectedIds.length} selected for investigation action</span>
        </div>
      </section>

      {/* Notice */}
      <div className="notice">
        <ShieldCheck size={16} />
        <span>
          <strong>Cross-Perimeter Integrity:</strong> Candidates include social look-alikes, unauthorized application listings, and credential-harvesting phishing domains. Click any candidate to review explainable scoring evidence.
        </span>
      </div>
    </div>
  );
}
