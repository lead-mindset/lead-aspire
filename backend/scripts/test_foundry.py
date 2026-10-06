"""Smoke test for the Foundry agent. Run from backend/:

    .venv\\Scripts\\python.exe scripts\\test_foundry.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.foundry import ask_agent  # noqa: E402

print(f"Agent: {settings.foundry_agent_name}")

answer, conversation_id = ask_agent("Say hello")
print(f"Conversation: {conversation_id}")
print(f"Reply 1: {answer}\n")

answer, _ = ask_agent("What did I just ask you to do?", conversation_id)
print(f"Reply 2: {answer}")
