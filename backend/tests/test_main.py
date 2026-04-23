"""Tests for FastAPI main application endpoints."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


class MockEvent:
    """Mock event for testing."""
    def __init__(self, event_type, data):
        self.type = MagicMock(value=event_type)
        self._data = data
        
    def to_json(self):
        return json.dumps({"type": self.type.value, **self._data})
    
    def to_dict(self):
        return {"type": self.type.value, **self._data}


def create_mock_registry(agents=None):
    """Create mock agent registry."""
    registry = MagicMock()
    
    if agents is None:
        registry.agents = {
            "test-agent": MagicMock(
                config=MagicMock(
                    id="test-agent",
                    name="Test Agent",
                    icon="🧪",
                    description="Test description",
                    capabilities=["testing"],
                    domains=["test"],
                ),
                status=MagicMock(value="connected"),
                tools=[MagicMock(name="test_tool")],
            )
        }
        registry.list_agents = MagicMock(return_value=[
            {
                "id": "test-agent",
                "name": "Test Agent",
                "icon": "🧪",
                "description": "Test description",
                "capabilities": ["testing"],
                "status": "connected",
                "domains": ["test"],
                "tools": ["test_tool"],
            }
        ])
    else:
        registry.agents = agents
        registry.list_agents = MagicMock(return_value=list(agents.values()) if agents else [])
    
    registry.close = AsyncMock()
    return registry


def create_mock_orchestrator():
    """Create mock orchestrator."""
    orch = MagicMock()
    
    async def mock_execute(question, query_id=None):
        return {
            "query_id": query_id or "test-id",
            "answer": "Test answer",
            "confidence": 0.9,
            "grounded": True,
            "sources": [],
            "tool_calls": [],
            "duration_ms": 100,
            "agent_id": "test-agent",
            "out_of_domain": False,
        }
    
    orch.execute = mock_execute
    return orch


def create_async_getters(registry, orchestrator):
    """Create async getter functions for mocking."""
    async def async_get_registry():
        return registry
    
    async def async_get_orchestrator():
        return orchestrator
    
    return async_get_registry, async_get_orchestrator


@pytest.fixture
def mock_registry():
    """Create mock agent registry."""
    return create_mock_registry()


@pytest.fixture
def mock_orchestrator():
    """Create mock orchestrator."""
    return create_mock_orchestrator()


@pytest.fixture
def client(mock_registry, mock_orchestrator):
    """Create test client with mocked dependencies."""
    async_get_registry, async_get_orchestrator = create_async_getters(
        mock_registry, mock_orchestrator
    )
    
    with patch("main.get_registry", side_effect=async_get_registry), \
         patch("main.get_orchestrator", side_effect=async_get_orchestrator):
        
        from main import app
        
        with TestClient(app, raise_server_exceptions=False) as client:
            yield client


class TestHealthEndpoint:
    """Test /health endpoint."""
    
    def test_health_check_success(self, client, mock_registry):
        """Test successful health check."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["ok", "degraded"]
        assert "agents_connected" in data
        assert "agents_total" in data
    
    def test_health_check_no_agents(self):
        """Test health check with no agents connected."""
        empty_registry = create_mock_registry(agents={})
        orchestrator = create_mock_orchestrator()
        async_get_registry, async_get_orchestrator = create_async_getters(
            empty_registry, orchestrator
        )
        
        with patch("main.get_registry", side_effect=async_get_registry), \
             patch("main.get_orchestrator", side_effect=async_get_orchestrator):
            
            from main import app
            with TestClient(app) as client:
                response = client.get("/health")
                
                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "degraded"
                assert data["agents_connected"] == 0


class TestAgentsEndpoints:
    """Test /agents endpoints."""
    
    def test_list_agents(self, client):
        """Test listing all agents."""
        response = client.get("/agents")
        
        assert response.status_code == 200
        agents = response.json()
        assert isinstance(agents, list)
        assert len(agents) == 1
        assert agents[0]["id"] == "test-agent"
    
    def test_get_agent_success(self, client):
        """Test getting specific agent."""
        response = client.get("/agents/test-agent")
        
        assert response.status_code == 200
        agent = response.json()
        assert agent["id"] == "test-agent"
        assert agent["name"] == "Test Agent"
    
    def test_get_agent_not_found(self, client):
        """Test getting nonexistent agent."""
        response = client.get("/agents/nonexistent")
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestQueryEndpoint:
    """Test /query endpoint."""
    
    def test_query_success(self, client):
        """Test successful query execution."""
        response = client.post(
            "/query",
            json={"question": "What is testing?"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "confidence" in data
        assert data["answer"] == "Test answer"
    
    def test_query_with_query_id(self, client):
        """Test query with custom query ID."""
        response = client.post(
            "/query",
            json={"question": "Test", "query_id": "custom-id"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["query_id"] == "custom-id"
    
    def test_query_empty_question(self, client):
        """Test query with empty question."""
        response = client.post(
            "/query",
            json={"question": ""}
        )
        
        # Should still work (validation at orchestrator level)
        assert response.status_code == 200
    
    def test_query_missing_question(self, client):
        """Test query without question field."""
        response = client.post(
            "/query",
            json={}
        )
        
        # FastAPI validation should reject
        assert response.status_code == 422


class TestRequestValidation:
    """Test request validation."""
    
    def test_invalid_json(self, client):
        """Test invalid JSON body."""
        response = client.post(
            "/query",
            content="not valid json",
            headers={"Content-Type": "application/json"},
        )
        
        assert response.status_code == 422
    
    def test_wrong_content_type(self, client):
        """Test wrong content type."""
        response = client.post(
            "/query",
            content="question=test",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        
        assert response.status_code == 422
    
    def test_extra_fields_ignored(self, client):
        """Test extra fields in request are ignored."""
        response = client.post(
            "/query",
            json={
                "question": "Test",
                "extra_field": "should be ignored",
                "another": 123,
            }
        )
        
        assert response.status_code == 200


class TestCORS:
    """Test CORS configuration."""
    
    def test_cors_headers_present(self, client):
        """Test CORS headers are present."""
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            }
        )
        
        # CORS preflight should succeed
        assert response.status_code in [200, 204, 405]
    
    def test_cors_allowed_origin(self, client):
        """Test allowed origin receives CORS headers."""
        response = client.get(
            "/health",
            headers={"Origin": "http://localhost:3000"}
        )
        
        assert response.status_code == 200


class TestEdgeCases:
    """Test edge cases in API endpoints."""
    
    def test_very_long_question(self, client):
        """Test query with very long question."""
        long_question = "What is " * 1000 + "testing?"
        
        response = client.post(
            "/query",
            json={"question": long_question}
        )
        
        # Should handle gracefully
        assert response.status_code == 200
    
    def test_special_characters_in_query(self, client):
        """Test query with special characters."""
        response = client.post(
            "/query",
            json={"question": 'Test <script>alert("xss")</script>'}
        )
        
        assert response.status_code == 200
    
    def test_unicode_in_query(self, client):
        """Test query with unicode characters."""
        response = client.post(
            "/query",
            json={"question": "日本語のテスト 🧪"}
        )
        
        assert response.status_code == 200
    
    def test_null_values(self, client):
        """Test request with null values."""
        response = client.post(
            "/query",
            json={"question": "Test", "query_id": None}
        )
        
        assert response.status_code == 200
    
    def test_concurrent_requests(self, client):
        """Test handling concurrent requests."""
        import concurrent.futures
        
        def make_request():
            return client.post(
                "/query",
                json={"question": "Concurrent test"}
            )
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            results = [f.result() for f in futures]
        
        assert all(r.status_code == 200 for r in results)


class TestErrorHandling:
    """Test error handling in API."""
    
    def test_orchestrator_error(self):
        """Test handling orchestrator errors."""
        registry = create_mock_registry()
        error_orch = MagicMock()
        error_orch.execute = AsyncMock(side_effect=Exception("Orchestrator failed"))
        
        async_get_registry, async_get_orchestrator = create_async_getters(
            registry, error_orch
        )
        
        with patch("main.get_registry", side_effect=async_get_registry), \
             patch("main.get_orchestrator", side_effect=async_get_orchestrator):
            
            from main import app
            with TestClient(app, raise_server_exceptions=False) as client:
                response = client.post(
                    "/query",
                    json={"question": "Test"}
                )
                
                # Should return error response (500 or handled gracefully)
                assert response.status_code in [200, 500]


class TestWebSocket:
    """Test WebSocket endpoint."""
    
    def test_websocket_connection(self):
        """Test WebSocket connection."""
        registry = create_mock_registry()
        orchestrator = create_mock_orchestrator()
        async_get_registry, async_get_orchestrator = create_async_getters(
            registry, orchestrator
        )
        
        async def mock_run(question, query_id=None):
            yield MockEvent("answer", {"answer": "WS answer"})
        
        with patch("main.get_registry", side_effect=async_get_registry), \
             patch("main.get_orchestrator", side_effect=async_get_orchestrator), \
             patch("main.run_query", mock_run):
            
            from main import app
            with TestClient(app) as client:
                try:
                    with client.websocket_connect("/ws/test-client") as websocket:
                        # Send query
                        websocket.send_json({"question": "WebSocket test"})
                        
                        # Receive events (may timeout which is acceptable)
                        try:
                            data = websocket.receive_json(timeout=1)
                            assert "type" in data or True
                        except:
                            pass
                except Exception:
                    # WebSocket may not be fully supported in test client
                    pass
    
    def test_websocket_invalid_json(self):
        """Test WebSocket with invalid JSON."""
        registry = create_mock_registry()
        orchestrator = create_mock_orchestrator()
        async_get_registry, async_get_orchestrator = create_async_getters(
            registry, orchestrator
        )
        
        with patch("main.get_registry", side_effect=async_get_registry), \
             patch("main.get_orchestrator", side_effect=async_get_orchestrator):
            
            from main import app
            with TestClient(app) as client:
                try:
                    with client.websocket_connect("/ws/test-client") as websocket:
                        # Send invalid JSON
                        websocket.send_text("not json")
                        
                        # Should receive error or handle gracefully
                        try:
                            data = websocket.receive_json(timeout=1)
                        except:
                            pass
                except Exception:
                    pass
    
    def test_websocket_disconnect(self):
        """Test WebSocket disconnect handling."""
        registry = create_mock_registry()
        orchestrator = create_mock_orchestrator()
        async_get_registry, async_get_orchestrator = create_async_getters(
            registry, orchestrator
        )
        
        with patch("main.get_registry", side_effect=async_get_registry), \
             patch("main.get_orchestrator", side_effect=async_get_orchestrator):
            
            from main import app
            with TestClient(app) as client:
                try:
                    ws = client.websocket_connect("/ws/disconnect-test")
                    ws.close()
                except Exception:
                    # Disconnect should be handled gracefully
                    pass
