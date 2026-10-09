from typing import Any, Literal

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


# --- Challenge: shared team answers, timers and progress ------------------------

DallasPhase = Literal["team", "brief", "discover", "diagnose", "advise", "respond", "deliver"]


class DallasTeamMember(BaseModel):
    user_id: str
    first_name: str
    last_name: str


class DallasPhaseState(BaseModel):
    # Flat object: one key per field or option (see app/dallas_challenge.py).
    answers: dict[str, Any] = {}
    started_at: str | None = None
    completed_at: str | None = None
    updated_at: str | None = None
    updated_by_name: str | None = None


class DallasTeamInfo(BaseModel):
    id: int
    number: int
    name: str
    # The name the team typed in the Team phase; null until set.
    display_name: str | None = None


class DallasTeamStateResponse(BaseModel):
    team: DallasTeamInfo
    members: list[DallasTeamMember]
    phases: dict[str, DallasPhaseState]
    # Lets the browser correct its clock for the phase timers.
    server_time: str


class DallasAnswersPatch(BaseModel):
    """Only the keys that changed. A null value removes the key."""

    patch: dict[str, Any] = Field(min_length=1, max_length=60)


class DallasPhaseResponse(BaseModel):
    phase: DallasPhaseState
    server_time: str
