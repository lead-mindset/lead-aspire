"""Colombia organizers: /api/colombia/admin/teams and /teams/{id}/deck."""

import pytest
from test_colombia import COLOMBIA_USER, NY_USER

from app import colombia_admin
from conftest import AUTH

ADMIN_STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}
ADMIN = {"is_admin": True, "status": "active"}


@pytest.fixture
def colombia(supabase, monkeypatch):
    """A signed-in Colombia account whose student row is queued; its profile is up to each test."""
    supabase.token_user = COLOMBIA_USER
    monkeypatch.setattr(colombia_admin, "shared_admin_client", lambda: supabase)
    supabase.respond("aspire_colombia_students", [ADMIN_STUDENT])
    return supabase


@pytest.mark.parametrize("path", ["/api/colombia/admin/teams", "/api/colombia/admin/teams/7/deck"])
@pytest.mark.parametrize("profile", [{"is_admin": False, "status": "active"}, {"is_admin": True, "status": "disabled"}])
def test_admin_routes_are_for_active_admins_only(client, colombia, path, profile):
    colombia.respond("aspire_profiles", profile)
    assert client.get(path, headers=AUTH).status_code == 403


def test_a_new_york_account_is_refused(client, colombia):
    colombia.token_user = NY_USER
    colombia.respond("aspire_profiles", ADMIN)
    assert client.get("/api/colombia/admin/teams", headers=AUTH).status_code == 403


def test_teams_show_members_display_name_and_submission(client, colombia):
    colombia.respond("aspire_profiles", ADMIN)
    colombia.respond(
        "aspire_colombia_teams",
        [{"id": 7, "team_number": 7, "name": "Team 7"}, {"id": 8, "team_number": 8, "name": "Team 8"}],
    )
    colombia.respond("aspire_colombia_students", [{"team_id": 7}, {"team_id": 7}, {"team_id": 8}])
    colombia.respond(
        "aspire_colombia_team_phases",
        [
            {"team_id": 7, "answers": {"display_name": "The Innovators"}},
            {"team_id": 8, "answers": {"display_name": " "}},
        ],
    )
    colombia.respond(
        "aspire_colombia_submissions",
        [{"team_id": 7, "file_name": "deck.pdf", "demo_link": "https://demo.test", "updated_at": "2026-10-14"}],
    )

    teams = client.get("/api/colombia/admin/teams", headers=AUTH).json()["teams"]

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


def test_deck_is_404_without_a_submission(client, colombia):
    colombia.respond("aspire_profiles", ADMIN)
    colombia.respond("aspire_colombia_submissions", [])

    assert client.get("/api/colombia/admin/teams/8/deck", headers=AUTH).status_code == 404


def test_deck_returns_signed_links(client, colombia):
    colombia.respond("aspire_profiles", ADMIN)
    colombia.respond(
        "aspire_colombia_submissions",
        [
            {
                "storage_path": "COL-team-8/1-ab12cd34-deck.pptx",
                "file_name": "deck.pptx",
                "content_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "demo_link": "https://demo.test",
            }
        ],
    )

    body = client.get("/api/colombia/admin/teams/8/deck", headers=AUTH).json()

    assert body["view_url"] == "http://storage.test/COL-team-8/1-ab12cd34-deck.pptx"
    assert body["file_name"] == "deck.pptx"
    assert body["demo_link"] == "https://demo.test"
