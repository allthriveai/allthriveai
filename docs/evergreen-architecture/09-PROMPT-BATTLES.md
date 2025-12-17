# Prompt Battles Architecture

**Source of Truth** | **Last Updated**: 2025-12-17

This document defines the architecture and data models for AllThrive AI's Prompt Battles feature - a gamified prompt engineering competition system.

---

## Overview

Prompt Battles is a real-time competitive feature where users compete to craft the best AI prompts. Users are given a challenge, write prompts, and an AI judge evaluates submissions to determine the winner.

```
Prompt Battles Flow
├── Matchmaking (find opponent)
├── Prompt Selection (from curated library)
├── Battle Phase (timed prompt writing)
├── AI Generation (execute prompts)
├── AI Judging (score submissions)
└── Results & Points
```

---

## Data Models

### PromptChallengePrompt (Prompt Library)

**Location**: `core/battles/models.py`

A simple, flat structure for curated battle prompts. Replaces the legacy `ChallengeType` template system with pre-written, ready-to-use prompts.

| Field | Type | Description |
|-------|------|-------------|
| `prompt_text` | TextField | The full prompt text shown to battle participants |
| `category` | ForeignKey(Taxonomy) | Category for organization (e.g., Dreamscape, Movie Poster) |
| `difficulty` | CharField | easy, medium, hard |
| `is_active` | BooleanField | Whether this prompt is available for selection |
| `weight` | FloatField | Selection weight (higher = more likely to be selected) |
| `times_used` | IntegerField | How many times this prompt has been used in battles |
| `created_at` | DateTimeField | When the prompt was created |
| `updated_at` | DateTimeField | When the prompt was last modified |

**Key Design Decisions:**

1. **Pre-written prompts** - No more template variable substitution. Each prompt is a complete, curated challenge ready for immediate use.

2. **Category via Taxonomy** - Uses the existing `Taxonomy` model (filtered to `taxonomy_type='category'`) for flexible categorization without needing a separate model.

3. **Weighted random selection** - The `weight` field allows certain prompts to be selected more frequently, useful for promoting new or seasonal prompts.

4. **Usage tracking** - `times_used` enables analytics and can be used to avoid overusing popular prompts.

**Example Prompt:**
```python
PromptChallengePrompt.objects.create(
    prompt_text="Design a retro-futuristic space station that serves as a luxury hotel orbiting Saturn",
    category=Taxonomy.objects.get(name="Dreamscape", taxonomy_type="category"),
    difficulty="medium",
    is_active=True,
    weight=1.0,
)
```

**Prompt Selection Logic:**
```python
from django.db.models import F
from core.battles.models import PromptChallengePrompt

def select_random_prompt(category=None, difficulty=None):
    """Select a random prompt using weighted selection."""
    queryset = PromptChallengePrompt.objects.filter(is_active=True)

    if category:
        queryset = queryset.filter(category=category)
    if difficulty:
        queryset = queryset.filter(difficulty=difficulty)

    # Weighted random selection
    # Higher weight = higher probability of selection
    prompt = queryset.order_by('?').first()  # Simple random for now

    if prompt:
        # Track usage
        PromptChallengePrompt.objects.filter(pk=prompt.pk).update(
            times_used=F('times_used') + 1
        )

    return prompt
```

---

### PromptBattle

The core battle record tracking a competition between two users.

| Field | Type | Description |
|-------|------|-------------|
| `challenger` | ForeignKey(User) | User who initiated the battle |
| `opponent` | ForeignKey(User) | Opponent (nullable for SMS invites) |
| `prompt` | ForeignKey(PromptChallengePrompt) | The curated prompt used for this battle |
| `challenge_text` | TextField | The challenge prompt text (copied from prompt for permanence) |
| `status` | CharField | pending, active, completed, expired, cancelled |
| `phase` | CharField | Real-time phase tracking |
| `battle_type` | CharField | text_prompt, image_prompt, mixed |
| `battle_mode` | CharField | sync (real-time), async (turn-based), hybrid |
| `duration_minutes` | IntegerField | Battle duration |
| `match_source` | CharField | direct, random, ai_opponent, invitation |
| `winner` | ForeignKey(User) | Battle winner (set after judging) |
| `tool` | ForeignKey(Tool) | AI tool used (e.g., Nano Banana for images) |
| `hidden_by` | ManyToManyField(User) | Users who have hidden this battle |

**Battle Phases (Sync/Real-time):**
```
waiting → countdown → active → generating → judging → reveal → complete
```

**Battle Phases (Async/Turn-based):**
```
waiting → challenger_turn → opponent_turn → generating → judging → reveal → complete
```

**Battle Modes:**
- `sync` - Real-time battle (both players online simultaneously)
- `async` - Turn-based battle (3-minute turns, 3-day deadline)
- `hybrid` - Auto-detect based on player connectivity

**Match Sources:**
- `direct` - Direct challenge to specific user
- `random` - Matched via matchmaking queue
- `ai_opponent` - Playing against Pip (AI bot)
- `invitation` - SMS or link invitation to non-user

---

### BattleSubmission

User's prompt submission for a battle.

| Field | Type | Description |
|-------|------|-------------|
| `battle` | ForeignKey(PromptBattle) | Parent battle |
| `user` | ForeignKey(User) | Submitting user |
| `prompt_text` | TextField | User's crafted prompt |
| `submission_type` | CharField | text or image |
| `generated_output_url` | URLField | Generated image URL (if applicable) |
| `generated_output_text` | TextField | Generated text output |
| `score` | FloatField | AI-evaluated score (0-100) |
| `criteria_scores` | JSONField | Breakdown by judging criteria |
| `evaluation_feedback` | TextField | AI feedback on prompt quality |

**Constraint:** One submission per user per battle (unique_together).

---

### BattleVote

Scoring record from AI judge or community votes.

| Field | Type | Description |
|-------|------|-------------|
| `battle` | ForeignKey(PromptBattle) | The battle |
| `submission` | ForeignKey(BattleSubmission) | Submission being scored |
| `voter` | ForeignKey(User) | Null for AI judge |
| `vote_source` | CharField | ai, community, panel |
| `score` | FloatField | Score (0-100) |
| `criteria_scores` | JSONField | Per-criteria breakdown |
| `feedback` | TextField | Explanation of scoring |
| `weight` | FloatField | Vote weight for aggregation |

---

### BattleInvitation

Tracks battle invitations, including SMS invites to non-users.

| Field | Type | Description |
|-------|------|-------------|
| `sender` | ForeignKey(User) | Invitation sender |
| `recipient` | ForeignKey(User) | Platform user (nullable) |
| `recipient_phone` | CharField | Phone for SMS invites (E.164) |
| `invitation_type` | CharField | platform, sms, random |
| `invite_token` | CharField | Unique token for SMS links |
| `status` | CharField | pending, accepted, declined, expired |
| `expires_at` | DateTimeField | 24-hour expiration |

---

### BattleMatchmakingQueue

Queue for random matchmaking.

| Field | Type | Description |
|-------|------|-------------|
| `user` | OneToOneField(User) | User in queue |
| `challenge_type` | ForeignKey(ChallengeType) | Preferred type (null = any) |
| `match_type` | CharField | random or ai |
| `queued_at` | DateTimeField | Queue entry time |
| `expires_at` | DateTimeField | Queue expiration |

---

## Prompt Selection Flow

The new prompt library uses pre-written, curated prompts instead of template-based generation:

```python
from django.db.models import F
from core.battles.models import PromptBattle, PromptChallengePrompt

# 1. Select a prompt from the library (weighted random)
prompt = PromptChallengePrompt.objects.filter(
    is_active=True
).order_by('?').first()

# 2. Increment usage counter
PromptChallengePrompt.objects.filter(pk=prompt.pk).update(
    times_used=F('times_used') + 1
)

# 3. Create battle with the prompt
battle = PromptBattle.objects.create(
    challenger=user,
    prompt=prompt,
    challenge_text=prompt.prompt_text,  # Copy for permanence
    ...
)
```

**Why Pre-written Prompts?**

The legacy `ChallengeType` system used templates with variable substitution (e.g., "Design a {style} city in {year}"). This was replaced with `PromptChallengePrompt` for several reasons:

1. **Quality control** - Each prompt is hand-crafted and reviewed before use
2. **Simplicity** - No complex template parsing or variable management
3. **Predictability** - What you see in admin is exactly what users see
4. **Easier content management** - Non-technical team members can add prompts
5. **Category flexibility** - Uses existing Taxonomy system for organization

---

## Judging Criteria

The AI judge evaluates submissions against standard criteria:

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Creativity** | 30% | Originality and imagination |
| **Relevance** | 25% | How well it matches the challenge |
| **Clarity** | 20% | Clear and specific instructions |
| **Technical** | 15% | Proper prompt engineering techniques |
| **Impact** | 10% | Emotional or visual impact potential |

The AI judge evaluates each submission against these criteria and provides:
- Per-criteria scores (stored in `BattleSubmission.criteria_scores`)
- Overall weighted score (stored in `BattleSubmission.score`)
- Detailed feedback (stored in `BattleSubmission.evaluation_feedback`)

---

## WebSocket Real-Time Updates

Battles use WebSocket connections for real-time updates:

```
ws://localhost:8000/ws/battle/{battle_id}/
```

**Events:**
- `battle.started` - Battle begins
- `battle.phase_changed` - Phase transition
- `submission.received` - Opponent submitted
- `generation.complete` - AI output ready
- `judging.complete` - Scores available
- `battle.ended` - Final results

---

## Points & Gamification

| Action | Points |
|--------|--------|
| Win a battle | 50 (configurable per ChallengeType) |
| Participate | 10 (configurable per ChallengeType) |
| Win streak bonus | +10 per consecutive win |
| First battle of day | +5 |

Points contribute to:
- User level progression
- Leaderboard rankings
- Badge unlocks

---

## Database Tables

All battle models use the `core_` prefix:

| Model | Table Name |
|-------|------------|
| PromptChallengePrompt | `core_promptchallengeprompt` |
| PromptBattle | `core_promptbattle` |
| BattleSubmission | `core_battlesubmission` |
| BattleInvitation | `core_battleinvitation` |
| BattleVote | `core_battlevote` |
| BattleMatchmakingQueue | `core_battlematchmakingqueue` |

---

## Admin Management

### Prompt Library Management

The prompt library is managed via Django Admin:

**Admin URL:** `/thrive-manage/battles/promptchallengeprompt/`

Features:
- Add new curated prompts
- Assign categories (via Taxonomy)
- Set difficulty levels (easy, medium, hard)
- Adjust selection weight
- Enable/disable prompts
- View usage statistics (`times_used`)

### Adding New Prompts

1. Navigate to Django Admin > Battles > Prompt Challenge Prompts
2. Click "Add Prompt Challenge Prompt"
3. Fill in:
   - **Prompt text**: The complete challenge shown to users
   - **Category**: Select from existing Taxonomy categories
   - **Difficulty**: easy, medium, or hard
   - **Weight**: Higher = more likely to be selected (default 1.0)
   - **Is active**: Check to enable for battles
4. Save

**Example Prompts:**

```
# Dreamscape Category
"Design a floating island city where buildings are grown from giant bioluminescent mushrooms"

# Movie Poster Category
"Create a vintage 1970s movie poster for a sci-fi thriller about time-traveling detectives"

# Creature Design Category
"Design a friendly alien species that communicates through changing colors and patterns"

# Album Cover Category
"Create an album cover for an electronic music artist inspired by deep ocean exploration"
```

### Category Management

Categories are managed through the Taxonomy system:

**Admin URL:** `/thrive-manage/core/taxonomy/`

To create a new battle category:
1. Navigate to Django Admin > Core > Taxonomies
2. Create with `taxonomy_type='category'`
3. The category will appear in the Prompt Challenge Prompt dropdown

---

## Migration Notes

### From ChallengeType to PromptChallengePrompt (December 2025)

The legacy `ChallengeType` model with template-based generation was replaced with `PromptChallengePrompt`:

**What Changed:**
- `ChallengeType` model **removed** (migration `0010_remove_challenge_type.py`)
- `PromptChallengePrompt` model **added** (migration `0009_alter_promptbattle_challenge_type_and_more.py`)
- `PromptBattle.challenge_type` field **removed**
- `PromptBattle.prompt` field **added** (FK to `PromptChallengePrompt`)

**Why:**
- Simpler admin experience (no template/variable complexity)
- Better quality control (each prompt is hand-crafted)
- Easier content management for non-technical team members
- Leverage existing Taxonomy system for categorization

**Backwards Compatibility:**
- Existing battles retain their `challenge_text` (the prompt text is copied, not referenced)
- New battles use `prompt` FK for tracking which library prompt was used

---

**Version**: 1.1
**Status**: Stable
**Review Cadence**: Quarterly
