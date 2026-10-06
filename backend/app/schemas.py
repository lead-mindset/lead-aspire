from typing import Literal

from pydantic import BaseModel, EmailStr, Field

# Same keys as PHASE_KEYS in the New York frontend (_aspire/data.ts).
PhaseKey = Literal["discover", "strategize", "build", "pitch"]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    ok: bool = True
    access_role: str
    city_code: str
    group_code: str | None = None


class CoachChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, max_length=200)


class CoachChatResponse(BaseModel):
    answer: str
    conversation_id: str


class TeamMember(BaseModel):
    name: str


class TeamMembersResponse(BaseModel):
    group_code: str | None
    group_name: str | None
    logo_url: str | None = None
    members: list[TeamMember]


class AdminTeam(BaseModel):
    group_code: str
    group_name: str
    city_code: str | None
    members: int
    deck_file: str | None = None
    demo_link: str | None = None
    submitted_at: str | None = None


class AdminTeamsResponse(BaseModel):
    teams: list[AdminTeam]


class TeamSubmission(BaseModel):
    file_name: str
    demo_link: str | None = None
    submitted_at: str | None = None


class TeamSubmissionResponse(BaseModel):
    submission: TeamSubmission | None


class TeamProgressUpdate(BaseModel):
    phase: PhaseKey
    completed: bool


class TeamProgressResponse(BaseModel):
    completed: list[PhaseKey]


class AdminDeckResponse(BaseModel):
    file_name: str
    content_type: str
    demo_link: str | None = None
    view_url: str
    download_url: str
