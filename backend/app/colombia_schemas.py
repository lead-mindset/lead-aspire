from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class ColombiaLoginRequest(BaseModel):
    email: EmailStr
    event_code: str = Field(min_length=1, max_length=100)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        # Trimmed and lowercased before the format check, so one student is one account.
        return value.strip().lower() if isinstance(value, str) else value


class ColombiaLoginResponse(BaseModel):
    """A normal Supabase session; the browser stores it with auth.setSession()."""

    access_token: str
    refresh_token: str
    expires_at: int | None = None
    # True until the student has saved their name and team (Step 2).
    needs_profile: bool


class ColombiaTeam(BaseModel):
    id: int
    number: int
    name: str


class ColombiaTeamsResponse(BaseModel):
    teams: list[ColombiaTeam]


class ColombiaProfileRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    team_id: int = Field(gt=0)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def clean_name(cls, value):
        # Collapse inner whitespace: "  Ana   María " -> "Ana María".
        return " ".join(value.split()) if isinstance(value, str) else value


class ColombiaMember(BaseModel):
    first_name: str
    last_name: str


class ColombiaMeResponse(BaseModel):
    email: str
    first_name: str | None = None
    last_name: str | None = None
    team: ColombiaTeam | None = None
    members: list[ColombiaMember] = []
    # aspire_profiles.is_admin: also sees the organizer "View Teams Results" screen.
    is_admin: bool = False


# --- Challenge: shared team answers, timers and progress ------------------------

ColombiaPhase = Literal["team", "discover", "strategize", "design", "pitch"]


class ColombiaTeamMember(BaseModel):
    user_id: str
    first_name: str
    last_name: str


class ColombiaPhaseState(BaseModel):
    # Flat object: one key per field or option (see app/colombia_challenge.py).
    answers: dict[str, Any] = {}
    started_at: str | None = None
    completed_at: str | None = None
    updated_at: str | None = None
    updated_by_name: str | None = None


class ColombiaTeamInfo(BaseModel):
    id: int
    number: int
    name: str
    # The name the team typed in the Team phase; null until set.
    display_name: str | None = None


class ColombiaTeamStateResponse(BaseModel):
    team: ColombiaTeamInfo
    members: list[ColombiaTeamMember]
    phases: dict[str, ColombiaPhaseState]
    # Lets the browser correct its clock for the phase timers.
    server_time: str


class ColombiaAnswersPatch(BaseModel):
    """Only the keys that changed. A null value removes the key."""

    patch: dict[str, Any] = Field(min_length=1, max_length=60)


class ColombiaPhaseResponse(BaseModel):
    phase: ColombiaPhaseState
    server_time: str


# --- Organizers: every team's final deck and demo link ---------------------------


class ColombiaAdminTeam(BaseModel):
    id: int
    number: int
    name: str
    # The name the team typed in the Team phase; null until set.
    display_name: str | None = None
    members: int
    deck_file: str | None = None
    demo_link: str | None = None
    submitted_at: str | None = None


class ColombiaAdminTeamsResponse(BaseModel):
    teams: list[ColombiaAdminTeam]
