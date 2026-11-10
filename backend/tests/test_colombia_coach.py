"""Colombia coach: POST /api/colombia/coach/chat."""

import sys

import pytest
from test_colombia import COLOMBIA_USER, NY_USER

from app import colombia_coach
from conftest import AUTH

STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}


@pytest.fixture
def colombia(supabase, monkeypatch):
    """A signed-in Colombia student with the Colombia agent configured."""
    supabase.token_user = COLOMBIA_USER
    monkeypatch.setattr(colombia_coach, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(colombia_coach.settings, "foundry_colombia_agent_name", "colombia-agent")
    supabase.respond("aspire_colombia_students", [STUDENT])
    return supabase


def ask(client, **payload):
    return client.post("/api/colombia/coach/chat", json={"question": "How do I start?", **payload}, headers=AUTH)


def test_answers_with_the_colombia_agent_and_records_the_message(client, colombia, monkeypatch):
    calls = []

    def fake_ask(question, conversation_id=None, agent_name=None):
        calls.append(agent_name)
        return "Start with the brief.", "conv-1"

    # conftest replaces app.foundry with a fake module (no Azure client).
    monkeypatch.setattr(sys.modules["app.foundry"], "ask_agent", fake_ask)

    response = ask(client)

    assert response.json() == {"answer": "Start with the brief.", "conversation_id": "conv-1"}
    assert calls == ["colombia-agent"]
    [(_, _, saved)] = colombia.writes_to("aspire_coach_messages")
    assert saved["user_id"] == "d-1"
    assert saved["group_id"] is None
    assert saved["agent_name"] == "colombia-agent"


def test_is_unavailable_without_the_colombia_agent_name(client, colombia, monkeypatch):
    monkeypatch.setattr(colombia_coach.settings, "foundry_colombia_agent_name", "")
    monkeypatch.setattr(
        colombia_coach, "ask_colombia_agent", lambda *args: pytest.fail("the coach must not answer")
    )

    response = ask(client)

    assert response.status_code == 503
    assert response.json() == {"detail": "The coach is not configured"}


def test_refuses_another_users_conversation(client, colombia):
    colombia.respond("aspire_coach_messages", [{"id": 99}])
    assert ask(client, conversation_id="conv-of-someone-else").status_code == 403


def test_hides_agent_failures(client, colombia, monkeypatch):
    def broken(question, conversation_id=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(colombia_coach, "ask_colombia_agent", broken)

    response = ask(client)

    assert response.status_code == 502
    assert "network down" not in response.text


def test_rejects_a_new_york_account(client, colombia, monkeypatch):
    colombia.token_user = NY_USER
    monkeypatch.setattr(
        colombia_coach, "ask_colombia_agent", lambda *args: pytest.fail("the coach must not answer")
    )
    assert ask(client).status_code == 403


def test_needs_a_session(client, colombia):
    assert client.post("/api/colombia/coach/chat", json={"question": "Hi"}).status_code == 401
