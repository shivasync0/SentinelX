"""Deterministic, explainable detection primitives used by the scan service."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from .normalization import normalize_domain, url_key


# A small, intentionally explicit confusable set keeps demo behavior stable without a
# heavyweight ML dependency. Unicode accents are handled by NFKD below.
CONFUSABLE_MAP = {
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t",
    "@": "a", "$": "s", "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
    "х": "x", "і": "i", "ӏ": "l",
}
CONFUSABLES = str.maketrans(CONFUSABLE_MAP)


def normalize_name(value: str | None) -> str:
    """Return a case/punctuation/accent/confusable-insensitive comparison key."""
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value).translate(CONFUSABLES).casefold()
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", value)


def _literal_name(value: str | None) -> str:
    """Comparison key that removes formatting but retains digits for exact checks."""
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value).casefold()
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", value)


def remove_separators(value: str | None) -> str:
    """Remove spacing and punctuation while retaining the original character forms."""
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return re.sub(r"[^\w]+", "", normalized, flags=re.UNICODE)


def generate_name_variants(value: str | None) -> set[str]:
    """Return inspectable comparison variants without discarding the display value."""
    if not value:
        return set()
    raw = value.strip().casefold()
    compact = remove_separators(value)
    normalized = normalize_name(value)
    variants = {variant for variant in (raw, compact, normalized) if variant}
    for suffix in ("support", "help", "official", "rewards", "wallet"):
        if normalized.endswith(suffix) and normalized != suffix:
            variants.add(normalized.removesuffix(suffix))
    return variants


def detect_character_substitutions(candidate: str | None, brand: str | None) -> list[tuple[str, str]]:
    """Find explicit digit/symbol/Cyrillic substitutions that normalize to the brand."""
    if not candidate or not brand or _literal_name(candidate) == _literal_name(brand):
        return []
    if normalize_name(candidate) != normalize_name(brand):
        return []
    return [(char, CONFUSABLE_MAP[char]) for char in candidate if char in CONFUSABLE_MAP]


def detect_transpositions(candidate: str | None, brand: str | None) -> list[int]:
    """Return zero-based positions for a single adjacent character transposition."""
    candidate_key, brand_key = _literal_name(candidate), _literal_name(brand)
    if not candidate_key or len(candidate_key) != len(brand_key) or candidate_key == brand_key:
        return []
    positions = [index for index in range(len(brand_key) - 1) if candidate_key[index:index + 2] == brand_key[index:index + 2][::-1]]
    return positions if len(positions) == 1 and candidate_key == brand_key[:positions[0]] + brand_key[positions[0] + 1] + brand_key[positions[0]] + brand_key[positions[0] + 2:] else []


def detect_added_brand_terms(candidate: str | None, brand: str | None) -> list[str]:
    """Return common suffix terms appended to an otherwise embedded brand name."""
    candidate_key, brand_key = normalize_name(candidate), normalize_name(brand)
    if not candidate_key or not brand_key or candidate_key == brand_key or brand_key not in candidate_key:
        return []
    remainder = candidate_key.replace(brand_key, "", 1)
    terms = ("support", "help", "official", "rewards", "wallet", "security", "mobile")
    return [term for term in terms if term in remainder]


def calculate_name_similarity(candidate: str | None, brand: str | None) -> float:
    return name_similarity(candidate, brand)


def detect_unicode_confusables(candidate: str | None, brand: str | None) -> list[tuple[str, str]]:
    """Return non-ASCII confusables that collapse to the same comparison key."""
    if not candidate or not brand or normalize_name(candidate) != normalize_name(brand):
        return []
    return [(char, CONFUSABLE_MAP[char]) for char in candidate if char in CONFUSABLE_MAP and not char.isascii()]


def name_similarity(left: str | None, right: str | None) -> float:
    """Compare names on a stable 0..1 scale, rewarding normalized equality."""
    a, b = normalize_name(left), normalize_name(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return round(SequenceMatcher(None, a, b).ratio(), 4)


def is_lookalike(candidate: str, official: str, threshold: float = 0.78) -> bool:
    similarity = name_similarity(candidate, official)
    return 0 < similarity >= threshold and _literal_name(candidate) != _literal_name(official)


def hostname(value: str | None) -> str:
    if not value:
        return ""
    try:
        return normalize_domain(value).removeprefix("www.")
    except ValueError:
        return ""


@dataclass(frozen=True)
class RiskSignal:
    category: str
    signal: str
    evidence: str
    weight: float


@dataclass
class DetectionResult:
    excluded: bool
    score: float
    risk_level: str
    explanation: list[RiskSignal] = field(default_factory=list)

    @property
    def reasons(self) -> list[str]:
        return [item.evidence for item in self.explanation]


def _asset_matches(candidate, asset, brand=None) -> tuple[bool, str]:
    if getattr(asset, "status", "verified") != "verified":
        return False, ""
    candidate_name = _literal_name(getattr(candidate, "name", ""))
    asset_name = _literal_name(getattr(asset, "name", ""))
    if candidate_name and asset_name and candidate_name == asset_name:
        return True, "candidate name exactly matches a verified official asset"
    candidate_host = hostname(getattr(candidate, "domain", None) or getattr(candidate, "url", None))
    asset_host = hostname(getattr(asset, "url", None))
    shared_platform = getattr(asset, "asset_type", "domain") in {"social", "mobile_app", "app"} or getattr(candidate, "candidate_type", "domain") in {"social", "mobile_app", "app"}
    if shared_platform:
        candidate_url, asset_url = getattr(candidate, "url", None), getattr(asset, "url", None)
        try:
            if candidate_url and asset_url and url_key(candidate_url) == url_key(asset_url):
                return True, "candidate URL exactly matches a verified official asset"
        except ValueError:
            pass
    elif candidate_host and asset_host and candidate_host == asset_host:
        return True, "candidate host exactly matches a verified official asset"
    if brand and candidate_name == _literal_name(getattr(brand, "canonical_name", "")):
        return True, "candidate exactly matches the brand canonical name"
    return False, ""


def is_official_asset(candidate, brand, official_assets) -> bool:
    """Return whether a candidate is an exact verified asset match."""
    return any(_asset_matches(candidate, asset, brand)[0] for asset in official_assets)


def score_candidate(candidate, brand, official_assets) -> DetectionResult:
    """Score one candidate. Official matches return immediately (exclusion precedence)."""
    for asset in official_assets:
        matches, reason = _asset_matches(candidate, asset, brand)
        if matches:
            return DetectionResult(True, 0.0, "excluded", [RiskSignal("exclusion", "official_asset", reason, 0.0)])

    signals: list[RiskSignal] = []
    candidate_name = getattr(candidate, "name", "")
    brand_name = getattr(brand, "canonical_name", getattr(brand, "name", ""))
    similarity = name_similarity(candidate_name, brand_name)
    if similarity >= 0.78:
        signals.append(RiskSignal("identity", "look_alike_name", f"name similarity {similarity:.2f} to {brand_name}", 0.65))
    elif similarity >= 0.55:
        signals.append(RiskSignal("identity", "related_name", f"name similarity {similarity:.2f} to {brand_name}", 0.30))
    domain = getattr(candidate, "domain", None) or hostname(getattr(candidate, "url", None))
    official_domains = {hostname(item) for item in getattr(brand, "domains", [])}
    if domain and hostname(domain) not in official_domains:
        signals.append(RiskSignal("infrastructure", "unverified_domain", f"{hostname(domain)} is not an official brand domain", 0.15))
    if getattr(candidate, "source_id", None):
        signals.append(RiskSignal("provenance", "external_source", "candidate was reported by an external source", 0.10))
    if getattr(candidate, "candidate_type", "") in {"login", "phishing", "social", "mobile_app", "app"}:
        signals.append(RiskSignal("behavior", "high_risk_surface", f"candidate type is {candidate.candidate_type}", 0.20))
    score = round(min(1.0, sum(signal.weight for signal in signals)), 4)
    level = "critical" if score >= 0.85 else "high" if score >= 0.65 else "medium" if score >= 0.35 else "low"
    return DetectionResult(False, score, level, signals)


# Public aliases make the small module convenient for integrations.
normalize = normalize_name
calculate_risk = score_candidate
