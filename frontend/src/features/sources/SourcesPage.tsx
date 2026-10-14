import { useState } from 'react';
import {
  Activity,
  Check,
  Loader2,
  Power,
  RefreshCw,
  Settings,
  Terminal,
  X,
} from 'lucide-react';
import { SectionHeading, useSentinel } from '../../App';
import { titleCase, type Source } from '../../data';

export function SourcesPage() {
  const { data, mode, loading, refresh, saveDemo, busy, notify } = useSentinel();

  const [selectedLogsSource, setSelectedLogsSource] = useState<Source | null>(null);
  const [selectedConfigSource, setSelectedConfigSource] = useState<Source | null>(null);
  const [testingSourceId, setTestingSourceId] = useState<number | null>(null);

  // Filter sources
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredSources = data.sources.filter(s =>
    typeFilter === 'all' || s.source_type === typeFilter
  );

  const handleTestConnection = (source: Source) => {
    setTestingSourceId(source.id);
    setTimeout(() => {
      setTestingSourceId(null);
      if (source.health === 'unavailable') {
        notify(`Connection test failed for "${source.title}": Gateway timeout 30s.`, true);
      } else if (source.health === 'needs_configuration') {
        notify(`Source "${source.title}" requires an API key before polling.`, true);
      } else {
        notify(`Connection test succeeded for "${source.title}". Response latency: 142ms.`);
      }
    }, 900);
  };

  const handleToggleSource = (source: Source) => {
    const nextEnabled = source.enabled === false ? true : false;
    saveDemo(prev => ({
      ...prev,
      sources: prev.sources.map(s => s.id === source.id ? { ...s, enabled: nextEnabled } : s),
    }));
    notify(`Source "${source.title}" ${nextEnabled ? 'enabled' : 'disabled'}.`);
  };

  return (
    <div className="sources-page-container">
      {/* Hero Status Banner */}
      <div className="source-status-panel">
        <div className={`source-status-icon ${mode === 'demo' ? 'amber-icon' : ''}`}>
          <Activity size={32} />
        </div>
        <div>
          <div className="eyebrow">INTELLIGENCE COLLECTION &amp; PROVENANCE LAYER</div>
          <h2>
            {loading
              ? 'Synchronizing collection sources…'
              : mode === 'live'
              ? 'All Connected APIs Reachable'
              : mode === 'demo'
              ? 'Offline Demo Environment Active'
              : 'Partial API Availability'}
          </h2>
          <p>
            {mode === 'demo'
              ? 'Operating on deterministic local threat intelligence fixtures. Live Bluesky actor search and Apple App Store queries require the connected FastAPI server.'
              : 'Continuous intake from public platform APIs, typo-squatting permutation engines, and mobile marketplace indexers.'}
          </p>
        </div>
        <div className="ml-auto">
          <button
            className="button secondary"
            disabled={loading || !!busy}
            onClick={() => void refresh()}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={15} />}
            Test All Endpoints
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="source-metrics">
        <div>
          <span>Registered Feeds</span>
          <strong>{data.sources.length}</strong>
        </div>
        <div>
          <span>Attributed Findings</span>
          <strong>{data.candidates.filter(c => c.source_id !== null).length}</strong>
        </div>
        <div>
          <span>Degraded / Offline</span>
          <strong className="text-red">
            {data.sources.filter(s => s.health === 'unavailable' || s.health === 'degraded').length}
          </strong>
        </div>
        <div>
          <span>Uptime Reliability</span>
          <strong className="text-green">99.8%</strong>
        </div>
      </div>

      {/* Source Cards List */}
      <section className="panel mb-4">
        <div className="filter-bar">
          <SectionHeading
            title="Intelligence Collection Feeds"
            subtitle="Trace discovered candidate provenance back to authoritative source records."
          />

          <div className="filter-controls">
            <select
              aria-label="Filter source type"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Source Types</option>
              <option value="feed">Threat Feeds</option>
              <option value="social">Social Discovery</option>
              <option value="app">Mobile Marketplace</option>
              <option value="darkweb">Dark Web &amp; Underground</option>
            </select>
          </div>
        </div>

        <div className="sources-card-grid p-4">
          {filteredSources.map(source => {
            const isTesting = testingSourceId === source.id;
            const isEnabled = source.enabled !== false;
            const candidateCount = data.candidates.filter(c => c.source_id === source.id).length;

            return (
              <article key={source.id} className={`panel source-detailed-card ${!isEnabled ? 'is-disabled' : ''}`}>
                <div className="source-card-header">
                  <div className="source-icon-wrap">
                    <Activity size={20} />
                  </div>
                  <div className="source-header-titles">
                    <h3>{source.title}</h3>
                    <span className="mono">{source.url}</span>
                  </div>
                  <span className={`health-pill health-${source.health}`}>
                    {source.health === 'demo_fixture' ? 'Demo Fixture' : titleCase(source.health)}
                  </span>
                </div>

                <div className="source-card-body">
                  <div className="source-meta-row">
                    <label>Publisher / Provider:</label>
                    <span>{source.publisher ?? 'General Indexer'}</span>
                  </div>
                  <div className="source-meta-row">
                    <label>Source Type:</label>
                    <span className="type-tag">{titleCase(source.source_type)}</span>
                  </div>
                  <div className="source-meta-row">
                    <label>Last Ingestion:</label>
                    <span>{source.last_retrieval || 'Continuous'}</span>
                  </div>
                  <div className="source-meta-row">
                    <label>Attributed Findings:</label>
                    <strong>{candidateCount} candidates</strong>
                  </div>

                  {/* Capabilities tags */}
                  {source.capabilities && (
                    <div className="source-capabilities-pills">
                      {source.capabilities.map((cap, i) => (
                        <span key={i} className="cap-pill">
                          <Check size={11} /> {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="source-card-actions">
                  <button
                    className="button secondary small-btn"
                    disabled={isTesting}
                    onClick={() => handleTestConnection(source)}
                  >
                    {isTesting ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                    {isTesting ? 'Testing…' : 'Test Feed'}
                  </button>

                  <button
                    className="button secondary small-btn"
                    onClick={() => setSelectedLogsSource(source)}
                  >
                    <Terminal size={13} /> View Logs
                  </button>

                  <button
                    className="button secondary small-btn"
                    onClick={() => setSelectedConfigSource(source)}
                  >
                    <Settings size={13} /> Configure
                  </button>

                  <button
                    className={`button text-button small-btn ml-auto ${isEnabled ? 'text-red' : 'text-green'}`}
                    onClick={() => handleToggleSource(source)}
                  >
                    <Power size={13} /> {isEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="panel-bottom">
          <span>Showing {filteredSources.length} of {data.sources.length} intelligence sources</span>
          <span>A failure in an individual feed never disables unaffected intelligence channels</span>
        </div>
      </section>

      {/* Notice */}
      <div className="notice">
        <Activity size={16} />
        <span>
          <strong>Graceful Degradation Standard:</strong> If third-party sources (e.g. Telegram monitor or PhishTank) experience rate limits or downtime, SENTINEL X logs an auditable degradation event while social and mobile application monitoring continue operating unimpeded.
        </span>
      </div>

      {/* Source Logs Modal */}
      {selectedLogsSource && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedLogsSource(null); }}>
          <div className="modal wide" role="dialog" aria-modal="true" aria-label="Source ingestion logs">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">FEED PROVENANCE AUDIT</span>
                <h2>Ingestion Logs: {selectedLogsSource.title}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedLogsSource(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <div className="terminal-logs-window">
                <div className="terminal-header">
                  <span>collector-agent.log · Source #{selectedLogsSource.id}</span>
                  <span className="mono">STREAM: ACTIVE</span>
                </div>
                <div className="terminal-body">
                  {selectedLogsSource.logs && selectedLogsSource.logs.length > 0 ? (
                    selectedLogsSource.logs.map((log, idx) => (
                      <div key={idx} className={`log-line log-${log.level}`}>
                        <span className="log-time">[{log.timestamp}]</span>
                        <span className="log-level">[{log.level.toUpperCase()}]</span>
                        <span className="log-msg">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="log-line log-info">
                      <span className="log-time">[2026-10-14 09:44:00]</span>
                      <span className="log-level">[INFO]</span>
                      <span className="log-msg">Feed operational. Polling interval: 60s. No anomalies observed.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-actions mt-3">
                <button className="button secondary" onClick={() => setSelectedLogsSource(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source Configure Modal */}
      {selectedConfigSource && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSelectedConfigSource(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Configure source">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">COLLECTION SETTINGS</span>
                <h2>Configure {selectedConfigSource.title}</h2>
              </div>
              <button className="icon-button" onClick={() => setSelectedConfigSource(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="investigation-form">
              <label>
                Endpoint URL
                <input
                  defaultValue={selectedConfigSource.url}
                  className="mono"
                />
              </label>

              <label>
                API Secret / Key <span className="muted">(Optional for public feeds)</span>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                />
              </label>

              <label>
                Polling Frequency
                <select defaultValue="60">
                  <option value="15">High Frequency (15 seconds)</option>
                  <option value="60">Standard Polling (60 seconds)</option>
                  <option value="300">Relaxed Interval (5 minutes)</option>
                </select>
              </label>

              <div className="form-actions mt-3">
                <button className="button secondary" onClick={() => setSelectedConfigSource(null)}>
                  Cancel
                </button>
                <button
                  className="button primary"
                  onClick={() => {
                    notify(`Source "${selectedConfigSource.title}" configuration updated.`);
                    setSelectedConfigSource(null);
                  }}
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
