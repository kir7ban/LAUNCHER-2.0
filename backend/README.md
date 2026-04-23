# Multi-Agent Orchestrator Backend

This is the orchestrator backend for the agentic dashboard. It coordinates specialist agents via MCP to answer user queries.

## Architecture

```
User (Frontend) → WebSocket → Orchestrator → MCP → Specialist Agents
                     ↓
              Think → Act → Observe loop
                     ↓
              Real-time events streamed to UI
```

### Components

- **`main.py`** - FastAPI server with WebSocket and REST endpoints
- **`orchestrator.py`** - Reasoning loop that coordinates agents
- **`agent_registry.py`** - Manages MCP connections to specialist agents
- **`events.py`** - Event types for real-time streaming
- **`config.py`** - Configuration from environment variables
- **`agents.json`** - Agent definitions and routing rules

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   .\venv\Scripts\Activate.ps1  # Windows PowerShell
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy and configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your Azure OpenAI credentials
   ```

4. Start the server:
   ```bash
   uvicorn main:app --reload --port 8080
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns agent connection status.

### List Agents
```
GET /agents
```
Returns all registered agents with their capabilities.

### Execute Query (Sync)
```
POST /query
Content-Type: application/json

{
  "question": "What is the security policy?",
  "query_id": "optional-id"
}
```
Returns final answer (no streaming).

### Stream Query (SSE)
```
POST /query/stream
```
Returns Server-Sent Events with orchestrator events.

### WebSocket
```
WS /ws/{client_id}
```
Real-time bidirectional communication. Send queries, receive events.

## Adding Specialist Agents

1. Edit `agents.json` to add your agent:
   ```json
   {
     "id": "my-agent",
     "name": "My Agent",
     "icon": "🤖",
     "description": "Does something useful",
     "transport": "sse",
     "url": "http://localhost:9000/mcp",
     "tools": ["tool_name"],
     "domains": ["keyword1", "keyword2"]
   }
   ```

2. Add routing rules:
   ```json
   {
     "keywords": ["specific", "keywords"],
     "agent_id": "my-agent",
     "confidence_boost": 0.2
   }
   ```

3. Restart the backend.

## Connecting CyberAgent

CyberAgent exposes its RAG pipeline via MCP at `http://localhost:8000/mcp`.

Start CyberAgent first:
```bash
cd /path/to/CyberAgent
uvicorn api.main:app --reload --port 8000
```

Then start this backend:
```bash
uvicorn main:app --reload --port 8080
```

The orchestrator will automatically connect to CyberAgent and expose its tools.

## Frontend Integration

Set environment variables in the frontend:
```
VITE_USE_REAL_BACKEND=true
VITE_BACKEND_URL=http://localhost:8080
```

The frontend's `AgentContext` will use WebSocket to stream events.
