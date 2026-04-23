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
)
from agent_registry import AgentRegistry, get_registry

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Orchestrator prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an intelligent orchestrator that coordinates specialist agents to answer user queries.

Available specialist agents:
{agent_descriptions}

Your job is to:
1. Analyze the user's question
2. Decide which agent(s) can best help
3. Call the appropriate tools to get information
4. Synthesize a helpful response based on tool results

Guidelines:
- Use tools to gather information before answering
- If a query matches multiple domains, consult multiple agents
- Always cite your sources when providing information
- If you cannot answer with the available tools, say so clearly
- Be concise and direct in your responses

When you have enough information to answer, provide your final response.
Do NOT make up information - only use what the tools return."""

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
    
    @property
    def elapsed_ms(self) -> int:
        """Milliseconds since query started."""
        return int((time.time() - self.start_time) * 1000)
    
    def has_budget(self) -> bool:
        """Check if we have time budget remaining."""
        return self.elapsed_ms < ORCHESTRATOR_TIMEOUT_MS


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
            
            # Build system prompt with agent descriptions
            agent_list = self.registry.list_agents()
            agent_desc = "\n".join([
                f"- {a['name']}: {a['description']} (tools: {', '.join(a['tools'])})"
                for a in agent_list
                if a['status'] == 'connected'
            ])
            system_prompt = SYSTEM_PROMPT.format(agent_descriptions=agent_desc)
            
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
                            
                        # Propagate out-of-domain signal from specialist agents
                        if result.get("is_out_of_domain"):
                            state.out_of_domain = True

                        result_str = json.dumps(result)

                    except Exception as e:
                        logger.error("Tool call failed: %s", e)
                        tc.success = False
                        tc.error = str(e)
                        tc.duration_ms = int((time.time() - call_start) * 1000)
                        result_str = json.dumps({"error": str(e)})
                        
                        # Observe event
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
                    
                    # Continue loop to let LLM process tool results
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
