# AllThrive AI - Agentic AI Roadmap

## Current Architecture

All AI interactions flow through the **Intelligent Chat Panel** which serves as the unified AI gateway.

### Message Flow
```
User Message → WebSocket → Celery Task → Intent Detection → Agent Router
                                              ↓
                    ┌─────────────────────────┼─────────────────────────┐
                    ↓                         ↓                         ↓
            project-creation           image-generation          support/discovery
                    ↓                         ↓                         ↓
         LangGraph Agent             Gemini Image Gen          Simple AIProvider
         (tools, state)              (Nano Banana)             (NO tools - GAP!)
```

### Key Files
- `core/agents/intent_detection.py` - LLM-based intent classification
- `core/agents/tasks.py` - Routes intents to processors
- `services/agents/project/` - LangGraph project creation agent
- `frontend/src/components/chat/IntelligentChatPanel.tsx` - Unified chat UI

### Current Intent Types
| Intent | Handler | Has Tools? | Has State? |
|--------|---------|------------|------------|
| `project-creation` | LangGraph Agent | ✅ Yes | ✅ Yes |
| `image-generation` | Gemini + MinIO | ❌ No | ✅ Session |
| `discovery` | Simple AIProvider | ❌ **NO** | ❌ **NO** |
| `support` | Simple AIProvider | ❌ **NO** | ❌ **NO** |

## Current Agents

| Agent | Location | Purpose |
|-------|----------|---------|
| Project Creation | `services/agents/project/` | GitHub import, project creation |
| Auth Agent | `services/agents/auth/` | Conversational signup/login |
| Profile Agent | `services/agents/profile/` | Auto-generate user profiles |
| Moderation | `services/agents/moderation/` | Content safety |
| Image Generation | `core/agents/views.py` | Nano Banana image creation |

## Gaps to Address

### 1. Discovery Agent
**Purpose**: Conversational project/content discovery through the intelligent chat

**User Flow**:
```
User: "I want to learn about AI agents"
Agent: "What aspects interest you - building agents, using them, or understanding how they work?"
User: "Building them"
Agent: "Here are 5 projects on agent development... [explains why each matches]"
```

**Integration**: New intent type `discovery` routed through intelligent chat

### 2. Learning Tutor Agent
**Purpose**: AI mentor for learning paths, quizzes, and skill building

**User Flow**:
```
User: "Help me with this quiz question"
Agent: [Provides hints without giving away answer]
User: "I'm stuck on the Python basics course"
Agent: [Explains concept, suggests practice exercises]
```

**Integration**: New intent type `learning` routed through intelligent chat

### 3. Proactive Recommendations
**Purpose**: Agent-initiated suggestions based on user behavior

**User Flow**:
```
Agent: "Based on your interest in LangGraph, you might enjoy these 3 new projects..."
Agent: "You're 80% through the AI Fundamentals path - ready for the final quiz?"
```

**Integration**: Scheduled Celery tasks that push to chat via WebSocket

### 4. Agent Reasoning Display
**Purpose**: Transparency in AI decision-making

**Features**:
- Show confidence scores
- Display tools used
- Explain why recommendations were made
- Collect user feedback

### 5. Pip AI Mentor Enhancement
**Purpose**: Make Pip more proactive and contextual

**Features**:
- Remembers user preferences across sessions
- Proactively suggests based on activity
- Adapts tone/complexity to user level
- Cross-references user's projects and interests

## Implementation Priority

| Priority | Agent | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Discovery Agent | Medium | High |
| 2 | Learning Tutor | Low | High |
| 3 | Pip Enhancement | Low | High |
| 4 | Agent Reasoning UI | Low | Medium |
| 5 | Proactive Recommendations | Medium | High |

## Technical Requirements

All agents must:
1. Route through the existing intelligent chat WebSocket
2. Use intent detection for routing
3. Support streaming responses
4. Integrate with LangGraph for state management
5. Track usage via AI usage tracker
6. Support the existing tool execution display

## Implementation Plan

### Phase 1: Discovery Agent (Priority 1)

**Goal**: Replace simple AIProvider with LangGraph agent for `discovery` intent

**New Files**:
```
services/agents/discovery/
├── __init__.py
├── agent.py      # Main agent with streaming
├── graph.py      # LangGraph workflow
├── tools.py      # Search, recommend, explain tools
└── prompts.py    # Discovery-focused system prompts
```

**Tools to Implement**:
1. `search_projects` - Search projects by query, category, or tags
2. `get_recommendations` - Get personalized recommendations from PersonalizationEngine
3. `explain_project` - Get detailed explanation of a specific project
4. `find_similar` - Find projects similar to a given project
5. `get_trending` - Get trending projects from TrendingEngine

**Modify**:
- `core/agents/tasks.py` - Add `_process_with_discovery_agent()`

### Phase 2: Learning Tutor Agent (Priority 2)

**Goal**: Add new `learning` intent with LangGraph agent

**New Files**:
```
services/agents/learning/
├── __init__.py
├── agent.py      # Learning tutor agent
├── graph.py      # LangGraph workflow
├── tools.py      # Progress, hints, quiz tools
└── prompts.py    # Educational system prompts
```

**Tools to Implement**:
1. `get_learning_path_progress` - Check user's progress in learning paths
2. `get_quiz_hint` - Provide hints for quiz questions without giving answers
3. `explain_concept` - Explain a concept from a lesson
4. `suggest_next_lesson` - Recommend next lesson based on progress
5. `get_related_projects` - Find projects related to current learning topic

**Modify**:
- `core/agents/intent_detection.py` - Add `learning` intent
- `core/agents/tasks.py` - Add `_process_with_learning_agent()`

### Phase 3: Enhanced Pip (Priority 3)

**Goal**: Make the main support agent more proactive and contextual

**Enhancements**:
1. Inject user context (projects, interests, progress) into system prompt
2. Add tools for checking user's profile and activity
3. Proactive suggestions based on time of day, activity patterns
4. Memory of past conversations for continuity

### Phase 4: Agent Reasoning UI (Priority 4)

**Goal**: Show users what the agent is thinking

**Frontend Changes**:
- Show tool execution in real-time (already supported via WebSocket events)
- Add confidence indicators
- Show "why" explanations for recommendations
- User feedback buttons (👍/👎) for agent responses

---

*Last updated: December 2025*
