import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Focus,
  Globe2,
  Info,
  List,
  Minus,
  Network,
  Plus,
  Search,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { Badge, EmptyState, SectionHeading, useSentinel } from '../../App';
import { candidateRisk, titleCase, type GraphNode } from '../../data';

interface NodePosition extends GraphNode {
  x: number;
  y: number;
  color: string;
}

const TYPE_COLORS: Record<string, string> = {
  brand: '#C6F277',
  official_asset: '#72C9B0',
  candidate: '#EF4444',
  domain: '#E5A84B',
  source: '#AB9BD0',
  publisher: '#80B1C4',
};

export function ThreatGraphPage() {
  const { data, openCandidate, openInvestigation } = useSentinel();
  const [params, setParams] = useSearchParams();

  const brandParam = params.get('brand') ?? 'all';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('candidate:8'); // Default to NovaPay VIP Club
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hideUnrelated, setHideUnrelated] = useState(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas');

  // Entity Type Filter
  const [entityFilters, setEntityFilters] = useState<Record<string, boolean>>({
    brand: true,
    official_asset: true,
    candidate: true,
    domain: true,
    source: true,
  });

  // Filter graph by brand
  const filteredGraph = useMemo(() => {
    let nodes = data.graph.nodes;
    let edges = data.graph.edges;

    if (brandParam !== 'all') {
      const brandPrefix = `brand:${brandParam}`;
      const relevantNodeIds = new Set<string>([brandPrefix]);

      edges.forEach(e => {
        if (e.source === brandPrefix) relevantNodeIds.add(e.target);
        if (e.target === brandPrefix) relevantNodeIds.add(e.source);
      });

      // Include shared domains linked to these candidates
      edges.forEach(e => {
        if (relevantNodeIds.has(e.source)) relevantNodeIds.add(e.target);
        if (relevantNodeIds.has(e.target)) relevantNodeIds.add(e.source);
      });

      nodes = nodes.filter(n => relevantNodeIds.has(n.id));
      edges = edges.filter(e => relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target));
    }

    // Apply entity filters
    nodes = nodes.filter(n => entityFilters[n.type] !== false);
    const validIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => validIds.has(e.source) && validIds.has(e.target));

    return { nodes, edges };
  }, [data.graph, brandParam, entityFilters]);

  // Position nodes across lanes
  const positionedNodes = useMemo(() => {
    const lanes: Record<string, number> = {
      brand: 140,
      official_asset: 380,
      candidate: 680,
      domain: 940,
      source: 1160,
    };

    const typeGroups: Record<string, GraphNode[]> = {};
    filteredGraph.nodes.forEach(n => {
      const type = n.type || 'candidate';
      if (!typeGroups[type]) typeGroups[type] = [];
      typeGroups[type].push(n);
    });

    const positions: NodePosition[] = [];
    Object.entries(typeGroups).forEach(([type, items]) => {
      const laneX = lanes[type] ?? 650;
      items.forEach((item, index) => {
        const spacing = 480 / Math.max(items.length, 1);
        const y = 80 + (index + 0.5) * spacing;
        positions.push({
          ...item,
          x: laneX,
          y,
          color: TYPE_COLORS[item.type] || '#969B95',
        });
      });
    });

    return positions;
  }, [filteredGraph.nodes]);

  // Connected nodes set for highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const connected = new Set<string>([selectedNodeId]);
    filteredGraph.edges.forEach(e => {
      if (e.source === selectedNodeId) connected.add(e.target);
      if (e.target === selectedNodeId) connected.add(e.source);
    });
    return connected;
  }, [selectedNodeId, filteredGraph.edges]);

  // Selected details
  const selectedNode = positionedNodes.find(n => n.id === selectedNodeId);
  const selectedCandidate = selectedNode?.type === 'candidate'
    ? data.candidates.find(c => `candidate:${c.id}` === selectedNode.id)
    : null;
  const candidateRiskInfo = selectedCandidate ? candidateRisk(selectedCandidate.id, data.scans) : null;

  const selectedEdge = selectedEdgeIndex !== null ? filteredGraph.edges[selectedEdgeIndex] : null;

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNodeId(null);
    setSelectedEdgeIndex(null);
  };

  const toggleEntityFilter = (type: string) => {
    setEntityFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="threat-graph-page">
      {/* Top Controls Strip */}
      <div className="graph-top-strip">
        <div className="graph-stats-cluster">
          <Network size={18} />
          <strong>{filteredGraph.nodes.length}</strong> Entities
          <span className="divider" />
          <strong>{filteredGraph.edges.length}</strong> Relationships
        </div>

        <div className="graph-filter-cluster">
          <div className="input-search small-search">
            <Search size={14} />
            <input
              placeholder="Search node label…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <label className="select-label">
            Brand:
            <select
              value={brandParam}
              onChange={e => {
                const next = new URLSearchParams(params);
                if (e.target.value === 'all') next.delete('brand');
                else next.set('brand', e.target.value);
                setParams(next);
                setSelectedNodeId(null);
                setSelectedEdgeIndex(null);
              }}
            >
              <option value="all">All Brands</option>
              {data.brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <div className="view-toggle-group">
            <button
              className={`icon-button ${viewMode === 'canvas' ? 'active' : ''}`}
              title="Interactive Graph Canvas"
              onClick={() => setViewMode('canvas')}
            >
              <Network size={15} />
            </button>
            <button
              className={`icon-button ${viewMode === 'list' ? 'active' : ''}`}
              title="Accessible Table View"
              onClick={() => setViewMode('list')}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="graph-layout">
        {/* Left Column: Canvas or Table */}
        <section className="panel graph-panel">
          <div className="graph-panel-header">
            <SectionHeading
              title="Threat Campaign &amp; Infrastructure Topology"
              subtitle="Select any node or edge to inspect documented evidence connections."
            />

            <div className="canvas-header-actions">
              <button
                className={`button secondary small-btn ${hideUnrelated ? 'active' : ''}`}
                onClick={() => setHideUnrelated(prev => !prev)}
                title="Dim or hide unconnected nodes when an entity is selected"
              >
                {hideUnrelated ? <EyeOff size={14} /> : <Eye size={14} />}
                {hideUnrelated ? 'Showing Connected Only' : 'Show All'}
              </button>
            </div>
          </div>

          {viewMode === 'canvas' && (
            <div
              className="threat-map full-map"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            >
              <svg viewBox="0 0 1300 600" className="interactive-graph-svg">
                <defs>
                  <pattern id="graph-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="0.8" fill="#303430" opacity="0.6" />
                  </pattern>
                  <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#969B95" />
                  </marker>
                </defs>

                <rect width="1300" height="600" fill="url(#graph-grid)" />

                {/* Transform group for Zoom & Pan */}
                <g transform={`translate(${pan.x + 650 * (1 - zoom)}, ${pan.y + 300 * (1 - zoom)}) scale(${zoom})`}>
                  {/* Lane Header Titles */}
                  <text className="graph-lane" x="140" y="35" textAnchor="middle">PROTECTED BRANDS</text>
                  <text className="graph-lane" x="380" y="35" textAnchor="middle">VERIFIED ASSETS</text>
                  <text className="graph-lane" x="680" y="35" textAnchor="middle">CANDIDATES &amp; PROFILES</text>
                  <text className="graph-lane" x="940" y="35" textAnchor="middle">SHARED DOMAINS</text>
                  <text className="graph-lane" x="1160" y="35" textAnchor="middle">INTEL SOURCES</text>

                  {/* Edges */}
                  {filteredGraph.edges.map((edge, index) => {
                    const source = positionedNodes.find(n => n.id === edge.source);
                    const target = positionedNodes.find(n => n.id === edge.target);
                    if (!source || !target) return null;

                    const isSelected = selectedEdgeIndex === index;
                    const isConnectedToSelectedNode = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
                    const isSharedDomain = edge.type === 'shared_domain';

                    // Opacity control
                    let opacity = 0.5;
                    if (selectedNodeId) {
                      opacity = isConnectedToSelectedNode ? 1 : hideUnrelated ? 0.05 : 0.15;
                    }

                    // Stroke style
                    const strokeColor = isSelected
                      ? '#C6F277'
                      : isSharedDomain
                      ? '#EF4444'
                      : edge.type === 'owns'
                      ? '#72C9B0'
                      : '#969B95';

                    const strokeWidth = isSelected ? 3 : isSharedDomain ? 2.5 : 1.4;
                    const isDashed = isSharedDomain || edge.type === 'links_to';

                    // Curved Path
                    const midX = (source.x + target.x) / 2;
                    const midY = (source.y + target.y) / 2;
                    const d = `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;

                    return (
                      <g key={`${edge.source}-${edge.target}-${index}`}>
                        <path
                          d={d}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={isDashed ? '5 4' : undefined}
                          opacity={opacity}
                          style={{ cursor: 'pointer' }}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedEdgeIndex(index);
                            setSelectedNodeId(null);
                          }}
                        >
                          <title>{`${edge.type}: ${source.label} → ${target.label}`}</title>
                        </path>

                        {/* Shared domain label bubble */}
                        {isSharedDomain && (
                          <g transform={`translate(${midX}, ${midY})`} style={{ cursor: 'pointer' }} onClick={() => setSelectedEdgeIndex(index)}>
                            <rect x="-46" y="-10" width="92" height="20" rx="4" fill="#171917" stroke="#EF4444" strokeWidth="1.2" />
                            <text x="0" y="3.5" textAnchor="middle" fill="#EF4444" fontSize="8.5" fontWeight="600">
                              SHARED DOMAIN
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {positionedNodes.map(node => {
                    const isSelected = selectedNodeId === node.id;
                    const isConnected = connectedNodeIds?.has(node.id);
                    const isSearchMatch = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase());

                    let opacity = 1;
                    if (selectedNodeId && !isSelected && !isConnected) {
                      opacity = hideUnrelated ? 0.08 : 0.25;
                    }

                    const radius = node.type === 'brand' ? 30 : node.type === 'domain' ? 24 : 20;

                    return (
                      <g
                        key={node.id}
                        className="graph-node interactive"
                        opacity={opacity}
                        role="button"
                        tabIndex={0}
                        aria-label={`${node.label}, ${titleCase(node.type)}`}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                          setSelectedEdgeIndex(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedNodeId(node.id);
                            setSelectedEdgeIndex(null);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Glow ring on selection or search match */}
                        {(isSelected || isSearchMatch) && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={radius + 8}
                            fill="none"
                            stroke="#C6F277"
                            strokeWidth="2.5"
                            strokeDasharray="4 3"
                          />
                        )}

                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={radius}
                          fill="#171917"
                          stroke={node.color}
                          strokeWidth={isSelected ? 3 : 1.8}
                        />

                        {/* Node Icon glyph */}
                        {node.type === 'brand' ? (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#C6F277" fontSize="11" fontWeight="700">
                            {node.label.slice(0, 2).toUpperCase()}
                          </text>
                        ) : node.type === 'official_asset' ? (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#72C9B0" fontSize="11">✓</text>
                        ) : node.type === 'domain' ? (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#E5A84B" fontSize="9">DOM</text>
                        ) : node.type === 'source' ? (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#AB9BD0" fontSize="9">SRC</text>
                        ) : (
                          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#EF4444" fontSize="10">!</text>
                        )}

                        {/* Node Label Pill */}
                        <rect
                          x={node.x - 70}
                          y={node.y + radius + 7}
                          width="140"
                          height="20"
                          rx="4"
                          fill="#171917"
                          stroke={isSelected ? '#C6F277' : '#303430'}
                          strokeWidth={isSelected ? 1.5 : 1}
                          opacity="0.95"
                        />
                        <text
                          x={node.x}
                          y={node.y + radius + 20}
                          textAnchor="middle"
                          className="graph-label"
                          fill="#F0F0E9"
                          fontSize="9.5"
                        >
                          {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Floating Canvas Controls */}
              <div className="graph-controls">
                <button title="Zoom in" onClick={() => setZoom(prev => Math.min(2, prev + 0.2))}>
                  <Plus size={15} />
                </button>
                <button title="Zoom out" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}>
                  <Minus size={15} />
                </button>
                <button title="Reset view and pan" onClick={resetView}>
                  <Focus size={15} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
            </div>
          )}

          {/* Accessible List / Table Alternative */}
          {viewMode === 'list' && (
            <div className="table-scroll p-3">
              <table className="candidate-table">
                <thead>
                  <tr>
                    <th>Entity Identifier</th>
                    <th>Type</th>
                    <th>Label / Canonical Name</th>
                    <th>Relationships</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGraph.nodes.map(node => {
                    const connections = filteredGraph.edges.filter(e => e.source === node.id || e.target === node.id);
                    return (
                      <tr
                        key={node.id}
                        className={selectedNodeId === node.id ? 'selected-row' : ''}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <td className="mono">{node.id}</td>
                        <td>
                          <span className="type-tag" style={{ borderColor: TYPE_COLORS[node.type] }}>
                            {titleCase(node.type)}
                          </span>
                        </td>
                        <td>
                          <strong>{node.label}</strong>
                        </td>
                        <td>{connections.length} linked edges</td>
                        <td>
                          <button
                            className="button secondary small-btn"
                            onClick={() => {
                              setSelectedNodeId(node.id);
                              setViewMode('canvas');
                            }}
                          >
                            Inspect in canvas
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Legend */}
          <div className="graph-legend">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <button
                key={type}
                className={`legend-pill ${entityFilters[type] === false ? 'disabled' : ''}`}
                onClick={() => toggleEntityFilter(type)}
                title={`Toggle ${titleCase(type)} entities`}
              >
                <i style={{ background: color }} />
                <span>{titleCase(type)}</span>
              </button>
            ))}
            <span className="divider" />
            <span className="legend-edge-guide">
              <span className="edge-solid" /> Confirmed / Ownership
              <span className="edge-dashed" /> Shared Domain Nexus
            </span>
          </div>
        </section>

        {/* Right Column: Entity & Edge Inspector Panel */}
        <aside className="panel graph-inspector">
          <SectionHeading
            title="Topology Inspector"
            subtitle="Auditable provenance behind selected relationships"
          />

          {/* Selected Edge Inspector */}
          {selectedEdge && (
            <div className="inspector-body">
              <div className="inspector-edge-card">
                <span className="badge badge-critical">RELATIONSHIP EVIDENCE</span>
                <h3>{titleCase(selectedEdge.type)}</h3>
                <div className="edge-endpoints">
                  <div>
                    <label>Source:</label>
                    <strong>{selectedEdge.source}</strong>
                  </div>
                  <div>
                    <label>Target:</label>
                    <strong>{selectedEdge.target}</strong>
                  </div>
                </div>

                <div className="edge-explanation-box">
                  <Info size={16} />
                  <div>
                    <strong>Why This Relationship Exists:</strong>
                    <p>{selectedEdge.evidence || 'Recorded direct correlation from intelligence collection.'}</p>
                  </div>
                </div>

                {selectedEdge.domain && (
                  <div className="edge-domain-tag">
                    <Globe2 size={14} /> Shared Domain: <span className="mono">{selectedEdge.domain}</span>
                  </div>
                )}

                <button
                  className="button secondary full-width mt-3"
                  onClick={() => setSelectedEdgeIndex(null)}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Selected Node Inspector */}
          {selectedNode && !selectedEdge && (
            <div className="inspector-body">
              <div className="inspector-node-header">
                <div className="asset-icon" style={{ borderColor: selectedNode.color, color: selectedNode.color }}>
                  {selectedNode.type === 'official_asset' ? <ShieldCheck size={22} /> : selectedNode.type === 'brand' ? <Shield size={22} /> : <Globe2 size={22} />}
                </div>
                <div>
                  <span className="type-tag">{titleCase(selectedNode.type)}</span>
                  <h3>{selectedNode.label}</h3>
                  <small className="mono">{selectedNode.id}</small>
                </div>
              </div>

              {candidateRiskInfo && (
                <div className="inspector-risk-strip">
                  <div>
                    <span>ASSESSMENT</span>
                    <strong>{candidateRiskInfo.score === null ? '—' : Math.round(candidateRiskInfo.score * 100)} / 100</strong>
                  </div>
                  <Badge value={candidateRiskInfo.label} />
                </div>
              )}

              {selectedCandidate && (
                <div className="inspector-actions-group">
                  <button
                    className="button primary full-width"
                    onClick={() => openCandidate(selectedCandidate.id)}
                  >
                    Inspect candidate <ArrowRight size={14} />
                  </button>
                  <button
                    className="button secondary full-width mt-2"
                    onClick={() => openInvestigation([selectedCandidate.id])}
                  >
                    <Fingerprint size={14} /> Create Investigation Case
                  </button>
                </div>
              )}

              {/* Connected Entities List */}
              <div className="inspector-connected-section">
                <h4>CONNECTED TOPOLOGY NODES ({connectedNodeIds ? connectedNodeIds.size - 1 : 0})</h4>
                <div className="connected-entities">
                  {filteredGraph.edges
                    .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((edge, idx) => {
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const otherNode = positionedNodes.find(n => n.id === otherId);
                      if (!otherNode) return null;

                      return (
                        <button
                          key={`${otherId}-${idx}`}
                          onClick={() => {
                            setSelectedNodeId(otherId);
                            setSelectedEdgeIndex(null);
                          }}
                        >
                          <span className="entity-dot" style={{ background: otherNode.color }} />
                          <div>
                            <strong>{otherNode.label}</strong>
                            <small>{titleCase(edge.type)}</small>
                          </div>
                          <ArrowRight size={13} />
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Empty State when nothing is selected */}
          {!selectedNode && !selectedEdge && (
            <div className="inspector-body">
              <EmptyState
                icon={<Network size={28} />}
                title="Explore Threat Graph"
                description="Click any brand, candidate, or domain node to inspect relationships, evidence weights, and shared infrastructure."
              />
            </div>
          )}
        </aside>
      </div>

      {/* Notice */}
      <div className="notice mt-4">
        <Network size={16} />
        <span>
          <strong>Campaign Relationship Standard:</strong> Edges represent recorded ownership, explicit metadata links, or documented shared infrastructure. An association alone does not imply malicious intent unless supported by detection signals.
        </span>
      </div>
    </div>
  );
}
