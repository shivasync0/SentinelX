from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.database import make_engine, session_factory


@pytest.fixture()
def client(tmp_path: Path, monkeypatch):
    db_path = tmp_path / "sentinel-test.db"
    test_engine = make_engine(f"sqlite:///{db_path}")
    monkeypatch.setattr(main, "engine", test_engine)
    monkeypatch.setattr(main, "SessionLocal", session_factory(test_engine))
    with TestClient(main.app) as test_client:
        yield test_client


def test_seeded_resources_and_graph_are_available(client: TestClient):
    assert client.get("/health").json()["status"] == "ok"
    brands = client.get("/api/brands").json()
    assert [brand["name"] for brand in brands] == ["Acme Security", "Northstar Cloud"]
    assert len(client.get("/api/official-assets").json()) == 3
    assert len(client.get("/api/candidates").json()) == 5
    graph = client.get("/api/graph").json()
    assert len(graph["nodes"]) == 13
    assert graph["edges"]


def test_demo_scan_is_persisted_and_explainable(client: TestClient):
    first = client.post("/api/scans/demo")
    assert first.status_code == 201
    body = first.json()
    assert body["status"] == "completed"
    assert body["deterministic"] is True
    assert "official assets" in body["summary"]
    assert any(item["excluded"] for item in body["findings"])
    assert any(item["signal"] == "look_alike_name" for item in body["findings"])
    fetched = client.get(f"/api/scans/{body['id']}").json()
    assert fetched["score"] == body["score"]
    assert len(client.get("/api/scans").json()) == 1


def test_create_candidate_investigation_report_and_read_back(client: TestClient):
    candidate = client.post("/api/candidates", json={"brand_id": 1, "name": "Acme Support", "domain": "support-acme.example"})
    assert candidate.status_code == 201
    assert candidate.json()["normalized_name"] == "acmesupport"
    investigation = client.post("/api/investigations", json={"title": "Review support domain", "candidate_ids": [candidate.json()["id"]]})
    assert investigation.status_code == 201
    assert client.patch(f"/api/investigations/{investigation.json()['id']}", json={"status": "in_review"}).json()["status"] == "in_review"
    report = client.post("/api/reports", json={"title": "Daily summary", "payload": {"candidate_count": 4}})
    assert report.status_code == 201
    assert client.get("/api/reports").json()[0]["payload"]["candidate_count"] == 4


def test_missing_resource_returns_404(client: TestClient):
    assert client.get("/api/brands/9999").status_code == 404
    assert client.get("/api/graph?brand_id=9999").status_code == 404


def test_extended_seed_is_idempotent_and_scans_repeatably(client: TestClient):
    from app.seed import seed_demo_data

    with main.SessionLocal() as db:
        seed_demo_data(db)
        seed_demo_data(db)
    candidates = client.get("/api/candidates").json()
    assert len(candidates) == 5
    assert {item["candidate_type"] for item in candidates} >= {"social", "mobile_app"}
    assert len(client.get("/api/sources").json()) == 3
    first = client.post("/api/scans/demo").json()
    second = client.post("/api/scans/demo").json()
    assert first["score"] == second["score"]
    assert [(item["candidate_id"], item["signal"], item["evidence"]) for item in first["findings"]] == [
        (item["candidate_id"], item["signal"], item["evidence"]) for item in second["findings"]
    ]
    for candidate in candidates:
        if candidate["candidate_type"] in {"social", "mobile_app"}:
            findings = [item for item in first["findings"] if item["candidate_id"] == candidate["id"]]
            assert findings and not any(item["excluded"] for item in findings)


def test_existing_demo_is_upgraded_without_overwriting_user_data(client: TestClient):
    from sqlalchemy import delete, select

    from app.models import Candidate, Source
    from app.seed import seed_demo_data

    client.post("/api/candidates/1/feedback", json={"verdict": "needs_review", "notes": "Preserve this"})
    before = client.get("/api/candidates/1").json()
    with main.SessionLocal() as db:
        db.execute(delete(Candidate).where(Candidate.candidate_type.in_(["social", "mobile_app"])))
        db.execute(delete(Source).where(Source.source_type.in_(["social", "mobile_app"])))
        db.commit()
        seed_demo_data(db)
        assert len(db.scalars(select(Candidate)).all()) == 5
    assert client.get("/api/candidates/1").json() == before


def test_optional_canonical_name_still_defaults_on_brand_create(client: TestClient):
    brand = client.post("/api/brands", json={"name": " New Brand ", "canonical_name": None})
    assert brand.status_code == 201
    assert brand.json()["canonical_name"] == "New Brand"


def test_brand_patch_delete_preserves_candidates_and_scan_history(client: TestClient):
    scan = client.post("/api/scans/demo").json()
    updated = client.patch("/api/brands/1", json={
        "name": "Acme Renamed", "domains": ["HTTPS://ACME.SECURITY/path", "acme.security."], "description": None,
    })
    assert updated.status_code == 200
    assert updated.json()["domains"] == ["acme.security"]
    assert updated.json()["description"] is None
    assert client.get("/api/brands/1").json()["name"] == "Acme Renamed"
    assert client.delete("/api/brands/1").status_code == 204
    assert client.get("/api/brands/1").status_code == 404
    assert not client.get("/api/official-assets?brand_id=1").json()
    assert client.get("/api/candidates/1").json()["brand_id"] is None
    assert client.get(f"/api/scans/{scan['id']}").json()["findings"] == scan["findings"]
    assert client.delete("/api/brands/1").status_code == 404


def test_official_asset_patch_delete_and_conflicts(client: TestClient):
    asset = client.post("/api/official-assets", json={
        "brand_id": 1, "name": "Help Center", "url": "HTTPS://HELP.ACME.EXAMPLE:443/#overview",
    })
    assert asset.status_code == 201
    asset_id = asset.json()["id"]
    assert asset.json()["url"] == "https://help.acme.example/"
    assert client.post("/api/official-assets", json={
        "brand_id": 1, "name": "Duplicate", "url": "https://help.acme.example",
    }).status_code == 409
    assert client.patch(f"/api/official-assets/{asset_id}", json={"url": "https://acme.security/"}).status_code == 409
    assert client.patch(f"/api/official-assets/{asset_id}", json={"brand_id": 9999}).status_code == 404
    assert client.patch(f"/api/official-assets/{asset_id}", json={"status": "retired", "fingerprint": None}).status_code == 200
    assert client.get(f"/api/official-assets/{asset_id}").json()["status"] == "retired"
    assert client.delete(f"/api/official-assets/{asset_id}").status_code == 204
    assert client.get(f"/api/official-assets/{asset_id}").status_code == 404


def test_normalization_and_duplicates_return_client_errors(client: TestClient):
    assert client.post("/api/brands", json={"name": " acme security "}).status_code == 409
    assert client.patch("/api/brands/2", json={"name": "Acme Security"}).status_code == 409
    assert client.post("/api/sources", json={"url": "HTTPS://INTEL.EXAMPLE:443/demo-feed#top", "title": "Duplicate"}).status_code == 409
    assert client.post("/api/candidates", json={"brand_id": 1, "name": "Duplicate", "domain": "ACME.SECURITY."}).status_code == 409
    source = client.post("/api/sources", json={"url": "https://BÜCHER.example:443/Feed?q=X#top", "title": "Unicode"})
    assert source.status_code == 201
    assert source.json()["url"] == "https://xn--bcher-kva.example/Feed?q=X"
    candidate = client.post("/api/candidates", json={"brand_id": 1, "name": "New social", "candidate_type": "social", "url": "social.example/new-profile"})
    assert candidate.status_code == 201
    assert candidate.json()["domain"] == "social.example"
    assert client.post("/api/candidates", json={"brand_id": 1, "name": "Duplicate profile", "candidate_type": "social", "url": "https://social.example/new-profile#bio"}).status_code == 409


@pytest.mark.parametrize("address", ["javascript:alert(1)", "ftp://example.com", "https://user:password@example.com", "https://bad host.example", "https://example.com:99999", "https://example.com\\evil", "https://[invalid"])
def test_invalid_addresses_are_rejected(client: TestClient, address: str):
    assert client.post("/api/sources", json={"url": address, "title": "Invalid"}).status_code == 422
    assert client.post("/api/candidates", json={"name": "Invalid", "domain": address}).status_code == 422


@pytest.mark.parametrize("path,payload", [
    ("/api/brands/1", {"name": None}), ("/api/brands/1", {"domains": None}),
    ("/api/brands/1", {"canonical_name": None}), ("/api/official-assets/1", {"name": None}),
    ("/api/brands/1", {"canonical_name": " "}), ("/api/official-assets/1", {"url": None}),
    ("/api/official-assets/1", {"brand_id": None}), ("/api/official-assets/1", {"status": None}),
])
def test_invalid_patch_does_not_corrupt_resources(client: TestClient, path: str, payload: dict):
    before = client.get(path).json()
    assert client.patch(path, json=payload).status_code == 422
    assert client.get(path).json() == before


def test_feedback_persists_history_without_rewriting_scan_evidence(client: TestClient):
    scan = client.post("/api/scans/demo").json()
    response = client.post("/api/candidates/1/feedback", json={"verdict": "false_positive", "notes": "Approved partner"})
    assert response.status_code == 200
    assert response.json()["status"] == "false_positive"
    assert response.json()["metadata"]["demo"] is True
    client.post("/api/candidates/1/feedback", json={"verdict": "needs_review", "notes": "Recheck ownership"})
    candidate = client.get("/api/candidates/1").json()
    assert candidate["status"] == "in_review"
    assert [item["verdict"] for item in candidate["metadata"]["feedback"]] == ["false_positive", "needs_review"]
    assert client.get(f"/api/scans/{scan['id']}").json()["findings"] == scan["findings"]
    assert client.post("/api/candidates/1/feedback", json={"verdict": "invalid"}).status_code == 422
    assert client.post("/api/candidates/9999/feedback", json={"verdict": "needs_review"}).status_code == 404


def test_source_health_distinguishes_demo_data_from_unchecked_sources(client: TestClient):
    health = client.get("/api/sources/health")
    assert health.status_code == 200
    assert sum(item["candidate_count"] for item in health.json()) == 5
    assert all(item["status"] == "demo" and item["last_observed_at"] for item in health.json())
    source = client.post("/api/sources", json={"url": "https://manual.example/feed", "title": "Manual"}).json()
    item = client.get(f"/api/sources/{source['id']}/health").json()
    assert item["status"] == "unverified"
    assert item["candidate_count"] == 0 and item["last_observed_at"] is None
    assert client.get("/api/sources/9999/health").status_code == 404


def test_live_scan_is_non_deterministic_and_surfaces_partial_provider_failure(client: TestClient, monkeypatch):
    from app.live_sources import LiveCollection

    monkeypatch.setattr(main, "collect_live_candidates", lambda db, brand: LiveCollection(errors=["Bluesky unavailable: ReadTimeout"]))
    response = client.post("/api/brands/1/live-scan")
    assert response.status_code == 201
    body = response.json()
    assert body["deterministic"] is False
    assert body["status"] == "partially_completed"
    assert "Bluesky unavailable" in body["summary"]


def test_source_health_labels_live_observations(client: TestClient):
    source = client.post("/api/sources", json={"url": "https://live.example/source", "title": "Live source"}).json()
    created = client.post("/api/candidates", json={
        "brand_id": 1, "source_id": source["id"], "name": "Live identity",
        "candidate_type": "social", "url": "https://bsky.app/profile/live.example",
        "metadata": {"mode": "live", "platform": "Bluesky"},
    })
    assert created.status_code == 201
    health = client.get(f"/api/sources/{source['id']}/health").json()
    assert health["status"] == "live"
    assert health["mode"] == "live"


def test_shared_domain_graph_edges_have_stored_evidence_and_respect_brand_filter(client: TestClient):
    graph = client.get("/api/graph?brand_id=1").json()
    candidates = {item["id"]: item for item in client.get("/api/candidates?brand_id=1").json()}
    shared = [edge for edge in graph["edges"] if edge["type"] == "shared_domain"]
    assert shared
    for edge in shared:
        assert edge["domain"] == "acme-security-login.com"
        assert len({item["candidate_id"] for item in edge["evidence"]}) == 2
        for evidence in edge["evidence"]:
            stored = candidates[evidence["candidate_id"]]
            if evidence["field"] == "domain":
                assert stored["domain"] == evidence["value"]
            else:
                assert stored["metadata"]["linked_domains"][0]["evidence"] == evidence["evidence"]
    assert not [edge for edge in client.get("/api/graph?brand_id=2").json()["edges"] if edge["type"] == "shared_domain"]
    client.post("/api/candidates", json={
        "brand_id": 1, "name": "Unrelated", "metadata": {"linked_domains": [{"domain": "acme-security-login.com"}]},
    })
    assert [edge for edge in client.get("/api/graph?brand_id=1").json()["edges"] if edge["type"] == "shared_domain"] == shared
