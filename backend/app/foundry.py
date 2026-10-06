import logging

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

from .config import settings

logger = logging.getLogger(__name__)

# Created once at import. allow_preview is required by azure-ai-projects 2.x
# for get_openai_client(agent_name=...).
project_client = AIProjectClient(
    endpoint=settings.foundry_project_endpoint,
    credential=DefaultAzureCredential(),
    allow_preview=True,
)
agent_client = project_client.get_openai_client(agent_name=settings.foundry_agent_name)


def ask_agent(question: str, conversation_id: str | None = None) -> tuple[str, str]:
    """Send a question to the Foundry agent. Returns (answer, conversation_id)."""
    if not conversation_id:
        conversation_id = agent_client.conversations.create().id

    response = agent_client.responses.create(
        conversation=conversation_id,
        input=question,
    )
    return response.output_text.strip(), conversation_id
