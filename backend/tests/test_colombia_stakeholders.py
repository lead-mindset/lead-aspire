"""Colombia stakeholder chats: GET /api/colombia/stakeholders and POST /{key}/chat."""

import sys

import pytest
from test_colombia import COLOMBIA_USER, NY_USER

from app import colombia_stakeholders
from conftest import AUTH

STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}


@pytest.fixture
def colombia(supabase, monkeypatch):
    """A signed-in Colombia student; only the CIO and CFO agents are configured."""
    supabase.token_user = COLOMBIA_USER
    monkeypatch.setattr(colombia_stakeholders, "shared_admin_client", lambda: supabase)
    settings = colombia_stakeholders.settings
    monkeypatch.setattr(settings, "foundry_colombia_cio_agent_name", "contoso-cio")
    monkeypatch.setattr(settings, "foundry_colombia_cfo_agent_name", "contoso-cfo")
    monkeypatch.setattr(settings, "foundry_colombia_cso_agent_name", "")
    monkeypatch.setattr(settings, "foundry_colombia_support_agent_name", "")
    supabase.respond("aspire_colombia_students", [STUDENT])
    return supabase


@pytest.fixture
def agents(monkeypatch):
    """Records which agent each question went to; conftest's app.foundry has no Azure client."""
    calls = []

    def fake_ask(question, conversation_id=None, agent_name=None):
        calls.append(agent_name)
        return f"Answer from {agent_name}.", "conv-1"

    monkeypatch.setattr(sys.modules["app.foundry"], "ask_agent", fake_ask)
    return calls


def ask(client, key="cio", **payload):
    body = {"question": "What worries you most?", **payload}
    return client.post(f"/api/colombia/stakeholders/{key}/chat", json=body, headers=AUTH)


def test_lists_only_the_configured_stakeholders(client, colombia):
    assert client.get("/api/colombia/stakeholders", headers=AUTH).json() == {"available": ["cio", "cfo"]}


def test_lists_none_without_the_foundry_endpoint(client, colombia, monkeypatch):
    monkeypatch.setattr(colombia_stakeholders.settings, "foundry_project_endpoint", "")
    assert client.get("/api/colombia/stakeholders", headers=AUTH).json() == {"available": []}


def test_each_stakeholder_answers_with_its_own_agent(client, colombia, agents):
    colombia.respond("aspire_colombia_students", [STUDENT])

    assert ask(client, "cio").json() == {"answer": "Answer from contoso-cio.", "conversation_id": "conv-1"}
    assert ask(client, "cfo").json()["answer"] == "Answer from contoso-cfo."
    assert agents == ["contoso-cio", "contoso-cfo"]


def test_records_the_message_with_the_stakeholders_agent(client, colombia, agents):
    ask(client, "cfo")

    [(_, _, saved)] = colombia.writes_to("aspire_coach_messages")
    assert saved["user_id"] == "d-1"
    assert saved["group_id"] is None
    assert saved["conversation_id"] == "conv-1"
    assert saved["agent_name"] == "contoso-cfo"


def test_an_unconfigured_stakeholder_is_unavailable(client, colombia, agents):
    response = ask(client, "cso")

    assert response.status_code == 503
    assert agents == []


def test_an_unknown_stakeholder_is_rejected(client, colombia, agents):
    assert ask(client, "ceo").status_code == 422
    assert agents == []


def test_refuses_another_users_conversation(client, colombia, agents):
    colombia.respond("aspire_coach_messages", [{"id": 99}])

    assert ask(client, conversation_id="conv-of-someone-else").status_code == 403
    assert agents == []


def test_hides_agent_failures(client, colombia, monkeypatch):
    def broken(question, conversation_id=None, agent_name=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(sys.modules["app.foundry"], "ask_agent", broken)

    response = ask(client)

    assert response.status_code == 502
    assert "network down" not in response.text


def test_rejects_a_new_york_account(client, colombia, agents):
    colombia.token_user = NY_USER

    assert ask(client).status_code == 403
    assert agents == []
