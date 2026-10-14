"""Dallas Pitch & Submit: /api/dallas/team/submission (upload-url, confirm, get)."""

import re

import pytest
from test_dallas import DALLAS_USER

from app import dallas_challenge, dallas_submission
from conftest import AUTH

PDF = "application/pdf"
MB = 1024 * 1024
STUDENT = {"user_id": "d-1", "email": "ana@school.edu", "first_name": "Ana", "last_name": "Pérez", "team_id": 7}
OUR_PATH = "DFW-team-7/1760000000-0123abcd-Final_Deck.pdf"


@pytest.fixture
def team(supabase, monkeypatch):
    """A signed-in Dallas student on team 7, with no deck yet unless queued."""
    supabase.token_user = DALLAS_USER
    monkeypatch.setattr(dallas_challenge, "shared_admin_client", lambda: supabase)
    monkeypatch.setattr(dallas_submission, "shared_admin_client", lambda: supabase)
    supabase.respond("aspire_dallas_students", [STUDENT])
    return supabase


def upload_url(client, **payload):
    body = {"file_name": "Final Deck.pdf", "size": 20 * MB, "content_type": PDF, **payload}
    return client.post("/api/dallas/team/submission/upload-url", json=body, headers=AUTH)


def confirm(client, **payload):
    return client.post("/api/dallas/team/submission/confirm", json=payload, headers=AUTH)


def test_get_returns_none_before_submitting(client, team):
    team.respond("aspire_dallas_submissions", [])
    assert client.get("/api/dallas/team/submission", headers=AUTH).json() == {"submission": None}


def test_a_student_without_a_team_cannot_upload(client, team):
    team.results["aspire_dallas_students"] = [[{**STUDENT, "team_id": None}]]
    assert upload_url(client).status_code == 403
    assert team.bucket.signed_uploads == []


def test_upload_url_signs_a_path_in_the_teams_folder(client, team):
    response = upload_url(client)

    assert response.status_code == 200
    body = response.json()
    assert re.fullmatch(r"DFW-team-7/\d+-[0-9a-f]{8}-Final_Deck\.pdf", body["path"])
    assert body["bucket"] == "aspire-team-submissions"
    assert team.bucket.signed_uploads == [body["path"]]


def test_upload_url_rejects_a_wrong_type(client, team):
    assert upload_url(client, file_name="deck.exe").status_code == 400


def test_confirm_rejects_another_teams_path(client, team):
    team.respond("aspire_dallas_submissions", [])
    path = "DFW-team-1/1760000000-0123abcd-Final_Deck.pdf"
    team.bucket.store(path, MB)

    assert confirm(client, path=path, file_name="Final Deck.pdf").status_code == 403
    assert team.writes_to("aspire_dallas_submissions") == []


def test_confirm_rejects_a_new_york_path(client, team):
    team.respond("aspire_dallas_submissions", [])
    path = "NYC-G07/1760000000-0123abcd-Final_Deck.pdf"
    team.bucket.store(path, MB)

    assert confirm(client, path=path, file_name="Final Deck.pdf").status_code == 403


def test_confirm_saves_the_deck_for_the_callers_team(client, team):
    team.respond("aspire_dallas_submissions", [{"id": 3, "storage_path": "DFW-team-7/1-old.pdf", "file_name": "old.pdf"}])
    team.bucket.store("DFW-team-7/1-old.pdf", 10)
    team.bucket.store(OUR_PATH, 20 * MB)
    team.respond(
        "aspire_dallas_submissions",
        [{"file_name": "Final Deck.pdf", "demo_link": "https://demo.test", "updated_at": "2026-10-12"}],
    )

    response = confirm(client, path=OUR_PATH, file_name="Final Deck.pdf", demo_link=" https://demo.test ")

    assert response.status_code == 200
    assert response.json()["submission"] == {
        "file_name": "Final Deck.pdf",
        "demo_link": "https://demo.test",
        "submitted_at": "2026-10-12",
    }
    [(_, action, payload)] = team.writes_to("aspire_dallas_submissions")
    assert action == "upsert"
    assert payload == {
        "team_id": 7,
        "storage_path": OUR_PATH,
        "file_name": "Final Deck.pdf",
        "content_type": PDF,
        "file_size_bytes": 20 * MB,
        "demo_link": "https://demo.test",
        "submitted_by": "d-1",
    }
    assert team.bucket.removed == ["DFW-team-7/1-old.pdf"]


def test_confirm_without_a_path_needs_a_deck_first(client, team):
    team.respond("aspire_dallas_submissions", [])
    assert confirm(client, demo_link="https://demo.test").json() == {"detail": "Upload your final deck first"}


def test_dallas_users_still_cannot_use_the_new_york_submission(client, team):
    assert client.get("/api/team/submission?city_code=DFW", headers=AUTH).status_code == 403
