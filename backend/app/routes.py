import logging
import re
import secrets
import time

from fastapi import APIRouter, Header, HTTPException, Query, Request
from postgrest.exceptions import APIError
from starlette.concurrency import run_in_threadpool
from storage3.exceptions import StorageApiError

from .config import settings
from .schemas import (
    AdminDeckResponse,
    AdminTeam,
    AdminTeamsResponse,
    CoachChatRequest,
    CoachChatResponse,
    DeckConfirmRequest,
    DeckUploadUrlRequest,
    DeckUploadUrlResponse,
    LoginRequest,
    LoginResponse,
    TeamMember,
    TeamMembersResponse,
    TeamProgressResponse,
    TeamProgressUpdate,
    TeamSubmission,
    TeamSubmissionResponse,
)
from .supabase import create_admin_client, shared_admin_client

router = APIRouter(prefix="/api/auth")
coach_router = APIRouter(prefix="/api/coach")
team_router = APIRouter(prefix="/api/team")
admin_router = APIRouter(prefix="/api/admin")
logger = logging.getLogger(__name__)

CITY_GROUP_PREFIXES = {
    "NYC": "NYC-",
    "DFW": "DFW-",
}


def _user_from_token(client, authorization: str | None):
    """Supabase user for a `Bearer <access token>` header, or 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing session token")
    try:
        user = client.auth.get_user(authorization[7:].strip()).user
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid session token") from error
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid session token")
    return user


def _viewer_group(client, user_id: str, city_code: str) -> dict | None:
    """The user's team in a city: their oldest access with an assigned group."""
    city = (
        client.table("aspire_cities")
        .select("id")
        .eq("code", city_code)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    city_data = (city.data if city else None) or {}
    if not city_data:
        raise HTTPException(status_code=404, detail="City not found")

    # Same rule as the New York session: the oldest assigned group is the team.
    access = (
        client.table("aspire_user_access")
        .select("group_id, aspire_groups(group_code, group_name)")
        .eq("user_id", user_id)
        .eq("city_id", city_data["id"])
        .not_.is_("group_id", "null")
        .order("created_at")
        .limit(1)
        .execute()
    ).data or []
    return access[0] if access else None


def _is_admin(client, user_id: str) -> bool:
    profile = (
        client.table("aspire_profiles")
        .select("is_admin, status")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    data = (profile.data if profile else None) or {}
    return bool(data.get("is_admin")) and data.get("status") == "active"


@admin_router.get("/teams", response_model=AdminTeamsResponse)
def get_admin_teams(authorization: str | None = Header(default=None)) -> AdminTeamsResponse:
    """Every active team with its member count, for the organizer results table."""
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    if not _is_admin(client, str(user.id)):
        raise HTTPException(status_code=403, detail="Admins only")

    groups = (
        client.table("aspire_groups")
        .select("id, group_code, group_name")
        .eq("is_active", True)
        .order("group_code")
        .execute()
    ).data or []
    access = (
        client.table("aspire_user_access")
        .select("group_id, user_id, aspire_profiles(status)")
        .not_.is_("group_id", "null")
        .execute()
    ).data or []

    members: dict[int, set[str]] = {}
    for row in access:
        if (row.get("aspire_profiles") or {}).get("status") == "active":
            members.setdefault(row["group_id"], set()).add(row["user_id"])

    submissions = {
        row["group_id"]: row
        for row in (
            client.table("aspire_submissions")
            .select("group_id, file_name, demo_link, updated_at")
            .execute()
        ).data
        or []
    }

    city_by_prefix = {prefix: code for code, prefix in CITY_GROUP_PREFIXES.items()}
    teams = []
    for group in groups:
        city_code = next(
            (code for prefix, code in city_by_prefix.items() if group["group_code"].startswith(prefix)),
            None,
        )
        teams.append(
            AdminTeam(
                group_code=group["group_code"],
                group_name=group["group_name"],
                city_code=city_code,
                members=len(members.get(group["id"], ())),
                deck_file=(submissions.get(group["id"]) or {}).get("file_name"),
                demo_link=(submissions.get(group["id"]) or {}).get("demo_link"),
                submitted_at=(submissions.get(group["id"]) or {}).get("updated_at"),
            )
        )
    return AdminTeamsResponse(teams=teams)


SUBMISSION_BUCKET = "aspire-team-submissions"
SUBMISSION_MAX_BYTES = 50 * 1024 * 1024
SUBMISSION_TYPES = {
    "pdf": "application/pdf",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def _submission_out(row: dict | None) -> TeamSubmission | None:
    if not row:
        return None
    return TeamSubmission(
        file_name=row["file_name"],
        demo_link=row.get("demo_link"),
        submitted_at=row.get("updated_at") or row.get("created_at"),
    )


def _current_submission(client, group_id: int) -> dict | None:
    rows = (
        client.table("aspire_submissions")
        .select("*")
        .eq("group_id", group_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def _submission_team(client, authorization: str | None, city_code: str) -> tuple:
    """(user, access, group_code) for the caller's team, or 401/403/404."""
    user = _user_from_token(client, authorization)
    access = _viewer_group(client, str(user.id), city_code)
    if access is None:
        raise HTTPException(status_code=403, detail="You are not assigned to a team")
    group_code = (access.get("aspire_groups") or {}).get("group_code") or str(access["group_id"])
    return user, access, group_code


def _demo_link(demo_link: str | None) -> str | None:
    link = (demo_link or "").strip() or None
    if link and not re.match(r"^https?://\S+$", link, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="The demo link must start with http:// or https://")
    return link


def _deck_content_type(file_name: str) -> str:
    """MIME type for the deck's extension (never the client's), or 400."""
    extension = file_name.rpartition(".")[2].lower() if "." in file_name else ""
    content_type = SUBMISSION_TYPES.get(extension)
    if content_type is None:
        raise HTTPException(status_code=400, detail="Upload a PDF or PowerPoint file")
    return content_type


def _deck_storage_name(file_name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", file_name)[-120:]


def _save_link(client, user_id: str, current: dict | None, link: str | None) -> TeamSubmissionResponse:
    """Update only the demo link of the team's existing deck."""
    if current is None:
        raise HTTPException(status_code=400, detail="Upload your final deck first")
    row = (
        client.table("aspire_submissions")
        .update({"demo_link": link, "submitted_by": user_id})
        .eq("id", current["id"])
        .execute()
    ).data
    return TeamSubmissionResponse(submission=_submission_out(row[0] if row else current))


def _save_deck(
    client,
    bucket,
    user_id: str,
    group_id: int,
    current: dict | None,
    path: str,
    file_name: str,
    content_type: str,
    size: int,
    link: str | None,
) -> TeamSubmissionResponse:
    """Point the team's submission at the stored deck, then drop the previous file."""
    row = (
        client.table("aspire_submissions")
        .upsert(
            {
                "group_id": group_id,
                "storage_path": path,
                "file_name": file_name,
                "content_type": content_type,
                "file_size_bytes": size,
                "demo_link": link,
                "submitted_by": user_id,
            },
            on_conflict="group_id",
        )
        .execute()
    ).data

    if current and current["storage_path"] != path:
        try:
            bucket.remove([current["storage_path"]])
        except Exception:
            # The new deck is saved; an orphaned old file is harmless.
            logger.exception("Could not remove the previous deck %s", current["storage_path"])

    return TeamSubmissionResponse(submission=_submission_out(row[0] if row else None))


@team_router.get("/submission", response_model=TeamSubmissionResponse)
def get_team_submission(
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> TeamSubmissionResponse:
    """The caller's team's final deck and demo link, if submitted."""
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    access = _viewer_group(client, str(user.id), city_code)
    if access is None:
        return TeamSubmissionResponse(submission=None)
    return TeamSubmissionResponse(
        submission=_submission_out(_current_submission(client, access["group_id"]))
    )


@team_router.post("/submission", response_model=TeamSubmissionResponse)
async def upload_team_submission(
    request: Request,
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    file_name: str | None = Query(default=None, max_length=255),
    demo_link: str | None = Query(default=None, max_length=2000),
    authorization: str | None = Header(default=None),
) -> TeamSubmissionResponse:
    """Upload/replace the team's deck (raw request body) and/or its demo link.

    An empty body keeps the current deck and only updates the demo link.

    DEPRECATED: the frontend now uploads straight to Storage through
    /submission/upload-url and /submission/confirm. Kept until that flow is
    verified in production; remove it then.
    """
    # Async only to read the raw body; the sync Supabase calls run in the
    # threadpool (each helper takes its worker thread's client) so they don't
    # block the event loop.
    user, access, group_code, current = await run_in_threadpool(
        _submission_context, authorization, city_code
    )
    link = _demo_link(demo_link)
    data = await request.body()
    return await run_in_threadpool(
        _store_submission, user, access, group_code, current, data, file_name, link
    )


def _submission_context(authorization: str | None, city_code: str) -> tuple:
    client = shared_admin_client()
    user, access, group_code = _submission_team(client, authorization, city_code)
    return user, access, group_code, _current_submission(client, access["group_id"])


def _store_submission(
    user, access, group_code: str, current: dict | None, data: bytes, file_name: str | None, link: str | None
) -> TeamSubmissionResponse:
    client = shared_admin_client()
    if not data:
        return _save_link(client, str(user.id), current, link)

    name = (file_name or "").strip()
    content_type = _deck_content_type(name)
    if len(data) > SUBMISSION_MAX_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 50 MB")

    path = f"{group_code}/{int(time.time())}-{_deck_storage_name(name)}"
    bucket = client.storage.from_(SUBMISSION_BUCKET)
    bucket.upload(path, data, {"content-type": content_type})

    group_id = access["group_id"]
    return _save_deck(client, bucket, str(user.id), group_id, current, path, name, content_type, len(data), link)


# Browsers report "" or a generic type when they can't tell; the extension decides then.
UNKNOWN_CONTENT_TYPES = {"", "application/octet-stream"}


def _base_type(content_type: str | None) -> str:
    return (content_type or "").split(";")[0].strip().lower()


@team_router.post("/submission/upload-url", response_model=DeckUploadUrlResponse)
def create_submission_upload_url(
    payload: DeckUploadUrlRequest,
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> DeckUploadUrlResponse:
    """Permission to upload one deck straight to Storage; the file never reaches the API.

    The browser's size and type can be faked: the bucket limits enforce them
    on upload, and /submission/confirm checks the stored object again.
    """
    client = shared_admin_client()
    _, _, group_code = _submission_team(client, authorization, city_code)
    # Fast fail only; /submission/confirm validates the link it saves.
    _demo_link(payload.demo_link)

    name = payload.file_name.strip()
    content_type = _deck_content_type(name)
    if _base_type(payload.content_type) not in UNKNOWN_CONTENT_TYPES | {content_type}:
        raise HTTPException(status_code=400, detail="The file type does not match its extension")
    if payload.size > SUBMISSION_MAX_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 50 MB")

    # Built here, never taken from the client. Every submission gets a new
    # path, so nothing is overwritten; confirm drops the previous deck.
    path = f"{group_code}/{int(time.time())}-{secrets.token_hex(4)}-{_deck_storage_name(name)}"
    signed = client.storage.from_(SUBMISSION_BUCKET).create_signed_upload_url(path)
    return DeckUploadUrlResponse(
        bucket=SUBMISSION_BUCKET,
        path=path,
        token=signed["token"],
        content_type=content_type,
    )


def _stored_object(bucket, path: str) -> dict | None:
    """Storage's own record of the object (real size and type), or None if missing."""
    try:
        return bucket.info(path)
    except StorageApiError as error:
        if str(error.status) in ("400", "404"):
            return None
        raise


def _remove_quietly(bucket, path: str) -> None:
    try:
        bucket.remove([path])
    except Exception:
        logger.exception("Could not remove the rejected upload %s", path)


@team_router.post("/submission/confirm", response_model=TeamSubmissionResponse)
def confirm_submission(
    payload: DeckConfirmRequest,
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> TeamSubmissionResponse:
    """Save the deck uploaded through /submission/upload-url, and/or the demo link.

    Without a path only the demo link changes. An upload that is never
    confirmed stays in the bucket as an orphan; there is no cleanup job yet.
    """
    client = shared_admin_client()
    user, access, group_code = _submission_team(client, authorization, city_code)
    link = _demo_link(payload.demo_link)

    group_id = access["group_id"]
    current = _current_submission(client, group_id)
    if not payload.path:
        return _save_link(client, str(user.id), current, link)

    path = payload.path
    if not path.startswith(f"{group_code}/"):
        raise HTTPException(status_code=403, detail="This upload does not belong to your team")
    name = (payload.file_name or "").strip()
    content_type = _deck_content_type(name)
    expected = rf"{re.escape(group_code)}/\d+-[0-9a-f]{{8}}-{re.escape(_deck_storage_name(name))}"
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
    # The stored type is what the browser declared on upload, not sniffed content.
    if size == 0 or _base_type(stored.get("content_type")) != content_type:
        _remove_quietly(bucket, path)
        raise HTTPException(status_code=400, detail="Upload a PDF or PowerPoint file")

    return _save_deck(client, bucket, str(user.id), group_id, current, path, name, content_type, size, link)


@admin_router.get("/teams/{group_code}/deck", response_model=AdminDeckResponse)
def get_admin_team_deck(
    group_code: str, authorization: str | None = Header(default=None)
) -> AdminDeckResponse:
    """Short-lived links to one team's deck, for the admin viewer."""
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    if not _is_admin(client, str(user.id)):
        raise HTTPException(status_code=403, detail="Admins only")

    group = (
        client.table("aspire_groups")
        .select("id")
        .eq("group_code", group_code)
        .maybe_single()
        .execute()
    )
    group_data = (group.data if group else None) or {}
    submission = _current_submission(client, group_data["id"]) if group_data else None
    if submission is None:
        raise HTTPException(status_code=404, detail="This team has not submitted a deck")

    bucket = client.storage.from_(SUBMISSION_BUCKET)
    path = submission["storage_path"]
    return AdminDeckResponse(
        file_name=submission["file_name"],
        content_type=submission["content_type"],
        demo_link=submission.get("demo_link"),
        view_url=bucket.create_signed_url(path, 600)["signedURL"],
        download_url=bucket.create_signed_url(path, 600, {"download": submission["file_name"]})["signedURL"],
    )


def _team_progress(client, group_id: int) -> TeamProgressResponse:
    rows = (
        client.table("aspire_team_progress")
        .select("phase_key")
        .eq("group_id", group_id)
        .execute()
    ).data or []
    return TeamProgressResponse(completed=[row["phase_key"] for row in rows])


@team_router.get("/progress", response_model=TeamProgressResponse)
def get_team_progress(
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> TeamProgressResponse:
    """Phases the caller's team has marked complete."""
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    access = _viewer_group(client, str(user.id), city_code)
    if access is None:
        return TeamProgressResponse(completed=[])
    return _team_progress(client, access["group_id"])


@team_router.put("/progress", response_model=TeamProgressResponse)
def update_team_progress(
    payload: TeamProgressUpdate,
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> TeamProgressResponse:
    """Mark one phase complete or not for the caller's team; returns the full list.

    One phase per call, so teammates toggling different phases don't overwrite
    each other.
    """
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    access = _viewer_group(client, str(user.id), city_code)
    if access is None:
        raise HTTPException(status_code=403, detail="You are not assigned to a team")

    table = client.table("aspire_team_progress")
    if payload.completed:
        table.upsert(
            {
                "group_id": access["group_id"],
                "phase_key": payload.phase,
                "completed_by": str(user.id),
            },
            on_conflict="group_id,phase_key",
        ).execute()
    else:
        table.delete().eq("group_id", access["group_id"]).eq(
            "phase_key", payload.phase
        ).execute()
    return _team_progress(client, access["group_id"])


@team_router.get("/members", response_model=TeamMembersResponse)
def get_team_members(
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> TeamMembersResponse:
    """Members of the caller's own group in a city (from the Supabase session token)."""
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    access = _viewer_group(client, str(user.id), city_code)
    if access is None:
        return TeamMembersResponse(group_code=None, group_name=None, members=[])

    group = access.get("aspire_groups") or {}
    rows = (
        client.table("aspire_user_access")
        .select("aspire_profiles(display_name, status)")
        .eq("group_id", access["group_id"])
        .execute()
    ).data or []

    names = sorted(
        {
            _member_name(profile.get("display_name"))
            for row in rows
            if (profile := row.get("aspire_profiles") or {}).get("status") == "active"
        }
        - {""},
        key=str.lower,
    )
    group_code = group.get("group_code")
    return TeamMembersResponse(
        group_code=group_code,
        group_name=group.get("group_name"),
        logo_url=_group_logo_url(client, group_code) if group_code else None,
        members=[TeamMember(name=name) for name in names],
    )


LOGO_BUCKET = "aspire-group-logos"
LOGO_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "svg"}


def _is_group_logo(file_name: str, group_code: str) -> bool:
    """`NYC-G01.png` or `NYC-G01-anything.png`, but never `NYC-G010-….png`."""
    stem, _, extension = file_name.rpartition(".")
    stem, code = stem.lower(), group_code.lower()
    if extension.lower() not in LOGO_EXTENSIONS:
        return False
    return stem == code or (stem.startswith(code) and stem[len(code)] in "-_ ")


def _group_logo_url(client, group_code: str) -> str | None:
    """Signed URL for the group's logo, uploaded by hand to the bucket root."""
    try:
        bucket = client.storage.from_(LOGO_BUCKET)
        matches = [
            item
            for item in bucket.list("", {"search": group_code})
            if _is_group_logo(item["name"], group_code)
        ]
        if matches:
            # Several uploads for one group: the newest wins.
            newest = max(matches, key=lambda item: item.get("updated_at") or item.get("created_at") or "")
            return bucket.create_signed_url(newest["name"], 3600)["signedURL"]
    except Exception:
        # A missing logo or a Storage error must not break the team card.
        logger.exception("Could not load the logo for group %s", group_code)
    return None


def _member_name(display_name: str | None) -> str:
    # Profiles created without a name default to the email; show only its local part.
    name = (display_name or "").strip()
    return name.split("@")[0] if "@" in name else name


def _conversation_owned_by_other(client, conversation_id: str, user_id: str) -> bool:
    rows = (
        client.table("aspire_coach_messages")
        .select("id")
        .eq("conversation_id", conversation_id)
        .neq("user_id", user_id)
        .limit(1)
        .execute()
    ).data or []
    return bool(rows)


def _record_coach_message(
    client,
    user_id: str,
    group_id: int | None,
    conversation_id: str,
    question: str,
    answer: str,
) -> None:
    try:
        client.table("aspire_coach_messages").insert(
            {
                "user_id": user_id,
                "group_id": group_id,
                "conversation_id": conversation_id,
                "question": question,
                "answer": answer,
            }
        ).execute()
    except APIError:
        # Saving the history must not hide an answer the student already got.
        logger.exception("Coach message could not be recorded")


def ask_agent(question: str, conversation_id: str | None = None) -> tuple[str, str]:
    """app.foundry.ask_agent, imported on first use to keep the Azure SDK out of cold starts."""
    from .foundry import ask_agent as foundry_ask_agent

    return foundry_ask_agent(question, conversation_id)


@coach_router.post("/chat", response_model=CoachChatResponse)
def coach_chat(
    payload: CoachChatRequest,
    city_code: str = Query(default="NYC", min_length=1, max_length=10),
    authorization: str | None = Header(default=None),
) -> CoachChatResponse:
    # Sync route: FastAPI runs it in a threadpool, so the blocking SDK call
    # does not stall the event loop.
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    user_id = str(user.id)
    if payload.conversation_id and _conversation_owned_by_other(
        client, payload.conversation_id, user_id
    ):
        raise HTTPException(status_code=403, detail="This conversation belongs to another user")
    access = _viewer_group(client, user_id, city_code)
    if not settings.coach_configured:
        raise HTTPException(status_code=503, detail="The coach is not configured")

    # Imported here, not at module load: openai and the Azure SDK add ~1 s to
    # every cold start, and only this route needs them.
    import openai
    from azure.core.exceptions import ClientAuthenticationError

    try:
        answer, conversation_id = ask_agent(payload.question, payload.conversation_id)
    except (ClientAuthenticationError, openai.AuthenticationError) as error:
        logger.exception("Foundry coach authentication failed")
        raise HTTPException(
            status_code=401,
            detail="Azure authentication for the Foundry coach failed",
        ) from error
    except openai.PermissionDeniedError as error:
        logger.exception("Foundry coach access denied")
        raise HTTPException(
            status_code=403,
            detail="Access to the Foundry coach was denied",
        ) from error
    except openai.NotFoundError as error:
        logger.exception("Foundry coach agent or conversation not found")
        raise HTTPException(
            status_code=404,
            detail="The Foundry coach or conversation was not found",
        ) from error
    except openai.BadRequestError as error:
        logger.exception("Foundry coach rejected the request")
        raise HTTPException(
            status_code=400,
            detail="The Foundry coach rejected the request (check conversation_id)",
        ) from error
    except Exception as error:
        logger.exception("Foundry coach request failed")
        raise HTTPException(
            status_code=502,
            detail="The Foundry coach could not answer right now",
        ) from error

    if not answer:
        raise HTTPException(
            status_code=502,
            detail="The Foundry coach returned an empty answer",
        )

    _record_coach_message(
        client,
        user_id,
        access["group_id"] if access else None,
        conversation_id,
        payload.question,
        answer,
    )
    return CoachChatResponse(answer=answer, conversation_id=conversation_id)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    # Two clients on purpose. The sign-in stores this user's session on
    # `session_client` (supabase-py then sends their token on its database
    # calls), so it is created for this request only and never shared.
    # Lookups and login events use the shared service-role client, keyed only
    # by values from the sign-in result.
    session_client = create_admin_client()
    client = shared_admin_client()

    try:
        auth_result = session_client.auth.sign_in_with_password(
            {"email": str(payload.email), "password": payload.password}
        )
    except Exception as error:
        print(f"Login authentication failed: {error}")
        _record_login_event(client, str(payload.email), False, "invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password") from error

    user = auth_result.user
    if user is None:
        _record_login_event(client, str(payload.email), False, "invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user.id)
    try:
        landing, access = _resolve_access(client, user_id)
    except _AccessDenied as denied:
        _sign_out_and_record(session_client, client, user_id, str(payload.email), None, None, denied.reason)
        raise HTTPException(status_code=403, detail=ACCESS_DENIED_DETAILS[denied.reason]) from None

    # The email Supabase verified, not the one typed in the request.
    verified_email = user.email or str(payload.email)
    if access is None:
        # Admin without a city/group assignment.
        _record_login_event(client, verified_email, True, None, user_id)
    else:
        _record_login_event(
            client,
            verified_email,
            True,
            None,
            user_id,
            access["city_id"],
            access["group_id"],
        )
    return landing


@router.get("/me", response_model=LoginResponse)
def me(authorization: str | None = Header(default=None)) -> LoginResponse:
    """Where a signed-in user lands: same rules as /login, from the session token.

    Read-only: no sign-out and no login event. 403 details carry a `code`
    (`inactive_account` or `access_denied`) so the frontend can translate them.
    """
    client = shared_admin_client()
    user = _user_from_token(client, authorization)
    try:
        landing, _ = _resolve_access(client, str(user.id))
    except _AccessDenied as denied:
        raise HTTPException(
            status_code=403,
            detail={"code": denied.reason, "message": ACCESS_DENIED_DETAILS[denied.reason]},
        ) from None
    return landing


ACCESS_DENIED_DETAILS = {
    "inactive_account": "Your account is not active",
    "access_denied": "You do not have access to any active city or group",
}


class _AccessDenied(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _resolve_access(client, user_id: str) -> tuple[LoginResponse, dict | None]:
    """The user's city and group, plus the access row used (None for an admin
    without one). Raises _AccessDenied for an inactive account or no access."""
    profile = (
        client.table("aspire_profiles")
        .select("status, is_admin")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    profile_data = (profile.data if profile else None) or {}
    if profile_data.get("status") != "active":
        raise _AccessDenied("inactive_account")

    # City and group come from the user's access, not from the login form.
    access_rows = (
        client.table("aspire_user_access")
        .select(
            "access_role, city_id, group_id, "
            "aspire_cities(code, is_active), aspire_groups(group_code, is_active)"
        )
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    ).data or []
    usable = [
        row
        for row in access_rows
        if (row.get("aspire_cities") or {}).get("is_active")
        and (row["group_id"] is None or (row.get("aspire_groups") or {}).get("is_active"))
    ]
    # Prefer an access with an assigned group, then the oldest one.
    usable.sort(key=lambda row: row["group_id"] is None)
    access = usable[0] if usable else None

    if access is None and profile_data.get("is_admin"):
        # Admins don't need a city/group assignment; they land in New York.
        return LoginResponse(access_role="admin", city_code="NYC", group_code=None), None

    if access is None:
        raise _AccessDenied("access_denied")

    landing = LoginResponse(
        access_role=access["access_role"],
        city_code=access["aspire_cities"]["code"],
        group_code=(access.get("aspire_groups") or {}).get("group_code"),
    )
    return landing, access


def _record_login_event(
    client,
    email: str,
    succeeded: bool,
    failure_reason: str | None,
    user_id: str | None = None,
    city_id: int | None = None,
    group_id: int | None = None,
) -> None:
    try:
        client.table("aspire_login_events").insert(
            {
                "user_id": user_id,
                "email": email,
                "city_id": city_id,
                "group_id": group_id,
                "succeeded": succeeded,
                "failure_reason": failure_reason,
            }
        ).execute()
    except APIError as error:
        # Audit logging must not turn a valid login into a server error.
        # A service-role key should bypass RLS; this message identifies a
        # misconfigured key or an unexpected Supabase project.
        print(f"Login event could not be recorded: {error}")


def _sign_out_and_record(
    session_client,
    client,
    user_id: str,
    email: str,
    city_id: int | None,
    group_id: int | None,
    failure_reason: str,
) -> None:
    """Sign out on the per-request client that holds the session; record on the shared one."""
    session_client.auth.sign_out()
    _record_login_event(
        client,
        email,
        False,
        failure_reason,
        user_id,
        city_id,
        group_id,
    )
