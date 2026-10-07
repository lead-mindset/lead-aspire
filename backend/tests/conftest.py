"""Shared fixtures: the API runs against an in-memory fake of Supabase.

No test talks to the real Supabase project or the Foundry agent.
"""

import os
import sys
import types
from types import SimpleNamespace

import pytest
from storage3.exceptions import StorageApiError

# Settings are read at import time; real values from .env are overridden.
os.environ.update(
    SUPABASE_URL="http://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY="test-service-role-key",
    FRONTEND_ORIGIN="http://localhost:3000",
    FOUNDRY_PROJECT_ENDPOINT="http://foundry.test",
    FOUNDRY_AGENT_NAME="test-agent",
)

# app.foundry builds an Azure client at import; replace it before routes import it.
fake_foundry = types.ModuleType("app.foundry")
fake_foundry.ask_agent = lambda question, conversation_id=None: ("", "")
sys.modules["app.foundry"] = fake_foundry

from fastapi.testclient import TestClient  # noqa: E402

from app import routes  # noqa: E402
from app.main import app  # noqa: E402


class FakeQuery:
    """Chainable stand-in for a postgrest query builder."""

    def __init__(self, client: "FakeSupabase", table: str):
        self.client = client
        self.table = table
        self.not_ = self

    def __getattr__(self, name):
        # select/eq/like/order/limit/is_/neq/maybe_single...: keep chaining.
        return lambda *args, **kwargs: self

    def _write(self, action: str, payload=None):
        self.client.writes.append((self.table, action, payload))
        return self

    def insert(self, payload):
        return self._write("insert", payload)

    def update(self, payload):
        return self._write("update", payload)

    def upsert(self, payload, **kwargs):
        return self._write("upsert", payload)

    def delete(self):
        return self._write("delete")

    def execute(self):
        queue = self.client.results.get(self.table, [])
        data = queue.pop(0) if queue else []
        return SimpleNamespace(data=data)


class FakeSupabase:
    def __init__(self):
        # table name -> list of `data` values, returned in order by execute().
        self.results: dict[str, list] = {}
        self.writes: list[tuple] = []
        self.signed_out = False
        self.token_user = None
        self.password_user = None
        self.bucket = FakeBucket()
        self.storage = SimpleNamespace(from_=lambda bucket: self.bucket)
        self.auth = SimpleNamespace(
            get_user=self._get_user,
            sign_in_with_password=self._sign_in,
            sign_out=self._sign_out,
        )

    def respond(self, table: str, *data):
        self.results.setdefault(table, []).extend(data)
        return self

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)

    def writes_to(self, table: str) -> list[tuple]:
        return [write for write in self.writes if write[0] == table]

    def _get_user(self, token):
        if self.token_user is None:
            raise RuntimeError("invalid token")
        return SimpleNamespace(user=self.token_user)

    def _sign_in(self, credentials):
        if self.password_user is None:
            raise RuntimeError("Invalid login credentials")
        return SimpleNamespace(user=self.password_user)

    def _sign_out(self):
        self.signed_out = True


class FakeBucket:
    """One shared bucket per test: objects by path, plus what was removed or signed."""

    def __init__(self):
        self.objects: dict[str, dict] = {}
        self.removed: list[str] = []
        self.signed_uploads: list[str] = []

    def store(self, path: str, size: int, content_type: str = "application/pdf"):
        self.objects[path] = {"name": path.rpartition("/")[2], "size": size, "content_type": content_type}

    def list(self, *args, **kwargs):
        return []

    def upload(self, path, data, options=None):
        self.store(path, len(data), (options or {}).get("content-type", ""))

    def remove(self, paths):
        self.removed.extend(paths)
        for path in paths:
            self.objects.pop(path, None)

    def info(self, path):
        if path not in self.objects:
            raise StorageApiError("Object not found", "not_found", 404)
        return self.objects[path]

    def create_signed_upload_url(self, path, options=None):
        self.signed_uploads.append(path)
        url = f"http://supabase.test/storage/v1/object/upload/sign/aspire-team-submissions/{path}?token=tok"
        return {"signed_url": url, "signedUrl": url, "token": "tok", "path": path}

    def create_signed_url(self, path, expires, options=None):
        return {"signedURL": f"http://storage.test/{path}"}


@pytest.fixture
def supabase(monkeypatch) -> FakeSupabase:
    fake = FakeSupabase()
    monkeypatch.setattr(routes, "create_admin_client", lambda: fake)
    monkeypatch.setattr(routes, "shared_admin_client", lambda: fake)
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def signed_in(supabase) -> FakeSupabase:
    """A valid session token for user `user-1`."""
    supabase.token_user = SimpleNamespace(id="user-1", email="student@school.edu")
    return supabase


AUTH = {"Authorization": "Bearer valid-token"}
NYC = {"id": 1}
TEAM_ACCESS = {"group_id": 7, "aspire_groups": {"group_code": "NYC-G07", "group_name": "Bao Buns"}}
