"""Dallas login (/api/dallas/auth/login), team selection and dashboard data."""

from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from app import dallas_routes
from conftest import AUTH

DALLAS_USER = SimpleNamespace(
    id="d-1", email="ana@school.edu", app_metadata={"provider": "email", "aspire_city": "DFW"}
)
NY_USER = SimpleNamespace(
    id="user-1", email="student@school.edu", app_metadata={"provider": "email", "providers": ["email"]}
)
CODE_OK = {"id": 1}
LOGIN = {"email": "ana@school.edu", "event_code": "the-event-code"}
STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": None, "last_name": None, "team_id": None}
TEAM_8 = {"id": 8, "team_number": 8, "name": "Team 8"}


class FakeAdmin:
    """auth.admin: create_user and generate_link, recording their calls."""

    def __init__(self):
        self.created: list[dict] = []
        self.links: list[dict] = []
        self.create_error: Exception | None = None
        self.link_error: Exception | None = None
        self.link_user = DALLAS_USER

    def create_user(self, attributes):
        self.created.append(attributes)
        if self.create_error:
            raise self.create_error

    def generate_link(self, params):
        self.links.append(params)
        if self.link_error:
            raise self.link_error
        return SimpleNamespace(user=self.link_user, properties=SimpleNamespace(hashed_token="hash-1"))


class FakeSessionClient:
    """The per-request client: the only one verify_otp may run on."""

    def __init__(self):
        self.verified: list[dict] = []
        self.error: Exception | None = None
        self.auth = SimpleNamespace(verify_otp=self._verify_otp)

    def _verify_otp(self, params):
        self.verified.append(params)
        if self.error:
            raise self.error
        session = SimpleNamespace(access_token="access-1", refresh_token="refresh-1", expires_at=1_900_000_000)
        return SimpleNamespace(session=session, user=DALLAS_USER)


@pytest.fixture
def dallas(supabase, monkeypatch):
    """`supabase` is the shared client (no verify_otp on it); `.session_client` the per-request one."""
    supabase.auth.admin = FakeAdmin()
    supabase.session_client = FakeSessionClient()
    monkeypatch.setattr(dallas_routes, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(dallas_routes, "create_admin_client", lambda: supabase.session_client)
    return supabase


@pytest.fixture
def dallas_student(dallas):
    """A valid Dallas session token whose student row is queued first."""
    dallas.token_user = DALLAS_USER
    return dallas


def login(client, **overrides):
    return client.post("/api/dallas/auth/login", json={**LOGIN, **overrides})


# --- Step 1: email + event code ----------------------------------------------


def test_wrong_or_inactive_code_gets_a_generic_error_and_touches_no_account(client, dallas):
    dallas.respond("aspire_dallas_event_codes", [])  # no active row matches

    response = login(client)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or event code"}
    assert dallas.auth.admin.created == []
    assert dallas.auth.admin.links == []


def test_the_event_code_is_compared_trimmed_and_lowercased(monkeypatch):
    calls = []

    class Recorder:
        def __getattr__(self, name):
            return lambda *args, **kwargs: calls.append((name, args)) or self

        def execute(self):
            return SimpleNamespace(data=[CODE_OK])

    client = SimpleNamespace(table=lambda name: Recorder())

    assert dallas_routes._event_code_is_active(client, "  ASPIRE-Event-CODE ")
    assert ("eq", ("code", "aspire-event-code")) in calls
    assert ("eq", ("is_active", True)) in calls


def test_a_new_email_creates_a_confirmed_dallas_user_and_returns_a_session(client, dallas):
    dallas.respond("aspire_dallas_event_codes", [CODE_OK])
    dallas.respond("aspire_dallas_students", [], [{"user_id": "d-1", "team_id": None}])

    response = login(client, email="  Ana@School.EDU ")

    assert response.status_code == 200
    assert response.json() == {
        "access_token": "access-1",
        "refresh_token": "refresh-1",
        "expires_at": 1_900_000_000,
        "needs_profile": True,
    }
    assert dallas.auth.admin.created == [
        {"email": "ana@school.edu", "email_confirm": True, "app_metadata": {"aspire_city": "DFW"}}
    ]
    assert dallas.auth.admin.links == [{"type": "magiclink", "email": "ana@school.edu"}]
    [(_, action, row)] = dallas.writes_to("aspire_dallas_students")
    assert (action, row) == ("upsert", {"user_id": "d-1", "email": "ana@school.edu"})
    # The token hash is verified on the per-request client, never the shared one.
    assert dallas.session_client.verified == [{"token_hash": "hash-1", "type": "magiclink"}]


def test_a_returning_student_with_a_team_skips_step_two(client, dallas):
    dallas.respond("aspire_dallas_event_codes", [CODE_OK])
    dallas.respond("aspire_dallas_students", [{"user_id": "d-1", "team_id": 8}])

    response = login(client)

    assert response.status_code == 200
    assert response.json()["needs_profile"] is False
    assert dallas.auth.admin.created == []  # no new account on a new device or after a refresh
    assert dallas.writes_to("aspire_dallas_students") == []


def test_a_returning_student_without_a_team_still_needs_step_two(client, dallas):
    dallas.respond("aspire_dallas_event_codes", [CODE_OK])
    dallas.respond("aspire_dallas_students", [{"user_id": "d-1", "team_id": None}])

    assert login(client).json()["needs_profile"] is True


def test_a_dallas_user_whose_student_row_is_missing_is_repaired(client, dallas):
    dallas.respond("aspire_dallas_event_codes", [CODE_OK])
    dallas.respond("aspire_dallas_students", [], [{"user_id": "d-1", "team_id": None}])
    dallas.auth.admin.create_error = AuthApiError("already registered", 422, "email_exists")

    response = login(client)

    assert response.status_code == 200
    assert len(dallas.writes_to("aspire_dallas_students")) == 1


def test_an_invalid_email_is_rejected(client, dallas):
    assert login(client, email="not-an-email").status_code == 422
    assert login(client, event_code="").status_code == 422


def test_a_supabase_rate_limit_is_reported_as_busy(client, dallas):
    dallas.respond("aspire_dallas_event_codes", [CODE_OK])
    dallas.respond("aspire_dallas_students", [{"user_id": "d-1", "team_id": None}])
    dallas.session_client.error = AuthApiError("rate limit", 429, "over_request_rate_limit")

    response = login(client)

    assert response.status_code == 503
    assert "Too many sign-ins" in response.json()["detail"]


# --- Step 2: name + team, once -----------------------------------------------


PROFILE = {"first_name": "  Ana  María ", "last_name": "Pérez", "team_id": 8}


def save_profile(client, payload=PROFILE):
    return client.post("/api/dallas/profile", json=payload, headers=AUTH)


def test_first_profile_save_stores_name_and_team(client, dallas_student):
    saved = {**STUDENT, "first_name": "Ana María", "last_name": "Pérez", "team_id": 8}
    dallas_student.respond("aspire_dallas_students", [STUDENT], [saved], [saved])
    dallas_student.respond("aspire_dallas_teams", [TEAM_8], [TEAM_8])

    response = save_profile(client)

    assert response.status_code == 200
    assert response.json()["team"] == {"id": 8, "number": 8, "name": "Team 8"}
    assert response.json()["members"] == [{"first_name": "Ana María", "last_name": "Pérez"}]
    [(_, action, row)] = dallas_student.writes_to("aspire_dallas_students")
    assert action == "update"
    assert (row["first_name"], row["last_name"], row["team_id"]) == ("Ana María", "Pérez", 8)


def test_a_saved_team_cannot_be_changed(client, dallas_student):
    dallas_student.respond("aspire_dallas_students", [{**STUDENT, "first_name": "A", "last_name": "B", "team_id": 8}])

    response = save_profile(client, {**PROFILE, "team_id": 9})

    assert response.status_code == 409
    assert dallas_student.writes_to("aspire_dallas_students") == []


def test_a_concurrent_second_save_is_rejected(client, dallas_student):
    # The row had no team when read, but another tab saved one first.
    dallas_student.respond("aspire_dallas_students", [STUDENT], [])
    dallas_student.respond("aspire_dallas_teams", [TEAM_8])

    assert save_profile(client).status_code == 409


def test_the_database_team_lock_is_reported_as_conflict(client, dallas_student, monkeypatch):
    dallas_student.respond("aspire_dallas_students", [STUDENT])
    dallas_student.respond("aspire_dallas_teams", [TEAM_8])
    original_table = dallas_student.table

    def table(name):
        query = original_table(name)
        if name == "aspire_dallas_students":
            def refused(payload):
                raise APIError({"code": "23514", "message": "the team of a student cannot be changed"})
            query.update = refused
        return query

    monkeypatch.setattr(dallas_student, "table", table)

    assert save_profile(client).status_code == 409


def test_an_unknown_or_inactive_team_is_rejected(client, dallas_student):
    dallas_student.respond("aspire_dallas_students", [STUDENT])
    dallas_student.respond("aspire_dallas_teams", [])

    assert save_profile(client).status_code == 400
    assert dallas_student.writes_to("aspire_dallas_students") == []


@pytest.mark.parametrize("payload", [{**PROFILE, "first_name": "   "}, {**PROFILE, "team_id": 0}, {"team_id": 8}])
def test_profile_payload_is_validated(client, dallas_student, payload):
    assert save_profile(client, payload).status_code == 422


# --- Dashboard data ------------------------------------------------------------


def test_me_returns_the_student_team_and_members(client, dallas_student):
    student = {**STUDENT, "first_name": "Ana", "last_name": "Pérez", "team_id": 8}
    dallas_student.respond(
        "aspire_dallas_students",
        [student],
        [{"first_name": "Ana", "last_name": "Pérez"}, {"first_name": "Luis", "last_name": "Gómez"}],
    )
    dallas_student.respond("aspire_dallas_teams", [TEAM_8])

    response = client.get("/api/dallas/me", headers=AUTH)

    assert response.json() == {
        "email": "ana@school.edu",
        "first_name": "Ana",
        "last_name": "Pérez",
        "team": {"id": 8, "number": 8, "name": "Team 8"},
        "members": [{"first_name": "Ana", "last_name": "Pérez"}, {"first_name": "Luis", "last_name": "Gómez"}],
    }


def test_me_before_step_two_has_no_team(client, dallas_student):
    dallas_student.respond("aspire_dallas_students", [STUDENT])

    body = client.get("/api/dallas/me", headers=AUTH).json()

    assert body["team"] is None
    assert body["members"] == []


def test_teams_lists_the_active_teams(client, dallas_student):
    dallas_student.respond("aspire_dallas_students", [STUDENT])
    dallas_student.respond("aspire_dallas_teams", [TEAM_8, {"id": 9, "team_number": 9, "name": "Team 9"}])

    teams = client.get("/api/dallas/teams", headers=AUTH).json()["teams"]

    assert [team["name"] for team in teams] == ["Team 8", "Team 9"]
