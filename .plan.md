# Nano Banana Project Creation Enhancement

## Goal
When users create images with Nano Banana, enable them to create a project that includes:
1. The final generated image as the featured image
2. The prompts and iterations that led to the final image
3. An AI-generated "creative journey" summary in the project description

## Current State
- Images are generated via Gemini 2.0 Flash
- "Use as Featured" button only sets `featured_image_url` on existing projects
- Conversation history exists in LangGraph checkpoints but not wired to image generation
- No tracking of image generation iterations or prompts

## Implementation Plan

### Phase 1: Track Image Generation Sessions

**1.1 Create ImageGenerationSession Model**
File: `core/agents/models.py`

```python
class ImageGenerationSession(BaseModel):
    """Tracks a Nano Banana image generation session with iterations."""
    conversation_id = CharField(max_length=255, db_index=True)
    user = ForeignKey(User, on_delete=models.CASCADE)
    created_at = DateTimeField(auto_now_add=True)
    final_image_url = CharField(max_length=500, blank=True)

class ImageGenerationIteration(models.Model):
    """Individual iteration in an image generation session."""
    session = ForeignKey(ImageGenerationSession, on_delete=models.CASCADE, related_name='iterations')
    prompt = TextField()  # User's prompt for this iteration
    image_url = CharField(max_length=500)  # Generated image URL
    gemini_response_text = TextField(blank=True)  # Gemini's text response
    created_at = DateTimeField(auto_now_add=True)
    order = PositiveIntegerField(default=0)
```

**1.2 Update Image Generation Task**
File: `core/agents/tasks.py`

- Create/get session on first image generation for a conversation
- Save each iteration with prompt and result
- Update `final_image_url` to latest successful image

### Phase 2: Create Project from Image Session

**2.1 Add AI Summary Generation**
File: `services/ai_provider.py` or new `services/image_project_service.py`

```python
def generate_creative_journey_summary(iterations: list[dict]) -> str:
    """
    Use AI to summarize the creative journey from iterations.

    Input: List of {prompt, gemini_response_text, order}
    Output: A narrative summary of how the image evolved
    """
```

**2.2 Create Project Creation Endpoint**
File: `core/agents/views.py` (new or extend existing)

```python
class CreateProjectFromImageView(APIView):
    """
    POST /api/v1/agents/create-project-from-image/

    Creates a project from an image generation session:
    - Sets final image as featured_image_url
    - Generates AI summary of creative journey
    - Creates structured content with prompts and iterations
    """
```

**2.3 Project Content Structure**
The created project will have:
```python
{
    "title": "Nano Banana Creation: {first_prompt_summary}",
    "description": "{AI-generated creative journey summary}",
    "featured_image_url": "{final_image_url}",
    "type": "prompt",  # or new type "nano_banana_creation"
    "content": {
        "templateVersion": 2,
        "sections": [
            {
                "id": "hero",
                "type": "hero",
                "title": "The Final Result",
                "imageUrl": "{final_image_url}"
            },
            {
                "id": "journey",
                "type": "content",
                "title": "Creative Journey",
                "blocks": [
                    {"type": "text", "content": "{AI summary}"},
                    {"type": "heading", "content": "Iteration 1"},
                    {"type": "image", "url": "{iteration_1_image}"},
                    {"type": "quote", "content": "{iteration_1_prompt}"},
                    # ... more iterations
                ]
            }
        ]
    }
}
```

### Phase 3: Frontend Integration

**3.1 Update WebSocket Message Structure**
Add session tracking to image generation events:
```typescript
interface WebSocketMessage {
  // ... existing fields
  session_id?: string;  // Image generation session ID
  iteration_number?: number;
}
```

**3.2 Update GeneratedImageMessage Component**
File: `frontend/src/components/chat/GeneratedImageMessage.tsx`

Add new button: "Create Project"
- Calls new API endpoint with session_id
- On success, navigates to created project

**3.3 Update IntelligentChatPanel**
- Track session_id from WebSocket messages
- Pass session_id to GeneratedImageMessage
- Handle project creation callback

### Phase 4: Database Migration

```bash
python manage.py makemigrations agents
python manage.py migrate
```

## Files to Modify

### Backend
1. `core/agents/models.py` - Add ImageGenerationSession, ImageGenerationIteration models
2. `core/agents/tasks.py` - Track iterations in _process_image_generation
3. `core/agents/views.py` - Add CreateProjectFromImageView
4. `core/agents/urls.py` - Add new endpoint
5. `services/ai_provider.py` - Add generate_creative_journey_summary

### Frontend
6. `frontend/src/hooks/useIntelligentChat.ts` - Track session_id
7. `frontend/src/components/chat/GeneratedImageMessage.tsx` - Add "Create Project" button
8. `frontend/src/components/chat/IntelligentChatPanel.tsx` - Handle project creation
9. `frontend/src/services/api.ts` or new file - Add API call for project creation

## API Design

### Create Project from Image Session
```
POST /api/v1/agents/create-project-from-image/
Authorization: Bearer {token}

Request:
{
  "session_id": "img-session-123",
  "title": "Optional custom title"  // If not provided, AI generates
}

Response:
{
  "success": true,
  "project": {
    "id": 456,
    "slug": "nano-banana-creation-cool-banana",
    "url": "/username/nano-banana-creation-cool-banana",
    "title": "Nano Banana Creation: Cool Banana with Sunglasses"
  }
}
```

## Execution Order

1. Create models and migration (Phase 1.1)
2. Update image generation task to track sessions (Phase 1.2)
3. Add AI summary generation (Phase 2.1)
4. Create API endpoint (Phase 2.2, 2.3)
5. Update frontend WebSocket handling (Phase 3.1)
6. Update GeneratedImageMessage component (Phase 3.2)
7. Update IntelligentChatPanel (Phase 3.3)
8. Test end-to-end flow
