"""Pytest fixtures and configuration for backend tests."""

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))


# ---------------------------------------------------------------------------
# Environment Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Set up mock environment variables for testing."""
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-api-key")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://test.openai.azure.com/")
    monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-02-01")
    monkeypatch.setenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-4o-test")
    monkeypatch.setenv("API_HOST", "127.0.0.1")
    monkeypatch.setenv("API_PORT", "8080")
    monkeypatch.setenv("ORCHESTRATOR_MAX_TURNS", "5")
    monkeypatch.setenv("ORCHESTRATOR_TIMEOUT_MS", "30000")
    monkeypatch.setenv("FRONTEND_URLS", "http://localhost:3000")


# ---------------------------------------------------------------------------
# Agent Configuration Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_agents_config():
    """Sample agents.json configuration."""
    return {
        "agents": [
            {
                "id": "test-agent-1",
                "name": "Test Agent 1",
                "icon": "🧪",
                "description": "A test agent for unit testing",
                "capabilities": ["testing", "validation"],
                "transport": "mock",
                "domains": ["test", "unit"],
                "tools": ["test_tool"],
                "priority": 1,
            },
            {
                "id": "test-agent-2",
                "name": "Test Agent 2",
                "icon": "🔬",
                "description": "Another test agent",
                "capabilities": ["analysis"],
                "transport": "sse",
                "url": "http://localhost:9000/mcp",
                "domains": ["analysis", "research"],
                "tools": ["analyze_data"],
                "priority": 2,
            },
            {
                "id": "internal-triage",
                "name": "Triage",
                "icon": "🔀",
                "description": "Internal routing agent",
                "capabilities": ["routing"],
                "transport": "internal",
                "domains": ["routing"],
                "tools": [],
                "priority": 0,
            },
        ],
        "routing_rules": [
            {
                "keywords": ["test", "unit", "testing"],
                "agent_id": "test-agent-1",
                "confidence_boost": 0.2,
            },
            {
                "keywords": ["analyze", "analysis", "research"],
                "agent_id": "test-agent-2",
                "confidence_boost": 0.1,
            },
        ],
    }


@pytest.fixture
def temp_agents_config(sample_agents_config, tmp_path):
    """Create a temporary agents.json file."""
    config_path = tmp_path / "agents.json"
    with open(config_path, "w") as f:
        json.dump(sample_agents_config, f)
    return config_path


# ---------------------------------------------------------------------------
# Registry Fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def agent_registry(temp_agents_config):
    """Create and initialize an agent registry."""
    from agent_registry import AgentRegistry
    
    registry = AgentRegistry()
    await registry.load_config(temp_agents_config)
    await registry.connect_all()
    
    yield registry
    
    await registry.close()


@pytest_asyncio.fixture
async def empty_registry():
    """Create an empty registry without loading config."""
    from agent_registry import AgentRegistry
    
    registry = AgentRegistry()
    yield registry
    await registry.close()


# ---------------------------------------------------------------------------
# Mock LLM Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_openai_response():
    """Mock OpenAI chat completion response."""
    def _create_response(content: str = "Test response", tool_calls: list | None = None):
        message = MagicMock()
        message.content = content
        message.tool_calls = tool_calls
        message.model_dump.return_value = {"content": content, "role": "assistant"}
        
        choice = MagicMock()
        choice.message = message
        choice.finish_reason = "stop" if not tool_calls else "tool_calls"
        
        response = MagicMock()
        response.choices = [choice]
        
        return response
    
    return _create_response


@pytest.fixture
def mock_tool_call():
    """Create a mock tool call object."""
    def _create(tool_name: str, arguments: dict):
        call = MagicMock()
        call.id = f"call_{tool_name}"
        call.function.name = tool_name
        call.function.arguments = json.dumps(arguments)
        return call
    
    return _create


@pytest.fixture
def mock_llm_client(mock_openai_response):
    """Create a mock Azure OpenAI client."""
    client = AsyncMock()
    client.chat.completions.create = AsyncMock(
        return_value=mock_openai_response("Test response")
    )
    return client


# ---------------------------------------------------------------------------
# HTTP Client Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_httpx_client():
    """Create a mock httpx async client."""
    client = AsyncMock()
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "result": {
            "content": [{"type": "text", "text": '{"answer": "test"}'}]
        }
    }
    client.get = AsyncMock(return_value=response)
    client.post = AsyncMock(return_value=response)
    client.aclose = AsyncMock()
    return client


# ---------------------------------------------------------------------------
# FastAPI Test Client Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def test_app():
    """Create a test FastAPI app with mocked dependencies."""
    from fastapi.testclient import TestClient
    from main import app
    
    return app


@pytest.fixture
def test_client(test_app):
    """Create a test client for the FastAPI app."""
    from fastapi.testclient import TestClient
    
    with TestClient(test_app) as client:
        yield client


# ---------------------------------------------------------------------------
# Event Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_events():
    """Sample events for testing."""
    from events import (
        think_event, act_event, observe_event,
        delegate_event, answer_event, error_event, status_event,
    )
    
    query_id = "test-query-123"
    
    return {
        "think": think_event(
            query_id=query_id,
            reasoning="Analyzing the query...",
            plan=["Step 1", "Step 2"],
            step=1,
            total_steps=3,
        ),
        "act": act_event(
            query_id=query_id,
            tool_name="test_tool",
            tool_arguments={"question": "test?"},
            agent_id="test-agent-1",
            step=1,
        ),
        "observe": observe_event(
            query_id=query_id,
            tool_name="test_tool",
            result_preview="Tool result...",
            success=True,
            duration_ms=100,
            step=1,
        ),
        "delegate": delegate_event(
            query_id=query_id,
            from_agent="orchestrator",
            to_agent="test-agent-1",
            to_agent_name="Test Agent 1",
            confidence=0.9,
            reason="Query matches test domain",
        ),
        "answer": answer_event(
            query_id=query_id,
            answer="This is the answer.",
            confidence=0.85,
            grounded=True,
            sources=[{"source": "doc1.pdf", "page": 5}],
            tool_calls=[{"tool": "test_tool", "success": True}],
            duration_ms=1500,
            agent_id="test-agent-1",
            out_of_domain=False,
        ),
        "error": error_event(
            query_id=query_id,
            error="Something went wrong",
            error_type="test_error",
            recoverable=True,
            step=2,
        ),
        "status": status_event(
            query_id=query_id,
            status="processing",
            message="Working on it...",
            progress=0.5,
            agents_active=["test-agent-1"],
        ),
    }


# ---------------------------------------------------------------------------
# Query Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_queries():
    """Sample test queries with expected routing."""
    return [
        {
            "query": "Run unit tests for the module",
            "expected_agent": "test-agent-1",
            "expected_keywords": ["unit", "test"],
        },
        {
            "query": "Analyze the research data",
            "expected_agent": "test-agent-2",
            "expected_keywords": ["analyze", "research"],
        },
        {
            "query": "Random unrelated question",
            "expected_agent": None,  # No matching agent
            "expected_keywords": [],
        },
    ]
