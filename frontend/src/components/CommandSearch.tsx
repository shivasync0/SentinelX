import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Box, FileText, Fingerprint, Globe2, Network, Radar, Search, ShieldCheck, Users, X } from 'lucide-react';
import { useSentinel } from '../App';
import { titleCase } from '../data';

export function CommandSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data, openCandidate } = useSentinel();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Group search results
  const q = query.trim().toLowerCase();
  const candidates = !q ? [] : data.candidates.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.domain && c.domain.toLowerCase().includes(q)) ||
    (c.metadata?.handle && String(c.metadata.handle).toLowerCase().includes(q)) ||
    (c.metadata?.publisher && String(c.metadata.publisher).toLowerCase().includes(q))
  ).slice(0, 5);

  const brands = !q ? [] : data.brands.filter(b =>
    b.name.toLowerCase().includes(q) ||
    b.domains.some(d => d.toLowerCase().includes(q))
  ).slice(0, 3);

  const investigations = !q ? [] : data.investigations.filter(i =>
    i.title.toLowerCase().includes(q) ||
    `SX-${i.id.toString().padStart(4, '0')}`.toLowerCase().includes(q)
  ).slice(0, 3);

  const reports = !q ? [] : data.reports.filter(r =>
    r.title.toLowerCase().includes(q)
  ).slice(0, 3);

  const quickNav = [
    { label: 'Overview Dashboard', path: '/app', icon: Radar, category: 'Navigation' },
    { label: 'Threat Campaign Graph', path: '/app/threat-graph', icon: Network, category: 'Navigation' },
    { label: 'Social Identity Intelligence', path: '/app/social', icon: Users, category: 'Navigation' },
    { label: 'Mobile Application Monitoring', path: '/app/apps', icon: Box, category: 'Navigation' },
    { label: 'Brand Registry & Onboarding', path: '/app/brands', icon: ShieldCheck, category: 'Navigation' },
    { label: 'Interactive Guided Tour', path: '/demo', icon: FileText, category: 'Navigation' },
  ].filter(item => !q || item.label.toLowerCase().includes(q));

  const totalResults = candidates.length + brands.length + investigations.length + reports.length + (q ? 0 : quickNav.length);


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal command-palette" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="command-search-header">
          <Search size={18} className="command-search-icon" />
          <input
            ref={inputRef}
            aria-label="Search all intelligence"
            placeholder="Search candidates, handles, domains, apps, cases, reports…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button className="icon-button" onClick={() => setQuery('')}>
              <X size={15} />
            </button>
          )}
          <kbd>ESC</kbd>
        </div>

        <div className="command-search-body">
          {q && totalResults === 0 && (
            <div className="command-empty">
              <Search size={24} />
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <small>Try searching for NovaPay, support, wallet, or domain name.</small>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="command-group">
              <span className="command-group-title">SUSPICIOUS CANDIDATES & IDENTITIES</span>
              {candidates.map(c => (
                <button
                  key={c.id}
                  className="command-item"
                  onClick={() => {
                    openCandidate(c.id);
                    onClose();
                  }}
                >
                  <div className="command-item-icon">
                    {c.candidate_type === 'social' ? <Users size={15} /> : c.candidate_type === 'app' ? <Box size={15} /> : <Globe2 size={15} />}
                  </div>
                  <div className="command-item-text">
                    <strong>{c.name}</strong>
                    <span>{c.metadata?.handle ? `${c.metadata.handle} · ` : ''}{c.domain ?? c.url ?? titleCase(c.candidate_type)}</span>
                  </div>
                  <span className={`command-badge badge-${c.status}`}>{titleCase(c.candidate_type)}</span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}

          {investigations.length > 0 && (
            <div className="command-group">
              <span className="command-group-title">INVESTIGATION CASES</span>
              {investigations.map(i => (
                <button
                  key={i.id}
                  className="command-item"
                  onClick={() => {
                    navigate(`/app/investigations/${i.id}`);
                    onClose();
                  }}
                >
                  <div className="command-item-icon">
                    <Fingerprint size={15} />
                  </div>
                  <div className="command-item-text">
                    <strong>CASE SX-{i.id.toString().padStart(4, '0')}: {i.title}</strong>
                    <span>{i.candidate_ids.length} linked candidates · Priority: {titleCase(i.priority)}</span>
                  </div>
                  <span className={`command-badge badge-${i.priority}`}>{titleCase(i.priority)}</span>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}

          {brands.length > 0 && (
            <div className="command-group">
              <span className="command-group-title">PROTECTED BRANDS</span>
              {brands.map(b => (
                <button
                  key={b.id}
                  className="command-item"
                  onClick={() => {
                    navigate(`/app/brands/${b.id}`);
                    onClose();
                  }}
                >
                  <div className="command-item-icon">
                    <ShieldCheck size={15} />
                  </div>
                  <div className="command-item-text">
                    <strong>{b.name}</strong>
                    <span>{b.domains.join(', ')} · {b.industry ?? 'Brand'}</span>
                  </div>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}

          {reports.length > 0 && (
            <div className="command-group">
              <span className="command-group-title">INTELLIGENCE REPORTS</span>
              {reports.map(r => (
                <button
                  key={r.id}
                  className="command-item"
                  onClick={() => {
                    navigate(`/app/reports/${r.id}`);
                    onClose();
                  }}
                >
                  <div className="command-item-icon">
                    <FileText size={15} />
                  </div>
                  <div className="command-item-text">
                    <strong>RPT-{r.id.toString().padStart(4, '0')}: {r.title}</strong>
                    <span>{titleCase(r.report_type)} Report</span>
                  </div>
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          )}

          {!q && (
            <div className="command-group">
              <span className="command-group-title">QUICK ACCESS WORKSPACE ROUTES</span>
              {quickNav.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    className="command-item"
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                  >
                    <div className="command-item-icon">
                      <Icon size={15} />
                    </div>
                    <div className="command-item-text">
                      <strong>{item.label}</strong>
                      <span>{item.path}</span>
                    </div>
                    <ArrowRight size={13} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="command-search-footer">
          <span>Navigate with mouse or keyboard</span>
          <span><kbd>ESC</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
}
