import { describe, expect, it } from 'vitest';
import { candidateEvidence, candidateRisk, createDemoScan, freshDemo } from './data';

describe('evidence-first demo workflow', () => {
  it('does not claim a score before the first scan', () => {
    expect(candidateRisk(1, [])).toEqual({ label: 'unscanned', score: null });
  });
  it('excludes verified official assets before scoring', () => {
    const scan = createDemoScan(1);
    expect(candidateRisk(2, [scan])).toEqual({ label: 'verified', score: 0 });
    expect(candidateEvidence(2, [scan]).every(f => f.excluded)).toBe(true);
    expect(candidateRisk(1, [scan]).label).toBe('critical');
  });
  it('keeps candidate evidence isolated and uses the latest applicable scan', () => {
    const first = createDemoScan(1);
    const second = { ...createDemoScan(2), findings: [{ ...first.findings[0], candidate_id: 3, score_contribution: .2 }] };
    expect(candidateEvidence(1, [second, first])).toEqual(first.findings.filter(f => f.candidate_id === 1));
    expect(candidateRisk(3, [first, second])).toEqual({ label: 'low', score: .2 });
    expect(candidateEvidence(999, [first, second])).toEqual([]);
  });
  it('never connects graph edges to absent entities', () => {
    const { graph } = freshDemo();
    const ids = new Set(graph.nodes.map(n => n.id));
    expect(graph.edges.every(edge => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
  });
});
