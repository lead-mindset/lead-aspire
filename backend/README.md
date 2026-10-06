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

Fill `.env` with the Supabase project URL and the server-only service-role key.
Never expose the service-role key to the frontend.

## Run

```powershell
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`.
