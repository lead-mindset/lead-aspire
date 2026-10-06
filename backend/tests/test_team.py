import pytest

from app.routes import _is_group_logo, _member_name
from conftest import AUTH, NYC, TEAM_ACCESS


def test_progress_is_empty_without_a_team(client, signed_in):
    signed_in.respond("aspire_cities", NYC)

    response = client.get("/api/team/progress", headers=AUTH)

    assert response.json() == {"completed": []}


def test_progress_lists_the_completed_phases(client, signed_in):
    signed_in.respond("aspire_cities", NYC)
    signed_in.respond("aspire_user_access", [TEAM_ACCESS])
    signed_in.respond("aspire_team_progress", [{"phase_key": "discover"}, {"phase_key": "build"}])

    response = client.get("/api/team/progress", headers=AUTH)

    assert response.json() == {"completed": ["discover", "build"]}


def test_progress_needs_a_known_city(client, signed_in):
    response = client.get("/api/team/progress", params={"city_code": "XXX"}, headers=AUTH)
    assert response.status_code == 404


def test_marking_progress_needs_a_team(client, signed_in):
    signed_in.respond("aspire_cities", NYC)

    response = client.put("/api/team/progress", json={"phase": "discover", "completed": True}, headers=AUTH)

    assert response.status_code == 403


def test_marking_progress_rejects_an_unknown_phase(client, signed_in):
    response = client.put("/api/team/progress", json={"phase": "party", "completed": True}, headers=AUTH)
    assert response.status_code == 422


@pytest.mark.parametrize(("completed", "action"), [(True, "upsert"), (False, "delete")])
def test_marking_progress_saves_one_phase(client, signed_in, completed, action):
    signed_in.respond("aspire_cities", NYC)
    signed_in.respond("aspire_user_access", [TEAM_ACCESS])

    response = client.put("/api/team/progress", json={"phase": "discover", "completed": completed}, headers=AUTH)

    assert response.status_code == 200
    [(_, saved_action, payload)] = signed_in.writes_to("aspire_team_progress")
    assert saved_action == action
    if completed:
        assert payload == {"group_id": 7, "phase_key": "discover", "completed_by": "user-1"}


def test_members_show_active_names_without_email_domains(client, signed_in):
    signed_in.respond("aspire_cities", NYC)
    signed_in.respond("aspire_user_access", [TEAM_ACCESS])
    signed_in.respond(
        "aspire_user_access",
        [
            {"aspire_profiles": {"display_name": "zoe@school.edu", "status": "active"}},
            {"aspire_profiles": {"display_name": "Ana", "status": "active"}},
            {"aspire_profiles": {"display_name": "Gone", "status": "disabled"}},
            {"aspire_profiles": {"display_name": "", "status": "active"}},
        ],
    )

    response = client.get("/api/team/members", headers=AUTH)

    assert response.json() == {
        "group_code": "NYC-G07",
        "group_name": "Bao Buns",
        "logo_url": None,
        "members": [{"name": "Ana"}, {"name": "zoe"}],
    }


def test_submission_is_empty_without_one(client, signed_in):
    signed_in.respond("aspire_cities", NYC)
    signed_in.respond("aspire_user_access", [TEAM_ACCESS])

    assert client.get("/api/team/submission", headers=AUTH).json() == {"submission": None}


def submit(client, content=b"", **params):
    return client.post("/api/team/submission", params=params, content=content, headers=AUTH)


def with_team(supabase, current_submission=None):
    supabase.respond("aspire_cities", NYC)
    supabase.respond("aspire_user_access", [TEAM_ACCESS])
    supabase.respond("aspire_submissions", [current_submission] if current_submission else [])


def test_submission_rejects_a_link_that_is_not_http(client, signed_in):
    with_team(signed_in)
    assert submit(client, demo_link="javascript:alert(1)").status_code == 400


def test_submission_needs_a_deck_before_a_link(client, signed_in):
    with_team(signed_in)
    response = submit(client, demo_link="https://demo.test")
    assert response.json() == {"detail": "Upload your final deck first"}


def test_submission_accepts_only_pdf_or_powerpoint(client, signed_in):
    with_team(signed_in)
    assert submit(client, b"data", file_name="deck.exe").status_code == 400


def test_submission_uploads_the_deck(client, signed_in):
    with_team(signed_in)
    signed_in.respond(
        "aspire_submissions",
        [{"file_name": "deck.pdf", "demo_link": "https://demo.test", "updated_at": "2026-10-06"}],
    )

    response = submit(client, b"%PDF", file_name="deck.pdf", demo_link="https://demo.test")

    assert response.json() == {
        "submission": {"file_name": "deck.pdf", "demo_link": "https://demo.test", "submitted_at": "2026-10-06"}
    }
    [(_, action, payload)] = signed_in.writes_to("aspire_submissions")
    assert action == "upsert"
    assert payload["content_type"] == "application/pdf"
    assert payload["storage_path"].startswith("NYC-G07/")


def test_submission_without_a_team_is_forbidden(client, signed_in):
    signed_in.respond("aspire_cities", NYC)
    assert submit(client, b"%PDF", file_name="deck.pdf").status_code == 403


@pytest.mark.parametrize(
    ("file_name", "expected"),
    [
        ("NYC-G01.png", True),
        ("nyc-g01-Team Claudestrophobic.PNG", True),
        ("NYC-G01_logo.jpg", True),
        ("NYC-G010-other.png", False),
        ("NYC-G01.gif", False),
        ("NYC-G02.png", False),
    ],
)
def test_group_logo_file_names(file_name, expected):
    assert _is_group_logo(file_name, "NYC-G01") is expected


@pytest.mark.parametrize(
    ("display_name", "expected"),
    [("Ana", "Ana"), ("  zoe@school.edu ", "zoe"), (None, ""), ("", "")],
)
def test_member_name(display_name, expected):
    assert _member_name(display_name) == expected
