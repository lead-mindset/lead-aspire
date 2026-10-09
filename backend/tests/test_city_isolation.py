"""New York and Dallas cannot use each other's routes, and New York login is unchanged."""

from types import SimpleNamespace

import pytest
from test_dallas import DALLAS_USER, LOGIN, NY_USER, STUDENT, FakeAdmin, FakeSessionClient

from app import routes
from conftest import AUTH

NY_ROUTES = [
    ("get", "/api/auth/me", None),
    ("get", "/api/team/members", None),
    ("get", "/api/team/progress", None),
    ("put", "/api/team/progress", {"phase": "discover", "completed": True}),
    ("get", "/api/team/submission", None),
    ("post", "/api/team/submission/confirm", {"demo_link": "https://x.test"}),
    ("post", "/api/coach/chat", {"question": "hi"}),
    ("get", "/api/admin/teams", None),
    ("get", "/api/admin/teams/NYC-G01/deck", None),
]

DALLAS_ROUTES = [
    ("get", "/api/dallas/me", None),
    ("get", "/api/dallas/teams", None),
    ("post", "/api/dallas/profile", {"first_name": "A", "last_name": "B", "team_id": 1}),
    ("get", "/api/dallas/team/state", None),
    ("post", "/api/dallas/team/phases/brief/answers", {"patch": {"q1": "x"}}),
    ("post", "/api/dallas/team/phases/brief/open", None),
    ("post", "/api/dallas/team/phases/brief/complete", None),
]


def call(client, method, path, body):
    kwargs = {"headers": AUTH}
    if body is not None:
        kwargs["json"] = body
    return getattr(client, method)(path, **kwargs)


# --- Dallas users stay out of New York ----------------------------------------


@pytest.mark.parametrize(("method", "path", "body"), NY_ROUTES)
def test_a_dallas_token_is_rejected_by_every_new_york_route(client, signed_in, monkeypatch, method, path, body):
    signed_in.token_user = DALLAS_USER
    # Even an admin profile would not let a Dallas account in.
    signed_in.respond("aspire_profiles", {"status": "active", "is_admin": True})
    monkeypatch.setattr(routes, "ask_agent", lambda *args: pytest.fail("the coach must not answer"))

    response = call(client, method, path, body)

    assert response.status_code == 403
    assert signed_in.writes == []


def test_a_dallas_user_cannot_log_in_through_the_new_york_login(client, supabase):
    supabase.password_user = DALLAS_USER

    response = client.post("/api/auth/login", json={"email": DALLAS_USER.email, "password": "anything"})

    assert response.status_code == 403
    assert supabase.signed_out
    [(_, _, event)] = supabase.writes_to("aspire_login_events")
    assert (event["succeeded"], event["failure_reason"]) == (False, "access_denied")


# --- New York regression ------------------------------------------------------


def test_a_new_york_account_with_the_shared_password_still_logs_in(client, supabase):
    # Placeholder for the shared New York password; the fake accepts any password.
    supabase.password_user = NY_USER
    supabase.respond("aspire_profiles", {"status": "active", "is_admin": False})
    supabase.respond(
        "aspire_user_access",
        [
            {
                "access_role": "member",
                "city_id": 1,
                "group_id": 7,
                "aspire_cities": {"code": "NYC", "is_active": True},
                "aspire_groups": {"group_code": "NYC-G07", "is_active": True},
            }
        ],
    )

    response = client.post(
        "/api/auth/login", json={"email": NY_USER.email, "password": "shared-new-york-password"}
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "access_role": "member", "city_code": "NYC", "group_code": "NYC-G07"}
    assert not supabase.signed_out


def test_a_new_york_token_with_real_app_metadata_still_works(client, signed_in):
    signed_in.token_user = NY_USER
    signed_in.respond("aspire_cities", {"id": 1})
    signed_in.respond("aspire_user_access", [])

    response = client.get("/api/team/members", headers=AUTH)

    assert response.status_code == 200


# --- New York users stay out of Dallas ----------------------------------------


@pytest.fixture
def dallas_fakes(supabase, monkeypatch):
    from app import dallas_challenge, dallas_routes

    supabase.auth.admin = FakeAdmin()
    supabase.session_client = FakeSessionClient()
    supabase.rpc = lambda *args: pytest.fail("no database function may run")
    monkeypatch.setattr(dallas_routes, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(dallas_challenge, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(dallas_routes, "create_admin_client", lambda: supabase.session_client)
    return supabase


@pytest.mark.parametrize(("method", "path", "body"), DALLAS_ROUTES)
def test_a_new_york_token_is_rejected_by_every_dallas_route(client, dallas_fakes, method, path, body):
    dallas_fakes.token_user = NY_USER
    dallas_fakes.respond("aspire_dallas_students", [STUDENT])  # never reached

    response = call(client, method, path, body)

    assert response.status_code == 403
    assert dallas_fakes.writes == []


@pytest.mark.parametrize(("method", "path", "body"), DALLAS_ROUTES)
def test_a_marked_user_without_a_student_row_is_rejected(client, dallas_fakes, method, path, body):
    dallas_fakes.token_user = DALLAS_USER
    dallas_fakes.respond("aspire_dallas_students", [])

    assert call(client, method, path, body).status_code == 403


@pytest.mark.parametrize(("method", "path", "body"), DALLAS_ROUTES)
def test_dallas_routes_need_a_valid_token(client, dallas_fakes, method, path, body):
    assert getattr(client, method)(path, **({"json": body} if body else {})).status_code == 401
    assert call(client, method, path, body).status_code == 401  # no token user


def test_a_new_york_email_cannot_log_in_through_the_dallas_login(client, dallas_fakes):
    from supabase_auth.errors import AuthApiError

    dallas_fakes.respond("aspire_dallas_event_codes", [{"id": 1}])
    dallas_fakes.respond("aspire_dallas_students", [])
    dallas_fakes.auth.admin.create_error = AuthApiError("already registered", 422, "email_exists")
    dallas_fakes.auth.admin.link_user = NY_USER

    response = client.post("/api/dallas/auth/login", json={**LOGIN, "email": NY_USER.email})

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or event code"}  # same as a wrong code
    assert dallas_fakes.session_client.verified == []  # no session issued
    assert dallas_fakes.writes == []  # no Dallas row for a New York account


def test_an_existing_dallas_row_does_not_override_the_account_check(client, dallas_fakes):
    # Even if a row pointed at a non-Dallas account, the Auth user's mark decides.
    dallas_fakes.respond("aspire_dallas_event_codes", [{"id": 1}])
    dallas_fakes.respond("aspire_dallas_students", [{"user_id": "user-1", "team_id": 3}])
    dallas_fakes.auth.admin.link_user = SimpleNamespace(id="user-1", app_metadata={})

    assert client.post("/api/dallas/auth/login", json=LOGIN).status_code == 401
    assert dallas_fakes.session_client.verified == []
