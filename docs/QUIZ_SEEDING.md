# Quiz Seeding

This document explains how to seed initial quiz data into the AllThrive AI database.

## Overview

The quiz seeding system automatically populates the database with predefined quizzes and questions. This is useful when:
- Setting up a new development environment
- Resetting the database
- Ensuring consistent test data across environments

## Features

- **Idempotent**: Safe to run multiple times - it creates or updates data as needed
- **Automatic User Management**: Creates a `system` user if needed to own the quizzes
- **Taxonomies Integration**: Automatically tags quizzes with categories and topic tags
- **Thumbnails Included**: All quizzes come with Unsplash thumbnail images
- **Two Initial Quizzes**:
  1. **AI Agent Frameworks Showdown** - 5 questions about LangChain, LangGraph, CrewAI, and AutoGen
  2. **Prompt Engineering Essentials** - 6 questions covering prompt engineering techniques

> **Important**: Run `make seed-categories` and `make seed-tools` (or `make seed-all`) before seeding quizzes to ensure categories and tools are available for tagging.

## Usage

### Quickstart: Seed Quizzes Only

```bash
make seed-quizzes
```

### Seed All Initial Data (Recommended)

```bash
make seed-all
```

This seeds:
- Topics
- Taxonomies  
- Categories
- AI Tools
- Quizzes (2 quizzes with 11 total questions)

### Complete Database Reset with Seeding

```bash
make reset-db
```

**Warning**: This will DELETE all data, run migrations, then seed everything.
You'll be prompted to confirm before proceeding.

### Manual Django Command

When Docker containers are running:

```bash
docker compose exec web python manage.py seed_quizzes
```

This will:
1. Create or get the `system` user
2. Create/update the two initial quizzes
3. Create/update all associated questions
4. Display a summary of what was created or updated

## Expected Output

```
✓ Created system user for quiz ownership
✓ Created quiz: AI Agent Frameworks Showdown
✓ Created quiz: Prompt Engineering Essentials

✓ Quizzes seeded! Quizzes - Created: 2, Updated: 0 | Questions - Created: 11, Updated: 0
```

If run again:

```
↻ Updated quiz: AI Agent Frameworks Showdown
↻ Updated quiz: Prompt Engineering Essentials

✓ Quizzes seeded! Quizzes - Created: 0, Updated: 2 | Questions - Created: 0, Updated: 11
```

## Automatic Seeding on Database Reset

To automatically run this command when the database is reset, you can:

1. **Add to docker-compose startup script** - Run after migrations
2. **Add to Makefile reset command** - Include in `make reset-db` or similar
3. **Run manually** - Execute `make seed-quizzes` after database operations

### Example Integration

Add to your database reset workflow in `Makefile`:

```makefile
reset-db:
    docker compose exec backend python manage.py flush --no-input
    docker compose exec backend python manage.py migrate
    docker compose exec backend python manage.py seed_quizzes
    docker compose exec backend python manage.py seed_topics
    docker compose exec backend python manage.py seed_taxonomies
    @echo "✓ Database reset complete with initial data"
```

## Quiz Data Structure

Each quiz includes:
- **Title**: Quiz name
- **Slug**: URL-friendly identifier (used for get_or_create)
- **Description**: Short quiz description
- **Topic**: Category/subject area (legacy field, kept for backward compatibility)
- **Topics**: Array of topic tags (e.g., ['AI Frameworks', 'LangChain', 'AutoGen'])
- **Tools**: ManyToMany relationship to AI tools covered in the quiz (e.g., ChatGPT, Claude)
- **Categories**: ManyToMany relationship to Taxonomy categories (e.g., 'AI Agents & Multi-Tool Systems')
- **Difficulty**: `beginner`, `intermediate`, or `advanced`
- **Estimated Time**: Minutes to complete
- **Thumbnail URL**: Quiz cover image
- **Published Status**: Whether quiz is visible to users
- **Questions**: List of quiz questions with:
  - Question text
  - Type: `true_false` or `multiple_choice`
  - Correct answer(s)
  - Options (for multiple choice)
  - Explanation
  - Hint
  - Order
  - Optional image URL

## Adding New Quizzes

To add new quizzes to the seed data:

1. Edit `/Users/allierays/Sites/allthriveai/core/management/commands/seed_quizzes.py`
2. Add your quiz data to the `quizzes_data` list following the existing structure
3. Run the command to seed the new data

Example structure:

```python
{
    'title': 'Your Quiz Title',
    'slug': 'your-quiz-title',
    'description': 'Quiz description',
    'topic': 'Your Topic',  # Legacy field
    'difficulty': 'beginner',
    'estimated_time': 5,
    'thumbnail_url': 'https://images.unsplash.com/...',
    'is_published': True,
    'category_names': ['AI Agents & Multi-Tool Systems', 'Developer & Coding'],
    'topic_tags': ['AI Frameworks', 'LangChain', 'LLM', 'Multi-Agent Systems'],
    'tool_names': ['ChatGPT', 'Claude'],  # AI tools covered in this quiz
    'questions': [
        {
            'question': 'Your question text',
            'type': 'true_false',  # or 'multiple_choice'
            'correct_answer': 'true',  # or the correct option text
            'options': None,  # or ['Option 1', 'Option 2', 'Option 3', 'Option 4']
            'explanation': 'Why this answer is correct',
            'hint': 'A helpful hint',
            'order': 1,
            'image_url': 'https://images.unsplash.com/...',
        },
        # More questions...
    ],
}
```

**Note**: Category names must match existing categories from `seed_categories`. Available categories:
- Chatbots & Conversation
- Websites & Apps
- Images, Design & Branding
- Video & Multimodal Media
- Podcasts & Education
- Games & Interactive
- Workflows & Automation
- Productivity
- Developer & Coding
- Prompt Collections & Templates
- Thought Experiments
- Wellness & Personal Growth
- AI Agents & Multi-Tool Systems
- AI Models & Research
- Data & Analytics

**Note**: Tool names must match existing tools from `seed_tools`. Available tools:
- ChatGPT
- Claude
- Midjourney
- GitHub Copilot
- Cursor
- Notion AI

## Related Commands

- `make seed-topics` - Seed topic taxonomies
- `make seed-taxonomies` - Seed taxonomy data
- `make seed-tools` - Seed AI tools data
- `make create-pip` - Create Pip AI agent user

## Troubleshooting

**Error: No system user found**
- The command automatically creates the system user, but if there are issues, you can manually create one with `python manage.py createsuperuser --username system`

**Error: IntegrityError on quiz creation**
- This usually means a quiz with that slug already exists. The command should handle this with `get_or_create`, but check for duplicate slugs in your data.

**Questions not appearing**
- Check that `is_published` is set to `True` on the quiz
- Verify the quiz-question relationships are correct
- Check the database with `python manage.py shell` and query the models directly

## Database Models

The seeding command works with these models:
- `core.quizzes.models.Quiz` - Quiz metadata
- `core.quizzes.models.QuizQuestion` - Individual questions
- `django.contrib.auth.User` - Quiz creator (system user)
