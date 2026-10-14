"""Permitted public live-source adapters used by the on-demand live scan.

The adapters use fixed provider hosts, bounded timeouts, and retain the provider
response as normalized metadata. They never scrape authenticated pages or download
application packages.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import quote_plus, urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .detection import normalize_name
from .models import Brand, Candidate, Source
from .normalization import normalize_domain, normalize_url, url_key

BLUESKY_SEARCH_URL = "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors"
APPLE_SEARCH_URL = "https://itunes.apple.com/search"


@dataclass
class LiveCollection:
    candidates: list[Candidate] = field(default_factory=list)
    sources: list[Source] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0), follow_redirects=False)


def _get_or_create_source(db: Session, *, url: str, title: str, source_type: str) -> Source:
    source = db.scalar(select(Source).where(Source.url == url))
    if source is None:
        source = Source(url=url, title=title, publisher=title, source_type=source_type, trust_level="live")
        db.add(source)
        db.flush()
    return source


def _upsert_candidate(db: Session, brand: Brand, source: Source, *, name: str, candidate_type: str,
                      url: str | None, domain: str | None, metadata: dict) -> Candidate:
    canonical_url = normalize_url(url) if url else None
    candidate = None
    if canonical_url:
        key = url_key(canonical_url)
        candidates = db.scalars(select(Candidate).where(
            Candidate.brand_id == brand.id, Candidate.candidate_type == candidate_type,
        )).all()
        candidate = next((item for item in candidates if item.url and url_key(item.url) == key), None)
    if candidate is None:
        candidate = Candidate(
            brand_id=brand.id, source_id=source.id, name=name.strip(),
            normalized_name=normalize_name(name), candidate_type=candidate_type,
            domain=normalize_domain(domain) if domain else (normalize_domain(canonical_url) if canonical_url else None),
            url=canonical_url, metadata_json={**metadata, "mode": "live"},
        )
        db.add(candidate)
    else:
        candidate.source_id = source.id
        candidate.name = name.strip()
        candidate.normalized_name = normalize_name(name)
        candidate.metadata_json = {**(candidate.metadata_json or {}), **metadata, "mode": "live"}
    return candidate


def fetch_bluesky(db: Session, brand: Brand, client: httpx.Client) -> tuple[list[Candidate], Source | None, str | None]:
    source = _get_or_create_source(db, url=BLUESKY_SEARCH_URL, title="Bluesky public actor search", source_type="social")
    try:
        response = client.get(BLUESKY_SEARCH_URL, params={"q": brand.canonical_name, "limit": 25})
        response.raise_for_status()
        payload = response.json()
        items = payload.get("actors", []) if isinstance(payload, dict) else []
        candidates = []
        for actor in items:
            if not isinstance(actor, dict) or not actor.get("handle"):
                continue
            handle = str(actor["handle"])
            profile_url = f"https://bsky.app/profile/{quote_plus(handle)}"
            candidates.append(_upsert_candidate(
                db, brand, source, name=str(actor.get("displayName") or handle), candidate_type="social",
                url=profile_url, domain="bsky.app", metadata={
                    "platform": "Bluesky", "handle": handle, "actor_id": actor.get("did"),
                    "followers": actor.get("followersCount"), "avatar": actor.get("avatar"),
                    "provider_query": brand.canonical_name,
                },
            ))
        return candidates, source, None
    except (httpx.HTTPError, ValueError) as error:
        return [], source, f"Bluesky unavailable: {error.__class__.__name__}"


def fetch_apple_apps(db: Session, brand: Brand, client: httpx.Client) -> tuple[list[Candidate], Source | None, str | None]:
    source = _get_or_create_source(db, url=APPLE_SEARCH_URL, title="Apple App Store Search API", source_type="mobile_app")
    try:
        response = client.get(APPLE_SEARCH_URL, params={"term": brand.canonical_name, "entity": "software", "limit": 25, "country": "us"})
        response.raise_for_status()
        payload = response.json()
        items = payload.get("results", []) if isinstance(payload, dict) else []
        candidates = []
        for item in items:
            if not isinstance(item, dict) or not item.get("trackName") or not item.get("trackViewUrl"):
                continue
            listing_url = str(item["trackViewUrl"])
            candidates.append(_upsert_candidate(
                db, brand, source, name=str(item["trackName"]), candidate_type="mobile_app",
                url=listing_url, domain=urlparse(listing_url).hostname, metadata={
                    "store": "Apple App Store", "app_identifier": item.get("bundleId"),
                    "publisher": item.get("sellerName") or item.get("artistName"),
                    "icon": item.get("artworkUrl100"), "description": item.get("description"),
                    "provider_query": brand.canonical_name,
                },
            ))
        return candidates, source, None
    except (httpx.HTTPError, ValueError) as error:
        return [], source, f"Apple App Store unavailable: {error.__class__.__name__}"


def collect_live_candidates(db: Session, brand: Brand) -> LiveCollection:
    """Collect one bounded snapshot from both public adapters."""
    collection = LiveCollection()
    try:
        with _client() as client:
            for fetcher in (fetch_bluesky, fetch_apple_apps):
                candidates, source, error = fetcher(db, brand, client)
                collection.candidates.extend(candidates)
                if source is not None:
                    collection.sources.append(source)
                if error:
                    collection.errors.append(error)
    except httpx.HTTPError as error:
        collection.errors.append(f"Live source client unavailable: {error.__class__.__name__}")
    return collection
