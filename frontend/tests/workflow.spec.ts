import { expect, test } from '@playwright/test';
import { createDemoScan, freshDemo } from '../src/data';

test('landing page exposes the Sentinel X navigation and primary CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Observe what looks like you/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /From a public signal to defensible context/ })).toBeVisible();
  await expect(page.getByText('Live provenance', { exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(2);
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => !video.loop))).toBe(true);
  await page.getByRole('link', { name: 'Verify a public URL' }).click();
  await expect(page).toHaveURL(/\/verify$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'Command center', exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/);
});

test('offline scan, evidence, investigation, graph, and report survive a reload', async ({ page }) => {
  await page.route('**/api/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('link', { name: 'Enter command center' }).click();
  await expect(page.getByText('The API is unavailable.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Run demo scan' }).click();
  await expect(page.getByText('Offline demo scan complete', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Acme Secur1ty acme-security-login/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Candidate intelligence' });
  await expect(drawer.getByText('Look-alike brand name', { exact: true })).toBeVisible();
  await expect(drawer.getByText('+35 pts', { exact: true })).toHaveCount(2);
  await drawer.getByRole('button', { name: 'Create investigation' }).click();
  const form = page.getByRole('dialog', { name: 'Create investigation' });
  await form.getByLabel('Analyst notes').fill('Review credential lure and preserve source evidence.');
  await form.getByRole('button', { name: 'Create investigation' }).click();
  await expect(page).toHaveURL(/\/investigations$/);
  await page.getByRole('button', { name: /CASE SX-0001/ }).click();
  await expect(page.getByText('Review credential lure and preserve source evidence.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate evidence report' }).click();
  await expect(page).toHaveURL(/\/reports\/1$/);
  await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Look-alike brand name', exact: false })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  expect((await download).suggestedFilename()).toBe('sentinel-x-report-1.json');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible();
  await page.getByRole('link', { name: 'Threat graph', exact: true }).click();
  await page.getByRole('button', { name: 'Acme Secur1ty, Candidate', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acme Secur1ty', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect candidate' }).click();
  await expect(page.getByRole('dialog', { name: 'Candidate intelligence' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: /Acme Security acme.security/ }).click();
  await expect(page.getByText('Official asset. Excluded before scoring.', { exact: true })).toBeVisible();
});

test('connected workflow sends the API contract and displays persisted records', async ({ page }) => {
  const data = freshDemo();
  // Keep this contract test focused on a small API response; the real backend seed
  // also includes social and mobile-app fixtures.
  data.candidates = data.candidates.slice(0, 3); data.sources = data.sources.slice(0, 1);
  const calls: { path: string; body: Record<string, unknown> | null }[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    const method = route.request().method();
    const body = method === 'POST' || method === 'PATCH' ? route.request().postDataJSON() : null;
    if (method !== 'GET') calls.push({ path, body });
    let response: unknown;
    if (path === '/scans/demo' && method === 'POST') {
      const scan = createDemoScan(7); scan.findings = scan.findings.filter(f => (f.candidate_id ?? 99) <= 3); data.scans.unshift(scan); response = scan;
    } else if (path === '/investigations' && method === 'POST') {
      const item = { ...body, id: 12, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      data.investigations.push(item as typeof data.investigations[number]); response = item;
    } else if (path === '/reports' && method === 'POST') {
      const item = { ...body, id: 18, generated_at: new Date().toISOString() }; data.reports.unshift(item as typeof data.reports[number]); response = item;
    } else if (path.startsWith('/candidates/')) response = data.candidates.find(c => c.id === Number(path.split('/')[2]));
    else {
      const mapping: Record<string, keyof typeof data> = { '/brands': 'brands', '/official-assets': 'assets', '/candidates': 'candidates', '/scans': 'scans', '/investigations': 'investigations', '/reports': 'reports', '/sources': 'sources', '/graph': 'graph' };
      response = data[mapping[path]];
    }
    await route.fulfill({ json: response, status: method === 'POST' ? 201 : 200 });
  });
  await page.goto('/overview');
  await expect(page.getByText('API connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Run demo scan' }).click();
  await page.getByRole('button', { name: /Acme Secur1ty acme-security-login/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create investigation' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create investigation' }).click();
  await page.getByRole('button', { name: /CASE SX-0012/ }).click();
  await page.getByRole('button', { name: 'Generate evidence report' }).click();
  await expect(page).toHaveURL(/\/reports\/18$/);
  expect(calls.find(c => c.path === '/scans/demo')).toBeDefined();
  expect(calls.find(c => c.path === '/investigations')?.body).toMatchObject({ candidate_ids: [1], scan_id: 7, status: 'open', priority: 'high' });
  expect(calls.find(c => c.path === '/reports')?.body).toMatchObject({ scan_id: 7, report_type: 'investigation', payload: { investigation_id: 12 } });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible();
  await page.getByRole('link', { name: 'Social intelligence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No social candidates collected' })).toBeVisible();
  await expect(page.getByText('Acme Support Center', { exact: true })).toHaveCount(0);
});

test('partial API errors do not mix live records with offline fixtures', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return path.endsWith('/brands') ? route.fulfill({ json: [freshDemo().brands[0]] }) : route.fulfill({ status: 503, json: { detail: 'Unavailable for test' } });
  });
  await page.goto('/discovery');
  await expect(page.getByText('API partially available', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No candidates collected' })).toBeVisible();
  await expect(page.getByText('Acme Secur1ty', { exact: true })).toHaveCount(0);
});

test('mobile navigation and all required routes render without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', route => route.abort());
  const routes = ['/overview', '/brands', '/discovery', '/social', '/apps', '/investigations', '/threat-graph', '/reports', '/source-health'];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('.page-heading h1')).toBeVisible();
    await expect(page.getByText('The API is unavailable.', { exact: false })).toBeVisible();
    const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: window.innerWidth }));
    expect(width.scroll, route).toBeLessThanOrEqual(width.view);
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Discovery', exact: false }).click();
  await expect(page).toHaveURL(/\/discovery$/);
});

test('live verification presents provenance and deterministic signals', async ({ page }) => {
  const data = freshDemo();
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    let response: unknown;
    if (path === '/live-check') {
      response = {
        source_url: 'https://example.com', final_url: 'https://example.com', observed_at: '2026-10-14T12:00:00Z',
        http_status: 200, content_type: 'text/html; charset=utf-8', title: 'Example Domain',
        description: 'Example metadata', provider: 'example.com', domain: 'example.com', asset_type: 'website',
        mode: 'live', status: 'ok', blocked: false, error: null, links: [], changed: true, changed_fields: ['title', 'final_url'], previous_observed_at: '2026-10-14T11:00:00Z', change_summary: {},
        signals: {
          brand: { value: 'Acme Security', normalized: 'acmesecurity', matched: false, similarity: 0.2, evidence: ['brand_id supplied for comparison'] },
          name: { value: 'Example Domain', normalized: 'exampledomain', matched: false, similarity: 0.2, evidence: ['title metadata'] },
          link: { value: 'https://example.com', normalized: 'example.com', matched: false, similarity: null, evidence: ['observed final URL'] },
          detection: [{ category: 'infrastructure', signal: 'unverified_domain', evidence: 'example.com is not an official brand domain', weight: 0.15 }],
        },
      };
    } else {
      const mapping: Record<string, unknown> = { '/brands': data.brands, '/official-assets': data.assets, '/candidates': data.candidates, '/scans': data.scans, '/investigations': data.investigations, '/reports': data.reports, '/sources': data.sources, '/graph': data.graph };
      response = mapping[path] ?? [];
    }
    await route.fulfill({ status: 200, json: response });
  });
  await page.goto('/verify');
  await page.getByLabel('Public profile, app, or site URL').fill('https://example.com');
  await page.getByLabel('Protected brand').selectOption('1');
  await page.getByRole('button', { name: 'Verify URL' }).click();
  await expect(page.getByRole('heading', { name: 'Observation complete' })).toBeVisible();
  await expect(page.getByText('Exact provenance', { exact: true })).toBeVisible();
  await expect(page.getByText('mode: live', { exact: true })).toBeVisible();
  await expect(page.getByText('Example Domain', { exact: true })).toBeVisible();
  await expect(page.getByText('unverified_domain', { exact: true })).toBeVisible();
  await expect(page.getByText('Changed since the previous observation', { exact: true })).toBeVisible();
});
