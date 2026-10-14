"""Safe, metadata-only public URL observations.

This module deliberately has no file, archive, package, or JavaScript handling. It
performs a small HTML GET with a byte cap, following only a bounded number of
redirects. Every host, including redirect targets, is checked before it is sent to
the HTTP client.
"""

from __future__ import annotations

import ipaddress
import socket
from datetime import datetime, timezone
from html.parser import HTMLParser
from types import SimpleNamespace
from urllib.parse import urljoin, urlsplit

import httpx

from .detection import hostname, name_similarity, normalize_name, score_candidate
from .models import Brand, OfficialAsset
from .normalization import normalize_domain, normalize_url

MAX_REDIRECTS = 5
MAX_RESPONSE_BYTES = 512 * 1024
MAX_EXTRACTED_LINKS = 50
REQUEST_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class PublicURLRejected(ValueError):
    """The URL is syntactically valid but is not safe to request."""


class ResponseTooLarge(ValueError):
    pass


class _MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.description: str | None = None
        self.links: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {key.casefold(): value for key, value in attrs}
        tag = tag.casefold()
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            name = (attributes.get("name") or attributes.get("property") or "").casefold()
            if name in {"description", "og:description", "twitter:description"} and self.description is None:
                content = attributes.get("content")
                if content:
                    self.description = content
        elif tag == "a" and attributes.get("href") and len(self.links) < MAX_EXTRACTED_LINKS:
            self.links.append(attributes["href"] or "")

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and len("".join(self.title_parts)) < 500:
            self.title_parts.append(data)

    @property
    def title(self) -> str | None:
        value = " ".join("".join(self.title_parts).split())[:500]
        return value or None


def _header(response: object, name: str) -> str | None:
    headers = getattr(response, "headers", {})
    value = headers.get(name)
    if value is None:
        value = headers.get(name.lower())
    if value is None:
        value = headers.get(name.title())
    return str(value) if value is not None else None


def _is_public_ip(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError as error:
        raise PublicURLRejected("hostname resolved to an invalid IP address") from error
    # is_global excludes private, loopback, link-local, multicast, unspecified,
    # documentation, benchmarking, and otherwise reserved address ranges.
    return address.is_global


def _resolve_public_host(url: str) -> None:
    parsed = urlsplit(url)
    host = parsed.hostname
    if not host:
        raise PublicURLRejected("hostname is required")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        literal = None
    if literal is not None:
        if not _is_public_ip(str(literal)):
            raise PublicURLRejected("private, loopback, link-local, or reserved address is not allowed")
        return
    try:
        records = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise PublicURLRejected("hostname could not be resolved") from error
    addresses = {record[4][0] for record in records if record[4]}
    if not addresses:
        raise PublicURLRejected("hostname did not resolve to an address")
    if any(not _is_public_ip(address) for address in addresses):
        raise PublicURLRejected("hostname resolves to a private, loopback, link-local, or reserved address")


def validate_public_url(value: str) -> str:
    """Normalize and DNS-check one URL without making an HTTP request."""
    normalized = normalize_url(value)
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
        raise PublicURLRejected("only public HTTP(S) URLs without credentials are allowed")
    _resolve_public_host(normalized)
    return normalized


def _safe_links(raw_links: list[str], base_url: str) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()
    for raw in raw_links:
        try:
            candidate = normalize_url(urljoin(base_url, raw))
            parsed = urlsplit(candidate)
            if parsed.scheme not in {"http", "https"} or parsed.username or parsed.password:
                continue
        except (TypeError, ValueError):
            continue
        if candidate not in seen:
            seen.add(candidate)
            links.append(candidate)
    return links


def _read_limited(response: object) -> bytes:
    content_length = _header(response, "content-length")
    if content_length:
        try:
            if int(content_length) > MAX_RESPONSE_BYTES:
                raise ResponseTooLarge("response body exceeds the configured limit")
        except ValueError:
            pass
    chunks: list[bytes] = []
    size = 0
    iterator = getattr(response, "iter_bytes", None)
    if iterator is None:
        body = getattr(response, "content", b"")
        if len(body) > MAX_RESPONSE_BYTES:
            raise ResponseTooLarge("response body exceeds the configured limit")
        return bytes(body)
    for chunk in iterator():
        size += len(chunk)
        if size > MAX_RESPONSE_BYTES:
            raise ResponseTooLarge("response body exceeds the configured limit")
        chunks.append(chunk)
    return b"".join(chunks)


def _signal(value: str | None = None, *, normalized: str | None = None, matched: bool = False,
            similarity: float | None = None, evidence: list[str] | None = None) -> dict:
    return {
        "value": value,
        "normalized": normalized,
        "matched": matched,
        "similarity": similarity,
        "evidence": evidence or [],
    }


def _signals(*, title: str | None, final_url: str | None, links: list[str], brand: Brand | None,
             official_assets: list[OfficialAsset], asset_type: str) -> dict:
    final_domain = None
    if final_url:
        try:
            final_domain = hostname(final_url)
        except ValueError:
            final_domain = None
    name_value = title or final_domain
    name_normalized = normalize_name(name_value)
    brand_name = brand.canonical_name if brand else None
    similarity = name_similarity(name_value, brand_name) if brand_name else None
    official_domains = {hostname(item) for item in (brand.domains if brand else [])}
    official_domains.discard("")
    link_matches_brand = bool(final_domain and final_domain in official_domains)
    candidate = None
    detection: list[dict] = []
    if brand and final_url:
        candidate = SimpleNamespace(
            name=name_value or "", normalized_name=name_normalized, candidate_type=asset_type,
            domain=final_domain, url=final_url, source_id=None,
        )
        result = score_candidate(candidate, brand, official_assets)
        detection = [item.__dict__ for item in result.explanation]
        if result.excluded:
            link_matches_brand = True

    return {
        "brand": _signal(
            brand_name,
            normalized=normalize_name(brand_name),
            matched=bool(brand_name and (similarity is not None and similarity >= 0.78 or link_matches_brand)),
            similarity=similarity,
            evidence=["brand_id supplied for comparison"] if brand else ["no brand_id supplied"],
        ),
        "name": _signal(
            name_value,
            normalized=name_normalized,
            matched=bool(similarity is not None and similarity >= 0.78),
            similarity=similarity,
            evidence=["title metadata" if title else "final URL domain"],
        ),
        "link": _signal(
            final_url,
            normalized=final_domain,
            matched=link_matches_brand,
            evidence=["final domain matches a registered brand domain"] if link_matches_brand else ["observed final URL"],
        ),
        "detection": detection,
    }


def _result(*, source_url: str, final_url: str | None, observed_at: datetime, asset_type: str,
            status: str, blocked: bool = False, error: str | None = None, http_status: int | None = None,
            content_type: str | None = None, title: str | None = None, description: str | None = None,
            links: list[str] | None = None, brand: Brand | None = None,
            official_assets: list[OfficialAsset] | None = None) -> dict:
    domain = None
    provider = None
    if final_url:
        try:
            domain = normalize_domain(final_url)
            provider = hostname(final_url)
        except ValueError:
            pass
    safe_links = links or []
    return {
        "source_url": source_url, "final_url": final_url, "observed_at": observed_at,
        "http_status": http_status, "content_type": content_type, "title": title,
        "description": description, "provider": provider, "domain": domain,
        "asset_type": asset_type, "mode": "live", "status": status, "blocked": blocked,
        "error": error, "links": safe_links,
        "signals": _signals(title=title, final_url=final_url, links=safe_links, brand=brand,
                             official_assets=official_assets or [], asset_type=asset_type),
    }


def perform_live_check(url: str, *, asset_type: str, brand: Brand | None = None,
                       official_assets: list[OfficialAsset] | None = None) -> dict:
    """Fetch one public HTML page and return an observation, never a verdict."""
    observed_at = datetime.now(timezone.utc)
    current_url = url
    client = httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=False,
                          limits=httpx.Limits(max_connections=4, max_keepalive_connections=2))
    try:
        for _ in range(MAX_REDIRECTS + 1):
            http_status: int | None = None
            content_type: str | None = None
            try:
                context = client.stream("GET", current_url, headers={"Accept": "text/html,application/xhtml+xml"})
                with context as response:
                    http_status = int(response.status_code)
                    content_type = _header(response, "content-type")
                    if 300 <= http_status < 400:
                        location = _header(response, "location")
                        if not location:
                            return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                                           asset_type=asset_type, status="error", error="redirect_without_location",
                                           http_status=http_status, content_type=content_type, brand=brand,
                                           official_assets=official_assets)
                        try:
                            target = normalize_url(urljoin(current_url, location))
                            current_url = validate_public_url(target)
                        except (PublicURLRejected, ValueError):
                            return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                                           asset_type=asset_type, status="blocked", blocked=True,
                                           error="redirect_target_blocked", http_status=http_status,
                                           content_type=content_type, brand=brand,
                                           official_assets=official_assets)
                        continue

                    is_html = not content_type or content_type.casefold().split(";", 1)[0].strip() in {
                        "text/html", "application/xhtml+xml"
                    }
                    if not is_html:
                        return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                                       asset_type=asset_type, status="ok" if 200 <= http_status < 300 else "error",
                                       error=None if 200 <= http_status < 300 else f"http_status_{http_status}",
                                       http_status=http_status, content_type=content_type, brand=brand,
                                       official_assets=official_assets)
                    body = _read_limited(response)
                    parser = _MetadataParser()
                    parser.feed(body.decode("utf-8", errors="replace"))
                    links = _safe_links(parser.links, current_url)
                    return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                                   asset_type=asset_type, status="ok" if 200 <= http_status < 300 else "error",
                                   error=None if 200 <= http_status < 300 else f"http_status_{http_status}",
                                   http_status=http_status, content_type=content_type, title=parser.title,
                                   description=(parser.description or "")[:2000] or None, links=links,
                                   brand=brand, official_assets=official_assets)
            except ResponseTooLarge:
                return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                               asset_type=asset_type, status="error", error="response_too_large",
                               http_status=http_status, content_type=content_type, brand=brand,
                               official_assets=official_assets)
            except httpx.TimeoutException:
                return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                               asset_type=asset_type, status="error", error="request_timeout",
                               http_status=http_status, content_type=content_type, brand=brand,
                               official_assets=official_assets)
            except httpx.RequestError:
                return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                               asset_type=asset_type, status="error", error="request_failed",
                               http_status=http_status, content_type=content_type, brand=brand,
                               official_assets=official_assets)
        return _result(source_url=url, final_url=current_url, observed_at=observed_at,
                       asset_type=asset_type, status="error", error="too_many_redirects", brand=brand,
                       official_assets=official_assets)
    finally:
        client.close()
