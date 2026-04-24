"""Multi-agent orchestrator for routing and coordinating specialist agents.

The orchestrator:
1. Receives user queries via the API
2. Classifies and routes to appropriate specialist agents
3. Coordinates tool calls across agents via MCP
4. Synthesizes responses and validates grounding
5. Streams events to the frontend in real-time

Architecture:
    User Query → Orchestrator → [Route] → Specialist Agent (MCP)
                     ↓
              [Think → Act → Observe]* loop
                     ↓
              Synthesize + Ground → Response

The orchestrator uses OpenAI function calling to decide which
tools to invoke. Tools are federated from specialist agents via MCP.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable

from openai import AsyncAzureOpenAI

from config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_CHAT_DEPLOYMENT,
    ORCHESTRATOR_MAX_TURNS,
    ORCHESTRATOR_TIMEOUT_MS,
)
from events import (
    BaseEvent,
    think_event,
    act_event,
    observe_event,
    delegate_event,
    answer_event,
    error_event,
    status_event,
    clarify_event,
    ClarifyEvent,
)
from agent_registry import AgentRegistry, get_registry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Orchestrator prompts
# ---------------------------------------------------------------------------

_ZONE1 = """\
You are an intelligent orchestrator that coordinates specialist agents to answer employee queries.

HARD RULES (always follow):
1. NEVER answer from your own knowledge or training data — you are a router, not a knowledge source.
2. ALWAYS call the appropriate agent's tool to retrieve information before responding.
3. If no agent covers the query, say clearly what you cannot help with.
4. Synthesize a concise, direct answer from tool results only; cite sources when available.

TOOL SELECTION GUIDE for governance-security agent (pick the MOST SPECIFIC tool):
- governance-security__cyber_lookup   → Use when the query contains a specific control ID, section number, or FAQ
    number (e.g. "EISA-ACC-201", "ISO 8.5", "FAQ 42", "section 4.2.1"). Do NOT use cyber_query for ID lookups.
- governance-security__cyber_compare  → Use when the query asks to "compare", "contrast", "difference between",
    or "how X relates to Y" across two or more cybersecurity documents (e.g. "compare CD-09000 and EISA on encryption").
- governance-security__cyber_search   → Use when you need raw document chunks for a quick factual question
    from a known source (e.g. "What does CD-09000 say about…"). Faster than cyber_query, no reasoning loop.
- governance-security__cyber_query    → Use for all other open-ended cybersecurity questions that require
    full synthesis, reasoning, and citation extraction.
- governance-security__cyber_capabilities → Use ONCE at the start of a multi-step plan to discover what
    documents are indexed and what the agent can do. Do not call for every query.
- governance-security__cyber_ingest   → Only call if the user explicitly asks to add/ingest a document.
- governance-security__cyber_feedback → Only call if the user explicitly provides feedback or a correction.
- governance-security__cyber_memory_stats → Only call if the user asks about agent memory statistics.
- governance-security__cyber_get_status  → Only call to poll status of a previous async query.
- governance-security__cyber_clarify    → Only call internally after receiving needs_clarification from cyber_query.

For complex multi-faceted queries: call multiple tools in sequence (e.g. cyber_lookup for an ID,
then cyber_compare if cross-document comparison is also needed).
"""

_ZONE3_HEADER = """\
OTHER AGENTS (call only when the query clearly matches their domain):
"""


def build_system_prompt(registry: "AgentRegistry") -> str:  # noqa: F821
    """Build the three-zone orchestrator system prompt from live agent knowledge.

    Zone 1 — Static role definition and hard routing rules.
    Zone 2 — One rich block per connected real (SSE/HTTP/streamable_http) agent,
              populated from ``AgentConnection.routing_knowledge`` (live knowledge
              base metadata merged with static agents.json knowledge block).
    Zone 3 — Brief one-line entries for mock/internal agents.

    The prompt is rebuilt on every query so it always reflects the latest
    routing knowledge (which is refreshed in the background every N minutes).

    Args:
        registry: The populated AgentRegistry instance.

    Returns:
        Complete system prompt string ready for the LLM.
    """
    from agent_registry import Transport

    _REAL_TRANSPORTS = (Transport.SSE, Transport.HTTP, Transport.STREAMABLE_HTTP)

    parts: list[str] = [_ZONE1]

    # ── Zone 2: rich blocks for real agents ─────────────────────────────────
    real_agent_blocks: list[str] = []
    for conn in registry._agents.values():
        if conn.config.transport not in _REAL_TRANSPORTS:
            continue
        if conn.status.value != "connected":
            continue

        block_lines: list[str] = []
        block_lines.append(
            f"=== {conn.config.name} (id: {conn.config.id}) ==="
        )

        if conn.routing_knowledge:
            block_lines.append(conn.routing_knowledge)
        else:
            # Fallback to bare description if knowledge hasn't been fetched yet
            block_lines.append(conn.config.description)
            if conn.tools:
                block_lines.append(
                    f"AVAILABLE TOOLS: {', '.join(t.name for t in conn.tools)}"
                )

        real_agent_blocks.append("\n".join(block_lines))

    if real_agent_blocks:
        parts.append("SPECIALIST AGENTS — USE THESE FOR DOMAIN QUESTIONS:\n")
        parts.extend(real_agent_blocks)

    # ── Zone 3: one-liners for mock/internal agents ──────────────────────────
    mock_lines: list[str] = []
    for conn in registry._agents.values():
        if conn.config.transport in _REAL_TRANSPORTS:
            continue
        if conn.config.transport.value == "internal":
            continue  # triage-process is internal, not user-facing
        if conn.status.value != "connected":
            continue

        knowledge = conn.config.knowledge
        hint = knowledge.get("routing_hint", "")
        handles = knowledge.get("handles", [])
        description = hint or (handles[0] if handles else conn.config.description)
        mock_lines.append(f"- {conn.config.name}: {description}")

    if mock_lines:
        parts.append(_ZONE3_HEADER + "\n".join(mock_lines))

    return "\n\n".join(parts)


SYNTHESIS_PROMPT = """Based on the tool results below, synthesize a comprehensive answer to the user's question.

User Question: {question}

Tool Results:
{tool_results}

Guidelines:
- Combine information from all relevant tool results
- Be specific and cite sources where applicable
- If results are contradictory, note the discrepancy
- If information is insufficient, say what's missing
- Structure your response clearly

Provide your synthesized answer:"""


# ---------------------------------------------------------------------------
# Query state management
# ---------------------------------------------------------------------------

@dataclass
class ToolCall:
    """Record of a tool invocation."""
    id: str
    tool_name: str
    agent_id: str
    arguments: dict[str, Any]
    result: dict[str, Any] | None = None
    duration_ms: int = 0
    success: bool = True
    error: str | None = None


@dataclass
class QueryState:
    """State for a single query execution."""
    query_id: str
    question: str
    start_time: float = field(default_factory=time.time)
    tool_calls: list[ToolCall] = field(default_factory=list)
    messages: list[dict[str, Any]] = field(default_factory=list)
    routed_agents: list[str] = field(default_factory=list)
    final_answer: str = ""
    confidence: float = 0.0
    grounded: bool = True
    out_of_domain: bool = False
    error: str | None = None

    # Clarification support
    clarification_event: asyncio.Event = field(default_factory=asyncio.Event)
    clarification_answers: str = ""
    needs_clarification: bool = False

    @property
    def elapsed_ms(self) -> int:
        """Milliseconds since query started."""
        return int((time.time() - self.start_time) * 1000)
    
    def has_budget(self) -> bool:
        """Check if we have time budget remaining."""
        return self.elapsed_ms < ORCHESTRATOR_TIMEOUT_MS


# Active query states keyed by query_id.
# The WebSocket handler uses this to deliver clarify_response messages.
_active_queries: dict[str, QueryState] = {}


def deliver_clarification(query_id: str, answers: str) -> bool:
    """Called by the WebSocket handler when a clarify_response message arrives.

    Sets the asyncio.Event in the paused orchestrator run() coroutine,
    allowing it to resume with the user's answers.

    Returns True if query was found and notified, False if not found.
    """
    state = _active_queries.get(query_id)
    if not state:
        return False
    state.clarification_answers = answers
    state.clarification_event.set()
    return True


# ---------------------------------------------------------------------------
# OpenAI client
# ---------------------------------------------------------------------------

def get_openai_client() -> AsyncAzureOpenAI:
    """Get async Azure OpenAI client."""
    return AsyncAzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_version=AZURE_OPENAI_API_VERSION,
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class Orchestrator:
    """Multi-agent orchestrator with Think-Act-Observe loop.
    
    Usage:
        orchestrator = Orchestrator(registry)
        
        # Streaming execution
        async for event in orchestrator.run("What is the policy?"):
            print(event.to_json())
        
        # Or single-shot
        response = await orchestrator.execute("What is the policy?")
    """
    
    def __init__(
        self,
        registry: AgentRegistry,
        llm_client: AsyncAzureOpenAI | None = None,
    ) -> None:
        self.registry = registry
        self.llm = llm_client or get_openai_client()
    
    async def run(
        self,
        question: str,
        query_id: str | None = None,
    ) -> AsyncIterator[BaseEvent]:
        """Execute query and yield events in real-time.
        
        Args:
            question: User's question.
            query_id: Optional query ID (generated if not provided).
            
        Yields:
            Events as they occur during processing.
        """
        query_id = query_id or str(uuid.uuid4())
        state = QueryState(query_id=query_id, question=question)
        _active_queries[query_id] = state

        try:
            # Status: Starting
            yield status_event(
                query_id=query_id,
                status="starting",
                message="Analyzing your question...",
                progress=0.1,
            )
            
            # Route to agents
            routed = self.registry.route_query(question)
            if routed:
                state.routed_agents = [r[0] for r in routed[:3]]
                primary_agent, confidence = routed[0]
                
                # Get agent info
                agents = self.registry.agents
                if primary_agent in agents:
                    agent_conn = agents[primary_agent]
                    yield delegate_event(
                        query_id=query_id,
                        from_agent="orchestrator",
                        to_agent=primary_agent,
                        to_agent_name=agent_conn.config.name,
                        confidence=confidence,
                        reason=f"Query matches {primary_agent} domain",
                    )
            
            # Build three-zone system prompt from live routing knowledge
            system_prompt = build_system_prompt(self.registry)
            
            # Initialize messages
            state.messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ]
            
            # Get available tools
            tools = self.registry.get_all_tools()
            
            # Think-Act-Observe loop
            turn = 0
            while turn < ORCHESTRATOR_MAX_TURNS and state.has_budget():
                turn += 1
                
                # Think
                yield think_event(
                    query_id=query_id,
                    reasoning=f"Analyzing how to answer (turn {turn})...",
                    step=turn,
                    total_steps=ORCHESTRATOR_MAX_TURNS,
                )
                
                # Call LLM
                try:
                    response = await self.llm.chat.completions.create(
                        model=AZURE_OPENAI_CHAT_DEPLOYMENT,
                        messages=state.messages,
                        tools=tools if tools else None,
                        tool_choice="auto" if tools else None,
                        temperature=0.2,
                        max_tokens=1500,
                    )
                except Exception as e:
                    logger.error("LLM call failed: %s", e)
                    state.error = str(e)
                    yield error_event(
                        query_id=query_id,
                        error=f"LLM error: {e}",
                        error_type="llm_error",
                        step=turn,
                    )
                    break
                
                choice = response.choices[0]
                message = choice.message
                
                # Check if we have tool calls
                if message.tool_calls:
                    # Add assistant message
                    state.messages.append(message.model_dump())
                    
                    # Execute each tool call
                    for tool_call in message.tool_calls:
                        # Parse tool name (format: agent_id__tool_name)
                        full_name = tool_call.function.name
                        if "__" in full_name:
                            agent_id, tool_name = full_name.split("__", 1)
                        else:
                            agent_id = state.routed_agents[0] if state.routed_agents else ""
                            tool_name = full_name
                        
                        # Parse arguments
                        try:
                            arguments = json.loads(tool_call.function.arguments)
                        except json.JSONDecodeError:
                            arguments = {}
                        
                        # Record the tool call
                        tc = ToolCall(
                            id=tool_call.id,
                            tool_name=tool_name,
                            agent_id=agent_id,
                            arguments=arguments,
                        )
                        state.tool_calls.append(tc)
                        
                        # Act event
                        yield act_event(
                            query_id=query_id,
                            tool_name=tool_name,
                            tool_arguments=arguments,
                            agent_id=agent_id,
                            step=turn,
                        )
                        
                        # Invoke the tool
                        call_start = time.time()
                        try:
                            result = await self.registry.invoke_tool(
                                agent_id=agent_id,
                                tool_name=tool_name,
                                arguments=arguments,
                            )
                            tc.result = result
                            tc.success = True
                            tc.duration_ms = int((time.time() - call_start) * 1000)

                            # Check if the agent is asking for clarification
                            if isinstance(result, dict) and result.get("needs_clarification"):
                                state.needs_clarification = True

                                # Emit clarify event to frontend
                                yield clarify_event(
                                    query_id=query_id,
                                    clarification_questions=result.get("clarification_questions", []),
                                    agent_id=agent_id,
                                )

                                # Pause: wait for user to respond (5 minute timeout)
                                try:
                                    await asyncio.wait_for(
                                        state.clarification_event.wait(), timeout=300.0
                                    )
                                except asyncio.TimeoutError:
                                    yield error_event(
                                        query_id=query_id,
                                        error="Clarification timed out (5 minutes). Please try again.",
                                        error_type="clarification_timeout",
                                        recoverable=True,
                                    )
                                    return

                                # Resume: call cyber_clarify with the user's answers.
                                # MCP tool signature uses "response" (not "answers").
                                clarify_args = {
                                    "query_id": query_id,
                                    "response": state.clarification_answers,
                                }

                                yield act_event(
                                    query_id=query_id,
                                    tool_name="cyber_clarify",
                                    tool_arguments=clarify_args,
                                    agent_id=agent_id,
                                    step=turn,
                                )

                                clarify_start = time.time()
                                try:
                                    clarify_result = await self.registry.invoke_tool(
                                        agent_id=agent_id,
                                        tool_name="cyber_clarify",
                                        arguments=clarify_args,
                                    )
                                    clarify_result_str = json.dumps(clarify_result)
                                    tc2 = ToolCall(
                                        id=f"clarify-{query_id[:8]}",
                                        tool_name="cyber_clarify",
                                        agent_id=agent_id,
                                        arguments=clarify_args,
                                        result=clarify_result,
                                        success=True,
                                        duration_ms=int((time.time() - clarify_start) * 1000),
                                    )
                                    state.tool_calls.append(tc2)
                                except Exception as _ce:
                                    clarify_result_str = json.dumps({"error": str(_ce)})

                                yield observe_event(
                                    query_id=query_id,
                                    tool_name="cyber_clarify",
                                    result_preview=clarify_result_str[:500],
                                    success=True,
                                    duration_ms=int((time.time() - clarify_start) * 1000),
                                    step=turn,
                                )

                                # Add clarification result to conversation and continue
                                state.messages.append({
                                    "role": "tool",
                                    "tool_call_id": tool_call.id,
                                    "content": clarify_result_str,
                                })
                                continue  # Let LLM process the clarification result

                            # Propagate out-of-domain signal from specialist agents
                            if isinstance(result, dict) and result.get("is_out_of_domain"):
                                state.out_of_domain = True

                            result_str = json.dumps(result)

                        except Exception as e:
                            logger.error("Tool call failed: %s", e)
                            tc.success = False
                            tc.error = str(e)
                            tc.duration_ms = int((time.time() - call_start) * 1000)
                            result_str = json.dumps({"error": str(e)})

                        # Observe event (success and failure)
                        yield observe_event(
                            query_id=query_id,
                            tool_name=tool_name,
                            result_preview=result_str[:500],
                            success=tc.success,
                            duration_ms=tc.duration_ms,
                            step=turn,
                        )

                        # Add tool result to messages
                        state.messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": result_str,
                        })

                    # Continue while loop to let LLM process tool results
                    continue
                
                # No tool calls - check for final answer
                if choice.finish_reason == "stop" and message.content:
                    state.final_answer = message.content
                    
                    # Calculate confidence
                    if state.tool_calls:
                        successful = [tc for tc in state.tool_calls if tc.success]
                        state.confidence = len(successful) / len(state.tool_calls)
                    else:
                        state.confidence = 0.5 if state.routed_agents else 0.3
                    
                    break
            
            # Emit final answer event
            yield answer_event(
                query_id=query_id,
                answer=state.final_answer or "I was unable to generate a response.",
                confidence=state.confidence,
                grounded=state.grounded,
                sources=[],  # TODO: Extract sources from tool results
                tool_calls=[
                    {
                        "tool": tc.tool_name,
                        "agent": tc.agent_id,
                        "success": tc.success,
                        "duration_ms": tc.duration_ms,
                    }
                    for tc in state.tool_calls
                ],
                duration_ms=state.elapsed_ms,
                agent_id=state.routed_agents[0] if state.routed_agents else "",
                out_of_domain=state.out_of_domain,
            )
            
        except Exception as e:
            logger.exception("Orchestrator error")
            yield error_event(
                query_id=query_id,
                error=str(e),
                error_type="orchestrator_error",
                recoverable=False,
            )
        finally:
            _active_queries.pop(query_id, None)
    
    async def execute(self, question: str, query_id: str | None = None) -> dict[str, Any]:
        """Execute query and return final result.
        
        This is a convenience method that collects all events
        and returns just the final answer.
        
        Args:
            question: User's question.
            query_id: Optional query ID.
            
        Returns:
            Result dictionary with answer and metadata.
        """
        final_event = None
        tool_calls = []
        
        async for event in self.run(question, query_id):
            if event.type.value == "answer":
                final_event = event
            elif event.type.value == "act":
                tool_calls.append(event.to_dict())
        
        if final_event:
            return final_event.to_dict()
        
        return {
            "answer": "No response generated",
            "confidence": 0.0,
            "error": "Orchestration did not complete",
        }


# ---------------------------------------------------------------------------
# Global orchestrator instance
# ---------------------------------------------------------------------------

_orchestrator: Orchestrator | None = None


async def get_orchestrator() -> Orchestrator:
    """Get the global orchestrator instance."""
    global _orchestrator
    
    if _orchestrator is None:
        registry = await get_registry()
        _orchestrator = Orchestrator(registry)
    
    return _orchestrator


async def run_query(
    question: str,
    query_id: str | None = None,
) -> AsyncIterator[BaseEvent]:
    """Run a query through the orchestrator.
    
    This is the main entry point for processing queries.
    
    Args:
        question: User's question.
        query_id: Optional query ID.
        
    Yields:
        Events as they occur.
    """
    orchestrator = await get_orchestrator()
    async for event in orchestrator.run(question, query_id):
        yield event
