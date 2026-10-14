import { Link, useParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Network,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import { Badge, EmptyState, useSentinel } from '../../App';
import { formatDate, titleCase, type Candidate, type Finding } from '../../data';

export function ReportDetailPage() {
  const { reportId } = useParams();
  const { data, loading, notify } = useSentinel();

  const report = data.reports.find(r => r.id === Number(reportId));

  if (!report) {
    return (
      <section className="panel p-4">
        <EmptyState
          icon={<FileText size={28} />}
          title={loading ? 'Loading report…' : 'Report not found'}
          description="This report may belong to another workspace or an offline demo session."
        >
          <Link to="/app/reports" className="button secondary">
            Back to report library
          </Link>
        </EmptyState>
      </section>
    );
  }

  const payload = report.payload || {};
  const candidates = Array.isArray(payload.candidates) ? (payload.candidates as Candidate[]) : [];
  const findings = Array.isArray(payload.findings) ? (payload.findings as Finding[]) : [];
  const reportCode = `RPT-${report.id.toString().padStart(4, '0')}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('Report permalink copied to clipboard.');
    } catch {
      notify('Could not access clipboard. Copy URL from address bar.', true);
    }
  };

  const downloadJSON = () => {
    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-x-report-${report.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Report JSON exported (sentinel-x-report-${report.id}.json).`);
  };

  const downloadCSV = () => {
    const headers = ['Candidate ID', 'Name', 'Type', 'Domain/URL', 'Status', 'Signal Count'];
    const rows = candidates.map(c => [
      c.id,
      `"${c.name.replaceAll('"', '""')}"`,
      c.candidate_type,
      `"${(c.domain || c.url || '').replaceAll('"', '""')}"`,
      c.status,
      findings.filter(f => f.candidate_id === c.id).length,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel-x-candidates-${report.id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Candidate CSV exported (sentinel-x-candidates-${report.id}.csv).`);
  };

  return (
    <div className="report-detail-wrapper">
      {/* Top Action Toolbar */}
      <div className="report-detail-toolbar no-print">
        <Link to="/app/reports" className="text-link">
          <ArrowLeft size={14} /> Report library
        </Link>

        <div className="toolbar-actions ml-auto">
          <button className="button secondary" onClick={() => void copyLink()}>
            <Network size={14} /> Copy link
          </button>
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={14} /> Print / Save PDF
          </button>
          <button className="button secondary" onClick={downloadCSV}>
            <FileSpreadsheet size={14} /> Export CSV
          </button>
          <button className="button primary" onClick={downloadJSON}>
            <ArrowDownToLine size={14} /> Download JSON
          </button>
        </div>
      </div>

      {/* Printable Report Document */}
      <article className="panel report-document print-container">
        {/* Document Header */}
        <div className="report-document-top">
          <div className="report-seal">
            <ShieldCheck size={26} className="seal-icon" />
            <div>
              <span className="seal-brand">SENTINEL X</span>
              <small>DIGITAL RISK PROTECTION &amp; THREAT INTELLIGENCE</small>
            </div>
          </div>

          <div className="report-meta-box">
            <span className="mono">{reportCode}</span>
            <Badge
              value={payload.mode === 'offline_demo' ? 'demo' : 'completed'}
              label={payload.mode === 'offline_demo' ? 'Demonstration Snapshot' : 'Auditable Forensic Snapshot'}
            />
          </div>
        </div>

        <div className="report-classification-bar">
          <span>CLASSIFICATION: TLP:AMBER · STRICTLY CONFIDENTIAL</span>
          <span>DOCUMENT REF: SX-DOC-{report.id * 1024}</span>
        </div>

        <div className="report-title-section">
          <span className="eyebrow">{titleCase(report.report_type).toUpperCase()} REPORT</span>
          <h1>{report.title}</h1>
          <div className="report-meta">
            <span>Generated: {formatDate(report.generated_at)}</span>
            <span>Scan Scope: {report.scan_id ? `Scan #${report.scan_id}` : 'General Intelligence'}</span>
            <span>Findings Evaluated: {candidates.length} candidates</span>
            <span>Signals Recorded: {findings.length} signals</span>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="report-body-section">
          <h2>Executive summary</h2>
          <p>
            {typeof payload.summary === 'string'
              ? payload.summary
              : 'This document constitutes an evidence-based forensic dossier documenting digital brand exposure, suspected impersonation infrastructure, and verified baseline asset exclusions.'}
          </p>

          {typeof payload.notes === 'string' && payload.notes && (
            <div className="report-notes">
              <h4>Analyst context</h4>
              <p>{payload.notes}</p>
            </div>
          )}
        </section>

        {/* Candidate Findings Inventory */}
        <section className="report-body-section">
          <h2>Candidate findings inventory</h2>
          {candidates.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Candidate Target</th>
                    <th>Channel / Type</th>
                    <th>Observed Domain / URL</th>
                    <th>Signal Count</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(candidate => (
                    <tr key={candidate.id}>
                      <td>
                        <strong>{candidate.name}</strong>
                      </td>
                      <td>
                        <span className="type-tag">{titleCase(candidate.candidate_type)}</span>
                      </td>
                      <td className="mono">{candidate.domain ?? candidate.url ?? 'Unavailable'}</td>
                      <td>{findings.filter(f => f.candidate_id === candidate.id).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No candidate findings inventory recorded in this snapshot.</p>
          )}
        </section>

        {/* Auditable Evidence Register */}
        <section className="report-body-section">
          <h2>Auditable evidence register</h2>
          {findings.length ? (
            <div className="report-evidence">
              {findings.map((finding, idx) => (
                <div key={`${finding.id}-${idx}`} className="evidence-register-item">
                  <span className="evidence-index">{(idx + 1).toString().padStart(2, '0')}</span>
                  <div className="evidence-content">
                    <h3>
                      <span>{finding.signal}</span>
                      <Badge
                        value={finding.excluded ? 'verified' : 'evidence'}
                        label={finding.excluded ? 'Official Asset Exclusion' : `+${Math.round(finding.score_contribution * 100)} pts`}
                      />
                    </h3>
                    <p>{finding.evidence}</p>
                    <small className="mono">
                      Target #{finding.candidate_id} · Category: {titleCase(finding.category)} · Weight: {finding.weight.toFixed(2)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">No scan signals recorded. Execute a scan to capture detection evidence.</p>
          )}
        </section>

        {/* Verified Exclusion Guarantee */}
        <section className="report-body-section">
          <h2>Verified asset exclusion guarantee</h2>
          <p>
            SENTINEL X enforces strict official asset exclusion precedence. Exact matches to authorized corporate domains, social profiles, and application package identifiers are pre-filtered with a 0-risk score to guarantee zero false alarms on legitimate assets.
          </p>
        </section>

        {/* Payload Inspection */}
        {Object.keys(payload).length > 0 && (
          <details className="metadata no-print mt-4">
            <summary>Inspect Complete Machine-Readable Payload</summary>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </details>
        )}

        {/* Document Footer */}
        <div className="report-document-footer">
          <div>
            <strong>SENTINEL X Threat Intelligence Platform</strong>
            <span>Point-in-time forensic assessment · Report #{report.id}</span>
          </div>
          <span className="mono">Generated for Enterprise Risk Operations</span>
        </div>
      </article>

      {/* Notice */}
      <div className="notice no-print mt-4">
        <FileText size={16} />
        <span>
          <strong>Audit Ready:</strong> This report can be exported as JSON for ingestion into SIEM / SOAR platforms or saved as PDF for submission to domain registrars and mobile app stores.
        </span>
      </div>
    </div>
  );
}
