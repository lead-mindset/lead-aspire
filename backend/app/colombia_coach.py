"""Colombia coach: POST /api/colombia/coach/chat.

Same Foundry project and Azure credentials as the New York coach, but its own
agent (FOUNDRY_COLOMBIA_AGENT_NAME) and the Colombia token check. History goes to
aspire_coach_messages with no group (Colombia teams are not aspire_groups).
"""

from fastapi import APIRouter, Header, HTTPException

from .colombia_auth import colombia_student
from .config import settings
from .routes import _conversation_owned_by_other, _record_coach_message, coach_answer
from .schemas import CoachChatRequest, CoachChatResponse
from .supabase import shared_admin_client

colombia_coach_router = APIRouter(prefix="/coach")


def ask_colombia_agent(question: str, conversation_id: str | None = None) -> tuple[str, str]:
    """app.foundry.ask_agent with the Colombia agent, imported on first use (cold starts)."""
    from .foundry import ask_agent

    return ask_agent(question, conversation_id, agent_name=settings.foundry_colombia_agent_name)


@colombia_coach_router.post("/chat", response_model=CoachChatResponse)
def colombia_coach_chat(
    payload: CoachChatRequest,
    authorization: str | None = Header(default=None),
) -> CoachChatResponse:
    # Sync route: FastAPI runs it in a threadpool, so the blocking SDK call
    # does not stall the event loop.
    client = shared_admin_client()
    student = colombia_student(client, authorization)
    user_id = str(student["user_id"])
    if payload.conversation_id and _conversation_owned_by_other(
        client, payload.conversation_id, user_id
    ):
        raise HTTPException(status_code=403, detail="This conversation belongs to another user")
    if not settings.colombia_coach_configured:
        raise HTTPException(status_code=503, detail="The coach is not configured")

    answer, conversation_id = coach_answer(
        payload.question, payload.conversation_id, ask_colombia_agent
    )

    _record_coach_message(
        client,
        user_id,
        None,
        conversation_id,
        payload.question,
        answer,
        settings.foundry_colombia_agent_name,
    )
    return CoachChatResponse(answer=answer, conversation_id=conversation_id)
