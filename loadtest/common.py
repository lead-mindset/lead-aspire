"""Shared settings and Supabase admin helpers for the load-test scripts.

Only the test accounts and groups below are ever touched. Every helper that
deletes checks names against these patterns first.
"""

import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

USER_COUNT = 90
GROUP_SIZE = 5
GROUP_COUNT = USER_COUNT // GROUP_SIZE  # 18
CITY_CODE = "NYC"
SUBMISSION_BUCKET = "aspire-team-submissions"
USERS_CSV = HERE / "test_users.csv"

EMAIL_RE = re.compile(r"^loadtest\d{2}@test\.lead$")
GROUP_RE = re.compile(r"^NYC-LOADTEST-\d{2}$")


def email_for(n: int) -> str:
    return f"loadtest{n:02d}@test.lead"


def group_for(n: int) -> str:
    """User n (1-based) belongs to group ((n-1) // 5) + 1: five per group."""
    return f"NYC-LOADTEST-{(n - 1) // GROUP_SIZE + 1:02d}"


def is_uploader(n: int) -> bool:
    """The first member of each group uploads the deck (18 uploads)."""
    return (n - 1) % GROUP_SIZE == 0


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Set {name} in loadtest/.env (see .env.example).")
    return value


class SupabaseAdmin:
    """Thin REST client for Supabase Auth admin, PostgREST and Storage (service role)."""

    def __init__(self) -> None:
        self.url = env("SUPABASE_URL").rstrip("/")
        key = env("SUPABASE_SERVICE_ROLE_KEY")
        self.session = requests.Session()
        self.session.headers.update({"apikey": key, "Authorization": f"Bearer {key}"})

    def _check(self, response: requests.Response) -> requests.Response:
        if response.status_code >= 400:
            raise RuntimeError(
                f"{response.request.method} {response.url} -> {response.status_code}: {response.text[:300]}"
            )
        return response

    # ---- Auth admin ----

    def list_test_users(self) -> dict[str, dict]:
        """Every loadtestNN@test.lead auth user, by email."""
        users: dict[str, dict] = {}
        page = 1
        while True:
            response = self._check(
                self.session.get(
                    f"{self.url}/auth/v1/admin/users", params={"page": page, "per_page": 1000}
                )
            )
            batch = response.json().get("users", [])
            for user in batch:
                email = (user.get("email") or "").lower()
                if EMAIL_RE.match(email):
                    users[email] = user
            if len(batch) < 1000:
                return users
            page += 1

    def create_user(self, email: str, password: str) -> dict:
        response = self.session.post(
            f"{self.url}/auth/v1/admin/users",
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"display_name": email.split("@")[0]},
            },
        )
        return self._check(response).json()

    def set_password(self, user_id: str, email: str, password: str) -> None:
        assert EMAIL_RE.match(email), email
        self._check(
            self.session.put(f"{self.url}/auth/v1/admin/users/{user_id}", json={"password": password})
        )

    def delete_user(self, user_id: str, email: str) -> None:
        assert EMAIL_RE.match(email), email
        self._check(self.session.delete(f"{self.url}/auth/v1/admin/users/{user_id}"))

    # ---- PostgREST ----

    def select(self, table: str, params: dict) -> list[dict]:
        return self._check(self.session.get(f"{self.url}/rest/v1/{table}", params=params)).json()

    def count(self, table: str, params: dict) -> int:
        response = self._check(
            self.session.head(
                f"{self.url}/rest/v1/{table}",
                params={**params, "select": "*"},
                headers={"Prefer": "count=exact"},
            )
        )
        return int(response.headers.get("content-range", "*/0").split("/")[-1] or 0)

    def insert(self, table: str, rows: list[dict], on_conflict: str | None = None) -> list[dict]:
        params = {"on_conflict": on_conflict} if on_conflict else {}
        prefer = "return=representation"
        if on_conflict:
            prefer += ",resolution=merge-duplicates"
        response = self.session.post(
            f"{self.url}/rest/v1/{table}", params=params, json=rows, headers={"Prefer": prefer}
        )
        return self._check(response).json()

    def update(self, table: str, params: dict, values: dict) -> None:
        self._check(self.session.patch(f"{self.url}/rest/v1/{table}", params=params, json=values))

    def delete(self, table: str, params: dict) -> None:
        if not params:
            raise ValueError("Refusing an unfiltered delete")
        self._check(self.session.delete(f"{self.url}/rest/v1/{table}", params=params))

    # ---- Storage ----

    def list_objects(self, bucket: str, folder: str) -> list[str]:
        """Paths of the files directly inside `folder` (decks are stored one level deep)."""
        paths: list[str] = []
        offset = 0
        while True:
            response = self._check(
                self.session.post(
                    f"{self.url}/storage/v1/object/list/{bucket}",
                    json={"prefix": folder, "limit": 1000, "offset": offset},
                )
            )
            batch = response.json()
            paths += [f"{folder}/{item['name']}" for item in batch if item.get("id")]
            if len(batch) < 1000:
                return paths
            offset += 1000

    def remove_objects(self, bucket: str, paths: list[str]) -> None:
        for path in paths:
            assert GROUP_RE.match(path.split("/")[0]), path
        for start in range(0, len(paths), 100):
            self._check(
                self.session.delete(
                    f"{self.url}/storage/v1/object/{bucket}",
                    json={"prefixes": paths[start : start + 100]},
                )
            )


def in_list(values) -> str:
    """PostgREST `in` filter value."""
    return "in.(" + ",".join(str(v) for v in values) + ")"
