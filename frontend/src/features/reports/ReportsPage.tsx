import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { EmptyState, useSentinel } from '../../App';
import { formatDate, titleCase } from '../../data';

export function ReportsPage() {
  const { data, generateReport, busy, loading } = useSentinel();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredReports = data.reports.filter(r => {
    const matchesQuery = !query || r.title.toLowerCase().includes(query.toLowerCase());
    const matchesType = typeFilter === 'all' || r.report_type === typeFilter;
    return matchesQuery && matchesType;
  });

  return (
    <div className="reports-page-container">
      {/* Hero */}
      <div className="channel-hero report-hero">
        <div className="channel-hero-icon green-icon">
          <FileText size={28} />
        </div>
        <div>
          <span className="eyebrow text-muted">INTELLIGENCE DOSSIER LIBRARY</span>
          <h2>Defensible Evidence Reports</h2>
          <p>
            Generate and export auditable intelligence snapshots, registrar takedown packets, and executive brand exposure dossiers.
          </p>
        </div>
        <div className="heading-actions ml-auto">
          <button
            className="button primary"
            disabled={!!busy || loading}
            onClick={() => void generateReport()}
          >
            <Plus size={15} /> Generate New Exposure Report
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <section className="panel mb-4">
        <div className="filter-bar">
          <div className="input-search">
            <Search size={15} />
            <input
              placeholder="Search reports by title or case number…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="filter-controls">
            <SlidersHorizontal size={14} />
            <select
              aria-label="Filter report type"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Report Formats</option>
              <option value="investigation">Investigation Dossiers</option>
              <option value="scan">Perimeter Scan Summaries</option>
              <option value="exposure">Brand Exposure Assessments</option>
            </select>
          </div>
        </div>

        {/* Reports Table */}
        {filteredReports.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Report Title &amp; Document ID</th>
                  <th>Classification</th>
                  <th>Linked Scan / Scope</th>
                  <th>Generated Timestamp</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(report => (
                  <tr key={report.id}>
                    <td>
                      <Link className="table-name report-name" to={`/app/reports/${report.id}`}>
                        <div className="asset-icon">
                          <FileText size={16} />
                        </div>
                        <div>
                          <strong>{report.title}</strong>
                          <small className="mono">RPT-{report.id.toString().padStart(4, '0')}</small>
                        </div>
                      </Link>
                    </td>

                    <td>
                      <span className="type-tag">{titleCase(report.report_type)}</span>
                    </td>

                    <td>
                      {report.scan_id ? `Scan #${report.scan_id}` : 'General Intelligence'}
                    </td>

                    <td className="nowrap muted">{formatDate(report.generated_at)}</td>

                    <td>
                      <Link className="button secondary small-btn" to={`/app/reports/${report.id}`}>
                        Open Report <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FileText size={28} />}
            title="No intelligence reports found"
            description="Run a scan or export an investigation case to generate your first auditable dossier."
          >
            <button className="button primary" onClick={() => void generateReport()}>
              <Plus size={15} /> Generate First Report
            </button>
          </EmptyState>
        )}

        <div className="panel-bottom">
          <span>Showing {filteredReports.length} of {data.reports.length} generated reports</span>
          <span>Point-in-time forensic snapshots</span>
        </div>
      </section>

      {/* Notice */}
      <div className="notice">
        <FileText size={16} />
        <span>
          <strong>Evidence Export Standard:</strong> Every report includes candidate evidence signals, perceptual hash correlation values, registered official asset exclusions, and analyst notes. Reports are exportable to JSON, CSV, and printable PDF.
        </span>
      </div>
    </div>
  );
}
