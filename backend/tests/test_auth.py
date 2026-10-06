from types import SimpleNamespace

from conftest import AUTH

USER = SimpleNamespace(id="user-1", email="student@school.edu")
CREDENTIALS = {"email": "student@school.edu", "password": "secret"}


def nyc_access(group_id=7, group_active=True, city_active=True):
    return {
        "access_role": "student",
        "city_id": 1,
        "group_id": group_id,
        "aspire_cities": {"code": "NYC", "is_active": city_active},
        "aspire_groups": {"group_code": "NYC-G07", "is_active": group_active} if group_id else None,
    }


def login_events(supabase):
    return [payload for _, action, payload in supabase.writes_to("aspire_login_events")]


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_login_rejects_wrong_password_and_records_the_attempt(client, supabase):
    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
    [event] = login_events(supabase)
    assert event["succeeded"] is False
    assert event["failure_reason"] == "invalid_credentials"


def test_login_validates_the_payload(client, supabase):
    response = client.post("/api/auth/login", json={"email": "not-an-email", "password": ""})
    assert response.status_code == 422


def test_login_rejects_an_inactive_account(client, supabase):
    supabase.password_user = USER
    supabase.respond("aspire_profiles", {"status": "disabled", "is_admin": False})

    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == 403
    assert supabase.signed_out
    assert login_events(supabase)[0]["failure_reason"] == "inactive_account"


def test_login_rejects_a_user_without_active_access(client, supabase):
    supabase.password_user = USER
    supabase.respond("aspire_profiles", {"status": "active", "is_admin": False})
    supabase.respond("aspire_user_access", [nyc_access(city_active=False), nyc_access(group_active=False)])

    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == 403
    assert login_events(supabase)[0]["failure_reason"] == "access_denied"


def test_login_returns_the_city_and_group_of_the_user(client, supabase):
    supabase.password_user = USER
    supabase.respond("aspire_profiles", {"status": "active", "is_admin": False})
    # The access with a group wins over an older one without.
    supabase.respond("aspire_user_access", [nyc_access(group_id=None), nyc_access(group_id=7)])

    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "access_role": "student",
        "city_code": "NYC",
        "group_code": "NYC-G07",
    }
    [event] = login_events(supabase)
    assert event["succeeded"] is True
    assert event["group_id"] == 7


def test_login_sends_an_admin_without_access_to_new_york(client, supabase):
    supabase.password_user = USER
    supabase.respond("aspire_profiles", {"status": "active", "is_admin": True})

    response = client.post("/api/auth/login", json=CREDENTIALS)

    assert response.status_code == 200
    assert response.json()["access_role"] == "admin"
    assert response.json()["city_code"] == "NYC"


def test_protected_routes_need_a_bearer_token(client, supabase):
    assert client.get("/api/team/progress").status_code == 401
    assert client.get("/api/team/progress", headers={"Authorization": "Token x"}).status_code == 401


def test_protected_routes_reject_an_invalid_token(client, supabase):
    response = client.get("/api/team/members", headers=AUTH)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid session token"}
