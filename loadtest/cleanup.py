"""Delete what the load test wrote, and optionally the test accounts.

    python cleanup.py                 # test data only; accounts and groups stay for another run
    python cleanup.py --delete-users  # also the 90 accounts, their access and the 18 groups
    python cleanup.py --yes           # skip the confirmation prompt

Only touches loadtestNN@test.lead accounts and NYC-LOADTEST-NN groups:
- Storage objects under NYC-LOADTEST-*/ in aspire-team-submissions
- aspire_submissions and aspire_team_progress rows of those groups
- aspire_login_events rows of those emails
- aspire_coach_messages rows of those users (the test does not create any)
"""

import argparse

from common import GROUP_RE, SUBMISSION_BUCKET, SupabaseAdmin, in_list


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--delete-users", action="store_true", help="also delete the accounts and groups")
    parser.add_argument("--yes", action="store_true", help="do not ask for confirmation")
    args = parser.parse_args()

    admin = SupabaseAdmin()
    groups = [
        g for g in admin.select("aspire_groups", {"group_code": "like.NYC-LOADTEST-*", "select": "id,group_code"})
        if GROUP_RE.match(g["group_code"])
    ]
    group_ids = [g["id"] for g in groups]
    users = admin.list_test_users()
    user_ids = [u["id"] for u in users.values()]

    objects = [p for g in groups for p in admin.list_objects(SUBMISSION_BUCKET, g["group_code"])]
    by_group = {"group_id": in_list(group_ids)} if group_ids else None
    by_user = {"user_id": in_list(user_ids)} if user_ids else None
    login_filter = {"email": "like.loadtest*@test.lead"}

    plan = [
        ("Storage objects", len(objects)),
        ("aspire_submissions", admin.count("aspire_submissions", by_group) if by_group else 0),
        ("aspire_team_progress", admin.count("aspire_team_progress", by_group) if by_group else 0),
        ("aspire_login_events", admin.count("aspire_login_events", login_filter)),
        ("aspire_coach_messages", admin.count("aspire_coach_messages", by_user) if by_user else 0),
    ]
    if args.delete_users:
        plan += [
            ("aspire_user_access", admin.count("aspire_user_access", by_user) if by_user else 0),
            ("auth users (and profiles)", len(users)),
            ("aspire_groups", len(groups)),
        ]

    print(f"Supabase project: {admin.url}")
    print("Will delete:")
    for label, n in plan:
        print(f"  {n:5}  {label}")
    if not args.yes and input("Type 'delete' to continue: ").strip() != "delete":
        print("Cancelled.")
        return

    if objects:
        admin.remove_objects(SUBMISSION_BUCKET, objects)
    if by_group:
        admin.delete("aspire_submissions", by_group)
        admin.delete("aspire_team_progress", by_group)
    admin.delete("aspire_login_events", login_filter)
    if by_user:
        admin.delete("aspire_coach_messages", by_user)

    if args.delete_users:
        if by_user:
            admin.delete("aspire_user_access", by_user)
        for email, user in users.items():
            admin.delete_user(user["id"], email)  # cascades to aspire_profiles
        if by_group:
            admin.delete("aspire_groups", {"id": in_list(group_ids)})
    print("Done.")


if __name__ == "__main__":
    main()
