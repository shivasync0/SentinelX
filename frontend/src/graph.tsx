import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Focus, Globe2, Minus, Network, Plus, ShieldCheck } from 'lucide-react';
import { Badge, EmptyState, SectionHeading, useSentinel } from './App';
import { Graph, GraphNode, candidateRisk, titleCase } from './data';

const colors: Record<string, string> = { brand: '#b8ef82', candidate: '#ed8e79', official_asset: '#72c9b0', source: '#a8a1e8' };
export function ThreatMap({ graph, compact = false, onSelect, selected }: { graph: Graph; compact?: boolean; onSelect?: (node: GraphNode) => void; selected?: string }) {
  const positions = useMemo(() => {
    const lanes = ['brand', 'official_asset', 'candidate', 'source'];
    return graph.nodes.map(node => {
      const lane = lanes.includes(node.type) ? lanes.indexOf(node.type) : 2;
      const siblings = graph.nodes.filter(n => n.type === node.type);
      const index = siblings.findIndex(n => n.id === node.id);
      return { ...node, x: [130, 410, 690, 975][lane], y: 95 + (index + .5) * (420 / Math.max(siblings.length, 1)) };
    });
  }, [graph]);
  const [zoom, setZoom] = useState(1);
  const related = selected ? new Set([selected, ...graph.edges.filter(e => e.source === selected || e.target === selected).flatMap(e => [e.source, e.target])]) : null;
  return <div className={`threat-map ${compact ? 'compact' : ''}`}><svg viewBox="0 0 1100 620" role="img" aria-label="Connections between brands, verified assets, candidates, and intelligence sources">
    <defs><pattern id={compact ? 'small-grid' : 'graph-grid'} width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#505651" opacity=".5" /></pattern></defs>
    <rect width="1100" height="620" fill={`url(#${compact ? 'small-grid' : 'graph-grid'})`} />
    <g transform={`translate(${550 * (1 - zoom)}, ${310 * (1 - zoom)}) scale(${zoom})`}>
      {!compact && ['PROTECTED BRANDS', 'VERIFIED ASSETS', 'CANDIDATES', 'INTELLIGENCE SOURCES'].map((label, i) => <text className="graph-lane" key={label} x={[130, 410, 690, 975][i]} y="45" textAnchor="middle">{label}</text>)}
      {graph.edges.map((edge, index) => {
        const source = positions.find(n => n.id === edge.source), target = positions.find(n => n.id === edge.target);
        if (!source || !target) return null;
        const highlighted = edge.source === selected || edge.target === selected;
        return <path key={`${edge.source}-${edge.target}-${index}`} d={`M${source.x} ${source.y} C${(source.x + target.x) / 2} ${source.y}, ${(source.x + target.x) / 2} ${target.y}, ${target.x} ${target.y}`} fill="none" stroke={highlighted ? '#b8ef82' : edge.type === 'owns' ? '#497e6d' : '#626571'} strokeWidth={highlighted ? 2 : 1.3} opacity={selected && !highlighted ? .12 : .55}><title>{source.label} → {target.label}: {edge.type}</title></path>;
      })}
      {positions.map(node => <g key={node.id} className={onSelect ? 'graph-node interactive' : 'graph-node'} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`${node.label}, ${titleCase(node.type)}`} onClick={() => onSelect?.(node)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(node); } }} opacity={related && !related.has(node.id) ? .25 : 1}>
        <circle cx={node.x} cy={node.y} r={node.type === 'brand' ? 33 : 22} fill="#20272a" stroke={colors[node.type] ?? '#9babc0'} strokeWidth={selected === node.id ? 3 : 1.5} />
        {node.type === 'brand' ? <path d={`M${node.x} ${node.y - 13} l11 5 v9 q0 8 -11 13 q-11 -5 -11 -13 v-9 Z`} stroke={colors.brand} strokeWidth="1.8" fill="none" /> : node.type === 'official_asset' ? <path d={`M${node.x - 7} ${node.y} l5 5 l10 -11`} fill="none" stroke={colors.official_asset} strokeWidth="2.2" /> : node.type === 'source' ? <><circle cx={node.x} cy={node.y} r="8" stroke={colors.source} fill="none" /><circle cx={node.x} cy={node.y} r="3" fill={colors.source} /></> : <><circle cx={node.x} cy={node.y} r="8" stroke={colors.candidate} fill="none" /><path d={`M${node.x - 8} ${node.y} h16 M${node.x} ${node.y - 8} v16`} stroke={colors.candidate} strokeWidth="1" /></>}
        <rect x={node.x - 113} y={node.y + (node.type === 'brand' ? 43 : 32)} width="226" height="23" rx="6" fill="#1a1e21" opacity=".92" />
        <text x={node.x} y={node.y + (node.type === 'brand' ? 59 : 47)} textAnchor="middle" className="graph-label">{node.label.length > 28 ? `${node.label.slice(0, 26)}…` : node.label}</text><title>{node.label}</title>
      </g>)}
    </g>
  </svg>{!compact && <div className="graph-controls"><button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(previous => Math.min(1.8, previous + .2))}><Plus size={16} /></button><button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(previous => Math.max(.5, previous - .2))}><Minus size={16} /></button><button aria-label="Reset view" title="Reset view" onClick={() => setZoom(1)}><Focus size={16} /></button><span>{Math.round(zoom * 100)}%</span></div>}</div>;
}

export function GraphPage() {
  const { data, openCandidate } = useSentinel();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const brand = params.get('brand') ?? 'all';
  const graph = useMemo(() => {
    if (brand === 'all') return data.graph;
    const brandNode = `brand:${brand}`;
    const direct = new Set([brandNode, ...data.graph.edges.filter(e => e.source === brandNode).map(e => e.target)]);
    data.graph.edges.forEach(edge => { if (direct.has(edge.target) && edge.type === 'reported') direct.add(edge.source); });
    return { nodes: data.graph.nodes.filter(n => direct.has(n.id)), edges: data.graph.edges.filter(e => direct.has(e.source) && direct.has(e.target)) };
  }, [brand, data.graph]);
  const displayed = selected && graph.nodes.some(n => n.id === selected.id) ? selected : null;
  const candidate = displayed?.type === 'candidate' ? data.candidates.find(c => `candidate:${c.id}` === displayed.id) : undefined;
  const connections = displayed ? graph.edges.filter(e => e.source === displayed.id || e.target === displayed.id) : [];
  return <><div className="graph-top-strip"><div><Network size={18} /><strong>{graph.nodes.length}</strong> entities<span className="divider" /><strong>{graph.edges.length}</strong> relationships</div><label className="select-label">Brand filter<select aria-label="Filter graph by brand" value={brand} onChange={event => { setParams(event.target.value === 'all' ? {} : { brand: event.target.value }); setSelected(null); }}><option value="all">All monitored brands</option>{data.brands.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label></div>
    <div className="graph-layout"><section className="panel graph-panel"><SectionHeading title="Brand exposure topology" subtitle="Select an entity to inspect its relationships." />{graph.nodes.length ? <ThreatMap graph={graph} onSelect={setSelected} selected={displayed?.id} /> : <EmptyState icon={<Network size={28} />} title="No graph entities available" description="Connect the API and load monitored brands to map their relationships." />}<div className="graph-legend">{Object.entries(colors).map(([type, color]) => <span key={type}><i style={{ background: color }} />{titleCase(type)}</span>)}</div></section><aside className="panel graph-inspector"><SectionHeading title="Entity inspector" />{!displayed ? <EmptyState icon={<Network size={28} />} title="Follow a connection" description="Select a brand, asset, candidate, or source in the graph to explore the evidence trail." /> : <div className="inspector-body"><div className="asset-icon" style={{ color: colors[displayed.type] }}>{displayed.type === 'official_asset' ? <ShieldCheck size={24} /> : <Globe2 size={24} />}</div><h3>{displayed.label}</h3><Badge value={candidate ? candidateRisk(candidate.id, data.scans).label : displayed.type === 'official_asset' ? 'verified' : displayed.type} /><p className="muted">{titleCase(displayed.type)} · {connections.length} relationship{connections.length === 1 ? '' : 's'}</p>{candidate && <button className="button primary full-width" onClick={() => openCandidate(candidate.id)}>Inspect candidate <ArrowRight size={15} /></button>}<h4>CONNECTED ENTITIES</h4><div className="connected-entities">{connections.map((edge, i) => { const other = graph.nodes.find(n => n.id === (edge.source === displayed.id ? edge.target : edge.source)); return other && <button key={`${other.id}-${i}`} onClick={() => setSelected(other)}><span className="entity-dot" style={{ background: colors[other.type] }} /><span>{other.label}<small>{titleCase(edge.type)}</small></span><ArrowRight size={13} /></button>; })}</div></div>}</aside></div><div className="notice"><Network size={16} /><span>Edges represent recorded ownership, brand association, or collection provenance. An association alone does not imply malicious coordination.</span><Link to="/discovery">Review candidates <ArrowRight size={13} /></Link></div></>;
}
