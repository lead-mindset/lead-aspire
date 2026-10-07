# LEAD Aspire load test

Checks that **90 students can log in** and **18 teams can upload their deck** against the
deployed app (FastAPI backend on Vercel, Supabase Auth, Database and Storage).

Each simulated student uses one test account (`loadtest01@test.lead` … `loadtest90@test.lead`,
five per group `NYC-LOADTEST-01` … `NYC-LOADTEST-18`) and does:

| Stats row | Request |
|---|---|
| `login_backend` | `POST /api/auth/login` (what the login form calls) |
| `login_supabase` | `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` (the browser's own sign-in; its token is used afterwards) |
| `login_total` | both logins (FLOW row) |
| `GET /api/team/progress`, `…/members`, `…/submission` | app load |
| `upload_url` | `POST /api/team/submission/upload-url` — first member of each group only |
| `storage_upload` | `PUT` a ~2 MB PDF to Supabase Storage (signed upload URL) |
| `upload_confirm` | `POST /api/team/submission/confirm` |
| `upload_total` | the three upload steps (FLOW row) |
| `idle_progress` | `GET /api/team/progress` every 10–20 s until the run ends |

The coach (`/api/coach/chat`) is never called.

**Run it only when no real students are online.** Test progress and submissions are real
writes to the production database and Storage, and the organizer results page shows the
test groups until cleanup.

## Setup

```bash
cd loadtest
python -m venv .venv
source .venv/Scripts/activate      # Git Bash on Windows; .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env               # then fill it in
```

| Variable | Used by | What |
|---|---|---|
| `SUPABASE_URL` | all | `https://<ref>.supabase.co` of the project the backend uses |
| `SUPABASE_SERVICE_ROLE_KEY` | create / cleanup | admin key; never used by Locust |
| `SUPABASE_ANON_KEY` | Locust | public key for the browser-style sign-in and Storage upload |
| `LOADTEST_HOST` | Locust | deployed backend URL, no trailing slash |
| `LOADTEST_PASSWORD` | create / Locust | shared password of the test accounts |

`.env`, `test_users.csv` and `results/` are gitignored.

## 1. Create the test accounts

```bash
python create_test_users.py
```

Creates the 18 groups, the 90 auth users (`email_confirm: true`, no email sent), their
profiles and New York access, then writes `test_users.csv`. Safe to re-run: existing
accounts are skipped (add `--reset-password` if their password differs from `LOADTEST_PASSWORD`).

## 2. Run

```bash
./run_smoke.sh          # 2 students, 1 minute: always first
./run_login_burst.sh    # 90 students, 3/s, 3 minutes: everyone logs in at once, uploads right after
./run_upload_burst.sh   # 90 students over 60 s, then all 18 uploads start together: the deadline
```

Each script runs Locust headless, writes `results/<scenario>_*.csv`, and then runs
`analyze.py`, which prints:

1. Login success for `login_backend` and `login_supabase` (PASS only at 90/90).
2. Success of each upload step (PASS only at 18/18), and how spread out the upload starts were.
3. Every 429, 5xx and connection error, with response headers, classified as **Supabase**,
   **Vercel** (platform or firewall: `x-vercel-error` / `x-vercel-mitigated`) or **backend**.
4. Median and 95th percentile per stats row; warnings for any login request over 3 s and any
   full upload over 15 s.
5. A PASS/FAIL verdict for login and for upload (exit code 0 only if both pass).

Re-analyze a run any time: `python analyze.py results/login_burst`.
Set `PYTHON=...` if `python` is not the venv's interpreter.

Running the upload burst again needs no cleanup: each upload replaces the team's previous
deck (and deletes its old file).

## 3. Clean up

```bash
python cleanup.py                 # test data: Storage files, submissions, progress, login events
python cleanup.py --delete-users  # also the 90 accounts, their access and the 18 groups
```

It lists what it will delete and asks you to type `delete`. It only touches
`loadtestNN@test.lead` accounts and `NYC-LOADTEST-NN` groups.

## Known risks

- **Double sign-in per login.** The login form calls `POST /api/auth/login`, which signs in to
  Supabase from the backend, and then the browser signs in to Supabase again to get its session.
  Every student login is two Supabase password sign-ins. At the event, the backend's sign-ins
  all come from Vercel's IPs and the browsers' likely from one venue IP, so Supabase's per-IP
  sign-in rate limit is the most likely bottleneck (see Authentication → Rate Limits in the
  Supabase dashboard). The backend also reports a Supabase rate limit as
  `401 Invalid email or password`, so watch `login_backend` 401s.
  **Possible fix:** the frontend signs in to Supabase directly, then calls `/api/auth/me` with
  the token to get the city and group (one sign-in per login). `/api/auth/me` already exists;
  login events would then need to be recorded from `/me` or the client.
- **One machine, one IP.** Locust sends every request from your machine. That matches students
  behind one venue Wi-Fi, but Vercel's firewall may treat it as an attack and answer 429 or a
  challenge; `analyze.py` labels those as Vercel.
- **Not covered:** Next.js page renders and Supabase Realtime connections (out of scope).
