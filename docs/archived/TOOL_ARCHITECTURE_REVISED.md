# Tool Architecture - Revised Design

## Overview

This document describes the revised tool architecture that addresses three key requirements:

1. **1:1 Relationship with Taxonomy** - Each Tool creates/maintains a linked Taxonomy entry
2. **Programmatically Loadable** - Tools can be seeded from code (like topics)
3. **Editable "What's New"** - Updates/news can be edited independently via admin

## Architecture Decisions

### Tool ↔ Taxonomy Relationship

```python
# Tool Model (core/tools/models.py)
class Tool(models.Model):
    # ... other fields ...

    # OneToOne link to Taxonomy for personalization
    taxonomy = models.OneToOneField(
        Taxonomy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tool_entity',
        help_text='Link to taxonomy entry for user personalization/tagging',
    )
```

**Auto-creation on save:**
- When a Tool is saved without a taxonomy, one is automatically created
- The taxonomy mirrors key tool info (name, description, website_url, etc.)
- Users can tag themselves with these taxonomies for personalization

### Programmatic Loading

Tools are loaded via management command, similar to `seed_topics.py`:

```bash
python manage.py seed_tools
```

**Command behavior:**
- **First run**: Creates tools and auto-creates linked taxonomies
- **Subsequent runs**: Updates core fields but **preserves** `whats_new`
- Uses `get_or_create()` pattern for idempotency

**What gets updated:**
- ✅ `tagline`, `description`, `category`, `pricing_model`
- ✅ `tags`, `key_features`, `usage_tips`, `best_practices`
- ❌ `whats_new` (preserved - managed separately!)

### Editable "What's New" Field

New field added to Tool model:

```python
whats_new = models.JSONField(
    default=list,
    blank=True,
    help_text="Recent updates and what's new [{date: '2025-01-15', title: '', description: ''}]",
)
```

**Structure:**
```json
[
  {
    "date": "2025-01-15",
    "title": "GPT-4 Turbo Released",
    "description": "New model with improved reasoning and lower cost"
  },
  {
    "date": "2025-01-10",
    "title": "Vision API Updates",
    "description": "Enhanced image understanding capabilities"
  }
]
```

**Why JSON?**
- Flexible structure for different update types
- Easy to render chronologically
- Can include dates, titles, descriptions, links
- Supports rich formatting

## Usage Workflow

### 1. Seed Tools (First Time)

```bash
docker exec allthriveai_web_1 python manage.py seed_tools
```

Output:
```
✓ Created tool: ChatGPT
✓ Created tool: Claude
✓ Created tool: Midjourney
...
✓ Tools seeded! Created: 6, Updated: 0
```

### 2. Update Tool Definitions

Edit `core/management/commands/seed_tools.py` and re-run:

```bash
docker exec allthriveai_web_1 python manage.py seed_tools
```

Output:
```
↻ Updated tool: ChatGPT (whats_new preserved)
↻ Updated tool: Claude (whats_new preserved)
...
✓ Tools seeded! Created: 0, Updated: 6

Note: whats_new field is preserved during updates and can be edited via Django admin.
```

### 3. Edit "What's New" via Admin

1. Go to `/admin/core/tool/`
2. Select a tool (e.g., ChatGPT)
3. Expand "Content Sections"
4. Edit the `whats_new` JSON field
5. Save

**Example admin edit:**
```json
[
  {
    "date": "2025-01-20",
    "title": "New Custom Instructions",
    "description": "You can now set custom instructions for consistent behavior"
  }
]
```

## Database Schema

### Migration Created

```
core/migrations/0038_add_whats_new_to_tool.py
  - Add field whats_new to tool
```

Run migration:
```bash
docker exec allthriveai_web_1 python manage.py migrate
```

### Fields Added/Modified

- **Tool.whats_new** (new) - JSONField for updates
- **Tool.save()** (modified) - Auto-creates taxonomy if missing

## API Updates

### Serializers

Updated `ToolDetailSerializer` to include `whats_new`:

```python
class ToolDetailSerializer(serializers.ModelSerializer):
    class Meta:
        fields = [
            # ... existing fields ...
            'whats_new',  # NEW
            # ...
        ]
```

### Frontend Integration

Update TypeScript types:

```typescript
export interface Tool {
  // ... existing fields ...
  whats_new: Array<{
    date: string;
    title: string;
    description: string;
  }>;
}
```

Display in ToolDetailPage:

```tsx
{tool.whats_new.length > 0 && (
  <section>
    <h2>What's New</h2>
    {tool.whats_new.map((update, idx) => (
      <div key={idx} className="update-item">
        <time>{update.date}</time>
        <h3>{update.title}</h3>
        <p>{update.description}</p>
      </div>
    ))}
  </section>
)}
```

## Benefits

### ✅ 1:1 Taxonomy Relationship
- Each tool automatically creates a taxonomy entry
- Users can tag themselves with tools for personalization
- Consistent data model for user preferences

### ✅ Programmatically Loadable
- Tools defined in code (single source of truth)
- Easy to version control and track changes
- Idempotent - safe to run multiple times
- Similar pattern to `seed_topics.py`

### ✅ Editable "What's New"
- Preserved during seed updates
- Editable via Django admin
- No need to redeploy code for news updates
- Supports rich, structured content

## Comparison: Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| Taxonomy Link | OneToOne (manual) | OneToOne (auto-created) |
| Tool Loading | Manual admin entry | Programmatic seed command |
| Updates/News | N/A | `whats_new` field (editable) |
| Data Source | Database only | Code + Database (hybrid) |
| Version Control | No | Yes (core fields) |
| Admin Flexibility | Full | Hybrid (core locked, news editable) |

## Maintenance Guide

### Adding a New Tool

1. Edit `core/management/commands/seed_tools.py`
2. Add tool to `tools_data` list
3. Run `python manage.py seed_tools`

### Updating Tool Information

1. Edit tool definition in `seed_tools.py`
2. Run `python manage.py seed_tools`
3. Changes apply, `whats_new` preserved

### Adding "What's New" Content

1. Go to Django admin
2. Edit tool
3. Update `whats_new` JSON field
4. Save

### Removing a Tool

1. Remove from `seed_tools.py`
2. Set `is_active=False` in admin (don't delete - preserves data)

## Future Enhancements

### Potential Improvements

1. **Webhook Integration** - Auto-update `whats_new` from tool provider APIs
2. **Version History** - Track changes to `whats_new` over time
3. **RSS Feed** - Generate RSS from all tool updates
4. **User Notifications** - Notify users when their favorited tools have updates
5. **Changelog API** - Structured API endpoint for tool changelogs
6. **Import from File** - Support CSV/JSON import for bulk tool loading

## Related Documentation

- [Tool Models Setup](./TOOL_MODELS_SETUP.md) - Original tool model design
- [Tool Directory Setup](./TOOL_DIRECTORY_SETUP.md) - Frontend implementation
- [Taxonomy System](./PERSONALIZATION.md) - User personalization system

## Examples

### Example 1: Full Tool Definition

```python
{
    'name': 'ChatGPT',
    'tagline': 'AI-powered conversational assistant',
    'description': 'ChatGPT by OpenAI provides natural language interactions...',
    'category': 'chat',
    'website_url': 'https://chat.openai.com',
    'pricing_model': 'freemium',
    'has_free_tier': True,
    'tags': ['NLP', 'OpenAI', 'Conversation', 'GPT'],
    'key_features': [
        {'title': 'Natural Conversations', 'description': 'Engage in human-like dialogue'},
        {'title': 'Code Generation', 'description': 'Generate and debug code'},
    ],
    'usage_tips': [
        'Be specific in your prompts',
        'Use iterative refinement',
    ],
    'best_practices': [
        'Provide context for better responses',
        'Verify factual information',
    ],
}
```

### Example 2: What's New Updates

```json
[
  {
    "date": "2025-01-25",
    "title": "GPT-4.5 Released",
    "description": "Significant improvements in reasoning and coding capabilities"
  },
  {
    "date": "2025-01-20",
    "title": "Custom Instructions",
    "description": "Set persistent instructions for all conversations"
  },
  {
    "date": "2025-01-15",
    "title": "Voice Mode Beta",
    "description": "Natural voice conversations now available in beta"
  }
]
```

## Summary

This revised architecture provides:
- **Developer Experience**: Tools in code, version controlled
- **Admin Flexibility**: News/updates editable without deployment
- **User Benefit**: 1:1 taxonomy for personalization
- **Maintainability**: Clear separation of concerns

The hybrid approach (code + database) gives us the best of both worlds: infrastructure as code for core tool definitions, with CMS-like flexibility for time-sensitive content updates.
