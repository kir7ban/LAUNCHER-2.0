"""Agent registry for managing MCP connections to specialist agents.

The registry:
- Loads agent configurations from agents.json
- Manages MCP client connections (SSE, stdio, HTTP)
- Routes queries to appropriate agents based on domain/keywords
- Provides health checks and capability discovery

Architecture:
    Each specialist agent exposes tools via MCP. The orchestrator
    uses this registry to discover agents and invoke their tools.
    
    Supported transports:
    - "sse": MCP over Server-Sent Events (FastAPI mount)
    - "stdio": MCP over stdin/stdout (subprocess)
    - "http": MCP over HTTP POST
    - "mock": Simulated responses for testing
    - "internal": Built-in routing logic
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable

import httpx
from pydantic import BaseModel, Field


def _expand_env(value: str) -> str:
    """Expand ${VAR:-default} patterns in a string using environment variables."""
    def _replace(match: re.Match) -> str:
        var_name = match.group(1)
        default = match.group(2) or ""
        return os.environ.get(var_name, default)

    return re.sub(r"\$\{(\w+)(?::-([^}]*))?\}", _replace, value)


def _get_auth_headers(config) -> dict[str, str]:
    """Build HTTP headers for MCP auth based on agent config.

    Supports:
      {"type": "bearer", "key_env": "ENV_VAR_NAME"}  — read key from env
      {"type": "bearer", "key": "literal-value"}      — use literal key
    """
    auth = getattr(config, "auth", None) or {}
    if auth.get("type") == "bearer":
        key = auth.get("key") or os.environ.get(auth.get("key_env", ""), "")
        if key:
            return {"Authorization": f"Bearer {key}"}
    return {}


logger = logging.getLogger(__name__)


class Transport(str, Enum):
    """MCP transport types."""
    SSE = "sse"
    STREAMABLE_HTTP = "streamable_http"
    STDIO = "stdio"
    HTTP = "http"
    MOCK = "mock"
    INTERNAL = "internal"


class AgentStatus(str, Enum):
    """Agent connection status."""
    UNKNOWN = "unknown"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


@dataclass
class AgentTool:
    """A tool exposed by an agent."""
    name: str
    description: str
    parameters: dict[str, Any]
    
    def to_openai_schema(self) -> dict:
        """Convert to OpenAI function calling format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


@dataclass
class AgentConfig:
    """Configuration for a specialist agent."""
    id: str
    name: str
    icon: str
    description: str
    capabilities: list[str]
    transport: Transport
    domains: list[str]
    priority: int = 1
    url: str | None = None
    mcp_path: str = "/mcp"
    command: str | None = None
    args: list[str] = field(default_factory=list)
    tools: list[str] = field(default_factory=list)
    tool_schemas: dict[str, dict] = field(default_factory=dict)
    # Static routing knowledge loaded from agents.json (fallback when live call fails)
    knowledge: dict = field(default_factory=dict)
    auth: dict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> AgentConfig:
        """Create from dictionary."""
        raw_url = data.get("url")
        return cls(
            id=data["id"],
            name=data["name"],
            icon=data.get("icon", ""),
            description=data.get("description", ""),
            capabilities=data.get("capabilities", []),
            transport=Transport(data.get("transport", "mock")),
            domains=data.get("domains", []),
            priority=data.get("priority", 1),
            # Expand ${VAR:-default} env-var patterns so URLs are configurable in Azure
            url=_expand_env(raw_url) if raw_url else None,
            mcp_path=data.get("mcp_path", "/mcp"),
            command=data.get("command"),
            args=data.get("args", []),
            tools=data.get("tools", []),
            tool_schemas=data.get("tool_schemas", {}),
            knowledge=data.get("knowledge", {}),
            auth=data.get("auth", {}),
        )


@dataclass
class RoutingRule:
    """Rule for routing queries to agents."""
    keywords: list[str]
    agent_id: str
    confidence_boost: float = 0.0
    
    @classmethod
    def from_dict(cls, data: dict) -> RoutingRule:
        return cls(
            keywords=data.get("keywords", []),
            agent_id=data["agent_id"],
            confidence_boost=data.get("confidence_boost", 0.0),
        )


@dataclass
class AgentConnection:
    """Active connection to an agent."""
    config: AgentConfig
    status: AgentStatus = AgentStatus.UNKNOWN
    tools: list[AgentTool] = field(default_factory=list)
    last_health_check: float = 0.0
    error_message: str | None = None
    http_client: httpx.AsyncClient | None = None
    # Rendered routing knowledge string injected into the orchestrator system prompt.
    # Populated at startup by fetch_routing_knowledge() and refreshed periodically.
    routing_knowledge: str = ""
    

class AgentRegistry:
    """Registry for managing specialist agents.
    
    Provides:
    - Agent discovery and configuration loading
    - MCP client connections
    - Tool invocation across agents
    - Query routing based on domains/keywords
    
    Usage:
        registry = AgentRegistry()
        await registry.load_config("agents.json")
        await registry.connect_all()
        
        # Route and invoke
        agents = registry.route_query("What is the security policy?")
        result = await registry.invoke_tool(
            agent_id="governance-security",
            tool_name="query_cybersecurity_knowledge",
            arguments={"question": "..."}
        )
    """
    
    def __init__(self) -> None:
        self._agents: dict[str, AgentConnection] = {}
        self._routing_rules: list[RoutingRule] = []
        self._mock_handlers: dict[str, Callable] = {}
        
    @property
    def agents(self) -> dict[str, AgentConnection]:
        """Get all registered agents."""
        return dict(self._agents)
    
    def list_agents(self) -> list[dict]:
        """List all agents with their status."""
        return [
            {
                "id": conn.config.id,
                "name": conn.config.name,
                "icon": conn.config.icon,
                "description": conn.config.description,
                "capabilities": conn.config.capabilities,
                "status": conn.status.value,
                "domains": conn.config.domains,
                "tools": [t.name for t in conn.tools],
            }
            for conn in self._agents.values()
        ]
    
    async def load_config(self, config_path: str | Path) -> None:
        """Load agent configurations from JSON file.
        
        Args:
            config_path: Path to agents.json configuration file.
        """
        config_path = Path(config_path)
        
        if not config_path.exists():
            logger.warning("Agent config file not found: %s", config_path)
            return
        
        with open(config_path, encoding="utf-8") as f:
            data = json.load(f)
        
        # Load agents
        for agent_data in data.get("agents", []):
            config = AgentConfig.from_dict(agent_data)
            self._agents[config.id] = AgentConnection(config=config)
            logger.info("Loaded agent: %s (%s)", config.name, config.transport.value)
        
        # Load routing rules
        for rule_data in data.get("routing_rules", []):
            self._routing_rules.append(RoutingRule.from_dict(rule_data))
        
        logger.info(
            "Loaded %d agents and %d routing rules",
            len(self._agents), len(self._routing_rules)
        )
    
    async def connect_all(self) -> dict[str, bool]:
        """Connect to all configured agents.
        
        Returns:
            Dict mapping agent_id to connection success.
        """
        results = {}
        
        for agent_id, conn in self._agents.items():
            try:
                success = await self._connect_agent(conn)
                results[agent_id] = success
            except Exception as e:
                logger.error("Failed to connect to %s: %s", agent_id, e)
                conn.status = AgentStatus.ERROR
                conn.error_message = str(e)
                results[agent_id] = False
        
        return results

    async def reload_config(self, config_path) -> None:
        """Reload agent configurations from JSON file and reconnect all agents.

        Called by the watchdog file watcher when agents.json changes.
        """
        logger.info("Reloading agent config from %s", config_path)
        await self.close()
        self._agents.clear()
        self._routing_rules.clear()
        await self.load_config(config_path)
        await self.connect_all()
        logger.info("Agent registry reloaded: %d agents", len(self._agents))

    async def _connect_agent(self, conn: AgentConnection) -> bool:
        """Connect to a single agent.
        
        Args:
            conn: Agent connection to establish.
            
        Returns:
            True if connected successfully.
        """
        config = conn.config
        
        if config.transport == Transport.MOCK:
            conn.status = AgentStatus.CONNECTED
            conn.tools = self._get_mock_tools(config.id)
            return True
        
        if config.transport == Transport.INTERNAL:
            conn.status = AgentStatus.CONNECTED
            return True
        
        if config.transport == Transport.SSE:
            return await self._connect_sse(conn)
        
        if config.transport == Transport.HTTP:
            return await self._connect_http(conn)

        if config.transport == Transport.STREAMABLE_HTTP:
            return await self._connect_streamable_http(conn)

        if config.transport == Transport.STDIO:
            # TODO: Implement stdio transport
            logger.warning("STDIO transport not yet implemented for %s", config.id)
            conn.status = AgentStatus.DISCONNECTED
            return False
        
        return False
    
    async def _connect_sse(self, conn: AgentConnection) -> bool:
        """Connect to an agent via SSE MCP transport.
        
        Args:
            conn: Agent connection with SSE config.
            
        Returns:
            True if connected and tools discovered.
        """
        config = conn.config
        
        if not config.url:
            logger.error("No URL configured for SSE agent %s", config.id)
            conn.status = AgentStatus.ERROR
            conn.error_message = "No URL configured"
            return False
        
        try:
            # Use only the host+port as base_url so relative path requests
            # (health check at /health, MCP at /mcp) resolve correctly.
            from urllib.parse import urlparse
            parsed = urlparse(config.url)
            host_base = f"{parsed.scheme}://{parsed.netloc}"

            conn.http_client = httpx.AsyncClient(
                base_url=host_base,
                headers=_get_auth_headers(config),
                timeout=httpx.Timeout(30.0, connect=5.0),
                follow_redirects=True,
            )

            # Build tools from per-tool schemas defined in agents.json
            conn.tools = [
                AgentTool(
                    name=tool_name,
                    description=config.tool_schemas.get(tool_name, {}).get(
                        "description", f"Tool '{tool_name}' from {config.name}"
                    ),
                    parameters=config.tool_schemas.get(
                        tool_name,
                        {"type": "object", "properties": {}},
                    ),
                )
                for tool_name in config.tools
            ]

            # Health check — require HTTP 200 to mark as connected
            try:
                response = await conn.http_client.get("/health")
                if response.status_code == 200:
                    conn.status = AgentStatus.CONNECTED
                    logger.info("Connected to %s via SSE at %s", config.name, config.url)
                    return True
                else:
                    conn.status = AgentStatus.DISCONNECTED
                    conn.error_message = f"Health check returned HTTP {response.status_code}"
                    logger.warning(
                        "Agent %s health check returned HTTP %d — marked DISCONNECTED",
                        config.id, response.status_code,
                    )
                    return False
            except Exception as e:
                conn.status = AgentStatus.DISCONNECTED
                conn.error_message = f"Health check failed: {e}"
                logger.warning(
                    "Health check failed for %s — marked DISCONNECTED: %s", config.id, e,
                )
                return False

        except Exception as e:
            logger.error("Failed to connect to %s: %s", config.id, e)
            conn.status = AgentStatus.ERROR
            conn.error_message = str(e)
            return False
    
    async def _connect_http(self, conn: AgentConnection) -> bool:
        """Connect to an agent via HTTP transport."""
        # Similar to SSE but uses POST for tool calls
        return await self._connect_sse(conn)

    async def _connect_streamable_http(self, conn: AgentConnection) -> bool:
        """Connect to an agent via FastMCP Streamable HTTP transport.

        Posts JSON-RPC requests directly to config.url (e.g. /mcp).
        Performs MCP initialize handshake, then discovers tools via tools/list.
        """
        config = conn.config

        if not config.url:
            logger.error("No URL configured for streamable_http agent %s", config.id)
            conn.status = AgentStatus.ERROR
            conn.error_message = "No URL configured"
            return False

        try:
            from urllib.parse import urlparse
            parsed = urlparse(config.url)
            base = f"{parsed.scheme}://{parsed.netloc}"
            path = parsed.path  # e.g. "/mcp"

            # Normalize path: ensure trailing slash so Starlette doesn't 307-redirect
            # /mcp → /mcp/ (Azure Container Apps TLS terminates at ingress, so the
            # redirect would downgrade to http:// internally — avoid entirely).
            if path and not path.endswith("/"):
                path = path + "/"

            conn.http_client = httpx.AsyncClient(
                base_url=base,
                headers=_get_auth_headers(config),
                timeout=httpx.Timeout(60.0, connect=10.0),
                follow_redirects=True,
            )

            # MCP initialize handshake
            init_body = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "clientInfo": {"name": "launcher-orchestrator", "version": "1.0"},
                    "capabilities": {},
                },
            }
            try:
                resp = await conn.http_client.post(path, json=init_body)
                if resp.status_code >= 500:
                    logger.warning("MCP initialize failed for %s: %d", config.id, resp.status_code)
            except Exception:
                pass  # Initialize may not be required; continue to tool discovery

            conn.status = AgentStatus.CONNECTED
            logger.info("Connected to %s via streamable_http at %s", config.name, config.url)

            # Tool discovery: use static list if provided, else auto-discover
            if config.tools:
                conn.tools = [
                    AgentTool(name=t, description=f"Tool from {config.name}",
                              parameters={"type": "object", "properties": {}})
                    for t in config.tools
                ]
            else:
                await self._discover_tools(conn)

            return True

        except Exception as e:
            logger.error("Failed to connect to %s via streamable_http: %s", config.id, e)
            conn.status = AgentStatus.ERROR
            conn.error_message = str(e)
            return False

    async def _discover_tools(self, conn: AgentConnection) -> None:
        """Discover tools from an agent via MCP tools/list JSON-RPC call."""
        if not conn.http_client or not conn.config.url:
            return

        from urllib.parse import urlparse
        path = urlparse(conn.config.url).path

        try:
            list_body = {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {},
            }
            resp = await conn.http_client.post(path, json=list_body)
            resp.raise_for_status()
            data = resp.json()

            if "result" in data and "tools" in data["result"]:
                conn.tools = [
                    AgentTool(
                        name=t["name"],
                        description=t.get("description", ""),
                        parameters=t.get("inputSchema", {"type": "object", "properties": {}}),
                    )
                    for t in data["result"]["tools"]
                ]
                logger.info(
                    "Discovered %d tools from %s: %s",
                    len(conn.tools), conn.config.id,
                    [t.name for t in conn.tools],
                )
            else:
                logger.warning("tools/list response missing 'tools' for %s", conn.config.id)

        except Exception as e:
            logger.warning("Tool discovery failed for %s: %s", conn.config.id, e)

    def _get_mock_tools(self, agent_id: str) -> list[AgentTool]:
        """Get mock tools for testing."""
        return [
            AgentTool(
                name=f"{agent_id}_query",
                description=f"Query the {agent_id} agent",
                parameters={
                    "type": "object",
                    "properties": {
                        "question": {"type": "string", "description": "Question to ask"},
                    },
                    "required": ["question"],
                },
            ),
        ]
    
    def route_query(self, query: str) -> list[tuple[str, float]]:
        """Route a query to appropriate agents based on content.
        
        Args:
            query: User query string.
            
        Returns:
            List of (agent_id, confidence_score) tuples, sorted by confidence.
        """
        query_lower = query.lower()
        scores: dict[str, float] = {}
        
        # Apply routing rules
        for rule in self._routing_rules:
            matches = sum(1 for kw in rule.keywords if kw.lower() in query_lower)
            if matches > 0:
                agent_id = rule.agent_id
                base_score = matches / len(rule.keywords)
                boost = rule.confidence_boost
                scores[agent_id] = max(
                    scores.get(agent_id, 0),
                    base_score + boost,
                )
        
        # If no rules matched, use domain-based routing
        if not scores:
            for agent_id, conn in self._agents.items():
                for domain in conn.config.domains:
                    if domain.lower() in query_lower:
                        scores[agent_id] = 0.5
                        break
        
        # Sort by score descending
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        return ranked
    
    async def invoke_tool(
        self,
        agent_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        timeout: float = 60.0,
    ) -> dict[str, Any]:
        """Invoke a tool on a specialist agent.
        
        Args:
            agent_id: ID of the agent to call.
            tool_name: Name of the tool to invoke.
            arguments: Tool arguments.
            timeout: Request timeout in seconds.
            
        Returns:
            Tool result dictionary.
            
        Raises:
            ValueError: If agent not found or not connected.
            RuntimeError: If tool invocation fails.
        """
        conn = self._agents.get(agent_id)
        if not conn:
            raise ValueError(f"Agent not found: {agent_id}")

        # Auto-reconnect once if agent was previously disconnected (e.g. after cold start)
        if conn.status == AgentStatus.DISCONNECTED:
            logger.info("Agent %s is DISCONNECTED — attempting reconnect before invoke", agent_id)
            reconnected = await self._connect_agent(conn)
            if not reconnected:
                raise ValueError(
                    f"Agent {agent_id} is unavailable ({conn.error_message or 'disconnected'}). "
                    "Retry in a few seconds."
                )

        if conn.status != AgentStatus.CONNECTED:
            raise ValueError(f"Agent not connected: {agent_id} ({conn.status.value})")
        
        config = conn.config
        
        # Mock transport
        if config.transport == Transport.MOCK:
            return await self._invoke_mock(agent_id, tool_name, arguments)
        
        # Internal transport (triage)
        if config.transport == Transport.INTERNAL:
            return await self._invoke_internal(agent_id, tool_name, arguments)
        
        # SSE/HTTP/Streamable-HTTP transport - call MCP endpoint
        if config.transport in (Transport.SSE, Transport.HTTP, Transport.STREAMABLE_HTTP):
            return await self._invoke_mcp(conn, tool_name, arguments, timeout)
        
        raise RuntimeError(f"Unsupported transport: {config.transport}")
    
    async def _invoke_mock(
        self,
        agent_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke a mock tool for testing."""
        # Check for registered mock handler
        handler_key = f"{agent_id}.{tool_name}"
        if handler_key in self._mock_handlers:
            return await self._mock_handlers[handler_key](arguments)
        
        # Default mock response
        question = arguments.get("question", "")
        return {
            "answer": f"[Mock response from {agent_id}] Processing: {question[:100]}...",
            "confidence": 0.8,
            "agent_id": agent_id,
            "mock": True,
        }
    
    async def _invoke_internal(
        self,
        agent_id: str,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke internal routing logic."""
        if agent_id == "triage-process":
            query = arguments.get("question", "")
            routed = self.route_query(query)
            
            return {
                "classification": "request",
                "routed_agents": [
                    {"agent_id": aid, "confidence": conf}
                    for aid, conf in routed[:3]
                ],
                "triage_complete": True,
            }
        
        return {"error": f"Unknown internal agent: {agent_id}"}
    
    async def _invoke_mcp(
        self,
        conn: AgentConnection,
        tool_name: str,
        arguments: dict[str, Any],
        timeout: float,
    ) -> dict[str, Any]:
        """Invoke a tool via MCP streamable-HTTP transport (JSON-RPC 2.0).

        FastMCP's streamable HTTP endpoint listens at its mount path (e.g. /mcp).
        Requests are sent as JSON-RPC 2.0 POST with method=tools/call.
        The response may be a direct JSON object or an SSE stream; we handle both.
        """
        if not conn.http_client:
            raise RuntimeError(f"No HTTP client for agent {conn.config.id}")

        import uuid as _uuid
        call_id = str(_uuid.uuid4())

        request_body = {
            "jsonrpc": "2.0",
            "id": call_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
        }

        from urllib.parse import urlparse
        _path = urlparse(conn.config.url).path if conn.config.url else "/mcp"

        try:
            response = await conn.http_client.post(
                _path,
                json=request_body,
                headers={"Accept": "application/json, text/event-stream"},
                timeout=timeout,
            )
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            # Handle SSE stream response
            if "text/event-stream" in content_type:
                result_text = ""
                for line in response.text.splitlines():
                    if line.startswith("data:"):
                        result_text = line[5:].strip()
                        break
                if not result_text:
                    raise RuntimeError("Empty SSE response from MCP server")
                result = json.loads(result_text)
            else:
                result = response.json()

            # Unwrap JSON-RPC response
            if "result" in result:
                content = result["result"].get("content", [])
                if content and content[0].get("type") == "text":
                    text = content[0].get("text", "{}")
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return {"answer": text}
                return result["result"]

            if "error" in result:
                raise RuntimeError(f"MCP error: {result['error']}")

            return result

        except httpx.HTTPStatusError as e:
            logger.error("MCP call failed: HTTP %s — %s", e.response.status_code, e)
            raise RuntimeError(f"MCP call failed with HTTP {e.response.status_code}: {e}")
        except json.JSONDecodeError as e:
            logger.error("Failed to parse MCP response: %s", e)
            raise RuntimeError(f"Invalid MCP response: {e}")
    
    def register_mock_handler(
        self,
        agent_id: str,
        tool_name: str,
        handler: Callable,
    ) -> None:
        """Register a mock handler for testing.
        
        Args:
            agent_id: Agent ID.
            tool_name: Tool name.
            handler: Async function taking arguments dict, returning result dict.
        """
        self._mock_handlers[f"{agent_id}.{tool_name}"] = handler
    
    def get_all_tools(self) -> list[dict]:
        """Get all tools from all connected agents.
        
        Returns:
            List of OpenAI-compatible tool schemas.
        """
        tools = []
        
        for conn in self._agents.values():
            if conn.status != AgentStatus.CONNECTED:
                continue
            
            for tool in conn.tools:
                schema = tool.to_openai_schema()
                # Prefix tool name with agent ID to avoid collisions
                schema["function"]["name"] = f"{conn.config.id}__{tool.name}"
                schema["function"]["description"] = (
                    f"[{conn.config.name}] {tool.description}"
                )
                tools.append(schema)
        
        return tools
    
    # ---------------------------------------------------------------------------
    # Routing knowledge — live fetch + render
    # ---------------------------------------------------------------------------

    async def fetch_routing_knowledge(self, agent_id: str) -> str:
        """Build and return the routing knowledge string for one agent.

        For real (streamable_http / SSE / HTTP) agents: calls the
        ``cyber_capabilities`` tool to get live knowledge base metadata, then
        merges it with the static ``knowledge`` block from agents.json.

        For mock / internal agents: renders from the static ``knowledge`` block
        only (no network call).

        The returned string is stored in ``AgentConnection.routing_knowledge``
        and injected into the orchestrator system prompt on every query.

        Args:
            agent_id: Registry ID of the agent to fetch knowledge for.

        Returns:
            Rendered routing knowledge string (may be empty if not configured).
        """
        import datetime

        conn = self._agents.get(agent_id)
        if not conn:
            return ""

        config = conn.config
        static_k = config.knowledge  # dict from agents.json

        _REAL_TRANSPORTS = (Transport.SSE, Transport.HTTP, Transport.STREAMABLE_HTTP)

        # ── Mock / internal agents — static block only ───────────────────────
        if config.transport not in _REAL_TRANSPORTS:
            handles = static_k.get("handles", [])
            hint = static_k.get("routing_hint", "")
            if not handles and not hint:
                return ""
            lines: list[str] = []
            if handles:
                lines.append("  Handles: " + "; ".join(handles))
            if hint:
                lines.append(f"  Rule: {hint}")
            return "\n".join(lines)

        # ── Real agents — try live cyber_capabilities call ───────────────────
        live_kb: dict | None = None
        if conn.status == AgentStatus.CONNECTED:
            try:
                result = await self.invoke_tool(agent_id, "cyber_capabilities", {})
                if isinstance(result, dict):
                    live_kb = result.get("knowledge_base")
                    logger.info(
                        "fetch_routing_knowledge: live KB fetched for %s — %d chunks, %d sources",
                        agent_id,
                        live_kb.get("total_chunks", 0) if live_kb else 0,
                        len(live_kb.get("indexed_sources", [])) if live_kb else 0,
                    )
            except Exception as exc:
                logger.warning(
                    "fetch_routing_knowledge: cyber_capabilities failed for %s — "
                    "using static fallback. Error: %s",
                    agent_id, exc,
                )

        # ── Render ───────────────────────────────────────────────────────────
        parts: list[str] = []

        routing_hint = static_k.get("routing_hint", "")
        if routing_hint:
            parts.append(f"ROUTING RULE: {routing_hint}")
            parts.append("")

        # HANDLES section — live indexed_sources override static handles list
        handles = static_k.get("handles", [])
        if live_kb and live_kb.get("status") == "ready":
            ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            sources = live_kb.get("indexed_sources", [])
            content_types = live_kb.get("content_types", [])
            total_chunks = live_kb.get("total_chunks", 0)

            parts.append(f"LIVE KNOWLEDGE BASE (refreshed {ts}):")
            if sources:
                parts.append(f"  Indexed documents: {', '.join(sources)}")
            if content_types:
                parts.append(f"  Content types: {', '.join(content_types)}")
            if total_chunks:
                parts.append(f"  Total indexed chunks: {total_chunks}")
            parts.append("")
        elif handles:
            parts.append("HANDLES:")
            for h in handles:
                parts.append(f"  - {h}")
            parts.append("")

        # DOES NOT HANDLE section
        does_not_handle = static_k.get("does_not_handle", [])
        if does_not_handle:
            parts.append("DO NOT CALL THIS AGENT FOR:")
            for d in does_not_handle:
                parts.append(f"  - {d}")
            parts.append("")

        # EXAMPLE QUERIES section
        examples = static_k.get("example_queries", [])
        if examples:
            parts.append("EXAMPLE QUERIES HANDLED:")
            for ex in examples:
                parts.append(f'  - "{ex}"')
            parts.append("")

        # Available tools
        tool_names = [t.name for t in conn.tools]
        if tool_names:
            parts.append(f"AVAILABLE TOOLS: {', '.join(tool_names)}")

        return "\n".join(parts).strip()

    async def refresh_all_routing_knowledge(self) -> None:
        """Refresh routing knowledge for all connected agents.

        Iterates all agents and calls ``fetch_routing_knowledge`` for each.
        Updates ``AgentConnection.routing_knowledge`` in-place.

        Failures for individual agents are logged and silently skipped so a
        single unreachable agent does not abort the whole refresh cycle.
        """
        logger.info("Refreshing routing knowledge for all agents...")
        updated = 0
        for agent_id, conn in self._agents.items():
            try:
                knowledge_str = await self.fetch_routing_knowledge(agent_id)
                conn.routing_knowledge = knowledge_str
                if knowledge_str:
                    updated += 1
            except Exception as exc:
                logger.warning(
                    "refresh_all_routing_knowledge: failed for %s: %s", agent_id, exc
                )
        logger.info(
            "Routing knowledge refresh complete — %d/%d agents updated",
            updated, len(self._agents),
        )

    async def close(self) -> None:
        """Close all agent connections."""
        for conn in self._agents.values():
            if conn.http_client:
                await conn.http_client.aclose()
            conn.status = AgentStatus.DISCONNECTED

        logger.info("Closed all agent connections")


# ---------------------------------------------------------------------------
# Global registry instance
# ---------------------------------------------------------------------------

_registry: AgentRegistry | None = None


async def get_registry() -> AgentRegistry:
    """Get the global agent registry, initializing if needed."""
    global _registry
    
    if _registry is None:
        from config import MCP_AGENTS_CONFIG
        
        _registry = AgentRegistry()
        await _registry.load_config(MCP_AGENTS_CONFIG)
        await _registry.connect_all()
    
    return _registry
