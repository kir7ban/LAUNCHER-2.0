"""FastAPI backend server for the multi-agent orchestrator.

Provides:
- WebSocket endpoint for real-time query streaming
- REST endpoints for agent management
- Health check endpoint

Run with:
    uvicorn main:app --reload --port 8080
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import FRONTEND_URLS, API_HOST, API_PORT
from agent_registry import get_registry, AgentRegistry
from orchestrator import get_orchestrator, run_query
from events import BaseEvent

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan management
# ---------------------------------------------------------------------------

class _AgentsJsonHandler(FileSystemEventHandler):
    """Reload registry when agents.json is modified."""
    def __init__(self, registry, config_path: str, loop):
        self._registry = registry
        self._config_path = config_path
        self._loop = loop
        self._debounce_timer = None

    def on_modified(self, event):
        if os.path.basename(event.src_path) == os.path.basename(self._config_path):
            if self._debounce_timer:
                self._debounce_timer.cancel()
            self._debounce_timer = threading.Timer(0.5, self._schedule_reload)
            self._debounce_timer.start()

    def _schedule_reload(self):
        asyncio.run_coroutine_threadsafe(
            self._registry.reload_config(self._config_path),
            self._loop,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    logger.info("Starting orchestrator backend...")

    registry = await get_registry()
    logger.info("Agent registry loaded: %d agents", len(registry.agents))

    await get_orchestrator()
    logger.info("Orchestrator initialized")

    # Start watchdog to hot-reload agents.json on change
    loop = asyncio.get_running_loop()
    from config import MCP_AGENTS_CONFIG
    config_path = Path(MCP_AGENTS_CONFIG)
    handler = _AgentsJsonHandler(registry, str(config_path), loop)
    observer = Observer()
    observer.schedule(handler, str(config_path.parent), recursive=False)
    observer.start()
    logger.info("Watching %s for hot-reload", config_path)

    yield

    logger.info("Shutting down...")
    observer.stop()
    observer.join()
    await registry.close()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Multi-Agent Orchestrator",
    description="Backend API for the agentic dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    """Request to execute a query."""
    question: str = Field(..., description="User question")
    query_id: str | None = Field(None, description="Optional query ID")
    agent_id: str | None = Field(None, description="Optional target agent")


class QueryResponse(BaseModel):
    """Final query response."""
    query_id: str
    answer: str
    confidence: float
    grounded: bool
    sources: list[dict[str, Any]] = []
    tool_calls: list[dict[str, Any]] = []
    duration_ms: int
    agent_id: str = ""
    out_of_domain: bool = False


class AgentInfo(BaseModel):
    """Agent information."""
    id: str
    name: str
    icon: str
    description: str
    capabilities: list[str]
    status: str
    domains: list[str]
    tools: list[str]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agents_connected: int
    agents_total: int


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info("Client connected: %s", client_id)
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info("Client disconnected: %s", client_id)
    
    async def send_event(self, client_id: str, event: BaseEvent):
        """Send an event to a specific client."""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_text(event.to_json())
            except Exception as e:
                logger.error("Failed to send event to %s: %s", client_id, e)
                self.disconnect(client_id)
    
    async def broadcast(self, event: BaseEvent):
        """Broadcast an event to all connected clients."""
        for client_id in list(self.active_connections.keys()):
            await self.send_event(client_id, event)


manager = ConnectionManager()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    registry = await get_registry()
    agents = registry.list_agents()
    connected = sum(1 for a in agents if a["status"] == "connected")
    
    return HealthResponse(
        status="ok" if connected > 0 else "degraded",
        agents_connected=connected,
        agents_total=len(agents),
    )


@app.get("/agents", response_model=list[AgentInfo])
async def list_agents():
    """List all registered agents."""
    registry = await get_registry()
    return registry.list_agents()


@app.get("/agents/{agent_id}", response_model=AgentInfo)
async def get_agent(agent_id: str):
    """Get a specific agent by ID."""
    registry = await get_registry()
    agents = {a["id"]: a for a in registry.list_agents()}
    
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")
    
    return agents[agent_id]


@app.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest):
    """Execute a query synchronously (returns final result only)."""
    orchestrator = await get_orchestrator()
    result = await orchestrator.execute(request.question, request.query_id)
    
    return QueryResponse(
        query_id=result.get("query_id", ""),
        answer=result.get("answer", ""),
        confidence=result.get("confidence", 0.0),
        grounded=result.get("grounded", True),
        sources=result.get("sources", []),
        tool_calls=result.get("tool_calls", []),
        duration_ms=result.get("duration_ms", 0),
        agent_id=result.get("agent_id", ""),
        out_of_domain=result.get("out_of_domain", False),
    )


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time query streaming.

    Protocol:
    1. Client connects to /ws/{client_id}
    2. Client sends JSON: {"question": "...", "query_id": "..."}
    3. Server streams events as JSON messages
    4. Final "answer" event signals completion

    When the client disconnects, any in-flight query task is cancelled
    immediately to prevent runaway LLM calls and cost.
    """
    await manager.connect(websocket, client_id)

    active_task: asyncio.Task | None = None

    async def _stream_query(question: str, query_id: str | None) -> None:
        async for event in run_query(question, query_id):
            await manager.send_event(client_id, event)

    try:
        while True:
            data = await websocket.receive_text()

            # Cancel any currently running query before starting a new one
            if active_task and not active_task.done():
                active_task.cancel()
                try:
                    await active_task
                except (asyncio.CancelledError, Exception):
                    pass

            try:
                request = json.loads(data)
                msg_type = request.get("type", "query")

                if msg_type == "clarify_response":
                    from orchestrator import deliver_clarification
                    query_id = request.get("query_id", "")
                    answers = request.get("answers", "")
                    found = deliver_clarification(query_id, answers)
                    if not found:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "error": f"No active query found for query_id: {query_id}",
                        }))
                    continue

                question = request.get("question", "")
                query_id = request.get("query_id")

                if not question:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "error": "Missing question field",
                    }))
                    continue

                # Run query in a cancellable task
                active_task = asyncio.create_task(
                    _stream_query(question, query_id)
                )
                await active_task

            except asyncio.CancelledError:
                pass
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "error": "Invalid JSON",
                }))
            except Exception as e:
                logger.exception("Error processing query")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "error": str(e),
                }))

    except WebSocketDisconnect:
        # Cancel in-flight query immediately — stops LLM calls, saves cost
        if active_task and not active_task.done():
            active_task.cancel()
            try:
                await active_task
            except (asyncio.CancelledError, Exception):
                pass
        manager.disconnect(client_id)


# ---------------------------------------------------------------------------
# SSE endpoint (alternative to WebSocket)
# ---------------------------------------------------------------------------

from fastapi.responses import StreamingResponse


@app.post("/query/stream")
async def stream_query(request: QueryRequest):
    """Stream query results via Server-Sent Events.
    
    Alternative to WebSocket for clients that prefer HTTP.
    
    Example client code (JavaScript):
        const response = await fetch('/query/stream', {
            method: 'POST',
            body: JSON.stringify({ question: "..." }),
            headers: { 'Content-Type': 'application/json' }
        });
        const reader = response.body.getReader();
        // Process stream...
    """
    async def event_generator():
        async for event in run_query(request.question, request.query_id):
            yield f"data: {event.to_json()}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disable nginx/Azure proxy buffering so SSE events reach the
            # client immediately rather than being held until the buffer fills.
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Run server
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
    )
