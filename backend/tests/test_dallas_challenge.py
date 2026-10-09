"""Dallas challenge: shared answers, timers and progress (/api/dallas/team/*)."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from postgrest.exceptions import APIError
from test_dallas import DALLAS_USER

from app import dallas_challenge
from conftest import AUTH

STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}
MEMBERS = [
    {"user_id": "d-1", "first_name": "Ana", "last_name": "Pérez"},
    {"user_id": "d-2", "first_name": "Luis", "last_name": "Gómez"},
]
TEAM_7 = {"id": 7, "team_number": 7, "name": "Team 7"}


class FakeRpc:
    """client.rpc(name, params).execute(): records the call, returns the queued row."""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.results: list = []
        self.error: Exception | None = None

    def __call__(self, name, params):
        self.calls.append((name, params))
        return self

    def execute(self):
        if self.error:
            raise self.error
        return SimpleNamespace(data=self.results.pop(0) if self.results else {})


@pytest.fixture
def team(supabase, monkeypatch):
    """A signed-in Dallas student on team 7; `.rpc` records the database function calls."""
    supabase.token_user = DALLAS_USER
    supabase.rpc = FakeRpc()
    monkeypatch.setattr(dallas_challenge, "shared_admin_client", lambda: supabase)
    supabase.respond("aspire_dallas_students", [STUDENT])
    return supabase


def phase_row(phase, answers=None, **fields):
    return {"team_id": 7, "phase": phase, "answers": answers or {}, **fields}


def save(client, phase, patch):
    return client.post(f"/api/dallas/team/phases/{phase}/answers", json={"patch": patch}, headers=AUTH)


# --- GET /state ----------------------------------------------------------------


def test_state_returns_the_team_members_and_every_phase(client, team):
    team.respond("aspire_dallas_teams", [TEAM_7])
    team.respond("aspire_dallas_students", MEMBERS)
    team.respond(
        "aspire_dallas_team_phases",
        [
            phase_row(
                "team",
                {"display_name": "Lone Star Labs", "role_ae": "d-2"},
                updated_by="d-2",
                updated_at="2026-10-08T15:00:00+00:00",
                completed_at="2026-10-08T15:01:00+00:00",
            ),
            phase_row("brief", started_at="2026-10-08T15:02:00+00:00"),
        ],
    )

    body = client.get("/api/dallas/team/state", headers=AUTH).json()

    assert body["team"] == {"id": 7, "number": 7, "name": "Team 7", "display_name": "Lone Star Labs"}
    assert [m["user_id"] for m in body["members"]] == ["d-1", "d-2"]
    assert list(body["phases"]) == ["team", "brief", "discover", "diagnose", "advise", "respond", "deliver"]
    assert body["phases"]["team"]["answers"] == {"display_name": "Lone Star Labs", "role_ae": "d-2"}
    assert body["phases"]["team"]["updated_by_name"] == "Luis Gómez"
    assert body["phases"]["team"]["completed_at"] == "2026-10-08T15:01:00+00:00"
    assert body["phases"]["brief"]["started_at"] == "2026-10-08T15:02:00+00:00"
    assert body["phases"]["deliver"] == {
        "answers": {},
        "started_at": None,
        "completed_at": None,
        "updated_at": None,
        "updated_by_name": None,
    }
    assert body["server_time"]


def test_state_has_no_team_name_until_set(client, team):
    team.respond("aspire_dallas_teams", [TEAM_7])
    team.respond("aspire_dallas_students", MEMBERS)
    team.respond("aspire_dallas_team_phases", [])

    assert client.get("/api/dallas/team/state", headers=AUTH).json()["team"]["display_name"] is None


# --- POST /phases/{phase}/answers ---------------------------------------------


def test_save_merges_only_the_sent_keys_for_the_callers_team(client, team):
    team.respond("aspire_dallas_students", MEMBERS)
    team.rpc.results.append(phase_row("team", {"role_ae": "d-2"}, updated_by="d-1", updated_at="t"))

    response = save(client, "team", {"role_ae": "d-2", "display_name": "  Lone   Star  "})

    assert response.status_code == 200
    assert response.json()["phase"]["updated_by_name"] == "Ana Pérez"
    [(name, params)] = team.rpc.calls
    assert name == "aspire_dallas_save_answers"
    # Team and user come from the session, never from the request.
    assert params == {
        "p_team_id": 7,
        "p_phase": "team",
        "p_patch": {"role_ae": "d-2", "display_name": "Lone Star"},
        "p_user_id": "d-1",
    }


@pytest.mark.parametrize(
    ("phase", "patch"),
    [
        ("team", {"roles": {"ae": "d-2"}}),  # nested objects are not accepted
        ("team", {"role_ae": "someone-else"}),  # not a member of the team
        ("team", {"display_name": "x" * 33}),
        ("brief", {"q1": "x" * 2001}),
        ("brief", {"missing_cost": False}),
        ("discover", {"workload": 2}),
        ("diagnose", {"cause_Bad Key": True}),
        ("diagnose", {"class_support": 3}),
        ("advise", {"rec_mon": "1"}),
        ("advise", {"rec_mon": True}),
        ("respond", {"slot_0": "mon"}),
        ("deliver", {"situation": "x" * 501}),
        ("deliver", {"outcome_cost": "x" * 11}),
    ],
)
def test_save_rejects_unknown_keys_and_bad_values(client, team, phase, patch):
    team.respond("aspire_dallas_students", MEMBERS)

    response = save(client, phase, patch)

    assert response.status_code == 422
    assert team.rpc.calls == []


def test_save_accepts_null_to_remove_a_key(client, team):
    team.respond("aspire_dallas_students", MEMBERS)

    assert save(client, "diagnose", {"cause_governance": None, "class_support": None}).status_code == 200
    assert team.rpc.calls[0][1]["p_patch"] == {"cause_governance": None, "class_support": None}


def test_an_unknown_phase_or_empty_patch_is_rejected(client, team):
    assert save(client, "results", {"x": 1}).status_code == 422
    assert save(client, "brief", {}).status_code == 422


def test_the_team_name_locks_once_the_team_phase_is_complete(client, team):
    team.respond("aspire_dallas_students", MEMBERS)
    team.respond("aspire_dallas_team_phases", [phase_row("team", completed_at="2026-10-08T15:00:00+00:00")])

    response = save(client, "team", {"display_name": "New name"})

    assert response.status_code == 409
    assert response.json()["detail"] == "The team name is locked once the Team phase is complete"
    assert team.rpc.calls == []


def test_roles_stay_editable_after_the_team_phase_is_complete(client, team):
    team.respond("aspire_dallas_students", MEMBERS)

    assert save(client, "team", {"role_csa": "d-1"}).status_code == 200


def test_the_database_lock_is_reported_as_conflict(client, team):
    team.respond("aspire_dallas_students", MEMBERS)
    team.respond("aspire_dallas_team_phases", [])  # not complete when checked here
    team.rpc.error = APIError({"code": "23514", "message": "aspire_dallas: the team name is locked"})

    assert save(client, "team", {"display_name": "New name"}).status_code == 409


# --- POST /phases/{phase}/open and /complete --------------------------------------


def test_open_starts_the_timer_through_the_database(client, team):
    team.rpc.results.append(phase_row("brief", started_at="2026-10-08T15:02:00+00:00"))
    team.respond("aspire_dallas_students", MEMBERS)

    response = client.post("/api/dallas/team/phases/brief/open", headers=AUTH)

    assert response.json()["phase"]["started_at"] == "2026-10-08T15:02:00+00:00"
    assert team.rpc.calls == [("aspire_dallas_open_phase", {"p_team_id": 7, "p_phase": "brief"})]


@pytest.mark.parametrize(
    ("phase", "answers"),
    [
        ("team", {"display_name": "Lone Star"}),  # no role
        ("team", {"role_ae": "d-1"}),  # no name
        ("brief", {"q1": "   "}),
        ("diagnose", {"cause_a": True, "cause_b": True}),
        ("diagnose", {"cause_a": True, "cause_b": True, "cause_c": True, "cause_d": True}),
        ("advise", {}),
        ("deliver", {"situation": "s", "ms_rec": "m"}),
    ],
)
def test_complete_needs_the_minimum(client, team, phase, answers):
    team.respond("aspire_dallas_team_phases", [phase_row(phase, answers)])

    response = client.post(f"/api/dallas/team/phases/{phase}/complete", headers=AUTH)

    assert response.status_code == 409
    assert team.rpc.calls == []


@pytest.mark.parametrize(
    ("phase", "answers"),
    [
        ("team", {"display_name": "Lone Star", "role_ae": "d-1"}),
        ("brief", {"q1": "Usage limits"}),
        ("discover", {}),
        ("diagnose", {"cause_a": True, "cause_b": True, "cause_c": True}),
        ("advise", {"rec_mon": 1}),
        ("respond", {}),
        ("deliver", {"situation": "s", "ms_rec": "m", "statement": "x"}),
    ],
)
def test_complete_marks_the_phase_done(client, team, phase, answers):
    team.respond("aspire_dallas_team_phases", [phase_row(phase, answers)])
    team.respond("aspire_dallas_students", MEMBERS)
    team.rpc.results.append(phase_row(phase, answers, completed_at="2026-10-08T15:05:00+00:00"))

    response = client.post(f"/api/dallas/team/phases/{phase}/complete", headers=AUTH)

    assert response.status_code == 200
    assert response.json()["phase"]["completed_at"] == "2026-10-08T15:05:00+00:00"
    assert team.rpc.calls == [("aspire_dallas_complete_phase", {"p_team_id": 7, "p_phase": phase, "p_user_id": "d-1"})]


# --- Who may call ----------------------------------------------------------------

ROUTES = [
    ("get", "/api/dallas/team/state", None),
    ("post", "/api/dallas/team/phases/brief/answers", {"patch": {"q1": "x"}}),
    ("post", "/api/dallas/team/phases/brief/open", None),
    ("post", "/api/dallas/team/phases/brief/complete", None),
]


@pytest.mark.parametrize(("method", "path", "body"), ROUTES)
def test_a_student_without_a_team_is_rejected(client, supabase, monkeypatch, method, path, body):
    supabase.token_user = DALLAS_USER
    supabase.rpc = FakeRpc()
    monkeypatch.setattr(dallas_challenge, "shared_admin_client", lambda: supabase)
    supabase.respond("aspire_dallas_students", [{**STUDENT, "team_id": None}])

    response = getattr(client, method)(path, headers=AUTH, **({"json": body} if body else {}))

    assert response.status_code == 403
    assert supabase.rpc.calls == []


def test_validate_patch_names_the_bad_key():
    with pytest.raises(HTTPException) as raised:
        dallas_challenge.validate_patch("brief", {"q1": "ok", "q9": "x"}, set())
    assert raised.value.status_code == 422
    assert "q9" in raised.value.detail
