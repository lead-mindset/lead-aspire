"""Dallas stakeholder chats: /api/dallas/stakeholders.

In Discover > Stakeholders, students can question each Contoso stakeholder.
Each one is its own Foundry agent in the coach's project, named by
FOUNDRY_DALLAS_<KEY>_AGENT_NAME (app/config.py); the keys match the
stakeholders in the frontend's content.ts. Same token check, error handling
and history table as the Dallas coach (app/dallas_coach.py).
"""

from typing import Literal, get_args

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .config import settings
from .dallas_auth import dallas_student
from .routes import _conversation_owned_by_other, _record_coach_message, coach_answer
from .schemas import CoachChatRequest, CoachChatResponse
from .supabase import shared_admin_client

stakeholders_router = APIRouter(prefix="/stakeholders")

StakeholderKey = Literal["cio", "cfo", "cso", "support"]
STAKEHOLDERS: tuple[str, ...] = get_args(StakeholderKey)


class StakeholdersResponse(BaseModel):
    # Stakeholders whose agent is configured; the others show no chat button.
    available: list[StakeholderKey]


def ask_stakeholder(agent_name: str):
    """app.foundry.ask_agent bound to one stakeholder's agent, imported on first use (cold starts)."""

    def ask(question: str, conversation_id: str | None = None) -> tuple[str, str]:
        from .foundry import ask_agent

        return ask_agent(question, conversation_id, agent_name=agent_name)

    return ask


@stakeholders_router.get("", response_model=StakeholdersResponse)
def list_stakeholders(authorization: str | None = Header(default=None)) -> StakeholdersResponse:
    dallas_student(shared_admin_client(), authorization)
    return StakeholdersResponse(available=[key for key in STAKEHOLDERS if settings.dallas_stakeholder_agent(key)])


@stakeholders_router.post("/{key}/chat", response_model=CoachChatResponse)
def stakeholder_chat(
    key: StakeholderKey,
    payload: CoachChatRequest,
    authorization: str | None = Header(default=None),
) -> CoachChatResponse:
    # Sync route: FastAPI runs it in a threadpool, so the blocking SDK call
    # does not stall the event loop.
    client = shared_admin_client()
    student = dallas_student(client, authorization)
    user_id = str(student["user_id"])
    if payload.conversation_id and _conversation_owned_by_other(client, payload.conversation_id, user_id):
        raise HTTPException(status_code=403, detail="This conversation belongs to another user")
    agent_name = settings.dallas_stakeholder_agent(key)
    if not agent_name:
        raise HTTPException(status_code=503, detail="This stakeholder is not configured")

    answer, conversation_id = coach_answer(payload.question, payload.conversation_id, ask_stakeholder(agent_name))

    _record_coach_message(client, user_id, None, conversation_id, payload.question, answer, agent_name)
    return CoachChatResponse(answer=answer, conversation_id=conversation_id)
