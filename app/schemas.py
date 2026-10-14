from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .normalization import normalize_domain, normalize_url


class AddressInput(BaseModel):
    @field_validator("url", check_fields=False)
    @classmethod
    def clean_url(cls, value):
        return normalize_url(value) if value is not None else None

    @field_validator("domain", check_fields=False)
    @classmethod
    def clean_domain(cls, value):
        return normalize_domain(value) if value is not None else None

    @field_validator("domains", check_fields=False)
    @classmethod
    def clean_domains(cls, value):
        if value is None:
            raise ValueError("domains cannot be null")
        return list(dict.fromkeys(normalize_domain(item) for item in value))

    @field_validator("name", "canonical_name", check_fields=False)
    @classmethod
    def clean_name(cls, value):
        if value is None:
            return None
        if not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BrandCreate(AddressInput):
    name: str
    canonical_name: str | None = None
    domains: list[str] = Field(default_factory=list)
    description: str | None = None


class BrandUpdate(AddressInput):
    name: str | None = None
    canonical_name: str | None = None
    domains: list[str] = Field(default_factory=list)
    description: str | None = None

    @field_validator("name", "canonical_name", mode="before")
    @classmethod
    def non_null_names(cls, value):
        if value is None:
            raise ValueError("name cannot be null")
        return value


class BrandOut(ORMModel):
    id: int
    name: str
    canonical_name: str
    domains: list[str]
    description: str | None
    created_at: datetime


class AssetCreate(AddressInput):
    brand_id: int
    asset_type: str = "domain"
    name: str
    url: str
    fingerprint: str | None = None
    status: str = "verified"


class AssetUpdate(AddressInput):
    brand_id: int | None = None
    asset_type: str | None = None
    name: str | None = None
    url: str | None = None
    fingerprint: str | None = None
    status: str | None = None

    @field_validator("brand_id", "asset_type", "name", "url", "status", mode="before")
    @classmethod
    def non_null_fields(cls, value):
        if value is None:
            raise ValueError("field cannot be null")
        return value


class AssetOut(ORMModel):
    id: int
    brand_id: int
    asset_type: str
    name: str
    url: str
    fingerprint: str | None
    status: str


class CandidateCreate(AddressInput):
    brand_id: int | None = None
    source_id: int | None = None
    name: str
    candidate_type: str = "domain"
    domain: str | None = None
    url: str | None = None
    status: str = "new"
    metadata: dict[str, Any] = Field(default_factory=dict)


class CandidateFeedback(BaseModel):
    verdict: Literal["confirmed_impersonation", "false_positive", "needs_review"]
    notes: str = Field(default="", max_length=5000)


class CandidateOut(ORMModel):
    id: int
    brand_id: int | None
    source_id: int | None
    name: str
    normalized_name: str
    candidate_type: str
    domain: str | None
    url: str | None
    status: str
    metadata: dict[str, Any]
    created_at: datetime


class LiveCheckRequest(BaseModel):
    """Input for a bounded, public-web metadata observation."""

    url: str = Field(min_length=1, max_length=2048)
    brand_id: int | None = None
    asset_type: Literal["social", "mobile_app", "website"] = "website"

    @field_validator("url")
    @classmethod
    def validate_http_url(cls, value: str) -> str:
        value = value.strip()
        parsed = urlsplit(value)
        if parsed.scheme.lower() not in {"http", "https"}:
            raise ValueError("url must use http or https")
        if not parsed.hostname or parsed.username is not None or parsed.password is not None:
            raise ValueError("url must have a hostname and must not contain credentials")
        # normalize_url performs the remaining syntax, port, IDNA, and character checks.
        try:
            return normalize_url(value)
        except ValueError as error:
            raise ValueError(str(error)) from error


class LiveSignal(ORMModel):
    value: str | None = None
    normalized: str | None = None
    matched: bool = False
    similarity: float | None = None
    evidence: list[str] = Field(default_factory=list)


class LiveDetectionSignal(ORMModel):
    category: str
    signal: str
    evidence: str
    weight: float


class LiveCheckSignals(ORMModel):
    brand: LiveSignal
    name: LiveSignal
    link: LiveSignal
    detection: list[LiveDetectionSignal] = Field(default_factory=list)


class LiveCheckOut(ORMModel):
    source_url: str
    final_url: str | None
    observed_at: datetime
    http_status: int | None
    content_type: str | None
    title: str | None
    description: str | None
    provider: str | None
    domain: str | None
    asset_type: Literal["social", "mobile_app", "website"]
    mode: Literal["live"] = "live"
    status: Literal["ok", "blocked", "error"]
    blocked: bool = False
    error: str | None = None
    links: list[str] = Field(default_factory=list)
    signals: LiveCheckSignals
    changed: bool = False
    changed_fields: list[str] = Field(default_factory=list)
    previous_observed_at: datetime | None = None
    change_summary: dict[str, Any] = Field(default_factory=dict)


class ObservationOut(ORMModel):
    id: int
    brand_id: int | None
    candidate_id: int | None
    source_url: str
    canonical_url: str
    final_url: str | None
    observed_at: datetime
    status: Literal["ok", "blocked", "error"]
    http_status: int | None
    content_type: str | None
    title: str | None
    description: str | None
    provider: str | None
    domain: str | None
    asset_type: Literal["social", "mobile_app", "website"]
    blocked: bool
    error: str | None
    links: list[str] = Field(default_factory=list)
    signals: LiveCheckSignals
    mode: Literal["live"] = "live"
    changed: bool = False
    changed_fields: list[str] = Field(default_factory=list)
    previous_observed_at: datetime | None = None
    change_summary: dict[str, Any] = Field(default_factory=dict)


class SourceCreate(AddressInput):
    url: str
    title: str
    publisher: str | None = None
    source_type: str = "web"
    trust_level: str = "unknown"


class SourceOut(ORMModel):
    id: int
    url: str
    title: str
    publisher: str | None
    source_type: str
    trust_level: str
    created_at: datetime


class FindingOut(ORMModel):
    id: int
    candidate_id: int | None
    category: str
    signal: str
    evidence: str
    weight: float
    score_contribution: float
    excluded: bool


class ScanCreate(BaseModel):
    candidate_ids: list[int] = Field(default_factory=list)
    brand_id: int | None = None
    target: str = "all candidates"
    deterministic: bool = True


class ScanOut(ORMModel):
    id: int
    target: str
    status: str
    deterministic: bool
    score: float
    risk_level: str
    summary: str
    started_at: datetime
    completed_at: datetime
    findings: list[FindingOut] = Field(default_factory=list)


class InvestigationCreate(BaseModel):
    title: str
    status: str = "open"
    priority: str = "medium"
    notes: str = ""
    scan_id: int | None = None
    candidate_ids: list[int] = Field(default_factory=list)


class InvestigationUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    notes: str | None = None


class InvestigationOut(ORMModel):
    id: int
    title: str
    status: str
    priority: str
    notes: str
    scan_id: int | None
    candidate_ids: list[int]
    created_at: datetime
    updated_at: datetime


class ReportCreate(BaseModel):
    title: str
    report_type: str = "scan"
    scan_id: int | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class ReportOut(ORMModel):
    id: int
    title: str
    report_type: str
    scan_id: int | None
    payload: dict[str, Any]
    generated_at: datetime
