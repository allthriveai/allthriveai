# Agentic Automatic Personalization System

## Overview
Implement intelligent, automatic personalization that detects user preferences from their behavior, projects, and interactions with **minimal user effort**. The system will auto-detect tools, project types, and styles to power a personalized "For You" explore feed.

## Key Research Findings
- ✅ **Infrastructure exists**: UserTag, UserInteraction, Taxonomy models are in place
- ❌ **Processing missing**: No auto-tagging logic, keyword extraction, or background jobs
- ✅ **UI ready**: Frontend displays auto-tags but backend doesn't generate them
- ❌ **"For You" feed**: Parameter exists in explore endpoint but not implemented

## Phase 1: Automatic Preference Detection (MVP)

### 1.1 Auto-Detect Tools from User's Projects
**What**: Analyze user's existing projects to detect which AI tools they use

**How**:
- On project creation/update, extract tool mentions from description/content
- Link to existing Tool/Taxonomy models via project.tools ManyToMany
- Create UserTag with source=AUTO_PROJECT for each detected tool
- Calculate confidence: 1 project = 0.3, 2-4 = 0.5, 5+ = 0.7

**Files to modify**:
- `core/projects/models.py` - Add signal on Project save
- `core/taxonomy/services.py` (NEW) - Tool extraction service using simple keyword matching

### 1.2 Auto-Classify Project Types
**What**: Categorize user's projects beyond the 4 basic types

**How**:
- Add predefined categories: "Web App", "UI Design", "Logo", "Image Generation", "Code", "Writing", "3D", etc.
- Extend Project.content JSON to store: `{"detected_categories": ["Web App", "UI Design"], "category_confidence": 0.8}`
- Create UserTag for frequently created project types
- Use project.type + content analysis for classification

**Files to modify**:
- `core/projects/models.py` - Add PROJECT_CATEGORIES constant
- `core/taxonomy/models.py` - Add predefined taxonomies for project categories
- `core/taxonomy/services.py` - Category classification logic

### 1.3 Auto-Tag Visual Styles (Manual for now, AI later)
**What**: Detect visual styles in user's projects (minimalist, vibrant, technical, etc.)

**How**:
- **Phase 1**: Allow manual style tagging when creating projects
- Add style options: "Minimalist", "Vibrant", "Dark", "Detailed", "Playful", "Professional", etc.
- Store in Project.content: `{"styles": ["Minimalist", "Professional"]}`
- Create UserTag from frequently used styles
- **Phase 2** (future): Use AI vision API to auto-detect from images

**Files to modify**:
- `core/projects/serializers.py` - Add style field to ProjectSerializer
- Frontend: ProjectEditor - Add style selection dropdown

### 1.4 Background Processing Service
**What**: Convert UserInteractions → UserTags automatically

**How**:
- Create Django management command: `python manage.py process_user_interactions`
- Process UserInteractions to extract keywords from metadata
- Generate UserTags with calculated confidence scores
- Run via Celery beat (periodic task every hour) or cron job

**Files to create**:
- `core/taxonomy/management/commands/process_user_interactions.py`
- `core/taxonomy/services.py` - Keyword extraction and tag generation logic

## Phase 2: Confidence Scoring Algorithm

### 2.1 Implement Confidence Calculation
**Formula**:
```python
confidence = base_score + recency_bonus + interaction_bonus

base_score:
- 1 mention: 0.3
- 2-4 mentions: 0.5
- 5+ mentions: 0.7

recency_bonus: +0.1 if activity in last 30 days
interaction_bonus: +0.2 if user actively engaged (liked, commented, created)

max_confidence: 0.95 for auto-generated, 1.0 for manual
```

**Files to modify**:
- `core/taxonomy/services.py` - `calculate_confidence_score(user, tag_name, source)`
- Run recalculation periodically to decay old preferences

## Phase 3: Personalized "For You" Explore Feed

### 3.1 Ranking Algorithm
**What**: Score and rank projects based on user's detected preferences

**How**:
```python
project_score = (
    tool_match_score * 0.40 +      # Tools user works with
    type_match_score * 0.30 +       # Project types user creates
    style_match_score * 0.20 +      # Visual styles user prefers
    diversity_penalty * 0.10        # Prevent echo chamber
)

# Each match score considers confidence:
tool_match = sum(confidence for each matching tool)
```

**Files to modify**:
- `core/projects/views.py` - Enhance `explore_projects()` function
- Add personalization logic when `tab=for-you`
- Query user's UserTags, calculate match scores, order by score

### 3.2 Track Feed Engagement
**What**: Learn from user behavior in explore feed

**How**:
- Track: project views, likes, clicks, dwell time
- Create UserInteraction records with metadata
- Feed back into auto-tagging service
- Boost confidence for engaged-with tags

**Files to modify**:
- Frontend: ExplorePage - Add interaction tracking on card clicks
- Backend: Update UserInteraction on project actions

## Phase 4: Personalization Settings UI

### 4.1 Show Auto-Detected Preferences
**What**: Display what the system has learned with manual override options

**Layout**:
```
Personalization Settings
├── Tools You Use (auto-detected from your projects)
│   └── [React ×] [TailwindCSS ×] [+ Add more]
├── Project Types You Create
│   └── [Web Apps ×] [UI Designs ×] [+ Add more]
├── Visual Styles You Prefer
│   └── [Minimalist ×] [Professional ×] [+ Add more]
└── Your Interests (from taxonomy)
    └── [Machine Learning ×] [Design ×] [+ Add more]
```

**Features**:
- Pills show confidence as opacity/badge
- X button to remove auto-detected tag
- "+ Add more" for manual additions
- "Reset to auto-detected" button
- Explanation: "We learn these from your projects and activity"

**Files to modify**:
- `frontend/src/components/profile/Personalization.tsx` - Redesign layout
- Split into sections: Tools, Types, Styles, Interests
- Show auto vs manual tags differently
- Add confidence indicators

## Database Schema Changes

### Minimal Changes Required
**Good news**: Existing models support everything! Just need to:

1. **Add predefined Taxonomy entries**:
   ```python
   # Project type taxonomies
   Taxonomy(name="Web App", category="TOPIC")
   Taxonomy(name="UI Design", category="TOPIC")
   Taxonomy(name="Logo Design", category="TOPIC")
   Taxonomy(name="Image Generation", category="TOPIC")
   Taxonomy(name="3D Model", category="TOPIC")
   Taxonomy(name="Code Project", category="TOPIC")
   Taxonomy(name="Writing", category="TOPIC")

   # Style taxonomies
   Taxonomy(name="Minimalist", category="INTEREST")
   Taxonomy(name="Vibrant", category="INTEREST")
   Taxonomy(name="Dark Mode", category="INTEREST")
   Taxonomy(name="Playful", category="INTEREST")
   Taxonomy(name="Professional", category="INTEREST")
   Taxonomy(name="Detailed", category="INTEREST")
   ```

2. **Use Project.content JSON** for detected metadata (no new fields needed):
   ```python
   {
     "detected_categories": ["Web App", "UI Design"],
     "category_confidence": 0.8,
     "styles": ["Minimalist", "Professional"],
     "auto_detected_tools": ["React", "TailwindCSS"]
   }
   ```

3. **Leverage existing UserTag.confidence_score** (just need to calculate it)

## Implementation Order

### Week 1: Auto-detect tools from projects
- Create `core/taxonomy/services.py` with tool extraction service
- Add Django signal on Project save to detect tools
- Generate UserTags with source=AUTO_PROJECT
- Test with existing user projects

### Week 2: Project type classification
- Add predefined project type taxonomies via data migration
- Implement classification logic in services.py
- Generate UserTags for frequently created types
- Add project type display in project cards

### Week 3: Background processing
- Create management command `process_user_interactions`
- Implement confidence scoring algorithm
- Set up periodic task (Celery or cron)
- Test with historical interaction data

### Week 4: "For You" feed
- Implement ranking algorithm in `explore_projects()` view
- Add personalization logic for `tab=for-you`
- Track feed engagement (views, clicks, dwell time)
- A/B test personalized vs. generic feed

### Week 5: Personalization UI
- Redesign Personalization.tsx with new sections
- Show auto-detected preferences grouped by type
- Add confidence indicators (opacity, badges)
- Implement manual override options

## Success Metrics

- **Adoption**: % of users with auto-detected preferences > 90%
- **Quality**: Average confidence score > 0.6
- **Engagement**: "For You" feed engagement > generic feed by 30%
- **Speed**: Time to personalized experience < 2 minutes (after creating 1st project)
- **Accuracy**: User manual removal rate < 15%

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Creates Project                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│          Project Save Signal (Django Signal)             │
│  - Extract tools from description/content                │
│  - Classify project type                                 │
│  - Store metadata in Project.content                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│           Auto-Tagging Service (services.py)             │
│  - Link tools to Taxonomy                                │
│  - Calculate confidence scores                           │
│  - Create/update UserTags                                │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│                 UserTag Model (Database)                 │
│  - user, taxonomy, confidence_score                      │
│  - source=AUTO_PROJECT                                   │
│  - interaction_count                                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│        Background Job (Celery/Management Command)        │
│  - Process UserInteractions periodically                 │
│  - Extract keywords from metadata                        │
│  - Update confidence scores                              │
│  - Decay old preferences                                 │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│           Explore "For You" Feed (views.py)              │
│  - Query user's UserTags                                 │
│  - Calculate project match scores                        │
│  - Rank by weighted score (tools 40%, types 30%, etc.)  │
│  - Return personalized project list                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│               User Engages with Feed                     │
│  - Click, view, like, dwell time                         │
│  - Create UserInteraction records                        │
│  - Feedback loop to improve preferences                  │
└─────────────────────────────────────────────────────────┘
```

## Code Examples

### Tool Extraction Service
```python
# core/taxonomy/services.py

from core.taxonomy.models import Taxonomy, UserTag
from core.tools.models import Tool
import re

def extract_tools_from_project(project):
    """Extract AI tools mentioned in project description/content."""
    tools_found = []

    # Get all known tools
    known_tools = Tool.objects.all()

    # Search for tool mentions in description
    text = f"{project.title} {project.description}".lower()

    for tool in known_tools:
        if tool.name.lower() in text:
            tools_found.append(tool)

    return tools_found

def create_or_update_user_tags(user, tools):
    """Create or update UserTags based on detected tools."""
    for tool in tools:
        # Get or create taxonomy for this tool
        taxonomy = tool.taxonomy
        if not taxonomy:
            continue

        # Get or create UserTag
        user_tag, created = UserTag.objects.get_or_create(
            user=user,
            taxonomy=taxonomy,
            defaults={
                'name': tool.name,
                'source': UserTag.Source.AUTO_PROJECT,
                'confidence_score': 0.3,
                'interaction_count': 1
            }
        )

        if not created:
            # Update existing tag
            user_tag.interaction_count += 1
            user_tag.confidence_score = calculate_confidence_score(
                user, taxonomy.name, UserTag.Source.AUTO_PROJECT
            )
            user_tag.save()
```

### Django Signal
```python
# core/projects/models.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from core.taxonomy.services import extract_tools_from_project, create_or_update_user_tags

@receiver(post_save, sender=Project)
def auto_tag_project(sender, instance, created, **kwargs):
    """Automatically tag user preferences when project is saved."""
    if instance.user:
        # Extract tools from project
        tools = extract_tools_from_project(instance)

        # Create or update UserTags
        create_or_update_user_tags(instance.user, tools)

        # Link tools to project
        instance.tools.add(*tools)
```

### Personalized Feed Ranking
```python
# core/projects/views.py

def get_personalized_feed(user, queryset):
    """Rank projects based on user's preferences."""
    from core.taxonomy.models import UserTag

    # Get user's preferences
    user_tags = UserTag.objects.filter(user=user).select_related('taxonomy')

    # Group by type
    tool_preferences = user_tags.filter(taxonomy__category='TOOL')
    type_preferences = user_tags.filter(taxonomy__category='TOPIC')
    style_preferences = user_tags.filter(taxonomy__category='INTEREST')

    # Score each project
    scored_projects = []
    for project in queryset:
        score = 0

        # Tool match (40%)
        project_tools = project.tools.all()
        for pref in tool_preferences:
            if pref.taxonomy.tool in project_tools:
                score += pref.confidence_score * 0.40

        # Type match (30%)
        project_types = project.content.get('detected_categories', [])
        for pref in type_preferences:
            if pref.name in project_types:
                score += pref.confidence_score * 0.30

        # Style match (20%)
        project_styles = project.content.get('styles', [])
        for pref in style_preferences:
            if pref.name in project_styles:
                score += pref.confidence_score * 0.20

        # Diversity bonus (10%) - newer projects
        days_old = (timezone.now() - project.created_at).days
        if days_old < 7:
            score += 0.10

        scored_projects.append((project, score))

    # Sort by score descending
    scored_projects.sort(key=lambda x: x[1], reverse=True)

    return [p[0] for p in scored_projects]
```

## Future Enhancements (Phase 2+)

1. **Weaviate Semantic Search Integration**
   - Convert user preferences to embedding vectors
   - Semantic similarity matching beyond keyword matching
   - "More like this" recommendations

2. **AI Vision for Style Detection**
   - Use GPT-4 Vision or Claude Vision to analyze project images
   - Auto-detect: color palette, design style, complexity level
   - Generate style tags automatically

3. **Collaborative Filtering**
   - "Users like you also enjoyed..."
   - Cross-user preference patterns
   - Social graph recommendations

4. **Advanced Feedback Loop**
   - Explicit feedback: thumbs up/down, "not interested"
   - Implicit feedback: scroll speed, dwell time, completion rate
   - A/B testing different ranking algorithms

5. **Multi-Modal Personalization**
   - Combine project preferences with quiz results
   - Factor in user's stated goals and skills
   - Time-of-day and context-aware recommendations
