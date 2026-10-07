from pydantic import BaseModel, EmailStr, Field, field_validator


class DallasLoginRequest(BaseModel):
    email: EmailStr
    event_code: str = Field(min_length=1, max_length=100)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        # Trimmed and lowercased before the format check, so one student is one account.
        return value.strip().lower() if isinstance(value, str) else value


class DallasLoginResponse(BaseModel):
    """A normal Supabase session; the browser stores it with auth.setSession()."""

    access_token: str
    refresh_token: str
    expires_at: int | None = None
    # True until the student has saved their name and team (Step 2).
    needs_profile: bool


class DallasTeam(BaseModel):
    id: int
    number: int
    name: str


class DallasTeamsResponse(BaseModel):
    teams: list[DallasTeam]


class DallasProfileRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    team_id: int = Field(gt=0)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        # Collapse inner whitespace: "  Ana   María " -> "Ana María".
        return " ".join(value.split()) if isinstance(value, str) else value


class DallasMember(BaseModel):
    first_name: str
    last_name: str


class DallasMeResponse(BaseModel):
    email: str
    first_name: str | None = None
    last_name: str | None = None
    team: DallasTeam | None = None
    members: list[DallasMember] = []
