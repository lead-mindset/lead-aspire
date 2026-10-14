"""Dallas coach: POST /api/dallas/coach/chat.

Same Foundry project and Azure credentials as the New York coach, but its own
agent (FOUNDRY_DALLAS_AGENT_NAME) and the Dallas token check. History goes to
aspire_coach_messages with no group (Dallas teams are not aspire_groups).
"""

from fastapi import APIRouter, Header, HTTPException

from .config import settings
from .dallas_auth import dallas_student
from .routes import _conversation_owned_by_other, _record_coach_message, coach_answer
from .schemas import CoachChatRequest, CoachChatResponse
from .supabase import shared_admin_client

dallas_coach_router = APIRouter(prefix="/coach")


def ask_dallas_agent(question: str, conversation_id: str | None = None) -> tuple[str, str]:
    """app.foundry.ask_agent with the Dallas agent, imported on first use (cold starts)."""
    from .foundry import ask_agent

    return ask_agent(question, conversation_id, agent_name=settings.foundry_dallas_agent_name)


@dallas_coach_router.post("/chat", response_model=CoachChatResponse)
def dallas_coach_chat(
    payload: CoachChatRequest,
    authorization: str | None = Header(default=None),
) -> CoachChatResponse:
    # Sync route: FastAPI runs it in a threadpool, so the blocking SDK call
    # does not stall the event loop.
    client = shared_admin_client()
    student = dallas_student(client, authorization)
    user_id = str(student["user_id"])
    if payload.conversation_id and _conversation_owned_by_other(
        client, payload.conversation_id, user_id
    ):
        raise HTTPException(status_code=403, detail="This conversation belongs to another user")
    if not settings.dallas_coach_configured:
        raise HTTPException(status_code=503, detail="The coach is not configured")

    answer, conversation_id = coach_answer(
        payload.question, payload.conversation_id, ask_dallas_agent
    )

    _record_coach_message(
        client,
        user_id,
        None,
        conversation_id,
        payload.question,
        answer,
        settings.foundry_dallas_agent_name,
    )
    return CoachChatResponse(answer=answer, conversation_id=conversation_id)
