# Unified Chat Architecture

**Last Updated:** 2025-12-19
**Status:** Active - Unified Ember Agent LIVE
**Purpose:** Document the intelligent chat system with unified Ember agent

---

## Executive Summary

AllThrive AI's intelligent chat system uses a **unified Ember agent** with access to all ~27 tools. **All sidebar chats now use Ember by default**, with context-aware quick actions based on the current page (Learn, Explore, Project, etc.).

### Key Stats
- **Total Tools:** 27 (2-3% of context window, ~3,000 tokens)
- **Architecture:** Single unified Ember agent (no supervisor routing)
- **Token Tracking:** Full usage tracking via `AIUsageTracker`
- **Feature Flag:** `USE_UNIFIED_EMBER = True` (enabled by default)
- **Context-Aware:** Quick actions change based on page context (learn, explore, project, default)

---

## System Architecture

```
Frontend (React)
├── EmberHomePage.tsx           # Feelings-first home experience
├── IntelligentChatPanel.tsx    # Unified chat UI (all modes)
├── useIntelligentChat.ts       # WebSocket + message state
└── useOnboardingChat.ts        # Onboarding flow orchestration
         │
         ▼ WebSocket
Backend (Django Channels + Celery)
├── ChatConsumer                # WebSocket handling
├── process_chat_message_task   # Celery async processing
├── _process_with_orchestrator  # Multi-agent routing
│     │
│     ├── Fast-Paths (no LLM routing, ~90% coverage):
│     │   ├── Media upload → Project Agent
│     │   ├── Image keywords → Image Generation
│     │   ├── Architecture → Project Agent
│     │   ├── Navigation keywords → Orchestration Agent
│     │   ├── Learning keywords → Learning Agent
│     │   ├── Discovery keywords → Discovery Agent
│     │   ├── URL detection → Project Agent
│     │   └── GitHub mentions → Project Agent
│     │
│     └── Supervisor LLM Call (fallback):
│         └── Creates OrchestrationPlan → Routes to Agent(s)
│
└── Specialized Agents:
    ├── Discovery Agent    (5 tools)
    ├── Learning Agent     (5 tools)
    ├── Project Agent      (10 tools)
    ├── Orchestration      (5 tools)
    ├── Profile Agent      (3 tools)
    ├── Image Generation   (Gemini 2.0 Flash direct)
    └── Support Agent      (no tools, fallback)
```

---

## Agent Capabilities

### Agent Registry

| Agent | Tools | Purpose | Keywords |
|-------|-------|---------|----------|
| Discovery | 5 | Search & explore projects | find, search, trending, recommend |
| Learning | 5 | Quiz help & learning paths | quiz, hint, progress, learn |
| Project | 10 | Create & import projects | github, youtube, upload, create |
| Orchestration | 5 | Site navigation & UI control | take me, go to, where is, open |
| Profile | 3 | Profile generation | profile, bio, showcase |
| Image Generation | 1 | Generate images | create image, make infographic |
| Support | 0 | Fallback help | help, how to, question |

---

## Tool Reference

### Discovery Agent (5 tools)

**File:** `/services/agents/discovery/tools.py`

| Tool | Description | State Needed |
|------|-------------|--------------|
| `search_projects` | Find projects by keyword, category, or tags | No |
| `get_recommendations` | Personalized project suggestions based on user interests | Yes (user_id) |
| `find_similar_projects` | Find projects similar to a given project ID | No |
| `get_trending_projects` | Get trending projects from day/week/month | No |
| `get_project_details` | Get detailed info about a specific project | No |

**Example Usage:**
```
User: "Find projects about LangGraph"
→ search_projects(query="LangGraph")

User: "What should I check out?"
→ get_recommendations(limit=5)

User: "What's trending this week?"
→ get_trending_projects(time_window="week")
```

---

### Learning Agent (5 tools)

**File:** `/services/agents/learning/tools.py`

| Tool | Description | State Needed |
|------|-------------|--------------|
| `get_learning_progress` | User's learning paths with skill levels and points | Yes (user_id) |
| `get_quiz_hint` | Hint for quiz question WITHOUT revealing answer | No |
| `explain_concept` | Explain topic at user's skill level | No |
| `suggest_next_activity` | Recommend next quiz based on progress | Yes (user_id) |
| `get_quiz_details` | Detailed info about a specific quiz | No |

**Example Usage:**
```
User: "How am I doing?"
→ get_learning_progress(topic="")

User: "I'm stuck on question 3"
→ get_quiz_hint(question_number=3, quiz_id="...")

User: "What should I learn next?"
→ suggest_next_activity(topic="")
```

---

### Project Agent (10 tools)

**File:** `/services/agents/project/tools.py`

| Tool | Description | State Needed |
|------|-------------|--------------|
| `create_project` | Create a new project with metadata | Yes (user_id) |
| `import_from_url` | Unified URL import (GitHub, YouTube, any webpage) | Yes (user_id) |
| `import_github_project` | Import GitHub repo with full AI analysis | Yes (user_id) |
| `scrape_webpage_for_project` | Scrape any webpage and create project | Yes (user_id) |
| `create_media_project` | Unified media handling (image, video, generation) | Yes (user_id) |
| `create_project_from_screenshot` | Create project by analyzing screenshot | Yes (user_id) |
| `create_product` | Create marketplace product (course, ebook, etc.) | Yes (user_id) |
| `extract_url_info` | Extract and categorize URLs from text | No |
| `fetch_github_metadata` | Fetch GitHub repository metadata | No |
| `regenerate_architecture_diagram` | Regenerate project's Mermaid diagram | Yes (user_id) |

**Smart URL Routing:**
- GitHub URLs → Auto-detect ownership via OAuth
- YouTube URLs → Create video project
- Figma URLs → Import as owned design
- Generic URLs → Scrape with AI analysis

**Example Usage:**
```
User: "https://github.com/user/repo"
→ import_from_url(url="...")  # Auto-detects GitHub, checks ownership

User: [uploads image.png]
→ create_media_project(file_url="...", filename="image.png")

User: "Describe how frontend connects to API to database"
→ regenerate_architecture_diagram(project_id=123, architecture_description="...")
```

---

### Orchestration Agent (5 tools)

**File:** `/services/agents/orchestration/tools.py`

| Tool | Description | State Needed |
|------|-------------|--------------|
| `navigate_to_page` | Navigate user to a page (auto-executes) | No |
| `highlight_element` | Highlight UI element with animation | No |
| `open_tray` | Open slide-out panel (chat, quest, profile) | No |
| `show_toast` | Show notification (success, info, warning, error) | No |
| `trigger_action` | Trigger site action (may require confirmation) | No |

**Available Pages:**
- `/explore` - Main feed
- `/battles` - Prompt battles
- `/challenges` - Weekly challenges
- `/play/side-quests` - Side quests
- `/quizzes` - Learning quizzes
- `/tools` - AI tool directory
- `/thrive-circle` - Community
- `/{username}` - User profile
- `/account/settings` - Settings

**Highlight Styles:**
- `pulse` - Pulsing glow (default)
- `glow` - Static glow
- `spotlight` - Darkens everything else
- `arrow` - Bouncing arrow pointer

**Example Usage:**
```
User: "Take me to battles"
→ navigate_to_page(path="/battles")

User: "Where do I create a project?"
→ highlight_element(target="#add-project-btn", style="pulse")

User: "Show me my quests"
→ open_tray(tray="quest")
```

---

### Profile Agent (3 tools)

**File:** `/services/agents/profile/tools.py`

| Tool | Description | State Needed |
|------|-------------|--------------|
| `gather_user_data` | Gather comprehensive user data for profile generation | Yes (user_id) |
| `generate_profile_sections` | Generate profile sections based on template | Yes (user_id) |
| `save_profile_sections` | Save generated sections to user's profile | Yes (user_id) |

**Profile Templates:**
- `explorer` - New users, learners (About, Learning Goals, Links)
- `builder` - Developers (About, Featured Projects, Skills, Links)
- `creator` - Content creators (About, Storefront, Featured Work, Links)
- `curation` - AI curators (About, Featured Content, Links)
- `battle_bot` - Battle bots (About, Battle Stats, Recent Battles)

**Section Types:**
- `about`, `links`, `skills`, `learning_goals`, `featured_projects`
- `storefront`, `featured_content`, `battle_stats`, `recent_battles`, `custom`

**Example Usage:**
```
User: "Generate my profile"
→ gather_user_data() → generate_profile_sections() → save_profile_sections()
```

---

### Image Generation (Gemini 2.0 Flash)

**File:** `/core/agents/tasks.py` (`_process_image_generation`)

- Uses Gemini 2.0 Flash for image generation
- Uploads to MinIO for storage
- Tracks iterations in `ImageGenerationSession`
- Personality: "Nano Banana"

**Example Usage:**
```
User: "Create an infographic about machine learning"
→ _process_image_generation(message="...")
→ Returns image_url via WebSocket
```

---

## WebSocket Protocol

### Connection
```
ws://backend:8000/ws/chat/{conversation_id}/
```

**Conversation ID Patterns:**
- `ember-learn-{timestamp}` - Learn page context (learning quick actions)
- `ember-explore-{timestamp}` - Explore page context (discovery quick actions)
- `ember-project-{timestamp}` - Project page context (project quick actions)
- `ember-default-{timestamp}` - Default context (general quick actions)
- `project-{id}-architecture` - Architecture regeneration
- `avatar-{session_id}` - Avatar generation

### Events: Backend → Frontend

| Event | Data | Purpose |
|-------|------|---------|
| `connected` | `{conversation_id, timestamp}` | Connection confirmed |
| `task_queued` | `{task_id}` | Message queued to Celery |
| `processing_started` | `{conversation_id}` | Agent begins processing |
| `chunk` | `{chunk, conversation_id}` | Streaming text token |
| `tool_start` | `{tool, conversation_id}` | Tool execution started |
| `tool_end` | `{tool, output, conversation_id}` | Tool execution completed |
| `orchestration_start` | `{message}` | Multi-agent orchestration started |
| `agent_step` | `{step, total, agent, task}` | Agent transition in workflow |
| `synthesis_start` | `{message}` | Multi-agent result synthesis |
| `image_generating` | `{message, session_id}` | Image generation in progress |
| `image_generated` | `{image_url, filename, session_id, iteration_number}` | Image ready |
| `completed` | `{conversation_id, project_created}` | Processing finished |
| `error` | `{error}` | Error occurred |
| `quota_exceeded` | `{error, reason, subscription, can_purchase_tokens}` | Usage limit hit |
| `pong` | `{timestamp}` | Heartbeat response |

### Events: Frontend → Backend

| Event | Data | Purpose |
|-------|------|---------|
| `message` | `{message}` | User sends chat message |
| `ping` | `{type: 'ping'}` | Heartbeat (every 30s) |

### Tool Output Events

When a tool completes, the `tool_end` event includes an `output` field with action commands:

```json
// Navigation
{"action": "navigate", "path": "/battles", "auto_execute": true}

// Highlight
{"action": "highlight", "target": "#add-project-btn", "style": "pulse", "auto_execute": true}

// Tray
{"action": "open_tray", "tray": "quest", "auto_execute": true}

// Toast
{"action": "toast", "message": "Success!", "variant": "success", "auto_execute": true}

// Trigger (may need confirmation)
{"action": "trigger", "trigger_action": "start_battle", "requires_confirmation": true}
```

---

## Tool Calling Flow

### State Injection Pattern

Tools that need user context receive a `state` dict injected by the custom tool_node:

```python
# In agent.py tool_node:
if tool_name in TOOLS_NEEDING_STATE:
    tool_input['state'] = {
        'user_id': user_id,
        'username': username,
        'session_id': session_id,
    }
```

**Tools Needing State:**
- Discovery: `get_recommendations`
- Learning: `get_learning_progress`, `suggest_next_activity`
- Project: All 10 tools (user context required for creation)
- Profile: All 3 tools

### Tool Execution Flow

```
1. LLM decides to call tool
   └── Emits tool_call in AIMessage

2. tool_node extracts tool call
   ├── Looks up tool by name
   ├── Injects state if needed
   └── Executes tool function

3. Tool returns result
   ├── Emits tool_start event to WebSocket
   ├── Executes tool logic
   ├── Emits tool_end event with output
   └── Returns ToolMessage to graph

4. LLM receives ToolMessage
   └── Generates response using tool result
```

### Tool Registration

Each agent defines its tools list:

```python
# Discovery
DISCOVERY_TOOLS = [search_projects, get_recommendations, ...]

# Learning
LEARNING_TOOLS = [get_learning_progress, get_quiz_hint, ...]

# Project
PROJECT_TOOLS = [create_project, import_from_url, ...]

# Orchestration
ORCHESTRATION_TOOLS = [navigate_to_page, highlight_element, ...]

# Profile
PROFILE_TOOLS = [gather_user_data, generate_profile_sections, ...]
```

---

## Routing Logic

### Fast-Paths (No Supervisor LLM Call)

Fast-paths bypass the supervisor for common patterns, reducing latency by 2-5 seconds:

```python
# In core/agents/tasks.py _process_with_orchestrator()

# 1. Architecture regeneration
if '-architecture' in conversation_id:
    return _process_with_langgraph_agent(...)

# 2. Media upload detection
if re.search(r'\[(image|video):.*\]\(http', message):
    return _process_with_langgraph_agent(...)

# 3. Image generation keywords
image_keywords = ['create an image', 'make an infographic', ...]
if any(kw in message_lower for kw in image_keywords):
    return _process_image_generation(...)

# 4. Navigation requests → Orchestration Agent
navigation_keywords = ['take me to', 'go to ', 'navigate to', 'show me where',
                       'where is ', 'where do i find', 'how do i find', 'open the ']
if any(kw in message_lower for kw in navigation_keywords):
    return _process_with_orchestration_agent(...)

# 5. Learning/quiz requests → Learning Agent
learning_keywords = ['quiz', 'hint for', 'give me a hint', 'my progress',
                     'learning progress', 'what should i learn', 'explain ',
                     'help me understand', 'study ', "i'm stuck on"]
if any(kw in message_lower for kw in learning_keywords):
    return _process_with_learning_agent(...)

# 6. Discovery requests → Discovery Agent
discovery_keywords = ['find projects', 'search for', 'discover ', 'trending projects',
                      'recommend ', "what's popular", 'explore projects', 'projects about',
                      'show me projects', 'similar to']
if any(kw in message_lower for kw in discovery_keywords):
    return _process_with_discovery_agent(...)

# 7. URL detection → Project Agent
if re.search(r'https?://[^\s]+', message):
    return _process_with_langgraph_agent(...)

# 8. GitHub mentions → Project Agent
if 'github' in message_lower:
    return _process_with_langgraph_agent(...)
```

**Current Coverage:** ~90% of requests (expanded from ~40%)

### Supervisor Routing

For non-fast-path requests, the supervisor creates an `OrchestrationPlan`:

```python
class OrchestrationPlan:
    analysis: str           # Brief analysis of request
    plan_type: str          # 'single' or 'multi'
    agents: list[dict]      # Agent sequence
    synthesis_needed: bool  # Combine results?
```

**Single-Agent Routing:**
```python
if plan.is_single_agent:
    if agent == AgentType.PROJECT:
        return _process_with_langgraph_agent(...)
    elif agent == AgentType.IMAGE_GENERATION:
        return _process_image_generation(...)
    elif agent == AgentType.DISCOVERY:
        return _process_with_discovery_agent(...)
    elif agent == AgentType.LEARNING:
        return _process_with_learning_agent(...)
    elif agent == AgentType.ORCHESTRATION:
        return _process_with_orchestration_agent(...)
    else:
        return _process_with_ai_provider(...)  # Support fallback
```

---

## Agent Types (Enum)

**File:** `/services/agents/orchestrator/handoff.py`

```python
class AgentType(str, Enum):
    DISCOVERY = 'discovery'
    LEARNING = 'learning'
    PROJECT = 'project'
    IMAGE_GENERATION = 'image_generation'
    SUPPORT = 'support'
    ORCHESTRATION = 'orchestration'
    EMBER = 'ember'  # Unified agent with all tools
```

### Agent Capabilities

Each agent type has defined capabilities for supervisor routing:

| Agent | Handoff Targets | Keywords |
|-------|----------------|----------|
| Discovery | Learning, Image, Project | find, search, trending, recommend |
| Learning | Discovery, Image | quiz, hint, explain, study |
| Project | Image, Discovery | github, youtube, upload, create, url |
| Image Generation | Discovery, Project | image, infographic, visual, diagram |
| Support | Discovery, Learning, Project, Orchestration | help, how to, support |
| Orchestration | Discovery, Learning, Project, Support | take me, go to, navigate, show me |

---

## Technical Debt (Tracked in Plan)

### High Priority - COMPLETED ✓
- [x] Centralize tools in `/services/agents/ember/tools.py` ✓
- [x] Unified Ember agent (no supervisor for `/home`) ✓
- [x] Unified state injection pattern ✓
- [x] Token usage tracking via AIUsageTracker ✓

### Medium Priority - COMPLETED ✓
- [x] Remove supervisor routing entirely (ALL chat modes now use Ember) ✓
- [x] Consolidate personalities → Ember only ✓
- [x] Multiple event loop creation → centralized `_run_async()` utility ✓

### Low Priority
- [ ] Frontend mode props → context detection
- [ ] Extract IntelligentChatPanel (1,738 lines)
- [ ] Remove deprecated specialized agent prompt files (discovery, orchestration, etc.)

---

## Unified Ember Agent (Phase 3 - IMPLEMENTED)

The unified Ember agent consolidates all specialized agents into a single agent with access to all ~30 tools.

**Location:** `/services/agents/ember/`

### Module Structure
```
services/agents/ember/
├── __init__.py      # Module exports
├── agent.py         # LangGraph agent + streaming
├── prompts.py       # System prompts (standard + onboarding)
└── tools.py         # Unified tool registry
```

### Unified Tool Registry

**File:** `/services/agents/ember/tools.py`

```python
EMBER_TOOLS = [
    *DISCOVERY_TOOLS,      # 5 tools
    *LEARNING_TOOLS,       # 5 tools
    *PROJECT_TOOLS,        # 10+ tools
    *ORCHESTRATION_TOOLS,  # 5 tools
    *PROFILE_TOOLS,        # 3 tools
]

TOOLS_NEEDING_STATE = {...}  # Combined from all agent modules
```

### Streaming Function

**File:** `/services/agents/ember/agent.py`

```python
async def stream_ember_response(
    user_message: str,
    user_id: int | None = None,
    username: str = '',
    session_id: str = '',
    is_onboarding: bool = False,
):
    """
    Yields events:
    - {'type': 'token', 'content': '...'} - Text tokens from LLM
    - {'type': 'tool_start', 'tool': '...'} - Tool execution started
    - {'type': 'tool_end', 'tool': '...', 'output': {...}} - Tool completed
    - {'type': 'complete'} - Agent finished
    - {'type': 'error', 'message': '...'} - Error occurred
    """
```

### System Prompts

**File:** `/services/agents/ember/prompts.py`

- `EMBER_SYSTEM_PROMPT` - Standard interactions
- `EMBER_ONBOARDING_PROMPT` - New user onboarding additions
- `EMBER_FULL_ONBOARDING_PROMPT` - Combined for EmberHomePage

### Feature Flag Routing

**File:** `/core/agents/tasks.py`

```python
# Enabled by default for EmberHomePage conversations
USE_UNIFIED_EMBER = getattr(settings, 'USE_UNIFIED_EMBER', True)  # Default: True

if USE_UNIFIED_EMBER and conversation_id.startswith('ember-'):
    return _process_with_ember(
        conversation_id=conversation_id,
        message=message,
        user=user,
        channel_name=channel_name,
        channel_layer=channel_layer,
        is_onboarding=True,
    )
```

**Configuration:**
```python
# config/settings.py (already enabled by default)
USE_UNIFIED_EMBER = config('USE_UNIFIED_EMBER', default=True, cast=bool)
```

**Conversation ID Pattern:**
- EmberHomePage generates: `ember-home-{timestamp}` (starts with `ember-`)
- This triggers routing to unified Ember agent

### Benefits
- **No routing latency** - Single LLM call decides which tools to use
- **Single personality** - Consistent Ember experience
- **Simpler codebase** - One agent to maintain
- **Tool selection by LLM** - Works great with 27 tools (2-3% of context)

### Scalability Features

**File:** `/services/agents/ember/agent.py`

The unified Ember agent includes production-ready scalability features:

| Feature | Config | Default | Purpose |
|---------|--------|---------|---------|
| Message truncation | `EMBER_MAX_CONTEXT_MESSAGES` | 50 | Prevents OOM with long conversations |
| Tool timeout | `EMBER_TOOL_EXECUTION_TIMEOUT` | 30s | Prevents hanging on slow tools |
| Max iterations | `EMBER_MAX_TOOL_ITERATIONS` | 10 | Prevents infinite tool loops |
| Model selection | `EMBER_DEFAULT_MODEL` | gpt-4o-mini | Configurable per deployment |

```python
# Configure via Django settings or environment
EMBER_MAX_CONTEXT_MESSAGES = 50      # Keep last N messages
EMBER_TOOL_EXECUTION_TIMEOUT = 30    # Seconds before tool times out
EMBER_MAX_TOOL_ITERATIONS = 10       # Max tool call loops per request
EMBER_DEFAULT_MODEL = 'gpt-4o-mini'  # Default LLM model
```

### Token Usage Tracking

**File:** `/services/agents/ember/agent.py`

All Ember agent usage is tracked via `AIUsageTracker` for analytics and billing:

| Metric | Description |
|--------|-------------|
| `user_id` | Per-user tracking |
| `feature` | `ember_chat` or `ember_onboarding` |
| `provider` | `openai` |
| `model` | e.g., `gpt-4o-mini` |
| `input_tokens` | Estimated from prompt + history |
| `output_tokens` | Estimated from response content |
| `latency_ms` | Request duration |
| `status` | `success`, `error`, or `max_iterations` |
| `tool_calls` | Count of tool invocations |

**Query Usage:**
```python
from core.ai_usage.models import AIUsageLog
from core.ai_usage.tracker import AIUsageTracker

# Get recent Ember usage
AIUsageLog.objects.filter(feature__startswith='ember').order_by('-created_at')[:10]

# Get user's monthly cost
monthly_cost = AIUsageTracker.get_user_monthly_cost(user)

# Get Cost per Active User (CAU)
cau_data = AIUsageTracker.get_cau(days=30)
```

---

## Future Roadmap

### Current State (Phase 4 Complete)

- ✅ Unified Ember agent created with all 27 tools
- ✅ EmberHomePage (`/home`) uses unified agent by default
- ✅ Token usage tracking for analytics and billing
- ✅ Scalability features (timeouts, truncation, limits)
- ✅ **All sidebar chats use Ember** (IntelligentChatPanel)
- ✅ **Context-aware quick actions** based on page (learn, explore, project, default)
- ✅ **Ember branding** in chat header (dragon avatar, "Your AI Guide")

### Phase 4: Full Migration (COMPLETE ✓)

All sidebar chats now use unified Ember agent:
1. ✅ All IntelligentChatPanel conversations route to Ember (ember-{context}-{timestamp} pattern)
2. ✅ Context-aware quick actions (learn, explore, project, default)
3. ✅ Ember branding in chat header (dragon avatar, "Your AI Guide")
4. ✅ DashboardLayout passes context to IntelligentChatPanel
5. ✅ LearnPage opens chat with `context: 'learn'` for learning-specific quick actions

**Context-Aware Quick Actions:**

| Context | Quick Actions |
|---------|---------------|
| `learn` | Learn AI Basics, Quiz Me, My Progress, What Next? |
| `explore` | Trending Projects, Find Projects, Recommend For Me, Similar Projects |
| `project` | Paste a URL, Make Infographic, From GitHub, Upload Media |
| `default` | Paste a URL, Make Infographic, Brainstorm, Find Something |

### Future Tools (Not Yet Built)

See [AGENTIC_LEARNING_PATHS_PLAN.md](/docs/AGENTIC_LEARNING_PATHS_PLAN.md) for enhanced learning tools:

| Tool | Purpose |
|------|---------|
| `generate_micro_lesson` | Personalized lessons using 3-tier content hierarchy |
| `start_conversational_quiz` | Interactive quiz sessions in chat |
| `check_answer_and_explain` | Evaluate answers with adaptive difficulty |
| `celebrate_learning_milestone` | Real-time celebrations for achievements |
| `get_contextual_learning_nudge` | Proactive learning suggestions |
| `get_projects_for_learning` | Find community projects demonstrating concepts |
| `record_project_learning_usage` | Track when projects help users learn |

Other future tools:
- `update_account_settings` - Update profile via chat
- `semantic_search` - Vector-powered search (Weaviate)

---

## Related Documentation

- `/docs/AGENTIC_LEARNING_PATHS_PLAN.md` - Enhanced learning tools plan (aligned with unified architecture)
- `/docs/evergreen-architecture/intelligent-chat-architecture.md` - Original design doc (Nov 2025)
- `/docs/evergreen-architecture/07-WEBSOCKET-IMPLEMENTATION.md` - WebSocket details
- `/docs/evergreen-architecture/04-AI-ARCHITECTURE.md` - AI provider architecture
- `/.claude/plans/vivid-puzzling-ritchie.md` - Implementation plan
