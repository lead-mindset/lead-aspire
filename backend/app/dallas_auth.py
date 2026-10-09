"""Who is calling a Dallas route: shared by app/dallas_routes.py and app/dallas_challenge.py."""

from fastapi import HTTPException

DALLAS_CITY = "DFW"


def is_dallas_user(user) -> bool:
    """Marked by the Dallas login (app_metadata cannot be changed by the user)."""
    return (getattr(user, "app_metadata", None) or {}).get("aspire_city") == DALLAS_CITY


def dallas_student(client, authorization: str | None) -> dict:
    """The caller's aspire_dallas_students row, or 401 (no/invalid token) / 403 (not Dallas)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing session token")
    try:
        user = client.auth.get_user(authorization[7:].strip()).user
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid session token") from error
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid session token")
    if not is_dallas_user(user):
        raise HTTPException(status_code=403, detail="This account is not a Dallas account")

    rows = (
        client.table("aspire_dallas_students")
        .select("user_id, email, first_name, last_name, team_id")
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise HTTPException(status_code=403, detail="This account is not a Dallas account")
    return rows[0]
