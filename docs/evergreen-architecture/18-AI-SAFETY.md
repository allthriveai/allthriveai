# AI Safety Architecture

**Source of Truth** | **Last Updated**: 2025-12-20

This document describes AllThrive's multi-layer AI safety system including hallucination detection, content moderation, and input/output validation.

---

## 1. Overview

The AI safety system provides defense-in-depth protection:

```
User Input
    ↓
[Input Validation] → Prompt injection, rate limiting, sanitization
    ↓
[Content Moderation] → Keyword filter → OpenAI Moderation API
    ↓
[LLM Processing]
    ↓
[Output Validation] → Sensitive data detection, redaction
    ↓
[Hallucination Tracking] → Async confidence scoring
    ↓
User Response
```

**Key Principle**: Zero user-facing latency for tracking (fire-and-forget async).

---

## 2. Hallucination Detection

### 2.1 Detection Types

| Type | Description |
|------|-------------|
| `FACTUAL_ERROR` | Contradicts known facts |
| `FABRICATED_DATA` | Makes up non-existent data |
| `INCONSISTENT_RESPONSE` | Contradicts previous statements |
| `OVERCONFIDENT` | Claims certainty without evidence |
| `OUT_OF_SCOPE` | Answers outside system capabilities |

### 2.2 Confidence Levels

| Level | Score Range | Meaning |
|-------|-------------|---------|
| `HIGH` | 90-100% | Verified facts, direct tool outputs |
| `MEDIUM` | 70-89% | LLM interpretation with validation |
| `LOW` | 50-69% | LLM speculation, unverified |
| `UNCERTAIN` | <50% | High hallucination risk |

### 2.3 Detection Methods

1. **Pattern Matching**: Detects overconfident language ("definitely", "100%", "always")
2. **Fabrication Detection**: Identifies made-up data patterns ("I found/discovered [number]")
3. **Tool Verification**: Validates claims against actual tool outputs
4. **Consistency Checking**: Compares with conversation history
5. **Ground Truth Validation**: Compares with database facts

### 2.4 FastHallucinationTracker

Ultra-fast, fire-and-forget tracking with zero user latency:

```python
tracker.track_response_async(
    response=full_response,
    tool_outputs=tool_outputs,
    session_id=session_id,
    user_id=user_id,
    feature='project_agent',
    metadata={'project_id': project_id}
)
```

**Processing Flow:**
1. Quick confidence check (<10ms sync)
2. Cache update (Redis)
3. Queue Celery task for DB persistence
4. Log concerning responses

---

## 3. Content Moderation

### 3.1 Multi-Layer Approach

```
Content
    ↓
[KeywordFilter] → Fast local regex (pre-screening)
    ↓
[ContentModerator] → OpenAI Moderation API
    ↓
[ImageModerator] → GPT-4 Vision (for images)
```

### 3.2 KeywordFilter (Local)

**Categories:**
- `EXPLICIT_SEXUAL`: 30+ keywords
- `VIOLENT_GRAPHIC`: Gore, torture, etc.
- `HATE_SPEECH`: Discriminatory language
- `CHILD_SAFETY`: **Zero tolerance** (always flag)

**Smart Filtering:**
- Allows legitimate uses: "success porn", "food porn"
- Allows discussion context: "porn addiction", "porn industry"

### 3.3 ContentModerator (OpenAI API)

**Categories checked:**
- hate, hate/threatening
- harassment, harassment/threatening
- self-harm, self-harm/intent, self-harm/instructions
- sexual, sexual/minors
- violence, violence/graphic

**Error Handling:**
- Retryable errors: Automatic retry with exponential backoff
- API errors: Fail closed (reject content)

### 3.4 ImageModerator (GPT-4 Vision)

Analyzes images for:
- Explicit sexual content or nudity
- Graphic violence or gore
- Hate symbols or extremist imagery
- Self-harm content
- Content exploiting children
- Disturbing or shocking imagery

---

## 4. Input Validation

### 4.1 validate_chat_input()

Location: `core/agents/security.py`

**4-Stage Validation:**

1. **Length Check**
   - Rejects empty/whitespace-only
   - Max 5000 characters

2. **Prompt Injection Detection**
   - Patterns: "ignore instructions", role manipulation, system tokens, DAN mode
   - Special character ratio check (max 30%)
   - Repetitive content detection (min 30% unique words)

3. **Input Sanitization**
   - Removes special tokens (`<|...|>`, `[INST]`, `<s>`)
   - Escapes system/role markers
   - Optional: remove code blocks

4. **Rate Limiting**
   - 50 messages/hour per user

**Usage:**
```python
is_valid, error_msg, sanitized_message = validate_chat_input(
    user_message,
    request.user.id
)
if not is_valid:
    return JsonResponse({'error': error_msg}, status=400)
```

---

## 5. Output Validation

### 5.1 OutputValidator

**Detects Sensitive Information:**
- API keys: `API_KEY = ...`, `SECRET_KEY = ...`
- Credentials: `PASSWORD = ...`, `TOKEN = ...`
- Database URLs: postgresql://, mysql://, mongodb://
- File paths: /Users/*, C:\*, /home/*

**Sanitization:**
```python
is_safe, violations = output_validator.validate_output(content)
if not is_safe:
    content = output_validator.sanitize_output(content)
    # Redacts matched patterns: [REDACTED]
```

---

## 6. Integration Points

### 6.1 Chat Streaming (`project_chat_stream_v2`)

```python
# 1. Input validation
is_valid, error_msg, sanitized_message = validate_chat_input(...)

# 2. Stream with output validation per token
for event in stream_ember_response(...):
    is_safe, violations = output_validator.validate_output(content)
    if not is_safe:
        content = output_validator.sanitize_output(content)

# 3. Async hallucination tracking (fire-and-forget)
tracker.track_response_async(
    response=full_response,
    tool_outputs=tool_outputs,
    ...
)
```

### 6.2 Comment Moderation

```python
# ProjectCommentSerializer.create()
result = moderator.moderate(content, context='project comment')
if not result['approved']:
    raise ValidationError(result['reason'])
```

---

## 7. Violation Handling

### 7.1 Input Violations

| Violation | Response | HTTP Status |
|-----------|----------|-------------|
| Prompt injection | "Your message contains suspicious content" | 400 |
| Rate limit exceeded | "Try again in X minutes" | 400 |
| Empty/invalid message | "Message cannot be empty" | 400 |

### 7.2 Output Violations

| Violation | Action |
|-----------|--------|
| Sensitive data detected | Auto-redact, log warning |

### 7.3 Moderation Violations

| Status | Action |
|--------|--------|
| Approved | Save with `APPROVED` status |
| Flagged | Save with `FLAGGED` status (manual review) |
| Rejected | Block creation, show reason |

### 7.4 Hallucination Handling

| Confidence | Action |
|------------|--------|
| HIGH (80-100%) | Normal tracking |
| MEDIUM (60-79%) | Track for analytics |
| LOW (40-59%) | Log warning, flag in dashboard |
| UNCERTAIN (<40%) | Log WARNING, high priority alert |

---

## 8. Data Persistence

### 8.1 HallucinationMetrics Model

```python
# core/agents/models.py
{
    'session_id': str,
    'user_id': FK User,
    'feature': str,  # 'project_agent', 'auth_chat', etc.
    'response_text': str,  # First 1000 chars
    'confidence_level': choice,
    'confidence_score': float,
    'flags': JSON,
    'tool_outputs': JSON,
    'metadata': JSON,
    'created_at': datetime
}
```

### 8.2 Cleanup Task

```python
cleanup_old_metrics(days=90)  # Run daily at 2 AM
```

---

## 9. Admin Monitoring

### 9.1 Dashboard Metrics

```python
metrics = tracker.get_dashboard_metrics(days=7)
# {
#     'total_responses': 1234,
#     'by_level': {'high': 980, 'medium': 200, 'low': 50, 'uncertain': 4},
#     'by_feature': {'project_agent': 1000, 'auth_chat': 234},
#     'hallucination_rate': 0.04  # % of UNCERTAIN responses
# }
```

### 9.2 Real-time Cache (Redis)

- Session-specific results
- Daily counters by level/feature
- Flag occurrence tracking

---

## 10. Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero Blocking** | Hallucination tracking fully async |
| **Fast Paths** | Keyword filter runs local regex |
| **Graceful Degradation** | All systems have fallbacks |
| **Fail Closed** | Errors result in content rejection |
| **Zero Tolerance** | Child safety content always rejected |
| **Audit Trail** | All moderation stored with metadata |

---

**Version**: 1.0
**Status**: Stable
**Review Cadence**: Quarterly
