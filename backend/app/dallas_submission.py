"""Dallas Pitch & Submit: the team's final deck and demo link.

Mounted under /api/dallas/team by app/dallas_routes.py. Same flow as New York
(app/routes.py): the backend signs one upload path, the browser uploads
straight to Storage, and /submission/confirm checks the stored object and
saves it. Decks share New York's private bucket under a DFW-team-<id>/
prefix; the rows live in aspire_dallas_submissions (migration 012).
"""

import logging
import re
import secrets
import time

from fastapi import APIRouter, Header, HTTPException

from .dallas_challenge import _team_of
from .routes import (
    SUBMISSION_BUCKET,
    SUBMISSION_MAX_BYTES,
    UNKNOWN_CONTENT_TYPES,
    _base_type,
    _deck_content_type,
    _deck_storage_name,
    _demo_link,
    _remove_quietly,
    _stored_object,
    _submission_out,
)
from .schemas import (
    DeckConfirmRequest,
    DeckUploadUrlRequest,
    DeckUploadUrlResponse,
    TeamSubmissionResponse,
)
from .supabase import shared_admin_client

submission_router = APIRouter(prefix="/team")
logger = logging.getLogger(__name__)

TABLE = "aspire_dallas_submissions"


def _prefix(team_id: int) -> str:
    """Storage folder of a Dallas team; never collides with New York's NYC-* folders."""
    return f"DFW-team-{team_id}"


def _current(client, team_id: int) -> dict | None:
    rows = (client.table(TABLE).select("*").eq("team_id", team_id).limit(1).execute()).data or []
    return rows[0] if rows else None


@submission_router.get("/submission", response_model=TeamSubmissionResponse)
def get_submission(authorization: str | None = Header(default=None)) -> TeamSubmissionResponse:
    """The caller's team's final deck and demo link, if submitted."""
    client = shared_admin_client()
    _, team_id = _team_of(client, authorization)
    return TeamSubmissionResponse(submission=_submission_out(_current(client, team_id)))


@submission_router.post("/submission/upload-url", response_model=DeckUploadUrlResponse)
def create_upload_url(
    payload: DeckUploadUrlRequest, authorization: str | None = Header(default=None)
) -> DeckUploadUrlResponse:
    """Permission to upload one deck straight to Storage; the file never reaches the API."""
    client = shared_admin_client()
    _, team_id = _team_of(client, authorization)
    # Fast fail only; /submission/confirm validates the link it saves.
    _demo_link(payload.demo_link)

    name = payload.file_name.strip()
    content_type = _deck_content_type(name)
    if _base_type(payload.content_type) not in UNKNOWN_CONTENT_TYPES | {content_type}:
        raise HTTPException(status_code=400, detail="The file type does not match its extension")
    if payload.size > SUBMISSION_MAX_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 50 MB")

    # Built here, never taken from the client; confirm drops the previous deck.
    path = f"{_prefix(team_id)}/{int(time.time())}-{secrets.token_hex(4)}-{_deck_storage_name(name)}"
    signed = client.storage.from_(SUBMISSION_BUCKET).create_signed_upload_url(path)
    return DeckUploadUrlResponse(bucket=SUBMISSION_BUCKET, path=path, token=signed["token"], content_type=content_type)


@submission_router.post("/submission/confirm", response_model=TeamSubmissionResponse)
def confirm_submission(
    payload: DeckConfirmRequest, authorization: str | None = Header(default=None)
) -> TeamSubmissionResponse:
    """Save the deck uploaded through /submission/upload-url, and/or the demo link."""
    client = shared_admin_client()
    student, team_id = _team_of(client, authorization)
    user_id = student["user_id"]
    link = _demo_link(payload.demo_link)
    current = _current(client, team_id)

    if not payload.path:
        if current is None:
            raise HTTPException(status_code=400, detail="Upload your final deck first")
        row = (
            client.table(TABLE).update({"demo_link": link, "submitted_by": user_id}).eq("id", current["id"]).execute()
        ).data
        return TeamSubmissionResponse(submission=_submission_out(row[0] if row else current))

    path = payload.path
    prefix = _prefix(team_id)
    if not path.startswith(f"{prefix}/"):
        raise HTTPException(status_code=403, detail="This upload does not belong to your team")
    name = (payload.file_name or "").strip()
    content_type = _deck_content_type(name)
    expected = rf"{re.escape(prefix)}/\d+-[0-9a-f]{{8}}-{re.escape(_deck_storage_name(name))}"
    if not re.fullmatch(expected, path):
        raise HTTPException(status_code=400, detail="The file name does not match the upload")

    bucket = client.storage.from_(SUBMISSION_BUCKET)
    stored = _stored_object(bucket, path)
    if stored is None:
        raise HTTPException(status_code=400, detail="The deck was not uploaded. Please try again.")
    size = int(stored.get("size") or 0)
    if size > SUBMISSION_MAX_BYTES:
        _remove_quietly(bucket, path)
        raise HTTPException(status_code=413, detail="The file is larger than 50 MB")
    if size == 0 or _base_type(stored.get("content_type")) != content_type:
        _remove_quietly(bucket, path)
        raise HTTPException(status_code=400, detail="Upload a PDF or PowerPoint file")

    row = (
        client.table(TABLE)
        .upsert(
            {
                "team_id": team_id,
                "storage_path": path,
                "file_name": name,
                "content_type": content_type,
                "file_size_bytes": size,
                "demo_link": link,
                "submitted_by": user_id,
            },
            on_conflict="team_id",
        )
        .execute()
    ).data

    if current and current["storage_path"] != path:
        try:
            bucket.remove([current["storage_path"]])
        except Exception:
            # The new deck is saved; an orphaned old file is harmless.
            logger.exception("Could not remove the previous Dallas deck %s", current["storage_path"])

    return TeamSubmissionResponse(submission=_submission_out(row[0] if row else None))
