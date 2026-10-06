"""CORS: FRONTEND_ORIGIN exactly, plus FRONTEND_ORIGIN_REGEX (Vercel previews) when set."""

import importlib

import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import settings

PRODUCTION = "https://aspire.leadmindset.org"
# The FRONTEND_ORIGIN_REGEX set on the production backend: previews of the
# lead-aspire project in the lead-admin-tech team, hash and git-branch URLs.
PREVIEW_REGEX = r"^https://lead-aspire-(?:[a-z0-9]+|git-[a-z0-9-]+)-lead-admin-tech\.vercel\.app$"


def cors_client(monkeypatch, regex: str) -> TestClient:
    """A fresh app built with these settings (the middleware reads them at import)."""
    monkeypatch.setattr(settings, "frontend_origin", PRODUCTION)
    monkeypatch.setattr(settings, "frontend_origin_regex", regex)
    return TestClient(importlib.reload(main).app)


@pytest.fixture(autouse=True)
def restore_app():
    yield
    # monkeypatch has restored the settings by now; rebuild the app with them.
    importlib.reload(main)


def preflight(client: TestClient, origin: str):
    return client.options(
        "/health",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )


@pytest.mark.parametrize(
    "origin",
    [
        PRODUCTION,
        "https://lead-aspire-abc123xyz-lead-admin-tech.vercel.app",
        "https://lead-aspire-git-feature-login-lead-admin-tech.vercel.app",
    ],
)
def test_production_and_preview_origins_are_allowed(monkeypatch, origin):
    response = preflight(cors_client(monkeypatch, PREVIEW_REGEX), origin)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example.com",
        # The backend project's own previews.
        "https://lead-aspire-api-abc123xyz-lead-admin-tech.vercel.app",
        "https://lead-aspire-api-git-main-lead-admin-tech.vercel.app",
        # Lookalikes: the preview host inside another domain, another team, plain http.
        "https://lead-aspire-abc123xyz-lead-admin-tech.vercel.app.evil.com",
        "https://evil.com/https://lead-aspire-abc123xyz-lead-admin-tech.vercel.app",
        "https://lead-aspire-abc123xyz-other-team.vercel.app",
        "http://lead-aspire-abc123xyz-lead-admin-tech.vercel.app",
    ],
)
def test_other_origins_are_rejected(monkeypatch, origin):
    response = preflight(cors_client(monkeypatch, PREVIEW_REGEX), origin)
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_without_a_regex_only_the_exact_origin_is_allowed(monkeypatch):
    client = cors_client(monkeypatch, "")
    assert preflight(client, PRODUCTION).status_code == 200
    assert preflight(client, "https://lead-aspire-abc123xyz-lead-admin-tech.vercel.app").status_code == 400
