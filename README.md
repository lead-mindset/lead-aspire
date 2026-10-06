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
