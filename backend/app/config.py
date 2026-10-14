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
    # Dallas coach: its own agent in the same Foundry project (same endpoint
    # and Azure credentials). Empty: /api/dallas/coach/chat answers 503.
    foundry_dallas_agent_name: str = ""
    # Dallas stakeholder chats (Discover > Stakeholders): one agent per
    # stakeholder in the same Foundry project. Empty: that stakeholder's chat
    # is hidden and /api/dallas/stakeholders/<key>/chat answers 503.
    foundry_dallas_cio_agent_name: str = ""
    foundry_dallas_cfo_agent_name: str = ""
    foundry_dallas_cso_agent_name: str = ""
    foundry_dallas_support_agent_name: str = ""
    # Optional service principal for Foundry. Read here (not only from os.environ)
    # so a local .env works too; see app/azure_auth.py.
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""

    @property
    def coach_configured(self) -> bool:
        return bool(self.foundry_project_endpoint and self.foundry_agent_name)

    @property
    def dallas_coach_configured(self) -> bool:
        return bool(self.foundry_project_endpoint and self.foundry_dallas_agent_name)

    def dallas_stakeholder_agent(self, key: str) -> str:
        """The Foundry agent for a Dallas stakeholder ("cio", "cfo", ...), or "" if not configured."""
        if not self.foundry_project_endpoint:
            return ""
        return getattr(self, f"foundry_dallas_{key}_agent_name", "")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
