# Lead Aspire backend

FastAPI service for authentication, group lookup, and Supabase access
validation.

## Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill `.env` following the comments in `.env.example`:

- **Supabase** (required): `SUPABASE_URL` and the server-only
  `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to the frontend.
- **CORS**: `FRONTEND_ORIGIN` (defaults to `http://localhost:3000`) and the optional
  `FRONTEND_ORIGIN_REGEX` for Vercel preview URLs (leave empty locally).
- **Foundry coach** (optional): `FOUNDRY_PROJECT_ENDPOINT` and `FOUNDRY_AGENT_NAME`.
  Without them the API still runs and `/api/coach/chat` answers 503.
- **Azure service principal** (optional locally): `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`
  and `AZURE_CLIENT_SECRET`, read from `.env`. Leave any of them empty to use
  `DefaultAzureCredential` instead (your `az login` session, which must be signed in
  to the same tenant as the Foundry project).

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`.
