import { useCallback, useEffect, useRef, useState } from 'react';
import { Asset, Brand, Candidate, Dataset, Investigation, Report, Scan, freshDemo, graphFromData } from './data';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const storageKey = 'sentinel-x-offline-workspace-v2';

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    let detail = `API returned ${response.status}`;
    try {
      const body = await response.json();
      if (body?.mode === 'live' && body?.status === 'blocked' && typeof body?.source_url === 'string') return body as T;
      detail = typeof body.detail === 'string' ? body.detail : detail;
    } catch { /* use HTTP status */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

function initialDemo(): Dataset {
  const base = freshDemo();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      const brands = Array.isArray(saved.brands) ? (saved.brands as Brand[]) : base.brands;
      const assets = Array.isArray(saved.assets) ? (saved.assets as Asset[]) : base.assets;
      const candidates = Array.isArray(saved.candidates) ? (saved.candidates as Candidate[]) : base.candidates;
      const sources = base.sources;
      const scans = Array.isArray(saved.scans) ? (saved.scans as Scan[]) : base.scans;
      const investigations = Array.isArray(saved.investigations) ? (saved.investigations as Investigation[]) : base.investigations;
      const reports = Array.isArray(saved.reports) ? (saved.reports as Report[]) : base.reports;
      const graph = saved.graph && Array.isArray(saved.graph.nodes) ? saved.graph : graphFromData(brands, assets, candidates, sources);
      return { brands, assets, candidates, sources, scans, investigations, reports, graph };
    }
  } catch { /* invalid or unavailable local storage: start a fresh demo */ }
  return base;
}

export type Mode = 'loading' | 'live' | 'demo' | 'partial';
const resources = {
  brands: '/brands',
  assets: '/official-assets',
  candidates: '/candidates',
  scans: '/scans',
  investigations: '/investigations',
  reports: '/reports',
  sources: '/sources',
  graph: '/graph',
} as const;

export function useWorkspace() {
  const [data, setData] = useState<Dataset>(initialDemo);
  const [mode, setMode] = useState<Mode>('loading');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++sequence.current;
    setLoading(true);
    const keys = Object.keys(resources) as (keyof Dataset)[];
    const results = await Promise.allSettled(keys.map(key => request<Dataset[typeof key]>(resources[key])));
    if (version !== sequence.current) return;
    const failures = keys.filter((_, i) => results[i].status === 'rejected');
    if (failures.length === keys.length) {
      setData(initialDemo());
      setMode('demo');
      setErrors(['The API is unavailable. Showing offline demo fixtures; demo changes are saved only in this browser.']);
    } else {
      // Never mix fixture records with live records: absent live resources are empty.
      const next: Dataset = { brands: [], assets: [], candidates: [], scans: [], investigations: [], reports: [], sources: [], graph: { nodes: [], edges: [] } };
      keys.forEach((key, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') Object.assign(next, { [key]: result.value });
      });
      setData(next);
      setMode(failures.length ? 'partial' : 'live');
      setErrors(failures.map(key => `${titleForResource(key)} could not be loaded. Retry to reconnect.`));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh]);

  const saveDemo = useCallback((update: (previous: Dataset) => Dataset) => {
    setData(previous => {
      const next = update(previous);
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          brands: next.brands,
          assets: next.assets,
          candidates: next.candidates,
          scans: next.scans,
          investigations: next.investigations,
          reports: next.reports,
          graph: next.graph,
        }));
      } catch { /* browsing remains available without persistence */ }
      return next;
    });
  }, []);

  const resetWorkspace = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch { /* noop */ }
    setData(freshDemo());
  }, []);

  const addScan = (scan: Scan) => setData(previous => ({ ...previous, scans: [scan, ...previous.scans.filter(s => s.id !== scan.id)] }));
  const addInvestigation = (investigation: Investigation) => setData(previous => ({ ...previous, investigations: [...previous.investigations.filter(i => i.id !== investigation.id), investigation] }));
  const addReport = (report: Report) => setData(previous => ({ ...previous, reports: [report, ...previous.reports.filter(r => r.id !== report.id)] }));

  return { data, mode, loading, errors, refresh, saveDemo, resetWorkspace, addScan, addInvestigation, addReport };
}

const titleForResource = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
