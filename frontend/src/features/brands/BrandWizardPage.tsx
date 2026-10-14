import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useSentinel } from '../../App';
import { request } from '../../api';

interface SocialProfileInput {
  platform: string;
  url: string;
  handle: string;
  status: string;
}

interface AppInput {
  store: string;
  name: string;
  url: string;
  identifier: string;
  publisher: string;
}

export function BrandWizardPage() {
  const { mode, refresh, saveDemo, notify } = useSentinel();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Brand Identity
  const [companyName, setCompanyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('Fintech & Payments');
  const [primaryWebsite, setPrimaryWebsite] = useState('');
  const [aliases, setAliases] = useState('');

  // Step 2: Visual Identity
  const [logoName] = useState<string | null>('novapay_emblem.svg');
  const [logoColor, setLogoColor] = useState('#C6F277');

  // Step 3: Official Social Profiles
  const [socialProfiles, setSocialProfiles] = useState<SocialProfileInput[]>([
    { platform: 'X / Twitter', url: 'https://twitter.com/novapay', handle: '@novapay', status: 'verified' },
    { platform: 'Bluesky', url: 'https://bsky.app/profile/novapay.bsky.social', handle: '@novapay.bsky.social', status: 'verified' },
  ]);

  // Step 4: Official Applications
  const [apps, setApps] = useState<AppInput[]>([
    {
      store: 'Google Play & App Store',
      name: 'NovaPay Business Banking',
      url: 'https://play.google.com/store/apps/details?id=com.novapay.app',
      identifier: 'com.novapay.app',
      publisher: 'NovaPay Inc.',
    },
  ]);

  // Step 5: Approved Infrastructure
  const [officialDomains, setOfficialDomains] = useState('novapay.example, novapay.io');
  const [supportDomains, setSupportDomains] = useState('support.novapay.example, help.novapay.example');
  const [publisherAliases, setPublisherAliases] = useState('NovaPay Inc., NovaPay Global Ltd.');

  const addSocialProfile = () => {
    setSocialProfiles(prev => [...prev, { platform: 'LinkedIn', url: '', handle: '', status: 'verified' }]);
  };

  const removeSocialProfile = (index: number) => {
    setSocialProfiles(prev => prev.filter((_, i) => i !== index));
  };

  const addApp = () => {
    setApps(prev => [...prev, { store: 'Google Play', name: '', url: '', identifier: '', publisher: companyName || 'NovaPay Inc.' }]);
  };

  const removeApp = (index: number) => {
    setApps(prev => prev.filter((_, i) => i !== index));
  };

  const validateCurrentStep = () => {
    setError('');
    if (step === 1) {
      if (!companyName.trim()) {
        setError('Company name is required.');
        return false;
      }
      if (!primaryWebsite.trim()) {
        setError('Primary website is required.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateCurrentStep()) {
      setStep(prev => Math.min(6, prev + 1));
    }
  };

  const prevStep = () => {
    setError('');
    setStep(prev => Math.max(1, prev - 1));
  };

  async function handleComplete(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    const domainList = [
      ...officialDomains.split(',').map(d => d.trim()),
      ...supportDomains.split(',').map(d => d.trim()),
    ].filter(Boolean);

    try {
      if (mode === 'live') {
        const brand = await request<{ id: number }>('/brands', {
          method: 'POST',
          body: JSON.stringify({
            name: companyName.trim(),
            domains: domainList,
            description: description.trim() || null,
          }),
        });

        // Register official assets
        for (const social of socialProfiles) {
          if (social.url) {
            await request('/official-assets', {
              method: 'POST',
              body: JSON.stringify({
                brand_id: brand.id,
                asset_type: 'social',
                name: `${social.platform}: ${social.handle || social.url}`,
                url: social.url,
                status: 'verified',
              }),
            });
          }
        }

        for (const app of apps) {
          if (app.name) {
            await request('/official-assets', {
              method: 'POST',
              body: JSON.stringify({
                brand_id: brand.id,
                asset_type: 'mobile_app',
                name: app.name,
                url: app.url || `https://apps.example/${app.identifier}`,
                status: 'verified',
              }),
            });
          }
        }

        await refresh();
        notify(`Protected brand "${companyName}" registered and monitoring initiated.`);
        navigate(`/app/brands/${brand.id}`);
      } else {
        // Offline / Demo Mode: Persist locally
        const newBrandId = 4;
        const newBrand = {
          id: newBrandId,
          name: companyName.trim(),
          canonical_name: displayName.trim() || companyName.trim(),
          domains: domainList.length ? domainList : ['novapay.example'],
          description: description.trim() || `${industry} enterprise brand registered via onboarding wizard.`,
          industry,
          logo: (displayName || companyName).slice(0, 2).toUpperCase(),
          created_at: new Date().toISOString(),
        };

        const newAssets = [
          {
            id: 201,
            brand_id: newBrandId,
            asset_type: 'domain',
            name: `${companyName} Primary Domain`,
            url: primaryWebsite.startsWith('http') ? primaryWebsite : `https://${primaryWebsite}`,
            status: 'verified',
            verified_at: new Date().toISOString(),
          },
          ...socialProfiles.map((s, idx) => ({
            id: 202 + idx,
            brand_id: newBrandId,
            asset_type: 'social',
            name: `${s.platform} Official`,
            url: s.url || `https://social.example/${s.handle}`,
            identifier: s.handle,
            status: 'verified',
            verified_at: new Date().toISOString(),
          })),
          ...apps.map((a, idx) => ({
            id: 210 + idx,
            brand_id: newBrandId,
            asset_type: 'mobile_app',
            name: a.name || `${companyName} App`,
            url: a.url || `https://apps.example/${a.identifier}`,
            identifier: a.identifier,
            publisher: a.publisher,
            status: 'verified',
            verified_at: new Date().toISOString(),
          })),
        ];

        saveDemo(prev => ({
          ...prev,
          brands: [...prev.brands, newBrand],
          assets: [...prev.assets, ...newAssets],
        }));

        notify(`Demo brand "${companyName}" onboarded with ${newAssets.length} verified official assets.`);
        navigate(`/app/brands/${newBrandId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register brand.');
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = [
    'Brand Identity',
    'Visual Identity',
    'Social Accounts',
    'Mobile Applications',
    'Approved Infrastructure',
    'Review & Activate',
  ];

  return (
    <div className="wizard-page-layout">
      {/* Wizard Header */}
      <div className="wizard-header">
        <Link to="/app/brands" className="text-link">
          <ArrowLeft size={14} /> Back to brand registry
        </Link>
        <span className="eyebrow">
          <ShieldCheck size={13} /> BRAND ONBOARDING WIZARD
        </span>
        <h2>Onboard Protected Brand</h2>
        <p>
          Register your official identity, visual assets, and approved infrastructure. All registered assets establish your verified baseline and are automatically excluded from false alarms.
        </p>

        {/* 6-Step Stepper */}
        <div className="wizard-stepper">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < step;
            const isActive = stepNum === step;
            return (
              <div
                key={label}
                className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => {
                  if (isCompleted) setStep(stepNum);
                }}
              >
                <div className="step-circle">
                  {isCompleted ? <Check size={13} /> : stepNum}
                </div>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Body Card */}
      <div className="panel wizard-card">
        <form onSubmit={handleComplete}>
          {/* STEP 1: Brand Identity */}
          {step === 1 && (
            <div className="wizard-step-content">
              <div className="step-heading">
                <span className="step-indicator">STEP 01</span>
                <h3>Brand Identity &amp; Corporate Profile</h3>
                <p>Define the legal and commercial names of the organization you are protecting.</p>
              </div>

              <div className="form-grid">
                <label>
                  Company Name <span className="required">*</span>
                  <input
                    required
                    placeholder="e.g. NovaPay Inc."
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                  <small>Legal entity name used on formal registrations and app store listings.</small>
                </label>

                <label>
                  Public Display Name
                  <input
                    placeholder="e.g. NovaPay"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                  <small>The consumer-facing brand name customers recognize.</small>
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Industry Category
                  <select value={industry} onChange={e => setIndustry(e.target.value)}>
                    <option value="Fintech & Payments">Fintech &amp; Payments</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                    <option value="E-Commerce & Retail">E-Commerce &amp; Retail</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Telecommunications">Telecommunications</option>
                  </select>
                </label>

                <label>
                  Primary Website URL <span className="required">*</span>
                  <input
                    required
                    placeholder="https://novapay.example"
                    value={primaryWebsite}
                    onChange={e => setPrimaryWebsite(e.target.value)}
                  />
                  <small>Your primary corporate web portal.</small>
                </label>
              </div>

              <label>
                Brand Aliases &amp; Trade Names
                <input
                  placeholder="Nova Pay, NovaPayments, NP Digital"
                  value={aliases}
                  onChange={e => setAliases(e.target.value)}
                />
                <small>Comma-separated nicknames, abbreviations, or subsidiary trade names.</small>
              </label>

              <label>
                Brand Description
                <textarea
                  rows={3}
                  placeholder="Describe your core product offerings, target customer base, and legitimate services…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </label>
            </div>
          )}

          {/* STEP 2: Visual Identity */}
          {step === 2 && (
            <div className="wizard-step-content">
              <div className="step-heading">
                <span className="step-indicator">STEP 02</span>
                <h3>Visual Identity &amp; Trademark Asset</h3>
                <p>Register your official emblem for perceptual hash matching against cloned profile pictures and fake apps.</p>
              </div>

              <div className="logo-upload-box">
                <div className="logo-preview-area">
                  <div className="logo-preview-box" style={{ borderColor: logoColor }}>
                    <span style={{ color: logoColor }}>{(displayName || companyName || 'NP').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="logo-preview-info">
                    <strong>{logoName || 'Default Brand Monogram'}</strong>
                    <span className="muted">Vector SVG · High-resolution perceptual anchor</span>
                    <span className="badge badge-verified">Ready for matching</span>
                  </div>
                </div>

                <div className="upload-guidelines">
                  <h4><Info size={14} /> Guidelines for Trademark Fingerprinting:</h4>
                  <ul>
                    <li>Supports transparent SVG, PNG, or WebP files (minimum 512x512 recommended).</li>
                    <li>The engine computes invariant perceptual hashes (pHash) resistant to minor scaling and compression artifacts.</li>
                    <li>Color adjustments and subtle borders will not defeat similarity matching.</li>
                  </ul>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  Emblem Accent Tone
                  <select value={logoColor} onChange={e => setLogoColor(e.target.value)}>
                    <option value="#C6F277">Muted Acid-Lime (#C6F277)</option>
                    <option value="#72C9B0">Subdued Green (#72C9B0)</option>
                    <option value="#80B1C4">Steel Blue (#80B1C4)</option>
                    <option value="#AB9BD0">Muted Purple (#AB9BD0)</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Official Social Profiles */}
          {step === 3 && (
            <div className="wizard-step-content">
              <div className="step-heading">
                <span className="step-indicator">STEP 03</span>
                <h3>Official Social Media Accounts</h3>
                <p>Register canonical handles. Accounts registered here are automatically excluded from impersonation alerts.</p>
              </div>

              <div className="social-profile-list">
                {socialProfiles.map((profile, idx) => (
                  <div key={idx} className="social-input-card">
                    <div className="card-row">
                      <select
                        value={profile.platform}
                        onChange={e => {
                          const val = e.target.value;
                          setSocialProfiles(prev => prev.map((item, i) => (i === idx ? { ...item, platform: val } : item)));
                        }}
                      >
                        <option value="X / Twitter">X / Twitter</option>
                        <option value="Bluesky">Bluesky</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Instagram">Instagram</option>
                        <option value="YouTube">YouTube</option>
                      </select>

                      <input
                        placeholder="@handle"
                        value={profile.handle}
                        onChange={e => {
                          const val = e.target.value;
                          setSocialProfiles(prev => prev.map((item, i) => (i === idx ? { ...item, handle: val } : item)));
                        }}
                      />

                      <input
                        placeholder="https://..."
                        value={profile.url}
                        onChange={e => {
                          const val = e.target.value;
                          setSocialProfiles(prev => prev.map((item, i) => (i === idx ? { ...item, url: val } : item)));
                        }}
                      />

                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => removeSocialProfile(idx)}
                        disabled={socialProfiles.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                <button type="button" className="button secondary" onClick={addSocialProfile}>
                  <Plus size={15} /> Add Another Official Account
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Official Applications */}
          {step === 4 && (
            <div className="wizard-step-content">
              <div className="step-heading">
                <span className="step-indicator">STEP 04</span>
                <h3>Official Mobile Applications</h3>
                <p>Register official app package IDs and authorized publisher names to detect look-alikes and publisher mismatches.</p>
              </div>

              <div className="apps-input-list">
                {apps.map((appItem, idx) => (
                  <div key={idx} className="app-input-card">
                    <div className="form-grid">
                      <label>
                        Application Name
                        <input
                          placeholder="e.g. NovaPay Business Banking"
                          value={appItem.name}
                          onChange={e => {
                            const val = e.target.value;
                            setApps(prev => prev.map((item, i) => (i === idx ? { ...item, name: val } : item)));
                          }}
                        />
                      </label>
                      <label>
                        Store Platform
                        <input
                          placeholder="Google Play, Apple App Store"
                          value={appItem.store}
                          onChange={e => {
                            const val = e.target.value;
                            setApps(prev => prev.map((item, i) => (i === idx ? { ...item, store: val } : item)));
                          }}
                        />
                      </label>
                    </div>

                    <div className="form-grid">
                      <label>
                        App Bundle Identifier (Package Name)
                        <input
                          className="mono"
                          placeholder="e.g. com.novapay.app"
                          value={appItem.identifier}
                          onChange={e => {
                            const val = e.target.value;
                            setApps(prev => prev.map((item, i) => (i === idx ? { ...item, identifier: val } : item)));
                          }}
                        />
                        <small>Crucial: Apps with different bundle IDs will be flagged for publisher inspection.</small>
                      </label>
                      <label>
                        Registered Publisher Name
                        <input
                          placeholder="e.g. NovaPay Inc."
                          value={appItem.publisher}
                          onChange={e => {
                            const val = e.target.value;
                            setApps(prev => prev.map((item, i) => (i === idx ? { ...item, publisher: val } : item)));
                          }}
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      className="button text-button remove-btn"
                      onClick={() => removeApp(idx)}
                      disabled={apps.length === 1}
                    >
                      <Trash2 size={14} /> Remove Application
                    </button>
                  </div>
                ))}

                <button type="button" className="button secondary" onClick={addApp}>
                  <Plus size={15} /> Add Another Mobile Application
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Approved Infrastructure */}
          {step === 5 && (
            <div className="wizard-step-content">
              <div className="step-heading">
                <span className="step-indicator">STEP 05</span>
                <h3>Approved Infrastructure &amp; Domains</h3>
                <p>Register all legitimate hostnames. Outbound links pointing outside this list will trigger domain lure alerts.</p>
              </div>

              <label>
                Approved Corporate Domains
                <input
                  placeholder="novapay.example, novapay.io, payments.novapay.example"
                  value={officialDomains}
                  onChange={e => setOfficialDomains(e.target.value)}
                />
                <small>Comma-separated apex domains and sanctioned web hosts.</small>
              </label>

              <label>
                Support &amp; Helpdesk Hostnames
                <input
                  placeholder="support.novapay.example, help.novapay.example"
                  value={supportDomains}
                  onChange={e => setSupportDomains(e.target.value)}
                />
                <small>Designated customer support portals.</small>
              </label>

              <label>
                Authorized Publisher &amp; Developer Names
                <input
                  placeholder="NovaPay Inc., NovaPay Global Ltd."
                  value={publisherAliases}
                  onChange={e => setPublisherAliases(e.target.value)}
                />
                <small>Exact legal strings permitted as app store developers.</small>
              </label>
            </div>
          )}

          {/* STEP 6: Review and Activate */}
          {step === 6 && (
            <div className="wizard-step-content">
              <div className="step-heading">
                <span className="step-indicator">STEP 06</span>
                <h3>Review &amp; Activate Protection Baseline</h3>
                <p>Verify all registered assets before activating continuous threat intelligence collection.</p>
              </div>

              <div className="review-summary-box">
                <div className="review-section">
                  <h4>PROTECTED IDENTITY</h4>
                  <div className="review-item">
                    <span>Company Name:</span>
                    <strong>{companyName} ({displayName || companyName})</strong>
                  </div>
                  <div className="review-item">
                    <span>Industry:</span>
                    <span>{industry}</span>
                  </div>
                  <div className="review-item">
                    <span>Primary Website:</span>
                    <span className="mono">{primaryWebsite}</span>
                  </div>
                </div>

                <div className="review-section">
                  <h4>REGISTERED SOCIAL PROFILES ({socialProfiles.length})</h4>
                  {socialProfiles.map((s, i) => (
                    <div key={i} className="review-item">
                      <span>{s.platform}:</span>
                      <strong>{s.handle || s.url}</strong>
                      <span className="badge badge-verified">EXCLUDED BASELINE</span>
                    </div>
                  ))}
                </div>

                <div className="review-section">
                  <h4>OFFICIAL APPLICATIONS ({apps.length})</h4>
                  {apps.map((a, i) => (
                    <div key={i} className="review-item">
                      <span>{a.name}:</span>
                      <span className="mono">{a.identifier} ({a.publisher})</span>
                      <span className="badge badge-verified">VERIFIED</span>
                    </div>
                  ))}
                </div>

                <div className="review-section">
                  <h4>APPROVED DOMAINS</h4>
                  <p className="mono">{officialDomains}, {supportDomains}</p>
                </div>
              </div>

              <div className="exclusion-guarantee-note">
                <ShieldCheck size={18} />
                <span>
                  <strong>Exclusion Guarantee:</strong> Exact matches to these assets will be classified as verified baseline entities with 0-risk score. Any candidate using similar names or icons outside this registry will be flagged for analyst review.
                </span>
              </div>
            </div>
          )}

          {error && <div className="inline-error" role="alert">{error}</div>}

          {/* Wizard Controls */}
          <div className="wizard-footer-actions">
            {step > 1 && (
              <button type="button" className="button secondary" onClick={prevStep}>
                <ArrowLeft size={15} /> Previous Step
              </button>
            )}

            <Link to="/app/brands" className="button secondary">
              Cancel
            </Link>

            {step < 6 ? (
              <button type="button" className="button primary" onClick={nextStep}>
                Next: {stepLabels[step]} <ArrowRight size={15} />
              </button>
            ) : (
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? 'Activating…' : <><ShieldCheck size={16} /> Activate Brand Protection</>}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
