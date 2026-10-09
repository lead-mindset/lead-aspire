# Lead Aspire

The repository contains two independent applications:

- `frontend/` — Next.js web application
- `backend/` — FastAPI service for login, team data and the Foundry coach

## Run the backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`.
`SUPABASE_SERVICE_ROLE_KEY` must be the Supabase `service_role` key from
Project Settings > API, not the public `anon` key. The service-role key is
required because the backend writes login audit events while RLS is enabled.

The coach uses a Microsoft Foundry agent. Set `FOUNDRY_PROJECT_ENDPOINT` and
`FOUNDRY_AGENT_NAME` in `backend/.env`. Authentication uses Entra ID through
`DefaultAzureCredential`: run `az login` locally, or set `AZURE_TENANT_ID`,
`AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` in production. The signed-in
identity must have permission to invoke the agent. Never place these
credentials in the frontend environment.

## Run the frontend

In a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

The frontend expects the FastAPI service at
`NEXT_PUBLIC_API_URL=http://localhost:8000`.

The service-role key is server-only and must never be placed in
`frontend/.env.local` or exposed to the browser.

Database schemas and Supabase seed scripts are maintained under
`backend/db/schemas/`. Apply `001_tables_creation.sql` first, then apply
subsequent numbered migrations in order.

## Tests

Backend unit tests run against an in-memory fake of Supabase and Foundry:

```powershell
cd backend
pip install -r requirements-dev.txt
python -m pytest
python -m ruff check .
```

Frontend unit tests, lint and typecheck:

```powershell
cd frontend
npm test
npm run lint
npm run typecheck
```

End-to-end tests (Playwright) sign in with a real, active New York user.
Copy `frontend/.env.test.example` to `frontend/.env.test` and fill in
`E2E_USER_EMAIL` and `E2E_USER_PASSWORD` (the file is gitignored), then:

```powershell
cd frontend
npm run test:e2e
```

Playwright starts the backend and the frontend if they are not already
running. The tests only read data, but the last one signs the user out of
every session, so use a dedicated test account.

## Dallas login

Dallas students sign in at **`/en/dallas/login`**. Share that URL as a QR
code at the venue. URLs carry no locale prefix (`localePrefix: "never"`), so
`/en/dallas/login` switches the site to English and then shows as
`/dallas/login`; `/es/dallas/login` does the same in Spanish. Students must
not use `/login`: that is the New York login and it rejects Dallas accounts.

Students enter their email and the event code. The first time, the backend
creates their Supabase account (confirmed, no email is sent) and they enter
their first and last name and pick their team (Team 1 to Team 30). The team
cannot be changed afterwards, by the student or by the API. Returning
students, on any device, go straight to the dashboard.

Dallas is isolated from New York: its routes are `/api/dallas/*`
(`backend/app/dallas_routes.py`), its tables are `aspire_dallas_*`
(`backend/db/schemas/009_dallas_login.sql`), and its accounts carry
`app_metadata.aspire_city = "DFW"`, which every New York route and the New
York app reject. New York accounts are rejected by every Dallas route.

**Accepted risk:** anyone who knows the event code and a student's email can
sign in as that student. This is accepted for a one-day event; deactivate the
code when the event ends.

### Dallas event day checklist

Before the event:

1. Run `backend/db/schemas/009_dallas_login.sql` in the Supabase SQL Editor.
   It only creates `aspire_dallas_*` objects and seeds Team 1 to Team 30.
2. Add the event code (stored lowercase; students can type it in any case).
   Replace the placeholder; never commit the real code:

   ```sql
   insert into public.aspire_dallas_event_codes (code)
   values (lower(btrim('<DALLAS_EVENT_CODE>')));
   ```

3. In Supabase > Authentication > Rate Limits, raise **Rate limit for token
   verifications** to **300 per 5 minutes**. Every Dallas login is one token
   verification, made by the backend, so all students count against the
   backend's IP. Account creation and link generation use the Admin API and
   are not rate limited; no email is sent.
4. Check the student URL `/en/dallas/login` works and print the QR code.

After the event, deactivate the code (students already signed in keep their
session until it expires; nobody can sign in again):

```sql
update public.aspire_dallas_event_codes
set is_active = false
where code = lower(btrim('<DALLAS_EVENT_CODE>'));
```

To move a student who picked the wrong team (an organizer, in the SQL Editor):

```sql
alter table public.aspire_dallas_students disable trigger aspire_dallas_students_before_update;
update public.aspire_dallas_students
set team_id = (select id from public.aspire_dallas_teams where team_number = <N>)
where email = lower('<STUDENT_EMAIL>');
alter table public.aspire_dallas_students enable trigger aspire_dallas_students_before_update;
```

Rollback: `backend/db/schemas/009_dallas_login_rollback.sql` drops only the
`aspire_dallas_*` tables, functions, policies and trigger. Dallas Auth users
stay in Authentication > Users.
