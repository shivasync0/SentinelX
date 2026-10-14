# Data sources and provenance

The included demonstration is synthetic. It uses three explicitly labeled fixture
sources:

- Sentinel X Demo Feed: a general candidate feed.
- Sentinel X Demo Social Feed: a social profile fixture.
- Sentinel X Demo App Feed: a mobile application listing fixture.

The source-health API returns `demo` for these records and explicitly states that no
live connectivity check occurred. Manually created sources return `unverified` until
a real adapter records an observation. The UI shows the same distinction in its
source-health page and offline banner.

## Live on-demand collection

The connected workspace exposes `POST /api/brands/{brand_id}/live-scan`. It makes a
bounded request to two permitted public APIs:

- Bluesky public actor search, queried by the protected brand name.
- Apple App Store Search API, queried for software listings in the US storefront.

Live records are stored with `metadata.mode = "live"`, provider provenance, and the
original profile or listing URL. The API returns `deterministic: false` and marks a
scan `partially_completed` if one provider times out or returns an error. Source
health labels these observations `live` after collection.

This is live **on-demand collection**, not continuous streaming. It does not cover
every social network or Android marketplace and does not claim global coverage.

## Adapter contract for additional providers

Additional live adapters should:

1. Report an identifier, capability list, and configuration state.
2. Return normalized candidate records plus original provenance.
3. Respect documented API terms, timeouts, and rate limits.
4. Surface unavailable and partially completed states instead of fabricating records.
5. Never scrape behind authentication or bypass access controls.

CSV/JSON import is the honest fallback when a provider is not configured. Imported
records should carry `metadata.mode = "imported"`; the seeded records carry
`metadata.demo = true`.
