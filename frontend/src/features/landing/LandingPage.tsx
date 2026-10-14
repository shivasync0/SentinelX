import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  Crosshair,
  FileText,
  Fingerprint,
  Globe2,
  Network,
  Radar,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const SPACE_VIDEO_URLS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_080021_d598092b-c4c2-4e53-8e46-94cf9064cd50.mp4',
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260418_094631_d30ab262-45ee-4b7d-99f3-5d5848c8ef13.mp4',
] as const;

function BackgroundVideoCrossfade({ sources = SPACE_VIDEO_URLS }: { sources?: readonly string[] }) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [failed, setFailed] = useState<boolean[]>(() => sources.map(() => false));

  useEffect(() => {
    let disposed = false;
    let active = 0;
    let transitionStartedAt = 0;
    let frame = 0;
    const crossfadeMs = 2600;
    const videos = videoRefs.current.filter((video): video is HTMLVideoElement => video !== null);

    videos.forEach((video, index) => {
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      video.style.opacity = index === 0 ? '1' : '0';
    });
    void videos[0]?.play().catch(() => undefined);

    const tick = (now: number) => {
      if (disposed) return;
      const current = videos[active];
      const next = videos[(active + 1) % videos.length];
      if (current && next && videos.length > 1) {
        const duration = Number.isFinite(current.duration) && current.duration > 0 ? current.duration : 14;
        if (!transitionStartedAt && (current.ended || duration - current.currentTime <= crossfadeMs / 1000)) {
          transitionStartedAt = now;
          next.currentTime = 0;
          void next.play().catch(() => undefined);
        }
        if (transitionStartedAt) {
          const progress = Math.min(1, (now - transitionStartedAt) / crossfadeMs);
          current.style.opacity = String(1 - progress);
          next.style.opacity = String(progress);
          if (progress === 1) {
            current.pause();
            active = (active + 1) % videos.length;
            transitionStartedAt = 0;
          }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      videos.forEach(video => video.pause());
    };
  }, [sources]);

  const markFailed = (index: number) => setFailed(previous => previous.map((value, item) => (item === index ? true : value)));
  const allFailed = failed.length > 0 && failed.every(Boolean);
  const videoUnavailable = failed.some(Boolean);

  return (
    <div className="cinematic-video" aria-hidden={videoUnavailable ? undefined : true}>
      {sources.map((source, index) => (
        <video
          key={source}
          ref={video => {
            videoRefs.current[index] = video;
          }}
          className="cinematic-video-layer"
          src={source}
          autoPlay
          muted
          playsInline
          preload="metadata"
          onError={() => markFailed(index)}
        />
      ))}
      <div className={`cinematic-video-scrim ${allFailed ? 'is-fallback' : ''}`} />
      {videoUnavailable && (
        <div className="cinematic-video-fallback" role="status" aria-live="polite">
          <span className="status-dot" />
          {allFailed ? 'Ambient visual unavailable' : 'One ambient visual unavailable'} · Sentinel X remains fully usable.
        </div>
      )}
    </div>
  );
}

// Interactive Hero Graph Node Definition
interface HeroNode {
  id: string;
  name: string;
  type: 'brand' | 'official' | 'social_suspicious' | 'app_suspicious' | 'domain';
  x: number;
  y: number;
  badge: string;
  color: string;
  signals: string[];
  evidence: string;
  score?: number;
}

const HERO_NODES: HeroNode[] = [
  {
    id: 'brand',
    name: 'NovaPay Inc.',
    type: 'brand',
    x: 290,
    y: 190,
    badge: 'PROTECTED BRAND',
    color: '#C6F277',
    signals: ['Baseline identity', '3 registered domains', 'com.novapay.app'],
    evidence: 'Primary protected entity. All exact asset matches are verified and excluded before scoring.',
  },
  {
    id: 'official_social',
    name: '@novapay (Verified)',
    type: 'official',
    x: 120,
    y: 80,
    badge: 'OFFICIAL ASSET',
    color: '#72C9B0',
    signals: ['Exact handle match', 'Verified platform status', 'Registered 2026-09-01'],
    evidence: 'Matches official registry. Excluded from false alarms.',
    score: 0,
  },
  {
    id: 'suspicious_social',
    name: 'NovaPay VIP Club',
    type: 'social_suspicious',
    x: 470,
    y: 75,
    badge: 'CRITICAL THREAT',
    color: '#EF4444',
    signals: ['94% logo perceptual hash', 'Lure: unauthorized token airdrop', 'Outbound link: novapay-verify-auth.example'],
    evidence: 'Uses authentic brand logo on Instagram to direct users into an unverified credential harvesting flow.',
    score: 92,
  },
  {
    id: 'suspicious_app',
    name: 'NovaPay Mobile Wallet',
    type: 'app_suspicious',
    x: 110,
    y: 310,
    badge: 'HIGH RISK APP',
    color: '#EF4444',
    signals: ['Publisher mismatch: Apex Fintech Labs', 'Icon similarity 88%', 'API host: novapay-verify-auth.example'],
    evidence: 'Google Play listing not registered under NovaPay Inc. Collects corporate account logins.',
    score: 88,
  },
  {
    id: 'shared_domain',
    name: 'novapay-verify-auth.example',
    type: 'domain',
    x: 460,
    y: 315,
    badge: 'SHARED DOMAIN INFRASTRUCTURE',
    color: '#E5A84B',
    signals: ['Credential harvesting lure', 'Linked by profile #8 & app #10', 'Registrar: Privacy Shield'],
    evidence: 'Shared infrastructure nexus connecting the social campaign with the malicious mobile app.',
    score: 95,
  },
];

export function LandingPage() {
  const [selectedNode, setSelectedNode] = useState<HeroNode>(HERO_NODES[2]); // Default to suspicious social profile
  const [compareTab, setCompareTab] = useState<'name' | 'logo' | 'publisher' | 'domain'>('name');

  const sources = ['Bluesky · live', 'Apple App Store · live', 'URL verification · live', 'PhishTank · optional', 'URLhaus · optional'];
  const capabilities = [
    {
      Icon: Radar,
      label: '01 / Live observation',
      title: 'Watch public identities as they appear.',
      text: 'Observe a public profile, app, or site URL and preserve the response, redirect path, metadata, domain, and provider at observation time.',
    },
    {
      Icon: Network,
      label: '02 / Evidence graph',
      title: 'Connect the signal to its provenance.',
      text: 'Move from a suspicious identity to brands, official assets, collection sources, and related records without losing the evidence trail.',
    },
    {
      Icon: Fingerprint,
      label: '03 / Analyst workflow',
      title: 'Turn context into a defensible case.',
      text: 'Review deterministic signals, document analyst context, create investigations, and generate reports that are ready to share.',
    },
  ];

  return (
    <div className="cinematic-landing">
      <BackgroundVideoCrossfade />

      {/* Navigation */}
      <header className="cinematic-nav">
        <Link className="cinematic-brand" to="/" aria-label="Sentinel X home">
          <span className="cinematic-brand-mark">
            <Shield size={20} />
          </span>
          <span>
            SENTINEL <b>X</b>
            <small>BRAND PROTECTION INTELLIGENCE</small>
          </span>
        </Link>
        <nav aria-label="Landing navigation">
          <a href="#threat-graph">Live threat graph</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#detection">Detection engine</a>
          <Link to="/demo">Interactive tour</Link>
          <Link to="/app/settings/sources">Source transparency</Link>
          <Link to="/verify">Live verification</Link>
        </nav>
        <Link className="cinematic-nav-cta" to="/overview">
          Command center
        </Link>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="cinematic-hero" aria-labelledby="hero-title">
          <div className="cinematic-hero-inner">
            <div className="cinematic-kicker">
              <span className="status-dot" /> EXTERNAL THREAT INTELLIGENCE
            </div>
            <h1 id="hero-title">
              Your brand is being copied.<br />
              <em>Find out where.</em>
            </h1>
            <h2 className="cinematic-hero-subheading">
              Observe what looks like you.
            </h2>
            <p className="cinematic-hero-lede">
              Impersonating profiles. Fake apps. Connected threats. SENTINEL X turns scattered signals into evidence your security team can act on.
            </p>

            <div className="cinematic-actions">
              <Link className="cinematic-button cinematic-button-primary" to="/app">
                Explore the platform <ArrowRight size={17} />
              </Link>
              <Link className="cinematic-button cinematic-button-ghost" to="/overview">
                Enter command center
              </Link>
              <Link className="cinematic-button cinematic-button-ghost" to="/app/investigations/2">
                See the investigation
              </Link>
              <Link className="cinematic-button cinematic-button-secondary" to="/verify">
                Verify a public URL
              </Link>
            </div>

            {/* Proof of capability row */}
            <div className="hero-proof-row">
              <div className="proof-item">
                <Users size={16} />
                <span>Social identity monitoring</span>
              </div>
              <div className="proof-item">
                <Box size={16} />
                <span>App-store monitoring</span>
              </div>
              <div className="proof-item">
                <ShieldCheck size={16} />
                <span>Official asset protection</span>
              </div>
              <div className="proof-item">
                <Fingerprint size={16} />
                <span>Evidence-linked investigations</span>
              </div>
            </div>

            <div className="cinematic-assurances">
              <span>
                <Check size={14} /> Live provenance
              </span>
              <span>
                <Check size={14} /> Explainable signals
              </span>
              <span>
                <Check size={14} /> Evidence before action
              </span>
            </div>

            <div className="cinematic-stats" aria-label="Sentinel X product scope">
              <div>
                <strong>05</strong>
                <span>source categories named</span>
              </div>
              <div>
                <strong>01</strong>
                <span>official exclusion rule</span>
              </div>
              <div>
                <strong>00</strong>
                <span>black-box verdicts</span>
              </div>
            </div>
          </div>

          {/* Interactive Hero Relationship Graph */}
          <div className="cinematic-hero-aside" id="threat-graph">
            <div className="hero-graph-container">
              <div className="hero-graph-header">
                <div>
                  <span className="eyebrow">INTERACTIVE THREAT TOPOLOGY DEMO</span>
                  <h4>NovaPay Brand Exposure Campaign</h4>
                </div>
                <span className="badge badge-demo">Simulated Scenario</span>
              </div>

              {/* SVG Canvas */}
              <div className="hero-graph-svg-wrap">
                <svg viewBox="0 0 580 400" className="hero-graph-svg">
                  <defs>
                    <linearGradient id="edge-pulse" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#E5A84B" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>

                  {/* Edges */}
                  {/* Brand to Official Asset */}
                  <line x1="290" y1="190" x2="120" y2="80" stroke="#72C9B0" strokeWidth="2" strokeDasharray="3 3" opacity="0.6" />
                  {/* Brand to Suspicious Social */}
                  <line x1="290" y1="190" x2="470" y2="75" stroke="#EF4444" strokeWidth="1.8" opacity="0.4" />
                  {/* Brand to Suspicious App */}
                  <line x1="290" y1="190" x2="110" y2="310" stroke="#EF4444" strokeWidth="1.8" opacity="0.4" />
                  {/* Shared Domain Connections (The Signature Threat Connection) */}
                  <path
                    d="M 470 75 Q 540 190 460 315"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    className="pulse-path"
                  />
                  <path
                    d="M 110 310 C 240 360, 360 350, 460 315"
                    fill="none"
                    stroke="url(#edge-pulse)"
                    strokeWidth="2.5"
                  />

                  {/* Nodes */}
                  {HERO_NODES.map(node => {
                    const isSelected = selectedNode.id === node.id;
                    return (
                      <g
                        key={node.id}
                        className="hero-node"
                        onClick={() => setSelectedNode(node)}
                        style={{ cursor: 'pointer' }}
                      >
                        {isSelected && (
                          <circle cx={node.x} cy={node.y} r={node.type === 'brand' ? 36 : 28} fill="none" stroke="#C6F277" strokeWidth="2.5" opacity="0.8" />
                        )}
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.type === 'brand' ? 30 : 22}
                          fill="#171917"
                          stroke={node.color}
                          strokeWidth={isSelected ? 3 : 1.8}
                        />
                        {/* Node Icons */}
                        {node.type === 'brand' ? (
                          <text x={node.x} y={node.y + 5} textAnchor="middle" fill="#C6F277" fontSize="12" fontWeight="700">NP</text>
                        ) : node.type === 'official' ? (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#72C9B0" fontSize="12">✓</text>
                        ) : node.type === 'domain' ? (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#E5A84B" fontSize="10">www</text>
                        ) : (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#EF4444" fontSize="11">!</text>
                        )}

                        {/* Label Pill */}
                        <rect
                          x={node.x - 65}
                          y={node.y + (node.type === 'brand' ? 36 : 27)}
                          width="130"
                          height="20"
                          rx="4"
                          fill="#171917"
                          stroke="#303430"
                        />
                        <text
                          x={node.x}
                          y={node.y + (node.type === 'brand' ? 50 : 41)}
                          textAnchor="middle"
                          fill="#F0F0E9"
                          fontSize="9.5"
                          fontFamily="monospace"
                        >
                          {node.name.length > 17 ? `${node.name.slice(0, 16)}…` : node.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Node Inspector Box */}
              <div className="hero-node-inspector">
                <div className="inspector-top">
                  <div>
                    <span className="badge" style={{ borderColor: selectedNode.color, color: selectedNode.color }}>
                      {selectedNode.badge}
                    </span>
                    <h3>{selectedNode.name}</h3>
                  </div>
                  {selectedNode.score !== undefined && (
                    <div className="inspector-score">
                      <strong>{selectedNode.score}</strong>
                      <small>/ 100 RISK</small>
                    </div>
                  )}
                </div>
                <p className="inspector-evidence">{selectedNode.evidence}</p>
                <div className="inspector-signals">
                  {selectedNode.signals.map((sig, i) => (
                    <span key={i} className="signal-pill">
                      <Check size={11} /> {sig}
                    </span>
                  ))}
                </div>
                <div className="inspector-footer">
                  <span className="mono">Target: {selectedNode.type}</span>
                  <Link to="/app/threat-graph" className="text-link">
                    Open full graph <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 — THE PROBLEM */}
        <section className="cinematic-section" id="problem">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">THE ATTACK SURFACE</div>
              <h2>
                One brand.<br />
                <em>Hundreds of ways to impersonate it.</em>
              </h2>
            </div>
            <p>
              Adversaries do not only register typo domains. They mimic executive accounts, deploy cloned mobile apps, and orchestrate support fraud across unmonitored channels.
            </p>
          </div>

          <div className="scenarios-grid">
            <article className="scenario-card">
              <div className="scenario-icon">
                <Users size={22} />
              </div>
              <span className="eyebrow">VECTOR 01</span>
              <h3>Fake Support Profiles</h3>
              <p>
                Impersonators monitor brand tags and reply to frustrated customers with direct message links to credential phishing portals.
              </p>
              <div className="scenario-preview">
                <div className="preview-row">
                  <span className="tag-fake">LOOK-ALIKE</span>
                  <strong>@novapaysupport</strong>
                </div>
                <small>&ldquo;Official Nova Pay Customer Support & Dispute Resolution. DM us for account help.&rdquo;</small>
                <span className="preview-diff">Signal: Whitespace split + &ldquo;Support&rdquo; term</span>
              </div>
            </article>

            <article className="scenario-card">
              <div className="scenario-icon">
                <Globe2 size={22} />
              </div>
              <span className="eyebrow">VECTOR 02</span>
              <h3>Copied Company Pages</h3>
              <p>
                Cloned portals using character substitutions (leetspeak) and stolen brand graphics to offer fake token airdrops or VIP benefits.
              </p>
              <div className="scenario-preview">
                <div className="preview-row">
                  <span className="tag-fake">LEETSPEAK</span>
                  <strong>N0vaPay Official</strong>
                </div>
                <small>&ldquo;Official N0vaPay gateway updates and VIP member token airdrops.&rdquo;</small>
                <span className="preview-diff">Signal: Numeral &lsquo;0&rsquo; substitution for &lsquo;o&rsquo;</span>
              </div>
            </article>

            <article className="scenario-card">
              <div className="scenario-icon">
                <Box size={22} />
              </div>
              <span className="eyebrow">VECTOR 03</span>
              <h3>Unauthorized Look-Alike Apps</h3>
              <p>
                Third-party APKs and sideloaded app-store listings that mimic your icon and name while routing corporate credentials to rogue servers.
              </p>
              <div className="scenario-preview">
                <div className="preview-row">
                  <span className="tag-fake">MISMATCH</span>
                  <strong>NovaPay Mobile Wallet</strong>
                </div>
                <small>Publisher: Apex Fintech Labs (Expected: NovaPay Inc.)</small>
                <span className="preview-diff">Signal: Unregistered publisher + 88% icon match</span>
              </div>
            </article>
          </div>
        </section>

        {/* SECTION 2 — DETECTION */}
        <section className="cinematic-section" id="detection">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">DISCRIMINATING EVIDENCE</div>
              <h2>
                Look beyond<br />
                <em>the name.</em>
              </h2>
            </div>
            <p>
              Automated brand protection fails when it relies on string similarity alone. SENTINEL X correlates visual identity, publisher legitimacy, and link graphs to isolate true impersonators.
            </p>
          </div>

          <div className="compare-interactive-panel">
            <div className="compare-tabs">
              <button className={compareTab === 'name' ? 'active' : ''} onClick={() => setCompareTab('name')}>
                Name & Spacing Similarity
              </button>
              <button className={compareTab === 'logo' ? 'active' : ''} onClick={() => setCompareTab('logo')}>
                Logo & Icon Reuse
              </button>
              <button className={compareTab === 'publisher' ? 'active' : ''} onClick={() => setCompareTab('publisher')}>
                Publisher & Developer Check
              </button>
              <button className={compareTab === 'domain' ? 'active' : ''} onClick={() => setCompareTab('domain')}>
                Approved Domain Exclusions
              </button>
            </div>

            <div className="compare-view-grid">
              {/* Official Side */}
              <div className="compare-card official">
                <div className="compare-card-tag">
                  <ShieldCheck size={14} /> VERIFIED OFFICIAL ASSET
                </div>
                <div className="compare-identity">
                  <div className="compare-avatar official-avatar">NP</div>
                  <div>
                    <h4>NovaPay Inc.</h4>
                    <span className="mono">@novapay · com.novapay.app</span>
                  </div>
                </div>
                <div className="compare-details">
                  <div className="detail-line">
                    <label>Publisher:</label>
                    <span>NovaPay Inc. (Registered)</span>
                  </div>
                  <div className="detail-line">
                    <label>Approved Host:</label>
                    <span className="mono">novapay.example</span>
                  </div>
                  <div className="detail-line">
                    <label>Status:</label>
                    <span className="badge badge-verified">Excluded Baseline</span>
                  </div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="compare-vs">
                <span>VS</span>
              </div>

              {/* Candidate Side */}
              <div className="compare-card candidate">
                <div className="compare-card-tag alert">
                  <AlertTriangle size={14} /> FLAGGED THREAT CANDIDATE
                </div>
                <div className="compare-identity">
                  <div className="compare-avatar candidate-avatar">NP!</div>
                  <div>
                    <h4>Nova Pay Support</h4>
                    <span className="mono">@novapaysupport · Apex Fintech Labs</span>
                  </div>
                </div>
                <div className="compare-details">
                  <div className="detail-line">
                    <label>Observed Publisher:</label>
                    <span className="text-red">Apex Fintech Labs (Mismatch)</span>
                  </div>
                  <div className="detail-line">
                    <label>Observed Links:</label>
                    <span className="mono text-red">novapay-verify-auth.example</span>
                  </div>
                  <div className="detail-line">
                    <label>Risk Assessment:</label>
                    <span className="badge badge-critical">Critical Risk · 92/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Signal Explanation */}
            <div className="compare-analysis-strip">
              <span className="analysis-indicator" />
              <strong>
                {compareTab === 'name' && 'DETECTION SIGNAL: Levenshtein distance 0.91 with unapproved credential solicitation keyword.'}
                {compareTab === 'logo' && 'DETECTION SIGNAL: Perceptual hash correlation 0.94 matching trademarked logo.'}
                {compareTab === 'publisher' && 'DETECTION SIGNAL: Developer entity "Apex Fintech Labs" is absent from authorized brand registry.'}
                {compareTab === 'domain' && 'DETECTION SIGNAL: Outbound URL novapay-verify-auth.example does not resolve to an approved corporate domain.'}
              </strong>
            </div>
          </div>
        </section>

        {/* SECTION 3 — THREAT RELATIONSHIPS */}
        <section className="cinematic-section" id="relationships">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">INFRASTRUCTURE GRAPH</div>
              <h2>
                An alert is a signal.<br />
                <em>A connected campaign is a story.</em>
              </h2>
            </div>
            <p>
              When a fake social profile and an unauthorized mobile app point to the same unverified domain, you are not dealing with two isolated nuisances. You are tracking a coordinated attack.
            </p>
          </div>

          <div className="campaign-story-card">
            <div className="story-diagram">
              <div className="story-node profile">
                <Users size={20} />
                <strong>NovaPay VIP Club</strong>
                <span>Instagram Profile</span>
              </div>
              <div className="story-connector">
                <span>links to bio URL</span>
                <ArrowRight size={16} />
              </div>
              <div className="story-node hub">
                <Globe2 size={24} />
                <strong>novapay-verify-auth.example</strong>
                <span className="badge badge-critical">Shared Nexus</span>
              </div>
              <div className="story-connector">
                <ArrowRight size={16} />
                <span>embedded API endpoint</span>
              </div>
              <div className="story-node app">
                <Box size={20} />
                <strong>NovaPay Mobile Wallet</strong>
                <span>Android Package</span>
              </div>
            </div>
            <div className="story-caption">
              <Sparkles size={16} />
              <span>
                <strong>Proven Relationship:</strong> SENTINEL X correlates candidate metadata to reveal shared infrastructure automatically without manual pivots.
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 4 — EXPLAINABLE EVIDENCE */}
        <section className="cinematic-section" id="evidence">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">AUDITABLE SCORING</div>
              <h2>
                Every score<br />
                <em>has a reason.</em>
              </h2>
            </div>
            <p>
              No mystery AI probabilities. Security leaders, fraud analysts, and registrars require deterministic evidence before taking down an asset.
            </p>
          </div>

          <div className="evidence-demo-card">
            <div className="evidence-demo-header">
              <div>
                <span className="eyebrow">AUDITABLE RISK REPORT</span>
                <h3>Candidate #8 — NovaPay VIP Club</h3>
              </div>
              <div className="score-box">
                <strong>0.92</strong>
                <small>RISK SCORE</small>
              </div>
            </div>

            <div className="evidence-table">
              <div className="evidence-row">
                <div className="ev-col">
                  <strong>High-confidence logo reuse (94%)</strong>
                  <span>Visual emblem matches NovaPay trademark perceptual hash</span>
                </div>
                <div className="ev-weight">Weight: 0.45</div>
                <div className="ev-points">+45 pts</div>
              </div>
              <div className="evidence-row">
                <div className="ev-col">
                  <strong>Links to unverified authentication domain</strong>
                  <span>Outbound bio link resolves to novapay-verify-auth.example</span>
                </div>
                <div className="ev-weight">Weight: 0.40</div>
                <div className="ev-points">+40 pts</div>
              </div>
              <div className="evidence-row">
                <div className="ev-col">
                  <strong>Unauthorized token airdrop financial lure</strong>
                  <span>Bio solicits wallet seed phrases for bonus distribution</span>
                </div>
                <div className="ev-weight">Weight: 0.30</div>
                <div className="ev-points">+30 pts</div>
              </div>
              <div className="evidence-row excluded-row">
                <div className="ev-col">
                  <strong>Verified official asset check</strong>
                  <span>Profile handle is NOT present in registered official social accounts</span>
                </div>
                <div className="ev-weight">Weight: 0.00</div>
                <div className="ev-points text-green">NOT EXCLUDED</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 — PROTECT WHAT IS LEGITIMATE */}
        <section className="cinematic-section" id="exclusion">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">TRUST BASELINE</div>
              <h2>
                Know what<br />
                <em>belongs to you.</em>
              </h2>
            </div>
            <p>
              False positives exhaust security teams. SENTINEL X places your verified assets at the center of the engine, automatically excluding approved social handles, mobile IDs, and domains before scoring.
            </p>
          </div>

          <div className="exclusion-demo-grid">
            <div className="exclusion-step">
              <div className="step-num">01</div>
              <h4>Register Official Footprint</h4>
              <p>Onboard official domains, handles (@novapay), and application bundle IDs (com.novapay.app).</p>
            </div>
            <div className="exclusion-step">
              <div className="step-num">02</div>
              <h4>Automatic Pre-Filter</h4>
              <p>Every newly discovered asset is cross-referenced against your verified identity baseline.</p>
            </div>
            <div className="exclusion-step">
              <div className="step-num">03</div>
              <h4>Zero-Score Exclusion</h4>
              <p>Legitimate marketing pages and subdomains are marked &ldquo;VERIFIED&rdquo; with 0 risk score.</p>
            </div>
          </div>
        </section>

        {/* SECTION 6 — INVESTIGATION WORKFLOW */}
        <section className="cinematic-section" id="workflow">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">OPERATIONAL DEFENSE</div>
              <h2>
                From discovery<br />
                <em>to decision.</em>
              </h2>
            </div>
            <p>A unified investigative pipeline designed for rapid case management and defensible takedown reporting.</p>
          </div>

          <div className="workflow-progression">
            <div className="progression-step">
              <div className="prog-icon"><Radar size={18} /></div>
              <span>01 / DISCOVER</span>
              <h4>Continuous Intake</h4>
              <p>Ingest signals across social networks, domain permutations, and mobile markets.</p>
            </div>
            <ChevronRight size={18} className="prog-arrow" />

            <div className="progression-step">
              <div className="prog-icon"><Crosshair size={18} /></div>
              <span>02 / COMPARE</span>
              <h4>Side-by-Side Analysis</h4>
              <p>Compare candidates against verified brand baselines with highlighted differences.</p>
            </div>
            <ChevronRight size={18} className="prog-arrow" />

            <div className="progression-step">
              <div className="prog-icon"><Network size={18} /></div>
              <span>03 / CONNECT</span>
              <h4>Threat Graph</h4>
              <p>Trace shared domains, common publishers, and infrastructure connections.</p>
            </div>
            <ChevronRight size={18} className="prog-arrow" />

            <div className="progression-step">
              <div className="prog-icon"><Fingerprint size={18} /></div>
              <span>04 / INVESTIGATE</span>
              <h4>Case Workspace</h4>
              <p>Organize evidence, document analyst notes, and assign workflow priorities.</p>
            </div>
            <ChevronRight size={18} className="prog-arrow" />

            <div className="progression-step">
              <div className="prog-icon"><FileText size={18} /></div>
              <span>05 / REPORT</span>
              <h4>Defensible Dossier</h4>
              <p>Export auditable JSON, CSV, or PDF reports ready for registrar or platform takedowns.</p>
            </div>
          </div>
        </section>

        {/* Existing Sections for Test & Legacy Compatibility */}
        <section className="cinematic-capabilities" id="capabilities" aria-labelledby="capabilities-title">
          <div className="cinematic-section-heading">
            <div>
              <div className="cinematic-kicker">THE SENTINEL X CAPABILITY LAYER</div>
              <h2 id="capabilities-title">
                From a public signal<br />
                <em>to defensible context.</em>
              </h2>
            </div>
            <p>
              Every observation keeps its source and state visible. Start with what is public, preserve what was observed, and carry context into the workspace.
            </p>
          </div>
          <div className="cinematic-capability-grid">
            {capabilities.map(({ Icon, label, title, text }) => (
              <article className="cinematic-capability-card" key={label}>
                <div className="cinematic-card-top">
                  <span>{label}</span>
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <Link to={label.startsWith('01') ? '/verify' : '/app'} aria-label={`${label}: open Sentinel X`}>
                  <ArrowUpRight size={18} />
                </Link>
              </article>
            ))}
          </div>
          <div className="cinematic-source-row">
            <span>COLLECTION CONTEXT</span>
            {sources.map(source => (
              <span key={source}>{source}</span>
            ))}
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="cinematic-cta-section">
          <div className="cinematic-cta-card">
            <span className="eyebrow">READY TO DEFEND YOUR BRAND</span>
            <h2>Know what is pretending to be you.</h2>
            <p>
              Explore our seeded NovaPay threat campaign, review publisher mismatches, and inspect the shared domain relationship graph.
            </p>
            <div className="cta-buttons">
              <Link className="cinematic-button cinematic-button-primary" to="/app">
                Open the investigation console <ArrowRight size={17} />
              </Link>
              <Link className="cinematic-button cinematic-button-ghost" to="/demo">
                Launch interactive tour
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="cinematic-footer">
        <span>&copy; {new Date().getFullYear()} SENTINEL X · Digital Risk Protection &amp; Threat Intelligence Platform</span>
        <span>
          <Shield size={13} /> Provenance / Evidence / Action · Demo Scenario: NovaPay &amp; Acme Security
        </span>
      </footer>
    </div>
  );
}
