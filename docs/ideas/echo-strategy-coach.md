# Echo: Social Media Strategy Coach

## Overview

Echo is a **social media content coach** - not a passive chatbot, but an opinionated coach that helps you build and execute a content strategy.

## What Echo Does

1. **Create strategy** - "I want to grow on LinkedIn" → Echo helps you build a real plan
2. **Save strategy** - persists so Echo remembers next session
3. **Recall strategy** - Echo loads it to give contextual advice
4. **Update strategy** - goals change, Echo adapts
5. **Create content** - posts aligned with your strategy
6. **Schedule posts** - (future) put them on the calendar

## Echo's Personality

Echo is a **coach**, not a form wizard. After user shares their goal, Echo doesn't just say "Great, I saved that." Echo gives actual coaching:

**User:** "I want to post to LinkedIn 3x/week to grow my audience"

**Echo:**
> "Nice! Here's my recommendation for growing on LinkedIn with 3 posts/week:
>
> **Schedule:** Mon/Wed/Fri mornings (8-9am when professionals are scrolling)
>
> **Content mix:**
> - 1 personal story or lesson learned
> - 1 tactical how-to or tip
> - 1 opinion or hot take on your industry
>
> **First 30 days focus:** Consistency beats perfection. Just ship.
>
> Want me to save this plan? Then we can brainstorm your first post."

Echo is proactive, opinionated, gives real advice. Then helps execute.

## Tools

Echo needs only **2 tools** for persistence:

### 1. `strategy` (NEW)

Get, create, or update the user's social media strategy.

- Called with no args → returns current strategy
- Called with data → creates or updates strategy

### 2. `save_idea` (EXISTS)

Save a content idea to the idea bank. Already implemented.

### Why Only 2 Tools?

| Action | Needs Tool? |
|--------|-------------|
| Create strategy | Yes - persist to DB |
| Recall strategy | Yes - read from DB |
| Update strategy | Yes - write to DB |
| Save idea | Yes - write to DB |
| Create post | **No** - just text generation |
| Give advice | **No** - just Echo talking |
| Generate hooks | **No** - just Echo writing |

Content creation is just Echo being smart. Tools are only for **persisting data**.

### What About Existing Tools?

Current Echo tools:
- `save_idea` - **keep** (captures ideas)
- `get_content_pillars` - **maybe remove** (pillars are part of strategy now)
- `generate_hooks` - **remove** (Echo can just write hooks)
- `expand_to_post` - **remove** (Echo can just write posts)

The hook/post generation tools are template-based and limiting. Echo's language ability is better.

## Data Model

### Strategy Model

One strategy per user. Replaces scattered `ContentGoal`, `BrandVoice`, platform preferences:

```python
class Strategy(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)

    # Goals (why)
    goals = ArrayField(models.CharField(max_length=255), default=list)
    # e.g., ["grow audience", "get consulting clients"]

    # Platforms (where)
    platforms = ArrayField(models.CharField(max_length=50), default=list)
    # e.g., ["linkedin", "twitter"]

    # Cadence (how often)
    posts_per_week = models.PositiveIntegerField(default=3)

    # Schedule (when)
    schedule = models.JSONField(default=dict)
    # e.g., {"linkedin": ["Mon", "Wed"], "twitter": ["Tue", "Thu"]}

    # Pillars (what topics)
    pillars = ArrayField(models.CharField(max_length=100), default=list)
    # e.g., ["AI", "productivity", "coding"]

    # Voice (how you sound)
    voice = models.TextField(blank=True)
    # e.g., "professional but approachable, no jargon, use examples"

    # Echo's recommendations
    recommendations = models.JSONField(default=dict)
    # Stores Echo's coaching advice for reference

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Why One Model?

Previously we had:
- `ContentGoal` - goals, target metrics
- `BrandVoice` - tone, personality traits
- Platform preferences scattered around
- Pillars as separate selections

But these are all **parts of one strategy**. A user thinks:
> "I want to post to LinkedIn and Twitter 4 times a week to grow my audience"

That's goals + platforms + cadence in one thought. Separating them was wrong.

## UI Changes

### Empty State

Replace the current empty state with goal-focused examples:

```
+------------------------------------------+
| What are your goals?                     |
|                                          |
| Examples:                                |
| • "Post to LinkedIn 3x/week"             |
| • "Grow my Twitter audience"             |
| • "Build thought leadership in AI"       |
| • "Get more consulting clients"          |
|                                          |
| [____________________________________]   |
+------------------------------------------+
```

Examples are clickable pills that send to Echo.

### After Strategy Exists

Once user has a strategy, show it:

```
+------------------------------------------+
| Your strategy                            |
+------------------------------------------+
| LinkedIn + Twitter · 4x/week             |
| Growing audience · AI, productivity      |
|                                          |
| [Continue where I left off]              |
+------------------------------------------+
```

Clicking continues the conversation with context.

### No Checklist

We don't need a 4-item setup checklist. Echo handles onboarding conversationally:

1. User shares goals (free-form or clicks example)
2. Echo coaches and builds strategy
3. Echo saves strategy
4. Next session, Echo recalls and continues

## Refactoring Required

### Models to Consolidate

| Current Model | Location | What Happens |
|---------------|----------|--------------|
| `ContentGoal` | `core/content_engine/models.py` | **Remove** - goals move into Strategy.goals |
| `BrandVoice` (content_engine) | `core/content_engine/models.py` | **Remove** - voice moves into Strategy.voice |
| `BrandVoice` (users) | `core/users/models.py` | **Keep for now** - more detailed, Strategy.voice is summary |
| `EchoOnboardingProgress` | (planned) | **Don't build** - Strategy replaces onboarding checklist |

### Echo Tools to Change

| Current Tool | Location | What Happens |
|--------------|----------|--------------|
| `save_idea` | `services/agents/echo/tools.py` | **Keep** - still needed |
| `get_content_pillars` | `services/agents/echo/tools.py` | **Remove** - pillars are in Strategy now |
| `generate_hooks` | `services/agents/echo/tools.py` | **Remove** - Echo writes hooks directly |
| `expand_to_post` | `services/agents/echo/tools.py` | **Remove** - Echo writes posts directly |
| `strategy` | (new) | **Add** - get/save/update strategy |

### Frontend to Refactor

| Current Component/Hook | What Happens |
|------------------------|--------------|
| `useGoals.ts` | **Remove** - goals are part of strategy |
| `useEchoOnboarding.ts` | **Don't build** - no checklist needed |
| `EchoOnboardingChecklist.tsx` | **Don't build** - replaced by goal examples |
| Quick actions in `EchoConversation.tsx` | **Replace** - with goal examples + strategy summary |
| `services/contentEngine/goals.ts` | **Remove** - goals API not needed |

### API Endpoints to Change

| Current Endpoint | What Happens |
|------------------|--------------|
| `/api/content-engine/goals/` | **Remove** - replaced by strategy |
| `/api/content-engine/brand-voice/` | **Keep** - for detailed brand settings |
| `/api/content-engine/strategy/` | **Add** - get/update strategy |

### Files We Just Created (to remove or not build)

These were created earlier in this session but are now superseded:

| File | Action |
|------|--------|
| `core/content_engine/models.py` - `ContentGoal` model | **Remove** |
| `core/content_engine/migrations/0003_add_content_goal.py` | **Revert/remove** |
| `frontend/src/hooks/useGoals.ts` | **Remove** |
| `frontend/src/services/contentEngine/goals.ts` | **Remove** |
| `frontend/src/types/contentEngine.ts` - goal types | **Remove** |

## Implementation Plan

### Phase 1: Strategy Model & Tool

1. Create `Strategy` model in `core/content_engine/models.py`
2. Create migration
3. Create `strategy` tool in `services/agents/echo/tools.py` (LangChain `@tool` decorator)
4. Update Echo's system prompt in `services/agents/echo/prompts.py`

### Phase 2: UI Updates

1. Update empty state in `EchoConversation.tsx` with goal examples
2. Show current strategy summary when one exists
3. Remove the quick actions approach

### Phase 3: Cleanup & Refactor

1. Remove `ContentGoal` model and migration
2. Remove `generate_hooks` and `expand_to_post` tools
3. Remove `get_content_pillars` tool (pillars in strategy)
4. Remove frontend goals hooks/services/types
5. Remove goals API endpoints

## Technical Context

Echo uses the **AI gateway** - a configurable LangChain-based system that can route to OpenAI, Anthropic, or Gemini based on `core/config/manager.py` settings. Echo is NOT hardcoded to Anthropic.

Current stack:
- `langchain_openai.ChatOpenAI` (name is misleading - it's the gateway interface)
- `langgraph` for agent workflow
- Tools defined in `services/agents/echo/tools.py`
- Prompts in `services/agents/echo/prompts.py`
- State in `services/agents/echo/state.py`

## Echo's System Prompt

Echo needs a system prompt that makes it a proactive coach, not a passive assistant:

```
You are Echo, a social media content coach. You help creators build and execute their content strategy.

## Your Personality
- You're a coach, not an assistant. Give opinions and recommendations.
- Be direct and actionable. No fluff.
- Celebrate wins but push for consistency.
- When someone shares a goal, don't just acknowledge it - give them a plan.

## Your Approach
1. If user has no strategy, help them build one by asking about goals, platforms, and topics.
2. If user has a strategy, reference it when helping them create content.
3. Always tie advice back to their goals.
4. Suggest specific posting schedules, not vague "post regularly" advice.

## When Someone Shares a Goal
Don't say: "Great goal! What platforms are you thinking?"
Do say: "Nice! For growing on LinkedIn, I'd recommend 3x/week - Mon/Wed/Fri mornings. Here's the content mix that works best: [specific advice]. Want me to save this plan?"

## When Helping Create Content
- Reference their pillars: "This fits your AI pillar well"
- Reference their voice: "Keeping it professional but approachable like you wanted"
- Reference their goals: "This kind of post is great for audience growth"

## Tools
- Use `strategy` to save/recall their strategy
- Use `save_idea` to capture content ideas they want to keep
```

## How Strategy Loads on Session Start

Echo should always know the user's strategy without being asked. Two options:

### Option A: Pre-inject into Context (Recommended)

When WebSocket connects, backend loads strategy and injects into system prompt:

```python
# In Echo WebSocket consumer
def connect(self):
    user = self.scope["user"]
    strategy = Strategy.objects.filter(user=user).first()

    # Inject into system message
    if strategy:
        context = f"""
## User's Current Strategy
- Goals: {', '.join(strategy.goals)}
- Platforms: {', '.join(strategy.platforms)}
- Cadence: {strategy.posts_per_week}x/week
- Schedule: {strategy.schedule}
- Pillars: {', '.join(strategy.pillars)}
- Voice: {strategy.voice}
"""
        # Add to system prompt
```

### Option B: Echo Calls Tool First

Echo's system prompt instructs it to call `strategy()` at the start of every conversation to load context.

**Option A is better** - faster, no tool call overhead, strategy is always there.

## Conversation Examples

### New User (No Strategy)

```
[Empty state shows: "What are your goals?" with example pills]

User clicks: "Post to LinkedIn 3x/week"

Echo: "Nice! LinkedIn 3x/week is a solid commitment. Let me help you build a strategy.

For LinkedIn specifically, I'd recommend:

**Schedule:** Mon/Wed/Fri at 8-9am (peak engagement for professionals)

**Content mix:**
- Monday: Personal story or lesson learned
- Wednesday: Tactical tip or how-to
- Friday: Opinion or industry hot take

**Topics:** What do you want to be known for? Pick 2-3 areas (e.g., AI, leadership, startups)

What topics fit your expertise?"

User: "AI and productivity"

Echo: "Perfect combo - lots of overlap there.

Here's your strategy:
- **Platforms:** LinkedIn
- **Cadence:** 3x/week (Mon/Wed/Fri mornings)
- **Pillars:** AI, Productivity
- **Goal:** Grow audience

One more thing - how do you want to come across? Some options:
- Professional but approachable
- Casual and conversational
- Bold and opinionated

User: "Professional but approachable"

Echo: "Got it. I've saved your strategy:

✓ LinkedIn 3x/week (Mon/Wed/Fri)
✓ Topics: AI, Productivity
✓ Voice: Professional but approachable
✓ Goal: Grow audience

Ready to brainstorm your first post? What's something you learned recently about AI or productivity?"
```

### Returning User (Has Strategy)

```
[UI shows strategy summary: "LinkedIn · 3x/week · AI, Productivity"]

User: "Help me write a post"

Echo: "Let's do it! Based on your strategy, it's a good day for a tactical tip (Wednesday = how-to content).

What's something practical about AI or productivity you could teach in 200 words or less?

Or if you want, I can suggest some angles:
- A productivity hack you use daily
- An AI tool that saved you time this week
- A common mistake people make with [topic]"
```

### Updating Strategy

```
User: "I want to add Twitter to my strategy"

Echo: "Nice expansion! With LinkedIn 3x/week already, I'd suggest:

**Twitter:** 5x/week (it's a volume game there)
- Repurpose your LinkedIn posts into threads
- Add 2 quick takes or observations

**New schedule:**
- Mon/Wed/Fri: LinkedIn posts
- Mon-Fri: Twitter (daily, can be lighter)

Your weekly total goes from 3 to 8 posts. That's a jump - you sure you're ready?

Or we could start with 3x/week on Twitter too, matching LinkedIn."

User: "Let's do 3x each"

Echo: "Smart. Updated your strategy:

✓ LinkedIn 3x/week (Mon/Wed/Fri)
✓ Twitter 3x/week (Tue/Thu/Sat)
✓ Topics: AI, Productivity
✓ Voice: Professional but approachable

6 posts/week total. Manageable and consistent. Want to brainstorm content that works for both platforms?"
```

## Strategy Tool Schema

```python
class StrategyInput(BaseModel):
    """Input for strategy tool."""

    # If no fields provided, returns current strategy (GET mode)
    # If fields provided, updates strategy (UPSERT mode)

    goals: list[str] | None = Field(
        default=None,
        description='What user wants to achieve: "grow audience", "get clients", etc.'
    )
    platforms: list[str] | None = Field(
        default=None,
        description='Where they post: "linkedin", "twitter", "youtube"'
    )
    posts_per_week: int | None = Field(
        default=None,
        description='How many posts per week total'
    )
    schedule: dict | None = Field(
        default=None,
        description='When to post: {"linkedin": ["Mon", "Wed"], "twitter": ["Tue", "Thu"]}'
    )
    pillars: list[str] | None = Field(
        default=None,
        description='Content topics: "AI", "productivity", "leadership"'
    )
    voice: str | None = Field(
        default=None,
        description='How they sound: "professional but approachable"'
    )


@tool(args_schema=StrategyInput)
def strategy(
    goals: list[str] | None = None,
    platforms: list[str] | None = None,
    posts_per_week: int | None = None,
    schedule: dict | None = None,
    pillars: list[str] | None = None,
    voice: str | None = None,
    state: dict | None = None,
) -> dict:
    """
    Get or update the user's social media strategy.

    If called with no arguments, returns the current strategy.
    If called with arguments, updates the strategy (partial updates allowed).

    Returns:
        Dictionary with strategy data or success confirmation
    """
    # Implementation...
```

## How Ideas Connect to Strategy

When Echo saves an idea, it should tag it with relevant pillars from the strategy:

```python
# In save_idea tool
idea = ContentIdea.objects.create(
    user=user,
    title=title,
    description=description,
    platforms=platforms,  # From strategy or specified
    pillar=pillar,        # Matched to strategy pillars
    # ...
)
```

**UI consideration:** When showing ideas, group or filter by pillar so users can see balance:
- "You have 5 AI ideas and 1 productivity idea - might want to brainstorm more productivity content"

## Progress Tracking

Echo should help users track execution against their strategy:

### Data to Track

```python
class StrategyProgress(models.Model):
    """Weekly progress against strategy."""
    strategy = models.ForeignKey(Strategy, on_delete=models.CASCADE)
    week_start = models.DateField()  # Monday of the week

    # Posts created (ideas moved to draft/published)
    posts_created = models.PositiveIntegerField(default=0)

    # By platform
    posts_by_platform = models.JSONField(default=dict)
    # {"linkedin": 2, "twitter": 1}

    # By pillar
    posts_by_pillar = models.JSONField(default=dict)
    # {"AI": 2, "productivity": 1}
```

### Echo References Progress

```
User: "What should I work on today?"

Echo: "It's Wednesday and you've posted 1/3 times on LinkedIn this week.

You're light on productivity content lately (last 3 posts were AI).

How about a productivity tip for today's post? Something like:
- Your morning routine
- A tool that saves you time
- How you stay focused"
```

### Progress in UI

Show simple progress indicator:

```
+------------------------------------------+
| This week                    2/6 posts   |
| ████████░░░░░░░░░░░░░░░░░░░             |
| LinkedIn: 1/3 · Twitter: 1/3             |
+------------------------------------------+
```

## Handling Incomplete Strategy

Strategy can be built incrementally. Not all fields required.

### Minimum Viable Strategy

At minimum, Echo needs:
- At least one platform OR one goal

Everything else can be filled in over time.

### Echo Prompts for Missing Pieces

```python
# In Echo's logic
if strategy.platforms and not strategy.pillars:
    # Echo might say:
    "I know you're posting to LinkedIn, but what topics do you
    want to focus on? Having 2-3 pillars helps with consistency."

if strategy.pillars and not strategy.schedule:
    # Echo might say:
    "You've got great topics. Want me to suggest a posting schedule?"
```

### Partial Strategy is OK

```
# User just starting out
Strategy:
  goals: ["grow audience"]
  platforms: ["linkedin"]
  posts_per_week: null      # Not set yet
  schedule: {}              # Not set yet
  pillars: []               # Not set yet
  voice: ""                 # Not set yet
```

Echo can still help:
- "You want to grow on LinkedIn - great! Let's figure out how often you can realistically post..."

The strategy grows through conversation, not a form.

## Open Questions

1. **What about multiple strategies?** (e.g., one for personal brand, one for company)
   - Start with one per user, add multi-strategy later if needed

2. **What about the existing `BrandVoice` model?**
   - Strategy has a `voice` field that captures this
   - Could keep BrandVoice for detailed settings, Strategy.voice for quick reference

3. **Should Echo auto-recall strategy on session start?**
   - Yes - Echo should always know your strategy without being asked

4. **How does strategy connect to scheduling?**
   - Strategy defines the plan (Mon/Wed LinkedIn, Tue/Thu Twitter)
   - Scheduling feature (future) uses this to suggest posting times
