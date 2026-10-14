export interface Brand {
  id: number;
  name: string;
  canonical_name: string;
  domains: string[];
  description: string | null;
  industry?: string;
  logo?: string;
  created_at: string;
}

export interface Asset {
  id: number;
  brand_id: number;
  asset_type: 'domain' | 'social' | 'mobile_app' | 'support_portal' | string;
  name: string;
  url: string;
  status: 'verified' | 'unverified' | string;
  identifier?: string | null;
  publisher?: string | null;
  fingerprint?: string | null;
  verified_at?: string | null;
}

export interface CandidateMetadata {
  demo?: boolean;
  official?: boolean;
  verified_match?: boolean;
  platform?: string;
  handle?: string;
  followers?: number;
  description?: string;
  original_url?: string;
  store?: string;
  publisher?: string;
  official_publisher?: string;
  publisher_mismatch?: boolean;
  store_identifier?: string;
  official_identifier?: string;
  name_similarity?: number;
  logo_similarity?: number;
  icon_similarity?: number;
  description_similarity?: number;
  diff_type?: 'spacing' | 'leetspeak' | 'logo_reuse' | 'publisher_mismatch' | 'domain_lure' | string;
  diff_explanation?: string;
  unapproved_links?: string[];
  linked_domains?: { domain: string; evidence: string }[];
  review_decision?: 'legitimate' | 'suspicious' | 'dismissed' | 'pending';
  dismiss_reason?: string;
  analyst_note?: string;
  [key: string]: unknown;
}

export interface Candidate {
  id: number;
  brand_id: number | null;
  source_id: number | null;
  name: string;
  normalized_name: string;
  candidate_type: 'phishing' | 'domain' | 'social' | 'app' | 'mobile_app' | 'login' | string;
  domain: string | null;
  url: string | null;
  status: 'new' | 'under_review' | 'suspicious' | 'legitimate' | 'dismissed' | string;
  metadata: CandidateMetadata;
  created_at: string;
}

export interface Finding {
  id: number;
  candidate_id: number | null;
  category: 'identity' | 'domain' | 'intent' | 'social' | 'app' | 'official_asset' | 'infrastructure' | string;
  signal: string;
  evidence: string;
  weight: number;
  score_contribution: number;
  excluded: boolean;
}

export interface Scan {
  id: number;
  target: string;
  status: string;
  deterministic: boolean;
  score: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'verified' | string;
  summary: string;
  started_at: string;
  completed_at: string;
  findings: Finding[];
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'scan' | 'candidate_added' | 'status_change' | 'priority_change' | 'note_added';
  actor: string;
  description: string;
}

export interface Investigation {
  id: number;
  title: string;
  status: 'open' | 'in_progress' | 'under_review' | 'escalated' | 'closed' | string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  notes: string;
  scan_id: number | null;
  candidate_ids: number[];
  brand_id?: number | null;
  timeline?: TimelineEvent[];
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: number;
  title: string;
  report_type: 'investigation' | 'scan' | 'exposure' | string;
  scan_id: number | null;
  payload: Record<string, unknown>;
  generated_at: string;
}

export interface SourceLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface Source {
  id: number;
  title: string;
  url: string;
  publisher: string | null;
  source_type: 'feed' | 'social' | 'app' | 'web' | 'darkweb' | string;
  trust_level: 'high' | 'medium' | 'unknown' | 'demo' | string;
  health: 'connected' | 'demo_fixture' | 'degraded' | 'unavailable' | 'needs_configuration';
  capabilities: string[];
  last_retrieval?: string;
  enabled?: boolean;
  logs?: SourceLog[];
  created_at: string;
}

export interface GraphNode {
  id: string;
  type: 'brand' | 'official_asset' | 'candidate' | 'source' | 'domain' | 'publisher';
  label: string;
  risk?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'owns' | 'related' | 'reported' | 'shared_domain' | 'similar_logo' | 'lookalike_name' | 'links_to';
  evidence?: string;
  domain?: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Dataset {
  brands: Brand[];
  assets: Asset[];
  candidates: Candidate[];
  scans: Scan[];
  investigations: Investigation[];
  reports: Report[];
  sources: Source[];
  graph: Graph;
}

const created = '2026-10-13T08:30:00Z';
const updated = '2026-10-14T08:45:00Z';

export const demoBrands: Brand[] = [
  {
    id: 1,
    name: 'Acme Security',
    canonical_name: 'Acme Security',
    domains: ['acme.security', 'acmesecurity.com'],
    description: 'Enterprise identity security & zero-trust perimeter · Monitored brand',
    industry: 'Cybersecurity',
    logo: 'AS',
    created_at: created,
  },
  {
    id: 2,
    name: 'Northstar Cloud',
    canonical_name: 'Northstar Cloud',
    domains: ['northstar.cloud'],
    description: 'Cloud infrastructure & Kubernetes orchestration platform · Monitored brand',
    industry: 'Cloud Infrastructure',
    logo: 'NC',
    created_at: created,
  },
  {
    id: 3,
    name: 'NovaPay',
    canonical_name: 'NovaPay',
    domains: ['novapay.example', 'novapay.io', 'support.novapay.example'],
    description: 'Global digital banking, instant payment rails & merchant APIs · Featured enterprise brand',
    industry: 'Fintech & Digital Banking',
    logo: 'NP',
    created_at: created,
  },
];

export const demoAssets: Asset[] = [
  { id: 1, brand_id: 1, asset_type: 'domain', name: 'Acme Security', url: 'https://acme.security', status: 'verified', fingerprint: 'demo-acme-web' },
  { id: 2, brand_id: 1, asset_type: 'social', name: 'Acme Security Official', url: 'https://social.example/acmesecurity', status: 'verified', fingerprint: 'demo-acme-social' },
  { id: 3, brand_id: 2, asset_type: 'domain', name: 'Northstar Cloud', url: 'https://northstar.cloud', status: 'verified', fingerprint: 'demo-northstar-web' },
  { id: 4, brand_id: 3, asset_type: 'domain', name: 'NovaPay Primary Portal', url: 'https://novapay.example', status: 'verified', fingerprint: 'demo-novapay-web', verified_at: '2026-09-01T00:00:00Z' },
  { id: 5, brand_id: 3, asset_type: 'social', name: 'NovaPay Official (@novapay)', url: 'https://social.example/novapay', status: 'verified', identifier: '@novapay', fingerprint: 'demo-novapay-social', verified_at: '2026-09-01T00:00:00Z' },
  { id: 6, brand_id: 3, asset_type: 'mobile_app', name: 'NovaPay Mobile Banking', url: 'https://apps.example/store/novapay-app', status: 'verified', identifier: 'com.novapay.app', publisher: 'NovaPay Inc.', fingerprint: 'demo-novapay-app', verified_at: '2026-09-01T00:00:00Z' },
  { id: 7, brand_id: 3, asset_type: 'support_portal', name: 'NovaPay Verified Support', url: 'https://support.novapay.example', status: 'verified', fingerprint: 'demo-novapay-support', verified_at: '2026-09-01T00:00:00Z' },
];

export const demoCandidates: Candidate[] = [
  {
    id: 1,
    brand_id: 1,
    source_id: 1,
    name: 'Acme Secur1ty',
    normalized_name: 'acmesecur1ty',
    candidate_type: 'phishing',
    domain: 'acme-security-login.com',
    url: 'https://acme-security-login.com',
    status: 'new',
    metadata: { demo: true },
    created_at: created,
  },
  {
    id: 2,
    brand_id: 1,
    source_id: 1,
    name: 'Acme Security',
    normalized_name: 'acmesecurity',
    candidate_type: 'domain',
    domain: 'acme.security',
    url: 'https://acme.security',
    status: 'new',
    metadata: { demo: true, official: true },
    created_at: created,
  },
  {
    id: 3,
    brand_id: 2,
    source_id: 1,
    name: 'Northst4r Cloud',
    normalized_name: 'northst4rcloud',
    candidate_type: 'login',
    domain: 'northstar-cloud-auth.com',
    url: 'https://northstar-cloud-auth.com',
    status: 'new',
    metadata: { demo: true },
    created_at: created,
  },
  {
    id: 4,
    brand_id: 1,
    source_id: 2,
    name: 'Acme Support Center',
    normalized_name: 'acmesupportcenter',
    candidate_type: 'social',
    domain: null,
    url: 'https://social.example/acme_helpdesk',
    status: 'new',
    metadata: { demo: true, platform: 'Social network', followers: 1240, description: 'Unofficial customer support account requesting login credentials.' },
    created_at: created,
  },
  {
    id: 5,
    brand_id: 2,
    source_id: 3,
    name: 'Northstar Authenticator',
    normalized_name: 'northstarauthenticator',
    candidate_type: 'app',
    domain: null,
    url: 'https://apps.example/northstar-auth',
    status: 'new',
    metadata: { demo: true, publisher: 'NS Cloud Tools', platform: 'Android', description: 'Illustrative app listing using the monitored brand name.' },
    created_at: created,
  },
  // NovaPay Fictional Scenario Entities (Section 20)
  {
    id: 6,
    brand_id: 3,
    source_id: 2,
    name: 'Nova Pay Support',
    normalized_name: 'novapaysupport',
    candidate_type: 'social',
    domain: 'social.example',
    url: 'https://social.example/novapaysupport',
    status: 'new',
    metadata: {
      demo: true,
      platform: 'X / Twitter',
      handle: '@novapaysupport',
      followers: 3420,
      description: 'Official Nova Pay Customer Support & Dispute Resolution. DM us for instant account recovery.',
      original_url: 'https://social.example/novapaysupport',
      name_similarity: 0.91,
      logo_similarity: 0.76,
      diff_type: 'spacing',
      diff_explanation: "Whitespace split between 'Nova' and 'Pay' with generic customer support suffix.",
      unapproved_links: ['https://novapay-verify-auth.example/help'],
    },
    created_at: updated,
  },
  {
    id: 7,
    brand_id: 3,
    source_id: 2,
    name: 'N0vaPay Official',
    normalized_name: 'n0vapayofficial',
    candidate_type: 'social',
    domain: 'social.example',
    url: 'https://social.example/n0vapay_official',
    status: 'new',
    metadata: {
      demo: true,
      platform: 'Bluesky',
      handle: '@n0vapay_official',
      followers: 890,
      description: 'Official N0vaPay gateway updates and VIP member token airdrops.',
      original_url: 'https://social.example/n0vapay_official',
      name_similarity: 0.88,
      logo_similarity: 0.65,
      diff_type: 'leetspeak',
      diff_explanation: "Character substitution: numeral '0' substituted for letter 'o'.",
      unapproved_links: ['https://airdrop-claim-now.example'],
    },
    created_at: updated,
  },
  {
    id: 8,
    brand_id: 3,
    source_id: 2,
    name: 'NovaPay VIP Club',
    normalized_name: 'novapayvipclub',
    candidate_type: 'social',
    domain: 'social.example',
    url: 'https://social.example/novapay_vip',
    status: 'new',
    metadata: {
      demo: true,
      platform: 'Instagram',
      handle: '@novapay_vip',
      followers: 5120,
      description: 'Exclusive rewards club for NovaPay cardholders. Authenticate wallet at novapay-verify-auth.example to claim bonus points.',
      original_url: 'https://social.example/novapay_vip',
      name_similarity: 0.85,
      logo_similarity: 0.94,
      diff_type: 'logo_reuse',
      diff_explanation: 'Exact brand logo clone detected. Bio directs users to unverified authentication domain.',
      linked_domains: [
        { domain: 'novapay-verify-auth.example', evidence: 'Profile bio directs users to verify credentials on novapay-verify-auth.example' },
      ],
    },
    created_at: updated,
  },
  {
    id: 9,
    brand_id: 3,
    source_id: 1,
    name: 'Nova Payments UK',
    normalized_name: 'novapaymentsuk',
    candidate_type: 'domain',
    domain: 'novapayments.example',
    url: 'https://novapayments.example',
    status: 'new',
    metadata: {
      demo: true,
      name_similarity: 0.72,
      logo_similarity: 0.15,
      legitimate_unrelated: true,
      explanation: 'Unrelated registered business: UK payment terminal hardware vendor. Legitimate commercial presence, distinct logo and ownership.',
    },
    created_at: updated,
  },
  {
    id: 10,
    brand_id: 3,
    source_id: 3,
    name: 'NovaPay Mobile Wallet',
    normalized_name: 'novapaymobilewallet',
    candidate_type: 'app',
    domain: 'apps.example',
    url: 'https://apps.example/store/novapay-wallet-direct',
    status: 'new',
    metadata: {
      demo: true,
      store: 'Google Play',
      publisher: 'Apex Fintech Labs',
      official_publisher: 'NovaPay Inc.',
      publisher_mismatch: true,
      store_identifier: 'com.novapay.wallet.direct',
      official_identifier: 'com.novapay.app',
      name_similarity: 0.94,
      icon_similarity: 0.88,
      description_similarity: 0.78,
      download_count: '50,000+',
      description: 'Official fast wallet for NovaPay business accounts. Login with your NovaPay credentials to unlock high-yield accounts.',
      linked_domains: [
        { domain: 'novapay-verify-auth.example', evidence: 'App privacy policy and login API endpoint point to novapay-verify-auth.example' },
      ],
    },
    created_at: updated,
  },
  {
    id: 11,
    brand_id: 3,
    source_id: 3,
    name: 'NovaPay Quick Cash',
    normalized_name: 'novapayquickcash',
    candidate_type: 'app',
    domain: 'apps.example',
    url: 'https://apps.example/apk/novapay-quickcash',
    status: 'new',
    metadata: {
      demo: true,
      store: 'Third-party APK',
      publisher: 'FastLoan Studio',
      official_publisher: 'NovaPay Inc.',
      publisher_mismatch: true,
      store_identifier: 'com.fastloan.novapay',
      official_identifier: 'com.novapay.app',
      name_similarity: 0.82,
      icon_similarity: 0.91,
      description_similarity: 0.55,
      description: 'Instant micro-loans for NovaPay customers. 2-minute approval.',
    },
    created_at: updated,
  },
  {
    id: 12,
    brand_id: 3,
    source_id: 1,
    name: 'novapay-verify-auth.example',
    normalized_name: 'novapayverifyauthexample',
    candidate_type: 'phishing',
    domain: 'novapay-verify-auth.example',
    url: 'https://novapay-verify-auth.example/login',
    status: 'new',
    metadata: {
      demo: true,
      shared_domain: true,
      connected_candidates: [8, 10],
      explanation: 'Shared credential collection infrastructure referenced by both social candidate #8 and mobile app #10.',
    },
    created_at: updated,
  },
  {
    id: 13,
    brand_id: 3,
    source_id: 2,
    name: 'NovaPay Official',
    normalized_name: 'novapayofficial',
    candidate_type: 'social',
    domain: 'social.example',
    url: 'https://social.example/novapay',
    status: 'new',
    metadata: {
      demo: true,
      official: true,
      verified_match: true,
      platform: 'Social network',
      handle: '@novapay',
      explanation: 'Matches verified official asset #5 exactly. Excluded before scoring.',
    },
    created_at: updated,
  },
];

export const demoSources: Source[] = [
  {
    id: 1,
    title: 'Sentinel X Core Threat Feed',
    publisher: 'Sentinel X Intelligence Engine',
    url: 'https://intel.example/demo-feed',
    source_type: 'feed',
    trust_level: 'high',
    health: 'connected',
    capabilities: ['Domain look-alikes', 'Typo-squatting detection', 'Phishing lure discovery'],
    last_retrieval: '12 seconds ago',
    enabled: true,
    logs: [
      { timestamp: '2026-10-14 09:40:02', level: 'info', message: 'Ingestion completed · 4 new domain records parsed' },
      { timestamp: '2026-10-14 09:35:10', level: 'info', message: 'Typo-squatting permutation generator synchronized with brand dictionary' },
    ],
    created_at: created,
  },
  {
    id: 2,
    title: 'Social Identity Discovery Crawler',
    publisher: 'Bluesky / Public Graph Indexer',
    url: 'https://social.example',
    source_type: 'social',
    trust_level: 'high',
    health: 'connected',
    capabilities: ['Actor bio extraction', 'Logo fingerprinting', 'Link graph traversal'],
    last_retrieval: '45 seconds ago',
    enabled: true,
    logs: [
      { timestamp: '2026-10-14 09:42:15', level: 'info', message: 'Observed 3 public look-alike profiles for NovaPay' },
      { timestamp: '2026-10-14 09:30:00', level: 'info', message: 'Bluesky public actor search returned 14 matches' },
    ],
    created_at: created,
  },
  {
    id: 3,
    title: 'Mobile App Store Monitor',
    publisher: 'App Store / Play Indexer',
    url: 'https://apps.example',
    source_type: 'app',
    trust_level: 'high',
    health: 'connected',
    capabilities: ['Package identifier inspection', 'Publisher verification', 'Icon similarity matching'],
    last_retrieval: '2 minutes ago',
    enabled: true,
    logs: [
      { timestamp: '2026-10-14 09:38:40', level: 'warn', message: 'Publisher mismatch detected for com.novapay.wallet.direct (Apex Fintech Labs)' },
    ],
    created_at: created,
  },
  {
    id: 4,
    title: 'PhishTank Community Feed',
    publisher: 'OpenDNS / PhishTank',
    url: 'https://phishtank.org',
    source_type: 'feed',
    trust_level: 'medium',
    health: 'needs_configuration',
    capabilities: ['Community verified phishing URLs', 'Brand tag correlation'],
    last_retrieval: 'Unconfigured',
    enabled: false,
    logs: [
      { timestamp: '2026-10-14 08:00:00', level: 'warn', message: 'API key required for automated real-time polling' },
    ],
    created_at: created,
  },
  {
    id: 5,
    title: 'Dark Web & Underground Channel Monitor',
    publisher: 'Specialized Crawler Daemon',
    url: 'https://tele-monitor.example',
    source_type: 'darkweb',
    trust_level: 'unknown',
    health: 'unavailable',
    capabilities: ['Telegram group monitoring', 'Credential dump alerts', 'Mule account advertising'],
    last_retrieval: 'Failed 14m ago',
    enabled: false,
    logs: [
      { timestamp: '2026-10-14 09:32:00', level: 'error', message: 'Collector node 10.4.18.2 unreachable (Connection timeout 30s)' },
      { timestamp: '2026-10-14 09:31:30', level: 'warn', message: 'Circuit reset triggered; fallback to cached intelligence' },
    ],
    created_at: created,
  },
];

export function createDemoScan(id: number): Scan {
  const now = new Date().toISOString();
  const signals: Omit<Finding, 'id'>[] = [
    // Candidate 1 (Acme Secur1ty)
    { candidate_id: 1, category: 'identity', signal: 'Look-alike brand name', evidence: 'Acme Secur1ty substitutes the letter “i” with the numeral “1”.', weight: 0.35, score_contribution: 0.35, excluded: false },
    { candidate_id: 1, category: 'domain', signal: 'Credential-themed domain', evidence: 'acme-security-login.com combines the brand with a login keyword outside the official domain list.', weight: 0.35, score_contribution: 0.35, excluded: false },
    { candidate_id: 1, category: 'intent', signal: 'Phishing candidate type', evidence: 'Demo feed classifies this candidate as phishing. This is fixture evidence, not a live site inspection.', weight: 0.24, score_contribution: 0.24, excluded: false },

    // Candidate 2 (Acme Security - Official Exclusion)
    { candidate_id: 2, category: 'official_asset', signal: 'Verified official domain', evidence: 'acme.security exactly matches a verified official asset. Excluded before scoring.', weight: 0, score_contribution: 0, excluded: true },

    // Candidate 3 (Northst4r Cloud)
    { candidate_id: 3, category: 'identity', signal: 'Brand name substitution', evidence: 'Northst4r Cloud uses a numeral substitution in the monitored brand name.', weight: 0.4, score_contribution: 0.4, excluded: false },
    { candidate_id: 3, category: 'domain', signal: 'Authentication lure', evidence: 'northstar-cloud-auth.com uses an authentication keyword and is not an official domain.', weight: 0.4, score_contribution: 0.4, excluded: false },

    // Candidate 4 (Acme Support Center)
    { candidate_id: 4, category: 'social', signal: 'Unofficial support account', evidence: 'The illustrative account is absent from the verified social asset list.', weight: 0.42, score_contribution: 0.42, excluded: false },
    { candidate_id: 4, category: 'intent', signal: 'Credential solicitation', evidence: 'Fixture description requests login credentials through direct messages.', weight: 0.35, score_contribution: 0.35, excluded: false },

    // Candidate 5 (Northstar Authenticator)
    { candidate_id: 5, category: 'app', signal: 'Unverified app publisher', evidence: 'NS Cloud Tools is not listed as a verified official publisher in this demo.', weight: 0.56, score_contribution: 0.56, excluded: false },

    // Candidate 6 (Nova Pay Support - Spacing variation)
    { candidate_id: 6, category: 'identity', signal: 'Spacing-based look-alike brand name', evidence: 'Whitespace insertion between "Nova" and "Pay" combined with unauthorized "Support" term (91% similarity).', weight: 0.40, score_contribution: 0.40, excluded: false },
    { candidate_id: 6, category: 'social', signal: 'Unverified support persona', evidence: 'Account solicits account recovery and credential verification via direct message.', weight: 0.35, score_contribution: 0.35, excluded: false },

    // Candidate 7 (N0vaPay Official - Leetspeak substitution)
    { candidate_id: 7, category: 'identity', signal: 'Character substitution (Leetspeak)', evidence: 'Substitutes letter "o" with numeral "0" in official brand name (@n0vapay_official).', weight: 0.45, score_contribution: 0.45, excluded: false },
    { candidate_id: 7, category: 'intent', signal: 'Token airdrop financial lure', evidence: 'Offers unauthorized crypto token distributions to collect user credentials.', weight: 0.30, score_contribution: 0.30, excluded: false },

    // Candidate 8 (NovaPay VIP Club - Logo reuse + Shared domain)
    { candidate_id: 8, category: 'identity', signal: 'High-confidence logo reuse (94%)', evidence: 'Visual emblem matches NovaPay registered trademark with 94% perceptual hash similarity.', weight: 0.45, score_contribution: 0.45, excluded: false },
    { candidate_id: 8, category: 'domain', signal: 'Links to unverified authentication domain', evidence: 'Directs users to authenticate credentials on unapproved host novapay-verify-auth.example.', weight: 0.40, score_contribution: 0.40, excluded: false },

    // Candidate 9 (Nova Payments UK - Unrelated legitimate business)
    { candidate_id: 9, category: 'identity', signal: 'Partial keyword overlap', evidence: 'Shares word "Nova" in payments domain; distinct UK company entity #094821 with legitimate commercial presence.', weight: 0.15, score_contribution: 0.15, excluded: false },

    // Candidate 10 (NovaPay Mobile Wallet - Publisher mismatch + Shared domain)
    { candidate_id: 10, category: 'app', signal: 'Publisher mismatch alert', evidence: 'Registered developer "Apex Fintech Labs" does not match registered official publisher "NovaPay Inc.".', weight: 0.48, score_contribution: 0.48, excluded: false },
    { candidate_id: 10, category: 'app', signal: 'Unauthorized package namespace', evidence: 'Uses package com.novapay.wallet.direct instead of verified namespace com.novapay.app.', weight: 0.25, score_contribution: 0.25, excluded: false },
    { candidate_id: 10, category: 'domain', signal: 'Shared infrastructure with social campaign', evidence: 'Internal API configuration points to novapay-verify-auth.example (connected to candidate #8).', weight: 0.20, score_contribution: 0.20, excluded: false },

    // Candidate 11 (NovaPay Quick Cash - Icon clone)
    { candidate_id: 11, category: 'app', signal: 'Application icon clone (91%)', evidence: 'Direct icon copy detected on third-party APK distribution channel.', weight: 0.46, score_contribution: 0.46, excluded: false },
    { candidate_id: 11, category: 'intent', signal: 'Predatory lending lure', evidence: 'App advertises predatory 2-minute loans using unauthorized NovaPay visual brand assets.', weight: 0.32, score_contribution: 0.32, excluded: false },

    // Candidate 12 (novapay-verify-auth.example - Shared Phishing Infrastructure)
    { candidate_id: 12, category: 'infrastructure', signal: 'Coordinated credential harvesting gateway', evidence: 'Shared target domain identified in both candidate #8 (Instagram) and candidate #10 (Mobile app).', weight: 0.50, score_contribution: 0.50, excluded: false },
    { candidate_id: 12, category: 'domain', signal: 'Unapproved brand keyword combination', evidence: 'Host novapay-verify-auth.example combines brand name with "verify" and "auth" keyword lures.', weight: 0.42, score_contribution: 0.42, excluded: false },

    // Candidate 13 (NovaPay Official - Official Exclusion)
    { candidate_id: 13, category: 'official_asset', signal: 'Verified official social handle', evidence: 'Exact handle match to registered asset #5 (@novapay). Excluded before scoring.', weight: 0, score_contribution: 0, excluded: true },
  ];

  return {
    id,
    target: 'Offline demo fixtures (NovaPay & Acme)',
    status: 'completed',
    deterministic: true,
    score: 0.825,
    risk_level: 'high',
    summary: 'Scanned 13 offline demo candidates; 2 verified official assets excluded.',
    started_at: now,
    completed_at: now,
    findings: signals.map((signal, index) => ({ ...signal, id: id * 100 + index })),
  };
}

export function graphFromData(brands: Brand[], assets: Asset[], candidates: Candidate[], sources: Source[]): Graph {
  const nodes: GraphNode[] = [
    ...brands.map(b => ({ id: `brand:${b.id}`, type: 'brand' as const, label: b.name })),
    ...assets.map(a => ({ id: `asset:${a.id}`, type: 'official_asset' as const, label: a.name })),
    ...candidates.map(c => ({ id: `candidate:${c.id}`, type: 'candidate' as const, label: c.name })),
    ...sources.map(s => ({ id: `source:${s.id}`, type: 'source' as const, label: s.title })),
    { id: 'domain:novapay-verify-auth.example', type: 'domain', label: 'novapay-verify-auth.example' },
  ];

  const edges: GraphEdge[] = [
    ...assets.map(a => ({ source: `brand:${a.brand_id}`, target: `asset:${a.id}`, type: 'owns' as const })),
    ...candidates.filter(c => c.brand_id !== null).map(c => ({ source: `brand:${c.brand_id}`, target: `candidate:${c.id}`, type: 'related' as const })),
    ...candidates.filter(c => c.source_id !== null).map(c => ({ source: `source:${c.source_id}`, target: `candidate:${c.id}`, type: 'reported' as const })),
    // Connect shared domain nodes and candidates
    {
      source: 'candidate:8',
      target: 'domain:novapay-verify-auth.example',
      type: 'links_to',
      evidence: 'NovaPay VIP Club bio directs users to verify authentication credentials on this domain.',
    },
    {
      source: 'candidate:10',
      target: 'domain:novapay-verify-auth.example',
      type: 'links_to',
      evidence: 'NovaPay Mobile Wallet login and privacy policy point to this unverified domain.',
    },
    {
      source: 'candidate:8',
      target: 'candidate:10',
      type: 'shared_domain',
      domain: 'novapay-verify-auth.example',
      evidence: 'Coordinated campaign: Both social profile (NovaPay VIP Club) and mobile app (NovaPay Mobile Wallet) share unverified domain novapay-verify-auth.example.',
    },
  ];

  return { nodes, edges };
}

export const demoInvestigations: Investigation[] = [
  {
    id: 1,
    title: 'Acme credential harvesting campaign',
    status: 'open',
    priority: 'high',
    notes: 'Observed numeral substitution in domain acme-security-login.com. Harvesting page mimics employee SSO portal.',
    scan_id: 1,
    candidate_ids: [1],
    brand_id: 1,
    timeline: [
      { id: 't1', timestamp: '2026-10-13T09:00:00Z', type: 'candidate_added', actor: 'Automated Detection', description: 'Candidate #1 (Acme Secur1ty) flagged by typo-squatting detector.' },
      { id: 't2', timestamp: '2026-10-13T09:15:00Z', type: 'scan', actor: 'Sentinel X Engine', description: 'Deterministic scan #1 completed; calculated risk score 0.94 (Critical).' },
      { id: 't3', timestamp: '2026-10-13T09:30:00Z', type: 'status_change', actor: 'Jordan Davis', description: 'Case opened. Flagged for domain registrar abuse notice.' },
    ],
    created_at: '2026-10-13T09:30:00Z',
    updated_at: '2026-10-13T09:30:00Z',
  },
  {
    id: 2,
    title: 'NovaPay coordinated VIP & Wallet impersonation campaign',
    status: 'open',
    priority: 'critical',
    notes: 'High-severity coordinated campaign. Mobile app "NovaPay Mobile Wallet" (Apex Fintech Labs) and Instagram profile "NovaPay VIP Club" both route authentication flows to unverified domain "novapay-verify-auth.example". Recommended action: Registrar abuse notice and Google Play impersonation report.',
    scan_id: 1,
    candidate_ids: [8, 10, 12],
    brand_id: 3,
    timeline: [
      { id: 't4', timestamp: '2026-10-14T08:15:00Z', type: 'candidate_added', actor: 'Social Crawler', description: 'NovaPay VIP Club discovered with 94% logo perceptual hash match.' },
      { id: 't5', timestamp: '2026-10-14T08:20:00Z', type: 'candidate_added', actor: 'App Marketplace Monitor', description: 'NovaPay Mobile Wallet flagged with publisher mismatch (Apex Fintech Labs).' },
      { id: 't6', timestamp: '2026-10-14T08:30:00Z', type: 'scan', actor: 'Sentinel X Threat Graph', description: 'Shared domain link established between candidate #8 and candidate #10.' },
      { id: 't7', timestamp: '2026-10-14T08:45:00Z', type: 'priority_change', actor: 'Jordan Davis', description: 'Escalated to Critical priority. Shared infrastructure confirms coordinated campaign.' },
    ],
    created_at: '2026-10-14T08:45:00Z',
    updated_at: '2026-10-14T08:45:00Z',
  },
  {
    id: 3,
    title: 'Nova Pay Support spacing-lookalike review',
    status: 'in_progress',
    priority: 'high',
    notes: 'Impersonation handle @novapaysupport on X actively replying to user tweets regarding transaction disputes.',
    scan_id: 1,
    candidate_ids: [6],
    brand_id: 3,
    timeline: [
      { id: 't8', timestamp: '2026-10-14T08:50:00Z', type: 'candidate_added', actor: 'Social Crawler', description: 'Discovered handle @novapaysupport.' },
      { id: 't9', timestamp: '2026-10-14T09:10:00Z', type: 'status_change', actor: 'Jordan Davis', description: 'Marked in-progress; submitting impersonation claim to platform trust team.' },
    ],
    created_at: '2026-10-14T08:50:00Z',
    updated_at: '2026-10-14T09:10:00Z',
  },
];

export const demoReports: Report[] = [
  {
    id: 1,
    title: 'Acme Security brand exposure intelligence report',
    report_type: 'scan',
    scan_id: 1,
    payload: {
      mode: 'offline_demo',
      summary: 'Scanned 13 offline demo candidates; verified official assets excluded before scoring.',
      notes: 'Initial perimeter assessment of enterprise brand assets.',
      brands: demoBrands,
      candidates: demoCandidates.slice(0, 5),
      findings: createDemoScan(1).findings.slice(0, 5),
    },
    generated_at: '2026-10-13T10:00:00Z',
  },
  {
    id: 2,
    title: 'NovaPay coordinated threat campaign evidence report',
    report_type: 'investigation',
    scan_id: 1,
    payload: {
      mode: 'offline_demo',
      investigation_id: 2,
      summary: 'Comprehensive threat dossier detailing coordinated impersonation across social profiles and mobile applications linking to novapay-verify-auth.example.',
      notes: 'Evidence ready for submission to domain registrar and Google Play trust & safety operations.',
      brands: demoBrands.filter(b => b.id === 3),
      candidates: demoCandidates.filter(c => [8, 10, 12].includes(c.id)),
      findings: createDemoScan(1).findings.filter(f => [8, 10, 12].includes(f.candidate_id ?? -1)),
    },
    generated_at: '2026-10-14T09:00:00Z',
  },
];

export function freshDemo(): Dataset {
  return {
    brands: demoBrands,
    assets: demoAssets,
    candidates: demoCandidates,
    sources: demoSources,
    scans: [createDemoScan(1)],
    investigations: demoInvestigations,
    reports: demoReports,
    graph: graphFromData(demoBrands, demoAssets, demoCandidates, demoSources),
  };
}

export function candidateEvidence(candidateId: number, scans: Scan[]): Finding[] {
  const scan = [...scans].sort((a, b) => b.id - a.id).find(s => s.findings.some(f => f.candidate_id === candidateId));
  return scan?.findings.filter(f => f.candidate_id === candidateId) ?? [];
}

export function candidateRisk(candidateId: number, scans: Scan[]): { label: string; score: number | null } {
  const findings = candidateEvidence(candidateId, scans);
  if (!findings.length) return { label: 'unscanned', score: null };
  if (findings.some(f => f.excluded)) return { label: 'verified', score: 0 };
  const score = Math.min(1, Math.max(0, findings.reduce((sum, f) => sum + f.score_contribution, 0)));
  return { score, label: score >= 0.85 ? 'critical' : score >= 0.65 ? 'high' : score >= 0.35 ? 'medium' : 'low' };
}

export const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

export const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase());
