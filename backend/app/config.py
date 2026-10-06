from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    frontend_origin: str = "http://localhost:3000"
    # Extra origins as a regex, e.g. the frontend's Vercel preview URLs. Empty: none.
    frontend_origin_regex: str = ""
    # Optional: without both, the API runs and /api/coach/chat answers 503.
    foundry_project_endpoint: str = ""
    foundry_agent_name: str = ""

    @property
    def coach_configured(self) -> bool:
        return bool(self.foundry_project_endpoint and self.foundry_agent_name)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
