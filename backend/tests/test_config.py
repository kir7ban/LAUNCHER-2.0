"""Tests for configuration loading."""

import os
import pytest
from pathlib import Path


class TestConfigLoading:
    """Test configuration module."""
    
    def test_azure_config_loaded(self, mock_env_vars):
        """Test Azure OpenAI configuration is loaded from env."""
        # Re-import to pick up mocked env vars
        import importlib
        import config
        importlib.reload(config)
        
        assert config.AZURE_OPENAI_API_KEY == "test-api-key"
        assert config.AZURE_OPENAI_ENDPOINT == "https://test.openai.azure.com/"
        assert config.AZURE_OPENAI_API_VERSION == "2024-02-01"
        assert config.AZURE_OPENAI_CHAT_DEPLOYMENT == "gpt-4o-test"
    
    def test_server_config_loaded(self, mock_env_vars):
        """Test server configuration is loaded."""
        import importlib
        import config
        importlib.reload(config)
        
        assert config.API_HOST == "127.0.0.1"
        assert config.API_PORT == 8080
        assert isinstance(config.FRONTEND_URLS, list)
        assert "http://localhost:3000" in config.FRONTEND_URLS
    
    def test_orchestrator_config_loaded(self, mock_env_vars):
        """Test orchestrator configuration is loaded."""
        import importlib
        import config
        importlib.reload(config)
        
        assert config.ORCHESTRATOR_MAX_TURNS == 5
        assert config.ORCHESTRATOR_TIMEOUT_MS == 30000
    
    def test_default_values(self, monkeypatch):
        """Test default values when env vars not set."""
        # Clear specific env vars
        monkeypatch.delenv("AZURE_OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("ORCHESTRATOR_MAX_TURNS", raising=False)
        
        import importlib
        import config
        importlib.reload(config)
        
        # API key should be empty string
        assert config.AZURE_OPENAI_API_KEY == ""
        # Should have default value (10)
        assert config.ORCHESTRATOR_MAX_TURNS == 10
    
    def test_mcp_agents_config_path(self, mock_env_vars):
        """Test MCP agents config path resolution."""
        import importlib
        import config
        importlib.reload(config)
        
        # Should be an absolute path
        path = Path(config.MCP_AGENTS_CONFIG)
        assert path.name == "agents.json"
    
    def test_frontend_urls_parsing(self, monkeypatch):
        """Test FRONTEND_URLS is correctly parsed from comma-separated string."""
        monkeypatch.setenv("FRONTEND_URLS", "http://a.com,http://b.com,http://c.com")
        
        import importlib
        import config
        importlib.reload(config)
        
        assert len(config.FRONTEND_URLS) == 3
        assert "http://a.com" in config.FRONTEND_URLS
        assert "http://b.com" in config.FRONTEND_URLS
        assert "http://c.com" in config.FRONTEND_URLS
    
    def test_invalid_port_raises_error(self, monkeypatch):
        """Test invalid port value raises ValueError."""
        monkeypatch.setenv("API_PORT", "not-a-number")
        
        import importlib
        import config
        
        with pytest.raises(ValueError):
            importlib.reload(config)
    
    def test_orchestrator_config_dict_sync(self, mock_env_vars):
        """Test ORCHESTRATOR_CONFIG dict stays in sync with individual vars."""
        import importlib
        import config
        importlib.reload(config)
        
        assert config.ORCHESTRATOR_CONFIG["max_iterations"] == config.ORCHESTRATOR_MAX_TURNS
        assert config.ORCHESTRATOR_CONFIG["time_budget_seconds"] == config.ORCHESTRATOR_TIMEOUT_MS // 1000


class TestConfigEdgeCases:
    """Test edge cases in configuration."""
    
    def test_empty_frontend_urls(self, monkeypatch):
        """Test empty FRONTEND_URLS."""
        monkeypatch.setenv("FRONTEND_URLS", "")
        
        import importlib
        import config
        importlib.reload(config)
        
        # Should result in list with empty string
        assert config.FRONTEND_URLS == [""]
    
    def test_whitespace_in_values(self, monkeypatch):
        """Test handling of whitespace in values."""
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "  key-with-spaces  ")
        
        import importlib
        import config
        importlib.reload(config)
        
        # Values should preserve whitespace (user's responsibility)
        assert config.AZURE_OPENAI_API_KEY == "  key-with-spaces  "
    
    def test_zero_timeout(self, monkeypatch):
        """Test zero timeout value."""
        monkeypatch.setenv("ORCHESTRATOR_TIMEOUT_MS", "0")
        
        import importlib
        import config
        importlib.reload(config)
        
        assert config.ORCHESTRATOR_TIMEOUT_MS == 0
    
    def test_negative_port(self, monkeypatch):
        """Test negative port value (should still parse)."""
        monkeypatch.setenv("API_PORT", "-1")
        
        import importlib
        import config
        importlib.reload(config)
        
        # Python int() accepts negative, validation should happen elsewhere
        assert config.API_PORT == -1
