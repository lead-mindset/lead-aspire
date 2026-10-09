"""Dallas login, team selection and dashboard data: /api/dallas/*.

Kept apart from the New York routes on purpose: own tables (aspire_dallas_*),
own token check. Dallas students are Supabase Auth users created here with
app_metadata.aspire_city = "DFW"; the New York routes reject that mark, and
these routes reject anyone without a row in aspire_dallas_students.

Accepted risk for a one-day event: anyone with the event code and a
student's email can sign in as that student.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError
from supabase_auth.errors import AuthApiError

from .dallas_auth import DALLAS_CITY, dallas_student, is_dallas_user
from .dallas_challenge import challenge_router
from .dallas_schemas import (
    DallasLoginRequest,
    DallasLoginResponse,
    DallasMember,
    DallasMeResponse,
    DallasProfileRequest,
    DallasTeam,
    DallasTeamsResponse,
)
from .supabase import create_admin_client, shared_admin_client

dallas_router = APIRouter(prefix="/api/dallas")
# The challenge (team answers, timers, progress) lives in its own module.
dallas_router.include_router(challenge_router)
logger = logging.getLogger(__name__)

# One message for a wrong code, an unknown email and a non-Dallas account, so
# the form does not reveal which emails exist.
LOGIN_FAILED = "Invalid email or event code"
LOGIN_BUSY = "Too many sign-ins right now. Wait a minute and try again."
# GoTrue error codes for "this email already has an account".
EMAIL_TAKEN_CODES = {"email_exists", "user_already_exists"}


def _auth_unavailable(error: Exception) -> HTTPException:
    """503 for a Supabase Auth failure that is not the student's fault (e.g. a rate limit)."""
    logger.warning("Dallas login: Supabase Auth failed: %s", error)
    return HTTPException(status_code=503, detail=LOGIN_BUSY)


# --- Login (Step 1) ----------------------------------------------------------


def _event_code_is_active(client, code: str) -> bool:
    rows = (
        client.table("aspire_dallas_event_codes")
        .select("id")
        .eq("code", code.strip().lower())
        .eq("is_active", True)
        .limit(1)
        .execute()
    ).data or []
    return bool(rows)


def _student_by_email(client, email: str) -> dict | None:
    rows = (
        client.table("aspire_dallas_students")
        .select("user_id, team_id")
        .eq("email", email)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def _create_dallas_user(client, email: str) -> None:
    """Create the Auth user (confirmed, no email sent). An existing account is fine:
    the caller checks whether it is a Dallas one."""
    try:
        client.auth.admin.create_user(
            {"email": email, "email_confirm": True, "app_metadata": {"aspire_city": DALLAS_CITY}}
        )
    except AuthApiError as error:
        if error.code not in EMAIL_TAKEN_CODES:
            raise _auth_unavailable(error) from error


@dallas_router.post("/auth/login", response_model=DallasLoginResponse)
def dallas_login(payload: DallasLoginRequest) -> DallasLoginResponse:
    """Email + event code -> a Supabase session, creating the account on first use.

    The session comes from an admin magic link verified here (generate_link,
    then verify_otp with its token_hash): no email is sent and the token hash
    never reaches the browser. Supabase counts verify_otp against its
    "token verifications" rate limit, per IP of this backend.
    """
    client = shared_admin_client()
    email = str(payload.email)
    if not _event_code_is_active(client, payload.event_code):
        raise HTTPException(status_code=401, detail=LOGIN_FAILED)

    student = _student_by_email(client, email)
    if student is None:
        _create_dallas_user(client, email)

    try:
        link = client.auth.admin.generate_link({"type": "magiclink", "email": email})
    except AuthApiError as error:
        raise _auth_unavailable(error) from error

    # Checked on every login, not only on creation: a New York (or any other)
    # account with this email never gets a session here.
    if not is_dallas_user(link.user):
        logger.warning("Dallas login refused for a non-Dallas account")
        raise HTTPException(status_code=401, detail=LOGIN_FAILED)

    user_id = str(link.user.id)
    if student is None or student["user_id"] != user_id:
        # First login, or an earlier one that created the Auth user but not this row.
        rows = (
            client.table("aspire_dallas_students")
            .upsert({"user_id": user_id, "email": email}, on_conflict="user_id")
            .execute()
        ).data or []
        student = rows[0] if rows else {"user_id": user_id, "team_id": None}

    # verify_otp stores the session on the client, so never on the shared one.
    session_client = create_admin_client()
    try:
        session = session_client.auth.verify_otp(
            {"token_hash": link.properties.hashed_token, "type": "magiclink"}
        ).session
    except AuthApiError as error:
        raise _auth_unavailable(error) from error
    if session is None:
        raise HTTPException(status_code=503, detail=LOGIN_BUSY)

    return DallasLoginResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at,
        needs_profile=student.get("team_id") is None,
    )


# --- Signed-in Dallas routes -------------------------------------------------


def _team_out(row: dict) -> DallasTeam:
    return DallasTeam(id=row["id"], number=row["team_number"], name=row["name"])


def _active_team(client, team_id: int) -> dict | None:
    rows = (
        client.table("aspire_dallas_teams")
        .select("id, team_number, name")
        .eq("id", team_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def _me(client, student: dict) -> DallasMeResponse:
    team = None
    members: list[DallasMember] = []
    if student.get("team_id") is not None:
        # Not filtered on is_active: a student keeps the team they chose.
        rows = (
            client.table("aspire_dallas_teams")
            .select("id, team_number, name")
            .eq("id", student["team_id"])
            .limit(1)
            .execute()
        ).data or []
        team = _team_out(rows[0]) if rows else None
        members = [
            DallasMember(first_name=row["first_name"], last_name=row["last_name"])
            for row in (
                client.table("aspire_dallas_students")
                .select("first_name, last_name")
                .eq("team_id", student["team_id"])
                .order("first_name")
                .execute()
            ).data
            or []
        ]
    return DallasMeResponse(
        email=student["email"],
        first_name=student.get("first_name"),
        last_name=student.get("last_name"),
        team=team,
        members=members,
    )


@dallas_router.get("/me", response_model=DallasMeResponse)
def dallas_me(authorization: str | None = Header(default=None)) -> DallasMeResponse:
    """The signed-in student, their team and its members (team is null before Step 2)."""
    client = shared_admin_client()
    return _me(client, dallas_student(client, authorization))


@dallas_router.get("/teams", response_model=DallasTeamsResponse)
def dallas_teams(authorization: str | None = Header(default=None)) -> DallasTeamsResponse:
    """Teams a student can pick in Step 2."""
    client = shared_admin_client()
    dallas_student(client, authorization)
    rows = (
        client.table("aspire_dallas_teams")
        .select("id, team_number, name")
        .eq("is_active", True)
        .order("team_number")
        .execute()
    ).data or []
    return DallasTeamsResponse(teams=[_team_out(row) for row in rows])


TEAM_LOCKED = "Your team is already saved and cannot be changed"


@dallas_router.post("/profile", response_model=DallasMeResponse)
def save_dallas_profile(
    payload: DallasProfileRequest, authorization: str | None = Header(default=None)
) -> DallasMeResponse:
    """Step 2, once: the student's name and team. Any later call is 409.

    The database enforces the same rule with a trigger, so the team cannot be
    changed even by a request that slips past this check.
    """
    client = shared_admin_client()
    student = dallas_student(client, authorization)
    if student.get("team_id") is not None:
        raise HTTPException(status_code=409, detail=TEAM_LOCKED)
    if _active_team(client, payload.team_id) is None:
        raise HTTPException(status_code=400, detail="Choose a team from the list")

    try:
        rows = (
            client.table("aspire_dallas_students")
            .update(
                {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "team_id": payload.team_id,
                    "profile_completed_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("user_id", student["user_id"])
            # Only while no team is saved: two tabs submitting at once can't both win.
            .is_("team_id", "null")
            .execute()
        ).data or []
    except APIError as error:
        # 23514: the team-lock trigger (check_violation). Anything else is a real error.
        if error.code != "23514":
            raise
        raise HTTPException(status_code=409, detail=TEAM_LOCKED) from error
    if not rows:
        raise HTTPException(status_code=409, detail=TEAM_LOCKED)
    return _me(client, rows[0])
