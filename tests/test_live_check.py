from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app import live_check, main
from app.database import make_engine, session_factory


@pytest.fixture()
def client(tmp_path: Path, monkeypatch):
    engine = make_engine(f"sqlite:///{tmp_path / 'live-check.db'}")
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "SessionLocal", session_factory(engine))
    with TestClient(main.app) as test_client:
        yield test_client


class FakeResponse:
    def __init__(self, status_code=200, headers=None, body=b""):
        self.status_code = status_code
        self.headers = headers or {}
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def iter_bytes(self):
        yield self._body


class FakeClient:
    def __init__(self, response=None, error=None, **kwargs):
        self.response = response
        self.error = error

    def stream(self, method, url, headers):
        if self.error:
            raise self.error
        return self.response

    def close(self):
        pass


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/",
    "http://10.0.0.7/",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.0.2.1/",
])
def test_live_check_rejects_ssrf_addresses(client, url):
    response = client.post("/api/live-check", json={"url": url})
    assert response.status_code == 400
    body = response.json()
    assert body["status"] == "blocked"
    assert body["blocked"] is True
    assert body["mode"] == "live"


def test_live_check_returns_structured_timeout_error(client, monkeypatch):
    monkeypatch.setattr(live_check, "_resolve_public_host", lambda url: None)
    monkeypatch.setattr(
        live_check.httpx,
        "Client",
        lambda **kwargs: FakeClient(error=httpx.ConnectTimeout("test timeout")),
    )
    response = client.post("/api/live-check", json={"url": "https://public.example/"})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "error"
    assert body["error"] == "request_timeout"
    assert body["http_status"] is None
    assert client.get("/api/observations").json() == []


def test_live_check_extracts_metadata_and_deterministic_signals(client, monkeypatch):
    monkeypatch.setattr(live_check, "_resolve_public_host", lambda url: None)
    html = b"""
    <html><head><title>Acme Security</title>
      <meta name='description' content='Official security platform'>
    </head><body><a href='/docs'>Docs</a></body></html>
    """
    fake_response = FakeResponse(
        headers={"content-type": "text/html; charset=utf-8", "content-length": str(len(html))},
        body=html,
    )
    monkeypatch.setattr(live_check.httpx, "Client", lambda **kwargs: FakeClient(response=fake_response))
    response = client.post("/api/live-check", json={
        "url": "https://acme.security/landing",
        "brand_id": 1,
        "asset_type": "website",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["mode"] == "live"
    assert body["source_url"] == "https://acme.security/landing"
    assert body["final_url"] == body["source_url"]
    assert body["http_status"] == 200
    assert body["content_type"].startswith("text/html")
    assert body["title"] == "Acme Security"
    assert body["description"] == "Official security platform"
    assert body["domain"] == "acme.security"
    assert body["signals"]["name"]["normalized"] == "acmesecurity"
    assert body["signals"]["name"]["matched"] is True
    assert body["signals"]["link"]["matched"] is True
    assert body["links"] == ["https://acme.security/docs"]


def test_live_check_blocks_private_redirect_target(monkeypatch):
    def resolve(url):
        if "127.0.0.1" in url:
            raise live_check.PublicURLRejected("private address")

    monkeypatch.setattr(live_check, "_resolve_public_host", resolve)
    first = FakeResponse(status_code=302, headers={"location": "http://127.0.0.1/admin"})
    monkeypatch.setattr(live_check.httpx, "Client", lambda **kwargs: FakeClient(response=first))
    result = live_check.perform_live_check("https://public.example/", asset_type="website")
    assert result["status"] == "blocked"
    assert result["blocked"] is True
    assert result["error"] == "redirect_target_blocked"


def test_live_check_persists_history_and_detects_changed_and_unchanged_metadata(client, monkeypatch):
    monkeypatch.setattr(live_check, "_resolve_public_host", lambda url: None)
    bodies = [
        b"<html><head><title>Acme Security</title><meta name='description' content='First'></head></html>",
        b"<html><head><title>Acme Support</title><meta name='description' content='Second'></head></html>",
        b"<html><head><title>Acme Support</title><meta name='description' content='Second'></head></html>",
    ]

    def make_client(**kwargs):
        body = bodies.pop(0)
        return FakeClient(response=FakeResponse(
            headers={"content-type": "text/html; charset=utf-8"}, body=body,
        ))

    monkeypatch.setattr(live_check.httpx, "Client", make_client)
    payload = {"url": "https://acme.security/landing", "brand_id": 1, "asset_type": "website"}
    first = client.post("/api/live-check", json=payload).json()
    second = client.post("/api/live-check", json=payload).json()
    third = client.post("/api/live-check", json=payload).json()

    assert first["changed"] is False
    assert first["changed_fields"] == []
    assert second["changed"] is True
    assert "title" in second["changed_fields"]
    assert "description" in second["changed_fields"]
    assert second["previous_observed_at"]
    assert third["changed"] is False
    assert third["changed_fields"] == []
    assert third["previous_observed_at"]

    history = client.get("/api/brands/1/observations?limit=10")
    assert history.status_code == 200
    assert len(history.json()) == 3
    assert history.json()[0]["candidate_id"] == 2
    assert len(client.get("/api/candidates/2/observations").json()) == 3
    assert len(client.get("/api/observations?brand_id=1&candidate_id=2").json()) == 3


def test_live_check_persists_structured_blocked_observation(client):
    response = client.post("/api/live-check", json={"url": "http://127.0.0.2/blocked", "brand_id": 1})
    assert response.status_code == 400
    assert response.json()["status"] == "blocked"
    history = client.get("/api/brands/1/observations").json()
    assert len(history) == 1
    assert history[0]["status"] == "blocked"
    assert history[0]["blocked"] is True
    assert history[0]["source_url"] == "http://127.0.0.2/blocked"


def test_live_check_persists_structured_error_when_brand_is_supplied(client, monkeypatch):
    monkeypatch.setattr(live_check, "_resolve_public_host", lambda url: None)
    monkeypatch.setattr(
        live_check.httpx,
        "Client",
        lambda **kwargs: FakeClient(error=httpx.ConnectTimeout("test timeout")),
    )
    response = client.post("/api/live-check", json={
        "url": "https://public.example/error", "brand_id": 1,
    })
    assert response.status_code == 200
    assert response.json()["status"] == "error"
    history = client.get("/api/observations?brand_id=1").json()
    assert len(history) == 1
    assert history[0]["status"] == "error"
    assert history[0]["error"] == "request_timeout"
