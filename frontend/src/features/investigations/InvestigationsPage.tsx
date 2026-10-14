import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Fingerprint,
  Globe2,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge, EmptyState, useSentinel } from '../../App';
import { formatDate, demoInvestigations, demoReports } from '../../data';

export function InvestigationsPage() {
  const { data, openInvestigation, generateReport, busy, loading, saveDemo, notify } = useSentinel();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredInvestigations = useMemo(() => {
    return data.investigations.filter(i => {
      const caseCode = `SX-${i.id.toString().padStart(4, '0')}`;
      const matchesQuery = !query ||
        `${i.title} ${i.notes} ${caseCode}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || i.priority === priorityFilter;

      return matchesQuery && matchesStatus && matchesPriority;
    }).sort((a, b) => b.id - a.id);
  }, [data.investigations, query, statusFilter, priorityFilter]);

  const openCount = data.investigations.filter(i => ['open', 'in_progress', 'under_review', 'escalated'].includes(i.status)).length;
  const criticalCount = data.investigations.filter(i => i.priority === 'critical').length;
  const totalFindingsLinked = data.investigations.reduce((sum, i) => sum + i.candidate_ids.length, 0);

  return (
    <div className="investigations-page-container">
      {/* Header */}
      <div className="channel-hero investigation-hero">
        <div className="channel-hero-icon green-icon">
          <Fingerprint size={28} />
        </div>
        <div>
          <h2>Investigation Cases</h2>
          <p>
            Cluster scattered identity signals into defensible cases. Document analyst findings, track threat relationships, and prepare takedown dossiers.
          </p>
        </div>
        <div className="heading-actions ml-auto">
          <button className="button primary" disabled={loading || !!busy} onClick={() => openInvestigation([])}>
            <Plus size={15} /> New Investigation Case
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="collection-metrics">
        <div>
          <span>Total Active Cases</span>
          <strong>{data.investigations.length.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Open / Action Required</span>
          <strong className="text-red">{openCount.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Critical Threat Cases</span>
          <strong className="text-red">{criticalCount.toString().padStart(2, '0')}</strong>
        </div>
        <div>
          <span>Findings Under Investigation</span>
          <strong>{totalFindingsLinked.toString().padStart(2, '0')}</strong>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <section className="panel mb-4">
        <div className="filter-bar">
          <div className="input-search">
            <Search size={15} />
            <input
              placeholder="Search case title, case ID, analyst note…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="filter-controls">
            <SlidersHorizontal size={14} />

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="under_review">Under Review</option>
              <option value="escalated">Escalated</option>
              <option value="closed">Closed / Resolved</option>
            </select>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Investigation Cases List */}
        {filteredInvestigations.length ? (
          <div className="investigation-cases-grid p-4">
            {filteredInvestigations.map(investigation => {
              const brand = data.brands.find(b => b.id === investigation.brand_id) || data.brands[0];
              const caseCode = `CASE SX-${investigation.id.toString().padStart(4, '0')}`;
              const linkedCandidates = data.candidates.filter(c => investigation.candidate_ids.includes(c.id));

              return (
                <article key={investigation.id} className="panel investigation-case-card">
                  <div className="case-card-header">
                    <div className="case-id-group">
                      <Fingerprint size={20} className="case-glyph" />
                      <div>
                        <span className="eyebrow">{caseCode}</span>
                        <h3>
                          <Link to={`/app/investigations/${investigation.id}`}>
                            {investigation.title}
                          </Link>
                        </h3>
                      </div>
                    </div>
                    <div className="case-badges">
                      <Badge value={investigation.priority} />
                      <Badge value={investigation.status} />
                    </div>
                  </div>

                  <p className="case-card-notes">
                    {investigation.notes || 'No analyst context recorded.'}
                  </p>

                  <div className="case-card-meta">
                    <div className="case-meta-item">
                      <label>Target Brand:</label>
                      <span>{brand?.name ?? 'General Perimeter'}</span>
                    </div>
                    <div className="case-meta-item">
                      <label>Linked Findings:</label>
                      <strong>{investigation.candidate_ids.length} candidates</strong>
                    </div>
                    <div className="case-meta-item">
                      <label>Last Updated:</label>
                      <span>{formatDate(investigation.updated_at || investigation.created_at)}</span>
                    </div>
                  </div>

                  {/* Linked candidate pills */}
                  {linkedCandidates.length > 0 && (
                    <div className="case-linked-pills">
                      {linkedCandidates.slice(0, 3).map(c => (
                        <span key={c.id} className="candidate-pill">
                          <Globe2 size={12} /> {c.name}
                        </span>
                      ))}
                      {linkedCandidates.length > 3 && (
                        <span className="candidate-pill-more">+{linkedCandidates.length - 3} more</span>
                      )}
                    </div>
                  )}

                  <div className="case-card-footer">
                    <button
                      className="button secondary small-btn"
                      disabled={!!busy || loading}
                      onClick={() => void generateReport(investigation)}
                    >
                      <FileText size={13} /> Export Dossier
                    </button>
                    <Link to={`/app/investigations/${investigation.id}`} className="button primary small-btn">
                      Open Case Workspace <ArrowRight size={13} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Fingerprint size={28} />}
            title="No investigation cases found"
            description="Adjust your search filters, initiate a new case, or load the seeded NovaPay campaign scenario."
          >
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="button primary" onClick={() => openInvestigation([])}>
                <Plus size={15} /> Create First Case
              </button>
              <button
                className="button secondary"
                onClick={() => {
                  saveDemo(prev => ({ ...prev, investigations: demoInvestigations, reports: demoReports }));
                  notify('Loaded NovaPay coordinated campaign demonstration cases.');
                }}
              >
                <Fingerprint size={15} /> Load NovaPay Incident Scenario
              </button>
            </div>
          </EmptyState>
        )}

        <div className="panel-bottom">
          <span>Showing {filteredInvestigations.length} of {data.investigations.length} investigation cases</span>
          <span>Click any case to enter the full investigation workspace</span>
        </div>
      </section>

      {/* Notice */}
      <div className="notice">
        <Fingerprint size={16} />
        <span>
          <strong>Case Preservation:</strong> All analyst notes, priority adjustments, and linked findings are preserved in the workspace. Evidence reports generate an immutable point-in-time snapshot of the investigation.
        </span>
      </div>
    </div>
  );
}
