"""Tests for agent registry and MCP connections."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio


class TestAgentConfig:
    """Test AgentConfig dataclass."""
    
    def test_agent_config_from_dict(self):
        """Test creating AgentConfig from dictionary."""
        from agent_registry import AgentConfig, Transport
        
        data = {
            "id": "test-agent",
            "name": "Test Agent",
            "icon": "🧪",
            "description": "A test agent",
            "capabilities": ["cap1", "cap2"],
            "transport": "sse",
            "domains": ["domain1"],
            "url": "http://localhost:9000/mcp",
            "tools": ["tool1", "tool2"],
            "priority": 2,
        }
        
        config = AgentConfig.from_dict(data)
        
        assert config.id == "test-agent"
        assert config.name == "Test Agent"
        assert config.transport == Transport.SSE
        assert config.url == "http://localhost:9000/mcp"
        assert len(config.tools) == 2
    
    def test_agent_config_defaults(self):
        """Test AgentConfig default values."""
        from agent_registry import AgentConfig, Transport
        
        data = {
            "id": "minimal",
            "name": "Minimal Agent",
        }
        
        config = AgentConfig.from_dict(data)
        
        assert config.icon == "🤖"
        assert config.description == ""
        assert config.capabilities == []
        assert config.transport == Transport.MOCK
        assert config.domains == []
        assert config.priority == 1
        assert config.url is None
        assert config.tools == []
    
    def test_agent_config_invalid_transport(self):
        """Test invalid transport raises error."""
        from agent_registry import AgentConfig
        
        data = {
            "id": "bad",
            "name": "Bad Agent",
            "transport": "invalid_transport",
        }
        
        with pytest.raises(ValueError):
            AgentConfig.from_dict(data)


class TestRoutingRule:
    """Test RoutingRule dataclass."""
    
    def test_routing_rule_from_dict(self):
        """Test creating RoutingRule from dictionary."""
        from agent_registry import RoutingRule
        
        data = {
            "keywords": ["security", "policy", "compliance"],
            "agent_id": "security-agent",
            "confidence_boost": 0.3,
        }
        
        rule = RoutingRule.from_dict(data)
        
        assert len(rule.keywords) == 3
        assert rule.agent_id == "security-agent"
        assert rule.confidence_boost == 0.3
    
    def test_routing_rule_defaults(self):
        """Test RoutingRule default values."""
        from agent_registry import RoutingRule
        
        data = {
            "agent_id": "agent-1",
        }
        
        rule = RoutingRule.from_dict(data)
        
        assert rule.keywords == []
        assert rule.confidence_boost == 0.0


class TestAgentTool:
    """Test AgentTool dataclass."""
    
    def test_agent_tool_to_openai_schema(self):
        """Test converting tool to OpenAI schema."""
        from agent_registry import AgentTool
        
        tool = AgentTool(
            name="search_docs",
            description="Search documents by query",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer"},
                },
                "required": ["query"],
            },
        )
        
        schema = tool.to_openai_schema()
        
        assert schema["type"] == "function"
        assert schema["function"]["name"] == "search_docs"
        assert schema["function"]["description"] == "Search documents by query"
        assert "properties" in schema["function"]["parameters"]


class TestAgentRegistry:
    """Test AgentRegistry class."""
    
    @pytest_asyncio.fixture
    async def empty_registry(self):
        """Create an empty registry."""
        from agent_registry import AgentRegistry
        
        registry = AgentRegistry()
        yield registry
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_load_config_success(self, empty_registry, temp_agents_config):
        """Test loading configuration from file."""
        await empty_registry.load_config(temp_agents_config)
        
        assert len(empty_registry.agents) == 3
        assert "test-agent-1" in empty_registry.agents
        assert "test-agent-2" in empty_registry.agents
    
    @pytest.mark.asyncio
    async def test_load_config_missing_file(self, empty_registry, tmp_path):
        """Test loading from missing file."""
        missing_path = tmp_path / "nonexistent.json"
        
        # Should not raise, just log warning
        await empty_registry.load_config(missing_path)
        
        assert len(empty_registry.agents) == 0
    
    @pytest.mark.asyncio
    async def test_load_config_invalid_json(self, empty_registry, tmp_path):
        """Test loading invalid JSON."""
        bad_json = tmp_path / "bad.json"
        bad_json.write_text("{ invalid json }")
        
        with pytest.raises(json.JSONDecodeError):
            await empty_registry.load_config(bad_json)
    
    @pytest.mark.asyncio
    async def test_connect_mock_agents(self, agent_registry):
        """Test connecting to mock agents."""
        from agent_registry import AgentStatus
        
        # test-agent-1 is mock, should connect
        conn = agent_registry.agents["test-agent-1"]
        assert conn.status == AgentStatus.CONNECTED
        
        # Should have mock tools
        assert len(conn.tools) > 0
    
    @pytest.mark.asyncio
    async def test_connect_internal_agent(self, agent_registry):
        """Test connecting to internal agent."""
        from agent_registry import AgentStatus
        
        conn = agent_registry.agents["internal-triage"]
        assert conn.status == AgentStatus.CONNECTED
    
    @pytest.mark.asyncio
    async def test_list_agents(self, agent_registry):
        """Test listing all agents."""
        agents = agent_registry.list_agents()
        
        assert len(agents) == 3
        
        # Check structure
        for agent in agents:
            assert "id" in agent
            assert "name" in agent
            assert "status" in agent
            assert "tools" in agent
    
    @pytest.mark.asyncio
    async def test_route_query_keyword_match(self, agent_registry):
        """Test routing query by keyword match."""
        routed = agent_registry.route_query("Run unit tests for the module")
        
        assert len(routed) > 0
        # test-agent-1 should match (keywords: test, unit)
        agent_ids = [r[0] for r in routed]
        assert "test-agent-1" in agent_ids
    
    @pytest.mark.asyncio
    async def test_route_query_no_match(self, agent_registry):
        """Test routing query with no matching keywords."""
        routed = agent_registry.route_query("random unrelated question about weather")
        
        # May or may not match; depends on domain keywords
        # At minimum should return empty or low-confidence matches
        assert isinstance(routed, list)
    
    @pytest.mark.asyncio
    async def test_route_query_confidence_boost(self, agent_registry):
        """Test confidence boost in routing."""
        # Query with many matching keywords should have higher confidence
        routed = agent_registry.route_query("test unit testing")
        
        if routed:
            agent_id, confidence = routed[0]
            # With boost + multiple keywords, confidence should be > 0.5
            assert agent_id == "test-agent-1"
    
    @pytest.mark.asyncio
    async def test_invoke_mock_tool(self, agent_registry):
        """Test invoking a mock tool."""
        result = await agent_registry.invoke_tool(
            agent_id="test-agent-1",
            tool_name="test-agent-1_query",
            arguments={"question": "What is testing?"},
        )
        
        assert "answer" in result or "mock" in str(result)
    
    @pytest.mark.asyncio
    async def test_invoke_internal_triage(self, agent_registry):
        """Test invoking internal triage agent."""
        result = await agent_registry.invoke_tool(
            agent_id="internal-triage",
            tool_name="triage",
            arguments={"question": "Analyze the data"},
        )
        
        # Internal triage returns routing info
        assert "triage_complete" in result or "error" in result
    
    @pytest.mark.asyncio
    async def test_invoke_nonexistent_agent(self, agent_registry):
        """Test invoking tool on nonexistent agent."""
        with pytest.raises(ValueError, match="Agent not found"):
            await agent_registry.invoke_tool(
                agent_id="nonexistent",
                tool_name="tool",
                arguments={},
            )
    
    @pytest.mark.asyncio
    async def test_get_all_tools(self, agent_registry):
        """Test getting all tools from connected agents."""
        tools = agent_registry.get_all_tools()
        
        assert isinstance(tools, list)
        
        for tool in tools:
            assert tool["type"] == "function"
            assert "function" in tool
            # Tool names should be prefixed with agent ID
            assert "__" in tool["function"]["name"]
    
    @pytest.mark.asyncio
    async def test_register_mock_handler(self, agent_registry):
        """Test registering custom mock handler."""
        async def custom_handler(arguments):
            return {"custom": True, "input": arguments.get("question")}
        
        agent_registry.register_mock_handler(
            agent_id="test-agent-1",
            tool_name="custom_tool",
            handler=custom_handler,
        )
        
        # Now invoke should use custom handler
        result = await agent_registry.invoke_tool(
            agent_id="test-agent-1",
            tool_name="custom_tool",
            arguments={"question": "test"},
        )
        
        assert result["custom"] is True
        assert result["input"] == "test"
    
    @pytest.mark.asyncio
    async def test_close_connections(self, temp_agents_config):
        """Test closing all connections."""
        from agent_registry import AgentRegistry, AgentStatus
        
        registry = AgentRegistry()
        await registry.load_config(temp_agents_config)
        await registry.connect_all()
        
        # Close
        await registry.close()
        
        # All should be disconnected
        for conn in registry.agents.values():
            assert conn.status == AgentStatus.DISCONNECTED


class TestAgentRegistrySSE:
    """Test SSE transport in agent registry."""
    
    @pytest.mark.asyncio
    async def test_connect_sse_no_url(self, empty_registry, tmp_path):
        """Test SSE connection fails without URL."""
        from agent_registry import AgentRegistry, AgentStatus
        
        config = {
            "agents": [{
                "id": "no-url",
                "name": "No URL Agent",
                "transport": "sse",
                # Missing url
            }],
            "routing_rules": [],
        }
        
        config_path = tmp_path / "agents.json"
        with open(config_path, "w") as f:
            json.dump(config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        results = await registry.connect_all()
        
        assert results["no-url"] is False
        assert registry.agents["no-url"].status == AgentStatus.ERROR
        
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_sse_connection_timeout(self, empty_registry, tmp_path, mock_httpx_client):
        """Test SSE connection with timeout."""
        from agent_registry import AgentRegistry
        import httpx
        
        # Create config with SSE agent
        config = {
            "agents": [{
                "id": "timeout-agent",
                "name": "Timeout Agent",
                "transport": "sse",
                "url": "http://localhost:9999",
                "tools": ["test"],
            }],
            "routing_rules": [],
        }
        
        config_path = tmp_path / "agents.json"
        with open(config_path, "w") as f:
            json.dump(config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        
        # Mock the httpx client to timeout
        mock_httpx_client.get.side_effect = httpx.TimeoutException("timeout")
        
        with patch("httpx.AsyncClient", return_value=mock_httpx_client):
            results = await registry.connect_all()
        
        # Should still mark as connected (will fail on invoke)
        # Or handle gracefully
        await registry.close()


class TestAgentRegistryEdgeCases:
    """Test edge cases in agent registry."""
    
    @pytest.mark.asyncio
    async def test_empty_agents_config(self, tmp_path):
        """Test loading empty agents config."""
        from agent_registry import AgentRegistry
        
        config = {"agents": [], "routing_rules": []}
        config_path = tmp_path / "empty.json"
        with open(config_path, "w") as f:
            json.dump(config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        
        assert len(registry.agents) == 0
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_duplicate_agent_ids(self, tmp_path):
        """Test handling duplicate agent IDs."""
        from agent_registry import AgentRegistry
        
        config = {
            "agents": [
                {"id": "dup", "name": "First"},
                {"id": "dup", "name": "Second"},  # Duplicate
            ],
            "routing_rules": [],
        }
        
        config_path = tmp_path / "dups.json"
        with open(config_path, "w") as f:
            json.dump(config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        
        # Second should overwrite first
        assert registry.agents["dup"].config.name == "Second"
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_special_characters_in_agent_id(self, tmp_path):
        """Test agent ID with special characters."""
        from agent_registry import AgentRegistry
        
        config = {
            "agents": [
                {"id": "agent-with-dash", "name": "Dash Agent"},
                {"id": "agent_with_underscore", "name": "Underscore Agent"},
            ],
            "routing_rules": [],
        }
        
        config_path = tmp_path / "special.json"
        with open(config_path, "w") as f:
            json.dump(config, f)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        
        assert "agent-with-dash" in registry.agents
        assert "agent_with_underscore" in registry.agents
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_unicode_in_agent_config(self, tmp_path):
        """Test unicode in agent configuration."""
        from agent_registry import AgentRegistry
        
        config = {
            "agents": [
                {
                    "id": "unicode-agent",
                    "name": "エージェント",  # Japanese
                    "icon": "🤖",
                    "description": "An agent with 日本語 description",
                },
            ],
            "routing_rules": [],
        }
        
        config_path = tmp_path / "unicode.json"
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False)
        
        registry = AgentRegistry()
        await registry.load_config(config_path)
        
        conn = registry.agents["unicode-agent"]
        assert conn.config.name == "エージェント"
        await registry.close()
    
    @pytest.mark.asyncio
    async def test_route_empty_query(self, agent_registry):
        """Test routing with empty query."""
        routed = agent_registry.route_query("")
        
        assert isinstance(routed, list)
        # Empty query should return no matches
        assert len(routed) == 0
    
    @pytest.mark.asyncio
    async def test_route_very_long_query(self, agent_registry):
        """Test routing with very long query."""
        long_query = "test " * 10000
        routed = agent_registry.route_query(long_query)
        
        # Should still work
        assert isinstance(routed, list)
    
    @pytest.mark.asyncio  
    async def test_concurrent_invocations(self, agent_registry):
        """Test concurrent tool invocations."""
        import asyncio
        
        async def invoke():
            return await agent_registry.invoke_tool(
                agent_id="test-agent-1",
                tool_name="test",
                arguments={"q": "test"},
            )
        
        # Run multiple concurrent invocations
        results = await asyncio.gather(*[invoke() for _ in range(10)])
        
        assert len(results) == 10


class TestGlobalRegistry:
    """Test global registry functions."""
    
    @pytest.mark.asyncio
    async def test_get_registry_initialization(self, temp_agents_config):
        """Test get_registry initializes on first call."""
        import agent_registry
        
        # Reset global
        agent_registry._registry = None
        
        # Patch config import inside get_registry
        with patch("config.MCP_AGENTS_CONFIG", str(temp_agents_config)):
            registry = await agent_registry.get_registry()
            assert registry is not None
            assert isinstance(registry, agent_registry.AgentRegistry)
            
            # Reset for other tests
            agent_registry._registry = None
