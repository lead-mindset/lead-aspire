"""Deck upload straight to Storage: /submission/upload-url, then /submission/confirm."""

import re

import pytest

from conftest import AUTH, NYC, TEAM_ACCESS

PDF = "application/pdf"
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
MB = 1024 * 1024
OUR_PATH = "NYC-G07/1760000000-0123abcd-Final_Deck.pdf"


def upload_url(client, **payload):
    body = {"file_name": "Final Deck.pdf", "size": 20 * MB, "content_type": PDF, **payload}
    return client.post("/api/team/submission/upload-url", json=body, headers=AUTH)


def confirm(client, **payload):
    return client.post("/api/team/submission/confirm", json=payload, headers=AUTH)


def with_team(supabase, current_submission=None):
    supabase.respond("aspire_cities", NYC)
    supabase.respond("aspire_user_access", [TEAM_ACCESS])
    supabase.respond("aspire_submissions", [current_submission] if current_submission else [])


def uploaded(supabase, path=OUR_PATH, size=20 * MB, content_type=PDF):
    supabase.bucket.store(path, size, content_type)
    return path


# --- upload-url ----------------------------------------------------------------


@pytest.mark.parametrize("headers", [{}, AUTH])
def test_upload_url_needs_a_valid_session(client, supabase, headers):
    # `supabase` without `signed_in`: the token is missing or rejected.
    payload = {"file_name": "deck.pdf", "size": 1}
    response = client.post("/api/team/submission/upload-url", json=payload, headers=headers)
    assert response.status_code == 401
    assert supabase.bucket.signed_uploads == []


def test_upload_url_needs_a_team(client, signed_in):
    signed_in.respond("aspire_cities", NYC)
    assert upload_url(client).status_code == 403
    assert signed_in.bucket.signed_uploads == []


def test_upload_url_rejects_a_file_over_50_mb(client, signed_in):
    with_team(signed_in)
    assert upload_url(client, size=50 * MB + 1).status_code == 413
    assert signed_in.bucket.signed_uploads == []


@pytest.mark.parametrize(
    ("file_name", "content_type"),
    [("deck.exe", "application/octet-stream"), ("deck.pdf", "image/png"), ("deck.pptx", PDF)],
)
def test_upload_url_rejects_a_wrong_type(client, signed_in, file_name, content_type):
    with_team(signed_in)
    assert upload_url(client, file_name=file_name, content_type=content_type).status_code == 400
    assert signed_in.bucket.signed_uploads == []


def test_upload_url_fails_fast_on_a_bad_demo_link(client, signed_in):
    with_team(signed_in)
    assert upload_url(client, demo_link="javascript:alert(1)").status_code == 400


def test_upload_url_signs_a_server_built_path(client, signed_in):
    with_team(signed_in)

    # No browser type: the extension decides. Slashes never reach the path.
    response = upload_url(client, file_name="../Final Deck.pptx", content_type="")

    assert response.status_code == 200
    body = response.json()
    assert re.fullmatch(r"NYC-G07/\d+-[0-9a-f]{8}-\.\._Final_Deck\.pptx", body["path"])
    assert body == {"bucket": "aspire-team-submissions", "path": body["path"], "token": "tok", "content_type": PPTX}
    assert signed_in.bucket.signed_uploads == [body["path"]]


# --- confirm -------------------------------------------------------------------


def test_confirm_needs_a_valid_session(client, supabase):
    response = client.post("/api/team/submission/confirm", json={"path": OUR_PATH})
    assert response.status_code == 401


def test_confirm_rejects_another_teams_path(client, signed_in):
    with_team(signed_in)
    path = uploaded(signed_in, path="NYC-G01/1760000000-0123abcd-Final_Deck.pdf")

    response = confirm(client, path=path, file_name="Final Deck.pdf")

    assert response.status_code == 403
    assert signed_in.writes_to("aspire_submissions") == []
    assert path in signed_in.bucket.objects  # not ours to delete


def test_confirm_rejects_a_path_that_does_not_match_the_file_name(client, signed_in):
    with_team(signed_in)
    assert confirm(client, path=uploaded(signed_in), file_name="Other.pdf").status_code == 400
    assert signed_in.writes_to("aspire_submissions") == []


def test_confirm_with_a_missing_file(client, signed_in):
    with_team(signed_in)

    response = confirm(client, path=OUR_PATH, file_name="Final Deck.pdf")

    assert response.status_code == 400
    assert response.json() == {"detail": "The deck was not uploaded. Please try again."}
    assert signed_in.writes_to("aspire_submissions") == []


def test_confirm_deletes_a_stored_file_over_50_mb(client, signed_in):
    with_team(signed_in)
    path = uploaded(signed_in, size=50 * MB + 1)

    response = confirm(client, path=path, file_name="Final Deck.pdf")

    assert response.status_code == 413
    assert signed_in.bucket.removed == [path]
    assert signed_in.writes_to("aspire_submissions") == []


def test_confirm_deletes_a_stored_file_of_the_wrong_type(client, signed_in):
    with_team(signed_in)
    path = uploaded(signed_in, content_type="text/html")

    response = confirm(client, path=path, file_name="Final Deck.pdf")

    assert response.status_code == 400
    assert signed_in.bucket.removed == [path]
    assert signed_in.writes_to("aspire_submissions") == []


def test_confirm_validates_the_demo_link(client, signed_in):
    with_team(signed_in)
    response = confirm(client, path=uploaded(signed_in), file_name="Final Deck.pdf", demo_link="ftp://x")
    assert response.status_code == 400
    assert signed_in.writes_to("aspire_submissions") == []


def test_confirm_saves_the_deck_and_replaces_the_previous_one(client, signed_in):
    with_team(signed_in, {"id": 3, "storage_path": "NYC-G07/1-old.pdf", "file_name": "old.pdf"})
    signed_in.bucket.store("NYC-G07/1-old.pdf", 10)
    path = uploaded(signed_in)
    signed_in.respond(
        "aspire_submissions",
        [{"file_name": "Final Deck.pdf", "demo_link": "https://demo.test", "updated_at": "2026-10-06"}],
    )

    response = confirm(client, path=path, file_name="Final Deck.pdf", demo_link=" https://demo.test ")

    assert response.status_code == 200
    assert response.json() == {
        "submission": {"file_name": "Final Deck.pdf", "demo_link": "https://demo.test", "submitted_at": "2026-10-06"}
    }
    [(_, action, payload)] = signed_in.writes_to("aspire_submissions")
    assert action == "upsert"
    assert payload == {
        "group_id": 7,
        "storage_path": path,
        "file_name": "Final Deck.pdf",
        "content_type": PDF,
        "file_size_bytes": 20 * MB,  # Storage's size, not the browser's
        "demo_link": "https://demo.test",
        "submitted_by": "user-1",
    }
    assert signed_in.bucket.removed == ["NYC-G07/1-old.pdf"]


def test_confirm_without_a_path_needs_a_deck_first(client, signed_in):
    with_team(signed_in)
    response = confirm(client, demo_link="https://demo.test")
    assert response.json() == {"detail": "Upload your final deck first"}


def test_confirm_without_a_path_updates_only_the_link(client, signed_in):
    with_team(signed_in, {"id": 3, "storage_path": "NYC-G07/1-old.pdf", "file_name": "old.pdf"})

    response = confirm(client, demo_link="https://demo.test")

    assert response.status_code == 200
    [(_, action, payload)] = signed_in.writes_to("aspire_submissions")
    assert action == "update"
    assert payload == {"demo_link": "https://demo.test", "submitted_by": "user-1"}
    assert signed_in.bucket.removed == []
