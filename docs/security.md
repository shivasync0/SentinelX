# Security notes

SENTINEL X is a local/demo deployment unless an authentication and tenancy layer is
added. Do not expose the default API publicly without adding authentication,
authorization, audit-event storage, and production database controls.

Implemented protections:

- HTTP(S)-only URL validation with credentials, control characters, malformed ports,
  and backslashes rejected.
- URL fragments are removed for identity comparison; no URL is fetched during
  normalization or scanning.
- Safe JSON serialization of source metadata in the client.
- Live URL verification rejects credentials and non-public destinations, revalidates
  redirect targets, uses bounded timeouts, caps response size, and parses HTML
  metadata without executing scripts or downloading packages.
- No automatic contact, accusation, takedown, package download, or file execution.
- Explicit provenance and demo labels for synthetic data.
- Database-backed candidate feedback and report snapshots.
- Candidate and asset duplicate checks with `409 Conflict` responses.

Before production use, add request authentication, per-workspace authorization,
rate limiting, CSRF protection for cookie sessions, upload validation/storage, SSRF
guards for any future fetcher, structured audit events, and Alembic migrations.
