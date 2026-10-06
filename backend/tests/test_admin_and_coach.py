import pytest

from app import routes
from conftest import AUTH, NYC, TEAM_ACCESS

ADMIN = {"is_admin": True, "status": "active"}


@pytest.mark.parametrize("profile", [{"is_admin": False, "status": "active"}, {"is_admin": True, "status": "disabled"}])
def test_admin_teams_are_for_active_admins_only(client, signed_in, profile):
    signed_in.respond("aspire_profiles", profile)
    assert client.get("/api/admin/teams", headers=AUTH).status_code == 403


def test_admin_teams_count_active_members_and_show_submissions(client, signed_in):
    signed_in.respond("aspire_profiles", ADMIN)
    signed_in.respond(
        "aspire_groups",
        [
            {"id": 1, "group_code": "NYC-G01", "group_name": "Claudestrophobic"},
            {"id": 2, "group_code": "DFW-G01", "group_name": "Dallas One"},
        ],
    )
    signed_in.respond(
        "aspire_user_access",
        [
            {"group_id": 1, "user_id": "a", "aspire_profiles": {"status": "active"}},
            {"group_id": 1, "user_id": "a", "aspire_profiles": {"status": "active"}},
            {"group_id": 1, "user_id": "b", "aspire_profiles": {"status": "disabled"}},
        ],
    )
    signed_in.respond(
        "aspire_submissions",
        [{"group_id": 1, "file_name": "deck.pdf", "demo_link": None, "updated_at": "2026-10-06"}],
    )

    teams = client.get("/api/admin/teams", headers=AUTH).json()["teams"]

    assert teams[0] == {
        "group_code": "NYC-G01",
        "group_name": "Claudestrophobic",
        "city_code": "NYC",
        "members": 1,
        "deck_file": "deck.pdf",
        "demo_link": None,
        "submitted_at": "2026-10-06",
    }
    assert teams[1]["city_code"] == "DFW"
    assert teams[1]["members"] == 0


def test_admin_deck_is_404_without_a_submission(client, signed_in):
    signed_in.respond("aspire_profiles", ADMIN)
    signed_in.respond("aspire_groups", {"id": 1})

    assert client.get("/api/admin/teams/NYC-G01/deck", headers=AUTH).status_code == 404


def test_admin_deck_returns_signed_links(client, signed_in):
    signed_in.respond("aspire_profiles", ADMIN)
    signed_in.respond("aspire_groups", {"id": 1})
    signed_in.respond(
        "aspire_submissions",
        [{"storage_path": "NYC-G01/1-deck.pdf", "file_name": "deck.pdf", "content_type": "application/pdf"}],
    )

    body = client.get("/api/admin/teams/NYC-G01/deck", headers=AUTH).json()

    assert body["view_url"] == "http://storage.test/NYC-G01/1-deck.pdf"
    assert body["file_name"] == "deck.pdf"


def ask(client, **payload):
    return client.post("/api/coach/chat", json={"question": "How do I start?", **payload}, headers=AUTH)


def test_coach_answers_and_records_the_message(client, signed_in, monkeypatch):
    monkeypatch.setattr(routes, "ask_agent", lambda question, conversation_id=None: ("Talk to users.", "conv-1"))
    signed_in.respond("aspire_cities", NYC)
    signed_in.respond("aspire_user_access", [TEAM_ACCESS])

    response = ask(client)

    assert response.json() == {"answer": "Talk to users.", "conversation_id": "conv-1"}
    [(_, _, saved)] = signed_in.writes_to("aspire_coach_messages")
    assert saved["group_id"] == 7
    assert saved["user_id"] == "user-1"


def test_coach_refuses_another_users_conversation(client, signed_in):
    signed_in.respond("aspire_coach_messages", [{"id": 99}])
    assert ask(client, conversation_id="conv-of-someone-else").status_code == 403


def test_coach_reports_an_empty_answer(client, signed_in, monkeypatch):
    monkeypatch.setattr(routes, "ask_agent", lambda question, conversation_id=None: ("", "conv-1"))
    signed_in.respond("aspire_cities", NYC)
    assert ask(client).status_code == 502


def test_coach_hides_agent_failures(client, signed_in, monkeypatch):
    def broken(question, conversation_id=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(routes, "ask_agent", broken)
    signed_in.respond("aspire_cities", NYC)

    response = ask(client)

    assert response.status_code == 502
    assert "network down" not in response.text


@pytest.mark.parametrize("missing", ["foundry_project_endpoint", "foundry_agent_name"])
def test_coach_is_unavailable_without_foundry_settings(client, signed_in, monkeypatch, missing):
    calls = []
    monkeypatch.setattr(routes, "ask_agent", lambda *args, **kwargs: calls.append(args))
    monkeypatch.setattr(routes.settings, missing, "")
    signed_in.respond("aspire_cities", NYC)

    response = ask(client)

    assert response.status_code == 503
    assert response.json() == {"detail": "The coach is not configured"}
    assert calls == []


def test_coach_still_needs_a_session_without_foundry_settings(client, supabase, monkeypatch):
    monkeypatch.setattr(routes.settings, "foundry_agent_name", "")
    assert ask(client).status_code == 401
