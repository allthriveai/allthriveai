# Achievements System - Flame Theme & Participation Focus

## Philosophy

**Flame & Fire Theme**: Your inner creative fire that grows with every action
**Participation Over Competition**: Celebrate showing up, trying, and growing
**Self-Competition**: Compare yourself to yesterday, not others
**Community Warmth**: Support and encourage fellow creators

---

## Achievement Categories (Flame-Themed)

### 🔥 Creator (Projects)
*Building and creating*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| 🔥 | **First Spark** | Create 1 project | 10 | "Started something new" | orange-500/orange-600 |
| 🔥 | **Getting Started** | Create 5 projects | 25 | "Building momentum" | orange-600/red-500 |
| 🔥 | **On Fire** | Create 10 projects | 50 | "Creating consistently" | red-500/red-600 |
| 🔥 | **Prolific** | Create 25 projects | 100 | "A serious creator" | red-600/orange-500 |
| 🔥 | **Unstoppable** | Create 50 projects | 250 | "Can't stop creating" | red-700/orange-600 |
| 🌟 | **Phoenix** | Create 100 projects | 500 | "Master creator" (SECRET) | rainbow gradient |

**Tracking**: `lifetime_projects_created`

---

### 🎯 Challenger (Prompt Battles)
*Trying new things and improving*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| 🎯 | **First Attempt** | Participate in 1 battle | 10 | "Gave it a shot" | blue-500/blue-600 |
| 🎯 | **Explorer** | Participate in 5 battles | 25 | "Trying different approaches" | purple-500/purple-600 |
| 🎯 | **Regular** | Participate in 10 battles | 50 | "Making it a habit" | purple-600/pink-500 |
| 🏆 | **Personal Best** | Improve your own score | 75 | "Beat your old record" | gold-500/orange-500 |
| 🌈 | **Dedicated** | Participate in 20 battles | 100 | "Showing up consistently" | rainbow gradient |
| 🎨 | **Versatile** | Try 3 different battle types | 60 | "Exploring different styles" | pink-500/purple-600 |

**Tracking**: `lifetime_battles_participated` (NOT wins!)
**Special**: Track personal improvement (`battles_personal_best_count`)

---

### 💬 Contributor (Engagement)
*Participating in the community*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| 💬 | **First Comment** | Post 1 comment | 5 | "Joined the conversation" | gray-500/gray-600 |
| 🤝 | **Helpful** | 5 helpful comments | 15 | "Giving useful feedback" | green-500/green-600 |
| ❤️ | **Active Member** | Comment on 15 different projects | 35 | "Engaging regularly" | green-600/emerald-500 |
| 🌟 | **Supporter** | 50 helpful comments | 75 | "Consistently helpful" | emerald-500/teal-500 |
| 💝 | **Mentor** | 100+ helpful interactions | 150 | "Helping others grow" | pink-500/rose-500 |
| 🤗 | **Welcoming** | Comment on 5 new users' projects | 40 | "Making others feel welcome" | blue-400/green-400 |

**Tracking**: `lifetime_comments_posted`, `unique_projects_commented`, `helpful_votes_received`

---

### 🔥 Streak (Daily Activity)
*Showing up regularly*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| 🕯️ | **3 Day Streak** | 3 day streak | 15 | "Getting started" | orange-400/orange-500 |
| 🔥 | **Week Streak** | 7 day streak | 30 | "One week strong" | orange-500/red-500 |
| 🔥🔥 | **Two Week Streak** | 14 day streak | 50 | "Building a habit" | red-500/red-600 |
| 🔥🔥🔥 | **Month Streak** | 30 day streak | 100 | "30 days committed" | red-600/orange-600 |
| 🌟🔥 | **100 Day Streak** | 100 day streak | 300 | "Seriously dedicated" | orange-600/yellow-500 |
| 🏔️🔥 | **Year Streak** | 365 day streak | 1000 | "Unstoppable" (SECRET) | rainbow gradient |

**Tracking**: `current_streak_days`
**Special**: Award bonus for beating personal longest streak

---

### 💡 Learner (Quizzes)
*Taking quizzes and exploring topics*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| 💡 | **First Quiz** | Complete 1 quiz | 5 | "Tried a quiz" | blue-400/blue-500 |
| 📚 | **Quiz Taker** | Complete 5 quizzes | 25 | "Testing your knowledge" | blue-500/indigo-500 |
| 🧠 | **Quiz Fan** | Complete 15 quizzes | 50 | "Really into quizzes" | indigo-500/purple-500 |
| ⭐ | **Perfect Score** | Get 100% on any quiz | 50 | "Aced it" | gold-500/yellow-500 |
| 🎓 | **Quiz Master** | Complete 50 quizzes | 150 | "Serious quiz taker" | purple-600/pink-500 |
| 🔍 | **Topic Explorer** | Try quizzes in 5 different topics | 40 | "Exploring different areas" | teal-500/blue-500 |

**Tracking**: `lifetime_quizzes_completed`, `topics_explored`

---

### ✨ Tier Progress
*Leveling up through the tiers*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| ⚡ | **Ember** | Start at Ember tier | 5 | "Just getting started" | gray-500/orange-400 |
| ✨ | **Spark** | Reach Spark tier (500 XP) | 25 | "Making progress" | orange-400/yellow-500 |
| 🔥 | **Blaze** | Reach Blaze tier (2000 XP) | 100 | "Really going now" | red-500/orange-500 |
| 💫 | **Beacon** | Reach Beacon tier (5000 XP) | 250 | "Serious dedication" | blue-500/purple-500 |
| 🐦 | **Phoenix** | Reach Phoenix tier (10000 XP) | 500 | "Top tier achieved" | rainbow gradient |

**Tracking**: `tier`

---

### 🎯 Milestones
*Personal progress markers*

| Badge | Name | Requirement | Points | Description | Colors |
|-------|------|------------|--------|-------------|--------|
| 📈 | **100 XP** | Earn 100 total XP | 10 | "First 100 points" | blue-500/blue-600 |
| 🎯 | **Goal Achiever** | Complete first weekly goal | 20 | "Completed a goal" | purple-500/purple-600 |
| 🌱 | **Hot Week** | Gain 500 XP in one week | 50 | "Big week" | green-500/emerald-500 |
| 💪 | **Leveled Up** | Level up 5 times | 75 | "Gaining levels" | orange-500/red-500 |
| 🏆 | **Streak Breaker** | Beat your longest streak | 100 | "Beat your record" | gold-500/orange-500 |
| 📊 | **Consistent** | Active 30 days in a month | 80 | "Showed up all month" | blue-600/purple-600 |
| 🌟 | **Well-Rounded** | Earn achievements in all categories | 150 | "Tried everything" | rainbow gradient |

**Tracking**: `total_points`, `level`, `longest_streak_days`, various counters

---

## Key Messaging Changes

### ❌ Avoid These Words/Concepts:
- "Battle Champion" / "Battle Winner" / "Battle Master"
- "Defeat" / "Beat others" / "Top player"
- Leaderboards focused on competition
- "God Mode" / "Titan" (too competitive/hierarchical)

### ✅ Use These Instead:
- "Practice" / "Experiment" / "Explore"
- "Personal best" / "Self-improvement" / "Progress"
- "Community warmth" / "Support" / "Encouragement"
- "Flame" / "Fire" / "Spark" / "Glow" / "Warmth"
- "Journey" / "Path" / "Growth" / "Transformation"

---

## Achievement Descriptions - Voice & Tone

All achievement descriptions should emphasize:

1. **Personal growth** - "Your flame grows stronger"
2. **Participation** - "Every expert starts somewhere"
3. **Consistency** - "Showing up matters"
4. **Community** - "Spreading warmth"
5. **Self-reflection** - "Competing with yesterday's self"

### Examples:

**Good**:
- "Ignite your creative spark" (inviting, personal)
- "Learning through play" (process over outcome)
- "A beacon of support" (helping others)

**Avoid**:
- "Crush the competition" (competitive)
- "Dominate the leaderboard" (hierarchical)
- "Prove you're the best" (comparative)

---

## Implementation Details

### Database Fields to Add

```python
# core/users/models.py
class User(AbstractUser):
    # ... existing fields ...

    # Participation tracking (not wins!)
    lifetime_battles_participated = models.IntegerField(
        default=0,
        help_text='Total prompt battles participated in'
    )

    # Self-competition tracking
    battles_personal_best_count = models.IntegerField(
        default=0,
        help_text='Number of times user improved their own score'
    )

    # Community engagement
    unique_projects_commented = models.IntegerField(
        default=0,
        help_text='Number of unique projects commented on'
    )

    helpful_votes_received = models.IntegerField(
        default=0,
        help_text='Number of helpful votes on comments'
    )

    # Learning exploration
    topics_explored = models.IntegerField(
        default=0,
        help_text='Number of different quiz topics tried'
    )

    # Personal records
    longest_streak_record = models.IntegerField(
        default=0,
        help_text='Personal longest streak record (for tracking improvement)'
    )
```

### Tracking Personal Best in Battles

```python
# core/battles/models.py or views.py

def track_battle_participation(user, battle_score):
    """Track participation and personal improvement, not wins."""

    # Always increment participation
    user.lifetime_battles_participated += 1

    # Check if they improved their personal best
    try:
        previous_best = BattleScore.objects.filter(
            user=user
        ).aggregate(Max('score'))['score__max']

        if previous_best is None or battle_score > previous_best:
            user.battles_personal_best_count += 1

            # Track achievement: Personal Best
            AchievementTracker.track_event(
                user,
                'battles_personal_best_count',
                user.battles_personal_best_count
            )
    except Exception as e:
        logger.warning(f"Could not track personal best: {e}")

    user.save()

    # Track participation achievement
    AchievementTracker.track_event(
        user,
        'lifetime_battles_participated',
        user.lifetime_battles_participated
    )
```

### Frontend Badge Display

Update the achievement card descriptions to emphasize the flame theme:

```typescript
// frontend/src/components/achievements/AchievementCard.tsx

// Add flame animation for earned achievements
{achievement.is_earned && achievement.category === 'streaks' && (
  <div className="absolute -top-1 -right-1">
    <span className="animate-pulse text-2xl">🔥</span>
  </div>
)}

// Show motivational messages
{!achievement.is_earned && achievement.progress_percentage > 50 && (
  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
    Keep going! Your flame grows stronger! 🔥
  </p>
)}
```

---

## Visual Design - Flame Theme

### Color Palette

**Warm Fire Colors** (primary palette):
- 🔥 **Ember**: orange-400, orange-500
- 🔥 **Flame**: orange-600, red-500
- 🔥 **Blaze**: red-600, red-700
- ✨ **Spark**: yellow-400, orange-400
- 🌟 **Glow**: gold-500, yellow-500

**Cool Support Colors** (secondary):
- 💙 **Calm**: blue-400, blue-500 (learning)
- 💚 **Growth**: green-500, emerald-500 (community)
- 💜 **Wonder**: purple-500, purple-600 (exploration)

**Special Gradients**:
- 🌈 **Rainbow**: For legendary achievements (Phoenix Rising, etc.)
- 🌅 **Sunset**: orange-500 → pink-500 → purple-600

### Icon Guidelines

Use warm, inviting icons:
- 🔥 Flames (various sizes for streaks)
- ✨ Sparkles (for milestones)
- 💡 Light bulbs (for learning)
- ❤️ Hearts (for community)
- 🌱 Growth symbols (for progress)
- 🎯 Targets (for practice, not competition)

Avoid aggressive icons:
- ❌ Swords, weapons
- ❌ Crowns, thrones
- ❌ Lightning bolts (too aggressive)
- ❌ Shields, armor

---

## Achievement Notifications

When a user earns an achievement, show warm, encouraging messages:

```typescript
// Toast notification examples
{
  title: "Spark Ignited! 🔥",
  message: "You created your first project! Your creative journey begins.",
  color: "orange"
}

{
  title: "Steady Burn! 🔥",
  message: "7 days of showing up! Consistency is building your fire.",
  color: "red"
}

{
  title: "Personal Best! 🏆",
  message: "You improved your own score! Competing with yesterday's self.",
  color: "gold"
}
```

---

## Leaderboard Alternative: "Community Flames"

Instead of competitive leaderboards, show:

### "Recent Sparks" Feed
- Recent achievements earned by community members
- Celebrate everyone's progress
- "X just lit their Candle! 🕯️"
- "Y achieved Personal Best! 🏆"

### "Circle of Fire"
- Show users in your same tier (Thrive Circle)
- "Fellow Blazes" - people at Blaze tier
- Encourage mutual support, not competition
- "Your Blaze Circle has earned 1,234 achievements this week!"

### "Warmth Meter"
- Community-wide participation stats
- "Our community created 150 projects this week! 🔥"
- "342 encouraging comments shared! ❤️"
- Collective achievements, not individual rankings

---

## Complete Achievement List (40 Achievements)

### Summary by Category:
- **Creator** (Projects): 6 achievements
- **Challenger** (Battles): 6 achievements
- **Contributor** (Engagement): 6 achievements
- **Streak** (Daily Activity): 6 achievements
- **Learner** (Quizzes): 6 achievements
- **Tier Progress**: 5 achievements
- **Milestones** (Personal Progress): 7 achievements

**Total**: 42 achievements, ~6,000 points available

---

## Next Steps

1. **Update seed command** with flame-themed achievements
2. **Add tracking fields** to User model
3. **Implement personal best tracking** in battle completion
4. **Update frontend** with warm, encouraging language
5. **Remove competitive language** from existing UI
6. **Test with users** to ensure messaging resonates

---

## Success Metrics (Revised)

Track these instead of competitive metrics:

✅ **Participation Rate**
- % of users earning at least one achievement
- % of users with 7+ day streak
- % of users who try prompt battles

✅ **Consistency**
- Average streak length
- Return rate after achieving milestones
- Weekly active users

✅ **Community Warmth**
- Comments per project (engagement)
- Helpful votes given
- New user welcome rate

✅ **Personal Growth**
- Users beating their own records
- Users exploring new features
- Level-up frequency

❌ **NOT Tracking**:
- Win/loss ratios
- Competitive rankings
- "Top 10" lists
- Battle victories vs others
