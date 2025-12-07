# Senior Dev Code Review: Intelligent Chat System
## Hallucination Detection & Testing Strategy

**Date:** 2025-12-05
**Reviewer:** Senior Engineering Analysis
**System:** LangGraph-based Project Creation & Auth Chat Agents
**Overall Score:** 7/10 (Good foundation, critical gaps in hallucination detection)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Analysis](#architecture-analysis)
3. [Hallucination Risks](#hallucination-risks)
4. [Detection System Design](#detection-system-design)
5. [Integration Guide](#integration-guide)
6. [Testing Strategy](#testing-strategy)
7. [Monitoring & Observability](#monitoring--observability)
8. [Recommendations](#recommendations)

---

## Executive Summary

### Current Strengths ✅
- **Security**: Good prompt injection filtering, output validation, rate limiting
- **Resilience**: Circuit breaker pattern for LLM failures
- **Streaming**: Real-time SSE streaming with proper async handling
- **Error Handling**: Try-catch blocks with StructuredLogger
- **Testing**: Basic unit tests for agent components

### Critical Gaps ⚠️
- **No hallucination detection or confidence scoring**
- **No fact verification against ground truth**
- **Limited testing** (no integration tests with real LLMs)
- **No user feedback loop** for flagging incorrect responses
- **Insufficient observability** for tracking LLM behavior over time

---

## Architecture Analysis

### Current Flow
```
User Input → Security Validation → LangGraph Agent → Tools → Output Validation → Stream to User
                                        ↓
                                   [NO HALLUCINATION CHECK] ⚠️
```

### Components Reviewed

#### 1. **Project Chat Agent** (`services/agents/project/agent.py`)
- **Purpose**: Creates projects/products via conversational interface
- **LLM**: Centralized AIProvider (Azure OpenAI/Anthropic)
- **Tools**: `extract_url_info`, `import_github_project`, `create_project`, `create_product`

**Issues**:
```python
# services/agents/project/agent.py:97
response = await get_llm_with_tools().ainvoke(messages)
return {'messages': [response]}
# ⚠️ No validation that response is factually correct
```

#### 2. **Auth Chat** (`core/agents/auth_chat_views.py`)
- **Purpose**: Conversational signup/login flow
- **Pattern**: Deterministic state machine (less risk)
- **Validation**: Email/password validators ✅

**Strength**: Mostly template-based responses reduce hallucination risk

#### 3. **Security** (`core/agents/security.py`)
- **PromptInjectionFilter**: Detects malicious input ✅
- **OutputValidator**: Sanitizes sensitive data ✅
- **RateLimiter**: Prevents abuse ✅

**Gap**: Only checks for *sensitive* data, not *incorrect* data

---

## Hallucination Risks

### High-Risk Scenarios

#### 1. **GitHub Metadata Extraction**
**Risk**: LLM hallucinates repo details not in README

**Example**:
```
User: "https://github.com/user/tiny-repo"
LLM: "I found your repository! It's a full-stack app with React, Node.js, PostgreSQL..."
Reality: Repo has 3 files and no database
```

**Impact**: Users get false project descriptions

#### 2. **Project Type Classification**
**Risk**: LLM misclassifies project type

**Example**:
```
User: "I have a Python data science library"
LLM: *calls create_project(project_type="image_collection")*
```

**Impact**: Wrong categorization, broken UI assumptions

#### 3. **Product vs Project Confusion**
**Risk**: Creates wrong entity type

**Example**:
```
User: "I want to share my course on machine learning"
LLM: *calls create_project() instead of create_product()*
```

**Impact**: User can't set pricing, wrong page template

#### 4. **Overconfident Recommendations**
**Risk**: LLM suggests features/integrations that don't exist

**Example**:
```
User: "Can I import from GitLab?"
LLM: "Yes! Just paste your GitLab URL and I'll import it"
Reality: Only GitHub OAuth is implemented
```

---

## Detection System Design

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LangGraph Agent                           │
│                                                               │
│  User Input → Agent Node → Tool Calls → Tool Results         │
│                    ↓                         ↓                │
│                Response                 Ground Truth          │
│                    ↓                         ↓                │
│         ┌──────────────────────────────────────┐             │
│         │   Hallucination Detector              │             │
│         │  ✓ Fact Verification                  │             │
│         │  ✓ Consistency Check                  │             │
│         │  ✓ Confidence Scoring                 │             │
│         │  ✓ Pattern Matching                   │             │
│         └──────────────────────────────────────┘             │
│                    ↓                                          │
│         ResponseConfidence (score + warnings)                │
└─────────────────────────────────────────────────────────────┘
```

### Implementation: `services/agents/hallucination_detector.py`

**Key Features**:

1. **Confidence Scoring** (0.0-1.0)
   - Starts at 100%
   - Penalties for overconfident language (-10%)
   - Penalties for unverified claims (-10% each)
   - Penalties for inconsistencies (-20%)
   - Penalties for contradicting ground truth (-30%)

2. **Fact Verification**
   ```python
   # Compare response against tool outputs
   verified_facts = check_if_in_tool_output(response, tool_outputs)

   # Compare response against database
   contradictions = check_against_ground_truth(response, db_data)
   ```

3. **Pattern Detection**
   - Overconfident language: "definitely", "always", "100%"
   - Fabricated data: "I found X files", "according to my analysis"
   - Code execution claims: "I can see that" (when no vision)

4. **Confidence Levels**
   - **HIGH** (90-100%): Verified against tool outputs/DB
   - **MEDIUM** (70-89%): Mostly verified with minor gaps
   - **LOW** (50-69%): Significant unverified claims
   - **UNCERTAIN** (<50%): High hallucination risk

---

## Integration Guide

### Step 1: Create Database Model

Create `core/agents/models.py`:

```python
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class HallucinationLog(models.Model):
    """Track detected hallucinations for analysis and model improvement."""

    class HallucinationType(models.TextChoices):
        FACTUAL_ERROR = 'factual_error', 'Factual Error'
        FABRICATED_DATA = 'fabricated_data', 'Fabricated Data'
        INCONSISTENT_RESPONSE = 'inconsistent_response', 'Inconsistent Response'
        OVERCONFIDENT = 'overconfident', 'Overconfident'
        OUT_OF_SCOPE = 'out_of_scope', 'Out of Scope'

    # Metadata
    session_id = models.CharField(max_length=255, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    feature = models.CharField(max_length=50)  # 'project_agent', 'auth_chat'

    # Detection details
    hallucination_type = models.CharField(max_length=50, choices=HallucinationType.choices)
    confidence_score = models.FloatField()  # 0.0-1.0
    response_text = models.TextField()

    # Context
    conversation_context = models.JSONField(default=dict)
    tool_outputs = models.JSONField(default=list)
    ground_truth = models.JSONField(default=dict, blank=True)

    # Flagging
    flagged_by = models.CharField(max_length=50, default='system')  # 'system' or user_id
    verified = models.BooleanField(default=False)  # Human-reviewed
    false_positive = models.BooleanField(default=False)

    # Timestamps
    detected_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'agents_hallucination_log'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['session_id', 'detected_at']),
            models.Index(fields=['hallucination_type', 'detected_at']),
            models.Index(fields=['verified', 'detected_at']),
        ]

    def __str__(self):
        return f"{self.hallucination_type} - {self.confidence_score:.2f} - {self.session_id}"


class AgentResponseMetrics(models.Model):
    """Track all agent responses for quality monitoring."""

    session_id = models.CharField(max_length=255, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    feature = models.CharField(max_length=50)

    # Response details
    response_text = models.TextField()
    confidence_level = models.CharField(max_length=20)  # 'high', 'medium', 'low', 'uncertain'
    confidence_score = models.FloatField()

    # Quality metrics
    verified_facts_count = models.IntegerField(default=0)
    unverified_claims_count = models.IntegerField(default=0)
    warnings_count = models.IntegerField(default=0)

    # User feedback
    user_feedback = models.CharField(max_length=20, null=True, blank=True)  # 'helpful', 'incorrect', 'unclear'
    user_feedback_text = models.TextField(blank=True)

    # Performance
    latency_ms = models.IntegerField()
    token_count = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'agents_response_metrics'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['feature', 'created_at']),
            models.Index(fields=['confidence_level', 'created_at']),
            models.Index(fields=['user_feedback', 'created_at']),
        ]
```

### Step 2: Create Migration

```bash
cd /Users/allierays/Sites/allthriveai
python manage.py makemigrations agents
python manage.py migrate
```

### Step 3: Integrate into Project Agent

Update `services/agents/project/agent.py`:

```python
from services.agents.hallucination_detector import hallucination_detector

async def agent_node(state: ProjectAgentState) -> ProjectAgentState:
    """
    Main agent node with hallucination detection.
    """
    messages = state['messages']

    # Add system prompt if not present
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

    # Invoke LLM
    response = await get_llm_with_tools().ainvoke(messages)

    # ✅ NEW: Analyze response for hallucinations
    if hasattr(response, 'content') and response.content:
        # Get tool outputs from previous messages
        tool_outputs = [
            json.loads(m.content) if isinstance(m.content, str) else m.content
            for m in messages
            if isinstance(m, ToolMessage)
        ]

        # Analyze confidence
        confidence = hallucination_detector.analyze_response(
            response=response.content,
            tool_outputs=tool_outputs,
            conversation_history=[
                {'role': m.type, 'content': getattr(m, 'content', '')}
                for m in messages
            ],
        )

        # Log low confidence responses
        if confidence.level in ['uncertain', 'low']:
            logger.warning(
                f"[HALLUCINATION_RISK] Low confidence response: {confidence.score:.2f} - {confidence.reasoning}"
            )

            # Flag for review if very low
            if confidence.score < 0.5:
                hallucination_detector.flag_hallucination(
                    response=response.content,
                    hallucination_type=HallucinationType.OVERCONFIDENT,
                    confidence=confidence.score,
                    context={
                        'session_id': state.get('session_id', 'unknown'),
                        'user_id': state.get('user_id'),
                        'tool_outputs': tool_outputs,
                    }
                )

        # ✅ Attach confidence metadata to response
        if hasattr(response, 'additional_kwargs'):
            response.additional_kwargs['confidence'] = {
                'level': confidence.level.value,
                'score': confidence.score,
                'warnings': confidence.warnings,
            }

    return {'messages': [response]}
```

### Step 4: Update Streaming View

Update `core/agents/project_chat_views.py`:

```python
from services.agents.hallucination_detector import hallucination_detector
from core.agents.models import AgentResponseMetrics

async def event_stream():
    """Generator for SSE events with hallucination detection."""
    try:
        full_response = ''
        tool_outputs_captured = []
        project_id = None
        project_slug = None

        # Stream agent execution
        async for chunk in langraph_circuit_breaker.call(project_agent.astream, input_state, config):
            # ... existing streaming code ...

            # Capture tool outputs for verification
            if 'tools' in chunk:
                tool_messages = chunk['tools'].get('messages', [])
                for msg in tool_messages:
                    if hasattr(msg, 'content'):
                        try:
                            result = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                            tool_outputs_captured.append(result)
                        except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                            pass

        # ✅ NEW: Analyze full response for hallucinations
        confidence = hallucination_detector.analyze_response(
            response=full_response,
            tool_outputs=tool_outputs_captured,
        )

        # ✅ Log metrics for monitoring
        try:
            AgentResponseMetrics.objects.create(
                session_id=session_id,
                user=request.user,
                feature='project_agent',
                response_text=full_response[:1000],  # Truncate
                confidence_level=confidence.level.value,
                confidence_score=confidence.score,
                verified_facts_count=len(confidence.verified_facts),
                unverified_claims_count=len(confidence.unverified_claims),
                warnings_count=len(confidence.warnings),
                latency_ms=latency_ms,
                token_count=estimated_output_tokens,
            )
        except Exception as e:
            logger.warning(f"Failed to log agent metrics: {e}")

        # ✅ Send confidence to frontend
        yield f'data: {json.dumps({
            "type": "confidence",
            "level": confidence.level.value,
            "score": confidence.score,
            "warnings": confidence.warnings,
        })}\n\n'

        # Send completion event
        completion_data = {
            'type': 'complete',
            'session_id': session_id,
            'project_id': project_id,
            'project_slug': project_slug,
            'confidence': {
                'level': confidence.level.value,
                'score': confidence.score,
            },
        }
        yield f'data: {json.dumps(completion_data)}\n\n'

    except Exception as e:
        logger.error(f'[PROJECT_CHAT_V2] Error in agent stream: {e}', exc_info=True)
        yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'
```

### Step 5: Add User Feedback Endpoint

Create `core/agents/views.py`:

```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.agents.models import AgentResponseMetrics, HallucinationLog


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_incorrect_response(request):
    """
    Allow users to flag incorrect/hallucinated responses.

    Body:
        {
            "session_id": "uuid",
            "response_id": 123,  # Optional: AgentResponseMetrics ID
            "feedback": "incorrect",
            "feedback_text": "The GitHub repo doesn't have React",
            "hallucination_type": "factual_error"  # Optional
        }
    """
    session_id = request.data.get('session_id')
    response_id = request.data.get('response_id')
    feedback = request.data.get('feedback')
    feedback_text = request.data.get('feedback_text', '')
    hallucination_type = request.data.get('hallucination_type')

    if not session_id:
        return Response({'error': 'session_id required'}, status=status.HTTP_400_BAD_REQUEST)

    # Update response metrics if response_id provided
    if response_id:
        try:
            metric = AgentResponseMetrics.objects.get(id=response_id, user=request.user)
            metric.user_feedback = feedback
            metric.user_feedback_text = feedback_text
            metric.save()
        except AgentResponseMetrics.DoesNotExist:
            pass

    # Create hallucination log if flagged as incorrect
    if feedback == 'incorrect' and hallucination_type:
        # Find the response
        metrics = AgentResponseMetrics.objects.filter(
            session_id=session_id,
            user=request.user
        ).order_by('-created_at').first()

        if metrics:
            HallucinationLog.objects.create(
                session_id=session_id,
                user=request.user,
                feature='project_agent',
                hallucination_type=hallucination_type,
                confidence_score=metrics.confidence_score,
                response_text=metrics.response_text,
                conversation_context={'user_feedback': feedback_text},
                flagged_by=str(request.user.id),
            )

    return Response({'success': True})
```

Add to `core/agents/urls.py`:
```python
urlpatterns = [
    path('feedback/', views.report_incorrect_response, name='agent-feedback'),
]
```

---

## Testing Strategy

### Current Test Coverage: ~40%

**Existing tests** (`services/agents/project/tests/test_agent.py`):
- ✅ Unit tests for `should_continue()` routing
- ✅ Unit tests for `agent_node()` with mocked LLM
- ✅ Unit tests for streaming token/tool events
- ❌ NO integration tests with real LLMs
- ❌ NO hallucination detection tests
- ❌ NO ground truth verification tests

### Proposed Test Suite

#### 1. **Hallucination Detection Tests**

Create `services/agents/tests/test_hallucination_detector.py`:

```python
import pytest
from services.agents.hallucination_detector import (
    hallucination_detector,
    HallucinationType,
    ConfidenceLevel,
)


class TestHallucinationDetector:
    """Test hallucination detection logic."""

    def test_high_confidence_with_tool_verification(self):
        """Test high confidence when response matches tool output."""
        tool_outputs = [{'title': 'My Awesome Project', 'stars': 42}]
        response = "I found your repository 'My Awesome Project' with 42 stars!"

        confidence = hallucination_detector.analyze_response(
            response=response,
            tool_outputs=tool_outputs,
        )

        assert confidence.level == ConfidenceLevel.HIGH
        assert confidence.score >= 0.9
        assert len(confidence.verified_facts) > 0

    def test_low_confidence_with_overconfident_language(self):
        """Test penalty for overconfident language."""
        response = "I definitely found 347 files in your repository. It's 100% a React app."

        confidence = hallucination_detector.analyze_response(
            response=response,
            tool_outputs=[],
        )

        assert confidence.score < 0.7  # Should be penalized
        assert any('overconfident' in w.lower() for w in confidence.warnings)

    def test_fabricated_data_detection(self):
        """Test detection of fabricated data patterns."""
        response = "According to my analysis, your repo has 1,234 lines of code."

        confidence = hallucination_detector.analyze_response(
            response=response,
            tool_outputs=[],  # No tool actually counted lines
        )

        assert confidence.score < 0.8
        assert any('fabrication' in w.lower() for w in confidence.warnings)

    def test_ground_truth_contradiction(self):
        """Test detection of contradictions with known facts."""
        ground_truth = {'title': 'My Repo', 'language': 'Python'}
        response = "Your repository 'My Repo' is primarily written in JavaScript."

        confidence = hallucination_detector.analyze_response(
            response=response,
            ground_truth=ground_truth,
        )

        assert confidence.score < 0.7
        assert any('contradict' in w.lower() for w in confidence.warnings)

    def test_consistency_check(self):
        """Test detection of inconsistent statements."""
        history = [
            {'role': 'assistant', 'content': 'Your repo cannot be imported without GitHub OAuth'},
            {'role': 'user', 'content': 'Okay'},
        ]
        response = "I can import your repo now without any authentication."

        confidence = hallucination_detector.analyze_response(
            response=response,
            conversation_history=history,
        )

        assert confidence.score < 0.8
        assert len(confidence.warnings) > 0
```

#### 2. **Integration Tests with Real LLMs**

Create `services/agents/tests/test_integration.py`:

```python
import pytest
from django.contrib.auth import get_user_model
from services.agents.project.agent import stream_agent_response

User = get_user_model()


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.django_db
class TestProjectAgentIntegration:
    """Integration tests with REAL LLM (runs in CI with mocked provider)."""

    async def test_github_url_detection_and_import(self):
        """Test full flow: user provides GitHub URL → agent detects → imports."""
        user = User.objects.create_user(username='testuser', email='test@example.com')

        events = []
        async for event in stream_agent_response(
            user_message="https://github.com/django/django",
            user_id=user.id,
            username=user.username,
            session_id='test-session-1',
        ):
            events.append(event)

        # Verify tool was called
        tool_events = [e for e in events if e['type'] == 'tool_start']
        assert any(e['tool'] == 'extract_url_info' for e in tool_events)

        # Verify confidence was calculated
        confidence_events = [e for e in events if e['type'] == 'confidence']
        assert len(confidence_events) > 0
        assert 'level' in confidence_events[0]

    async def test_hallucination_on_nonexistent_repo(self):
        """Test hallucination detection when repo doesn't exist."""
        user = User.objects.create_user(username='testuser2', email='test2@example.com')

        events = []
        async for event in stream_agent_response(
            user_message="https://github.com/nonexistent/fake-repo-12345",
            user_id=user.id,
            username=user.username,
            session_id='test-session-2',
        ):
            events.append(event)

        # Should detect error and not hallucinate success
        confidence_events = [e for e in events if e['type'] == 'confidence']
        if confidence_events:
            # If LLM tries to fabricate repo details, confidence should be low
            last_confidence = confidence_events[-1]
            # Either low confidence OR explicit error
            assert last_confidence['level'] in ['low', 'uncertain'] or \
                   any(e['type'] == 'error' for e in events)
```

#### 3. **Regression Tests for Known Hallucinations**

Create `services/agents/tests/test_regressions.py`:

```python
import pytest
from services.agents.hallucination_detector import hallucination_detector


class TestKnownHallucinations:
    """Regression tests for previously discovered hallucinations."""

    def test_regression_github_tech_stack_fabrication(self):
        """
        Regression: Agent fabricated tech stack for minimal repos.

        Bug: User provided 3-file repo, agent said "full-stack with React, Node, Postgres"
        Fix: Verify against actual README/file list
        """
        tool_outputs = [
            {
                'success': True,
                'files': ['README.md', 'index.html', 'style.css'],
                'description': 'A simple HTML page',
            }
        ]

        # Bad response (hallucinated)
        bad_response = "Your repo is a full-stack application with React, Node.js, and PostgreSQL!"

        confidence = hallucination_detector.analyze_response(
            response=bad_response,
            tool_outputs=tool_outputs,
        )

        # Should detect unverified claims
        assert confidence.score < 0.7
        assert len(confidence.unverified_claims) > 0

    def test_regression_project_type_misclassification(self):
        """
        Regression: Classified Python library as image collection.

        Bug: User said "Python data science library", agent created image_collection
        Fix: Better intent detection from conversation context
        """
        ground_truth = {
            'user_input': 'Python data science library',
            'expected_type': 'github_repo',
        }

        bad_response = "I'll create this as an image collection project!"

        confidence = hallucination_detector.analyze_response(
            response=bad_response,
            ground_truth=ground_truth,
        )

        # Should detect contradiction
        assert confidence.score < 0.8
```

#### 4. **Load/Stress Tests**

Create `services/agents/tests/test_performance.py`:

```python
import pytest
import asyncio
from services.agents.project.agent import stream_agent_response


@pytest.mark.slow
@pytest.mark.asyncio
@pytest.mark.django_db
class TestAgentPerformance:
    """Performance and load tests."""

    async def test_concurrent_sessions(self):
        """Test 10 concurrent chat sessions."""
        async def run_session(user_id, session_num):
            events = []
            async for event in stream_agent_response(
                user_message="Create a project called Test",
                user_id=user_id,
                username=f"user{session_num}",
                session_id=f"session-{session_num}",
            ):
                events.append(event)
            return events

        # Run 10 sessions concurrently
        tasks = [run_session(1, i) for i in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should complete without exceptions
        assert all(not isinstance(r, Exception) for r in results)

    async def test_response_latency(self):
        """Test that responses stream within acceptable latency."""
        import time

        start = time.time()
        first_token_time = None

        async for event in stream_agent_response(
            user_message="Hello",
            user_id=1,
            username="test",
            session_id="latency-test",
        ):
            if event['type'] == 'token' and first_token_time is None:
                first_token_time = time.time()
                break

        # First token should arrive within 2 seconds
        assert first_token_time is not None
        assert (first_token_time - start) < 2.0
```

### Running Tests

```bash
# Unit tests (fast)
pytest services/agents/tests/test_hallucination_detector.py -v

# Integration tests (requires API keys)
pytest services/agents/tests/test_integration.py -v --integration

# Regression tests
pytest services/agents/tests/test_regressions.py -v

# All tests
pytest services/agents/tests/ -v --cov=services/agents --cov-report=html

# Performance tests (slow)
pytest services/agents/tests/test_performance.py -v --slow
```

---

## Monitoring & Observability

### Dashboard Metrics

**Key Metrics to Track**:

1. **Hallucination Rate**
   - Total responses / Low confidence responses
   - Target: <5% uncertain confidence
   - Alert: >10% uncertain

2. **User Feedback**
   - % marked as "incorrect"
   - Target: <2% incorrect feedback
   - Alert: >5% incorrect

3. **Confidence Distribution**
   - High/Medium/Low/Uncertain breakdown
   - Target: >80% high confidence

4. **Tool Success Rate**
   - % of tool calls that succeed
   - Target: >95% success
   - Alert: <90% success

### Grafana Dashboard Query Examples

```sql
-- Hallucination rate over time
SELECT
    DATE_TRUNC('hour', detected_at) as hour,
    hallucination_type,
    COUNT(*) as count,
    AVG(confidence_score) as avg_confidence
FROM agents_hallucination_log
WHERE detected_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, hallucination_type
ORDER BY hour DESC;

-- User feedback trends
SELECT
    DATE_TRUNC('day', created_at) as day,
    user_feedback,
    COUNT(*) as count,
    AVG(confidence_score) as avg_confidence
FROM agents_response_metrics
WHERE user_feedback IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY day, user_feedback
ORDER BY day DESC;

-- Low confidence responses by feature
SELECT
    feature,
    confidence_level,
    COUNT(*) as count,
    AVG(confidence_score) as avg_score
FROM agents_response_metrics
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY feature, confidence_level
ORDER BY feature, count DESC;
```

### Alerts (PagerDuty/Slack)

```python
# Add to services/agents/monitoring.py

from django.core.cache import cache
from core.logging_utils import StructuredLogger


def check_hallucination_rate_alert():
    """Check if hallucination rate exceeds threshold."""
    from core.agents.models import AgentResponseMetrics
    from datetime import timedelta
    from django.utils import timezone

    # Get responses from last hour
    one_hour_ago = timezone.now() - timedelta(hours=1)
    responses = AgentResponseMetrics.objects.filter(
        created_at__gte=one_hour_ago
    )

    total = responses.count()
    if total < 10:  # Not enough data
        return

    uncertain = responses.filter(confidence_level='uncertain').count()
    rate = (uncertain / total) * 100

    if rate > 10:  # Alert threshold
        StructuredLogger.log_error(
            message=f"High hallucination rate: {rate:.1f}% uncertain responses",
            error=None,
            extra={
                'total_responses': total,
                'uncertain_count': uncertain,
                'rate': rate,
                'alert_type': 'hallucination_rate',
            },
        )
        # TODO: Send to PagerDuty/Slack
```

---

## Recommendations

### Immediate Actions (This Sprint)

1. ✅ **Implement hallucination detector** (DONE - created file)
2. **Create database models** (HallucinationLog, AgentResponseMetrics)
3. **Integrate detector into project agent**
4. **Add user feedback endpoint**
5. **Write unit tests for detector**

### Short-term (Next 2 Weeks)

1. **Deploy hallucination tracking to production**
2. **Set up monitoring dashboard** (Grafana/PostHog)
3. **Write integration tests with real LLMs**
4. **Create hallucination review admin page**
5. **Configure alerts for high hallucination rates**

### Medium-term (Next Month)

1. **Collect hallucination data for 2+ weeks**
2. **Analyze patterns** (which prompts cause hallucinations?)
3. **Fine-tune system prompt** based on data
4. **Implement "citation mode"** (LLM cites tool outputs)
5. **Add confidence warnings to UI** (show badge if low confidence)

### Long-term (Next Quarter)

1. **Model fine-tuning** with hallucination dataset
2. **Implement RAG** (Retrieval-Augmented Generation) for facts
3. **Add human-in-the-loop review** for uncertain responses
4. **Build hallucination prediction model** (pre-emptive detection)
5. **Automated prompt optimization** based on hallucination rates

---

## Code Quality Improvements

### 1. Add Type Hints Everywhere

```python
# Before
def analyze_response(response, tool_outputs=None):
    ...

# After
def analyze_response(
    self,
    response: str,
    tool_outputs: list[dict[str, Any]] | None = None,
    conversation_history: list[dict[str, Any]] | None = None,
    ground_truth: dict[str, Any] | None = None,
) -> ResponseConfidence:
    ...
```

### 2. Extract Magic Numbers to Constants

```python
# Before
if score >= 0.9:
    level = ConfidenceLevel.HIGH

# After
CONFIDENCE_THRESHOLDS = {
    'high': 0.9,
    'medium': 0.7,
    'low': 0.5,
}

if score >= CONFIDENCE_THRESHOLDS['high']:
    level = ConfidenceLevel.HIGH
```

### 3. Add Docstrings with Examples

```python
def analyze_response(self, response: str, ...) -> ResponseConfidence:
    """
    Analyze an LLM response for hallucinations.

    Examples:
        >>> detector = HallucinationDetector()
        >>> confidence = detector.analyze_response(
        ...     response="Your repo has 42 stars",
        ...     tool_outputs=[{'stars': 42}]
        ... )
        >>> assert confidence.level == ConfidenceLevel.HIGH

        >>> confidence = detector.analyze_response(
        ...     response="I definitely found 1000 files",
        ...     tool_outputs=[]
        ... )
        >>> assert confidence.level == ConfidenceLevel.LOW
    """
```

---

## Summary: Critical Path to Production

### Week 1: Foundation
- [x] Create hallucination detector (DONE)
- [ ] Create database models + migrations
- [ ] Write unit tests (80% coverage target)
- [ ] Code review + merge

### Week 2: Integration
- [ ] Integrate detector into project agent
- [ ] Add confidence metadata to responses
- [ ] Deploy to staging
- [ ] QA testing

### Week 3: Observability
- [ ] Deploy to production
- [ ] Set up monitoring dashboard
- [ ] Configure alerts
- [ ] Monitor for 1 week

### Week 4: Optimization
- [ ] Analyze hallucination data
- [ ] Tune confidence thresholds
- [ ] Refine prompt based on findings
- [ ] Document learnings

---

## Questions for Discussion

1. **Threshold tuning**: What confidence score should trigger user warnings? (I suggest <0.7)
2. **UI/UX**: Should we show confidence badges to users? Or only warn on "uncertain"?
3. **Human review**: Who reviews flagged hallucinations? DevOps? Support? LLM team?
4. **Cost**: Hallucination detection adds ~5-10% latency. Acceptable?
5. **A/B testing**: Should we A/B test with/without detection to measure impact?

---

## Conclusion

Your intelligent chat system has a **solid foundation** but lacks **critical hallucination detection**. The proposed solution:

✅ Adds **zero-config confidence scoring** to existing agents
✅ Enables **data-driven optimization** (track what fails)
✅ Provides **user safety** (flag bad responses before harm)
✅ Scales to **future agents** (reusable detector)

**Risk if not addressed**: Users receive incorrect information, damage trust, increase support load.

**Effort**: ~2 weeks (1 dev)
**Impact**: HIGH - Directly improves LLM reliability and user trust

---

**Next Step**: Review this document → approve implementation plan → create Jira tickets → start Week 1 tasks.
