import logging
from functools import cache

from azure.ai.projects import AIProjectClient

from .azure_auth import azure_credential
from .config import settings

logger = logging.getLogger(__name__)


@cache
def _agent_client(agent_name: str):
    """Created on the first call per agent, so the API starts without Foundry settings.

    allow_preview is required by azure-ai-projects 2.x for get_openai_client(agent_name=...).
    """
    project_client = AIProjectClient(
        endpoint=settings.foundry_project_endpoint,
        credential=azure_credential(),
        allow_preview=True,
    )
    return project_client.get_openai_client(agent_name=agent_name)


def ask_agent(
    question: str,
    conversation_id: str | None = None,
    agent_name: str | None = None,
) -> tuple[str, str]:
    """Send a question to a Foundry agent (default: the New York coach).

    Returns (answer, conversation_id).
    """
    agent_client = _agent_client(agent_name or settings.foundry_agent_name)
    if not conversation_id:
        conversation_id = agent_client.conversations.create().id

    response = agent_client.responses.create(
        conversation=conversation_id,
        input=question,
    )
    return response.output_text.strip(), conversation_id
