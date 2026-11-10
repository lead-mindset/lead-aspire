# LEAD Aspire schema map (for the Impact Report exports)

Source of truth for this map: `backend/db/schemas/001`–`013` (the only
migrations; there is no `supabase/migrations`, no `schema.sql`, no generated
`database.types.ts`), the FastAPI code in `backend/app/`, and the frontend
calls in `frontend/src/app/[locale]/`. Checked on every branch
(`dev`, `main`, `qa`, `dallas-last`, `ncyshools`): none has extra tables.

Run `exports/schema_check.sql` in the Supabase SQL Editor to confirm the live
database matches this map before trusting any export.

## Editions at a glance

| Edition | How its data is told apart | Tables |
|---|---|---|
| **New York** (closed) | `aspire_user_access.city_id` → `aspire_cities.code = 'NYC'`; groups `NYC-*` | `aspire_groups`, `aspire_user_access`, `aspire_team_progress`, `aspire_submissions`, `aspire_group_logos`, `aspire_login_events` |
| **Dallas** (AI Token Challenge) | `auth.users.raw_app_meta_data ->> 'aspire_city' = 'DFW'` and a row in `aspire_dallas_students` | `aspire_dallas_event_codes`, `aspire_dallas_teams`, `aspire_dallas_students`, `aspire_dallas_team_phases`, `aspire_dallas_submissions` |
| **Shared** | — | `auth.users`, `aspire_profiles`, `aspire_cities`, `aspire_coach_messages`, Storage bucket `aspire-team-submissions` |
| **NYC Schools** (`/nycschools`) | — | **None.** Progress lives only in the browser's localStorage. Nothing to export. |

## Tables

### Shared

**`auth.users`** (Supabase Auth). One row per account, both editions.
- Useful: `id`, `email`, `created_at`, `last_sign_in_at`, `raw_app_meta_data` (`aspire_city = 'DFW'` marks Dallas).
- Never export: `encrypted_password`, `*_token`, `raw_user_meta_data` beyond what's needed.
- Dallas accounts are created by the backend on first login (`dallas_routes.py:86`), so `created_at` ≈ first Dallas login.

**`aspire_profiles`** — one row per auth user, auto-created by trigger `aspire_on_auth_user_created` (001).
- `id` (PK, FK `auth.users`), `display_name`, `status` (`active`/`disabled`), `is_admin` (004), `created_at`, `updated_at`.
- **PII caveat:** `display_name` defaults to the **email** when the account had no display name (001 trigger). Treat as PII.
- `is_admin = true` marks organizers in **both** editions (`routes.py:94`, `dallas_admin.py`). Dallas profiles are otherwise unused.

**`aspire_cities`** — `id`, `code` (`NYC`, `DFW`), `name`, `is_active`, `created_at`. Lookup only.

**`aspire_coach_messages`** — one row per **successful** question/answer with a Foundry agent (006, 013).
- `id`, `user_id` (FK auth.users, set null on delete), `group_id` (NY group; **null for Dallas**), `conversation_id` (Foundry conversation), `question`, `answer`, `agent_name` (013), `created_at`.
- Writers: NY coach (`routes.py:723`, `group_id` set), Dallas LEAD Coach (`dallas_coach.py`, `group_id` null), Dallas Contoso stakeholders CIO/CFO/CSO/Support (`dallas_stakeholders.py`, `group_id` null).
- `agent_name` = the env value `FOUNDRY_AGENT_NAME` / `FOUNDRY_DALLAS_AGENT_NAME` / `FOUNDRY_DALLAS_<CIO|CFO|CSO|SUPPORT>_AGENT_NAME`. Actual names are **not in the repo**; the live distinct values must be mapped by hand.
- Caveats: rows before 013 have `agent_name` null. Failed calls are not stored. A failed insert is swallowed (`routes.py:654`), so counts are a lower bound. Edition must come from the user (join to `aspire_dallas_students` / `aspire_user_access`), not from `group_id` alone. If the user was deleted, `user_id` is null and edition is unknown.

### New York (read only, closed)

**`aspire_groups`** — `id`, `group_code` (unique), `group_name`, `is_active`, `created_at`.
- Contains NY teams (`NYC-G01`… per the logo files; seeded examples `NYC-VISIONARIES` etc.), possibly `NYC-LOADTEST-01..18` (test), and **`DFW-G01..G20`** seeded by 002 that the Dallas app never uses (legacy).

**`aspire_user_access`** — student/admin ↔ city ↔ group. `id`, `user_id` (FK aspire_profiles), `city_id`, `group_id` (nullable, 003), `access_role` (`member`/`group_admin`), `created_at`.

**`aspire_team_progress`** — phases a NY team marked done. PK (`group_id`, `phase_key`); `phase_key` ∈ `discover`, `strategize`, `build`, `pitch`; `completed_by`, `completed_at`. Only the completion time is stored, no start time.

**`aspire_submissions`** — NY final deck per group (unique `group_id`): `storage_path`, `file_name`, `content_type`, `file_size_bytes`, `demo_link`, `submitted_by`, `created_at`, `updated_at`. A resubmission overwrites the row; `updated_at` = last submission.

**`aspire_login_events`** — NY login audit: `user_id`, `email` (PII), `city_id`, `group_id`, `succeeded`, `failure_reason`, `created_at`. **Dallas logins are not recorded here** (Dallas login never writes this table).

**`aspire_group_logos`** — logo metadata. Defined in 001 but **no code reads or writes it**: logos are read straight from the Storage bucket by file name (`routes.py:596`). Likely empty. **Excluded from all exports and the report**, together with the `aspire-group-logos` bucket (logos are not evidence of student work).

NY student **answers are not in the database.** The whiteboard is localStorage only (`WhiteboardCanvas.tsx`), and the email gate on `/new-york` is localStorage only (`EmailGate.tsx`).

### Dallas

**`aspire_dallas_event_codes`** — `id`, `code`, `is_active`, `created_at`. **Secret. Never export `code`.** Not needed for the report.

**`aspire_dallas_teams`** — `id`, `team_number` (1–30), `name` (`Team N`), `is_active`, `created_at`. Seeded; a team with zero students was never formed.

**`aspire_dallas_students`** — one row per Dallas student. PK `user_id`; `email` (PII), `first_name`, `last_name` (PII), `team_id` (locked once set), `profile_completed_at` (name + team saved), `created_at` (first login), `updated_at`.
- `team_id` null = logged in but never finished Step 2.
- No school, major, level, grad year, location or any demographic field.

**`aspire_dallas_team_phases`** — one row per team per phase. PK (`team_id`, `phase`); `answers` (jsonb, flat), `started_at` (first member opened the phase), `completed_at` (team pressed Continue), `completed_by`, `updated_by`, `updated_at` (last save).
- `phase` ∈ `team`, `discover`, `strategize`, `design`, `pitch` (011). Report mapping: `team` = Team Setup (not a numbered step), `discover` = Step 1 Discover, `strategize` = Step 2 Strategize, `design` = Step 3 "Design Your Solution" (≈ **Build**), `pitch` = Step 4 "Pitch & Submit".
- What `answers` holds (`dallas_challenge.py:11`, `answers.ts`):
  - `team`: `display_name` (team's chosen name, ≤32 chars, locks on completion); `role_<ae|ai|se|csm|csa>` = teammate `user_id`. Roles: AE Account Executive, AI AI Specialist, SE Solutions Engineer, `csm` = CSAM Customer Success Account Manager, CSA Cloud Solutions Architect. One person per role key; a person can hold several roles.
  - `discover`: nothing saved.
  - `strategize` (marked "practice, not graded" in code): `class_<workload>` = `protect|optimize|investigate|retire` for workloads `support, sales, marketing, hr, knowledge, experiments`; `cause_<key> = true` for up to 3 root causes (`adoption, models, prompts, duplicates, governance, experiments, monitoring, training, value, capacity`); `rec_<mon|opt|exp|hr|gov|trn>` = epoch ms when added (orders the strategy, max 5).
  - `design`, `pitch`: nothing saved.
- Completion: only `team` has a minimum (name + ≥1 role). Other phases can be marked complete with no work. Completion is never undone.
- 011 **deleted** rows of earlier phase names (`brief`, `diagnose`, `advise`, `respond`, `deliver`); unrecoverable.
- `answers` holds only the latest value per key; there is no history of edits.

**`aspire_dallas_submissions`** — final deck + demo link per team (unique `team_id`): same columns as NY's `aspire_submissions` with `team_id`. File in bucket `aspire-team-submissions` under `DFW-team-<team_id>/`.

## Storage

**`storage.objects`, bucket `aspire-team-submissions`** (both editions; the only bucket exported).
- Path: NY `<group_code>/<epoch>-[<hex8>-]<file>`, Dallas `DFW-team-<aspire_dallas_teams.id>/<epoch>-<hex8>-<file>`. The folder gives the edition and team.
- Useful: `name` (path), `created_at` (upload time), `metadata ->> 'size'`, `metadata ->> 'mimetype'` (type declared by the browser).
- `owner` doesn't identify the student: uploads go through the backend's service key or a backend-signed upload URL.
- Confirming a new deck **deletes the previous file**, so Storage holds the current deck plus leftovers (unconfirmed uploads, failed removals). Resubmissions are undercounted.

**Bucket `aspire-group-logos`:** excluded.

## Test, demo and organizer accounts (to exclude or flag)

| Signal | Where | Applies to |
|---|---|---|
| `aspire_profiles.is_admin = true` | organizers | both |
| email `~ '^loadtest[0-9]{2}@test\.lead$'`, groups `NYC-LOADTEST-*` | load test | NY |
| `student.ny@leadmindset.org`, `student.dallas@leadmindset.org` | seed demo accounts (002) | both |
| email domain `@leadmindset.org` | likely staff, **needs your confirmation** | both |
| `@example.org`, `@test.*` | test placeholders | both |
| Dallas rows created before the event day | rehearsal data (if `delete_dallas_data.sql` was not run after rehearsals) | Dallas |

I can't tell volunteers or mentors from students: there is no role field for them.

## Gaps against the report brief (the data doesn't exist in the repo)

1. **AI judge scores, AI judge prompt (and versions), human judges, judge comments, rubric criteria, rankings, winners:** no table, no code, on any branch. The Dallas leaderboard is marked "still mock" (`data.ts:4`). If these were built in another repo or directly in Supabase, `schema_check.sql` Q3 will find them.
2. **Demographics** (school, level, major, grad year, location): never collected in either edition.
3. **Professionals** (judges, mentors, facilitators, company, industry): no table. Only `is_admin` organizers.
4. **Surveys, reflections, ratings, feedback:** no table.
5. **Token or budget allocations / percentages:** not stored. Dallas Strategize stores classifications, causes and recommendations only. The token figures (27M, $54K…) are fixed case content in `data.ts`, not student input.
6. **Dallas Design and Pitch answers:** not stored; only the uploaded deck and demo link. Deck *content* lives in Storage files, not in the database.
7. **New York phase answers:** not stored (localStorage). NY only has phase completion times, the deck, and coach chats.
8. **Dallas login log:** none. Activity must be inferred from `aspire_dallas_students.created_at`, `auth.users.last_sign_in_at`, phase timestamps, coach messages and submissions.
9. **Phase start times for New York:** none (completion only).
10. **Event start/end:** not stored as such; only inferable from activity timestamps.
11. **Foundry/Azure call logs:** only successful Q&A pairs in `aspire_coach_messages`; no token usage, latency, or errors.
12. **Consent for quote attribution:** no consent field anywhere.
