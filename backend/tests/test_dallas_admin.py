"""Dallas organizers: /api/dallas/admin/teams and /teams/{id}/deck."""

import pytest
from test_dallas import DALLAS_USER, NY_USER

from app import dallas_admin
from conftest import AUTH

ADMIN_STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}
ADMIN = {"is_admin": True, "status": "active"}


@pytest.fixture
def dallas(supabase, monkeypatch):
    """A signed-in Dallas account whose student row is queued; its profile is up to each test."""
    supabase.token_user = DALLAS_USER
    monkeypatch.setattr(dallas_admin, "shared_admin_client", lambda: supabase)
    supabase.respond("aspire_dallas_students", [ADMIN_STUDENT])
    return supabase


@pytest.mark.parametrize("path", ["/api/dallas/admin/teams", "/api/dallas/admin/teams/7/deck"])
@pytest.mark.parametrize("profile", [{"is_admin": False, "status": "active"}, {"is_admin": True, "status": "disabled"}])
def test_admin_routes_are_for_active_admins_only(client, dallas, path, profile):
    dallas.respond("aspire_profiles", profile)
    assert client.get(path, headers=AUTH).status_code == 403


def test_a_new_york_account_is_refused(client, dallas):
    dallas.token_user = NY_USER
    dallas.respond("aspire_profiles", ADMIN)
    assert client.get("/api/dallas/admin/teams", headers=AUTH).status_code == 403


def test_teams_show_members_display_name_and_submission(client, dallas):
    dallas.respond("aspire_profiles", ADMIN)
    dallas.respond(
        "aspire_dallas_teams",
        [{"id": 7, "team_number": 7, "name": "Team 7"}, {"id": 8, "team_number": 8, "name": "Team 8"}],
    )
    dallas.respond("aspire_dallas_students", [{"team_id": 7}, {"team_id": 7}, {"team_id": 8}])
    dallas.respond(
        "aspire_dallas_team_phases",
        [
            {"team_id": 7, "answers": {"display_name": "The Innovators"}},
            {"team_id": 8, "answers": {"display_name": " "}},
        ],
    )
    dallas.respond(
        "aspire_dallas_submissions",
        [{"team_id": 7, "file_name": "deck.pdf", "demo_link": "https://demo.test", "updated_at": "2026-10-14"}],
    )

    teams = client.get("/api/dallas/admin/teams", headers=AUTH).json()["teams"]

    assert teams == [
        {
            "id": 7,
            "number": 7,
            "name": "Team 7",
            "display_name": "The Innovators",
            "members": 2,
            "deck_file": "deck.pdf",
            "demo_link": "https://demo.test",
            "submitted_at": "2026-10-14",
        },
        {
            "id": 8,
            "number": 8,
            "name": "Team 8",
            "display_name": None,
            "members": 1,
            "deck_file": None,
            "demo_link": None,
            "submitted_at": None,
        },
    ]


def test_deck_is_404_without_a_submission(client, dallas):
    dallas.respond("aspire_profiles", ADMIN)
    dallas.respond("aspire_dallas_submissions", [])

    assert client.get("/api/dallas/admin/teams/8/deck", headers=AUTH).status_code == 404


def test_deck_returns_signed_links(client, dallas):
    dallas.respond("aspire_profiles", ADMIN)
    dallas.respond(
        "aspire_dallas_submissions",
        [
            {
                "storage_path": "DFW-team-8/1-ab12cd34-deck.pptx",
                "file_name": "deck.pptx",
                "content_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "demo_link": "https://demo.test",
            }
        ],
    )

    body = client.get("/api/dallas/admin/teams/8/deck", headers=AUTH).json()

    assert body["view_url"] == "http://storage.test/DFW-team-8/1-ab12cd34-deck.pptx"
    assert body["file_name"] == "deck.pptx"
    assert body["demo_link"] == "https://demo.test"
