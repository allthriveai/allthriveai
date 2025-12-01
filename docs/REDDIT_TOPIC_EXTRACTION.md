# Reddit Bot Topic Extraction

## Overview

Reddit bots now use AI-powered topic extraction to automatically identify and tag relevant topics, tools, and categories from Reddit posts. The system intelligently matches extracted topics against AllThrive's existing taxonomy to ensure consistency.

## Features

### AI-Powered Extraction

- Uses OpenAI to analyze post title, body text, subreddit, and flair
- Extracts up to 15 relevant topics per post
- Identifies AI tools, programming languages, frameworks, and technical concepts
- Falls back to keyword-based extraction if AI fails

### Taxonomy Matching

- Automatically matches extracted topics to existing Tools in the database
- Maps topics to Category taxonomies (e.g., "showcase", "ai-learning")
- Prioritizes exact name matches, then slug matches, then tag matches
- Uses flair-to-category mapping for Reddit-specific context

### Smart Configuration

- Bot settings can specify default tools and categories
- System learns from existing taxonomy to improve matching
- Topics are deduplicated and limited to prevent over-tagging

## How It Works

### 1. Post Analysis

When a Reddit post is synced, the system:

```
1. Fetches post metadata (title, selftext, subreddit, flair)
2. Sends to TopicExtractionService
3. AI analyzes content and extracts relevant topics
4. Topics are normalized (lowercase, deduplicated)
```

### 2. Tool Matching

Topics are matched against existing Tools:

```python
# Match priority:
1. Exact name match (e.g., "ChatGPT" → ChatGPT tool)
2. Slug match (e.g., "stable diffusion" → stable-diffusion tool)
3. Tag match (e.g., "gpt-4" matches tool with tags: ["gpt-4", "openai"])
```

### 3. Category Matching

Topics and flairs are mapped to categories:

```python
# Flair mappings:
'showcase' → 'showcase' category
'question' → 'ai-learning' category
'tutorial' → 'ai-learning' category
'discussion' → 'ai-discussion' category
'help' → 'ai-learning' category
'news' → 'ai-news' category
```

## Usage

### Automatic (New Posts)

All new Reddit posts automatically use AI topic extraction:

```bash
# Create a bot (uses AI extraction by default)
python manage.py create_reddit_bot --subreddit ClaudeCode

# Sync posts (uses AI extraction)
python manage.py sync_reddit_bots
```

### Manual Reprocessing (Existing Posts)

Reprocess existing posts to use improved topic extraction:

```bash
# Reprocess last 100 posts
python manage.py reprocess_reddit_topics

# Reprocess all posts from a specific bot
python manage.py reprocess_reddit_topics --bot claudecode-reddit-bot

# Reprocess all posts (unlimited)
python manage.py reprocess_reddit_topics --all

# Reprocess with custom limit
python manage.py reprocess_reddit_topics --limit 500
```

## Bot Settings

Configure bot behavior via the `settings` JSON field:

```python
bot = RedditCommunityBot.objects.create(
    subreddit='ClaudeCode',
    settings={
        'feed_type': 'top',
        'time_period': 'week',
        'min_score': 10,
        
        # Default tools (always assigned)
        'default_tools': ['claude', 'chatgpt'],
        
        # Default categories (always assigned)
        'default_categories': ['showcase', 'ai-discussion'],
    }
)
```

## Topic Extraction Service API

### `TopicExtractionService`

```python
from services.topic_extraction_service import TopicExtractionService

service = TopicExtractionService()

# Extract topics
topics = service.extract_topics_from_reddit_post(
    title='Building a ChatGPT clone with Claude',
    selftext='I used Python and LangChain to build...',
    subreddit='ClaudeCode',
    link_flair='Showcase',
    max_topics=10,
)
# Returns: ['claudecode', 'chatgpt', 'claude', 'python', 'langchain', 'showcase']

# Match topics to tools
tools = service.match_tools(topics)
# Returns: [<Tool: ChatGPT>, <Tool: Claude>, <Tool: LangChain>]

# Match topics to categories
categories = service.match_categories(topics, link_flair='Showcase')
# Returns: [<Taxonomy: Showcase (Category)>]
```

## AI Prompt Design

The system uses a carefully crafted prompt to guide topic extraction:

**Focus Areas:**
- AI tools and technologies (ChatGPT, Claude, Stable Diffusion, LangChain)
- Programming languages and frameworks (Python, JavaScript, React)
- Technical concepts and methodologies (automation, machine learning, NLP)
- Project categories (automation, data analysis, creative work)
- Domain-specific terms

**Instructions:**
- Return comma-separated lowercase topics
- Prioritize most relevant and specific topics
- Match against existing taxonomy when possible
- Limit to specified maximum (default: 15)

## Examples

### Example 1: Tool Detection

**Post:**
```
Title: "I built a code reviewer using Claude and GitHub Copilot"
Subreddit: ClaudeCode
Flair: Showcase
```

**Extracted Topics:**
- claudecode (from subreddit)
- claude (detected tool)
- github copilot (detected tool)
- code review (technical concept)
- automation (category)

**Matched Tools:**
- Claude
- GitHub Copilot

**Matched Categories:**
- Showcase (from flair)

### Example 2: Multi-Tool Project

**Post:**
```
Title: "Comparing GPT-4 vs Claude for data analysis"
Subreddit: ChatGPT
Body: "I tested both OpenAI's GPT-4 and Anthropic's Claude..."
Flair: Discussion
```

**Extracted Topics:**
- chatgpt (from subreddit)
- gpt-4 (detected tool)
- claude (detected tool)
- openai (provider)
- anthropic (provider)
- data analysis (use case)

**Matched Tools:**
- GPT-4
- Claude
- OpenAI

**Matched Categories:**
- AI Discussion (from flair)

## Fallback Behavior

If AI extraction fails, the system falls back to keyword-based extraction:

1. Always include subreddit name
2. Include meaningful link flair (exclude generic ones)
3. Match against hardcoded list of common AI tools
4. Extract from title and body using keyword search

Common keywords include:
- claude, chatgpt, gpt-4, copilot, midjourney
- stable diffusion, dall-e, langchain, openai, anthropic
- python, javascript, typescript, react, nextjs
- api, automation, machine learning, nlp

## Performance Considerations

### Token Usage

- AI extraction uses ~200-500 tokens per post
- Text is truncated to 2000 characters to limit token costs
- Lower temperature (0.3) for consistent results

### Caching

- Existing taxonomy is cached in memory during extraction
- Tool/category matching uses database indexes
- Topics are stored as JSON array in Project model

### Rate Limiting

- AI provider handles rate limiting automatically
- Fallback ensures posts are processed even during API issues
- Errors are logged but don't block post creation

## Monitoring

Check logs for topic extraction activity:

```python
import logging
logger = logging.getLogger('services.topic_extraction_service')
```

Log messages include:
- `Extracted N topics from Reddit post: ...`
- `Assigned N tools to project: [...]`
- `Assigned N categories to project: [...]`
- `Error extracting topics with AI: ...` (triggers fallback)

## Future Improvements

- [ ] Fine-tune prompt based on subreddit
- [ ] Support custom taxonomy per bot
- [ ] Add confidence scores to topics
- [ ] Learn from user corrections/edits
- [ ] Batch processing for efficiency
- [ ] Support for multiple languages
- [ ] Image analysis for thumbnail-based topics
