"""Colombia organizers: every team's final deck and demo link.

Mounted under /api/colombia/admin by app/colombia_routes.py. The Colombia version
of New York's "View Teams Results" (app/routes.py, /api/admin/teams): same
rule for who is an organizer (aspire_profiles.is_admin on an active
profile), but the caller signs in with a Colombia account and the data comes
from the Colombia tables (aspire_colombia_teams, aspire_colombia_submissions).
"""

from fastapi import APIRouter, Header, HTTPException

from .colombia_auth import colombia_student
from .colombia_schemas import ColombiaAdminTeam, ColombiaAdminTeamsResponse
from .routes import SUBMISSION_BUCKET, _is_admin
from .schemas import AdminDeckResponse
from .supabase import shared_admin_client

colombia_admin_router = APIRouter(prefix="/admin")

# Signed deck links last as long as New York's.
LINK_SECONDS = 600


def _require_admin(client, authorization: str | None) -> None:
    """401/403 unless the caller is a Colombia account marked as an organizer."""
    student = colombia_student(client, authorization)
    if not _is_admin(client, student["user_id"]):
        raise HTTPException(status_code=403, detail="Admins only")


@colombia_admin_router.get("/teams", response_model=ColombiaAdminTeamsResponse)
def get_teams(authorization: str | None = Header(default=None)) -> ColombiaAdminTeamsResponse:
    """Every active Colombia team with its member count and submission."""
    client = shared_admin_client()
    _require_admin(client, authorization)

    teams = (
        client.table("aspire_colombia_teams")
        .select("id, team_number, name")
        .eq("is_active", True)
        .order("team_number")
        .execute()
    ).data or []
    students = (
        client.table("aspire_colombia_students").select("team_id").not_.is_("team_id", "null").execute()
    ).data or []
    names = {
        row["team_id"]: (row.get("answers") or {}).get("display_name")
        for row in (
            client.table("aspire_colombia_team_phases").select("team_id, answers").eq("phase", "team").execute()
        ).data
        or []
    }
    submissions = {
        row["team_id"]: row
        for row in (
            client.table("aspire_colombia_submissions")
            .select("team_id, file_name, demo_link, updated_at")
            .execute()
        ).data
        or []
    }

    members: dict[int, int] = {}
    for row in students:
        members[row["team_id"]] = members.get(row["team_id"], 0) + 1

    return ColombiaAdminTeamsResponse(
        teams=[
            ColombiaAdminTeam(
                id=team["id"],
                number=team["team_number"],
                name=team["name"],
                display_name=(names.get(team["id"]) or "").strip() or None,
                members=members.get(team["id"], 0),
                deck_file=(submissions.get(team["id"]) or {}).get("file_name"),
                demo_link=(submissions.get(team["id"]) or {}).get("demo_link"),
                submitted_at=(submissions.get(team["id"]) or {}).get("updated_at"),
            )
            for team in teams
        ]
    )


@colombia_admin_router.get("/teams/{team_id}/deck", response_model=AdminDeckResponse)
def get_team_deck(team_id: int, authorization: str | None = Header(default=None)) -> AdminDeckResponse:
    """Short-lived links to one Colombia team's deck, for the organizer viewer."""
    client = shared_admin_client()
    _require_admin(client, authorization)

    rows = (
        client.table("aspire_colombia_submissions").select("*").eq("team_id", team_id).limit(1).execute()
    ).data or []
    if not rows:
        raise HTTPException(status_code=404, detail="This team has not submitted a deck")

    submission = rows[0]
    bucket = client.storage.from_(SUBMISSION_BUCKET)
    path = submission["storage_path"]
    return AdminDeckResponse(
        file_name=submission["file_name"],
        content_type=submission["content_type"],
        demo_link=submission.get("demo_link"),
        view_url=bucket.create_signed_url(path, LINK_SECONDS)["signedURL"],
        download_url=bucket.create_signed_url(path, LINK_SECONDS, {"download": submission["file_name"]})["signedURL"],
    )
