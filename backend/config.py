"""Configuration for the orchestrator backend.

Environment variables:
    AZURE_OPENAI_API_KEY: Azure OpenAI API key
    AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint URL
    AZURE_OPENAI_API_VERSION: API version (default: 2024-02-01)
    AZURE_OPENAI_CHAT_DEPLOYMENT: Deployment name for chat model

    MCP_AGENTS_CONFIG: Path to agents.json config file (default: agents.json)
    CYBERAGENT_URL: Full URL to CyberAgent MCP endpoint (default in agents.json)
    API_PORT: Port to run on (default: 8080)

    KNOWLEDGE_REFRESH_INTERVAL_MINUTES: How often to refresh live routing
        knowledge from connected agents (default: 30 minutes)
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ---------------------------------------------------------------------------
# Azure OpenAI Configuration
# ---------------------------------------------------------------------------
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")
AZURE_OPENAI_CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o")

# ---------------------------------------------------------------------------
# MCP Agents Configuration
# ---------------------------------------------------------------------------
MCP_AGENTS_CONFIG = os.getenv(
    "MCP_AGENTS_CONFIG",
    str(Path(__file__).parent / "agents.json"),
)

MCP_CYBERAGENT_URL: str = os.getenv(
    "MCP_CYBERAGENT_URL",
    "https://ca-rbin-bdo-cyberagent.internal/mcp",
)

# MCP authentication keys for individual agents
# (agents.json uses key_env to reference these by name)
CYBERAGENT_MCP_KEY: str = os.getenv("CYBERAGENT_MCP_KEY", "")

# ---------------------------------------------------------------------------
# Server Configuration
# ---------------------------------------------------------------------------
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8080"))
FRONTEND_URLS = os.getenv(
    "FRONTEND_URLS",
    "http://localhost:5173,http://localhost:3000,http://localhost:5174",
).split(",")

# ---------------------------------------------------------------------------
# Orchestrator Settings
# ---------------------------------------------------------------------------
ORCHESTRATOR_MAX_TURNS = int(os.getenv("ORCHESTRATOR_MAX_TURNS", "10"))
ORCHESTRATOR_TIMEOUT_MS = int(os.getenv("ORCHESTRATOR_TIMEOUT_MS", "120000"))

# How frequently (in minutes) the background task re-fetches routing knowledge
# from connected agents (e.g. CyberAgent's cyber_capabilities).
# Set to 0 to disable background refresh (knowledge fetched at startup only).
KNOWLEDGE_REFRESH_INTERVAL_MINUTES = int(
    os.getenv("KNOWLEDGE_REFRESH_INTERVAL_MINUTES", "30")
)

# Legacy config dict for backwards compatibility
ORCHESTRATOR_CONFIG = {
    "max_iterations": ORCHESTRATOR_MAX_TURNS,
    "time_budget_seconds": ORCHESTRATOR_TIMEOUT_MS // 1000,
    "max_parallel_agents": 3,
    "default_timeout": 60.0,
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


def validate_config() -> None:
    """Validate that required configuration is present."""
    errors = []

    if not AZURE_OPENAI_API_KEY:
        errors.append("AZURE_OPENAI_API_KEY is required")

    if not AZURE_OPENAI_ENDPOINT:
        errors.append("AZURE_OPENAI_ENDPOINT is required")

    if errors:
        raise RuntimeError(f"Configuration errors: {'; '.join(errors)}")
