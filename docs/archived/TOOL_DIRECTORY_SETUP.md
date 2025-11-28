# Tool Directory Setup

This guide explains how to populate and manage the AI Tool Directory.

## Overview

The Tool Directory (`/tools`) displays AI tools with comprehensive information including:
- **Logo** - Visual brand identity
- **Website** - Link to official site
- **Description** - Clear explanation of what the tool does
- **Usage Tips** - Practical advice for effective use
- **Best For** - Specific use cases and scenarios

## Loading Sample Data

We've created a fixture with 10 popular AI tools to get you started:

```bash
# Load the AI tools fixture
python manage.py loaddata core/fixtures/ai_tools.json
```

This will populate your database with:
- ChatGPT
- Claude
- Midjourney
- GitHub Copilot
- Notion AI
- Perplexity
- Runway
- Grammarly
- Jasper
- Cursor

## Adding New Tools

### Via Django Admin

1. Navigate to the admin panel: `http://localhost:8000/admin/`
2. Go to **Core > Taxonomies**
3. Click **Add Taxonomy**
4. Fill in the fields:
   - **Name**: Tool name (e.g., "ChatGPT")
   - **Category**: Select "Tool"
   - **Description**: Brief description (1-2 sentences)
   - **Is active**: Check to make it visible
   - **Website URL**: Official website
   - **Logo URL**: Link to logo image (PNG/SVG preferred)
   - **Usage tips**: JSON array of strings with tips
   - **Best for**: JSON array of strings with use cases

### Example JSON Format

For the **Usage tips** field:
```json
[
  "Ask it to explain complex concepts in simple terms",
  "Use it for brainstorming and ideation sessions",
  "Request step-by-step coding help with explanations"
]
```

For the **Best for** field:
```json
[
  "Content creation and writing assistance",
  "Code debugging and explanation",
  "Learning new concepts quickly"
]
```

### Via Python Script

Create tools programmatically:

```python
from core.models import Taxonomy

tool = Taxonomy.objects.create(
    name="Your Tool Name",
    category="tool",
    description="A clear, concise description of the tool",
    is_active=True,
    website_url="https://example.com",
    logo_url="https://example.com/logo.png",
    usage_tips=[
        "Tip 1: How to use it effectively",
        "Tip 2: Best practices",
        "Tip 3: Pro tips"
    ],
    best_for=[
        "Use case 1",
        "Use case 2",
        "Use case 3"
    ]
)
```

## Finding Logo URLs

Good sources for tool logos:
- Official brand assets/press kits
- [Worldvectorlogo.com](https://worldvectorlogo.com)
- [Seeklogo.com](https://seeklogo.com)
- [Simple Icons](https://simpleicons.org)
- CDN services like Cloudinary, Imgix

**Note**: Ensure you have rights to use the logo images.

## Tool Card Display

When a user clicks on a tool in the directory, a sidebar opens showing:

1. **Header Section** (fixed)
   - Large logo (56x56px)
   - Tool name
   - Category badge
   - "Visit Website" button

2. **Content Section** (scrollable)
   - Description box (highlighted)
   - "How to use effectively" section with numbered tips
   - "Best for" section with checkmark icons

## Admin Enhancements

The Django admin has been enhanced with:
- **List Display**: Shows tool name, category, has website, has logo, active status
- **Filters**: Filter by category, active status, creation date
- **Search**: Search by name and description
- **Fieldsets**: Organized sections for basic info and tool-specific details
- **Boolean Indicators**: Visual indicators for website and logo presence

## Frontend Features

The Tool Directory page includes:
- **Search**: Filter tools by name or description
- **Alphabetical Grouping**: Dictionary-style layout by first letter
- **Alphabet Navigation**: Quick jump navigation (when 3+ letters)
- **Responsive Design**: Works on mobile and desktop
- **Loading States**: Skeleton loaders during data fetch
- **Error Handling**: Graceful error messages

## Maintenance

### Deactivating a Tool
Set `is_active = False` in the admin to hide it without deletion.

### Updating Tool Info
Edit the tool in Django admin and update any fields. Changes appear immediately.

### Bulk Import
Create a JSON fixture following the format in `core/fixtures/ai_tools.json` and load it:
```bash
python manage.py loaddata path/to/your/fixture.json
```

## API Endpoint

The tools are fetched via: `GET /api/v1/taxonomies/?category=tool`

Response includes all active tools with category "tool".
