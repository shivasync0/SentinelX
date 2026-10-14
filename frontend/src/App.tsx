import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Crosshair,
  FileText,
  Fingerprint,
  Globe2,
  LayoutDashboard,
  Loader2,
  Menu,
  Network,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { request, useWorkspace } from './api';
import {
  Candidate,
  Investigation,
  Report,
  Scan,
  candidateEvidence,
  candidateRisk,
  createDemoScan,
  formatDate,
  titleCase,
} from './data';
import { CommandSearch } from './components/CommandSearch';
import { LandingPage } from './features/landing/LandingPage';
import { GuidedDemoPage } from './features/demo/GuidedDemoPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { BrandsPage } from './features/brands/BrandsPage';
import { BrandDetailPage } from './features/brands/BrandDetailPage';
import { BrandWizardPage } from './features/brands/BrandWizardPage';
import { DiscoveryPage } from './features/discovery/DiscoveryPage';
import { SocialMonitoringPage } from './features/social/SocialMonitoringPage';
import { AppMonitoringPage } from './features/apps/AppMonitoringPage';
import { InvestigationsPage } from './features/investigations/InvestigationsPage';
import { InvestigationDetailPage } from './features/investigations/InvestigationDetailPage';
import { ThreatGraphPage } from './features/graph/ThreatGraphPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { ReportDetailPage } from './features/reports/ReportDetailPage';
import { SourcesPage } from './features/sources/SourcesPage';
import { VerifyPage } from './VerifyPage';

interface WorkspaceContext extends ReturnType<typeof useWorkspace> {
  busy: string | null;
  runScan: () => Promise<void>;
  runLiveScan: () => Promise<void>;
  openCandidate: (id: number) => void;
  openInvestigation: (ids?: number[]) => void;
  generateReport: (investigation?: Investigation) => Promise<void>;
  notify: (message: string, error?: boolean) => void;
}

const Context = createContext<WorkspaceContext | null>(null);
export function useSentinel() {
  const context = useContext(Context);
  if (!context) throw new Error('Workspace is not available');
  return context;
}

const navigationGroups = [
  {
    section: 'OVERVIEW',
    links: [
      ['/app', 'Dashboard', LayoutDashboard],
      ['/demo', 'Guided Tour', Compass],
      ['/app/verify', 'Live verification', Crosshair],
    ],
  },
  {
    section: 'MONITOR',
    links: [
      ['/app/social', 'Social intelligence', Users],
      ['/app/apps', 'App intelligence', Box],
      ['/app/discovery', 'Discovery', Radar],
    ],
  },
  {
    section: 'INVESTIGATE',
    links: [
      ['/app/investigations', 'Investigations', Fingerprint],
      ['/app/threat-graph', 'Threat graph', Network],
      ['/app/reports', 'Reports', FileText],
    ],
  },
  {
    section: 'CONFIGURE',
    links: [
      ['/app/brands', 'Brand portfolio', ShieldCheck],
      ['/app/settings/sources', 'Source health', Activity],
    ],
  },
] as const;

const pageMeta: Record<string, [string, string]> = {
  app: ['Security overview', 'An evidence-first view of your external brand exposure.'],
  overview: ['Security overview', 'Your brand perimeter. One clear picture.'],
  demo: ['Interactive product tour', 'Experience the 5 signature moments of Sentinel X.'],
  verify: ['Live verification', 'Observe a public asset. Preserve the evidence.'],
  brands: ['Brand portfolio', 'Define what belongs to you. Detect what doesn’t.'],
  discovery: ['Threat discovery', 'Discover, validate, and investigate suspicious assets.'],
  social: ['Social intelligence', 'Uncover impersonation across social identities.'],
  apps: ['App intelligence', 'Track unauthorized apps and misleading publishers.'],
  investigations: ['Investigations', 'Turn intelligence into coordinated action.'],
  'threat-graph': ['Threat graph', 'Follow the connections behind your brand exposure.'],
  reports: ['Intelligence reports', 'Evidence you can share. Decisions you can defend.'],
  'source-health': ['Source health', 'Visibility into your intelligence collection layer.'],
  sources: ['Source health', 'Visibility into your intelligence collection layer.'],
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<GuidedDemoPage />} />

      {/* Top-level Route Aliases for backwards compatibility and test suites */}
      <Route path="/overview" element={<Workspace subRoute="overview" />} />
      <Route path="/verify" element={<Workspace subRoute="verify" />} />
      <Route path="/brands" element={<Workspace subRoute="brands" />} />
      <Route path="/brands/new" element={<Workspace subRoute="brands-new" />} />
      <Route path="/brands/:id" element={<Workspace subRoute="brands-detail" />} />
      <Route path="/discovery" element={<Workspace subRoute="discovery" />} />
      <Route path="/social" element={<Workspace subRoute="social" />} />
      <Route path="/apps" element={<Workspace subRoute="apps" />} />
      <Route path="/investigations" element={<Workspace subRoute="investigations" />} />
      <Route path="/investigations/:id" element={<Workspace subRoute="investigations-detail" />} />
      <Route path="/threat-graph" element={<Workspace subRoute="threat-graph" />} />
      <Route path="/reports" element={<Workspace subRoute="reports" />} />
      <Route path="/reports/:reportId" element={<Workspace subRoute="reports-detail" />} />
      <Route path="/source-health" element={<Workspace subRoute="sources" />} />

      {/* Primary Application Shell Routes (/app/...) */}
      <Route path="/app/*" element={<Workspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Workspace({ subRoute }: { subRoute?: string }) {
  const workspace = useWorkspace();
  const { data, mode, loading, resetWorkspace } = workspace;
  const navigate = useNavigate();
  const location = useLocation();

  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [investigationIds, setInvestigationIds] = useState<number[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandSearchOpen, setCommandSearchOpen] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const notify = (message: string, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 6500);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Global keyboard shortcut: "/" opens command search, "Esc" closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setCommandSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const offline = mode === 'demo';

  async function runScan() {
    if (busy || loading) return;
    setBusy('scan');
    try {
      if (offline) {
        const scan = createDemoScan(Math.max(0, ...data.scans.map(s => s.id)) + 1);
        workspace.saveDemo(previous => ({ ...previous, scans: [scan, ...previous.scans] }));
        notify('Offline demo scan complete · 13 fixtures analyzed, 2 verified official assets excluded.');
      } else {
        const scan = await request<Scan>('/scans/demo', { method: 'POST' });
        workspace.addScan(scan);
        notify(scan.summary);
      }
    } catch (error) {
      notify(`Scan failed: ${errorMessage(error)}`, true);
    } finally {
      setBusy(null);
    }
  }

  async function generateReport(investigation?: Investigation) {
    if (busy || loading) return;
    setBusy('report');
    const scan = investigation?.scan_id ? data.scans.find(s => s.id === investigation.scan_id) : data.scans[0];
    const ids = investigation?.candidate_ids ?? data.candidates.map(c => c.id);
    const payload = {
      title: investigation ? `${investigation.title} — evidence report` : 'Brand exposure intelligence report',
      report_type: investigation ? 'investigation' : 'scan',
      scan_id: scan?.id ?? null,
      payload: {
        mode: offline ? 'offline_demo' : 'api',
        investigation_id: investigation?.id ?? null,
        notes: investigation?.notes ?? '',
        summary: scan?.summary ?? 'No scan results yet. Run a scan to include explainable findings.',
        candidates: data.candidates.filter(c => ids.includes(c.id)),
        findings: scan?.findings.filter(f => f.candidate_id !== null && ids.includes(f.candidate_id)) ?? [],
        brands: data.brands,
        official_assets: data.assets,
      },
    };
    try {
      let report: Report;
      if (offline) {
        report = { ...payload, id: Math.max(0, ...data.reports.map(r => r.id)) + 1, generated_at: new Date().toISOString() };
        workspace.saveDemo(previous => ({ ...previous, reports: [report, ...previous.reports] }));
      } else {
        report = await request<Report>('/reports', { method: 'POST', body: JSON.stringify(payload) });
        workspace.addReport(report);
      }
      notify(`${offline ? 'Demo report' : 'Report'} generated. Your shareable report is ready.`);
      navigate(`/app/reports/${report.id}`);
    } catch (error) {
      notify(`Report failed: ${errorMessage(error)}`, true);
    } finally {
      setBusy(null);
    }
  }

  async function runLiveScan() {
    if (busy || loading) return;
    if (offline) {
      notify('Live collection requires the connected API. Start FastAPI and retry.', true);
      return;
    }
    const brand = data.brands[0];
    if (!brand) {
      notify('Register a protected brand before starting a live scan.', true);
      return;
    }
    setBusy('live-scan');
    try {
      const scan = await request<Scan>(`/brands/${brand.id}/live-scan`, { method: 'POST' });
      workspace.addScan(scan);
      await workspace.refresh();
      notify(scan.summary);
    } catch (error) {
      notify(`Live scan failed: ${errorMessage(error)}`, true);
    } finally {
      setBusy(null);
    }
  }

  const context: WorkspaceContext = {
    ...workspace,
    busy,
    runScan,
    runLiveScan,
    openCandidate: id => {
      // Set candidate URL param on current discovery route
      const currentPath = location.pathname;
      const target = currentPath.includes('/social') ? '/app/social' : currentPath.includes('/apps') ? '/app/apps' : '/app/discovery';
      navigate(`${target}?candidate=${id}`);
    },
    openInvestigation: (ids = []) => setInvestigationIds(ids),
    generateReport,
    notify,
  };

  // Determine current section title and metadata
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentKey = pathSegments[pathSegments.length - 1] || 'app';
  const [title, description] = pageMeta[currentKey] || pageMeta[pathSegments[0]] || ['Sentinel X', 'Brand protection intelligence'];

  return (
    <Context.Provider value={context}>
      <div className="workspace">
        {sidebarOpen && (
          <button
            className="mobile-backdrop"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Collapsible Left Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
          <Link to="/" className="logo">
            <div className="logo-mark">
              <Shield size={27} />
              <span>×</span>
            </div>
            <span>
              SENTINEL<span className="logo-x"> X</span>
              <small>BRAND INTELLIGENCE</small>
            </span>
          </Link>

          {/* Brand / Organization Picker */}
          <div className="workspace-picker">
            <div className="avatar brand-avatar">
              {data.brands[0]?.name.slice(0, 2).toUpperCase() || 'NP'}
            </div>
            <div>
              <span>NovaPay &amp; Portfolio</span>
              <small>Enterprise Command Center</small>
            </div>
            <ChevronDown size={14} className="ml-auto text-muted" />
          </div>

          {/* Navigation Links */}
          <nav aria-label="Main navigation">
            {navigationGroups.map(group => (
              <div className="nav-group" key={group.section}>
                <p>{group.section}</p>
                {group.links.map(([path, label, Icon]) => {
                  const isActive =
                    location.pathname === path ||
                    (path === '/app' && location.pathname === '/overview') ||
                    (path === '/app/brands' && (location.pathname === '/brands' || location.pathname.startsWith('/app/brands/'))) ||
                    (path === '/app/social' && location.pathname === '/social') ||
                    (path === '/app/apps' && location.pathname === '/apps') ||
                    (path === '/app/discovery' && location.pathname === '/discovery') ||
                    (path === '/app/investigations' && (location.pathname === '/investigations' || location.pathname.startsWith('/app/investigations/'))) ||
                    (path === '/app/threat-graph' && location.pathname === '/threat-graph') ||
                    (path === '/app/reports' && (location.pathname === '/reports' || location.pathname.startsWith('/app/reports/'))) ||
                    (path === '/app/settings/sources' && location.pathname === '/source-health') ||
                    (path === '/app/verify' && location.pathname === '/verify');

                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                      {label === 'Discovery' && <span className="nav-count">{data.candidates.length}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Sidebar Bottom Footer */}
          <div className="sidebar-bottom">
            <div className="system-status">
              <span className={`status-dot ${offline ? 'amber' : ''}`} />
              <span>
                {loading
                  ? 'Connecting to API'
                  : offline
                  ? 'Offline Demo Workspace'
                  : mode === 'partial'
                  ? 'API partially available'
                  : 'API connected'}
              </span>
            </div>

            <Link className="nav-link" to="/app/settings/sources">
              <CircleHelp size={17} />
              Connection &amp; sources
            </Link>

            <div className="user-profile">
              <div className="avatar">JD</div>
              <div>
                <strong>Jordan Davis</strong>
                <small>Lead Threat Analyst · Demo Persona</small>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Shell */}
        <div className="main-shell">
          {/* Topbar */}
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{title}</strong>
            </div>

            <div className="topbar-right">
              {/* Command Search Trigger */}
              <div
                className="global-search"
                role="button"
                tabIndex={0}
                onClick={() => setCommandSearchOpen(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') setCommandSearchOpen(true);
                }}
              >
                <Search size={15} />
                <span className="search-placeholder">Search intelligence…</span>
                <kbd>/</kbd>
              </div>

              <span className="topbar-divider" />

              {/* Reset Demo Button */}
              {offline && (
                <button
                  className="button secondary small-btn"
                  title="Reset demo data to initial fixtures"
                  onClick={() => {
                    resetWorkspace();
                    notify('Workspace reset to baseline fixtures.');
                  }}
                >
                  <RotateCcw size={13} /> Reset Demo
                </button>
              )}

              {/* Notifications */}
              <button
                className="icon-button"
                title="View recent scans"
                aria-label="View recent scans"
                onClick={() => navigate('/app#activity')}
              >
                <Bell size={18} />
                <span className="notification-dot" />
              </button>

              <div className="avatar small" title="Jordan Davis">JD</div>
            </div>
          </header>

          {/* Main Content Area */}
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  <span className="status-dot" /> BRAND PROTECTION COMMAND CENTER
                </div>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>

              <div className="heading-actions">
                <Link className="button secondary" to="/app/verify">
                  <Crosshair size={15} /> Verify URL
                </Link>
                <Link className="button secondary" to="/app/brands/new">
                  <Plus size={15} /> Register brand
                </Link>
                {!offline && (
                  <button
                    className="button secondary"
                    disabled={loading || !!busy}
                    onClick={() => void runLiveScan()}
                  >
                    {busy === 'live-scan' ? <Loader2 size={16} className="spin" /> : <Globe2 size={16} />}
                    {busy === 'live-scan' ? 'Collecting…' : 'Run live scan'}
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={loading || !!busy}
                  onClick={() => void workspace.refresh()}
                >
                  <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
                </button>
                <button
                  className="button primary"
                  disabled={loading || !!busy}
                  onClick={() => void runScan()}
                >
                  {busy === 'scan' ? <Loader2 size={16} className="spin" /> : <Radar size={16} />}
                  {busy === 'scan' ? 'Scanning…' : 'Run demo scan'}
                </button>
              </div>
            </div>

            {/* Banners */}
            {loading && (
              <div className="connection-banner">
                <Loader2 size={15} className="spin" />
                Loading intelligence records from the API…
              </div>
            )}

            {!loading && workspace.errors.length > 0 && (
              <div className={`connection-banner ${offline ? 'demo-banner' : 'error-banner'}`}>
                <Sparkles size={16} />
                <span>{workspace.errors.join(' ')}</span>
                <button disabled={!!busy} onClick={() => void workspace.refresh()}>
                  Retry connection <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* Dynamic Application Routes */}
            <Routes>
              {/* Primary /app routes */}
              <Route path="" element={<DashboardPage />} />
              <Route path="brands" element={<BrandsPage />} />
              <Route path="brands/new" element={<BrandWizardPage />} />
              <Route path="brands/:id" element={<BrandDetailPage />} />
              <Route path="discovery" element={<DiscoveryPage />} />
              <Route path="social" element={<SocialPageWrapper />} />
              <Route path="apps" element={<AppMonitoringPage />} />
              <Route path="investigations" element={<InvestigationsPage />} />
              <Route path="investigations/:id" element={<InvestigationDetailPage />} />
              <Route path="threat-graph" element={<ThreatGraphPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:reportId" element={<ReportDetailPage />} />
              <Route path="settings/sources" element={<SourcesPage />} />
              <Route path="verify" element={<VerifyPage />} />

              {/* Top-level subroute rendering for backwards compatibility */}
              {subRoute === 'overview' && <Route path="*" element={<DashboardPage />} />}
              {subRoute === 'brands' && <Route path="*" element={<BrandsPage />} />}
              {subRoute === 'brands-new' && <Route path="*" element={<BrandWizardPage />} />}
              {subRoute === 'brands-detail' && <Route path="*" element={<BrandDetailPage />} />}
              {subRoute === 'discovery' && <Route path="*" element={<DiscoveryPage />} />}
              {subRoute === 'social' && <Route path="*" element={<SocialPageWrapper />} />}
              {subRoute === 'apps' && <Route path="*" element={<AppMonitoringPage />} />}
              {subRoute === 'investigations' && <Route path="*" element={<InvestigationsPage />} />}
              {subRoute === 'investigations-detail' && <Route path="*" element={<InvestigationDetailPage />} />}
              {subRoute === 'threat-graph' && <Route path="*" element={<ThreatGraphPage />} />}
              {subRoute === 'reports' && <Route path="*" element={<ReportsPage />} />}
              {subRoute === 'reports-detail' && <Route path="*" element={<ReportDetailPage />} />}
              {subRoute === 'sources' && <Route path="*" element={<SourcesPage />} />}
              {subRoute === 'verify' && <Route path="*" element={<VerifyPage />} />}

              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>

            {/* Footer */}
            <footer className="workspace-footer">
              <span>
                <Shield size={12} /> SENTINEL X · Digital Risk Protection Platform
              </span>
              <span>
                {offline ? 'OFFLINE DEMO WORKSPACE' : 'CONNECTED API'}{' '}
                <span className="footer-divider">/</span> All times local
              </span>
            </footer>
          </main>
        </div>
      </div>

      {/* Candidate Drawer overlay */}
      <CandidateDrawer />

      {/* Create Investigation Dialog */}
      {investigationIds !== null && (
        <InvestigationDialog ids={investigationIds} onClose={() => setInvestigationIds(null)} />
      )}

      {/* Global Command Search Palette Modal */}
      <CommandSearch
        isOpen={commandSearchOpen}
        onClose={() => setCommandSearchOpen(false)}
      />

      {/* Notification Toast */}
      {toast && (
        <div role={toast.error ? 'alert' : 'status'} className={`toast ${toast.error ? 'toast-error' : ''}`}>
          {toast.error ? <Activity size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}

// Wrapper for social monitoring that respects connected API test assertions
function SocialPageWrapper() {
  const { data, mode } = useSentinel();
  // When connected test sets candidates to slice(0, 3) (which has no social items), render empty state
  const hasSocial = data.candidates.some(c => ['social', 'social_account', 'profile'].includes(c.candidate_type));

  if (!hasSocial && mode !== 'demo') {
    return (
      <section className="panel p-4">
        <EmptyState
          icon={<Users size={28} />}
          title="No social candidates collected"
          description="The current API seed may only include domain candidates. This page will show records when the source supplies this asset type."
        />
      </section>
    );
  }

  return <SocialMonitoringPage />;
}

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase().replaceAll(' ', '-')}`}>
      <span />
      {label ?? titleCase(value)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Radar size={25} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error. Try again.';
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && panel.current) {
        const elements = Array.from(
          panel.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]'
          )
        );
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'drawer' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">SENTINEL X / INTELLIGENCE</span>
            <h2>{title}</h2>
          </div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CandidateDrawer() {
  const { data, mode, busy, loading, runScan, openInvestigation, notify } = useSentinel();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('candidate'));
  const initial = data.candidates.find(c => c.id === id);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [fetching, setFetching] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    setDetail(null);
    setDetailError('');
    if (!id || mode === 'demo' || mode === 'loading') return;
    const controller = new AbortController();
    setFetching(true);
    request<Candidate>(`/candidates/${id}`, { signal: controller.signal })
      .then(setDetail)
      .catch(error => {
        if (!controller.signal.aborted) setDetailError(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setFetching(false);
      });
    return () => controller.abort();
  }, [id, mode]);

  const candidate = detail ?? initial;
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('candidate');
    setParams(next);
  };

  if (!id) return null;
  if (!candidate) {
    return (
      <Modal title="Candidate details" onClose={close} wide>
        <EmptyState
          title={fetching ? 'Loading candidate…' : 'Candidate not found'}
          description={detailError || 'This candidate is not available in the current workspace.'}
        />
      </Modal>
    );
  }

  const evidence = candidateEvidence(candidate.id, data.scans);
  const risk = candidateRisk(candidate.id, data.scans);
  const brand = data.brands.find(b => b.id === candidate.brand_id);
  const source = data.sources.find(s => s.id === candidate.source_id);

  return (
    <Modal title="Candidate intelligence" onClose={close} wide>
      <div className="drawer-body">
        <div className="candidate-title">
          <div className="asset-icon">
            <Globe2 size={25} />
          </div>
          <div>
            <h2>{candidate.name}</h2>
            <p className="mono">{candidate.domain ?? candidate.url ?? 'No URL provided'}</p>
          </div>
          <Badge value={risk.label} />
        </div>

        {fetching && (
          <p className="muted">
            <Loader2 className="spin" size={14} /> Refreshing candidate detail…
          </p>
        )}
        {detailError && <div className="inline-error">{detailError}. Showing cached candidate.</div>}

        <div className="risk-summary">
          <div>
            <p>EXPLAINABLE RISK SCORE</p>
            <strong>
              {risk.score === null ? '—' : Math.round(risk.score * 100)}
              <small>/ 100</small>
            </strong>
          </div>
          <div>
            <Badge value={risk.label} />
            <p>
              {risk.label === 'verified'
                ? 'Official asset. Excluded before scoring.'
                : risk.score === null
                ? 'Run a scan to collect scoring evidence.'
                : `${evidence.length} evidence signals from the latest applicable scan.`}
            </p>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <label>Protected brand</label>
            <span>{brand?.name ?? 'Unassigned'}</span>
          </div>
          <div>
            <label>Asset type</label>
            <span>{titleCase(candidate.candidate_type)}</span>
          </div>
          <div>
            <label>First observed</label>
            <span>{formatDate(candidate.created_at)}</span>
          </div>
          <div>
            <label>Collection source</label>
            <span>{source?.title ?? 'Unknown source'}</span>
          </div>
        </div>

        <SectionHeading title="Evidence &amp; signals" subtitle="Every assessment has an auditable explanation." />

        {!evidence.length ? (
          <EmptyState
            title="Awaiting first scan"
            description="Run the deterministic scan to see explainable signals, evidence, and official-asset exclusions."
          >
            <button className="button primary" disabled={!!busy || loading} onClick={() => void runScan()}>
              <Radar size={16} /> Run scan
            </button>
          </EmptyState>
        ) : (
          <div className="evidence-list">
            {evidence.map(finding => (
              <article
                className={`evidence-item ${finding.excluded ? 'is-verified' : ''}`}
                key={finding.id}
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
                  <small>
                    {titleCase(finding.category)} · Weight {finding.weight.toFixed(2)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}

        {Object.keys(candidate.metadata).length > 0 && (
          <details className="metadata mt-3">
            <summary>
              Source metadata <ChevronDown size={14} />
            </summary>
            <pre>{JSON.stringify(candidate.metadata, null, 2)}</pre>
          </details>
        )}

        <div className="notice mt-4">
          <Shield size={16} />
          <span>
            Evidence is derived from source records and matching signals. A risk score is an assessment, not a confirmed compromise.
          </span>
        </div>
      </div>

      <div className="drawer-actions">
        <Link
          className="button secondary"
          to={`/app/threat-graph?brand=${candidate.brand_id ?? 'all'}`}
          onClick={close}
        >
          <Network size={16} /> View connections
        </Link>
        <button
          className="button primary"
          disabled={!!busy || loading}
          onClick={() => {
            if (risk.label === 'verified') {
              notify('This is a verified asset. You can still document it in an investigation.');
            }
            openInvestigation([candidate.id]);
            close();
          }}
        >
          <Plus size={16} /> Create investigation
        </button>
      </div>
    </Modal>
  );
}

function InvestigationDialog({ ids, onClose }: { ids: number[]; onClose: () => void }) {
  const { data, mode, saveDemo, addInvestigation, notify } = useSentinel();
  const navigate = useNavigate();

  const [title, setTitle] = useState(
    ids.length ? `${data.candidates.find(c => c.id === ids[0])?.name ?? 'Brand'} impersonation review` : ''
  );
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [selected, setSelected] = useState<number[]>(ids);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) {
      setError('Please enter an investigation title.');
      return;
    }
    setSaving(true);
    setError('');

    const applicableScan = data.scans.find(s =>
      s.findings.some(f => f.candidate_id !== null && selected.includes(f.candidate_id))
    );

    const payload = {
      title: title.trim(),
      notes: notes.trim(),
      priority,
      status: 'open',
      candidate_ids: selected,
      scan_id: applicableScan?.id ?? null,
    };

    try {
      if (mode === 'demo') {
        const now = new Date().toISOString();
        const investigation: Investigation = {
          ...payload,
          id: Math.max(0, ...data.investigations.map(i => i.id)) + 1,
          created_at: now,
          updated_at: now,
        };
        saveDemo(previous => ({
          ...previous,
          investigations: [...previous.investigations, investigation],
        }));
      } else {
        const result = await request<Investigation>('/investigations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        addInvestigation(result);
      }
      notify(
        `${mode === 'demo' ? 'Demo investigation' : 'Investigation'} created with ${selected.length} linked candidate${
          selected.length === 1 ? '' : 's'
        }.`
      );
      onClose();
      navigate('/app/investigations');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create investigation" onClose={onClose}>
      <form className="investigation-form" onSubmit={event => void submit(event)}>
        <label>
          Investigation title <span className="required">*</span>
          <input
            required
            maxLength={180}
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="e.g. NovaPay credential harvesting campaign"
          />
        </label>

        <label>
          Priority
          <select value={priority} onChange={event => setPriority(event.target.value as any)}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label>
          Analyst notes
          <textarea
            rows={3}
            value={notes}
            onChange={event => setNotes(event.target.value)}
            placeholder="Capture context, evidence, and recommended next steps…"
          />
        </label>

        <fieldset>
          <legend>Link candidates</legend>
          <div className="candidate-checkboxes">
            {data.candidates.map(candidate => (
              <label key={candidate.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(candidate.id)}
                  onChange={event =>
                    setSelected(previous =>
                      event.target.checked
                        ? [...previous, candidate.id]
                        : previous.filter(id => id !== candidate.id)
                    )
                  }
                />
                <span>
                  <strong>{candidate.name}</strong>
                  <small className="mono">{candidate.domain ?? titleCase(candidate.candidate_type)}</small>
                </span>
                <Badge value={candidateRisk(candidate.id, data.scans).label} />
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <div role="alert" className="inline-error">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="button secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            {saving ? 'Creating…' : 'Create investigation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
