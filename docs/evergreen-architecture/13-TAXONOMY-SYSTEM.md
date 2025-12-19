# Taxonomy System Architecture

## Overview

The Taxonomy system provides a unified, extensible classification system for content discovery and user personalization. All taxonomy types share a single `Taxonomy` model with a `taxonomy_type` discriminator field.

## Model Location

- **Model**: `core/taxonomy/models.py`
- **Admin**: `core/taxonomy/admin.py`

## Taxonomy Types (16 Total)

### Content Classification

| Type | Slug Prefix | Purpose | Values |
|------|-------------|---------|--------|
| `tool` | none | AI tools/platforms | ChatGPT, Midjourney, etc. |
| `category` | none | Project categories | Structured, predefined |
| `topic` | none | Free-form topics | AI-generated, dynamic |

### User Profiling

| Type | Slug Prefix | Purpose | Values |
|------|-------------|---------|--------|
| `goal` | none | User goals | Learn New Skills, Start a Business, etc. |
| `industry` | none | Industry verticals | Healthcare, Finance, etc. |
| `interest` | none | User interests | AI & Machine Learning, Design, etc. |
| `skill` | none | Technical skills | Python, React, etc. (hierarchical) |
| `personality` | MBTI code | Personality types | 16 MBTI types (INTJ, ENFP, etc.) |
| `learning_style` | `style-*` | How users learn | Visual, Audio, Hands-On, etc. |
| `role` | `role-*` | Job function (multi-select) | Developer, Marketer, Non-Technical, etc. |

### Content Metadata

| Type | Slug Prefix | Purpose | Values |
|------|-------------|---------|--------|
| `content_type` | `content-*` | Unified content types | Article, Video, Course, etc. |
| `modality` | none | Learning modalities | Video, Microlearning, Games |
| `outcome` | none | Learning outcomes | Build a RAG pipeline, etc. |
| `time_investment` | `time-*` | Time to consume/build | Quick Win, Short, Medium, Deep Dive |
| `difficulty` | `level-*` | Content difficulty | Beginner, Intermediate, Advanced |
| `pricing` | `pricing-*` | Pricing tier | Free, Freemium, Paid |

## Slug Prefixes

Slugs use prefixes to avoid collisions with existing topics:

```
content-article      # Content type
time-quick           # Time investment
level-beginner       # Difficulty
pricing-free         # Pricing
style-visual         # Learning style
role-developer       # Role
intj                 # Personality (MBTI codes are unique)
```

## Detailed Taxonomy Values

### Content Type (`content_type`)

| Name | Slug | Description |
|------|------|-------------|
| Code Repository | `content-code-repo` | GitHub/GitLab projects, source code |
| Article | `content-article` | Articles, blog posts, tutorials |
| Website | `content-website` | Websites, web apps, landing pages |
| Automation | `content-automation` | Automation tools, workflows |
| Chat Prompt | `content-chat-prompt` | Chat prompts, conversations |
| Image | `content-image` | Images, designs, artwork |
| Video | `content-video` | Video content, tutorials |
| Course | `content-course` | Multi-lesson learning content |
| Prompt Pack | `content-prompt-pack` | Prompt collections, libraries |
| Template | `content-template` | Templates, starters, boilerplates |
| E-Book | `content-ebook` | E-books, downloadable documents |
| Quiz | `content-quiz` | Quizzes, assessments |
| Side Quest | `content-side-quest` | Challenges, hands-on exercises |
| Battle | `content-battle` | Prompt battles, competitions |

### Time Investment (`time_investment`)

| Name | Slug | Description |
|------|------|-------------|
| Quick Win | `time-quick` | Less than 15 minutes |
| Short | `time-short` | 15-60 minutes |
| Medium | `time-medium` | 1-4 hours |
| Deep Dive | `time-deep-dive` | A day or more |

### Difficulty (`difficulty`)

| Name | Slug | Description |
|------|------|-------------|
| Beginner | `level-beginner` | No prior experience required |
| Intermediate | `level-intermediate` | Some foundational knowledge |
| Advanced | `level-advanced` | For experienced practitioners |

### Pricing (`pricing`)

| Name | Slug | Description |
|------|------|-------------|
| Free | `pricing-free` | Completely free |
| Freemium | `pricing-freemium` | Free with paid upgrades |
| Paid | `pricing-paid` | Requires purchase |

### Personality (`personality`)

All 16 MBTI personality types:

**Analysts**: INTJ, INTP, ENTJ, ENTP
**Diplomats**: INFJ, INFP, ENFJ, ENFP
**Sentinels**: ISTJ, ISFJ, ESTJ, ESFJ
**Explorers**: ISTP, ISFP, ESTP, ESFP

### Learning Style (`learning_style`)

| Name | Slug | Description |
|------|------|-------------|
| Visual | `style-visual` | Images, diagrams, charts, videos |
| Reading/Writing | `style-reading` | Written content, documentation |
| Hands-On | `style-hands-on` | Projects, exercises, practical application |
| Audio | `style-audio` | Podcasts, verbal explanations |
| Social | `style-social` | Discussion, community, collaboration |

### Role (`role`)

Supports multi-select for users with multiple roles.

**Technical Roles:**
- Developer (`role-developer`)
- Designer (`role-designer`)
- Data Professional (`role-data`)

**Business Roles:**
- Product Manager (`role-product-manager`)
- Founder/Entrepreneur (`role-founder`)
- Marketer (`role-marketer`)

**Creator Roles:**
- Content Creator (`role-creator`)
- No-Code Builder (`role-no-code`)

**Learning Roles:**
- Student (`role-student`)
- Hobbyist (`role-hobbyist`)

**Non-Technical:**
- Non-Technical User (`role-non-technical`)

## Database Schema

```python
class Taxonomy(models.Model):
    class TaxonomyType(models.TextChoices):
        TOOL = 'tool', 'Tool'
        CATEGORY = 'category', 'Category'
        TOPIC = 'topic', 'Topic'
        GOAL = 'goal', 'Goal'
        INDUSTRY = 'industry', 'Industry'
        INTEREST = 'interest', 'Interest'
        SKILL = 'skill', 'Skill'
        MODALITY = 'modality', 'Learning Modality'
        OUTCOME = 'outcome', 'Learning Outcome'
        CONTENT_TYPE = 'content_type', 'Content Type'
        TIME_INVESTMENT = 'time_investment', 'Time Investment'
        DIFFICULTY = 'difficulty', 'Difficulty'
        PRICING = 'pricing', 'Pricing'
        PERSONALITY = 'personality', 'Personality Type'
        LEARNING_STYLE = 'learning_style', 'Learning Style'
        ROLE = 'role', 'Role'

    taxonomy_type = models.CharField(max_length=20, choices=TaxonomyType.choices)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=100)  # NOT unique - same name allowed across types
    slug = models.SlugField(max_length=120, unique=True)  # Unique identifier
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
```

## Usage Examples

### Querying by Type

```python
from core.taxonomy.models import Taxonomy

# Get all content types
content_types = Taxonomy.objects.filter(
    taxonomy_type='content_type',
    is_active=True
)

# Get all roles for a dropdown
roles = Taxonomy.objects.filter(
    taxonomy_type='role',
    is_active=True
).values('name', 'slug')

# Get difficulty levels
difficulties = Taxonomy.objects.filter(
    taxonomy_type='difficulty'
).order_by('slug')  # level-advanced, level-beginner, level-intermediate
```

### Attaching to Models

```python
class Project(models.Model):
    content_type = models.ForeignKey(
        Taxonomy,
        on_delete=models.SET_NULL,
        null=True,
        limit_choices_to={'taxonomy_type': 'content_type', 'is_active': True}
    )
    difficulty = models.ForeignKey(
        Taxonomy,
        on_delete=models.SET_NULL,
        null=True,
        limit_choices_to={'taxonomy_type': 'difficulty', 'is_active': True}
    )
    topics = models.ManyToManyField(
        Taxonomy,
        blank=True,
        limit_choices_to={'taxonomy_type': 'topic', 'is_active': True}
    )
```

### User Profile

```python
class UserProfile(models.Model):
    personality = models.ForeignKey(
        Taxonomy,
        null=True,
        limit_choices_to={'taxonomy_type': 'personality'}
    )
    learning_styles = models.ManyToManyField(
        Taxonomy,
        blank=True,
        limit_choices_to={'taxonomy_type': 'learning_style'}
    )
    roles = models.ManyToManyField(
        Taxonomy,
        blank=True,
        limit_choices_to={'taxonomy_type': 'role'}
    )
```

## Migrations

| Migration | Purpose |
|-----------|---------|
| `0054_alter_taxonomy_type_add_new_types` | Added new taxonomy type choices |
| `0055_seed_new_taxonomy_types` | Initial seeding of content_type, time, difficulty, pricing |
| `0056_cleanup_deprecated_topic_fields` | Cleanup old topic fields |
| `0057_alter_taxonomy_name_remove_unique` | Removed unique constraint from name |
| `0058_update_taxonomy_slugs_and_add_missing` | Added slug prefixes, seeded personality, learning_style, role |

## Design Decisions

### Why Single Table?

- **Simplicity**: One model, one admin, one API
- **Flexibility**: Easy to add new taxonomy types
- **Consistency**: Same structure for all classifications
- **Querying**: Easy to join across types

### Why Slug Prefixes?

- **Collision Prevention**: `style-visual` won't conflict with `visual` topic
- **Namespace Clarity**: Prefix indicates taxonomy type at a glance
- **URL Safety**: Prefixed slugs work well in URLs

### Why Non-Unique Names?

- **Natural Language**: "Audio" can be both a topic and a learning style
- **User-Friendly**: No awkward prefixes in display names
- **Slug is the ID**: Unique slug provides identification

## Future Considerations

1. **Hierarchical Taxonomies**: The `parent` field supports skill hierarchies (e.g., ML -> Neural Networks -> Transformers)

2. **User Tag Generation**: `UserTag` model can auto-generate tags from user interactions

3. **Content Recommendations**: Use taxonomy combinations for personalized content discovery:
   - Role + Learning Style + Difficulty = Personalized content feed
   - Personality + Interest = Suggested learning paths
