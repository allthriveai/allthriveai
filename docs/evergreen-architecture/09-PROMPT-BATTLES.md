# Prompt Battles Architecture

**Source of Truth** | **Last Updated**: 2025-12-07

This document defines the architecture and data models for AllThrive AI's Prompt Battles feature - a gamified prompt engineering competition system.

---

## Overview

Prompt Battles is a real-time competitive feature where users compete to craft the best AI prompts. Users are given a challenge, write prompts, and an AI judge evaluates submissions to determine the winner.

```
Prompt Battles Flow
├── Matchmaking (find opponent)
├── Challenge Generation (template + variables)
├── Battle Phase (timed prompt writing)
├── AI Generation (execute prompts)
├── AI Judging (score submissions)
└── Results & Points
```

---

## Data Models

### ChallengeType

Stores reusable challenge templates with variable substitution.

| Field | Type | Description |
|-------|------|-------------|
| `key` | CharField | Unique identifier (e.g., 'dreamscape', 'movie_poster') |
| `name` | CharField | Display name |
| `description` | TextField | Challenge type description |
| `templates` | JSONField | List of templates with `{variable}` placeholders |
| `variables` | JSONField | Variable options for substitution |
| `judging_criteria` | JSONField | Scoring criteria with weights |
| `ai_judge_prompt` | TextField | Custom judging instructions |
| `default_duration_minutes` | IntegerField | Battle duration (default: 3) |
| `winner_points` | IntegerField | Points for winning (default: 50) |
| `participation_points` | IntegerField | Points for participating (default: 10) |

**Template System Example:**
```python
# Template
"Design a {style} city in the year {year}"

# Variables
{
    "style": ["utopian", "dystopian", "solarpunk", "cyberpunk", "bio-organic"],
    "year": ["2100", "2250", "3000", "2500"]
}

# Generated Challenge
"Design a bio-organic city in the year 2250"
```

**Current Challenge Types:**

| Key | Name | Templates | Variable Types |
|-----|------|-----------|----------------|
| `dreamscape` | Dreamscape Design | 3 | style, concept, element, atmosphere |
| `movie_poster` | Movie Poster Challenge | 3 | genre, theme, title, concept |
| `creature_design` | Creature Design | 3 | mood, type, habitat, animals, concept |
| `album_cover` | Album Cover Art | 3 | mood, genre, theme, title |
| `future_city` | Future City Vision | 3 | year, style, concept, district, technology |

---

### PromptBattle

The core battle record tracking a competition between two users.

| Field | Type | Description |
|-------|------|-------------|
| `challenger` | ForeignKey(User) | User who initiated the battle |
| `opponent` | ForeignKey(User) | Opponent (nullable for SMS invites) |
| `challenge_type` | ForeignKey(ChallengeType) | The challenge configuration |
| `challenge_text` | TextField | Generated challenge prompt |
| `status` | CharField | pending, active, completed, expired, cancelled |
| `phase` | CharField | Real-time phase tracking |
| `battle_type` | CharField | text_prompt, image_prompt, mixed |
| `duration_minutes` | IntegerField | Battle duration |
| `match_source` | CharField | direct, random, ai_opponent, invitation |
| `winner` | ForeignKey(User) | Battle winner (set after judging) |

**Battle Phases:**
```
waiting → countdown → active → generating → judging → reveal → complete
```

**Match Sources:**
- `direct` - Direct challenge to specific user
- `random` - Matched via matchmaking queue
- `ai_opponent` - Playing against Pip (AI bot)
- `invitation` - SMS invitation to non-user

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

## Challenge Generation Flow

```python
# 1. Select a ChallengeType (random or user-chosen)
challenge_type = ChallengeType.objects.filter(is_active=True).order_by('?').first()

# 2. Pick a random template
template = random.choice(challenge_type.templates)

# 3. Fill in variables
variables = challenge_type.variables
filled_template = template
for var_name, options in variables.items():
    if f"{{{var_name}}}" in filled_template:
        filled_template = filled_template.replace(
            f"{{{var_name}}}",
            random.choice(options)
        )

# 4. Create battle with generated challenge
battle = PromptBattle.objects.create(
    challenger=user,
    challenge_type=challenge_type,
    challenge_text=filled_template,
    ...
)
```

---

## Judging Criteria

Each ChallengeType defines scoring criteria:

```json
{
  "judging_criteria": [
    {"name": "creativity", "weight": 30, "description": "Originality and imagination"},
    {"name": "relevance", "weight": 25, "description": "How well it matches the challenge"},
    {"name": "clarity", "weight": 20, "description": "Clear and specific instructions"},
    {"name": "technical", "weight": 15, "description": "Proper prompt engineering"},
    {"name": "impact", "weight": 10, "description": "Emotional or visual impact"}
  ]
}
```

The AI judge evaluates each submission against these criteria and provides:
- Per-criteria scores
- Overall weighted score
- Detailed feedback

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

All battle models use the `core_` prefix for backwards compatibility:

| Model | Table Name |
|-------|------------|
| ChallengeType | `core_challengetype` |
| PromptBattle | `core_promptbattle` |
| BattleSubmission | `core_battlesubmission` |
| BattleInvitation | `core_battleinvitation` |
| BattleVote | `core_battlevote` |
| BattleMatchmakingQueue | `core_battlematchmakingqueue` |

---

## Admin Management

Challenge types can be managed in Django Admin:
- Add new templates and variables
- Adjust judging criteria and weights
- Set point rewards
- Enable/disable challenge types
- Configure difficulty levels

**Admin URL:** `/thrive-manage/battles/challengetype/`

---

## Adding New Challenge Types

1. Navigate to Django Admin > Battles > Challenge Types
2. Create new ChallengeType with:
   - Unique `key` (e.g., `brand_logo`)
   - Display `name`
   - Template list with `{variable}` placeholders
   - Variable dictionary with options
   - Judging criteria with weights
3. Set `is_active=True` to enable

**Example: Brand Logo Challenge**
```json
{
  "key": "brand_logo",
  "name": "Brand Logo Design",
  "templates": [
    "Design a logo for a {industry} startup called {name}",
    "Create a minimalist logo for a {mood} {industry} brand"
  ],
  "variables": {
    "industry": ["tech", "food", "fitness", "fashion", "finance"],
    "name": ["NovaTech", "GreenLeaf", "SwiftBite", "ZenFlow"],
    "mood": ["playful", "professional", "bold", "elegant"]
  }
}
```
