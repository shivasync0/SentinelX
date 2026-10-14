"""Canonical HTTP URLs and DNS names; validation never performs a network request."""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlsplit, urlunsplit


def normalize_domain(value: str) -> str:
    value = value.strip()
    if not value or any(ch.isspace() or ord(ch) < 32 for ch in value) or "\\" in value:
        raise ValueError("domain must be a valid hostname or HTTP(S) URL")
    parsed = urlsplit(value if "://" in value else f"https://{value}")
    if parsed.scheme.lower() not in {"http", "https"} or parsed.username is not None or parsed.password is not None:
        raise ValueError("only HTTP(S) addresses without credentials are allowed")
    # Accessing port validates malformed and out-of-range port numbers.
    parsed.port
    host = (parsed.hostname or "").rstrip(".").lower()
    if not host:
        raise ValueError("hostname is required")
    try:
        return ipaddress.ip_address(host).compressed
    except ValueError:
        pass
    host = host.encode("idna").decode("ascii")
    if len(host) > 253 or any(
        not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
        for label in host.split(".")
    ):
        raise ValueError("invalid hostname")
    return host


def normalize_url(value: str) -> str:
    value = value.strip()
    if any(ch.isspace() or ord(ch) < 32 for ch in value) or "\\" in value:
        raise ValueError("URL must not contain whitespace, control characters, or backslashes")
    parsed = urlsplit(value if "://" in value else f"https://{value}")
    host = normalize_domain(value)
    scheme = parsed.scheme.lower()
    authority = f"[{host}]" if ":" in host else host
    if parsed.port is not None and (scheme, parsed.port) not in {("http", 80), ("https", 443)}:
        authority += f":{parsed.port}"
    # Fragments do not identify a different retrieved resource. Preserve path/query case.
    return urlunsplit((scheme, authority, parsed.path or "", parsed.query, ""))


def url_key(value: str) -> str:
    """Root slash variants identify the same resource; other paths remain distinct."""
    parsed = urlsplit(normalize_url(value))
    return urlunsplit((parsed.scheme, parsed.netloc, "" if parsed.path == "/" else parsed.path, parsed.query, ""))
