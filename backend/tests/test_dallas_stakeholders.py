"""Dallas stakeholder chats: GET /api/dallas/stakeholders and POST /{key}/chat."""

import sys

import pytest
from test_dallas import DALLAS_USER, NY_USER

from app import dallas_stakeholders
from conftest import AUTH

STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}


@pytest.fixture
def dallas(supabase, monkeypatch):
    """A signed-in Dallas student; only the CIO and CFO agents are configured."""
    supabase.token_user = DALLAS_USER
    monkeypatch.setattr(dallas_stakeholders, "shared_admin_client", lambda: supabase)
    settings = dallas_stakeholders.settings
    monkeypatch.setattr(settings, "foundry_dallas_cio_agent_name", "contoso-cio")
    monkeypatch.setattr(settings, "foundry_dallas_cfo_agent_name", "contoso-cfo")
    monkeypatch.setattr(settings, "foundry_dallas_cso_agent_name", "")
    monkeypatch.setattr(settings, "foundry_dallas_support_agent_name", "")
    supabase.respond("aspire_dallas_students", [STUDENT])
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
    return client.post(f"/api/dallas/stakeholders/{key}/chat", json=body, headers=AUTH)


def test_lists_only_the_configured_stakeholders(client, dallas):
    assert client.get("/api/dallas/stakeholders", headers=AUTH).json() == {"available": ["cio", "cfo"]}


def test_lists_none_without_the_foundry_endpoint(client, dallas, monkeypatch):
    monkeypatch.setattr(dallas_stakeholders.settings, "foundry_project_endpoint", "")
    assert client.get("/api/dallas/stakeholders", headers=AUTH).json() == {"available": []}


def test_each_stakeholder_answers_with_its_own_agent(client, dallas, agents):
    dallas.respond("aspire_dallas_students", [STUDENT])

    assert ask(client, "cio").json() == {"answer": "Answer from contoso-cio.", "conversation_id": "conv-1"}
    assert ask(client, "cfo").json()["answer"] == "Answer from contoso-cfo."
    assert agents == ["contoso-cio", "contoso-cfo"]


def test_records_the_message_with_the_stakeholders_agent(client, dallas, agents):
    ask(client, "cfo")

    [(_, _, saved)] = dallas.writes_to("aspire_coach_messages")
    assert saved["user_id"] == "d-1"
    assert saved["group_id"] is None
    assert saved["conversation_id"] == "conv-1"
    assert saved["agent_name"] == "contoso-cfo"


def test_an_unconfigured_stakeholder_is_unavailable(client, dallas, agents):
    response = ask(client, "cso")

    assert response.status_code == 503
    assert agents == []


def test_an_unknown_stakeholder_is_rejected(client, dallas, agents):
    assert ask(client, "ceo").status_code == 422
    assert agents == []


def test_refuses_another_users_conversation(client, dallas, agents):
    dallas.respond("aspire_coach_messages", [{"id": 99}])

    assert ask(client, conversation_id="conv-of-someone-else").status_code == 403
    assert agents == []


def test_hides_agent_failures(client, dallas, monkeypatch):
    def broken(question, conversation_id=None, agent_name=None):
        raise RuntimeError("network down")

    monkeypatch.setattr(sys.modules["app.foundry"], "ask_agent", broken)

    response = ask(client)

    assert response.status_code == 502
    assert "network down" not in response.text


def test_rejects_a_new_york_account(client, dallas, agents):
    dallas.token_user = NY_USER

    assert ask(client).status_code == 403
    assert agents == []
