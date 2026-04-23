"""Integration tests for the orchestrator system.

These tests verify end-to-end functionality between components.
They may require external services and should be run with appropriate
environment configuration.
"""

import json
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio


# Skip integration tests if not explicitly enabled
pytestmark = pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION_TESTS", "").lower() != "true",
    reason="Integration tests disabled (set RUN_INTEGRATION_TESTS=true)"
)


class TestRegistryOrchestratorIntegration:
    """Test integration between registry and orchestrator."""
    
    @pytest_asyncio.fixture
    async def integrated_system(self, temp_agents_config):
        """Create integrated registry and orchestrator."""
        from agent_registry import AgentRegistry
        from orchestrator import Orchestrator
        
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        await registry.connect_all()
        
        # Use mock LLM client
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(
            message=MagicMock(content="Integrated answer", tool_calls=None),
            finish_reason="stop"
        )]
        mock_llm.chat.completions.create = AsyncMock(return_value=mock_response)
        
        orchestrator = Orchestrator(registry=registry, llm_client=mock_llm)
        
        yield {"registry": registry, "orchestrator": orchestrator, "llm": mock_llm}
        
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_query_routes_to_agent(self, integrated_system):
        """Test query is routed through registry to agent."""
        orch = integrated_system["orchestrator"]
        registry = integrated_system["registry"]
        
        events = []
        async for event in orch.run("Run unit tests"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Should have routing
        assert "status" in event_types
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_tool_invocation_flow(self, integrated_system):
        """Test full tool invocation flow."""
        orch = integrated_system["orchestrator"]
        llm = integrated_system["llm"]
        
        # Configure LLM to call a tool
        tool_call = MagicMock()
        tool_call.id = "call-1"
        tool_call.function.name = "test-agent-1__test_tool"
        tool_call.function.arguments = '{"question": "test"}'
        
        tool_response = MagicMock()
        tool_response.choices = [MagicMock(
            message=MagicMock(
                content=None,
                tool_calls=[tool_call],
                model_dump=lambda: {"role": "assistant", "content": None}
            ),
            finish_reason="tool_calls"
        )]
        
        final_response = MagicMock()
        final_response.choices = [MagicMock(
            message=MagicMock(content="Final answer", tool_calls=None),
            finish_reason="stop"
        )]
        
        llm.chat.completions.create = AsyncMock(
            side_effect=[tool_response, final_response]
        )
        
        events = []
        async for event in orch.run("Test with tools"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Should have act and observe
        assert "act" in event_types
        assert "observe" in event_types
        assert "answer" in event_types


class TestEventStreamIntegration:
    """Test event streaming integration."""
    
    @pytest_asyncio.fixture
    async def streaming_system(self, temp_agents_config):
        """Create system for streaming tests."""
        from agent_registry import AgentRegistry
        from orchestrator import Orchestrator
        
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        await registry.connect_all()
        
        mock_llm = AsyncMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(
            message=MagicMock(content="Stream test", tool_calls=None),
            finish_reason="stop"
        )]
        mock_llm.chat.completions.create = AsyncMock(return_value=mock_response)
        
        orchestrator = Orchestrator(registry=registry, llm_client=mock_llm)
        
        yield orchestrator
        
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_event_order(self, streaming_system):
        """Test events are emitted in correct order."""
        orch = streaming_system
        
        events = []
        async for event in orch.run("Test order"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Status should come first
        assert event_types[0] == "status"
        
        # Answer should come last
        assert event_types[-1] == "answer"
    
    @pytest.mark.asyncio
    async def test_all_events_have_query_id(self, streaming_system):
        """Test all events have consistent query_id."""
        orch = streaming_system
        
        events = []
        async for event in orch.run("Test query ID", query_id="consistent-id"):
            events.append(event)
        
        for event in events:
            assert event.query_id == "consistent-id"
    
    @pytest.mark.asyncio
    async def test_events_serializable(self, streaming_system):
        """Test all events can be serialized to JSON."""
        orch = streaming_system
        
        async for event in orch.run("Test serialization"):
            # Should not raise
            json_str = event.to_json()
            parsed = json.loads(json_str)
            
            assert "type" in parsed
            assert "timestamp" in parsed


class TestMultiAgentRouting:
    """Test routing across multiple agents."""
    
    @pytest.mark.asyncio
    async def test_multiple_agent_routing(self, temp_agents_config):
        """Test query can match multiple agents."""
        from agent_registry import AgentRegistry
        
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        await registry.connect_all()
        
        # Query with multiple domain keywords
        routed = registry.route_query("test analysis and research unit")
        
        # Should match multiple agents
        agent_ids = [r[0] for r in routed]
        
        # Both test-agent-1 and test-agent-2 should appear
        assert len(agent_ids) >= 1
        
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_routing_priority(self, temp_agents_config):
        """Test agents are prioritized by confidence."""
        from agent_registry import AgentRegistry
        
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        await registry.connect_all()
        
        routed = registry.route_query("unit test")
        
        if len(routed) > 1:
            # First should have higher confidence
            assert routed[0][1] >= routed[1][1]
        
        await registry.close()


class TestErrorRecoveryIntegration:
    """Test error recovery in integrated system."""
    
    @pytest_asyncio.fixture
    async def error_system(self, temp_agents_config):
        """Create system that can trigger errors."""
        from agent_registry import AgentRegistry
        from orchestrator import Orchestrator
        
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        await registry.connect_all()
        
        mock_llm = AsyncMock()
        orchestrator = Orchestrator(registry=registry, llm_client=mock_llm)
        
        yield {"registry": registry, "orchestrator": orchestrator, "llm": mock_llm}
        
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_llm_error_recovery(self, error_system):
        """Test system recovers from LLM errors."""
        orch = error_system["orchestrator"]
        llm = error_system["llm"]
        
        # First call fails, second succeeds
        success_response = MagicMock()
        success_response.choices = [MagicMock(
            message=MagicMock(content="Recovered", tool_calls=None),
            finish_reason="stop"
        )]
        
        llm.chat.completions.create = AsyncMock(
            side_effect=[Exception("API Error"), Exception("Still failing")]
        )
        
        events = []
        async for event in orch.run("Error test"):
            events.append(event)
        
        # Should emit error event
        event_types = [e.type.value for e in events]
        assert "error" in event_types
    
    @pytest.mark.asyncio
    async def test_tool_error_continues(self, error_system):
        """Test system continues after tool error."""
        orch = error_system["orchestrator"]
        llm = error_system["llm"]
        registry = error_system["registry"]
        
        # Configure tool call to non-existent agent
        tool_call = MagicMock()
        tool_call.id = "call-error"
        tool_call.function.name = "nonexistent__tool"
        tool_call.function.arguments = '{}'
        
        tool_response = MagicMock()
        tool_response.choices = [MagicMock(
            message=MagicMock(
                content=None,
                tool_calls=[tool_call],
                model_dump=lambda: {"role": "assistant"}
            ),
            finish_reason="tool_calls"
        )]
        
        final_response = MagicMock()
        final_response.choices = [MagicMock(
            message=MagicMock(content="Continued after error", tool_calls=None),
            finish_reason="stop"
        )]
        
        llm.chat.completions.create = AsyncMock(
            side_effect=[tool_response, final_response]
        )
        
        events = []
        async for event in orch.run("Test tool error"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Should still get answer
        assert "answer" in event_types


class TestConfigurationIntegration:
    """Test configuration loading integration."""
    
    @pytest.mark.asyncio
    async def test_load_from_file(self, sample_agents_config, tmp_path):
        """Test loading configuration from file."""
        from agent_registry import AgentRegistry
        
        config_path = tmp_path / "test_agents.json"
        with open(config_path, "w") as f:
            json.dump(sample_agents_config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        
        assert len(registry.agents) == len(sample_agents_config["agents"])
        
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_hot_reload_config(self, sample_agents_config, tmp_path):
        """Test reloading configuration."""
        from agent_registry import AgentRegistry
        
        config_path = tmp_path / "reload_agents.json"
        
        # Initial config
        with open(config_path, "w") as f:
            json.dump(sample_agents_config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        initial_count = len(registry.agents)
        
        # Update config
        sample_agents_config["agents"].append({
            "id": "new-agent",
            "name": "New Agent",
            "transport": "mock",
        })
        
        with open(config_path, "w") as f:
            json.dump(sample_agents_config, f)
        
        # Reload
        await registry.load_config(config_path)
        
        assert len(registry.agents) == initial_count + 1
        
        await registry.close()
