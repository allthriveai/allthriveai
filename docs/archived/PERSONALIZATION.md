# Personalization Feature

The personalization feature allows users to select their interests, skills, goals, and other preferences to customize their experience on AllThrive AI.

## Overview

Users can access personalization settings at `/account/settings/personalization` where they can:
- Select from predefined taxonomies across 5 categories (Interests, Skills, Goals, Topics, Industries)
- View auto-generated tags based on their site activity
- Manage their preferences to receive personalized content recommendations (coming soon)

## Architecture

### Backend (Django)

**Models** (`core/taxonomy_models.py`):
- `Taxonomy`: Predefined categories that users can select (e.g., "Python", "AI & Machine Learning")
- `UserTag`: Tags associated with a user (both manual and auto-generated)
- `UserInteraction`: Tracks user interactions for auto-tag generation

**API Endpoints**:
- `GET /api/v1/taxonomies/` - List all active taxonomies
- `GET /api/v1/taxonomies/by_category/` - Get taxonomies grouped by category
- `GET /api/v1/me/personalization/` - Get user's personalization overview
- `GET /api/v1/me/tags/` - List all user tags
- `GET /api/v1/me/tags/manual/` - List only manually selected tags
- `GET /api/v1/me/tags/auto_generated/` - List only auto-generated tags
- `POST /api/v1/me/tags/` - Create a single tag
- `POST /api/v1/me/tags/bulk_create/` - Create multiple tags from taxonomy selections
- `DELETE /api/v1/me/tags/{id}/` - Delete a tag
- `DELETE /api/v1/me/tags/bulk_delete/` - Delete multiple tags
- `POST /api/v1/me/interactions/` - Track a user interaction for auto-tagging

**Admin Interface**:
All models are registered in Django admin for easy management:
- Add/edit/deactivate taxonomies
- View user tags and their sources
- Monitor user interactions

### Frontend (React/TypeScript)

**Components**:
- `Personalization.tsx` - Main personalization UI with category filters and tag management
- `PersonalizationSettingsPage.tsx` - Settings page wrapper

**Services** (`frontend/src/services/personalization.ts`):
- Functions to interact with personalization API
- Type-safe wrappers for all endpoints

**Types** (`frontend/src/types/models.ts`):
- `Taxonomy` - Predefined taxonomy structure
- `UserTag` - User tag with source and confidence data
- `UserPersonalization` - Complete personalization overview
- `UserInteraction` - Interaction tracking data

## Usage

### Adding New Taxonomies

1. Via Django Admin:
   - Navigate to `/admin/core/taxonomy/`
   - Add new taxonomy with name, category, and description
   - Set `is_active` to true

2. Via Management Command:
   - Edit `core/management/commands/seed_taxonomies.py`
   - Add new taxonomy data to the list
   - Run: `docker compose exec web python manage.py seed_taxonomies`

### Auto-generating Tags

Tags can be automatically generated based on user activity. To track interactions:

```typescript
import { trackInteraction } from '@/services/personalization';

// Track when user views a project
await trackInteraction({
  interactionType: 'project_view',
  metadata: { project_id: 123, project_type: 'ai_project' },
  extractedKeywords: ['AI', 'Machine Learning', 'Python'],
});
```

Interaction types:
- `project_view` - User views a project
- `project_create` - User creates a project
- `conversation` - User has a conversation with AI
- `search` - User performs a search
- `content_view` - User views content

### Future Enhancements

1. **Content Filtering**: Use tags to filter and recommend relevant content
2. **Smart Recommendations**: AI-powered suggestions based on user preferences
3. **Tag Weights**: Adjust importance of different tags
4. **Tag Relationships**: Link related tags for better recommendations
5. **Activity-based Updates**: Automatically update tag confidence scores based on ongoing interactions

## Database Schema

### Taxonomy Table
```sql
- id (PK)
- name (unique)
- category (interest, skill, goal, topic, industry)
- description
- is_active
- created_at
```

### UserTag Table
```sql
- id (PK)
- user_id (FK)
- taxonomy_id (FK, nullable)
- name
- source (manual, auto_project, auto_conversation, auto_activity)
- confidence_score (0.0-1.0)
- interaction_count
- created_at
- updated_at
- UNIQUE(user_id, name)
```

### UserInteraction Table
```sql
- id (PK)
- user_id (FK)
- interaction_type
- metadata (JSON)
- extracted_keywords (JSON array)
- created_at
```

## Testing

To test the personalization feature:

1. Ensure taxonomies are seeded:
   ```bash
   docker compose exec web python manage.py seed_taxonomies
   ```

2. Navigate to http://localhost:3000/account/settings/personalization

3. Select some taxonomies from different categories

4. Click "Save Changes"

5. Verify tags appear in your profile

6. (Future) Observe personalized content recommendations based on your selections
