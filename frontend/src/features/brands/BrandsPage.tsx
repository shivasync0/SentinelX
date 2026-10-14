import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Globe2,
  Network,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge, EmptyState, useSentinel } from '../../App';
import { candidateRisk } from '../../data';

export function BrandsPage() {
  const { data } = useSentinel();
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');

  const filteredBrands = data.brands.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.domains.some(d => d.toLowerCase().includes(search.toLowerCase()));
    const matchesIndustry = industryFilter === 'all' || b.industry === industryFilter;
    return matchesSearch && matchesIndustry;
  });

  const industries = ['all', ...new Set(data.brands.map(b => b.industry).filter(Boolean) as string[])];

  return (
    <div className="brands-page-container">
      {/* Top Banner */}
      <div className="page-summary-strip">
        <ShieldCheck size={18} />
        <strong>{data.brands.length} Monitored Brand Entities</strong>
        <span className="divider" />
        <span>
          {data.assets.length} verified official assets provide your organization&apos;s authoritative trust baseline.
        </span>
        <Link to="/app/brands/new" className="button primary ml-auto">
          <Plus size={15} /> Register Brand
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="panel filter-panel mb-4">
        <div className="filter-bar">
          <div className="input-search">
            <Search size={15} />
            <input
              placeholder="Search brands or registered domains…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-controls">
            <SlidersHorizontal size={14} />
            <select
              aria-label="Filter by industry"
              value={industryFilter}
              onChange={e => setIndustryFilter(e.target.value)}
            >
              {industries.map(ind => (
                <option key={ind} value={ind}>
                  {ind === 'all' ? 'All Industries' : ind}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Brand Grid */}
      <div className="brand-grid">
        {filteredBrands.map(brand => {
          const brandAssets = data.assets.filter(a => a.brand_id === brand.id);
          const brandCandidates = data.candidates.filter(c => c.brand_id === brand.id);
          const highRisk = brandCandidates.filter(c => ['high', 'critical'].includes(candidateRisk(c.id, data.scans).label));

          return (
            <article className="panel brand-card" key={brand.id}>
              <div className="brand-card-top">
                <div className="brand-monogram">
                  {brand.logo || brand.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <Badge value="protected" />
                  {brand.industry && <small className="industry-text">{brand.industry}</small>}
                </div>
                <Link
                  className="icon-button"
                  title={`View ${brand.name} threat graph`}
                  to={`/app/threat-graph?brand=${brand.id}`}
                >
                  <Network size={16} />
                </Link>
              </div>

              <h2>{brand.name}</h2>
              <p>{brand.description ?? 'Enterprise brand asset under active protection.'}</p>

              <div className="domain-pills">
                {brand.domains.map(domain => (
                  <span key={domain}>
                    <Globe2 size={11} /> {domain}
                  </span>
                ))}
              </div>

              <div className="brand-stats">
                <div>
                  <strong>{brandAssets.length}</strong>
                  <span>Official Assets</span>
                </div>
                <div>
                  <strong>{brandCandidates.length}</strong>
                  <span>Findings</span>
                </div>
                <div>
                  <strong className={highRisk.length ? 'text-red' : ''}>{highRisk.length}</strong>
                  <span>High Risk</span>
                </div>
              </div>

              <div className="brand-card-footer">
                <Link className="text-link" to={`/app/brands/${brand.id}`}>
                  View official registry &amp; baseline <ArrowRight size={14} />
                </Link>
                <Link className="button secondary small-btn" to={`/app/discovery?brand=${brand.id}`}>
                  <Radar size={13} /> Findings
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {!filteredBrands.length && (
        <section className="panel mt-4">
          <EmptyState
            icon={<ShieldCheck size={28} />}
            title="No matching brands"
            description="Adjust your search criteria or register a new brand entity."
          >
            <button className="button secondary" onClick={() => { setSearch(''); setIndustryFilter('all'); }}>
              Clear filters
            </button>
          </EmptyState>
        </section>
      )}

      {/* Notice */}
      <div className="notice mt-4">
        <ShieldCheck size={16} />
        <span>
          <strong>Baseline Protection Active:</strong> Registered official domains and verified assets are automatically excluded from risk calculations to prevent false alerts.
        </span>
      </div>
    </div>
  );
}
