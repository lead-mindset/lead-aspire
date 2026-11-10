"""Colombia login (/api/colombia/auth/login), team selection and dashboard data."""

from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from app import colombia_routes
from conftest import AUTH

COLOMBIA_USER = SimpleNamespace(
    id="d-1", email="ana@school.edu", app_metadata={"provider": "email", "aspire_city": "COL"}
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
        self.link_user = COLOMBIA_USER

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
        return SimpleNamespace(session=session, user=COLOMBIA_USER)


@pytest.fixture
def colombia(supabase, monkeypatch):
    """`supabase` is the shared client (no verify_otp on it); `.session_client` the per-request one."""
    supabase.auth.admin = FakeAdmin()
    supabase.session_client = FakeSessionClient()
    monkeypatch.setattr(colombia_routes, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(colombia_routes, "create_admin_client", lambda: supabase.session_client)
    return supabase


@pytest.fixture
def colombia_student(colombia):
    """A valid Colombia session token whose student row is queued first."""
    colombia.token_user = COLOMBIA_USER
    return colombia


def login(client, **overrides):
    return client.post("/api/colombia/auth/login", json={**LOGIN, **overrides})


# --- Step 1: email + event code ----------------------------------------------


def test_wrong_or_inactive_code_gets_a_generic_error_and_touches_no_account(client, colombia):
    colombia.respond("aspire_colombia_event_codes", [])  # no active row matches

    response = login(client)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or event code"}
    assert colombia.auth.admin.created == []
    assert colombia.auth.admin.links == []


def test_the_event_code_is_compared_trimmed_and_lowercased(monkeypatch):
    calls = []

    class Recorder:
        def __getattr__(self, name):
            return lambda *args, **kwargs: calls.append((name, args)) or self

        def execute(self):
            return SimpleNamespace(data=[CODE_OK])

    client = SimpleNamespace(table=lambda name: Recorder())

    assert colombia_routes._event_code_is_active(client, "  ASPIRE-Event-CODE ")
    assert ("eq", ("code", "aspire-event-code")) in calls
    assert ("eq", ("is_active", True)) in calls


def test_a_new_email_creates_a_confirmed_colombia_user_and_returns_a_session(client, colombia):
    colombia.respond("aspire_colombia_event_codes", [CODE_OK])
    colombia.respond("aspire_colombia_students", [], [{"user_id": "d-1", "team_id": None}])

    response = login(client, email="  Ana@School.EDU ")

    assert response.status_code == 200
    assert response.json() == {
        "access_token": "access-1",
        "refresh_token": "refresh-1",
        "expires_at": 1_900_000_000,
        "needs_profile": True,
    }
    assert colombia.auth.admin.created == [
        {"email": "ana@school.edu", "email_confirm": True, "app_metadata": {"aspire_city": "COL"}}
    ]
    assert colombia.auth.admin.links == [{"type": "magiclink", "email": "ana@school.edu"}]
    [(_, action, row)] = colombia.writes_to("aspire_colombia_students")
    assert (action, row) == ("upsert", {"user_id": "d-1", "email": "ana@school.edu"})
    # The token hash is verified on the per-request client, never the shared one.
    assert colombia.session_client.verified == [{"token_hash": "hash-1", "type": "magiclink"}]


def test_a_returning_student_with_a_team_skips_step_two(client, colombia):
    colombia.respond("aspire_colombia_event_codes", [CODE_OK])
    colombia.respond("aspire_colombia_students", [{"user_id": "d-1", "team_id": 8}])

    response = login(client)

    assert response.status_code == 200
    assert response.json()["needs_profile"] is False
    assert colombia.auth.admin.created == []  # no new account on a new device or after a refresh
    assert colombia.writes_to("aspire_colombia_students") == []


def test_a_returning_student_without_a_team_still_needs_step_two(client, colombia):
    colombia.respond("aspire_colombia_event_codes", [CODE_OK])
    colombia.respond("aspire_colombia_students", [{"user_id": "d-1", "team_id": None}])

    assert login(client).json()["needs_profile"] is True


def test_a_colombia_user_whose_student_row_is_missing_is_repaired(client, colombia):
    colombia.respond("aspire_colombia_event_codes", [CODE_OK])
    colombia.respond("aspire_colombia_students", [], [{"user_id": "d-1", "team_id": None}])
    colombia.auth.admin.create_error = AuthApiError("already registered", 422, "email_exists")

    response = login(client)

    assert response.status_code == 200
    assert len(colombia.writes_to("aspire_colombia_students")) == 1


def test_an_invalid_email_is_rejected(client, colombia):
    assert login(client, email="not-an-email").status_code == 422
    assert login(client, event_code="").status_code == 422


def test_a_supabase_rate_limit_is_reported_as_busy(client, colombia):
    colombia.respond("aspire_colombia_event_codes", [CODE_OK])
    colombia.respond("aspire_colombia_students", [{"user_id": "d-1", "team_id": None}])
    colombia.session_client.error = AuthApiError("rate limit", 429, "over_request_rate_limit")

    response = login(client)

    assert response.status_code == 503
    assert "Too many sign-ins" in response.json()["detail"]


# --- Step 2: name + team, once -----------------------------------------------


PROFILE = {"first_name": "  Ana  María ", "last_name": "Pérez", "team_id": 8}


def save_profile(client, payload=PROFILE):
    return client.post("/api/colombia/profile", json=payload, headers=AUTH)


def test_first_profile_save_stores_name_and_team(client, colombia_student):
    saved = {**STUDENT, "first_name": "Ana María", "last_name": "Pérez", "team_id": 8}
    colombia_student.respond("aspire_colombia_students", [STUDENT], [saved], [saved])
    colombia_student.respond("aspire_colombia_teams", [TEAM_8], [TEAM_8])

    response = save_profile(client)

    assert response.status_code == 200
    assert response.json()["team"] == {"id": 8, "number": 8, "name": "Team 8"}
    assert response.json()["members"] == [{"first_name": "Ana María", "last_name": "Pérez"}]
    [(_, action, row)] = colombia_student.writes_to("aspire_colombia_students")
    assert action == "update"
    assert (row["first_name"], row["last_name"], row["team_id"]) == ("Ana María", "Pérez", 8)


def test_a_saved_team_cannot_be_changed(client, colombia_student):
    colombia_student.respond(
        "aspire_colombia_students",
        [{**STUDENT, "first_name": "A", "last_name": "B", "team_id": 8}],
    )

    response = save_profile(client, {**PROFILE, "team_id": 9})

    assert response.status_code == 409
    assert colombia_student.writes_to("aspire_colombia_students") == []


def test_a_concurrent_second_save_is_rejected(client, colombia_student):
    # The row had no team when read, but another tab saved one first.
    colombia_student.respond("aspire_colombia_students", [STUDENT], [])
    colombia_student.respond("aspire_colombia_teams", [TEAM_8])

    assert save_profile(client).status_code == 409


def test_the_database_team_lock_is_reported_as_conflict(client, colombia_student, monkeypatch):
    colombia_student.respond("aspire_colombia_students", [STUDENT])
    colombia_student.respond("aspire_colombia_teams", [TEAM_8])
    original_table = colombia_student.table

    def table(name):
        query = original_table(name)
        if name == "aspire_colombia_students":
            def refused(payload):
                raise APIError({"code": "23514", "message": "the team of a student cannot be changed"})
            query.update = refused
        return query

    monkeypatch.setattr(colombia_student, "table", table)

    assert save_profile(client).status_code == 409


def test_an_unknown_or_inactive_team_is_rejected(client, colombia_student):
    colombia_student.respond("aspire_colombia_students", [STUDENT])
    colombia_student.respond("aspire_colombia_teams", [])

    assert save_profile(client).status_code == 400
    assert colombia_student.writes_to("aspire_colombia_students") == []


@pytest.mark.parametrize("payload", [{**PROFILE, "first_name": "   "}, {**PROFILE, "team_id": 0}, {"team_id": 8}])
def test_profile_payload_is_validated(client, colombia_student, payload):
    assert save_profile(client, payload).status_code == 422


# --- Dashboard data ------------------------------------------------------------


def test_me_returns_the_student_team_and_members(client, colombia_student):
    student = {**STUDENT, "first_name": "Ana", "last_name": "Pérez", "team_id": 8}
    colombia_student.respond(
        "aspire_colombia_students",
        [student],
        [{"first_name": "Ana", "last_name": "Pérez"}, {"first_name": "Luis", "last_name": "Gómez"}],
    )
    colombia_student.respond("aspire_colombia_teams", [TEAM_8])

    response = client.get("/api/colombia/me", headers=AUTH)

    assert response.json() == {
        "email": "ana@school.edu",
        "first_name": "Ana",
        "last_name": "Pérez",
        "team": {"id": 8, "number": 8, "name": "Team 8"},
        "members": [{"first_name": "Ana", "last_name": "Pérez"}, {"first_name": "Luis", "last_name": "Gómez"}],
        "is_admin": False,
    }


def test_me_marks_an_active_admin(client, colombia_student):
    colombia_student.respond("aspire_colombia_students", [STUDENT])
    colombia_student.respond("aspire_profiles", {"is_admin": True, "status": "active"})

    assert client.get("/api/colombia/me", headers=AUTH).json()["is_admin"] is True


def test_me_before_step_two_has_no_team(client, colombia_student):
    colombia_student.respond("aspire_colombia_students", [STUDENT])

    body = client.get("/api/colombia/me", headers=AUTH).json()

    assert body["team"] is None
    assert body["members"] == []


def test_teams_lists_the_active_teams(client, colombia_student):
    colombia_student.respond("aspire_colombia_students", [STUDENT])
    colombia_student.respond("aspire_colombia_teams", [TEAM_8, {"id": 9, "team_number": 9, "name": "Team 9"}])

    teams = client.get("/api/colombia/teams", headers=AUTH).json()["teams"]

    assert [team["name"] for team in teams] == ["Team 8", "Team 9"]
