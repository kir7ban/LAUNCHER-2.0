"""Tests for event types and serialization."""

import json
from datetime import datetime

import pytest


class TestEventTypes:
    """Test event type enums and base classes."""
    
    def test_event_type_enum(self):
        """Test EventType enum values."""
        from events import EventType
        
        assert EventType.THINK.value == "think"
        assert EventType.ACT.value == "act"
        assert EventType.OBSERVE.value == "observe"
        assert EventType.DELEGATE.value == "delegate"
        assert EventType.STREAM.value == "stream"
        assert EventType.ANSWER.value == "answer"
        assert EventType.ERROR.value == "error"
        assert EventType.STATUS.value == "status"
    
    def test_base_event_defaults(self):
        """Test BaseEvent default values."""
        from events import BaseEvent, EventType
        
        event = BaseEvent(type=EventType.THINK)
        
        assert event.type == EventType.THINK
        assert event.query_id == ""
        assert event.timestamp is not None
        # Timestamp should be ISO format
        datetime.fromisoformat(event.timestamp)
    
    def test_base_event_to_dict(self):
        """Test BaseEvent to_dict conversion."""
        from events import BaseEvent, EventType
        
        event = BaseEvent(type=EventType.ACT, query_id="test-123")
        data = event.to_dict()
        
        assert data["type"] == "act"
        assert data["query_id"] == "test-123"
        assert "timestamp" in data
    
    def test_base_event_to_json(self):
        """Test BaseEvent to_json serialization."""
        from events import BaseEvent, EventType
        
        event = BaseEvent(type=EventType.ERROR, query_id="err-456")
        json_str = event.to_json()
        
        # Should be valid JSON
        parsed = json.loads(json_str)
        assert parsed["type"] == "error"
        assert parsed["query_id"] == "err-456"


class TestThinkEvent:
    """Test ThinkEvent creation and serialization."""
    
    def test_think_event_creation(self):
        """Test ThinkEvent with all fields."""
        from events import ThinkEvent
        
        event = ThinkEvent(
            query_id="q-123",
            reasoning="Analyzing the input...",
            plan=["Step 1", "Step 2", "Step 3"],
            step=1,
            total_steps=3,
        )
        
        assert event.reasoning == "Analyzing the input..."
        assert len(event.plan) == 3
        assert event.step == 1
        assert event.total_steps == 3
    
    def test_think_event_factory(self):
        """Test think_event factory function."""
        from events import think_event
        
        event = think_event(
            query_id="q-456",
            reasoning="Planning...",
            plan=["A", "B"],
        )
        
        assert event.query_id == "q-456"
        assert event.reasoning == "Planning..."
    
    def test_think_event_empty_plan(self):
        """Test ThinkEvent with empty plan."""
        from events import think_event
        
        event = think_event(query_id="q-1", reasoning="Thinking...")
        assert event.plan == []
    
    def test_think_event_serialization(self):
        """Test ThinkEvent JSON serialization."""
        from events import think_event
        
        event = think_event(
            query_id="q-1",
            reasoning="Test",
            plan=["A"],
            step=2,
            total_steps=5,
        )
        data = event.to_dict()
        
        assert data["type"] == "think"
        assert data["reasoning"] == "Test"
        assert data["plan"] == ["A"]
        assert data["step"] == 2
        assert data["total_steps"] == 5


class TestActEvent:
    """Test ActEvent creation and serialization."""
    
    def test_act_event_creation(self):
        """Test ActEvent with all fields."""
        from events import ActEvent
        
        event = ActEvent(
            query_id="q-123",
            tool_name="search_documents",
            tool_arguments={"query": "test", "limit": 5},
            agent_id="agent-1",
            step=1,
        )
        
        assert event.tool_name == "search_documents"
        assert event.tool_arguments["query"] == "test"
        assert event.agent_id == "agent-1"
    
    def test_act_event_factory(self):
        """Test act_event factory function."""
        from events import act_event
        
        event = act_event(
            query_id="q-1",
            tool_name="get_info",
            tool_arguments={"id": 123},
        )
        
        assert event.tool_name == "get_info"
        assert event.tool_arguments == {"id": 123}
    
    def test_act_event_empty_arguments(self):
        """Test ActEvent with empty arguments."""
        from events import act_event
        
        event = act_event(
            query_id="q-1",
            tool_name="no_args_tool",
            tool_arguments={},
        )
        
        assert event.tool_arguments == {}
    
    def test_act_event_serialization(self):
        """Test ActEvent serialization preserves complex arguments."""
        from events import act_event
        
        complex_args = {
            "nested": {"a": 1, "b": [1, 2, 3]},
            "list": ["x", "y"],
            "null": None,
        }
        
        event = act_event(
            query_id="q-1",
            tool_name="complex_tool",
            tool_arguments=complex_args,
        )
        
        json_str = event.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["tool_arguments"]["nested"]["a"] == 1
        assert parsed["tool_arguments"]["list"] == ["x", "y"]


class TestObserveEvent:
    """Test ObserveEvent creation and serialization."""
    
    def test_observe_event_success(self):
        """Test ObserveEvent for successful tool call."""
        from events import observe_event
        
        event = observe_event(
            query_id="q-1",
            tool_name="search",
            result_preview="Found 5 results...",
            success=True,
            duration_ms=150,
            step=1,
        )
        
        assert event.success is True
        assert event.duration_ms == 150
        assert "Found 5 results" in event.result_preview
    
    def test_observe_event_failure(self):
        """Test ObserveEvent for failed tool call."""
        from events import observe_event
        
        event = observe_event(
            query_id="q-1",
            tool_name="failing_tool",
            result_preview="Error: timeout",
            success=False,
            duration_ms=5000,
        )
        
        assert event.success is False
    
    def test_observe_event_truncation(self):
        """Test result_preview is truncated."""
        from events import observe_event
        
        long_result = "x" * 1000
        event = observe_event(
            query_id="q-1",
            tool_name="test",
            result_preview=long_result,
        )
        
        # Should be truncated to 500 chars
        assert len(event.result_preview) <= 500
    
    def test_observe_event_result_length(self):
        """Test result_length is set correctly."""
        from events import observe_event
        
        result = "Short result"
        event = observe_event(
            query_id="q-1",
            tool_name="test",
            result_preview=result,
        )
        
        assert event.result_length == len(result)


class TestDelegateEvent:
    """Test DelegateEvent creation and serialization."""
    
    def test_delegate_event_creation(self):
        """Test DelegateEvent creation."""
        from events import delegate_event
        
        event = delegate_event(
            query_id="q-1",
            from_agent="orchestrator",
            to_agent="specialist-1",
            to_agent_name="Specialist Agent",
            confidence=0.95,
            reason="Query matches specialist domain",
        )
        
        assert event.from_agent == "orchestrator"
        assert event.to_agent == "specialist-1"
        assert event.confidence == 0.95
    
    def test_delegate_event_no_reason(self):
        """Test DelegateEvent without reason."""
        from events import delegate_event
        
        event = delegate_event(
            query_id="q-1",
            from_agent="a",
            to_agent="b",
            to_agent_name="B",
            confidence=0.5,
        )
        
        assert event.reason == ""


class TestAnswerEvent:
    """Test AnswerEvent creation and serialization."""
    
    def test_answer_event_full(self):
        """Test AnswerEvent with all fields."""
        from events import answer_event
        
        event = answer_event(
            query_id="q-1",
            answer="This is the complete answer.",
            confidence=0.92,
            grounded=True,
            sources=[
                {"source": "doc1.pdf", "page": 3},
                {"source": "doc2.pdf", "page": 7},
            ],
            tool_calls=[
                {"tool": "search", "success": True},
                {"tool": "summarize", "success": True},
            ],
            duration_ms=2500,
            agent_id="agent-1",
            out_of_domain=False,
        )
        
        assert "complete answer" in event.answer
        assert event.confidence == 0.92
        assert len(event.sources) == 2
        assert len(event.tool_calls) == 2
        assert event.out_of_domain is False
    
    def test_answer_event_out_of_domain(self):
        """Test AnswerEvent for out-of-domain query."""
        from events import answer_event
        
        event = answer_event(
            query_id="q-1",
            answer="I cannot answer this query.",
            confidence=0.1,
            grounded=False,
            out_of_domain=True,
        )
        
        assert event.out_of_domain is True
        assert event.grounded is False
        assert event.confidence == 0.1
    
    def test_answer_event_serialization(self):
        """Test AnswerEvent JSON serialization."""
        from events import answer_event
        
        event = answer_event(
            query_id="q-1",
            answer="Test",
            confidence=0.8,
        )
        
        data = event.to_dict()
        assert data["type"] == "answer"
        assert data["answer"] == "Test"


class TestErrorEvent:
    """Test ErrorEvent creation and serialization."""
    
    def test_error_event_recoverable(self):
        """Test ErrorEvent for recoverable error."""
        from events import error_event
        
        event = error_event(
            query_id="q-1",
            error="Temporary timeout, retrying...",
            error_type="timeout",
            recoverable=True,
            step=2,
        )
        
        assert event.recoverable is True
        assert event.error_type == "timeout"
    
    def test_error_event_fatal(self):
        """Test ErrorEvent for fatal error."""
        from events import error_event
        
        event = error_event(
            query_id="q-1",
            error="Authentication failed",
            error_type="auth_error",
            recoverable=False,
        )
        
        assert event.recoverable is False


class TestStatusEvent:
    """Test StatusEvent creation and serialization."""
    
    def test_status_event_with_progress(self):
        """Test StatusEvent with progress."""
        from events import status_event
        
        event = status_event(
            query_id="q-1",
            status="processing",
            message="Retrieving documents...",
            progress=0.45,
            agents_active=["agent-1", "agent-2"],
        )
        
        assert event.progress == 0.45
        assert len(event.agents_active) == 2
    
    def test_status_event_progress_bounds(self):
        """Test StatusEvent accepts progress values."""
        from events import status_event
        
        # Should accept 0.0 to 1.0
        event_min = status_event(query_id="q", status="s", progress=0.0)
        event_max = status_event(query_id="q", status="s", progress=1.0)
        
        assert event_min.progress == 0.0
        assert event_max.progress == 1.0


class TestEventEdgeCases:
    """Test edge cases for events."""
    
    def test_special_characters_in_answer(self):
        """Test answer with special characters."""
        from events import answer_event
        
        special_answer = 'Answer with "quotes" and \n newlines and \t tabs'
        event = answer_event(query_id="q-1", answer=special_answer)
        
        # Should serialize without error
        json_str = event.to_json()
        parsed = json.loads(json_str)
        assert parsed["answer"] == special_answer
    
    def test_unicode_in_events(self):
        """Test unicode characters in events."""
        from events import think_event
        
        event = think_event(
            query_id="q-1",
            reasoning="分析中... Analyzing... 🤔",
        )
        
        json_str = event.to_json()
        parsed = json.loads(json_str)
        assert "分析中" in parsed["reasoning"]
        assert "🤔" in parsed["reasoning"]
    
    def test_empty_strings(self):
        """Test events with empty strings."""
        from events import answer_event
        
        event = answer_event(
            query_id="",
            answer="",
            confidence=0.0,
        )
        
        assert event.query_id == ""
        assert event.answer == ""
    
    def test_very_long_content(self):
        """Test events with very long content."""
        from events import answer_event
        
        long_answer = "a" * 100000
        event = answer_event(query_id="q-1", answer=long_answer)
        
        # Should serialize without truncation in answer_event
        assert len(event.answer) == 100000
        
        # JSON should still work
        json_str = event.to_json()
        assert len(json_str) > 100000
    
    def test_negative_duration(self):
        """Test negative duration value."""
        from events import observe_event
        
        event = observe_event(
            query_id="q-1",
            tool_name="test",
            result_preview="result",
            duration_ms=-100,
        )
        
        # Should accept negative (validation elsewhere)
        assert event.duration_ms == -100
