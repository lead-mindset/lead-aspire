"""Create the 90 load-test students and their 18 groups, then write test_users.csv.

    python create_test_users.py [--reset-password]

- Auth users loadtest01@test.lead .. loadtest90@test.lead (email_confirm true,
  password LOADTEST_PASSWORD). Existing accounts are skipped; with
  --reset-password their password is set to LOADTEST_PASSWORD.
- Groups NYC-LOADTEST-01 .. NYC-LOADTEST-18 (five students each) in New York.
- One aspire_user_access row per student (city NYC, their group, member).

Safe to run again: it only adds what is missing.
"""

import argparse
import csv

from common import (
    CITY_CODE,
    GROUP_COUNT,
    USER_COUNT,
    USERS_CSV,
    SupabaseAdmin,
    email_for,
    env,
    group_for,
    in_list,
    is_uploader,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset-password", action="store_true", help="set LOADTEST_PASSWORD on existing accounts")
    args = parser.parse_args()

    password = env("LOADTEST_PASSWORD")
    admin = SupabaseAdmin()

    city = admin.select("aspire_cities", {"code": f"eq.{CITY_CODE}", "is_active": "eq.true", "select": "id"})
    if not city:
        raise SystemExit(f"City {CITY_CODE} is missing or inactive in aspire_cities.")
    city_id = city[0]["id"]

    # 1. Groups.
    group_rows = admin.insert(
        "aspire_groups",
        [
            {"group_code": f"NYC-LOADTEST-{g:02d}", "group_name": f"Load Test {g:02d}", "is_active": True}
            for g in range(1, GROUP_COUNT + 1)
        ],
        on_conflict="group_code",
    )
    group_ids = {row["group_code"]: row["id"] for row in group_rows}
    print(f"Groups ready: {len(group_ids)}")

    # 2. Auth users.
    existing = admin.list_test_users()
    created = skipped = 0
    user_ids: dict[str, str] = {}
    for n in range(1, USER_COUNT + 1):
        email = email_for(n)
        if email in existing:
            user_ids[email] = existing[email]["id"]
            if args.reset_password:
                admin.set_password(user_ids[email], email, password)
            skipped += 1
            continue
        user_ids[email] = admin.create_user(email, password)["id"]
        created += 1
    print(f"Users: {created} created, {skipped} already existed" + (" (password reset)" if args.reset_password else ""))
    if skipped and not args.reset_password:
        print("  Existing accounts keep their password; use --reset-password if logins fail.")

    ids = list(user_ids.values())

    # 3. Profiles: the auth trigger creates them; make sure they exist and are active.
    profiles = {row["id"] for row in admin.select("aspire_profiles", {"id": in_list(ids), "select": "id"})}
    missing_profiles = [
        {"id": uid, "display_name": email.split("@")[0]} for email, uid in user_ids.items() if uid not in profiles
    ]
    if missing_profiles:
        admin.insert("aspire_profiles", missing_profiles)
    admin.update("aspire_profiles", {"id": in_list(ids)}, {"status": "active"})
    print(f"Profiles ready: {len(ids)} ({len(missing_profiles)} created)")

    # 4. City + group access.
    access = admin.select(
        "aspire_user_access", {"user_id": in_list(ids), "select": "user_id, city_id, group_id"}
    )
    have = {(row["user_id"], row["city_id"], row["group_id"]) for row in access}
    wanted = {(user_ids[email_for(n)], city_id, group_ids[group_for(n)]) for n in range(1, USER_COUNT + 1)}
    new_access = [
        {"user_id": user_id, "city_id": cid, "group_id": gid, "access_role": "member"}
        for user_id, cid, gid in sorted(wanted - have)
    ]
    if new_access:
        admin.insert("aspire_user_access", new_access)
    others = have - wanted
    print(f"Access rows: {len(new_access)} added")
    if others:
        print(f"  Warning: {len(others)} extra access rows exist for test users; the oldest one decides their team.")

    # 5. CSV for Locust (no passwords: Locust reads LOADTEST_PASSWORD from .env).
    with USERS_CSV.open("w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["email", "group_code", "uploader"])
        for n in range(1, USER_COUNT + 1):
            writer.writerow([email_for(n), group_for(n), "1" if is_uploader(n) else "0"])
    print(f"Wrote {USERS_CSV.name} ({USER_COUNT} users, {GROUP_COUNT} uploaders)")


if __name__ == "__main__":
    main()
