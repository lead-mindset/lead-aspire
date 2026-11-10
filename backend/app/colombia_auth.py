"""Who is calling a Colombia route: shared by app/colombia_routes.py and app/colombia_challenge.py."""

from fastapi import HTTPException

COLOMBIA_CITY = "COL"


def is_colombia_user(user) -> bool:
    """Marked by the Colombia login (app_metadata cannot be changed by the user)."""
    return (getattr(user, "app_metadata", None) or {}).get("aspire_city") == COLOMBIA_CITY


def colombia_student(client, authorization: str | None) -> dict:
    """The caller's aspire_colombia_students row, or 401 (no/invalid token) / 403 (not Colombia)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing session token")
    try:
        user = client.auth.get_user(authorization[7:].strip()).user
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid session token") from error
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid session token")
    if not is_colombia_user(user):
        raise HTTPException(status_code=403, detail="This account is not a Colombia account")

    rows = (
        client.table("aspire_colombia_students")
        .select("user_id, email, first_name, last_name, team_id")
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(status_code=403, detail="This account is not a Colombia account")
    return rows[0]
