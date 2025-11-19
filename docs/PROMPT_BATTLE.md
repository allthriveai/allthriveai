# Prompt Battle Feature

A competitive, timed prompt generation game where users challenge each other to create the best prompts for AI agents.

## Overview

Prompt Battle is a gamified feature that allows AllThrive users to:
- Challenge other users to timed prompt generation battles
- Compete to create the best prompts for random AI challenges
- Have submissions automatically evaluated by AI agents
- Build reputation through wins and high scores
- View global leaderboards

## Features

### Battle Types

1. **Text Prompt**: Create prompts for text generation (stories, explanations, etc.)
2. **Image Prompt**: Create prompts for image generation (DALL-E, Midjourney style)
3. **Mixed**: Flexible challenge allowing either text or image prompts

### Battle Flow

1. **Challenge Creation**: User A sends a battle invitation to User B
2. **Invitation**: User B receives notification and can accept or decline
3. **Battle Start**: Upon acceptance, both users receive a random challenge
4. **Timed Competition**: Users have 1-60 minutes (default 10) to craft their best prompt
5. **Submission**: Both users submit their prompts before time expires
6. **AI Evaluation**: AllThrive AI agents evaluate submissions on:
   - Relevance to challenge (30%)
   - Clarity and specificity (25%)
   - Creativity and originality (25%)
   - Likelihood of high-quality output (20%)
7. **Results**: Winner determined by highest score; both receive detailed feedback

## Architecture

### Backend Components

#### Models (`core/battle_models.py`)
- **PromptBattle**: Main battle entity with status, timing, and participants
- **BattleSubmission**: User submissions with AI scores and feedback
- **BattleInvitation**: Invitation system with expiration (24 hours)

#### Serializers (`core/battle_serializers.py`)
- Full battle details with nested relationships
- Lightweight list serializers for performance
- Validation for submissions and invitations

#### Views (`core/battle_views.py`)
- `PromptBattleViewSet`: CRUD operations for battles
- `BattleInvitationViewSet`: Invitation management
- Endpoints for stats, leaderboard, and expiration

#### Service Layer (`services/battle_service.py`)
- Random challenge generation with templates
- AI-powered submission evaluation
- Battle lifecycle management
- Statistics aggregation

### Frontend Components

#### Pages
- **PromptBattlePage** (`frontend/src/pages/play/PromptBattlePage.tsx`)
  - Dashboard showing active battles, pending invitations, and stats
  - Challenge modal for creating new battles
  - Real-time updates every 30 seconds

- **BattleDetailPage** (`frontend/src/pages/play/BattleDetailPage.tsx`)
  - Active battle view with countdown timer
  - Prompt submission interface
  - Real-time battle status updates every 5 seconds
  - Results display with scores and AI feedback

### API Endpoints

#### Battle Management
```
GET    /api/v1/me/battles/                    - List user's battles
GET    /api/v1/me/battles/active/             - Active battles only
GET    /api/v1/me/battles/history/            - Completed battles
GET    /api/v1/me/battles/{id}/               - Battle detail
POST   /api/v1/me/battles/{id}/submit/        - Submit prompt
POST   /api/v1/me/battles/{id}/cancel/        - Cancel battle
```

#### Invitations
```
GET    /api/v1/me/battle-invitations/                 - List all invitations
GET    /api/v1/me/battle-invitations/pending/         - Pending invitations
GET    /api/v1/me/battle-invitations/sent/            - Sent invitations
POST   /api/v1/me/battle-invitations/create_invitation/ - Create invitation
POST   /api/v1/me/battle-invitations/{id}/accept/     - Accept invitation
POST   /api/v1/me/battle-invitations/{id}/decline/    - Decline invitation
```

#### Stats & Leaderboard
```
GET    /api/v1/battles/stats/                 - User's battle statistics
GET    /api/v1/battles/leaderboard/           - Global leaderboard (top 20)
POST   /api/v1/battles/expire/                - Expire old battles (admin/cron)
```

## Database Schema

### PromptBattle
```python
- id (PK)
- challenger (FK -> User)
- opponent (FK -> User)
- challenge_text (TextField)
- status (pending|active|completed|expired|cancelled)
- battle_type (text_prompt|image_prompt|mixed)
- duration_minutes (default 10)
- created_at, started_at, expires_at, completed_at
- winner (FK -> User, nullable)
```

### BattleSubmission
```python
- id (PK)
- battle (FK -> PromptBattle)
- user (FK -> User)
- prompt_text (TextField)
- submission_type (text|image)
- generated_output_url, generated_output_text
- score (0-100, AI-evaluated)
- evaluation_feedback (TextField)
- submitted_at, evaluated_at
- UNIQUE(battle, user)
```

### BattleInvitation
```python
- id (PK)
- battle (OneToOne -> PromptBattle)
- sender (FK -> User)
- recipient (FK -> User)
- message (optional)
- status (pending|accepted|declined|expired)
- created_at, responded_at, expires_at (24h)
```

## AI Challenge Generation

Challenges are randomly generated using templates with variables:

```python
# Example template
"Create a prompt for an AI agent to explain {concept} to a {audience}"

# Variables
concept: quantum computing, blockchain, machine learning, ...
audience: 5-year-old, business executive, university student, ...

# Generated challenge
"Create a prompt for an AI agent to explain blockchain technology to a 5-year-old child"
```

The service includes 40+ templates across all battle types and 20+ variable categories.

## AI Evaluation System

Submissions are evaluated using AllThrive AI agents (OpenAI/Anthropic):

1. **Evaluation Criteria**:
   - Relevance: Does it address the challenge?
   - Clarity: Is it specific and well-structured?
   - Creativity: Is it original and innovative?
   - Output Quality: Will it produce good results?

2. **Scoring**: 0-100 scale with detailed feedback

3. **Fallback**: If AI evaluation fails, default score of 50 is applied

## Setup Instructions

### 1. Start Docker Containers
```bash
make up
```

### 2. Run Setup Script
```bash
./scripts/setup_prompt_battle.sh
```

This will:
- Create database migrations
- Apply migrations
- Display available endpoints

### 3. Access the Feature
Navigate to: `http://localhost:3000/play/prompt-battle`

## Usage Guide

### Creating a Battle

1. Click "Challenge User" button
2. Enter opponent's username
3. Select battle type (Text/Image/Mixed)
4. Set duration (1-60 minutes)
5. Optional: Add a personal message
6. Send challenge

### Accepting an Invitation

1. View pending invitations on main page
2. Read the challenge and details
3. Click "Accept" to start immediately
4. Or "Decline" to reject

### During Battle

1. Read the AI-generated challenge carefully
2. Craft your best prompt (10-5000 characters)
3. Submit before timer expires
4. Wait for opponent to submit
5. View results automatically when both submit

### After Battle

- See your score and opponent's score
- Read detailed AI feedback
- View winner announcement
- Check updated stats and leaderboard rank

## Performance Considerations

1. **Database Indexes**: All queries use indexed fields
2. **Query Optimization**: Uses `select_related()` and `prefetch_related()`
3. **Caching**: Consider adding Redis caching for leaderboard
4. **Real-time Updates**: Frontend polls every 5-30 seconds
5. **Expiration Job**: Run `expire_battles` endpoint via cron job

## Future Enhancements

1. **Real-time WebSockets**: Replace polling with WebSocket updates
2. **Tournaments**: Multi-round competitions
3. **Teams**: Group battles
4. **Seasons**: Periodic leaderboard resets with rewards
5. **Replay System**: View past battle submissions
6. **AI Model Selection**: Let users choose evaluation model
7. **Custom Challenges**: Users create their own challenges
8. **Social Sharing**: Share battle results
9. **Achievements**: Badges and unlockables
10. **Spectator Mode**: Watch ongoing battles

## Testing

### Manual Testing Checklist

- [ ] Create invitation successfully
- [ ] Accept invitation starts battle correctly
- [ ] Decline invitation cancels battle
- [ ] Timer counts down accurately
- [ ] Prompt submission works
- [ ] Can't submit twice
- [ ] Both submissions triggers evaluation
- [ ] Scores and feedback display correctly
- [ ] Winner determination works
- [ ] Stats update after battle
- [ ] Leaderboard shows correct rankings
- [ ] Battle expiration works

### Automated Testing

Create tests in `core/tests/test_battles.py`:

```python
from django.test import TestCase
from core.battle_models import PromptBattle
from services.battle_service import BattleService

class BattleTests(TestCase):
    def test_create_invitation(self):
        # Test invitation creation
        pass

    def test_accept_invitation(self):
        # Test invitation acceptance
        pass

    def test_submit_prompt(self):
        # Test prompt submission
        pass

    def test_evaluation(self):
        # Test AI evaluation
        pass
```

## Troubleshooting

### Common Issues

1. **Migrations fail**: Ensure Docker containers are running (`make up`)
2. **AI evaluation errors**: Check API keys in settings (OPENAI_API_KEY, etc.)
3. **Timer not updating**: Check browser console for API errors
4. **Invitations not showing**: Verify user is authenticated

### Debug Mode

Add logging in `services/battle_service.py`:
```python
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Evaluating battle {battle.id}")
```

## Security Considerations

1. **Authorization**: Users can only access their own battles
2. **Validation**: All inputs are validated server-side
3. **Rate Limiting**: Consider adding rate limits to prevent spam
4. **Injection Prevention**: All text fields are sanitized
5. **Timeouts**: Battles auto-expire, invitations expire in 24h

## License & Credits

Part of AllThrive AI platform.
- AI evaluation powered by OpenAI/Anthropic
- Built with Django REST Framework & React
