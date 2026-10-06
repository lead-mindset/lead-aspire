import logging
from functools import cache

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

from .config import settings

logger = logging.getLogger(__name__)


@cache
def _agent_client():
    """Created on the first coach call, so the API starts without Foundry settings.

    allow_preview is required by azure-ai-projects 2.x for get_openai_client(agent_name=...).
    """
    project_client = AIProjectClient(
        endpoint=settings.foundry_project_endpoint,
        credential=DefaultAzureCredential(),
        allow_preview=True,
    )
    return project_client.get_openai_client(agent_name=settings.foundry_agent_name)


def ask_agent(question: str, conversation_id: str | None = None) -> tuple[str, str]:
    """Send a question to the Foundry agent. Returns (answer, conversation_id)."""
    agent_client = _agent_client()
    if not conversation_id:
        conversation_id = agent_client.conversations.create().id

    response = agent_client.responses.create(
        conversation=conversation_id,
        input=question,
    )
    return response.output_text.strip(), conversation_id
