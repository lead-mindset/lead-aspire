"""Dallas challenge: shared team answers, phase timers and progress.

Mounted under /api/dallas/team by app/dallas_routes.py. Every route reads the
team from the caller's own aspire_dallas_students row, never from the request.

Answers are one flat JSON object per team per phase, one key per field or
option, so the database merge (aspire_dallas_save_answers, migration 010)
keeps two students' simultaneous edits to different keys:

  team      display_name, role_<role> = a teammate's user_id
  brief     q1, missing_<item> = true
  discover  (nothing saved)
  diagnose  class_<workload> = <class>, cause_<cause> = true
  advise    rec_<rec> = when it was added (orders the strategy)
  respond   slot_1 .. slot_9 = <rec> or ""
  deliver   situation, root_cause, ms_rec, statement,
            outcome_<outcome> = target, metric_<metric> = true

Option names are only checked for shape, so the case content (frontend
_dallas/content.ts) can change without touching this file. A null value
removes the key.
"""

import re
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from postgrest.exceptions import APIError

from .dallas_auth import dallas_student
from .dallas_schemas import (
    DallasAnswersPatch,
    DallasPhase,
    DallasPhaseResponse,
    DallasPhaseState,
    DallasTeamInfo,
    DallasTeamMember,
    DallasTeamStateResponse,
)
from .supabase import shared_admin_client

challenge_router = APIRouter(prefix="/team")

PHASES = ("team", "brief", "discover", "diagnose", "advise", "respond", "deliver")
SLUG = r"[a-z0-9][a-z0-9_-]{0,39}"
TEAM_NAME_MAX = 32
TEAM_NAME_LOCKED = "The team name is locked once the Team phase is complete"
# Continue rules, mirrored from the frontend (_dallas/logic.ts).
CAUSES_REQUIRED = 3


# --- Value checks: each returns the value to store, or raises ValueError --------


def _text(max_length: int) -> Callable[[Any, set[str]], Any]:
    def check(value, _members):
        if value is None or (isinstance(value, str) and len(value) <= max_length):
            return value
        raise ValueError(f"text up to {max_length} characters")

    return check


def _team_name(value, _members):
    if value is None:
        return None
    if isinstance(value, str) and len(value) <= TEAM_NAME_MAX * 2:
        cleaned = " ".join(value.split())
        if len(cleaned) <= TEAM_NAME_MAX:
            return cleaned or None
    raise ValueError(f"text up to {TEAM_NAME_MAX} characters")


def _flag(value, _members):
    if value is None or value is True:
        return value
    raise ValueError("true or null")


def _slug(value, _members):
    if value is None or (isinstance(value, str) and re.fullmatch(SLUG, value)):
        return value
    raise ValueError("an option key or null")


def _slot(value, _members):
    if value == "":
        return value
    return _slug(value, _members)


def _order(value, _members):
    if value is None or (type(value) is int and 0 <= value < 2**53):
        return value
    raise ValueError("a whole number or null")


def _member(value, members):
    if value is None or value == "" or value in members:
        return value or None
    raise ValueError("a member of your team or null")


# Allowed keys per phase: (key pattern, value check).
PHASE_KEYS: dict[str, list[tuple[str, Callable[[Any, set[str]], Any]]]] = {
    "team": [("display_name", _team_name), (rf"role_{SLUG}", _member)],
    "brief": [("q1", _text(2000)), (rf"missing_{SLUG}", _flag)],
    "discover": [],
    "diagnose": [(rf"class_{SLUG}", _slug), (rf"cause_{SLUG}", _flag)],
    "advise": [(rf"rec_{SLUG}", _order)],
    "respond": [(r"slot_[1-9]", _slot)],
    "deliver": [
        ("situation", _text(500)),
        ("root_cause", _text(2000)),
        ("ms_rec", _text(2000)),
        ("statement", _text(2000)),
        (rf"outcome_{SLUG}", _text(10)),
        (rf"metric_{SLUG}", _flag),
    ],
}


def validate_patch(phase: str, patch: dict[str, Any], member_ids: set[str]) -> dict[str, Any]:
    """The patch with cleaned values, or 422 naming the first bad key."""
    cleaned = {}
    for key, value in patch.items():
        rule = next((check for pattern, check in PHASE_KEYS[phase] if re.fullmatch(pattern, key)), None)
        if rule is None:
            raise HTTPException(status_code=422, detail=f"Unknown answer '{key}' for {phase}")
        try:
            cleaned[key] = rule(value, member_ids)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=f"'{key}' must be {error}") from None
    return cleaned


def _filled(answers: dict, key: str) -> bool:
    return isinstance(answers.get(key), str) and bool(answers[key].strip())


def _count(answers: dict, prefix: str) -> int:
    return sum(1 for key, value in answers.items() if key.startswith(prefix) and value)


# Why the team cannot continue yet, or None. Same rules as the Continue button.
COMPLETE_RULES: dict[str, Callable[[dict], str | None]] = {
    "team": lambda a: None
    if _filled(a, "display_name") and _count(a, "role_")
    else "Name your team and assign at least one role",
    "brief": lambda a: None if _filled(a, "q1") else "Answer question 1 to continue",
    "diagnose": lambda a: None
    if _count(a, "cause_") == CAUSES_REQUIRED
    else f"Pick exactly {CAUSES_REQUIRED} root causes",
    "advise": lambda a: None if _count(a, "rec_") else "Add at least one recommendation",
    "deliver": lambda a: None
    if all(_filled(a, key) for key in ("situation", "ms_rec", "statement"))
    else "Complete sections 1, 3 and 6",
}


# --- Data access -----------------------------------------------------------------


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _team_of(client, authorization: str | None) -> tuple[dict, int]:
    """(student, team_id) for the caller, or 401/403."""
    student = dallas_student(client, authorization)
    if student.get("team_id") is None:
        raise HTTPException(status_code=403, detail="Choose your team first")
    return student, student["team_id"]


def _members(client, team_id: int) -> list[dict]:
    return (
        client.table("aspire_dallas_students")
        .select("user_id, first_name, last_name")
        .eq("team_id", team_id)
        .order("first_name")
        .execute()
    ).data or []


def _full_name(person: dict | None) -> str | None:
    if not person:
        return None
    return f"{person.get('first_name') or ''} {person.get('last_name') or ''}".strip() or None


def _phase_out(row: dict | None, names: dict[str, str | None]) -> DallasPhaseState:
    if not row:
        return DallasPhaseState()
    return DallasPhaseState(
        answers=row.get("answers") or {},
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        updated_at=row.get("updated_at") if row.get("updated_by") else None,
        updated_by_name=names.get(row.get("updated_by") or ""),
    )


def _rpc_row(client, function: str, params: dict) -> dict:
    data = client.rpc(function, params).execute().data
    # A function returning one row comes back as an object (or a one-item list).
    return (data[0] if data else {}) if isinstance(data, list) else (data or {})


def _phase_row(client, team_id: int, phase: str) -> dict | None:
    rows = (
        client.table("aspire_dallas_team_phases")
        .select("*")
        .eq("team_id", team_id)
        .eq("phase", phase)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


# --- Routes ----------------------------------------------------------------------


@challenge_router.get("/state", response_model=DallasTeamStateResponse)
def get_team_state(authorization: str | None = Header(default=None)) -> DallasTeamStateResponse:
    """The caller's team: number, display name, members, and every phase's answers,
    timer start, completion and last editor."""
    client = shared_admin_client()
    _, team_id = _team_of(client, authorization)

    teams = (
        client.table("aspire_dallas_teams")
        .select("id, team_number, name")
        .eq("id", team_id)
        .limit(1)
        .execute()
    ).data or []
    if not teams:
        raise HTTPException(status_code=404, detail="Team not found")
    members = _members(client, team_id)
    rows = {
        row["phase"]: row
        for row in (client.table("aspire_dallas_team_phases").select("*").eq("team_id", team_id).execute()).data
        or []
    }

    names = {member["user_id"]: _full_name(member) for member in members}
    phases = {phase: _phase_out(rows.get(phase), names) for phase in PHASES}
    return DallasTeamStateResponse(
        team=DallasTeamInfo(
            id=teams[0]["id"],
            number=teams[0]["team_number"],
            name=teams[0]["name"],
            display_name=phases["team"].answers.get("display_name"),
        ),
        members=[DallasTeamMember(**member) for member in members],
        phases=phases,
        server_time=_now(),
    )


@challenge_router.post("/phases/{phase}/answers", response_model=DallasPhaseResponse)
def save_answers(
    phase: DallasPhase,
    payload: DallasAnswersPatch,
    authorization: str | None = Header(default=None),
) -> DallasPhaseResponse:
    """Merge the changed keys into the team's answers for one phase (last save wins per key).

    POST, not PATCH: the API's CORS setup (app/main.py) allows GET, POST and PUT only.
    """
    client = shared_admin_client()
    student, team_id = _team_of(client, authorization)
    members = _members(client, team_id)
    patch = validate_patch(phase, payload.patch, {member["user_id"] for member in members})

    if phase == "team" and "display_name" in patch:
        current = _phase_row(client, team_id, "team")
        if current and current.get("completed_at"):
            raise HTTPException(status_code=409, detail=TEAM_NAME_LOCKED)

    try:
        row = _rpc_row(
            client,
            "aspire_dallas_save_answers",
            {"p_team_id": team_id, "p_phase": phase, "p_patch": patch, "p_user_id": student["user_id"]},
        )
    except APIError as error:
        # 23514: the lock in the database function, if the Team phase was completed meanwhile.
        if error.code != "23514":
            raise
        raise HTTPException(status_code=409, detail=TEAM_NAME_LOCKED) from error

    names = {member["user_id"]: _full_name(member) for member in members}
    return DallasPhaseResponse(phase=_phase_out(row, names), server_time=_now())


@challenge_router.post("/phases/{phase}/open", response_model=DallasPhaseResponse)
def open_phase(phase: DallasPhase, authorization: str | None = Header(default=None)) -> DallasPhaseResponse:
    """Start the phase timer for the team, if no member has opened the phase before."""
    client = shared_admin_client()
    _, team_id = _team_of(client, authorization)
    row = _rpc_row(client, "aspire_dallas_open_phase", {"p_team_id": team_id, "p_phase": phase})
    names = {member["user_id"]: _full_name(member) for member in _members(client, team_id)}
    return DallasPhaseResponse(phase=_phase_out(row, names), server_time=_now())


@challenge_router.post("/phases/{phase}/complete", response_model=DallasPhaseResponse)
def complete_phase(phase: DallasPhase, authorization: str | None = Header(default=None)) -> DallasPhaseResponse:
    """Mark the phase complete for the team, if its minimum is done (409 otherwise).

    Completing twice keeps the first time. A later edit that falls below the
    minimum does not undo completion.
    """
    client = shared_admin_client()
    student, team_id = _team_of(client, authorization)
    current = _phase_row(client, team_id, phase) or {}
    rule = COMPLETE_RULES.get(phase)
    reason = rule(current.get("answers") or {}) if rule else None
    if reason:
        raise HTTPException(status_code=409, detail=reason)

    row = _rpc_row(
        client,
        "aspire_dallas_complete_phase",
        {"p_team_id": team_id, "p_phase": phase, "p_user_id": student["user_id"]},
    )
    names = {member["user_id"]: _full_name(member) for member in _members(client, team_id)}
    return DallasPhaseResponse(phase=_phase_out(row, names), server_time=_now())
