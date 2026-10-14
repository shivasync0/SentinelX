import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Crosshair,
  FileText,
  Fingerprint,
  Globe2,
  Network,
  Plus,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Badge, EmptyState, SectionHeading, useSentinel } from '../../App';
import { candidateEvidence, candidateRisk, formatDate, titleCase } from '../../data';

export function InvestigationDetailPage() {
  const { id } = useParams();
  const { data, saveDemo, openCandidate, generateReport, busy, loading, notify } = useSentinel();

  const caseId = Number(id);
  const investigation = data.investigations.find(i => i.id === caseId);

  const [activeTab, setActiveTab] = useState<'overview' | 'evidence' | 'relationships' | 'timeline' | 'notes'>('overview');
  const [notesDraft, setNotesDraft] = useState(investigation?.notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedToLink, setSelectedToLink] = useState<number[]>([]);

  // Recommended next steps state
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    step1: true,
    step2: false,
    step3: false,
  });

  if (!investigation) {
    return (
      <section className="panel p-4">
        <EmptyState
          icon={<Fingerprint size={28} />}
          title="Investigation case not found"
          description="The requested case may belong to another workspace or has been archived."
        >
          <Link to="/app/investigations" className="button secondary">
            Back to investigations
          </Link>
        </EmptyState>
      </section>
    );
  }

  const linkedCandidates = data.candidates.filter(c => investigation.candidate_ids.includes(c.id));
  const brand = data.brands.find(b => b.id === investigation.brand_id) || data.brands[0];
  const caseCode = `CASE SX-${investigation.id.toString().padStart(4, '0')}`;

  // Calculate highest risk among linked candidates
  const highestScore = linkedCandidates.reduce((max, c) => {
    const risk = candidateRisk(c.id, data.scans);
    return Math.max(max, risk.score || 0);
  }, 0);

  const handleStatusChangeInitiate = (newStatus: string) => {
    setPendingStatus(newStatus);
    setShowStatusConfirm(true);
  };

  const confirmStatusChange = () => {
    if (!pendingStatus) return;
    const now = new Date().toISOString();
    const newEvent = {
      id: `tl-${Date.now()}`,
      timestamp: now,
      type: 'status_change' as const,
      actor: 'Jordan Davis (Analyst)',
      description: `Case status changed to ${titleCase(pendingStatus)}.`,
    };

    saveDemo(prev => ({
      ...prev,
      investigations: prev.investigations.map(i =>
        i.id === investigation.id
          ? {
              ...i,
              status: pendingStatus,
              updated_at: now,
              timeline: [...(i.timeline || []), newEvent],
            }
          : i
      ),
    }));

    notify(`Investigation status updated to ${titleCase(pendingStatus)}.`);
    setShowStatusConfirm(false);
    setPendingStatus(null);
  };

  const handlePriorityChange = (newPriority: 'critical' | 'high' | 'medium' | 'low') => {
    const now = new Date().toISOString();
    const newEvent = {
      id: `tl-${Date.now()}`,
      timestamp: now,
      type: 'priority_change' as const,
      actor: 'Jordan Davis (Analyst)',
      description: `Case priority modified to ${titleCase(newPriority)}.`,
    };

    saveDemo(prev => ({
      ...prev,
      investigations: prev.investigations.map(i =>
        i.id === investigation.id
          ? {
              ...i,
              priority: newPriority,
              updated_at: now,
              timeline: [...(i.timeline || []), newEvent],
            }
          : i
      ),
    }));

    notify(`Case priority changed to ${titleCase(newPriority)}.`);
  };

  const handleSaveNotes = () => {
    const now = new Date().toISOString();
    const newEvent = {
      id: `tl-${Date.now()}`,
      timestamp: now,
      type: 'note_added' as const,
      actor: 'Jordan Davis (Analyst)',
      description: 'Analyst case notes updated.',
    };

    saveDemo(prev => ({
      ...prev,
      investigations: prev.investigations.map(i =>
        i.id === investigation.id
          ? {
              ...i,
              notes: notesDraft,
              updated_at: now,
              timeline: [...(i.timeline || []), newEvent],
            }
          : i
      ),
    }));

    setIsEditingNotes(false);
    notify('Analyst case notes updated.');
  };

  const handleLinkCandidates = () => {
    const now = new Date().toISOString();
    const newCandidateIds = [...new Set([...investigation.candidate_ids, ...selectedToLink])];
    const newEvent = {
      id: `tl-${Date.now()}`,
      timestamp: now,
      type: 'candidate_added' as const,
      actor: 'Jordan Davis (Analyst)',
      description: `Linked ${selectedToLink.length} additional candidate findings to case.`,
    };

    saveDemo(prev => ({
      ...prev,
      investigations: prev.investigations.map(i =>
        i.id === investigation.id
          ? {
              ...i,
              candidate_ids: newCandidateIds,
              updated_at: now,
              timeline: [...(i.timeline || []), newEvent],
            }
          : i
      ),
    }));

    notify(`Linked ${selectedToLink.length} candidate(s) to case.`);
    setShowLinkModal(false);
    setSelectedToLink([]);
  };

  const unlinkedCandidates = data.candidates.filter(c => !investigation.candidate_ids.includes(c.id));

  return (
    <div className="investigation-detail-page">
      {/* Top Breadcrumb & Actions */}
      <div className="case-detail-topbar">
        <Link to="/app/investigations" className="text-link">
          <ArrowLeft size={14} /> Investigation cases
        </Link>
        <span className="divider" />
        <span className="mono text-muted">{caseCode}</span>

        <div className="case-top-actions ml-auto">
          <button
            className="button secondary"
            disabled={!!busy || loading}
            onClick={() => void generateReport(investigation)}
          >
            <FileText size={14} /> Generate Evidence Report
          </button>
        </div>
      </div>

      {/* Case Header Hero Card */}
      <div className="panel case-header-panel mb-4">
        <div className="case-header-content">
          <div className="case-header-left">
            <div className="case-header-badges">
              <span className="case-code-pill">{caseCode}</span>
              <Badge value={investigation.priority} />
              <Badge value={investigation.status} />
              <span className="brand-tag-pill">{brand?.name ?? 'Perimeter'}</span>
            </div>
            <h1>{investigation.title}</h1>
            <p className="case-header-summary">
              {investigation.notes || 'No executive summary provided. Use the Notes tab to capture context.'}
            </p>
          </div>

          <div className="case-header-controls">
            <div className="control-box">
              <label>CASE PRIORITY</label>
              <select
                value={investigation.priority}
                onChange={e => handlePriorityChange(e.target.value as 'critical' | 'high' | 'medium' | 'low')}
              >
                <option value="critical">Critical Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div className="control-box">
              <label>CASE STATUS</label>
              <select
                value={investigation.status}
                onChange={e => handleStatusChangeInitiate(e.target.value)}
              >
                <option value="open">Open (Active)</option>
                <option value="in_progress">In Progress</option>
                <option value="under_review">Under Review</option>
                <option value="escalated">Escalated</option>
                <option value="closed">Closed / Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="case-stats-strip">
          <div>
            <span>Linked Candidates:</span>
            <strong>{investigation.candidate_ids.length} entities</strong>
          </div>
          <div>
            <span>Peak Threat Severity:</span>
            <strong className="text-red">{Math.round(highestScore * 100)} / 100</strong>
          </div>
          <div>
            <span>Case Created:</span>
            <span>{formatDate(investigation.created_at)}</span>
          </div>
          <div>
            <span>Last Activity:</span>
            <span>{formatDate(investigation.updated_at || investigation.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="brand-tabs-strip mb-4">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Case Overview
        </button>
        <button
          className={activeTab === 'evidence' ? 'active' : ''}
          onClick={() => setActiveTab('evidence')}
        >
          Linked Evidence ({linkedCandidates.length})
        </button>
        <button
          className={activeTab === 'relationships' ? 'active' : ''}
          onClick={() => setActiveTab('relationships')}
        >
          Threat Relationships Graph
        </button>
        <button
          className={activeTab === 'timeline' ? 'active' : ''}
          onClick={() => setActiveTab('timeline')}
        >
          Audit Timeline ({(investigation.timeline || []).length})
        </button>
        <button
          className={activeTab === 'notes' ? 'active' : ''}
          onClick={() => setActiveTab('notes')}
        >
          Analyst Notes &amp; Decisions
        </button>
      </div>

      {/* TAB 1: Case Overview */}
      {activeTab === 'overview' && (
        <div className="case-tab-content">
          <div className="case-overview-grid">
            {/* Left: Summary & Findings */}
            <div className="panel p-4">
              <SectionHeading
                title="Clustered Threat Findings"
                subtitle="All candidate targets linked to this incident campaign."
              >
                <button className="button secondary small-btn" onClick={() => setShowLinkModal(true)}>
                  <Plus size={14} /> Link Candidate
                </button>
              </SectionHeading>

              <div className="case-candidates-list">
                {linkedCandidates.map(c => {
                  const risk = candidateRisk(c.id, data.scans);
                  const evidence = candidateEvidence(c.id, data.scans);
                  return (
                    <article key={c.id} className="case-candidate-row" onClick={() => openCandidate(c.id)}>
                      <div className="candidate-cell-info">
                        <div className="asset-icon">
                          {c.candidate_type === 'social' ? <Users size={16} /> : c.candidate_type === 'app' ? <Box size={16} /> : <Globe2 size={16} />}
                        </div>
                        <div>
                          <strong>{c.name}</strong>
                          <span className="mono">{c.domain ?? c.url ?? titleCase(c.candidate_type)}</span>
                        </div>
                      </div>
                      <Badge value={risk.label} />
                      <span className="evidence-count-pill">{evidence.length} signals</span>
                      <ArrowRight size={14} />
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Right: Recommended Actions Checklist */}
            <div className="panel p-4 action-checklist-panel">
              <SectionHeading
                title="Recommended Next Steps"
                subtitle="Actionable security and legal operations checklist."
              />

              <div className="checklist-items">
                <label className={`checklist-item ${completedSteps.step1 ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={completedSteps.step1}
                    onChange={e => setCompletedSteps(prev => ({ ...prev, step1: e.target.checked }))}
                  />
                  <div>
                    <strong>Document Forensic Evidence Snapshot</strong>
                    <p>Export auditable JSON and PDF report before adversary rotates infrastructure.</p>
                  </div>
                </label>

                <label className={`checklist-item ${completedSteps.step2 ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={completedSteps.step2}
                    onChange={e => setCompletedSteps(prev => ({ ...prev, step2: e.target.checked }))}
                  />
                  <div>
                    <strong>Issue Registrar Abuse Notice</strong>
                    <p>Submit evidence dossier to domain registrar hosting novapay-verify-auth.example.</p>
                  </div>
                </label>

                <label className={`checklist-item ${completedSteps.step3 ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={completedSteps.step3}
                    onChange={e => setCompletedSteps(prev => ({ ...prev, step3: e.target.checked }))}
                  />
                  <div>
                    <strong>Submit App Store &amp; Platform Takedown</strong>
                    <p>Report package com.novapay.wallet.direct to Google Play trust &amp; safety team.</p>
                  </div>
                </label>
              </div>

              <div className="checklist-footer">
                <button
                  className="button primary full-width"
                  disabled={!!busy || loading}
                  onClick={() => void generateReport(investigation)}
                >
                  <FileText size={15} /> Generate Defensible Evidence Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Linked Evidence */}
      {activeTab === 'evidence' && (
        <div className="case-tab-content">
          <div className="panel p-4">
            <SectionHeading
              title="Auditable Signal Evidence Register"
              subtitle="All detection signals observed across candidates linked to this case."
            />

            <div className="evidence-cards-container">
              {linkedCandidates.map(c => {
                const evidence = candidateEvidence(c.id, data.scans);
                const risk = candidateRisk(c.id, data.scans);
                return (
                  <div key={c.id} className="case-evidence-group-card">
                    <div className="evidence-group-header">
                      <div>
                        <h3>{c.name}</h3>
                        <span className="mono">{c.domain ?? c.url ?? titleCase(c.candidate_type)}</span>
                      </div>
                      <Badge value={risk.label} />
                      <button className="button secondary small-btn ml-auto" onClick={() => openCandidate(c.id)}>
                        Inspect in drawer <ArrowRight size={13} />
                      </button>
                    </div>

                    <div className="evidence-list mt-3">
                      {evidence.map(f => (
                        <div key={f.id} className="evidence-item">
                          <div className="evidence-icon">
                            <Crosshair size={16} />
                          </div>
                          <div>
                            <div className="evidence-title">
                              <h4>{f.signal}</h4>
                              <span className="mono">+{Math.round(f.score_contribution * 100)} pts</span>
                            </div>
                            <p>{f.evidence}</p>
                            <small>{titleCase(f.category)} · Weight {f.weight.toFixed(2)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Scoped Threat Relationships Graph */}
      {activeTab === 'relationships' && (
        <div className="case-tab-content">
          <div className="panel p-4">
            <SectionHeading
              title="Scoped Case Threat Topology"
              subtitle="Infrastructure and relationship graph scoped strictly to entities linked to this case."
            >
              <Link to={`/app/threat-graph?brand=${brand.id}`} className="button secondary small-btn">
                <Network size={14} /> Full Enterprise Graph
              </Link>
            </SectionHeading>

            {/* Scoped Canvas */}
            <div className="scoped-graph-container">
              <svg viewBox="0 0 700 320" className="scoped-graph-svg">
                <defs>
                  <pattern id="case-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="0.8" fill="#303430" opacity="0.6" />
                  </pattern>
                </defs>
                <rect width="700" height="320" fill="url(#case-grid)" />

                {/* Edges */}
                <line x1="120" y1="160" x2="350" y2="80" stroke="#EF4444" strokeWidth="2" strokeDasharray="3 3" />
                <line x1="120" y1="160" x2="350" y2="240" stroke="#EF4444" strokeWidth="2" />
                <path d="M 350 80 Q 480 160 350 240" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="4 4" />
                <line x1="350" y1="80" x2="580" y2="160" stroke="#E5A84B" strokeWidth="2" />
                <line x1="350" y1="240" x2="580" y2="160" stroke="#E5A84B" strokeWidth="2" />

                {/* Nodes */}
                {/* Brand Node */}
                <g>
                  <circle cx="120" cy="160" r="26" fill="#171917" stroke="#C6F277" strokeWidth="2" />
                  <text x="120" y="165" textAnchor="middle" fill="#C6F277" fontSize="10" fontWeight="700">{brand.name.slice(0, 2).toUpperCase()}</text>
                  <text x="120" y="200" textAnchor="middle" fill="#F0F0E9" fontSize="9">{brand.name}</text>
                </g>

                {/* Candidate 8 (VIP Club) */}
                <g>
                  <circle cx="350" cy="80" r="22" fill="#171917" stroke="#EF4444" strokeWidth="2" />
                  <text x="350" y="84" textAnchor="middle" fill="#EF4444" fontSize="10">VIP</text>
                  <text x="350" y="115" textAnchor="middle" fill="#F0F0E9" fontSize="9">NovaPay VIP Club</text>
                </g>

                {/* Candidate 10 (Mobile Wallet) */}
                <g>
                  <circle cx="350" cy="240" r="22" fill="#171917" stroke="#EF4444" strokeWidth="2" />
                  <text x="350" y="244" textAnchor="middle" fill="#EF4444" fontSize="10">APP</text>
                  <text x="350" y="275" textAnchor="middle" fill="#F0F0E9" fontSize="9">NovaPay Mobile Wallet</text>
                </g>

                {/* Shared Domain Nexus */}
                <g>
                  <circle cx="580" cy="160" r="25" fill="#1D201D" stroke="#E5A84B" strokeWidth="2.5" />
                  <text x="580" y="164" textAnchor="middle" fill="#E5A84B" fontSize="9">DOM</text>
                  <text x="580" y="198" textAnchor="middle" fill="#E5A84B" fontSize="9.5" fontWeight="600">novapay-verify-auth.example</text>
                </g>
              </svg>
            </div>

            <div className="case-topology-note">
              <Sparkles size={16} />
              <span>
                <strong>Shared Infrastructure Proved:</strong> The social profile and mobile application both route authentication requests to <em>novapay-verify-auth.example</em>, proving coordination.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Audit Timeline */}
      {activeTab === 'timeline' && (
        <div className="case-tab-content">
          <div className="panel p-4">
            <SectionHeading
              title="Audit Event Timeline"
              subtitle="Immutable chronological history of all case actions and findings."
            />

            <div className="brand-timeline mt-4">
              {(investigation.timeline && investigation.timeline.length > 0) ? (
                investigation.timeline.map((evt, idx) => (
                  <div key={evt.id || idx} className="timeline-event">
                    <span className="time-dot" />
                    <div>
                      <strong>{evt.description}</strong>
                      <p>Actor: {evt.actor}</p>
                      <small>{formatDate(evt.timestamp)}</small>
                    </div>
                  </div>
                ))
              ) : (
                <div className="timeline-event">
                  <span className="time-dot" />
                  <div>
                    <strong>Case Initialized</strong>
                    <p>Case created by analyst Jordan Davis with {investigation.candidate_ids.length} linked candidates.</p>
                    <small>{formatDate(investigation.created_at)}</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Notes & Decisions */}
      {activeTab === 'notes' && (
        <div className="case-tab-content">
          <div className="panel p-4">
            <SectionHeading
              title="Analyst Context &amp; Decision Record"
              subtitle="Preserve context, legal coordination notes, and defensive hypotheses."
            />

            <div className="notes-editor-container mt-3">
              <textarea
                rows={8}
                value={notesDraft}
                onChange={e => {
                  setNotesDraft(e.target.value);
                  setIsEditingNotes(true);
                }}
                placeholder="Enter forensic notes, communications with registrar, or internal escalation log…"
              />

              <div className="notes-actions mt-3">
                <button
                  className="button primary"
                  disabled={!isEditingNotes}
                  onClick={handleSaveNotes}
                >
                  <Save size={15} /> Save Analyst Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Confirmation Modal */}
      {showStatusConfirm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowStatusConfirm(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirm status transition">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">AUDIT DECISION CONFIRMATION</span>
                <h2>Update Case Status</h2>
              </div>
              <button className="icon-button" onClick={() => setShowStatusConfirm(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="investigation-form">
              <p className="modal-instructions">
                Are you sure you want to transition this case from <strong>{titleCase(investigation.status)}</strong> to <strong>{titleCase(pendingStatus || '')}</strong>? This decision will be logged to the immutable audit timeline.
              </p>

              <div className="form-actions">
                <button className="button secondary" onClick={() => setShowStatusConfirm(false)}>
                  Cancel
                </button>
                <button className="button primary" onClick={confirmStatusChange}>
                  Confirm Status Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Candidates Modal */}
      {showLinkModal && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowLinkModal(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Link candidates to case">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">CASE EVIDENCE CLUSTERING</span>
                <h2>Link Additional Candidates</h2>
              </div>
              <button className="icon-button" onClick={() => setShowLinkModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="investigation-form">
              <p className="modal-instructions">
                Select discovered candidates to link to <strong>{caseCode}</strong>.
              </p>

              <div className="candidate-checkboxes" style={{ maxHeight: '260px' }}>
                {unlinkedCandidates.map(c => {
                  const isChecked = selectedToLink.includes(c.id);
                  const risk = candidateRisk(c.id, data.scans);
                  return (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedToLink(prev =>
                            isChecked ? prev.filter(item => item !== c.id) : [...prev, c.id]
                          );
                        }}
                      />
                      <span>
                        <strong>{c.name}</strong>
                        <small className="mono">{c.domain ?? c.url ?? titleCase(c.candidate_type)}</small>
                      </span>
                      <Badge value={risk.label} />
                    </label>
                  );
                })}
              </div>

              <div className="form-actions mt-3">
                <button className="button secondary" onClick={() => setShowLinkModal(false)}>
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={!selectedToLink.length}
                  onClick={handleLinkCandidates}
                >
                  Link {selectedToLink.length} Candidate(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
