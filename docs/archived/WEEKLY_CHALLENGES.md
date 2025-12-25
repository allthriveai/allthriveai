# Weekly Challenges Feature Plan

## Overview

Weekly Challenges are community-wide creative challenges that encourage participation, showcase user work, and provide a pathway for sponsor integration. Unlike 1v1 Battles, Weekly Challenges favor **participation over competition** while still offering friendly competition through leaderboards.

## Goals

1. **Increase user engagement** through weekly creative prompts
2. **Showcase user work** with a dedicated landing page
3. **Create sponsorship opportunities** with AI tool companies
4. **Build community** through voting and participation rewards
5. **Real-time leaderboards** using Redis sorted sets

## Philosophy: Participation > Competition

- Everyone who submits gets participation points/rewards
- Voting on others' submissions also earns points
- Leaderboard exists for friendly competition, but prizes for multiple tiers
- Focus on creative expression, not just "winning"

---

## Data Models

### 1. WeeklyChallenge

The main challenge definition.

```python
class WeeklyChallenge(models.Model):
    """Weekly creative challenge for the community."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('upcoming', 'Upcoming'),
        ('active', 'Active'),
        ('voting', 'Voting Period'),
        ('completed', 'Completed'),
    ]

    # Identity
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    title = models.CharField(max_length=200)  # "AI Art Week: Dreamscapes"
    slug = models.SlugField(unique=True)
    description = models.TextField()  # Full challenge description
    prompt = models.TextField()  # The actual creative prompt

    # Timing
    week_number = models.IntegerField()  # Week of year
    year = models.IntegerField()
    starts_at = models.DateTimeField()
    submission_deadline = models.DateTimeField()
    voting_deadline = models.DateTimeField()  # Optional voting period
    ends_at = models.DateTimeField()

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    is_featured = models.BooleanField(default=True)

    # Configuration
    max_submissions_per_user = models.IntegerField(default=3)
    allow_voting = models.BooleanField(default=True)
    require_project_link = models.BooleanField(default=True)

    # Visual
    hero_image_url = models.URLField(blank=True)
    theme_color = models.CharField(max_length=20, default='purple')

    # Sponsor (optional FK)
    sponsor = models.ForeignKey('ChallengeSponsor', null=True, blank=True)

    # Prize configuration (JSON for flexibility)
    prizes = models.JSONField(default=dict)
    # Example: {
    #   "1st": {"type": "cash", "amount": 100, "currency": "USD"},
    #   "2nd": {"type": "tokens", "amount": 500000},
    #   "3rd": {"type": "tokens", "amount": 250000},
    #   "participation": {"type": "tokens", "amount": 10000}
    # }

    # Stats (cached)
    submission_count = models.IntegerField(default=0)
    participant_count = models.IntegerField(default=0)
    total_votes = models.IntegerField(default=0)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 2. ChallengeSubmission

User submissions to a challenge.

```python
class ChallengeSubmission(models.Model):
    """User submission for a weekly challenge."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    challenge = models.ForeignKey(WeeklyChallenge, related_name='submissions')
    user = models.ForeignKey(User, related_name='challenge_submissions')

    # Submission content
    project = models.ForeignKey('Project', null=True, blank=True)  # Link to existing project
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)  # Direct image if no project
    external_url = models.URLField(blank=True)  # External link if needed

    # Scoring
    vote_count = models.IntegerField(default=0)
    judge_score = models.FloatField(null=True, blank=True)  # Optional judge scoring
    final_rank = models.IntegerField(null=True, blank=True)  # Set when challenge ends

    # Points
    participation_points_awarded = models.IntegerField(default=0)
    bonus_points_awarded = models.IntegerField(default=0)

    # Flags
    is_featured = models.BooleanField(default=False)  # Editor's pick
    is_disqualified = models.BooleanField(default=False)

    # Timestamps
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['challenge', 'user', 'project']  # One submission per project
        ordering = ['-vote_count', '-submitted_at']
```

### 3. ChallengeVote

Community voting on submissions.

```python
class ChallengeVote(models.Model):
    """Vote on a challenge submission."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    submission = models.ForeignKey(ChallengeSubmission, related_name='votes')
    voter = models.ForeignKey(User, related_name='challenge_votes')

    # Vote can be weighted in future (e.g., verified users get more weight)
    weight = models.FloatField(default=1.0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['submission', 'voter']  # One vote per user per submission
```

### 4. ChallengeSponsor

Sponsor information for branded challenges.

```python
class ChallengeSponsor(models.Model):
    """Sponsor/partner for weekly challenges."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)

    # Company info
    name = models.CharField(max_length=200)  # "OpenAI", "Anthropic", etc.
    slug = models.SlugField(unique=True)
    logo_url = models.URLField()
    website_url = models.URLField()
    description = models.TextField(blank=True)

    # Contact (internal)
    contact_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)  # Verified partner

    # Stats
    total_challenges_sponsored = models.IntegerField(default=0)
    total_prize_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
```

---

## Redis Leaderboard Architecture

### Key Structure

```
# Real-time leaderboard (sorted set)
challenge:{challenge_id}:leaderboard
  - member: user_id
  - score: vote_count (or composite score)

# User's rank cache
challenge:{challenge_id}:user:{user_id}:rank

# Submission count per user (for max submissions check)
challenge:{challenge_id}:user:{user_id}:submission_count

# Global participation tracking
challenge:participation:weekly:{year}:{week}
  - member: user_id
  - score: submission_count
```

### Leaderboard Service

```python
class ChallengeLeaderboardService:
    """Redis-backed real-time leaderboard for challenges."""

    LEADERBOARD_KEY = "challenge:{challenge_id}:leaderboard"

    @classmethod
    def add_vote(cls, challenge_id: str, user_id: int, increment: int = 1):
        """Increment a user's score in the leaderboard."""
        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)
        redis_client.zincrby(key, increment, str(user_id))

    @classmethod
    def get_leaderboard(cls, challenge_id: str, start: int = 0, end: int = 99):
        """Get top N users from leaderboard."""
        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)
        # Returns list of (user_id, score) tuples, highest first
        return redis_client.zrevrange(key, start, end, withscores=True)

    @classmethod
    def get_user_rank(cls, challenge_id: str, user_id: int) -> int:
        """Get a user's rank (1-indexed)."""
        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)
        rank = redis_client.zrevrank(key, str(user_id))
        return rank + 1 if rank is not None else None

    @classmethod
    def get_user_score(cls, challenge_id: str, user_id: int) -> int:
        """Get a user's current score."""
        key = cls.LEADERBOARD_KEY.format(challenge_id=challenge_id)
        return int(redis_client.zscore(key, str(user_id)) or 0)
```

---

## Points & Rewards System

### Point Values (configurable per challenge)

| Activity | Points | Notes |
|----------|--------|-------|
| Submit entry | 50 | Per submission (up to max) |
| Early bird bonus | 25 | Submit in first 24 hours |
| Vote on others | 5 | Per vote (max 20/day) |
| Receive vote | 2 | Per vote received |
| Featured pick | 100 | Editor's choice |
| 1st place | 500 | Winner |
| 2nd place | 300 | Runner up |
| 3rd place | 200 | 3rd place |
| Top 10 | 100 | Places 4-10 |

### Prize Distribution

```python
# Example prize configuration
PRIZE_CONFIG = {
    "winner_pool": {
        "1": {"type": "cash", "amount": 100, "currency": "USD"},
        "2": {"type": "tokens", "amount": 500000},
        "3": {"type": "tokens", "amount": 250000},
    },
    "participation": {
        "type": "tokens",
        "amount": 10000,  # Everyone who submits
    },
    "voting_reward": {
        "type": "tokens",
        "amount": 1000,  # For voting on 10+ submissions
    }
}
```

---

## API Endpoints

### Challenge Endpoints

```
GET  /api/challenges/                      # List challenges (active, upcoming, past)
GET  /api/challenges/current/              # Get current active challenge
GET  /api/challenges/{slug}/               # Get challenge details
GET  /api/challenges/{slug}/submissions/   # List submissions (paginated)
GET  /api/challenges/{slug}/leaderboard/   # Get leaderboard
POST /api/challenges/{slug}/submit/        # Submit entry
POST /api/challenges/{slug}/vote/{submission_id}/  # Vote on submission
GET  /api/challenges/{slug}/my-submissions/ # User's own submissions
```

### Response Examples

```json
// GET /api/challenges/current/
{
  "id": "uuid",
  "title": "AI Art Week: Dreamscapes",
  "slug": "ai-art-week-dreamscapes",
  "prompt": "Create a surreal dreamscape using your favorite AI image generator...",
  "status": "active",
  "starts_at": "2024-12-02T00:00:00Z",
  "submission_deadline": "2024-12-06T23:59:59Z",
  "ends_at": "2024-12-08T23:59:59Z",
  "sponsor": {
    "name": "Midjourney",
    "logo_url": "https://...",
    "website_url": "https://midjourney.com"
  },
  "prizes": {
    "1st": {"type": "cash", "amount": 100, "currency": "USD"},
    "2nd": {"type": "tokens", "amount": 500000},
    "participation": {"type": "tokens", "amount": 10000}
  },
  "stats": {
    "submission_count": 47,
    "participant_count": 35,
    "time_remaining": "3d 4h 22m"
  },
  "user_status": {
    "has_submitted": true,
    "submission_count": 2,
    "can_submit_more": true,
    "votes_cast": 12
  }
}
```

---

## Frontend Components

### 1. Challenge Landing Page (`/challenges/[slug]`)

```
┌─────────────────────────────────────────────────────────────┐
│  [Sponsor Logo]  WEEKLY CHALLENGE                           │
│                                                             │
│  🎨 AI Art Week: Dreamscapes                               │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Create a surreal dreamscape using your favorite AI        │
│  image generator. Show us worlds that exist only in        │
│  dreams!                                                    │
│                                                             │
│  ⏰ 3 days, 4 hours remaining                              │
│  👥 47 submissions · 35 participants                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🏆 PRIZES                                          │   │
│  │  1st: $100 Cash                                     │   │
│  │  2nd: 500,000 AI Tokens                             │   │
│  │  3rd: 250,000 AI Tokens                             │   │
│  │  Everyone: 10,000 Tokens for participating          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [🚀 Submit Your Entry]  [View Submissions]                 │
└─────────────────────────────────────────────────────────────┘
```

### 2. Submission Gallery

```
┌─────────────────────────────────────────────────────────────┐
│  SUBMISSIONS (47)                    Sort: [Most Voted ▼]   │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   IMG    │ │   IMG    │ │   IMG    │ │   IMG    │       │
│  │          │ │          │ │          │ │          │       │
│  ├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤       │
│  │ Title    │ │ Title    │ │ Title    │ │ Title    │       │
│  │ @user    │ │ @user    │ │ @user    │ │ @user    │       │
│  │ ❤️ 42    │ │ ❤️ 38    │ │ ❤️ 35    │ │ ❤️ 31    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 3. Leaderboard Component

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 LEADERBOARD                         Live Updates ⚡     │
│  ───────────────────────────────────────────────────────   │
│  1. 🥇 @creativemind        142 votes    +12 today         │
│  2. 🥈 @aiartist            138 votes    +8 today          │
│  3. 🥉 @dreamweaver         125 votes    +15 today         │
│  4.    @pixelmaster         118 votes    +5 today          │
│  5.    @neuralart           112 votes    +7 today          │
│  ───────────────────────────────────────────────────────   │
│  42. You (@username)         23 votes    +3 today          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create Django models (WeeklyChallenge, ChallengeSubmission, ChallengeVote)
- [ ] Set up Redis leaderboard service
- [ ] Create basic API endpoints
- [ ] Admin interface for creating challenges

### Phase 2: Frontend Landing Page (Week 2)
- [ ] Challenge landing page component
- [ ] Submission form/modal
- [ ] Submission gallery with voting
- [ ] Real-time leaderboard component

### Phase 3: Points & Rewards (Week 3)
- [ ] Integrate with existing points system (Thrive Circle)
- [ ] Participation rewards distribution
- [ ] Winner prize distribution (tokens)
- [ ] Voting rewards

### Phase 4: Sponsor Integration (Week 4)
- [ ] ChallengeSponsor model
- [ ] Sponsor branding on challenge pages
- [ ] Sponsor admin dashboard (future)
- [ ] Cash prize integration (Stripe payouts)

### Phase 5: Polish & Launch (Week 5)
- [ ] Email notifications (challenge start, deadline reminders)
- [ ] Social sharing for submissions
- [ ] Past challenges archive
- [ ] Analytics dashboard

---

## File Structure

```
core/challenges/
├── __init__.py
├── models.py           # WeeklyChallenge, ChallengeSubmission, etc.
├── serializers.py      # DRF serializers
├── views.py            # API views
├── urls.py             # URL routing
├── admin.py            # Django admin
├── services.py         # Business logic
├── leaderboard.py      # Redis leaderboard service
└── tasks.py            # Celery tasks (end challenge, distribute rewards)

frontend/src/
├── pages/
│   ├── ChallengePage.tsx           # /challenges/[slug]
│   └── ChallengesListPage.tsx      # /challenges
├── components/
│   └── challenges/
│       ├── ChallengeHero.tsx
│       ├── ChallengeSubmissionForm.tsx
│       ├── ChallengeSubmissionGallery.tsx
│       ├── ChallengeLeaderboard.tsx
│       ├── ChallengeCountdown.tsx
│       └── ChallengePrizeCard.tsx
├── hooks/
│   └── useChallengeLeaderboard.ts  # Real-time leaderboard hook
└── services/
    └── challenges.ts               # API client
```

---

## Questions to Resolve

1. **Voting mechanism**: Simple upvote or should users rank their top 3?
2. **Submission types**: Just images/projects, or also text prompts?
3. **Judge scoring**: AI judge, human judges, or community-only?
4. **Cash prizes**: Direct Stripe payouts or gift cards?
5. **Frequency**: Weekly? Bi-weekly? Continuous with themes?

---

## Success Metrics

- **Participation rate**: % of active users who submit
- **Voting engagement**: Votes cast per user
- **Return rate**: Users who participate in consecutive challenges
- **Sponsor interest**: Number of sponsor inquiries
- **Community growth**: New users from challenge promotion
