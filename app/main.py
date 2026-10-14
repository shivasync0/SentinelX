from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from itertools import combinations

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import Base, get_db, make_engine, session_factory
from .detection import normalize_name, score_candidate
from .live_check import PublicURLRejected, perform_live_check, validate_public_url
from .live_sources import collect_live_candidates
from .models import (
    Brand,
    Candidate,
    Investigation,
    Observation,
    OfficialAsset,
    Report,
    Scan,
    ScanFinding,
    Source,
    utcnow,
)
from .normalization import normalize_domain, url_key
from .schemas import (
    AssetCreate,
    AssetOut,
    AssetUpdate,
    BrandCreate,
    BrandOut,
    BrandUpdate,
    CandidateCreate,
    CandidateFeedback,
    CandidateOut,
    InvestigationCreate,
    InvestigationOut,
    InvestigationUpdate,
    LiveCheckOut,
    LiveCheckRequest,
    ObservationOut,
    ReportCreate,
    ReportOut,
    ScanCreate,
    ScanOut,
    SourceCreate,
    SourceOut,
)
from .seed import seed_demo_data

DATABASE_URL = os.getenv("SENTINEL_DATABASE_URL", "sqlite:///./sentinel_x.db")
engine = make_engine(DATABASE_URL)
SessionLocal = session_factory(engine)


def _one_or_404(db: Session, model, object_id: int, label: str | None = None):
    item = db.get(model, object_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{label or model.__name__} {object_id} not found")
    return item


def _candidate_out(candidate: Candidate) -> dict:
    return {
        "id": candidate.id, "brand_id": candidate.brand_id, "source_id": candidate.source_id,
        "name": candidate.name, "normalized_name": candidate.normalized_name,
        "candidate_type": candidate.candidate_type, "domain": candidate.domain, "url": candidate.url,
        "status": candidate.status, "metadata": candidate.metadata_json or {}, "created_at": candidate.created_at,
    }


def _commit(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="resource conflicts with an existing record")


def _brand_duplicate(db: Session, name: str, exclude_id: int | None = None):
    if any(item.id != exclude_id and item.name.strip().casefold() == name.casefold()
           for item in db.scalars(select(Brand)).all()):
        raise HTTPException(status_code=409, detail="brand already exists")


def _same_url(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False
    try:
        return url_key(left) == url_key(right)
    except ValueError:
        return False


_OBSERVATION_SNAPSHOT_FIELDS = (
    "final_url", "status", "http_status", "content_type", "title", "description",
    "provider", "domain", "asset_type", "blocked", "error", "links", "signals",
)


def _observation_candidate(db: Session, brand: Brand, observed: dict) -> Candidate | None:
    """Link an observation to an existing candidate without creating discoveries."""
    candidates = db.scalars(select(Candidate).where(Candidate.brand_id == brand.id)).all()
    urls = [observed.get("source_url"), observed.get("final_url")]
    for candidate in candidates:
        if candidate.url and any(_same_url(candidate.url, url) for url in urls):
            return candidate
    observed_domain = observed.get("domain")
    if observed_domain:
        for candidate in candidates:
            if candidate.domain:
                try:
                    if normalize_domain(candidate.domain) == observed_domain:
                        return candidate
                except ValueError:
                    continue
    return None


def _persist_observation(db: Session, brand: Brand, observed: dict) -> Observation:
    """Store a live result and compare it with the latest observation of its URL."""
    source_url = observed["source_url"]
    canonical_url = url_key(source_url)
    previous = db.scalar(
        select(Observation)
        .where(Observation.canonical_url == canonical_url)
        .order_by(Observation.observed_at.desc(), Observation.id.desc())
    )
    current_snapshot = {field: observed.get(field) for field in _OBSERVATION_SNAPSHOT_FIELDS}
    changed_fields: list[str] = []
    if previous is not None:
        previous_snapshot = {field: getattr(previous, field) for field in _OBSERVATION_SNAPSHOT_FIELDS}
        changed_fields = [
            field for field in _OBSERVATION_SNAPSHOT_FIELDS
            if current_snapshot[field] != previous_snapshot[field]
        ]
    changed = bool(previous is not None and changed_fields)
    previous_observed_at = previous.observed_at if previous is not None else None
    change_summary = {
        "canonical_url": canonical_url,
        "changed_fields": changed_fields,
        "previous_observed_at": previous_observed_at.isoformat() if previous_observed_at else None,
        "comparison": "latest_previous_observation" if previous is not None else "first_observation",
    }
    observed.update({
        "changed": changed,
        "changed_fields": changed_fields,
        "previous_observed_at": previous_observed_at,
        "change_summary": change_summary,
    })
    candidate = _observation_candidate(db, brand, observed)
    record = Observation(
        brand_id=brand.id,
        candidate_id=candidate.id if candidate is not None else None,
        canonical_url=canonical_url,
        **{field: observed.get(field) for field in (
            "source_url", "final_url", "observed_at", "status", "http_status", "content_type",
            "title", "description", "provider", "domain", "asset_type", "blocked", "error",
            "links", "signals", "mode", "changed", "changed_fields", "previous_observed_at",
            "change_summary",
        )},
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _observation_history(db: Session, *, brand_id: int | None = None,
                         candidate_id: int | None = None, limit: int = 50) -> list[Observation]:
    if brand_id is not None:
        _one_or_404(db, Brand, brand_id, "brand")
    if candidate_id is not None:
        _one_or_404(db, Candidate, candidate_id, "candidate")
    query = select(Observation).order_by(Observation.observed_at.desc(), Observation.id.desc()).limit(limit)
    if brand_id is not None:
        query = query.where(Observation.brand_id == brand_id)
    if candidate_id is not None:
        query = query.where(Observation.candidate_id == candidate_id)
    return list(db.scalars(query).all())


def _asset_duplicate(db: Session, brand_id: int, url: str, exclude_id: int | None = None):
    assets = db.scalars(select(OfficialAsset).where(OfficialAsset.brand_id == brand_id)).all()
    if any(item.id != exclude_id and _same_url(item.url, url) for item in assets):
        raise HTTPException(status_code=409, detail="official asset already exists for this brand")


def run_scan(db: Session, request: ScanCreate) -> Scan:
    candidates = db.scalars(select(Candidate).order_by(Candidate.id)).all()
    if request.brand_id is not None:
        candidates = [candidate for candidate in candidates if candidate.brand_id == request.brand_id]
    if request.candidate_ids:
        wanted = set(request.candidate_ids)
        candidates = [candidate for candidate in candidates if candidate.id in wanted]
        if len(candidates) != len(wanted):
            raise HTTPException(status_code=404, detail="one or more candidate_ids were not found")
    scan = Scan(target=request.target, deterministic=request.deterministic, status="running", summary="")
    db.add(scan)
    db.flush()
    scores = []
    excluded_count = 0
    for candidate in candidates:
        if candidate.brand is None:
            continue
        result = score_candidate(candidate, candidate.brand, candidate.brand.assets)
        if result.excluded:
            excluded_count += 1
        else:
            scores.append(result.score)
        for signal in result.explanation:
            db.add(ScanFinding(
                scan_id=scan.id, candidate_id=candidate.id, category=signal.category,
                signal=signal.signal, evidence=signal.evidence, weight=signal.weight,
                score_contribution=signal.weight if not result.excluded else 0.0,
                excluded=result.excluded,
            ))
    scan.score = round(sum(scores) / len(scores), 4) if scores else 0.0
    scan.risk_level = "critical" if scan.score >= .85 else "high" if scan.score >= .65 else "medium" if scan.score >= .35 else "low"
    scan.status = "completed"
    scan.summary = f"Scanned {len(candidates)} candidates; {excluded_count} matched verified official assets."
    db.commit()
    db.refresh(scan)
    return scan


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    yield


app = FastAPI(title="Sentinel X API", version="1.0.0", description="Explainable brand impersonation detection", lifespan=lifespan)
cors_origins = [item.strip() for item in os.getenv("SENTINEL_CORS_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "sentinel-x"}


@app.post("/api/live-check", response_model=LiveCheckOut)
def live_check(payload: LiveCheckRequest, db: Session = Depends(get_db)):
    """Observe public HTML metadata without downloading or executing files."""
    brand = _one_or_404(db, Brand, payload.brand_id, "brand") if payload.brand_id is not None else None
    try:
        safe_url = validate_public_url(payload.url)
    except PublicURLRejected as error:
        # Keep blocked observations machine-readable while returning a client error.
        observed = {
            "source_url": payload.url, "final_url": None,
            "observed_at": datetime.now(timezone.utc), "http_status": None, "content_type": None,
            "title": None, "description": None, "provider": None, "domain": None,
            "asset_type": payload.asset_type, "mode": "live", "status": "blocked",
            "blocked": True, "error": str(error), "links": [],
            "signals": {
                "brand": {"value": None, "normalized": None, "matched": False, "similarity": None, "evidence": []},
                "name": {"value": None, "normalized": None, "matched": False, "similarity": None, "evidence": []},
                "link": {"value": None, "normalized": None, "matched": False, "similarity": None, "evidence": []},
                "detection": [],
            },
        }
        if brand is not None:
            _persist_observation(db, brand, observed)
        return JSONResponse(status_code=400, content=LiveCheckOut.model_validate(observed).model_dump(mode="json"))
    official_assets = brand.assets if brand is not None else []
    observed = perform_live_check(safe_url, asset_type=payload.asset_type, brand=brand,
                                  official_assets=official_assets)
    if brand is not None:
        _persist_observation(db, brand, observed)
    return observed


@app.get("/api/observations", response_model=list[ObservationOut])
def list_observations(brand_id: int | None = Query(default=None),
                      candidate_id: int | None = Query(default=None),
                      limit: int = Query(default=50, ge=1, le=100),
                      db: Session = Depends(get_db)):
    return _observation_history(db, brand_id=brand_id, candidate_id=candidate_id, limit=limit)


@app.get("/api/brands/{brand_id}/observations", response_model=list[ObservationOut])
def list_brand_observations(brand_id: int, limit: int = Query(default=50, ge=1, le=100),
                            db: Session = Depends(get_db)):
    return _observation_history(db, brand_id=brand_id, limit=limit)


@app.get("/api/candidates/{candidate_id}/observations", response_model=list[ObservationOut])
def list_candidate_observations(candidate_id: int, limit: int = Query(default=50, ge=1, le=100),
                                db: Session = Depends(get_db)):
    return _observation_history(db, candidate_id=candidate_id, limit=limit)


@app.get("/api/brands", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    return db.scalars(select(Brand).order_by(Brand.id)).all()


@app.post("/api/brands", response_model=BrandOut, status_code=status.HTTP_201_CREATED)
def create_brand(payload: BrandCreate, db: Session = Depends(get_db)):
    _brand_duplicate(db, payload.name)
    brand = Brand(name=payload.name, canonical_name=payload.canonical_name or payload.name, domains=payload.domains, description=payload.description)
    db.add(brand)
    _commit(db)
    db.refresh(brand)
    return brand


@app.get("/api/brands/{brand_id}", response_model=BrandOut)
def get_brand(brand_id: int, db: Session = Depends(get_db)):
    return _one_or_404(db, Brand, brand_id, "brand")


@app.patch("/api/brands/{brand_id}", response_model=BrandOut)
def update_brand(brand_id: int, payload: BrandUpdate, db: Session = Depends(get_db)):
    brand = _one_or_404(db, Brand, brand_id, "brand")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        _brand_duplicate(db, changes["name"], brand_id)
    for key, value in changes.items():
        setattr(brand, key, value)
    _commit(db)
    db.refresh(brand)
    return brand


@app.delete("/api/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(brand_id: int, db: Session = Depends(get_db)):
    brand = _one_or_404(db, Brand, brand_id, "brand")
    # Preserve discoveries and historical scan evidence after the protected brand is removed.
    for candidate in brand.candidates:
        candidate.brand_id = None
    for observation in brand.observations:
        observation.brand_id = None
    db.delete(brand)
    _commit(db)
    return Response(status_code=204)


@app.get("/api/brands/{brand_id}/official-assets", response_model=list[AssetOut])
def list_brand_assets(brand_id: int, db: Session = Depends(get_db)):
    _one_or_404(db, Brand, brand_id, "brand")
    return db.scalars(select(OfficialAsset).where(OfficialAsset.brand_id == brand_id).order_by(OfficialAsset.id)).all()


@app.get("/api/official-assets", response_model=list[AssetOut])
def list_assets(brand_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    query = select(OfficialAsset).order_by(OfficialAsset.id)
    if brand_id is not None:
        query = query.where(OfficialAsset.brand_id == brand_id)
    return db.scalars(query).all()


@app.post("/api/official-assets", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)):
    _one_or_404(db, Brand, payload.brand_id, "brand")
    _asset_duplicate(db, payload.brand_id, payload.url)
    asset = OfficialAsset(**payload.model_dump())
    db.add(asset)
    _commit(db)
    db.refresh(asset)
    return asset


@app.get("/api/official-assets/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    return _one_or_404(db, OfficialAsset, asset_id, "official asset")


@app.patch("/api/official-assets/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, payload: AssetUpdate, db: Session = Depends(get_db)):
    asset = _one_or_404(db, OfficialAsset, asset_id, "official asset")
    changes = payload.model_dump(exclude_unset=True)
    brand_id = changes.get("brand_id", asset.brand_id)
    _one_or_404(db, Brand, brand_id, "brand")
    _asset_duplicate(db, brand_id, changes.get("url", asset.url), asset_id)
    for key, value in changes.items():
        setattr(asset, key, value)
    _commit(db)
    db.refresh(asset)
    return asset


@app.delete("/api/official-assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    db.delete(_one_or_404(db, OfficialAsset, asset_id, "official asset"))
    _commit(db)
    return Response(status_code=204)


@app.get("/api/candidates", response_model=list[CandidateOut])
def list_candidates(brand_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    query = select(Candidate).order_by(Candidate.id)
    if brand_id is not None:
        query = query.where(Candidate.brand_id == brand_id)
    return [_candidate_out(item) for item in db.scalars(query).all()]


@app.post("/api/candidates", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def create_candidate(payload: CandidateCreate, db: Session = Depends(get_db)):
    if payload.brand_id is not None:
        _one_or_404(db, Brand, payload.brand_id, "brand")
    if payload.source_id is not None:
        _one_or_404(db, Source, payload.source_id, "source")
    domain = payload.domain or (normalize_domain(payload.url) if payload.url else None)
    existing = db.scalars(select(Candidate).where(
        Candidate.brand_id == payload.brand_id, Candidate.candidate_type == payload.candidate_type,
    )).all()
    for item in existing:
        same_domain = False
        if domain and item.domain and (payload.candidate_type in {"domain", "phishing", "login"} or not payload.url and not item.url):
            try:
                same_domain = normalize_domain(item.domain) == domain
            except ValueError:
                pass
        same_name_only = not (payload.domain or payload.url or item.domain or item.url) and item.name.casefold() == payload.name.casefold()
        if _same_url(item.url, payload.url) or same_domain or same_name_only:
            raise HTTPException(status_code=409, detail="candidate already exists for this brand and type")
    candidate = Candidate(
        brand_id=payload.brand_id, source_id=payload.source_id, name=payload.name,
        normalized_name=normalize_name(payload.name), candidate_type=payload.candidate_type,
        domain=domain, url=payload.url, status=payload.status, metadata_json=payload.metadata,
    )
    db.add(candidate)
    _commit(db)
    db.refresh(candidate)
    return _candidate_out(candidate)


@app.get("/api/candidates/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    return _candidate_out(_one_or_404(db, Candidate, candidate_id, "candidate"))


@app.post("/api/candidates/{candidate_id}/feedback", response_model=CandidateOut)
def candidate_feedback(candidate_id: int, payload: CandidateFeedback, db: Session = Depends(get_db)):
    candidate = _one_or_404(db, Candidate, candidate_id, "candidate")
    candidate.status = {
        "confirmed_impersonation": "confirmed", "false_positive": "false_positive", "needs_review": "in_review",
    }[payload.verdict]
    metadata = dict(candidate.metadata_json or {})
    history = list(metadata.get("feedback", [])) if isinstance(metadata.get("feedback", []), list) else []
    history.append({**payload.model_dump(), "created_at": utcnow().isoformat()})
    metadata["feedback"] = history
    candidate.metadata_json = metadata
    _commit(db)
    db.refresh(candidate)
    return _candidate_out(candidate)


@app.get("/api/scans", response_model=list[ScanOut])
def list_scans(db: Session = Depends(get_db)):
    return db.scalars(select(Scan).order_by(Scan.id.desc())).all()


@app.post("/api/scans", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_scan(payload: ScanCreate, db: Session = Depends(get_db)):
    return run_scan(db, payload)


@app.post("/api/scans/demo", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def demo_scan(db: Session = Depends(get_db)):
    return run_scan(db, ScanCreate(target="deterministic demo", deterministic=True))


@app.post("/api/brands/{brand_id}/live-scan", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def live_scan(brand_id: int, db: Session = Depends(get_db)):
    """Collect a bounded live snapshot from public providers, then score persisted records."""
    brand = _one_or_404(db, Brand, brand_id, "brand")
    collection = collect_live_candidates(db, brand)
    db.commit()
    scan = run_scan(db, ScanCreate(brand_id=brand.id, target=f"live sources · {brand.name}", deterministic=False))
    status_text = "completed" if not collection.errors else "partially_completed"
    source_text = f"{len(collection.sources)} live sources"
    error_text = f" Errors: {'; '.join(collection.errors)}" if collection.errors else ""
    scan.status = status_text
    scan.summary = f"Live snapshot collected {len(collection.candidates)} candidate records from {source_text}; existing official assets were excluded before scoring.{error_text}"
    db.commit()
    db.refresh(scan)
    return scan


@app.get("/api/scans/{scan_id}", response_model=ScanOut)
def get_scan(scan_id: int, db: Session = Depends(get_db)):
    scan = _one_or_404(db, Scan, scan_id, "scan")
    return scan


@app.get("/api/investigations", response_model=list[InvestigationOut])
def list_investigations(db: Session = Depends(get_db)):
    return db.scalars(select(Investigation).order_by(Investigation.id)).all()


@app.post("/api/investigations", response_model=InvestigationOut, status_code=status.HTTP_201_CREATED)
def create_investigation(payload: InvestigationCreate, db: Session = Depends(get_db)):
    if payload.scan_id is not None:
        _one_or_404(db, Scan, payload.scan_id, "scan")
    investigation = Investigation(**payload.model_dump())
    db.add(investigation)
    db.commit()
    db.refresh(investigation)
    return investigation


@app.get("/api/investigations/{investigation_id}", response_model=InvestigationOut)
def get_investigation(investigation_id: int, db: Session = Depends(get_db)):
    return _one_or_404(db, Investigation, investigation_id, "investigation")


@app.patch("/api/investigations/{investigation_id}", response_model=InvestigationOut)
def update_investigation(investigation_id: int, payload: InvestigationUpdate, db: Session = Depends(get_db)):
    investigation = _one_or_404(db, Investigation, investigation_id, "investigation")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(investigation, key, value)
    db.commit()
    db.refresh(investigation)
    return investigation


@app.get("/api/sources", response_model=list[SourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.scalars(select(Source).order_by(Source.id)).all()


@app.post("/api/sources", response_model=SourceOut, status_code=status.HTTP_201_CREATED)
def create_source(payload: SourceCreate, db: Session = Depends(get_db)):
    if any(_same_url(item.url, payload.url) for item in db.scalars(select(Source)).all()):
        raise HTTPException(status_code=409, detail="source already exists")
    source = Source(**payload.model_dump())
    db.add(source)
    _commit(db)
    db.refresh(source)
    return source


def _source_health(db: Session, source: Source) -> dict:
    candidates = db.scalars(select(Candidate).where(Candidate.source_id == source.id)).all()
    demo = bool(candidates) and all((item.metadata_json or {}).get("demo") is True for item in candidates)
    live = bool(candidates) and any((item.metadata_json or {}).get("mode") == "live" for item in candidates)
    imported = bool(candidates) and any((item.metadata_json or {}).get("mode") == "imported" for item in candidates)
    state = "live" if live else "imported" if imported else "demo" if demo else "unverified"
    return {
        "source_id": source.id, "title": source.title, "source_type": source.source_type,
        "status": state, "mode": state,
        "candidate_count": len(candidates), "trust_level": source.trust_level,
        "last_observed_at": max((item.created_at for item in candidates), default=None),
        "message": "Live provider observation recorded." if live else "Deterministic seeded data; no live connectivity check." if demo else "No live connectivity check has been performed.",
    }


@app.get("/api/sources/health")
def sources_health(db: Session = Depends(get_db)):
    return [_source_health(db, source) for source in db.scalars(select(Source).order_by(Source.id)).all()]


@app.get("/api/sources/{source_id}/health")
def source_health(source_id: int, db: Session = Depends(get_db)):
    return _source_health(db, _one_or_404(db, Source, source_id, "source"))


@app.get("/api/sources/{source_id}", response_model=SourceOut)
def get_source(source_id: int, db: Session = Depends(get_db)):
    return _one_or_404(db, Source, source_id, "source")


@app.get("/api/reports", response_model=list[ReportOut])
def list_reports(db: Session = Depends(get_db)):
    return db.scalars(select(Report).order_by(Report.id.desc())).all()


@app.post("/api/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    if payload.scan_id is not None:
        _one_or_404(db, Scan, payload.scan_id, "scan")
    report = Report(**payload.model_dump())
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@app.get("/api/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    return _one_or_404(db, Report, report_id, "report")


@app.get("/api/graph")
def graph(brand_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    brands = db.scalars(select(Brand).order_by(Brand.id)).all()
    if brand_id is not None:
        brands = [brand for brand in brands if brand.id == brand_id]
        if not brands:
            raise HTTPException(status_code=404, detail=f"brand {brand_id} not found")
    brand_ids = {brand.id for brand in brands}
    candidates = db.scalars(select(Candidate).order_by(Candidate.id)).all()
    candidates = [candidate for candidate in candidates if candidate.brand_id in brand_ids]
    assets = db.scalars(select(OfficialAsset).order_by(OfficialAsset.id)).all()
    assets = [asset for asset in assets if asset.brand_id in brand_ids]
    sources = db.scalars(select(Source).order_by(Source.id)).all()
    source_ids = {candidate.source_id for candidate in candidates if candidate.source_id}
    sources = [source for source in sources if source.id in source_ids]
    nodes = []
    edges = []
    for brand in brands:
        nodes.append({"id": f"brand:{brand.id}", "type": "brand", "label": brand.name})
    for asset in assets:
        nodes.append({"id": f"asset:{asset.id}", "type": "official_asset", "label": asset.name})
        edges.append({"source": f"brand:{asset.brand_id}", "target": f"asset:{asset.id}", "type": "owns"})
    for candidate in candidates:
        nodes.append({"id": f"candidate:{candidate.id}", "type": "candidate", "label": candidate.name})
        if candidate.brand_id:
            edges.append({"source": f"brand:{candidate.brand_id}", "target": f"candidate:{candidate.id}", "type": "related"})
        if candidate.source_id:
            edges.append({"source": f"source:{candidate.source_id}", "target": f"candidate:{candidate.id}", "type": "reported"})
    for source in sources:
        nodes.append({"id": f"source:{source.id}", "type": "source", "label": source.title})
    domains: dict[str, dict[int, list[dict]]] = {}
    for candidate in candidates:
        observations = []
        if candidate.domain:
            observations.append((candidate.domain, {"candidate_id": candidate.id, "field": "domain", "value": candidate.domain}))
        linked_domains = (candidate.metadata_json or {}).get("linked_domains", [])
        if isinstance(linked_domains, list):
            for index, item in enumerate(linked_domains):
                if isinstance(item, dict) and isinstance(item.get("domain"), str) and item.get("evidence"):
                    observations.append((item["domain"], {
                        "candidate_id": candidate.id, "field": f"metadata.linked_domains[{index}]",
                        "value": item["domain"], "evidence": item["evidence"],
                    }))
        for value, evidence in observations:
            try:
                domain = normalize_domain(value)
            except ValueError:
                continue
            domains.setdefault(domain, {}).setdefault(candidate.id, []).append(evidence)
    for domain, related in sorted(domains.items()):
        for left, right in combinations(sorted(related), 2):
            edges.append({
                "source": f"candidate:{left}", "target": f"candidate:{right}", "type": "shared_domain",
                "domain": domain, "evidence": related[left] + related[right],
            })
    return {"nodes": nodes, "edges": edges}
