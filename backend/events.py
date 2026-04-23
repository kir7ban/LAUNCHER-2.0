"""Event types for real-time streaming to the frontend.

Events are sent via WebSocket or SSE to keep the dashboard
updated on agent activity. 

Event flow:
    1. User sends query via WebSocket
    2. Orchestrator emits events as it processes
    3. Frontend receives events and updates UI in real-time
    4. Final AnswerEvent signals completion

Event types map to React context state:
    - ThinkEvent → "thinking" status
    - ActEvent → "acting" status, tool_calls array
    - DelegateEvent → agent handoff indicator
    - StreamEvent → partial response text
    - AnswerEvent → final response + metadata
    - ErrorEvent → error display
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any
import json


class EventType(str, Enum):
    """Types of orchestrator events."""
    THINK = "think"
    ACT = "act"
    OBSERVE = "observe"
    DELEGATE = "delegate"
    STREAM = "stream"
    ANSWER = "answer"
    ERROR = "error"
    STATUS = "status"
    CLARIFY = "clarify"


@dataclass
class BaseEvent:
    """Base class for all orchestrator events."""
    type: EventType
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    query_id: str = ""
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data["type"] = self.type.value
        return data
    
    def to_json(self) -> str:
        """Convert to JSON string for WebSocket/SSE."""
        return json.dumps(self.to_dict())


@dataclass
class ThinkEvent(BaseEvent):
    """Orchestrator reasoning event.
    
    Emitted when the LLM is processing and planning.
    Frontend shows "thinking" indicator.
    """
    type: EventType = field(default=EventType.THINK)
    reasoning: str = ""
    plan: list[str] = field(default_factory=list)
    step: int = 0
    total_steps: int = 0


@dataclass
class ActEvent(BaseEvent):
    """Tool invocation event.
    
    Emitted when a tool is being called.
    Frontend shows tool name and arguments.
    """
    type: EventType = field(default=EventType.ACT)
    tool_name: str = ""
    tool_arguments: dict[str, Any] = field(default_factory=dict)
    agent_id: str = ""
    step: int = 0


@dataclass
class ObserveEvent(BaseEvent):
    """Tool result observation event.
    
    Emitted when tool results are received.
    Can optionally include the result preview.
    """
    type: EventType = field(default=EventType.OBSERVE)
    tool_name: str = ""
    result_preview: str = ""
    result_length: int = 0
    success: bool = True
    duration_ms: int = 0
    step: int = 0


@dataclass
class DelegateEvent(BaseEvent):
    """Agent delegation event.
    
    Emitted when routing to a specialist agent.
    Frontend can show which agent is handling.
    """
    type: EventType = field(default=EventType.DELEGATE)
    from_agent: str = ""
    to_agent: str = ""
    to_agent_name: str = ""
    confidence: float = 0.0
    reason: str = ""


@dataclass
class StreamEvent(BaseEvent):
    """Streaming text event.
    
    Emitted for partial response text during generation.
    Frontend appends to response display.
    """
    type: EventType = field(default=EventType.STREAM)
    token: str = ""
    accumulated: str = ""
    is_final: bool = False


@dataclass
class AnswerEvent(BaseEvent):
    """Final answer event.
    
    Emitted when response is complete.
    Contains full answer and metadata.
    """
    type: EventType = field(default=EventType.ANSWER)
    answer: str = ""
    confidence: float = 0.0
    grounded: bool = True
    sources: list[dict[str, Any]] = field(default_factory=list)
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    agent_id: str = ""
    out_of_domain: bool = False


@dataclass
class ErrorEvent(BaseEvent):
    """Error event.
    
    Emitted when an error occurs during processing.
    Frontend shows error message to user.
    """
    type: EventType = field(default=EventType.ERROR)
    error: str = ""
    error_type: str = ""
    recoverable: bool = True
    step: int = 0


@dataclass 
class StatusEvent(BaseEvent):
    """Status update event.
    
    General status updates for the UI.
    Used for progress indicators and state changes.
    """
    type: EventType = field(default=EventType.STATUS)
    status: str = ""
    message: str = ""
    progress: float = 0.0  # 0.0 to 1.0
    agents_active: list[str] = field(default_factory=list)


@dataclass
class ClarifyEvent(BaseEvent):
    """Clarification request event.

    Emitted when a specialist agent returns needs_clarification=True.
    Frontend must display the questions before the orchestrator can resume.
    """
    type: EventType = field(default=EventType.CLARIFY)
    clarification_questions: list[dict[str, Any]] = field(default_factory=list)
    agent_id: str = ""


# ---------------------------------------------------------------------------
# Event creation helpers
# ---------------------------------------------------------------------------

def think_event(
    query_id: str,
    reasoning: str,
    plan: list[str] | None = None,
    step: int = 0,
    total_steps: int = 0,
) -> ThinkEvent:
    """Create a thinking event."""
    return ThinkEvent(
        query_id=query_id,
        reasoning=reasoning,
        plan=plan or [],
        step=step,
        total_steps=total_steps,
    )


def act_event(
    query_id: str,
    tool_name: str,
    tool_arguments: dict[str, Any],
    agent_id: str = "",
    step: int = 0,
) -> ActEvent:
    """Create an action event."""
    return ActEvent(
        query_id=query_id,
        tool_name=tool_name,
        tool_arguments=tool_arguments,
        agent_id=agent_id,
        step=step,
    )


def observe_event(
    query_id: str,
    tool_name: str,
    result_preview: str,
    success: bool = True,
    duration_ms: int = 0,
    step: int = 0,
) -> ObserveEvent:
    """Create an observation event."""
    return ObserveEvent(
        query_id=query_id,
        tool_name=tool_name,
        result_preview=result_preview[:500],  # Truncate for preview
        result_length=len(result_preview),
        success=success,
        duration_ms=duration_ms,
        step=step,
    )


def delegate_event(
    query_id: str,
    from_agent: str,
    to_agent: str,
    to_agent_name: str,
    confidence: float,
    reason: str = "",
) -> DelegateEvent:
    """Create a delegation event."""
    return DelegateEvent(
        query_id=query_id,
        from_agent=from_agent,
        to_agent=to_agent,
        to_agent_name=to_agent_name,
        confidence=confidence,
        reason=reason,
    )


def stream_event(
    query_id: str,
    token: str,
    accumulated: str = "",
    is_final: bool = False,
) -> StreamEvent:
    """Create a streaming event."""
    return StreamEvent(
        query_id=query_id,
        token=token,
        accumulated=accumulated,
        is_final=is_final,
    )


def answer_event(
    query_id: str,
    answer: str,
    confidence: float = 0.0,
    grounded: bool = True,
    sources: list[dict] | None = None,
    tool_calls: list[dict] | None = None,
    duration_ms: int = 0,
    agent_id: str = "",
    out_of_domain: bool = False,
) -> AnswerEvent:
    """Create an answer event."""
    return AnswerEvent(
        query_id=query_id,
        answer=answer,
        confidence=confidence,
        grounded=grounded,
        sources=sources or [],
        tool_calls=tool_calls or [],
        duration_ms=duration_ms,
        agent_id=agent_id,
        out_of_domain=out_of_domain,
    )


def error_event(
    query_id: str,
    error: str,
    error_type: str = "error",
    recoverable: bool = True,
    step: int = 0,
) -> ErrorEvent:
    """Create an error event."""
    return ErrorEvent(
        query_id=query_id,
        error=error,
        error_type=error_type,
        recoverable=recoverable,
        step=step,
    )


def status_event(
    query_id: str,
    status: str,
    message: str = "",
    progress: float = 0.0,
    agents_active: list[str] | None = None,
) -> StatusEvent:
    """Create a status event."""
    return StatusEvent(
        query_id=query_id,
        status=status,
        message=message,
        progress=progress,
        agents_active=agents_active or [],
    )


def clarify_event(
    query_id: str,
    clarification_questions: list[dict[str, Any]],
    agent_id: str = "",
) -> ClarifyEvent:
    """Create a clarification request event."""
    return ClarifyEvent(
        query_id=query_id,
        clarification_questions=clarification_questions,
        agent_id=agent_id,
    )
