"""Read a load-test run and print login/upload verdicts.

    python analyze.py results/login_burst [--users 90] [--uploads 18]

Reads <prefix>_stats.csv (Locust) and <prefix>_flow.csv (locustfile.py).
Exit code 0 when both login and upload PASS, 1 otherwise.
"""

import argparse
import csv
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

LOGIN_STEPS = ["login_backend", "login_supabase"]
UPLOAD_STEPS = ["upload_url", "storage_upload", "upload_confirm"]
LOGIN_SLOW_MS = 3_000
UPLOAD_SLOW_MS = 15_000
VERCEL_CODE = re.compile(r"\b[A-Z]+(?:_[A-Z]+)+\b")  # e.g. FUNCTION_INVOCATION_TIMEOUT


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        sys.exit(f"Missing {path}. Did the run finish?")
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def classify(row: dict) -> str:
    """Who answered: Supabase, Vercel (platform/firewall) or the backend (FastAPI)."""
    if row["status"] == "0":
        return "network"
    if row["origin"] == "supabase":
        return "Supabase"
    headers = {k.lower(): v for k, v in json.loads(row["headers"] or "{}").items()}
    if "x-vercel-error" in headers or "x-vercel-mitigated" in headers:
        return "Vercel"
    body = row.get("body") or ""
    if not body.lstrip().startswith("{") and VERCEL_CODE.search(body):
        return "Vercel"
    return "backend"


def percentile(sorted_values: list[int], pct: float) -> float:
    """Nearest-rank percentile of an already sorted list."""
    rank = max(1, -(-len(sorted_values) * pct // 100))  # ceil
    return float(sorted_values[int(rank) - 1])


def verdict(ok: bool) -> str:
    return "PASS" if ok else "FAIL"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("prefix", help="CSV prefix given to locust --csv, e.g. results/login_burst")
    parser.add_argument("--users", type=int, default=90, help="students expected to log in")
    parser.add_argument("--uploads", type=int, default=18, help="uploads expected")
    args = parser.parse_args()

    stats = read_csv(Path(f"{args.prefix}_stats.csv"))
    flow = read_csv(Path(f"{args.prefix}_flow.csv"))
    by_name = defaultdict(list)
    for row in flow:
        by_name[row["name"]].append(row)

    total = next((r for r in stats if r["Name"] == "Aggregated"), None)
    print(f"\n=== {args.prefix} ===")
    if total:
        print(f"Total requests: {total['Request Count']}  failures: {total['Failure Count']}")

    # ---- 1. Logins ----
    print("\n-- Login --")
    login_ok = True
    for step in LOGIN_STEPS:
        succeeded = {r["email"] for r in by_name[step] if r["ok"] == "1"}
        attempted = {r["email"] for r in by_name[step]}
        ok = len(succeeded) == args.users
        login_ok &= ok
        print(f"{step:16} {len(succeeded):3}/{args.users} succeeded"
              f" ({len(attempted)} attempted)  {verdict(ok)}")

    # ---- 2. Uploads ----
    print("\n-- Upload --")
    upload_ok = True
    for step in UPLOAD_STEPS:
        succeeded = {r["group_code"] for r in by_name[step] if r["ok"] == "1"}
        attempted = {r["group_code"] for r in by_name[step]}
        ok = len(succeeded) == args.uploads
        upload_ok &= ok
        print(f"{step:16} {len(succeeded):3}/{args.uploads} succeeded"
              f" ({len(attempted)} attempted)  {verdict(ok)}")
    if len({r["group_code"] for r in by_name["upload_url"]}) < args.uploads:
        print("  Teams without an attempt: their uploader's login failed.")
    starts = [float(r["time"]) - int(r["ms"]) / 1000 for r in by_name["upload_url"]]
    if len(starts) > 1:
        print(f"Upload start spread: {max(starts) - min(starts):.1f}s between first and last team")

    # ---- 3. 429 / 5xx ----
    print("\n-- 429 and 5xx --")
    bad = [r for r in flow if r["status"] in ("0", "429") or r["status"].startswith("5")]
    if not bad:
        print("None.")
    else:
        counts = Counter((classify(r), r["name"], r["status"]) for r in bad)
        for (source, name, status), n in sorted(counts.items()):
            print(f"{n:4} x {status} {name:16} from {source}")
        print(f"429 total: {sum(1 for r in bad if r['status'] == '429')}")
        print("\nDetails:")
        for r in bad:
            headers = json.loads(r["headers"] or "{}")
            interesting = {k: v for k, v in headers.items() if re.match(
                r"(?i)(retry-after|x-ratelimit|ratelimit|x-vercel|server|cf-ray|sb-|x-sb|content-type|date|via)", k)}
            print(f"  {r['name']} {r['status']} [{classify(r)}] {r['email']}")
            print(f"    headers: {json.dumps(interesting)}")
            if r["body"]:
                print(f"    body: {r['body'][:200]}")

    # Other failures (4xx except 429), e.g. a 401 from the backend login.
    other = [r for r in flow if r["ok"] == "0" and r not in bad]
    if other:
        print("\n-- Other failures --")
        for (name, status), n in sorted(Counter((r["name"], r["status"]) for r in other).items()):
            print(f"{n:4} x {status} {name}")
        for r in other[:20]:
            print(f"  {r['error']}")

    # ---- 4. Times ----
    # Exact percentiles from the flow log where every request is there; Locust's
    # rounded ones (marked ~) for idle_progress and the FLOW rows.
    print("\n-- Response times (ms) --")
    print(f"{'row':26} {'count':>6} {'fail':>5} {'median':>7} {'p95':>7} {'max':>7}")
    for r in stats:
        if r["Name"] == "Aggregated":
            continue
        times = sorted(int(x["ms"]) for x in by_name.get(r["Name"], []))
        if times and len(times) == int(r["Request Count"]):
            median, p95, mark = statistics.median(times), percentile(times, 95), " "
        else:
            median, p95, mark = float(r["50%"] or 0), float(r["95%"] or 0), "~"
        peak = float(r["Max Response Time"] or 0)
        print(f"{r['Name']:26} {r['Request Count']:>6} {r['Failure Count']:>5} "
              f"{median:>7.0f} {p95:>6.0f}{mark} {peak:>7.0f}")
    print("(~ = Locust's rounded percentile)")

    slow_logins = [r for step in LOGIN_STEPS for r in by_name[step] if int(r["ms"]) > LOGIN_SLOW_MS]
    if slow_logins:
        print(f"\nWARN {len(slow_logins)} login requests over {LOGIN_SLOW_MS / 1000:.0f}s:")
        for r in sorted(slow_logins, key=lambda r: -int(r["ms"]))[:15]:
            print(f"  {r['name']:16} {int(r['ms']):6} ms  {r['email']}")

    per_group = defaultdict(int)
    for step in UPLOAD_STEPS:
        for r in by_name[step]:
            per_group[r["group_code"]] += int(r["ms"])
    if per_group:
        totals = sorted(per_group.values())
        print(f"\nFull upload (3 steps): median {statistics.median(totals):.0f} ms, max {totals[-1]} ms")
        slow = {g: ms for g, ms in per_group.items() if ms > UPLOAD_SLOW_MS}
        for group, ms in sorted(slow.items(), key=lambda item: -item[1]):
            print(f"  WARN {group}: {ms} ms (over {UPLOAD_SLOW_MS / 1000:.0f}s)")

    # ---- 5. Verdict ----
    print("\n=== Verdict ===")
    print(f"Login:  {verdict(login_ok)}")
    print(f"Upload: {verdict(upload_ok)}")
    sys.exit(0 if login_ok and upload_ok else 1)


if __name__ == "__main__":
    main()
