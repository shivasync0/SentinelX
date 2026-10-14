# SENTINEL X

Evidence-first digital risk protection for suspicious social identities, domains, and
mobile applications. This repository contains a FastAPI backend and a Vite/React
analyst workspace. The default experience is a repeatable synthetic demo; live
provider integrations are not required.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API is available at `http://127.0.0.1:8000`; interactive docs are at `/docs`.
In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to the backend. Copy `.env.example`
to `.env` when a different database, CORS origin, or API base is required.

Set `SENTINEL_DATABASE_URL` to use another SQLite URL, for example
`sqlite:///./sentinel-dev.db`. Tables and demo data are created on startup. Seeding is
idempotent. For explicit local setup or reset:

```bash
python -m scripts.seed_demo
python -m scripts.reset_demo  # local/demo only; deletes application rows
```

## Main resources

* `GET/POST/PATCH/DELETE /api/brands`, `GET /api/brands/{id}`
* `GET/POST/PATCH/DELETE /api/official-assets`, `GET /api/brands/{id}/official-assets`
* `GET/POST /api/candidates`, `GET /api/candidates/{id}`
* `POST /api/candidates/{id}/feedback`
* `POST /api/live-check` for one safe public profile, app listing, or website observation
* `GET/POST /api/scans`, `GET /api/scans/{id}`, `POST /api/scans/demo`
* `POST /api/brands/{id}/live-scan` (Bluesky + Apple App Store public APIs)
* `GET/POST /api/investigations`, `GET/PATCH /api/investigations/{id}`
* `GET /api/graph` (optional `brand_id` filter)
* `GET/POST /api/sources`, `GET /api/sources/health`, `GET/POST /api/reports`
* `GET /health`

`POST /api/scans` accepts `{ "candidate_ids": [1, 2], "deterministic": true }`. If no IDs are supplied, all candidates are scanned. Scan findings include the signal, evidence, weight, and contribution used to produce the score. Official assets always take precedence and are excluded before risk scoring.

## Checks

```bash
pytest
cd frontend
npm test
npm run build
```

Backend tests use temporary SQLite databases and cover normalization/look-alike
similarity, official-asset exclusion precedence, explainable scoring, deterministic
scans, social/app seed data, source health, graph evidence, feedback persistence, and
the public API. Frontend unit tests cover fixture isolation, official exclusions,
graph integrity, and risk labels.

## Honest demo boundaries

The Acme Security / Northstar Cloud records are synthetic and marked as demo data.
The **Run live scan** action performs bounded on-demand requests to Bluesky's public
actor search and Apple's public App Store Search API. It is not continuous streaming
and does not imply coverage of every platform. No accounts are contacted, no app
packages are downloaded, and no takedown or maliciousness claim is automated. The
backend is a local/demo deployment without authentication or multi-tenant controls.
The **Live verification** page additionally accepts one public HTTP(S) URL, extracts
metadata only, records exact provenance, and compares deterministic signals against
an optional protected brand.

See `docs/architecture.md`, `docs/detection-engine.md`, `docs/data-sources.md`,
`docs/security.md`, and `docs/demo-script.md` for architecture, detector limits,
provenance, security gaps, and a repeatable presentation flow.
