from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .detection import normalize_name
from .models import Brand, Candidate, OfficialAsset, Source


def seed_demo_data(db: Session) -> None:
    if db.scalar(select(Brand.id).limit(1)) is not None:
        _seed_extended_demo(db)
        return
    acme = Brand(name="Acme Security", canonical_name="Acme Security", domains=["acme.security", "acmesecurity.com"], description="Demo protected brand")
    northstar = Brand(name="Northstar Cloud", canonical_name="Northstar Cloud", domains=["northstar.cloud"], description="Demo SaaS brand")
    db.add_all([acme, northstar])
    db.flush()
    db.add_all([
        OfficialAsset(brand_id=acme.id, asset_type="domain", name="Acme Security", url="https://acme.security", fingerprint="demo-acme-web"),
        OfficialAsset(brand_id=acme.id, asset_type="social", name="Acme Security Official", url="https://social.example/acmesecurity", fingerprint="demo-acme-social"),
        OfficialAsset(brand_id=northstar.id, asset_type="domain", name="Northstar Cloud", url="https://northstar.cloud", fingerprint="demo-northstar-web"),
    ])
    source = Source(url="https://intel.example/demo-feed", title="Sentinel X Demo Feed", publisher="Sentinel X", source_type="feed", trust_level="medium")
    db.add(source)
    db.flush()
    db.add_all([
        Candidate(brand_id=acme.id, source_id=source.id, name="Acme Secur1ty", normalized_name=normalize_name("Acme Secur1ty"), candidate_type="phishing", domain="acme-security-login.com", url="https://acme-security-login.com", metadata_json={"demo": True}),
        Candidate(brand_id=acme.id, source_id=source.id, name="Acme Security", normalized_name=normalize_name("Acme Security"), candidate_type="domain", domain="acme.security", url="https://acme.security", metadata_json={"demo": True, "official": True}),
        Candidate(brand_id=northstar.id, source_id=source.id, name="Northst4r Cloud", normalized_name=normalize_name("Northst4r Cloud"), candidate_type="login", domain="northstar-cloud-auth.com", url="https://northstar-cloud-auth.com", metadata_json={"demo": True}),
    ])
    db.commit()
    _seed_extended_demo(db)


def _seed_extended_demo(db: Session) -> None:
    """Upgrade an existing demo without replacing user-created resources."""
    acme = db.scalar(select(Brand).where(Brand.name == "Acme Security"))
    if acme is None:
        return
    specs = [
        {
            "source_url": "https://intel.example/demo-social-feed", "title": "Sentinel X Demo Social Feed",
            "source_type": "social", "name": "Acme Secur1ty Support", "candidate_type": "social",
            "domain": "social.example", "url": "https://social.example/acme-security-help",
            "evidence": "Seeded demo profile bio links to https://acme-security-login.com.",
        },
        {
            "source_url": "https://intel.example/demo-app-feed", "title": "Sentinel X Demo App Feed",
            "source_type": "mobile_app", "name": "Acme Secur1ty Mobile", "candidate_type": "mobile_app",
            "domain": "apps.example", "url": "https://apps.example/store/acme-security-mobile",
            "evidence": "Seeded demo app listing records https://acme-security-login.com as its support website.",
        },
    ]
    for spec in specs:
        source = db.scalar(select(Source).where(Source.url == spec["source_url"]))
        if source is None:
            source = Source(url=spec["source_url"], title=spec["title"], publisher="Sentinel X",
                            source_type=spec["source_type"], trust_level="demo")
            db.add(source)
            db.flush()
        candidate = db.scalar(select(Candidate).where(Candidate.url == spec["url"], Candidate.brand_id == acme.id))
        if candidate is None:
            db.add(Candidate(
                brand_id=acme.id, source_id=source.id, name=spec["name"],
                normalized_name=normalize_name(spec["name"]), candidate_type=spec["candidate_type"],
                domain=spec["domain"], url=spec["url"], metadata_json={
                    "demo": True, "linked_domains": [{"domain": "acme-security-login.com", "evidence": spec["evidence"]}],
                },
            ))
    db.commit()
