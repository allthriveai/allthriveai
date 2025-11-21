# Points System Implementation Strategy

This document describes **how** to implement and evolve a consistent, scalable user participation points system for All Thrive. It complements `POINTS_SYSTEM_PLAN.md` (philosophy & values) by focusing on architecture, categories, and process.

---

## 1. Goals

We want a points system that is:

- **Consistent** – similar actions reward similar points across the app.
- **Scalable** – works when there are 10 point-giving actions or 100+.
- **Maintainable** – values and rules can be tuned without rewriting features.
- **Auditable** – every point change is explainable and traceable.
- **Aligned** – integrates cleanly with Thrive Circles and XP/levels.

Key idea: **build a points platform**, then have features plug into it, instead of hard-coding points inside each feature.

---

## 2. Core Concepts & Architecture

### 2.1. Activity Types

Each point-giving action in the product maps to an internal **Activity Type** enum, e.g.:

- `quiz_completed`
- `battle_participated`
- `battle_won`
- `project_created`
- `project_published`
- `daily_login`
- `week_streak`
- `side_quest_completed`
- `weekly_challenge_completed`
- `scavenger_hunt_completed`
- `feedback_given`
- `referral_converted`

Features only ever talk to the points system using these **activity types**, not raw integers.


### 2.2. Single Service Entry Point

All points changes go through a **single service API**, for example:

```python path=null start=null
PointsService.award_points(
    user=user,
    activity_type=ActivityType.QUIZ_COMPLETED,
    metadata={"quiz_id": quiz.id, "score": attempt.score},
)
```

Responsibilities of `PointsService.award_points`:

1. Look up the **base point value** for the `activity_type`.
2. Apply **caps** and **diminishing returns** where needed.
3. Enforce **idempotency** for the same business event (avoid duplicates).
4. Write a **PointsHistory** row (audit log).
5. Update `user.total_points` and derived fields (`level`, etc.).
6. Forward the awarded points to the **Thrive Circles XP** layer so weekly XP / activity feeds stay in sync.

No other code path is allowed to modify points.


### 2.3. Relationship to Thrive Circles XP

For simplicity and alignment:

- Treat **points as the underlying XP unit**.
- `user.total_points` represents the same fundamental quantity as `UserThriveProfile.total_xp`.
- When `PointsService.award_points` succeeds, it also:
  - Calls `XPService.add_xp(user, amount, source, description)`.
  - Logs an `XPEvent` for Thrive Circles activity feeds.

This ensures:

- You don’t maintain two divergent scoring systems.
- Changes in point values automatically flow into levels and circles.

---

## 3. Activity Categories & Point Ranges

To keep many actions consistent, we classify them into **categories** and assign typical ranges.

### 3.1. Categories

1. **Creation**
   Actions where the user makes or publishes something.
   - Examples: create project, publish project, submit Weekly Challenge entry, participate in Prompt Battle.

2. **Learning**
   Actions where the user explicitly learns or practices.
   - Examples: complete quiz, finish Side Quest, complete Scavenger Hunt, complete tutorial.

3. **Community**
   Actions that help others or grow the community.
   - Examples: leave helpful feedback, share someone’s project, mentor sessions, referrals.

4. **Participation**
   Actions that represent **showing up**, being present, and engaging with the platform even when there’s no large artifact.
   - Examples: daily login, attending an event, joining a Thrive Circle this week, viewing and reacting to Circle activity, opting into a challenge.

5. **Consistency**
   Sustained behavior over time.
   - Examples: weekly login streak, month streak, “5 weeks in a row of activity”, returning to Your Thrive Circle every week.

6. **Challenge / Deep Work**
   High-effort, high-impact accomplishments.
   - Examples: finish a big Weekly Challenge, complete a complex Side Quest chain, multi-step project milestones.


### 3.2. Point Ranges by Category

Use **ranges**, not exact fixed numbers, to keep the system coherent:

- **Micro (1–5 points)**
  - Very low effort, very frequent actions.
  - Typical: tiny Participation or Community signals (reactions, simple opt-ins) with strong caps.

- **Standard (10–30 points)**
  - Normal actions we want often.
  - Typical: Creation (basic project actions), Learning (quizzes), Participation (attending an event).

- **Milestone (50–150+ points)**
  - High-effort or deep work.
  - Typical: Challenge / Deep Work, major Learning milestones, significant Community contributions.

This gives you a **rubric**: when a new action is proposed, you decide its category and then choose a value inside the corresponding range.

---

## 4. Rubric for New Point-Giving Actions

When adding a new point-giving action, product / design / engineering should answer three questions:

1. **Effort:** How hard / time-consuming is this?
   - Low / Medium / High

2. **Impact:** How much does it move All Thrive’s goals?
   - Low / Medium / High

3. **Frequency:** How often *should* users ideally do this?
   - Often / Sometimes / Rarely

Then map it to a category + range:

- **Low effort + low impact + very frequent → Micro (1–5)**
  - Likely Participation or Community micro-action.

- **Medium effort + clear learning / creation value → Standard (10–30)**
  - Likely Learning or Creation.

- **High effort + high learning or community impact → Milestone (50–150+)**
  - Likely Challenge / Deep Work, or a major Learning / Community milestone.

This way, when there are many actions, they still feel
coherent because they all follow the same decision process.

---

## 5. Central Activity Registry

To manage many actions without chaos, maintain a **central registry** of point rules.

### 5.1. What the Registry Stores

For each `ActivityType`:

- `activity_type` – enum key, e.g. `quiz_completed`.
- `category` – one of: `creation`, `learning`, `community`, `participation`, `consistency`, `challenge`.
- `base_points` – default point award.
- `max_per_day` / `max_per_week` – simple caps to prevent farming.
- Optional:
  - `enabled` flag (for rolling out changes)
  - `notes` (for product rationale)

This can start as a Python dict or settings object and later move to a DB model (`PointRule`) if you need runtime editing or A/B testing.


### 5.2. Example Sketch (Python Dict)

```python path=null start=null
POINT_RULES = {
    ActivityType.QUIZ_COMPLETED: {
        "category": "learning",
        "base_points": 20,
        "max_per_day": 10,
    },
    ActivityType.BATTLE_PARTICIPATED: {
        "category": "creation",
        "base_points": 25,
        "max_per_day": 10,
    },
    ActivityType.BATTLE_WON: {
        "category": "challenge",
        "base_points": 20,  # bonus on top of participation
        "max_per_day": 10,
    },
    ActivityType.PROJECT_CREATED: {
        "category": "creation",
        "base_points": 10,
        "max_per_day": 5,
    },
    ActivityType.DAILY_LOGIN: {
        "category": "participation",
        "base_points": 5,
        "max_per_day": 1,
    },
    ActivityType.WEEK_STREAK: {
        "category": "consistency",
        "base_points": 25,
        "max_per_week": 1,
    },
    ActivityType.SIDE_QUEST_COMPLETED: {
        "category": "learning",
        "base_points": 30,
        "max_per_day": 5,
    },
    ActivityType.WEEKLY_CHALLENGE_COMPLETED: {
        "category": "challenge",
        "base_points": 75,
        "max_per_week": 1,
    },
}
```

`PointsService` is the **only consumer** of this registry.

---

## 6. PointsService Responsibilities

At a high level, `PointsService` should:

1. **Validate & look up rule**
   - Ensure `activity_type` is known.
   - Fetch the rule from the central registry.

2. **Compute award**
   - Start from `base_points`.
   - Optionally adjust based on metadata (e.g. quiz score, difficulty) if needed.

3. **Apply caps & anti-abuse**
   - Count how many times this user has been awarded for this `activity_type` today/this week.
   - If over cap, either:
     - Award 0, or
     - Award reduced points (diminishing returns), depending on design.

4. **Idempotency**
   - Accept an optional `event_key` in `metadata` (e.g. `"quiz_attempt:<id>"`).
   - If a `PointsHistory` row already exists for this `event_key`, **do nothing**.

5. **Persist & propagate**
   - Create `PointsHistory` row.
   - Update `user.total_points`, `level`, streaks if relevant.
   - Call `XPService.add_xp` to:
     - Update `UserThriveProfile.weekly_xp` / `total_xp`.
     - Log an `XPEvent` for the circle activity feed.

6. **Return a simple result object**
   - e.g. `{ "points_awarded": 20, "capped": False }` for UI / analytics.

---

## 7. Which Actions Should *Not* Give Points

Not every possible action should be rewarded directly with points. To keep the system meaningful and avoid farming:

- Prefer points for **clear outputs**:
  - Finished quizzes, completed Side Quests, submitted Weekly Challenge entries, created projects, Prompt Battles played.

- Use **Participation** points for "showing up" behaviors:
  - Daily login, attending events, visiting "Your Thrive Circle" page.

- Represent lots of micro-actions via **Consistency** or **Challenge** achievements:
  - Instead of giving points for every tiny click, reward "5 helpful feedbacks this week", "visited Your Thrive Circle 4 weeks in a row", etc.

- Avoid points for:
  - Pure pageviews.
  - Extremely low-effort actions without a clear learning / community / creation impact.

---

## 8. Rollout Strategy

### 8.1. Phase 1 – Platform First

1. Finalize `ActivityType` enum for the main actions you care about.
2. Implement `PointsService.award_points` with:
   - Registry lookup.
   - Caps and idempotency.
   - `PointsHistory` logging.
   - Integration with Thrive XP (`XPService.add_xp`).
3. Decide on initial values and caps for **a small set** of high-impact activities.


### 8.2. Phase 2 – Instrument Core Flows

Start with the most important, existing or soon-to-ship actions:

- Prompt Battles (participation + win bonus).
- Quick Quizzes.
- Project creation / publication.
- Daily login + basic streaks.
- One or two key Community or Participation actions.

For each, wire the domain logic to `PointsService.award_points` and confirm:

- Points are logged consistently in `PointsHistory`.
- Thrive XP / circles reflect the same events.


### 8.3. Phase 3 – Gradual Expansion

As you add or refine features (Side Quests, Weekly Challenges, Scavenger Hunts, new Play modes):

1. Categorize the new action (Creation, Learning, Community, Participation, Consistency, Challenge).
2. Use the rubric (effort, impact, frequency) to pick a point range.
3. Add a rule to the central registry.
4. Call `PointsService.award_points` from the feature’s domain logic.

No need to design the entire final map of all actions up front—just extend the registry as you go, guided by the shared rubric.

---

## 9. User-Facing Category Visualization

We want users to **see where their points are coming from** in terms of categories (Creation, Learning, Community, Participation, Consistency, Challenge).

### 9.1. Backend Aggregation

- Add an endpoint (e.g. `/api/v1/me/points/by-category/`) that returns:
  - Total points by category for a chosen window (e.g. last 7 days, last 30 days, all time).
  - Optionally, a time series per category (e.g. daily or weekly buckets) for trend graphs.
- Implementation sketch:
  - Aggregate from `PointsHistory` joined with the central `POINT_RULES` (or `PointRule` model) to map each `activity_type` to a category.
  - Example response:

```json
{
  "window": "last_30_days",
  "totals": {
    "creation": 420,
    "learning": 310,
    "community": 90,
    "participation": 150,
    "consistency": 80,
    "challenge": 200
  },
  "series": [
    { "date": "2025-03-01", "creation": 40, "learning": 20, ... },
    { "date": "2025-03-02", "creation": 10, "learning": 30, ... }
  ]
}
```

### 9.2. Frontend Visualization

- On the user’s activity / profile area, show a **"How You’re Earning Points"** section.
- Possible visualizations:
  - **Donut / pie chart** for current window: proportion of points by category.
  - **Stacked area or bar chart** over time: how categories contribute week over week.
- UX goals:
  - Make it obvious if someone is mostly Learning vs Creation vs Community, etc.
  - Encourage more balanced engagement (e.g. nudge into Community or Learning if underrepresented).

### 9.3. Keeping It in Sync with the Registry

- The visualization must use the **same category definitions** as the central registry; no separate mapping.
- When adding a new `ActivityType`, ensure:
  - It is assigned a category in the registry.
  - It automatically appears in the user’s category graph via aggregation.

---

## 10. Collaboration Process

To keep the system coherent as the product grows, define a lightweight process:

1. **Design / Product**:
   - Propose new point-giving actions when designing a feature.
   - Classify by category and specify a point range.

2. **Engineering**:
   - Add the action to `ActivityType`.
   - Register its rule in the central registry.
   - Integrate `PointsService.award_points` into the feature.

3. **Review**:
   - Periodically review `POINT_RULES` to detect inflation or inconsistencies.
   - Use analytics: which activities drive most points? Are any being abused?

---

## 10. Summary

- There will be **many** point-giving actions on All Thrive, so we need a **framework**, not one-off decisions.
- The framework consists of:
  - A central `ActivityType` enum and **activity registry**.
  - A single `PointsService.award_points` entry point.
  - Integration with **Thrive Circles XP** via `XPService` and `XPEvent`.
  - A category system (Creation, Learning, Community, Participation, Consistency, Challenge) with clear point ranges.
  - A rubric (effort, impact, frequency) to guide new actions.
- We build the **platform early**, then instrument features as we go, expanding the registry over time.

This keeps the system consistent, scalable, and adaptable as All Thrive adds more ways for users to participate and grow.
