from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Brand(Base):
    __tablename__ = "brands"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    canonical_name: Mapped[str] = mapped_column(String(160), index=True)
    domains: Mapped[list] = mapped_column(JSON, default=list)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    assets: Mapped[list["OfficialAsset"]] = relationship(back_populates="brand", cascade="all, delete-orphan")
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="brand")
    observations: Mapped[list["Observation"]] = relationship(back_populates="brand")


class Source(Base):
    __tablename__ = "sources"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    url: Mapped[str] = mapped_column(String(500), unique=True)
    title: Mapped[str] = mapped_column(String(240))
    publisher: Mapped[str | None] = mapped_column(String(160), nullable=True)
    source_type: Mapped[str] = mapped_column(String(40), default="web")
    trust_level: Mapped[str] = mapped_column(String(30), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OfficialAsset(Base):
    __tablename__ = "official_assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    asset_type: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(240))
    url: Mapped[str] = mapped_column(String(500))
    fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="verified")
    brand: Mapped[Brand] = relationship(back_populates="assets")


class Candidate(Base):
    __tablename__ = "candidates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id"), nullable=True, index=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("sources.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(240), index=True)
    normalized_name: Mapped[str] = mapped_column(String(240), index=True)
    candidate_type: Mapped[str] = mapped_column(String(40), default="domain")
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="new")
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    brand: Mapped[Brand | None] = relationship(back_populates="candidates")
    source: Mapped[Source | None] = relationship()
    observations: Mapped[list["Observation"]] = relationship(back_populates="candidate")


class Observation(Base):
    """One bounded live metadata observation and its comparison to prior state."""

    __tablename__ = "observations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id"), nullable=True, index=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"), nullable=True, index=True)
    source_url: Mapped[str] = mapped_column(String(2048), index=True)
    canonical_url: Mapped[str] = mapped_column(String(2048), index=True)
    final_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    status: Mapped[str] = mapped_column(String(30))
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(240), nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    asset_type: Mapped[str] = mapped_column(String(40))
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    links: Mapped[list] = mapped_column(JSON, default=list)
    signals: Mapped[dict] = mapped_column(JSON, default=dict)
    mode: Mapped[str] = mapped_column(String(30), default="live")
    changed: Mapped[bool] = mapped_column(Boolean, default=False)
    changed_fields: Mapped[list] = mapped_column(JSON, default=list)
    previous_observed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    change_summary: Mapped[dict] = mapped_column(JSON, default=dict)
    brand: Mapped[Brand | None] = relationship(back_populates="observations")
    candidate: Mapped[Candidate | None] = relationship(back_populates="observations")


class Scan(Base):
    __tablename__ = "scans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    target: Mapped[str] = mapped_column(String(240), default="all candidates")
    status: Mapped[str] = mapped_column(String(30), default="completed")
    deterministic: Mapped[bool] = mapped_column(Boolean, default=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    risk_level: Mapped[str] = mapped_column(String(20), default="low")
    summary: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    findings: Mapped[list["ScanFinding"]] = relationship(back_populates="scan", cascade="all, delete-orphan")


class ScanFinding(Base):
    __tablename__ = "scan_findings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id"), index=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    category: Mapped[str] = mapped_column(String(60))
    signal: Mapped[str] = mapped_column(String(100))
    evidence: Mapped[str] = mapped_column(Text)
    weight: Mapped[float] = mapped_column(Float)
    score_contribution: Mapped[float] = mapped_column(Float)
    excluded: Mapped[bool] = mapped_column(Boolean, default=False)
    scan: Mapped[Scan] = relationship(back_populates="findings")
    candidate: Mapped[Candidate | None] = relationship()


class Investigation(Base):
    __tablename__ = "investigations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(30), default="open")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    notes: Mapped[str] = mapped_column(Text, default="")
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scans.id"), nullable=True)
    candidate_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(240))
    report_type: Mapped[str] = mapped_column(String(40), default="scan")
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scans.id"), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
