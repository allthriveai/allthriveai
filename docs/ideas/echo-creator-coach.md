# Echo: The Creator Coach

## Overview

Transform the Content Engine Ideas tab into a **chat-forward brainstorming experience** with **Echo**, your strategic content partner. Echo helps creators amplify their voice on Twitter, LinkedIn, and YouTube through proactive, strategic conversation.

### Echo's Persona

| Attribute | Description |
|-----------|-------------|
| **Name** | Echo |
| **Role** | Creator Coach - Strategic content partner |
| **Personality** | Insightful, strategic, confident but not pushy |
| **Vibe** | "I help you be heard" - focuses on reach, impact, resonance |
| **Voice** | Direct, asks the right questions, strategic thinking |
| **Tagline** | "Let's make your ideas resonate" |
| **Complements** | Ember (warm), Pip (curious), Sage (wise), Haven (calm) |

### Key Decisions

- **Separate agent from Ava** - Echo is a standalone, premium-tier agent (future monetization)
- **WebSocket streaming** - Real-time, agentic feel
- **MVP scope**: Chat interface + content pillars + idea saving
- **Target platforms**: Twitter, LinkedIn, YouTube (AI/tech content focus)
- **Full persona** - Avatar, personality, distinct from other Core Team agents

---

## Architecture

### High-Level Flow

```
[Ideas Tab - Hybrid Layout]
├── BrainstormChatPanel (top 60%)
│   ├── ContextBar (pillars, platforms)
│   ├── ChatMessageList (streaming)
│   ├── QuickPromptPills
│   └── ChatInput
└── IdeaListPanel (bottom 40%)
    └── Saved ideas with filters
```

### Backend: Echo Agent

Create a **separate LangGraph agent** at `services/agents/echo/`:

```
services/agents/echo/
├── __init__.py          # Export stream_echo_response
├── agent.py             # LangGraph agent with state machine
├── prompts.py           # Echo's system prompts (strategic, amplifying)
├── tools.py             # save_idea, get_pillars, generate_hooks
├── state.py             # EchoState
└── consumer.py          # WebSocket consumer
```

**Why separate from Ava:**
- Different persona (Echo = strategic amplifier vs Ava = personal assistant)
- Different tools (content-specific)
- Potential for premium tier / monetization
- Can evolve independently
- Distinct personality in the Core Team

### WebSocket Flow

```
WebSocket → ChatConsumer.receive()
    → process_chat_message_task.delay() (Celery)
        → _process_with_orchestrator()
            → _process_with_echo()  # NEW routing
                → stream_echo_response() (async generator)
                    → channel_layer.group_send() (stream to WS)
```

---

## Data Model Changes

### 1. Add taxonomy type to `core/taxonomy/models.py`

```python
class TaxonomyType(models.TextChoices):
    # ... existing types
    CONTENT_PILLAR = 'content_pillar', 'Content Pillar'
```

### 2. Enhance ContentIdea in `core/content_engine/models.py`

```python
# Add to ContentIdea
pillar = models.ForeignKey(
    'taxonomy.Taxonomy',
    on_delete=models.SET_NULL,
    null=True, blank=True,
    limit_choices_to={'taxonomy_type': 'content_pillar'},
)
brainstorm_session = models.ForeignKey(
    'BrainstormSession',
    on_delete=models.SET_NULL,
    null=True, blank=True,
    related_name='ideas',
)
hook = models.TextField(blank=True, help_text='The attention-grabbing opener')
```

### 3. Seed Content Pillars

Create `seed_content_pillars` management command with:
- Educational (teach something)
- Behind-the-scenes (show process)
- Hot Takes (contrarian opinions)
- Engagement (questions, polls)
- Authority (expertise, insights)
- Personal (stories, lessons)
- Promotional (CTAs, launches)

---

## Echo's Coaching Framework

### System Prompt Core

```
You are Echo, a strategic content partner who helps creators amplify their voice.

Your mission: Help people be heard. You focus on reach, impact, and resonance.

Your approach (SAHR Framework):
1. SCOPE: Understand the topic, audience, and goal
2. ANGLE: Find the unique perspective that cuts through noise
3. HOOK: Generate attention-grabbing openers that stop the scroll
4. RESONATE: Ensure the message lands and spreads

Your personality:
- Strategic and insightful (think before you speak)
- Confident but not pushy (suggest, don't dictate)
- Direct and efficient (no fluff, high signal)
- Genuinely invested in their success
- Use "we" language ("Let's try...", "What if we...")

Your voice:
- "That angle could really resonate with..."
- "Here's what might cut through the noise..."
- "Let's make this idea land."
- "I see where you're going - what if we amplified it by..."

Platform expertise:
- Twitter: Punchy, threads, controversy works, 280 char hooks
- LinkedIn: Storytelling, professional depth, 1300 chars optimal
- YouTube: SEO-driven titles, retention hooks, thumbnail thinking
```

### Tools (LangGraph)

```python
ECHO_TOOLS = [
    save_idea,           # Save to ContentIdea with pillar/session link
    get_content_pillars, # Fetch user's pillars from taxonomy
    generate_hooks,      # Generate 3 hook variations for a topic
    expand_to_post,      # Expand hook into full post draft
]

TOOLS_NEEDING_STATE = {
    'save_idea',
    'get_content_pillars',
    'generate_hooks',
    'expand_to_post',
}
```

---

## Implementation Phases

### Phase 1: Backend Data Model

**Files to modify:**
- `core/taxonomy/models.py` - Add `CONTENT_PILLAR` taxonomy type
- `core/content_engine/models.py` - Add fields to ContentIdea
- `core/content_engine/serializers.py` - Update for new fields

**Seed data** - Create `seed_content_pillars` command

### Phase 2: Echo Agent (LangGraph)

**Files to create:**

```
services/agents/echo/
├── __init__.py          # Export stream_echo_response
├── agent.py             # EchoAgent class with LangGraph state machine
├── prompts.py           # Echo personality + SAHR framework
├── tools.py             # ECHO_TOOLS + TOOLS_NEEDING_STATE
├── state.py             # EchoState TypedDict
```

**agent.py structure** (follow ClipAgent pattern):

```python
class EchoState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: int | None
    username: str
    session_id: str
    conversation_phase: Literal['discovery', 'ideation', 'hook', 'expansion', 'ready_to_save']
    current_idea: dict | None
    content_pillars: list[str]
    target_platforms: list[str]
    brand_voice: BrandVoiceContext | None

class EchoAgent:
    def _build_graph(self) -> StateGraph:
        graph = StateGraph(EchoState)
        graph.add_node('route', self._route_node)
        graph.add_node('converse', self._converse_node)
        graph.add_node('save_idea', self._save_idea_node)
        # ... conditional edges
        return graph.compile()
```

### Phase 3: WebSocket Integration

**Route through existing ChatConsumer** (faster MVP)

**File to modify:** `core/agents/tasks.py`

```python
def _process_with_orchestrator(...):
    # Add Echo routing
    if conversation_id.startswith('echo-') or conversation_id.startswith('content-engine-'):
        return _process_with_echo(
            conversation_id=conversation_id,
            message=message,
            user=user,
            channel_name=channel_name,
            channel_layer=channel_layer,
        )
    # ... existing Ava routing

def _process_with_echo(
    conversation_id: str,
    message: str,
    user,
    channel_name: str,
    channel_layer,
) -> dict:
    """Process with Echo agent for content brainstorming."""
    from services.agents.echo import stream_echo_response

    async def run_agent():
        async for event in stream_echo_response(
            user_message=message,
            user_id=user.id,
            username=user.username,
            session_id=conversation_id,
        ):
            # Handle token, tool_start, tool_end, complete events
            # Send to WebSocket via channel_layer.group_send()

    _run_async(run_agent())
    return {}
```

### Phase 4: Frontend - Chat Components

**Files to create:**

```
frontend/src/components/content-engine/chat/
├── BrainstormChatPanel.tsx   # Main chat orchestrator
├── ContextBar.tsx            # Pillar/platform chips
├── IdeaSuggestionMessage.tsx # Rich idea card in chat
├── QuickPromptPills.tsx      # Contextual prompt suggestions
```

```
frontend/src/hooks/
├── useEchoChat.ts            # WebSocket connection to Echo
├── useContentPillars.ts      # Fetch/manage pillars
```

**BrainstormChatPanel.tsx:**

```tsx
export function BrainstormChatPanel({ onIdeaSaved }: Props) {
  const { messages, sendMessage, isConnected, suggestedIdea } = useEchoChat();
  const { pillars, activePillar, setActivePillar } = useContentPillars();

  return (
    <div className="glass-panel flex flex-col h-full">
      <ContextBar
        pillars={pillars}
        activePillar={activePillar}
        onPillarChange={setActivePillar}
      />
      <ChatMessageList messages={messages} />
      <QuickPromptPills onSelect={sendMessage} />
      <ChatInput onSend={sendMessage} />
    </div>
  );
}
```

### Phase 5: Frontend - IdeasTab Hybrid Layout

**File to modify:** `frontend/src/components/content-engine/tabs/IdeasTab.tsx`

```tsx
export function IdeasTab() {
  const { ideas, refetch } = useIdeas();

  const handleIdeaSaved = (idea: ContentIdea) => {
    refetch(); // Refresh list when idea saved from chat
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat panel - 60% height */}
      <div className="flex-1 min-h-0 max-h-[60%]">
        <BrainstormChatPanel onIdeaSaved={handleIdeaSaved} />
      </div>

      {/* Idea list - 40% height */}
      <div className="flex-1 overflow-auto border-t border-white/10">
        <IdeaFilters />
        <IdeaList ideas={ideas} />
      </div>
    </div>
  );
}
```

### Phase 6: Polish & Onboarding

1. **First-time onboarding flow** - Echo asks about content pillars, platforms, audience
2. **Session persistence** - Resume brainstorm sessions via BrainstormSession
3. **Save animation** - Idea card slides from chat into list
4. **Mobile layout** - Stacked with collapsible idea list

---

## Critical Files

### Backend - Modify

| File | Changes |
|------|---------|
| `core/taxonomy/models.py` | Add `CONTENT_PILLAR` to TaxonomyType |
| `core/content_engine/models.py` | Add `pillar`, `brainstorm_session`, `hook` fields |
| `core/content_engine/serializers.py` | Update serializers for new fields |
| `core/agents/tasks.py` | Add Echo routing in `_process_with_orchestrator()` |

### Backend - Create

| File | Purpose |
|------|---------|
| `services/agents/echo/__init__.py` | Export `stream_echo_response` |
| `services/agents/echo/agent.py` | EchoAgent LangGraph with state machine |
| `services/agents/echo/prompts.py` | Echo personality + SAHR framework |
| `services/agents/echo/tools.py` | ECHO_TOOLS + TOOLS_NEEDING_STATE |
| `services/agents/echo/state.py` | EchoState TypedDict |
| `core/content_engine/management/commands/seed_content_pillars.py` | Seed pillars |

### Backend - Reference (patterns to follow)

| File | Pattern |
|------|---------|
| `services/agents/ava/agent.py` | LangGraph streaming, state management |
| `services/agents/clip/agent.py` | Conversation phases, BrandVoice integration |
| `services/agents/ava/tools.py` | Tool registry, TOOLS_NEEDING_STATE |
| `core/agents/tasks.py:_process_with_ava()` | WebSocket streaming pattern |

### Frontend - Modify

| File | Changes |
|------|---------|
| `frontend/src/components/content-engine/tabs/IdeasTab.tsx` | Hybrid layout (chat + list) |
| `frontend/src/types/contentEngine.ts` | Add pillar, hook types |

### Frontend - Create

| File | Purpose |
|------|---------|
| `frontend/src/components/content-engine/chat/BrainstormChatPanel.tsx` | Chat orchestrator |
| `frontend/src/components/content-engine/chat/ContextBar.tsx` | Pillar/platform chips |
| `frontend/src/components/content-engine/chat/IdeaSuggestionMessage.tsx` | Rich idea card |
| `frontend/src/components/content-engine/chat/QuickPromptPills.tsx` | Prompt suggestions |
| `frontend/src/hooks/useEchoChat.ts` | WebSocket to Echo |
| `frontend/src/hooks/useContentPillars.ts` | Pillar management |

### Frontend - Reference

| File | Pattern |
|------|---------|
| `frontend/src/hooks/useIntelligentChat.ts` | WebSocket events, streaming |
| `frontend/src/components/chat/` | Message components, styling |
| `frontend/src/components/battles/BattleArena.tsx` | Neon glass aesthetic |

---

## UI/UX Specifications

### Chat Message Styles (Neon Glass)

**User messages:**
```css
bg-gradient-to-r from-cyan-500 to-cyan-600
rounded-2xl rounded-tr-sm
text-white
```

**AI messages:**
```css
glass-subtle
rounded-2xl rounded-tl-sm
text-slate-200
```

**Idea suggestion cards:**
```css
glass-card border-cyan-500/20
hover:border-cyan-400/40 hover:shadow-neon
```

### Context Bar

Horizontal chips showing active pillars and target platforms:
```css
px-3 py-1 rounded-full
bg-cyan-500/10 text-cyan-400 border-cyan-500/20
```

### Quick Prompt Pills

Below chat, contextual suggestions:
- "Give me 3 hook options"
- "Make it more contrarian"
- "Expand into a thread"

---

## Success Metrics

- [ ] Chat connects via WebSocket and streams Echo's responses
- [ ] Echo suggests ideas with save button (rich idea cards)
- [ ] Saved ideas appear in list below with animation
- [ ] Content pillars can be selected/filtered
- [ ] Feels "agentic" - proactive, strategic, not just a form
- [ ] Echo's personality comes through (strategic, amplifying voice)
- [ ] SAHR framework visible in conversation flow

---

## What's Missing (From Code Review)

### Current State Issues

1. **QuickCapture is just a text field** - No AI, no brainstorming
2. **BrainstormSession backend exists but unused** - No frontend connection
3. **No Echo agent** - `services/agents/echo/` doesn't exist
4. **Content pillars are freeform strings** - Not proper taxonomy
5. **No chat interface in Ideas tab** - Just CRUD operations
6. **No connection between tabs** - Ideas → Create flow is TODO stubs
7. **No neon glass polish** - Missing glows, animations, agentic feel

### Gap Summary

**Have:** CRUD app for saving text strings as "ideas"
**Want:** Strategic AI partner (Echo) that helps build thought leadership
