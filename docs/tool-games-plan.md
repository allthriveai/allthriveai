# Tool Trading Card Games Plan

## Goal
Add fun, entertaining game modes that help users discover AI tools through gameplay.

## Status: Schema Complete ✅ | Data Complete ✅ | Game Modes: Ready to Build

---

## Game Modes Overview

### 🎯 Game 1: Tool Match (Quick, Solo, <1 min)
**Concept**: Match tools to their descriptions, superpowers, or example projects
**Mechanics**:
- Show a superpower/description/project → pick correct tool from 4 options
- Streak-based scoring (5, 10, 15 streak bonuses)
- Timed mode optional (20 seconds per question)
- Categories: "Match the Superpower", "What Tool Made This?", "Use Case Match"

### 🧭 Game 2: Discovery Quest (Medium, Solo, 2-5 min)
**Concept**: Walk a path of questions to discover your ideal tool
**Mechanics**:
- 5-7 branching questions narrow down from 65 → 1-3 tools
- Visual path/journey metaphor (not just a quiz)
- Questions like: "What are you creating?", "What's your skill level?", "Budget?"
- Reveals matched tools with explanation of why they fit
- Can save/share result ("My perfect tool stack")

### ⚔️ Game 3: Project Challenge (PvP, Variable)
**Concept**: Given a project, who picks the best tool?
**Mechanics**:
- Both players see: "Build an AI chatbot for customer support"
- Both pick from 4-6 relevant tool options
- Optional: Write 1-sentence reasoning
- Simultaneous reveal
- AI judges based on tool fit + optional reasoning quality
- Best of 3 rounds for tournament feel

---

## Prioritized Implementation Order

1. **Tool Match** - Easiest, reuses existing quiz patterns
2. **Discovery Quest** - Medium complexity, standalone
3. **Project Challenge** - Uses existing battle infrastructure

---

## Implementation: Tool Match (Phase 1)

### Data Model
```python
# core/games/models.py
class ToolMatchQuestion(models.Model):
    """Pre-generated match questions for fast gameplay"""
    QUESTION_TYPES = [
        ('superpower', 'Match the Superpower'),
        ('use_case', 'What Tool For This?'),
        ('description', 'Match the Description'),
    ]

    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    prompt_text = models.TextField()  # "Which tool has 'Constitutional AI'?"
    correct_tool = models.ForeignKey(Tool, on_delete=models.CASCADE)
    difficulty = models.IntegerField(default=1)  # 1-3

class ToolMatchSession(models.Model):
    """User game session for scoring"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    score = models.IntegerField(default=0)
    streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)
    questions_answered = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True)
```

### API Endpoints
```
GET  /api/games/tool-match/question/  → Get next question + 4 options
POST /api/games/tool-match/answer/    → Submit answer, get result + new question
GET  /api/games/tool-match/session/   → Get current session stats
POST /api/games/tool-match/end/       → End session, save high score
```

### Frontend Components
- `ToolMatchGame.tsx` - Main game container
- `QuestionCard.tsx` - Shows prompt and 4 tool options
- `ToolOption.tsx` - Clickable tool card with logo/name
- `StreakIndicator.tsx` - Visual streak counter with bonuses
- `GameOverScreen.tsx` - Final score, share button

### Key Files to Modify/Create
| File | Action |
|------|--------|
| `core/games/` | New app for game modes |
| `core/games/models.py` | ToolMatchQuestion, ToolMatchSession |
| `core/games/views.py` | Question generation, answer validation |
| `core/games/serializers.py` | Game data serialization |
| `frontend/src/pages/ToolMatchPage.tsx` | Game page |
| `frontend/src/components/games/` | Game UI components |

---

## Implementation: Discovery Quest (Phase 2)

### Data Model
```python
class DiscoveryPath(models.Model):
    """A branching question path"""
    title = models.CharField(max_length=100)  # "Find Your AI Tool"
    description = models.TextField()

class DiscoveryNode(models.Model):
    """A node in the discovery tree"""
    path = models.ForeignKey(DiscoveryPath, on_delete=models.CASCADE)
    question = models.TextField()  # "What are you creating?"
    parent = models.ForeignKey('self', null=True, on_delete=models.CASCADE)
    order = models.IntegerField(default=0)

class DiscoveryChoice(models.Model):
    """Answer choice that leads to next node or result"""
    node = models.ForeignKey(DiscoveryNode, on_delete=models.CASCADE)
    text = models.CharField(max_length=100)  # "Video content"
    next_node = models.ForeignKey(DiscoveryNode, null=True)  # null = terminal
    result_tools = models.ManyToManyField(Tool, blank=True)  # Tools if terminal

class DiscoveryResult(models.Model):
    """User's discovery journey result"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    path = models.ForeignKey(DiscoveryPath, on_delete=models.CASCADE)
    choices = models.JSONField(default=list)  # Path taken
    matched_tools = models.ManyToManyField(Tool)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Frontend Components
- `DiscoveryQuestPage.tsx` - Main journey container
- `PathVisualizer.tsx` - Visual path with nodes
- `QuestionNode.tsx` - Current question with choices
- `ToolReveal.tsx` - Animated reveal of matched tools
- `ShareResult.tsx` - Shareable result card

---

## Implementation: Project Challenge (Phase 3 - PvP)

### Leverage Existing Battle Infrastructure
Extend `core/battles/` with new battle type:

```python
# In core/battles/models.py, add to BattleType choices:
TOOL_CHALLENGE = 'tool_challenge', 'Tool Challenge'

class ToolChallenge(models.Model):
    """Project scenario for tool battles"""
    title = models.CharField(max_length=200)  # "Build AI customer support"
    description = models.TextField()
    valid_tools = models.ManyToManyField(Tool)  # 4-6 relevant options
    best_tool = models.ForeignKey(Tool, on_delete=models.CASCADE)
    best_reasoning = models.TextField()  # Why it's best
    difficulty = models.IntegerField(default=2)

class ToolChallengeSubmission(models.Model):
    """Player's tool pick for a challenge"""
    battle = models.ForeignKey(PromptBattle, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    challenge = models.ForeignKey(ToolChallenge, on_delete=models.CASCADE)
    selected_tool = models.ForeignKey(Tool, on_delete=models.CASCADE)
    reasoning = models.TextField(blank=True)  # Optional 1-sentence
    score = models.IntegerField(default=0)  # AI-judged score
```

### Judging Logic
- Correct tool = 100 points
- Close alternative = 70 points
- Reasonable choice = 40 points
- Wrong category = 10 points
- Good reasoning = +20 bonus

### WebSocket Events (extend BattleConsumer)
- `tool_pick` - Player picks a tool
- `tool_reveal` - Both picks revealed
- `challenge_judged` - AI scores revealed

---

## Already Complete ✅

The following foundation is already in place:

### Tool Game Data (65 tools populated)
- `superpowers` - 2-3 per tool with title/description
- `game_stats` - power, speed, versatility, ease_of_use, value (1-10)
- `rarity` - common/uncommon/rare/epic/legendary
- `synergy_tools` - List of complementary tool slugs
- `element` - Computed from category (creative/analytical/generative/productive/infrastructure)

### Existing Infrastructure to Leverage
- **Battles**: `core/battles/` - Real-time and async battle system
- **Quests**: `core/thrive_circle/models.py` - SideQuest framework
- **Points**: Activity tracking and gamification
- **WebSocket**: Django Channels with BattleConsumer

---

## Next Steps: Start with Tool Match

**Recommended first game**: Tool Match (Quick, Solo)
- Easiest to implement
- Uses existing quiz patterns
- High replayability
- Good for viral sharing ("I got 15 streak!")

### Phase 1: Tool Match MVP
1. Create `core/games/` Django app
2. Add ToolMatchSession model for tracking
3. Dynamic question generation from existing tool data
4. Simple React game UI with streak counter
5. Share result functionality

### Phase 2: Discovery Quest
1. Design question tree (5-7 branching questions)
2. Map terminal nodes to tool recommendations
3. Build visual path UI component
4. Save/share journey results

### Phase 3: Project Challenge (PvP)
1. Extend existing battle consumer
2. Add ToolChallenge scenarios
3. AI judging for tool selection
4. Leaderboard integration
