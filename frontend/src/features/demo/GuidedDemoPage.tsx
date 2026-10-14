import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  Fingerprint,
  Network,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useSentinel } from '../../App';

export function GuidedDemoPage() {
  const { openCandidate } = useSentinel();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'step-1',
      tag: 'STEP 01 / TRUST BASELINE',
      title: 'Official Asset Registry & Automatic Exclusion',
      subtitle: 'The defining principle of SENTINEL X: You cannot detect what is fake until you define what is legitimate.',
      summary:
        'NovaPay has registered its official website (novapay.example), verified social profile (@novapay), and application bundle ID (com.novapay.app). When scans execute, exact matches are pre-filtered and marked VERIFIED with a 0-risk score.',
      insight: 'Official asset exclusion takes precedence before scoring. Legitimate corporate channels are never flagged as threats.',
      targetRoute: '/app/brands/3',
      targetLabel: 'View NovaPay brand profile',
      visualType: 'exclusion',
    },
    {
      id: 'step-2',
      tag: 'STEP 02 / SOCIAL IMPERSONATION',
      title: 'Detecting Look-Alikes: Spacing & Leetspeak Variations',
      subtitle: 'Adversaries evade simple keyword filters using whitespace manipulation and character substitutions.',
      summary:
        'SENTINEL X has discovered two suspicious profiles impersonating NovaPay: "Nova Pay Support" (spacing variation soliciting account credentials) and "N0vaPay Official" (leetspeak numeral 0 substitution offering unauthorized token airdrops).',
      insight: 'Our detection engine calculates string distance, highlights character substitutions, and flags unapproved credential solicitations.',
      targetRoute: '/app/social',
      targetLabel: 'Explore social monitoring',
      visualType: 'social',
      candidateId: 6,
    },
    {
      id: 'step-3',
      tag: 'STEP 03 / MOBILE APP INTELLIGENCE',
      title: 'Publisher Mismatch & Icon Cloning in App Stores',
      subtitle: 'A convincing app listing can steal credentials if users believe it is an authorized wallet.',
      summary:
        'Candidate #10 ("NovaPay Mobile Wallet") uses NovaPay branding and a 88% matching icon, but its registered developer is "Apex Fintech Labs"—not the registered publisher "NovaPay Inc." Furthermore, its login API routes to an unverified domain.',
      insight: 'Comparing developer names against authorized publisher registries eliminates fraudulent apps before they infect enterprise devices.',
      targetRoute: '/app/apps',
      targetLabel: 'View app intelligence',
      visualType: 'app',
      candidateId: 10,
    },
    {
      id: 'step-4',
      tag: 'STEP 04 / THREAT RELATIONSHIP GRAPH',
      title: 'Shared Domain Nexus: Connecting Scattered Signals into a Campaign',
      subtitle: 'An alert is a signal. A connected campaign is a story.',
      summary:
        'When viewing Candidate #8 (Instagram VIP Club) and Candidate #10 (Mobile Wallet) in the Threat Graph, SENTINEL X highlights their shared link to "novapay-verify-auth.example". This proves they are not isolated copycats, but a coordinated credential-harvesting campaign.',
      insight: 'Graph relationships distinguish coincidental name similarities from documented infrastructure sharing.',
      targetRoute: '/app/threat-graph',
      targetLabel: 'Open interactive threat graph',
      visualType: 'graph',
    },
    {
      id: 'step-5',
      tag: 'STEP 05 / CASE WORKSPACE & DOSSIER',
      title: 'From Evidence to Defensible Takedown Dossier',
      subtitle: 'Organize related findings into a case and export auditable reports.',
      summary:
        'In Case SX-0002 ("NovaPay coordinated VIP & Wallet impersonation campaign"), analysts have clustered the Instagram profile, the mobile app, and the credential gateway. The case preserves audit logs, notes, and can be exported as an evidence-rich PDF or JSON report.',
      insight: 'Reports include exact signal weights, perceptual hash scores, and source provenance ready for legal or registrar action.',
      targetRoute: '/app/investigations/2',
      targetLabel: 'Open Case SX-0002 workspace',
      visualType: 'investigation',
    },
  ];

  const step = steps[currentStep];

  return (
    <div className="guided-demo-page">
      {/* Top Header */}
      <header className="guided-demo-header">
        <div className="guided-demo-header-left">
          <Link to="/app" className="text-link">
            <ArrowLeft size={14} /> Back to console
          </Link>
          <span className="divider" />
          <div className="guided-demo-badge">
            <Sparkles size={14} />
            <span>INTERACTIVE PRODUCT TOUR</span>
          </div>
        </div>
        <div className="guided-demo-controls">
          <span className="mono">
            Tour Step {currentStep + 1} of {steps.length}
          </span>
          <button
            className="button secondary"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(prev => prev - 1)}
          >
            Previous
          </button>
          <button
            className="button primary"
            onClick={() => {
              if (currentStep < steps.length - 1) {
                setCurrentStep(prev => prev + 1);
              } else {
                navigate('/app');
              }
            }}
          >
            {currentStep < steps.length - 1 ? (
              <>
                Next step <ArrowRight size={14} />
              </>
            ) : (
              <>
                Enter console <Check size={14} />
              </>
            )}
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="tour-progress-bar">
        {steps.map((s, idx) => (
          <button
            key={s.id}
            className={`progress-tab ${idx === currentStep ? 'active' : idx < currentStep ? 'completed' : ''}`}
            onClick={() => setCurrentStep(idx)}
          >
            <span className="progress-num">{idx + 1}</span>
            <span className="progress-label">{s.title.split(':')[0]}</span>
          </button>
        ))}
      </div>

      {/* Main Tour Grid */}
      <div className="tour-content-grid">
        {/* Left Explanation Column */}
        <div className="panel tour-explanation-panel">
          <div className="eyebrow">{step.tag}</div>
          <h2>{step.title}</h2>
          <p className="tour-subtitle">{step.subtitle}</p>

          <div className="tour-body-text">
            <p>{step.summary}</p>
          </div>

          <div className="tour-insight-box">
            <ShieldCheck size={18} />
            <div>
              <strong>KEY SENTINEL X ADVANTAGE</strong>
              <p>{step.insight}</p>
            </div>
          </div>

          <div className="tour-action-row">
            <Link to={step.targetRoute} className="button primary">
              {step.targetLabel} <ArrowUpRight size={15} />
            </Link>
            {step.candidateId && (
              <button
                className="button secondary"
                onClick={() => openCandidate(step.candidateId!)}
              >
                Inspect Candidate #{step.candidateId}
              </button>
            )}
          </div>
        </div>

        {/* Right Interactive Visual Simulation */}
        <div className="panel tour-visual-panel">
          {step.visualType === 'exclusion' && (
            <div className="visual-demo-exclusion">
              <div className="visual-header">
                <ShieldCheck size={18} />
                <span>Verified Exclusion Precedence Matrix</span>
              </div>
              <div className="visual-table">
                <div className="vis-row head">
                  <span>Registered Brand Asset</span>
                  <span>Discovered Candidate</span>
                  <span>Exclusion Decision</span>
                </div>
                <div className="vis-row verified">
                  <div>
                    <strong>https://novapay.example</strong>
                    <small>Official Domain</small>
                  </div>
                  <div>
                    <strong>novapay.example</strong>
                    <small>Observed Web Target</small>
                  </div>
                  <span className="badge badge-verified">VERIFIED · 0 RISK</span>
                </div>
                <div className="vis-row verified">
                  <div>
                    <strong>@novapay</strong>
                    <small>Registered Social</small>
                  </div>
                  <div>
                    <strong>@novapay</strong>
                    <small>Discovered Candidate #13</small>
                  </div>
                  <span className="badge badge-verified">EXCLUDED BASELINE</span>
                </div>
                <div className="vis-row threat">
                  <div>
                    <strong>@novapay</strong>
                    <small>Official Handle</small>
                  </div>
                  <div>
                    <strong className="text-red">@novapaysupport</strong>
                    <small>Discovered Candidate #6</small>
                  </div>
                  <span className="badge badge-critical">THREAT · 91/100</span>
                </div>
              </div>
            </div>
          )}

          {step.visualType === 'social' && (
            <div className="visual-demo-social">
              <div className="visual-header">
                <Users size={18} />
                <span>Text Difference &amp; Impersonation Breakdown</span>
              </div>
              <div className="diff-comparison-card">
                <div className="diff-block">
                  <span className="label">OFFICIAL BRAND:</span>
                  <div className="token-display">
                    <span className="token good">NovaPay</span>
                  </div>
                </div>
                <div className="diff-divider">VS</div>
                <div className="diff-block">
                  <span className="label">SUSPICIOUS CANDIDATE #6:</span>
                  <div className="token-display">
                    <span className="token alert">Nova</span>
                    <span className="token space">[SPACE]</span>
                    <span className="token alert">Pay</span>
                    <span className="token add">+ Support</span>
                  </div>
                </div>
                <div className="diff-metrics">
                  <div>
                    <label>String Similarity:</label>
                    <strong>91%</strong>
                  </div>
                  <div>
                    <label>Logo Match:</label>
                    <strong>76%</strong>
                  </div>
                  <div>
                    <label>Risk:</label>
                    <span className="badge badge-high">High Risk</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step.visualType === 'app' && (
            <div className="visual-demo-app">
              <div className="visual-header">
                <Box size={18} />
                <span>Publisher &amp; Package Inspection</span>
              </div>
              <div className="app-compare-widget">
                <div className="app-item official">
                  <span className="app-tag good">OFFICIAL APP</span>
                  <h4>NovaPay Mobile Banking</h4>
                  <p className="mono">Package: com.novapay.app</p>
                  <div className="app-pub">
                    <label>Publisher:</label>
                    <span>NovaPay Inc. (Authorized)</span>
                  </div>
                </div>
                <div className="app-item candidate">
                  <span className="app-tag alert">FLAGGED APP #10</span>
                  <h4>NovaPay Mobile Wallet</h4>
                  <p className="mono">Package: com.novapay.wallet.direct</p>
                  <div className="app-pub mismatch">
                    <label>Publisher:</label>
                    <span className="text-red">Apex Fintech Labs (MISMATCH)</span>
                  </div>
                </div>
              </div>
              <div className="app-alert-banner">
                <AlertTriangle size={16} />
                <span>
                  <strong>Publisher Mismatch Triggered:</strong> Developer is not in NovaPay approved developer list. Icon similarity 88%.
                </span>
              </div>
            </div>
          )}

          {step.visualType === 'graph' && (
            <div className="visual-demo-graph">
              <div className="visual-header">
                <Network size={18} />
                <span>Shared Domain Threat Nexus (Interactive Preview)</span>
              </div>
              <div className="mini-graph-canvas">
                <svg viewBox="0 0 460 240" className="mini-svg">
                  {/* Edges */}
                  <line x1="100" y1="60" x2="230" y2="120" stroke="#EF4444" strokeWidth="2" strokeDasharray="3 3" />
                  <line x1="100" y1="180" x2="230" y2="120" stroke="#EF4444" strokeWidth="2" />
                  <line x1="360" y1="120" x2="230" y2="120" stroke="#72C9B0" strokeWidth="1.5" strokeDasharray="2 2" />

                  {/* Nodes */}
                  <g>
                    <circle cx="100" cy="60" r="18" fill="#171917" stroke="#EF4444" strokeWidth="2" />
                    <text x="100" y="64" textAnchor="middle" fill="#EF4444" fontSize="9">VIP</text>
                    <text x="100" y="92" textAnchor="middle" fill="#F0F0E9" fontSize="9">NovaPay VIP Club</text>
                  </g>
                  <g>
                    <circle cx="100" cy="180" r="18" fill="#171917" stroke="#EF4444" strokeWidth="2" />
                    <text x="100" y="184" textAnchor="middle" fill="#EF4444" fontSize="9">APP</text>
                    <text x="100" y="212" textAnchor="middle" fill="#F0F0E9" fontSize="9">Mobile Wallet</text>
                  </g>
                  <g>
                    <circle cx="230" cy="120" r="24" fill="#1D201D" stroke="#E5A84B" strokeWidth="2.5" />
                    <text x="230" y="124" textAnchor="middle" fill="#E5A84B" fontSize="9">DOM</text>
                    <text x="230" y="158" textAnchor="middle" fill="#E5A84B" fontSize="9" fontWeight="600">novapay-verify-auth.example</text>
                  </g>
                  <g>
                    <circle cx="360" cy="120" r="20" fill="#171917" stroke="#72C9B0" strokeWidth="2" />
                    <text x="360" y="124" textAnchor="middle" fill="#72C9B0" fontSize="9">NP</text>
                    <text x="360" y="152" textAnchor="middle" fill="#72C9B0" fontSize="9">NovaPay Inc.</text>
                  </g>
                </svg>
              </div>
              <div className="graph-explanation-banner">
                <Sparkles size={14} />
                <span>
                  <strong>Connected Campaign:</strong> Both Candidate #8 and #10 share unverified infrastructure.
                </span>
              </div>
            </div>
          )}

          {step.visualType === 'investigation' && (
            <div className="visual-demo-investigation">
              <div className="visual-header">
                <Fingerprint size={18} />
                <span>Case SX-0002 Threat Dossier Preview</span>
              </div>
              <div className="case-preview-card">
                <div className="case-head">
                  <span className="badge badge-critical">CRITICAL PRIORITY</span>
                  <span className="badge badge-open">STATUS: OPEN</span>
                </div>
                <h3>NovaPay coordinated VIP &amp; Wallet impersonation campaign</h3>
                <p>
                  High-severity coordinated campaign. Mobile app &ldquo;NovaPay Mobile Wallet&rdquo; and Instagram profile &ldquo;NovaPay VIP Club&rdquo; route authentication flows to &ldquo;novapay-verify-auth.example&rdquo;.
                </p>
                <div className="case-stats">
                  <div>
                    <strong>3</strong>
                    <span>Linked findings</span>
                  </div>
                  <div>
                    <strong>0.92</strong>
                    <span>Risk score</span>
                  </div>
                  <div>
                    <strong>4</strong>
                    <span>Audit events</span>
                  </div>
                </div>
                <div className="case-actions-preview">
                  <Link to="/app/investigations/2" className="button primary full-width">
                    Open Case SX-0002 Workspace <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
