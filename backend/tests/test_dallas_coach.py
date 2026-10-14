"""Dallas coach: POST /api/dallas/coach/chat."""

import sys

import pytest
from test_dallas import DALLAS_USER, NY_USER

from app import dallas_coach
from conftest import AUTH

STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}


@pytest.fixture
def dallas(supabase, monkeypatch):
    """A signed-in Dallas student with the Dallas agent configured."""
    supabase.token_user = DALLAS_USER
    monkeypatch.setattr(dallas_coach, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(dallas_coach.settings, "foundry_dallas_agent_name", "dallas-agent")
    supabase.respond("aspire_dallas_students", [STUDENT])
    return supabase


def ask(client, **payload):
    return client.post("/api/dallas/coach/chat", json={"question": "How do I start?", **payload}, headers=AUTH)


def test_answers_with_the_dallas_agent_and_records_the_message(client, dallas, monkeypatch):
    calls = []

    def fake_ask(question, conversation_id=None, agent_name=None):
        calls.append(agent_name)
        return "Start with the brief.", "conv-1"

    # conftest replaces app.foundry with a fake module (no Azure client).
    monkeypatch.setattr(sys.modules["app.foundry"], "ask_agent", fake_ask)

    response = ask(client)

    assert response.json() == {"answer": "Start with the brief.", "conversation_id": "conv-1"}
    assert calls == ["dallas-agent"]
    [(_, _, saved)] = dallas.writes_to("aspire_coach_messages")
    assert saved["user_id"] == "d-1"
    assert saved["group_id"] is None
    assert saved["agent_name"] == "dallas-agent"


def test_is_unavailable_without_the_dallas_agent_name(client, dallas, monkeypatch):
    monkeypatch.setattr(dallas_coach.settings, "foundry_dallas_agent_name", "")
    monkeypatch.setattr(
        dallas_coach, "ask_dallas_agent", lambda *args: pytest.fail("the coach must not answer")
    )

    response = ask(client)

    assert response.status_code == 503
    assert response.json() == {"detail": "The coach is not configured"}


def test_refuses_another_users_conversation(client, dallas):
    dallas.respond("aspire_coach_messages", [{"id": 99}])
    assert ask(client, conversation_id="conv-of-someone-else").status_code == 403


def test_hides_agent_failures(client, dallas, monkeypatch):
    def broken(question, conversation_id=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(dallas_coach, "ask_dallas_agent", broken)

    response = ask(client)

    assert response.status_code == 502
    assert "network down" not in response.text


def test_rejects_a_new_york_account(client, dallas, monkeypatch):
    dallas.token_user = NY_USER
    monkeypatch.setattr(
        dallas_coach, "ask_dallas_agent", lambda *args: pytest.fail("the coach must not answer")
    )
    assert ask(client).status_code == 403


def test_needs_a_session(client, dallas):
    assert client.post("/api/dallas/coach/chat", json={"question": "Hi"}).status_code == 401
