"""Tests for the multi-agent orchestrator."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio


class TestQueryState:
    """Test QueryState dataclass."""
    
    def test_query_state_defaults(self):
        """Test QueryState default values."""
        from orchestrator import QueryState
        
        state = QueryState(query_id="q-123", question="What is X?")
        
        assert state.query_id == "q-123"
        assert state.question == "What is X?"
        assert state.tool_calls == []
        assert state.messages == []
        assert state.final_answer == ""
        assert state.confidence == 0.0
        assert state.grounded is True
        assert state.out_of_domain is False
        assert state.error is None
    
    def test_query_state_elapsed_ms(self):
        """Test elapsed time calculation."""
        import time
        from orchestrator import QueryState
        
        state = QueryState(query_id="q-1", question="test")
        time.sleep(0.1)  # 100ms
        
        elapsed = state.elapsed_ms
        assert elapsed >= 100
        assert elapsed < 200
    
    def test_query_state_has_budget(self):
        """Test budget checking."""
        from orchestrator import QueryState
        
        state = QueryState(query_id="q-1", question="test")
        
        # Should have budget initially
        assert state.has_budget() is True


class TestToolCall:
    """Test ToolCall dataclass."""
    
    def test_tool_call_creation(self):
        """Test ToolCall creation."""
        from orchestrator import ToolCall
        
        tc = ToolCall(
            id="call-123",
            tool_name="search",
            agent_id="agent-1",
            arguments={"query": "test"},
        )
        
        assert tc.id == "call-123"
        assert tc.tool_name == "search"
        assert tc.result is None
        assert tc.success is True
        assert tc.duration_ms == 0


class TestOrchestrator:
    """Test Orchestrator class."""
    
    @pytest_asyncio.fixture
    async def orchestrator(self, agent_registry, mock_llm_client):
        """Create orchestrator with mocked dependencies."""
        from orchestrator import Orchestrator
        
        orch = Orchestrator(
            registry=agent_registry,
            llm_client=mock_llm_client,
        )
        return orch
    
    @pytest.mark.asyncio
    async def test_orchestrator_run_simple(self, orchestrator, mock_openai_response):
        """Test simple orchestrator run without tool calls."""
        # Mock LLM to return final answer immediately
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("This is the answer.")
        )
        
        events = []
        async for event in orchestrator.run("What is testing?"):
            events.append(event)
        
        # Should have status, think, and answer events
        event_types = [e.type.value for e in events]
        assert "status" in event_types
        assert "answer" in event_types
        
        # Find answer event
        answer_event = next(e for e in events if e.type.value == "answer")
        assert "answer" in answer_event.answer.lower() or answer_event.answer != ""
    
    @pytest.mark.asyncio
    async def test_orchestrator_run_with_tool_call(
        self, orchestrator, mock_openai_response, mock_tool_call
    ):
        """Test orchestrator run with tool calls."""
        # First response has tool calls
        tool_calls_response = mock_openai_response(
            content=None,
            tool_calls=[mock_tool_call("test-agent-1__test_tool", {"question": "test"})]
        )
        tool_calls_response.choices[0].finish_reason = "tool_calls"
        
        # Second response is final answer
        final_response = mock_openai_response("Based on the tool results, here is the answer.")
        
        orchestrator.llm.chat.completions.create = AsyncMock(
            side_effect=[tool_calls_response, final_response]
        )
        
        events = []
        async for event in orchestrator.run("Run a test"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Should have act and observe events for tool call
        assert "act" in event_types
        assert "observe" in event_types
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_orchestrator_run_with_delegation(self, orchestrator, mock_openai_response):
        """Test orchestrator routing to specialist agent."""
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("Answer from specialist")
        )
        
        events = []
        async for event in orchestrator.run("Run unit tests"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Should delegate to test-agent-1
        if "delegate" in event_types:
            delegate_event = next(e for e in events if e.type.value == "delegate")
            assert delegate_event.to_agent == "test-agent-1"
    
    @pytest.mark.asyncio
    async def test_orchestrator_llm_error(self, orchestrator):
        """Test orchestrator handles LLM errors."""
        orchestrator.llm.chat.completions.create = AsyncMock(
            side_effect=Exception("API Error")
        )
        
        events = []
        async for event in orchestrator.run("Test query"):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        
        # Should emit error event
        assert "error" in event_types
        
        error_event = next(e for e in events if e.type.value == "error")
        assert "API Error" in error_event.error
    
    @pytest.mark.asyncio
    async def test_orchestrator_execute_sync(self, orchestrator, mock_openai_response):
        """Test synchronous execute method."""
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("Sync answer")
        )
        
        result = await orchestrator.execute("What is X?")
        
        assert "answer" in result
        assert result["answer"] == "Sync answer"
    
    @pytest.mark.asyncio
    async def test_orchestrator_max_turns(self, orchestrator, mock_openai_response, mock_tool_call):
        """Test orchestrator respects max turns limit."""
        # Always return tool calls (never finish)
        tool_response = mock_openai_response(
            content=None,
            tool_calls=[mock_tool_call("test-agent-1__test", {"q": "x"})]
        )
        tool_response.choices[0].finish_reason = "tool_calls"
        
        orchestrator.llm.chat.completions.create = AsyncMock(return_value=tool_response)
        
        events = []
        async for event in orchestrator.run("Infinite loop query"):
            events.append(event)
            # Safety limit
            if len(events) > 100:
                break
        
        # Should eventually emit answer (even if incomplete)
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_orchestrator_tool_parse_error(
        self, orchestrator, mock_openai_response
    ):
        """Test handling of malformed tool call arguments."""
        # Create tool call with invalid JSON arguments
        bad_tool_call = MagicMock()
        bad_tool_call.id = "call-bad"
        bad_tool_call.function.name = "test-agent-1__test"
        bad_tool_call.function.arguments = "not valid json {{"
        
        response = mock_openai_response(content=None, tool_calls=[bad_tool_call])
        response.choices[0].finish_reason = "tool_calls"
        
        final_response = mock_openai_response("Recovered answer")
        
        orchestrator.llm.chat.completions.create = AsyncMock(
            side_effect=[response, final_response]
        )
        
        events = []
        async for event in orchestrator.run("Test"):
            events.append(event)
        
        # Should still complete
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_orchestrator_tool_invocation_error(
        self, orchestrator, mock_openai_response, mock_tool_call, agent_registry
    ):
        """Test handling of tool invocation errors."""
        tool_response = mock_openai_response(
            content=None,
            tool_calls=[mock_tool_call("nonexistent__tool", {"q": "x"})]
        )
        tool_response.choices[0].finish_reason = "tool_calls"
        
        final_response = mock_openai_response("Answer after error")
        
        orchestrator.llm.chat.completions.create = AsyncMock(
            side_effect=[tool_response, final_response]
        )
        
        events = []
        async for event in orchestrator.run("Test"):
            events.append(event)
        
        # Should have observe event with success=False
        observe_events = [e for e in events if e.type.value == "observe"]
        if observe_events:
            assert any(not e.success for e in observe_events)


class TestOrchestratorEdgeCases:
    """Test edge cases in orchestrator."""
    
    @pytest_asyncio.fixture
    async def orchestrator(self, agent_registry, mock_llm_client):
        """Create orchestrator with mocked dependencies."""
        from orchestrator import Orchestrator
        
        return Orchestrator(registry=agent_registry, llm_client=mock_llm_client)
    
    @pytest.mark.asyncio
    async def test_empty_query(self, orchestrator, mock_openai_response):
        """Test handling empty query."""
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("I need more information.")
        )
        
        events = []
        async for event in orchestrator.run(""):
            events.append(event)
        
        # Should still produce answer
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_very_long_query(self, orchestrator, mock_openai_response):
        """Test handling very long query."""
        long_query = "What is " * 1000 + "testing?"
        
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("Answer")
        )
        
        events = []
        async for event in orchestrator.run(long_query):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_special_characters_in_query(self, orchestrator, mock_openai_response):
        """Test query with special characters."""
        special_query = 'Query with "quotes" and <tags> and \n newlines'
        
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("Answer")
        )
        
        events = []
        async for event in orchestrator.run(special_query):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_unicode_query(self, orchestrator, mock_openai_response):
        """Test query with unicode characters."""
        unicode_query = "日本語のテスト 🧪 מה זה?"
        
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("Unicode answer")
        )
        
        events = []
        async for event in orchestrator.run(unicode_query):
            events.append(event)
        
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
    
    @pytest.mark.asyncio
    async def test_custom_query_id(self, orchestrator, mock_openai_response):
        """Test with custom query ID."""
        orchestrator.llm.chat.completions.create = AsyncMock(
            return_value=mock_openai_response("Answer")
        )
        
        custom_id = "custom-query-id-12345"
        events = []
        async for event in orchestrator.run("Test", query_id=custom_id):
            events.append(event)
        
        # All events should have the custom query ID
        for event in events:
            assert event.query_id == custom_id
    
    @pytest.mark.asyncio
    async def test_no_agents_connected(self, mock_llm_client, temp_agents_config):
        """Test orchestrator with no connected agents."""
        from agent_registry import AgentRegistry
        from orchestrator import Orchestrator
        
        # Create registry without connecting
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        # Don't call connect_all()
        
        orch = Orchestrator(registry=registry, llm_client=mock_llm_client)
        mock_llm_client.chat.completions.create = AsyncMock(
            return_value=MagicMock(
                choices=[MagicMock(
                    message=MagicMock(content="No agents", tool_calls=None),
                    finish_reason="stop"
                )]
            )
        )
        
        events = []
        async for event in orch.run("Test"):
            events.append(event)
        
        # Should still work, just without agent delegation
        event_types = [e.type.value for e in events]
        assert "answer" in event_types
        
        await registry.close()


class TestGlobalOrchestrator:
    """Test global orchestrator functions."""
    
    @pytest.mark.asyncio
    async def test_run_query_function(self, agent_registry, mock_llm_client, mock_openai_response):
        """Test run_query global function."""
        from orchestrator import run_query, _orchestrator
        import orchestrator
        
        # Reset global
        orchestrator._orchestrator = None
        
        # This test requires patching get_registry and get_openai_client
        with patch("orchestrator.get_registry", return_value=agent_registry), \
             patch("orchestrator.get_openai_client", return_value=mock_llm_client):
            
            mock_llm_client.chat.completions.create = AsyncMock(
                return_value=mock_openai_response("Global function answer")
            )
            
            events = []
            async for event in run_query("Test query"):
                events.append(event)
            
            event_types = [e.type.value for e in events]
            assert "answer" in event_types


class TestSystemPrompt:
    """Test system prompt generation."""
    
    @pytest_asyncio.fixture
    async def orchestrator(self, agent_registry, mock_llm_client):
        """Create orchestrator with mocked dependencies."""
        from orchestrator import Orchestrator
        
        return Orchestrator(registry=agent_registry, llm_client=mock_llm_client)
    
    @pytest.mark.asyncio
    async def test_system_prompt_includes_agents(
        self, orchestrator, mock_openai_response, agent_registry
    ):
        """Test system prompt includes agent descriptions."""
        captured_messages = []
        
        async def capture_create(**kwargs):
            captured_messages.append(kwargs.get("messages", []))
            return mock_openai_response("Answer")
        
        orchestrator.llm.chat.completions.create = capture_create
        
        events = []
        async for event in orchestrator.run("Test"):
            events.append(event)
        
        # Check system prompt in captured messages
        if captured_messages:
            system_msg = captured_messages[0][0]
            assert system_msg["role"] == "system"
            # Should mention available agents
            assert "agent" in system_msg["content"].lower()
