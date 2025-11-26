# Points & Gamification System Plan

## Philosophy
**Reward participation and engagement, with bonuses for excellence.**

Our point system should encourage users to:
- Create and share their work
- Learn and experiment
- Engage with the community
- Build consistently over time
- Help others grow
- Try new things without fear of "losing"

We want to avoid:
- Winner-take-all mentalities
- Toxic competition where only #1 matters
- Point farming/gaming the system
- Discouragement for beginners

## Point Values

### Core Activities (Participation-Focused)

#### Project Creation & Sharing
- **Create a project**: 10 points
- **Publish a project**: 15 points (encourages sharing)
- **Add description to project**: 5 points (quality over quantity)
- **Add tags to project**: 3 points
- **Add thumbnail to project**: 5 points
- **First project milestone**: 50 points (celebration!)

#### Learning & Growth
- **Complete a quiz**: 20 points (learning focus)
- **Quiz streak (3 in a row)**: 10 bonus points
- **Watch a tutorial/resource**: 5 points
- **Complete a challenge**: 25 points

#### Engagement & Community
- **Daily login**: 5 points (consistency)
- **Week streak**: 25 bonus points
- **Month streak**: 100 bonus points
- **Leave helpful feedback**: 10 points
- **React/like content**: 1 point (max 10/day to prevent spam)
- **Share someone's project**: 15 points (amplifying others)
- **Refer a friend who joins**: 50 points (growing community)

#### Prompt Battles (Everyone Gets Points)
- **Participate in a battle**: 25 points (both players get this)
- **Complete all battle rounds**: 10 bonus points (both players)
- **Win a battle**: +20 bonus points (total: 55 points for winner)
- **Lose a battle**: No penalty (still got 35 points for participating!)
- **Opponent rates your prompts highly**: 10 bonus points (quality matters)
- **Complete post-battle reflection**: 5 points (optional learning)

*Example: Both players participate and complete all rounds. Winner gets 55 points, other player gets 35 points. Both players feel rewarded!*

#### Profile & Presence
- **Complete profile (bio, tagline, etc.)**: 25 points
- **Add social links**: 5 points per link (max 25)
- **Update current status**: 2 points (max once per week)
- **Add location**: 5 points

### Achievement Bonuses
- **Common achievement**: 10-25 points
- **Rare achievement**: 50-100 points
- **Epic achievement**: 150-250 points
- **Legendary achievement**: 500+ points

### Diminishing Returns (Prevent Farming)
Some activities have daily/weekly caps:
- Likes/reactions: Max 10 points per day
- Profile updates: Max once per week for points
- Login bonuses: Daily (can't spam logins)

## Level System

Levels are based on total points earned. The curve should be gentle to keep users motivated.

### Level Thresholds
```
Level 1: 0 points (Starting point)
Level 2: 100 points
Level 3: 250 points
Level 4: 500 points
Level 5: 1,000 points
Level 6: 1,750 points
Level 7: 2,750 points
Level 8: 4,000 points
Level 9: 5,500 points
Level 10: 7,500 points
Level 11: 10,000 points
Level 12: 13,000 points
Level 13: 16,500 points
Level 14: 20,500 points
Level 15: 25,000 points
Level 16: 30,000 points
Level 17: 36,000 points
Level 18: 43,000 points
Level 19: 51,000 points
Level 20: 60,000 points
Level 20+: +10,000 per level
```

Formula: `threshold = level^2 * 50` (with adjustments for smoothness)

### Level Perks
Levels unlock features, not just bragging rights:

- **Level 2**: Unlock custom profile themes
- **Level 3**: Can participate in prompt battles
- **Level 5**: Unlock private projects feature
- **Level 7**: Early access to new features
- **Level 10**: "Expert" badge on profile
- **Level 15**: Can create custom challenges
- **Level 20**: "Mentor" status - can guide others

## Streak System

### Daily Login Streaks
- Tracks consecutive days logged in
- Grace period: 1 day (life happens!)
- Breaks after 2 days of inactivity
- Longest streak stored separately for achievements

### Streak Bonuses
- **7 days**: 25 points + "Week Warrior" badge
- **30 days**: 100 points + "Monthly Master" badge
- **100 days**: 500 points + "Centurion" badge
- **365 days**: 2000 points + "Year Legend" badge

### Other Streak Types
- **Project creation streak**: Created project X days in a row
- **Learning streak**: Completed quiz/tutorial X days in a row
- **Battle streak**: Participated in battles X weeks in a row

## Stats Display (The Pills)

### Profile Stats Pills
Real-time data displayed on profile:

1. **[X] Projects**
   - Count: Total projects created (published + unpublished)
   - Source: `Project.objects.filter(user=user).count()`

2. **[X] Points**
   - Count: Total points earned
   - Source: `user.total_points`

3. **Level [X]**
   - Calculated from total points
   - Shows progress to next level

4. **[X] 🔥 Day Streak**
   - Current login streak
   - Source: `user.current_streak`

### Additional Stats (Achievements Tab)
- Total achievements earned
- Achievement completion percentage
- Rarest achievement owned
- Points from achievements
- Community rank (percentile, not absolute rank to reduce competition)

## Points Awarding Logic

### Implementation Strategy

#### 1. Service Layer (`services/points/`)
```python
class PointsService:
    @staticmethod
    def award_points(user, activity_type, metadata=None):
        """Award points for an activity"""

    @staticmethod
    def calculate_level(points):
        """Calculate level from points"""

    @staticmethod
    def get_next_level_threshold(current_level):
        """Get points needed for next level"""
```

#### 2. Signals Integration
Points awarded automatically via Django signals:
```python
@receiver(post_save, sender=Project)
def award_project_points(sender, instance, created, **kwargs):
    if created:
        PointsService.award_points(instance.user, 'project_created')
```

#### 3. Database Model
Add to User model:
- `total_points` (Integer)
- `level` (Integer, calculated)
- `current_streak` (Integer)
- `max_streak` (Integer)
- `last_login_date` (Date)

Add PointsHistory model for audit:
- `user` (FK)
- `activity_type` (Char)
- `points_awarded` (Integer)
- `description` (Text)
- `metadata` (JSON)
- `created_at` (DateTime)

## Anti-Gaming Measures

### Rate Limiting
- Daily caps on repetitive activities
- Cooldowns on certain actions (e.g., profile updates)
- Diminishing returns for bulk actions

### Validation
- Only award points for meaningful content (e.g., projects with descriptions)
- Detect and penalize spam behavior
- Human review for suspicious point spikes

### Transparency
- Users can see point history in their profile
- Clear explanations for why points were awarded
- Appeal process for disputed point deductions

## Point Decay (Optional - Not Recommended Initially)
Points don't decay, but inactive users might:
- Streaks reset after inactivity
- Levels remain but could add "Active in [month]" badges
- Focus on forward progress, not punishment

## Leaderboards (Carefully Implemented)

If we add leaderboards, they should:
- Show percentile ("Top 10%") not absolute rank
- Be category-specific (projects, battles, learning)
- Highlight participation metrics over points
- Feature weekly/monthly boards (resets = fresh starts)
- Allow opt-out

## Social Aspects

### Point Sharing
- Celebrate others' achievements
- Share when friends level up
- Team challenges where points are collaborative

### Mentorship Bonus
- Mentors earn points when mentees achieve milestones
- Encourages helping others succeed

## Future Considerations

### Point Redemption (Phase 2)
Points could unlock:
- Custom profile themes
- Avatar accessories
- Special badges
- Feature flags
- Donation to charity in their name

### Seasonal Events
- Double points weekends
- Special event challenges
- Limited-time achievements

## Success Metrics

Track:
- Average points per user per week
- Distribution of points (ensure not too concentrated)
- Correlation between points and retention
- User feedback on fairness
- Point inflation over time

## Example User Journeys

### New User (First Week)
1. Signs up: 0 points
2. Completes profile: +25 points (Level 1)
3. Creates first project: +10 points
4. Publishes it: +15 points
5. First project achievement: +50 points → **Total: 100 points (Level 2!)**
6. Logs in next 7 days: +35 points (5/day)
7. Week streak: +25 points → **Total: 160 points (Level 2, progressing to 3)**

### Active User (Regular Activity)
- Daily login: +5 points/day = 35/week
- Creates 2 projects/week: +50 points
- Participates in 1 battle: +30-50 points
- Completes 1 quiz: +20 points
- **Weekly estimate: ~135-155 points**
- **Monthly: ~540-620 points** (reaches Level 4-5 in first month)

### Battle Participant (Everyone Wins Points)
- **Participates and loses**: 25 (participate) + 10 (complete rounds) = 35 points
- **Participates and wins**: 25 (participate) + 10 (complete rounds) + 20 (win bonus) = 55 points
- **With reflection**: +5 points for either outcome
- **Difference: 20 point bonus for winning** (meaningful but not overwhelming)
- **Message**: "Everyone who plays earns points. Winners earn more!"

## Implementation Priority

1. ✅ User model updates (points, level, streak fields)
2. ✅ PointsService core logic
3. ✅ Level calculation system
4. ✅ Basic point awarding (projects, login)
5. ✅ Stats display on profile (pills)
6. ⏭️ Streak tracking system
7. ⏭️ Points history logging
8. ⏭️ Anti-gaming measures
9. ⏭️ Achievement point integration
10. ⏭️ Battle participation points

## Open Questions

1. Should we show exact points or just level + progress bar?
2. How do we handle point adjustments/corrections?
3. Should there be a max level or infinite progression?
4. Do we want team/collaborative points?
5. How do we communicate point philosophy to users?

## Conclusion

This points system prioritizes:
✅ Participation over winning
✅ Consistency over bursts
✅ Community over competition
✅ Learning over achievement
✅ Quality over quantity (through caps and diminishing returns)

The goal is to make every user feel valued for their engagement, not just the "best" or "winning" users.
