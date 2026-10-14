# Sentinel X frontend

A Vite + React + TypeScript brand-protection workspace with a charcoal enterprise UI. React Router handles page navigation; Lucide supplies icons. No component framework or external chart/graph service is required.

## Run

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Run the independent FastAPI backend on **http://localhost:8000** using the root README instructions.

```bash
npm run build    # strict TypeScript check and production assets in dist/
npm run preview  # serve the production build on http://localhost:4173
npm test         # evidence isolation, official exclusions, graph integrity
npm run test:e2e # browser demo/API-contract flows and mobile routing
```

Browser tests use installed Microsoft Edge on Windows. On other platforms, run `npx playwright install chromium` first. API contract tests intercept responses; they do not mutate the running backend.

## API connection

Requests default to same-origin `/api`. Vite dev and preview proxy those requests to **http://localhost:8000/api**, allowing the existing backend to run without CORS changes. Backend endpoint contracts are defined in `src/data.ts` and used in `src/api.ts`.

For a different deployment, set `VITE_API_BASE_URL` before building (see `.env.example`). A direct origin such as `http://localhost:8000/api` requires the backend to allow the frontend origin through CORS. When hosting `dist/`, configure a `/api` reverse proxy and rewrite non-file frontend routes to `index.html`. Vite proxy configuration only applies to dev/preview.

The UI loads brands, official assets, candidates, scans, investigations, reports, sources, and graph resources. Partial API failures are shown explicitly, with failed resources left empty. API and fixture records are never mixed.

## Demo flow

1. Open the landing page, then **Enter command center**.
2. Click **Run demo scan**. With the API connected, this calls `POST /api/scans/demo` and renders returned evidence and scores.
3. Open **Live verification** to submit a public profile, app, or site URL. The page sends `{url, brand_id?, asset_type}` to `POST /api/live-check` and renders loading, error, blocked, and structured live-result states.
4. Review exact provenance in the result: source and final URL, observed time, HTTP status, content type, title/description, domain/provider, `mode: live`, and deterministic signals. The result is an observation for investigation, not a maliciousness verdict.
5. With the backend connected, click **Run live scan** to query Bluesky's public actor search and Apple's public App Store Search API. Live records are stored with provenance and are never mixed with offline fixtures.
6. In **Discovery**, open a candidate to inspect its per-signal evidence, score contributions, provenance, and official-asset exclusion status.
7. Use **View connections**, or open **Threat graph**, to inspect interactive entities and relationships. Filter by protected brand and use zoom controls.
8. Create an investigation from a candidate or selected candidates. Provide title, priority, and notes. Connected mode uses `POST /api/investigations`; status changes use `PATCH`.
9. Expand the case in **Investigations**, then **Generate evidence report**. Connected mode uses `POST /api/reports` with a snapshot of candidate records, findings, and context.
10. The resulting `/reports/:id` page supports a report link, JSON download, and print/save PDF.

## Offline behavior

If every API resource fails, the workspace clearly switches to **offline demo**. Seeded fixtures are available, including illustrative social/app records. Run a demo scan to reveal fixture evidence, create investigations, change their status, and generate reports. These demo changes persist in browser local storage only; they are not synced into the backend. Retry the API connection to switch back to API records. A report URL in offline mode is browser-local; export JSON or PDF to share it.

The backend seed includes web, social, and mobile-app candidates. Source uptime and ingestion latency are labeled unreported because the API supplies source provenance/trust metadata, not collector telemetry.

Google Fonts are optional progressive enhancement; system fonts work when font delivery is unavailable. Other demo interactions do not depend on external services.

## Routes

`/`, `/overview`, `/verify`, `/brands`, `/brands/new`, `/discovery`, `/social`, `/apps`, `/investigations`, `/threat-graph`, `/reports`, `/reports/:id`, `/source-health`.

Candidate inspection is deep-linked through `/discovery?candidate=:id`. Discovery and graph support a `brand` query parameter.
