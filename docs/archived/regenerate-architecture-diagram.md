# Feature: Regenerate Architecture Diagram via Intelligent Chat

## Overview

Allow users to regenerate their project's mermaid architecture diagram through a conversational interface in the intelligent chat. This complements the existing direct-edit capability with an AI-assisted regeneration option.

## User Story

As a project owner, when my auto-generated architecture diagram is wrong or doesn't accurately represent my system, I want to describe my architecture in plain English and have the AI regenerate the diagram for me.

## Current State

### Architecture Diagram Display
- Projects use a section-based content system (`ProjectSection` with `type: 'architecture'`)
- `ArchitectureSection` component renders mermaid diagrams via `MermaidDiagram`
- In edit mode, users can directly edit mermaid code via `InlineEditableText`
- Diagram stored in `project.content.sections[].content.diagram` (string of mermaid code)

### Existing AI Generation
- `BaseParser.generate_architecture_diagram()` generates diagrams during import
- Uses simple prompt with project name, description, language, topics
- Returns mermaid code starting with `graph TB`
- Helper methods: `BaseParser._sanitize_mermaid_diagram()`, `BaseParser._validate_mermaid_syntax()`

### Intelligent Chat System
- LangGraph-based agent with tool execution
- Tools defined in `services/agents/project/tools.py`
- State injection pattern for user context
- Streaming responses via WebSocket
- **Project context available**: When chat is opened from a project page, `conversation_id` follows pattern `project-{id}` (see `IntelligentChatPanel.tsx:1251`)

## Proposed Solution

### User Flow

1. User views their project page (e.g., `/alliejones42/redis-wellness`)
2. User sees the architecture diagram is incorrect
3. User opens intelligent chat (from project page - chat knows the project context)
4. User says: "The architecture diagram is wrong" or "Regenerate my architecture diagram"
5. Agent detects project context from conversation OR asks which project if opened globally
6. Agent responds with educational context and asks for description:
   > "I can help you fix that! A mermaid diagram is a visual flowchart showing how the parts of your system connect.
   >
   > Can you describe your system architecture? For example:
   > - What are the main components? (e.g., frontend, API, database)
   > - How do they connect to each other?
   > - What external services does it use?"
7. User describes their architecture in plain English
8. Agent calls `regenerate_architecture_diagram` tool with project_id and description
9. Tool generates new mermaid code and updates the project
10. Agent confirms with preview: "Done! I've updated your architecture diagram. Here's what I generated:\n```mermaid\ngraph TB...\n```\n[View your project](/alliejones42/redis-wellness)"

### Keep Existing Direct Edit
- Users can still directly edit mermaid code in edit mode
- Chat regeneration is an additional option, not a replacement
- If user doesn't like the regenerated diagram, they can edit it manually or ask the agent to try again

---

## Implementation Plan

### Phase 1: Backend Tool

#### 1.1 Create Tool Input Schema
**File:** `services/agents/project/tools.py`

```python
class RegenerateArchitectureDiagramInput(BaseModel):
    """Input for regenerate_architecture_diagram tool."""

    project_id: int = Field(
        description='The numeric ID of the project to update. Get this from the conversation context or ask the user.'
    )
    architecture_description: str = Field(
        description="User's plain English description of their system architecture, including components and how they connect."
    )
```

**Note:** We use `project_id: int` instead of slug because:
- Slugs are only unique per-user, not globally
- The project ID is available from conversation context (`project-{id}`)
- Unambiguous lookup with `Project.objects.get(id=project_id, user=user)`

#### 1.2 Implement Tool Function
**File:** `services/agents/project/tools.py`

```python
@tool(args_schema=RegenerateArchitectureDiagramInput)
def regenerate_architecture_diagram(
    project_id: int,
    architecture_description: str,
    state: dict | None = None,
) -> dict:
    """
    Regenerate the mermaid architecture diagram for a project based on user's description.

    Use this tool when:
    - User says their architecture diagram is wrong or inaccurate
    - User wants to regenerate or update their project's system diagram
    - User provides a description of how their system/architecture works

    IMPORTANT: Get the project_id from the conversation context if available.
    The conversation_id follows the pattern "project-{id}" when chat is opened from a project page.
    If not in a project context, ask the user which project they want to update.

    The tool will:
    1. Verify the user owns the project
    2. Generate a new mermaid diagram based on their description
    3. Update the project's architecture section
    4. Return a preview of the generated diagram

    Returns:
        Dictionary with success status, project URL, diagram preview, and message
    """
    from django.contrib.auth import get_user_model

    from core.analytics.usage import AIUsageTracker
    from core.integrations.base.parser import BaseParser
    from core.projects.models import Project
    from services.ai.provider import AIProvider

    User = get_user_model()

    # Validate state / user context
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Find project and verify ownership
    try:
        project = Project.objects.get(id=project_id, user=user)
    except Project.DoesNotExist:
        return {
            'success': False,
            'error': f'Project not found or you do not have permission to edit it.',
        }

    logger.info(f'Regenerating architecture diagram for project {project_id} by user {user.username}')

    # Generate new diagram with retry logic
    try:
        new_diagram = _generate_mermaid_from_description(
            description=architecture_description,
            project_name=project.title,
            tech_stack=project.content.get('tech_stack') if project.content else None,
        )
    except ValueError as e:
        return {'success': False, 'error': str(e)}

    # Update project content
    if not _update_project_architecture(project, new_diagram):
        return {'success': False, 'error': 'Failed to update project content'}

    # Track AI usage
    AIUsageTracker.track_usage(
        user=user,
        feature='regenerate_architecture_diagram',
        provider='anthropic',  # or get from AIProvider
        model='claude-3-haiku',
        input_tokens=len(architecture_description.split()) * 2,  # Rough estimate
        output_tokens=len(new_diagram.split()) * 2,
    )

    logger.info(f'Successfully regenerated architecture diagram for project {project_id}')

    return {
        'success': True,
        'url': f'/{user.username}/{project.slug}',
        'diagram_preview': new_diagram,
        'message': 'Architecture diagram updated successfully',
    }
```

#### 1.3 Register Tool
**File:** `services/agents/project/tools.py`

Add to `PROJECT_TOOLS` list:
```python
PROJECT_TOOLS = [
    create_project,
    extract_url_info,
    import_github_project,
    import_video_project,
    scrape_webpage_for_project,
    create_product,
    regenerate_architecture_diagram,  # New
]
```

**File:** `services/agents/project/agent.py`

Add to `TOOLS_NEEDING_STATE`:
```python
TOOLS_NEEDING_STATE = {
    'create_project',
    'create_product',
    'import_github_project',
    'import_video_project',
    'scrape_webpage_for_project',
    'regenerate_architecture_diagram',  # New
}
```

### Phase 2: Update Agent Prompts

#### 2.1 Add Tool Documentation
**File:** `services/agents/project/prompts.py`

Add to `SYSTEM_PROMPT` capabilities section:

```python
'7. **regenerate_architecture_diagram** - Regenerate a project\'s mermaid architecture diagram based on user description\n\n'
```

#### 2.2 Add Workflow Documentation

```python
'## Workflow for Regenerating Architecture Diagrams\n'
'When user wants to fix or regenerate their architecture diagram:\n'
'1. **Identify the project**: \n'
'   - If conversation_id starts with "project-", extract the project ID (e.g., "project-123" → project_id=123)\n'
'   - If not in a project context, ask "Which project would you like me to update?"\n'
'2. **Explain what you need**: Tell them what a mermaid diagram is and ask them to describe:\n'
'   - Main components of their system\n'
'   - How components connect to each other\n'
'   - External services or databases\n'
'3. **Generate**: Use regenerate_architecture_diagram with project_id and their description\n'
'4. **Confirm with preview**: Show the generated mermaid code and share the link\n\n'
'IMPORTANT: The conversation_id is available in your context. When it follows the pattern\n'
'"project-{id}", you already know which project the user is referring to.\n\n'
```

#### 2.3 Add Example Flow

```python
'## Example Flow - Regenerate Architecture Diagram (From Project Page)\n'
'Context: conversation_id="project-42", user is on their redis-wellness project page\n'
'User: "The architecture diagram is wrong"\n'
'You: "I can help fix that! A mermaid diagram shows how your system components connect.\n\n'
'Can you describe your architecture? For example:\n'
'- What are the main components?\n'
'- How do they connect?\n'
'- What databases or external services do you use?"\n\n'
'User: "It\'s a Flask API that connects to Redis for caching and PostgreSQL for data. '
'There\'s also a React frontend that talks to the API."\n'
'You: *use regenerate_architecture_diagram with project_id=42, '
'architecture_description="Flask API connects to Redis for caching and PostgreSQL for data storage. '
'React frontend communicates with the Flask API."*\n'
'→ Tool returns: {success: true, url: "/alliejones42/redis-wellness", diagram_preview: "graph TB\\n  A[React Frontend]..."}\n'
'→ "Done! I\'ve updated your architecture diagram. Here\'s what I generated:\n'
'```mermaid\n'
'graph TB\n'
'    A[React Frontend] --> B[Flask API]\n'
'    B --> C[PostgreSQL]\n'
'    B --> D[Redis Cache]\n'
'```\n'
'[View your project](/alliejones42/redis-wellness)"\n\n'

'## Example Flow - Regenerate Architecture Diagram (Global Chat)\n'
'Context: conversation_id="default-conversation", user opened chat from navbar\n'
'User: "I need to fix my architecture diagram"\n'
'You: "I\'d be happy to help! Which project would you like me to update the diagram for?"\n'
'User: "My redis-wellness project"\n'
'You: "Got it! A mermaid diagram shows how your system components connect.\n'
'Can you describe the architecture of redis-wellness? What are the main components and how do they connect?"\n'
'... (continues as above)\n\n'
```

### Phase 3: AI Prompt for Diagram Generation

#### 3.1 Create Dedicated Generation Function
**File:** `services/agents/project/tools.py`

Place this helper function above the tool definitions (prefix with `_` to indicate internal use):

```python
import json
import logging

from core.integrations.base.parser import BaseParser
from services.ai.provider import AIProvider

logger = logging.getLogger(__name__)


def _generate_mermaid_from_description(
    description: str,
    project_name: str,
    tech_stack: dict | None = None,
    max_retries: int = 2,
) -> str:
    """
    Generate mermaid diagram code from user's architecture description.

    Uses enhanced prompt with:
    - User's plain English description
    - Project context for better accuracy
    - Strict mermaid syntax rules

    Args:
        description: User's plain English description of architecture
        project_name: Name of the project for context
        tech_stack: Optional tech stack dict for additional context
        max_retries: Number of generation attempts (default 2)

    Returns:
        Valid mermaid diagram code

    Raises:
        ValueError: If valid diagram cannot be generated after retries
    """
    prompt = f"""Generate a Mermaid architecture diagram based on this description.

Project: {project_name}
Tech Stack: {json.dumps(tech_stack) if tech_stack else 'Not specified'}

User's Architecture Description:
{description}

IMPORTANT SYNTAX RULES:
1. Start with EXACTLY "graph TB" (top-to-bottom)
2. Use simple node IDs (A, B, C, D) without special characters
3. Use square brackets for labels: A[Label Text]
4. NO line breaks inside labels
5. Use --> for arrows
6. Use descriptive labels that match the user's description
7. Include all components mentioned by the user
8. Show data flow direction accurately
9. Keep it simple: 4-8 nodes maximum

CORRECT Example:
graph TB
    A[React Frontend] --> B[Flask API]
    B --> C[PostgreSQL Database]
    B --> D[Redis Cache]
    D --> B

Return ONLY the Mermaid code starting with "graph TB". No explanation, no markdown fences."""

    ai = AIProvider()
    last_error = None

    for attempt in range(max_retries):
        # Slightly increase temperature on retry for variety
        temperature = 0.4 + (attempt * 0.15)

        try:
            diagram_code = ai.complete(
                prompt=prompt,
                model=None,
                temperature=temperature,
                max_tokens=500,
            )

            # Clean up response (remove markdown fences if present)
            diagram_code = diagram_code.strip()
            if diagram_code.startswith('```mermaid'):
                diagram_code = diagram_code.replace('```mermaid', '').replace('```', '').strip()
            elif diagram_code.startswith('```'):
                diagram_code = diagram_code.replace('```', '').strip()

            # Sanitize and validate using existing BaseParser methods
            diagram_code = BaseParser._sanitize_mermaid_diagram(diagram_code)
            is_valid, error = BaseParser._validate_mermaid_syntax(diagram_code)

            if is_valid:
                logger.info(f'Generated valid mermaid diagram on attempt {attempt + 1}')
                return diagram_code
            else:
                last_error = error
                logger.warning(f'Attempt {attempt + 1} generated invalid mermaid: {error}')

        except Exception as e:
            last_error = str(e)
            logger.warning(f'Attempt {attempt + 1} failed with error: {e}')

    raise ValueError(f'Failed to generate valid mermaid diagram after {max_retries} attempts: {last_error}')
```

### Phase 4: Project Update Logic

#### 4.1 Find and Update Architecture Section
**File:** `services/agents/project/tools.py`

Place this helper function near `_generate_mermaid_from_description`:

```python
import uuid


def _update_project_architecture(project, new_diagram_code: str) -> bool:
    """
    Update the architecture section in a project's content.

    Handles both:
    - Section-based content (sections[].type == 'architecture')
    - Block-based content (blocks[].type == 'mermaid')

    If no architecture exists, creates a new architecture section.

    Args:
        project: Project model instance
        new_diagram_code: Valid mermaid diagram code

    Returns:
        True if update succeeded, False otherwise
    """
    content = project.content or {}
    updated = False

    # Try section-based update first (newer template v2 format)
    sections = content.get('sections', [])
    for section in sections:
        if section.get('type') == 'architecture':
            # Ensure content dict exists
            if 'content' not in section:
                section['content'] = {}
            section['content']['diagram'] = new_diagram_code
            updated = True
            break  # Only update first architecture section

    if updated:
        project.content = content
        project.save()
        logger.info(f'Updated architecture section for project {project.id}')
        return True

    # Try block-based update (older format)
    blocks = content.get('blocks', [])
    for block in blocks:
        if block.get('type') == 'mermaid':
            block['code'] = new_diagram_code
            updated = True
            break  # Only update first mermaid block

    if updated:
        project.content = content
        project.save()
        logger.info(f'Updated mermaid block for project {project.id}')
        return True

    # No existing architecture - add new section
    # Determine order: place after overview/features if they exist, otherwise at end
    max_order = max((s.get('order', 0) for s in sections), default=-1)

    new_section = {
        'id': str(uuid.uuid4()),
        'type': 'architecture',
        'enabled': True,
        'order': max_order + 1,
        'content': {
            'title': 'System Architecture',
            'diagram': new_diagram_code,
            'description': '',
        },
    }
    sections.append(new_section)
    content['sections'] = sections
    project.content = content
    project.save()

    logger.info(f'Created new architecture section for project {project.id}')
    return True
```

### Phase 5: Testing

#### 5.1 Unit Tests
**File:** `services/agents/project/tests/test_regenerate_diagram.py`

Create a new test file for this feature:

```python
import pytest
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model

from core.projects.models import Project
from services.agents.project.tools import (
    regenerate_architecture_diagram,
    _generate_mermaid_from_description,
    _update_project_architecture,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username='testuser', email='test@example.com')


@pytest.fixture
def project_with_architecture(user):
    return Project.objects.create(
        user=user,
        title='Test Project',
        content={
            'sections': [
                {
                    'id': 'arch-1',
                    'type': 'architecture',
                    'enabled': True,
                    'order': 0,
                    'content': {
                        'title': 'System Architecture',
                        'diagram': 'graph TB\n    A[Old] --> B[Diagram]',
                    },
                }
            ]
        },
    )


@pytest.fixture
def project_with_mermaid_block(user):
    return Project.objects.create(
        user=user,
        title='Legacy Project',
        content={
            'blocks': [
                {'type': 'mermaid', 'code': 'graph TB\n    A[Old] --> B[Block]'},
            ]
        },
    )


class TestRegenerateArchitectureDiagram:
    def test_regenerate_requires_authentication(self):
        """Test that unauthenticated requests fail."""
        result = regenerate_architecture_diagram(
            project_id=1,
            architecture_description='Some description',
            state=None,
        )
        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()

    def test_regenerate_requires_user_id_in_state(self):
        """Test that state must contain user_id."""
        result = regenerate_architecture_diagram(
            project_id=1,
            architecture_description='Some description',
            state={'username': 'test'},  # Missing user_id
        )
        assert result['success'] is False
        assert 'not authenticated' in result['error'].lower()

    def test_regenerate_requires_ownership(self, user, project_with_architecture):
        """Test that non-owners cannot regenerate."""
        other_user = User.objects.create_user(username='other', email='other@example.com')

        result = regenerate_architecture_diagram(
            project_id=project_with_architecture.id,
            architecture_description='Some description',
            state={'user_id': other_user.id, 'username': 'other'},
        )
        assert result['success'] is False
        assert 'not found or you do not have permission' in result['error'].lower()

    def test_regenerate_handles_invalid_project(self, user):
        """Test graceful handling of non-existent project."""
        result = regenerate_architecture_diagram(
            project_id=99999,
            architecture_description='Some description',
            state={'user_id': user.id, 'username': user.username},
        )
        assert result['success'] is False
        assert 'not found' in result['error'].lower()

    @patch('services.agents.project.tools._generate_mermaid_from_description')
    def test_regenerate_updates_section_content(
        self, mock_generate, user, project_with_architecture
    ):
        """Test that project content is correctly updated."""
        mock_generate.return_value = 'graph TB\n    A[New] --> B[Diagram]'

        result = regenerate_architecture_diagram(
            project_id=project_with_architecture.id,
            architecture_description='New architecture with frontend and backend',
            state={'user_id': user.id, 'username': user.username},
        )

        assert result['success'] is True
        assert 'url' in result
        assert 'diagram_preview' in result

        # Verify project was updated
        project_with_architecture.refresh_from_db()
        diagram = project_with_architecture.content['sections'][0]['content']['diagram']
        assert 'New' in diagram

    @patch('services.agents.project.tools._generate_mermaid_from_description')
    def test_regenerate_updates_mermaid_block(
        self, mock_generate, user, project_with_mermaid_block
    ):
        """Test that legacy mermaid blocks are updated."""
        mock_generate.return_value = 'graph TB\n    A[Updated] --> B[Block]'

        result = regenerate_architecture_diagram(
            project_id=project_with_mermaid_block.id,
            architecture_description='Updated architecture',
            state={'user_id': user.id, 'username': user.username},
        )

        assert result['success'] is True

        project_with_mermaid_block.refresh_from_db()
        code = project_with_mermaid_block.content['blocks'][0]['code']
        assert 'Updated' in code


class TestGenerateMermaidFromDescription:
    @patch('services.agents.project.tools.AIProvider')
    def test_generates_valid_diagram(self, mock_ai_class):
        """Test successful diagram generation."""
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'graph TB\n    A[Frontend] --> B[API]'
        mock_ai_class.return_value = mock_ai

        with patch.object(
            BaseParser, '_validate_mermaid_syntax', return_value=(True, None)
        ):
            result = _generate_mermaid_from_description(
                description='Frontend connects to API',
                project_name='Test Project',
            )

        assert result.startswith('graph TB')
        assert 'Frontend' in result

    @patch('services.agents.project.tools.AIProvider')
    def test_retries_on_invalid_syntax(self, mock_ai_class):
        """Test that generation retries on invalid syntax."""
        mock_ai = MagicMock()
        # First attempt returns invalid, second returns valid
        mock_ai.complete.side_effect = [
            'invalid syntax',
            'graph TB\n    A[Valid] --> B[Diagram]',
        ]
        mock_ai_class.return_value = mock_ai

        with patch.object(
            BaseParser,
            '_validate_mermaid_syntax',
            side_effect=[(False, 'Invalid'), (True, None)],
        ):
            result = _generate_mermaid_from_description(
                description='Test',
                project_name='Test',
            )

        assert 'Valid' in result
        assert mock_ai.complete.call_count == 2

    @patch('services.agents.project.tools.AIProvider')
    def test_raises_after_max_retries(self, mock_ai_class):
        """Test that ValueError is raised after max retries."""
        mock_ai = MagicMock()
        mock_ai.complete.return_value = 'always invalid'
        mock_ai_class.return_value = mock_ai

        with patch.object(
            BaseParser, '_validate_mermaid_syntax', return_value=(False, 'Always invalid')
        ):
            with pytest.raises(ValueError, match='Failed to generate valid mermaid'):
                _generate_mermaid_from_description(
                    description='Test',
                    project_name='Test',
                    max_retries=2,
                )


class TestUpdateProjectArchitecture:
    def test_updates_section_based_content(self, user, project_with_architecture):
        """Test updating section-based architecture."""
        new_code = 'graph TB\n    A[New] --> B[Section]'
        result = _update_project_architecture(project_with_architecture, new_code)

        assert result is True
        project_with_architecture.refresh_from_db()
        assert project_with_architecture.content['sections'][0]['content']['diagram'] == new_code

    def test_updates_block_based_content(self, user, project_with_mermaid_block):
        """Test updating block-based mermaid."""
        new_code = 'graph TB\n    A[New] --> B[Block]'
        result = _update_project_architecture(project_with_mermaid_block, new_code)

        assert result is True
        project_with_mermaid_block.refresh_from_db()
        assert project_with_mermaid_block.content['blocks'][0]['code'] == new_code

    def test_creates_section_if_none_exists(self, user):
        """Test creating new architecture section."""
        project = Project.objects.create(
            user=user,
            title='Empty Project',
            content={'sections': []},
        )

        new_code = 'graph TB\n    A[Brand] --> B[New]'
        result = _update_project_architecture(project, new_code)

        assert result is True
        project.refresh_from_db()
        assert len(project.content['sections']) == 1
        assert project.content['sections'][0]['type'] == 'architecture'
        assert project.content['sections'][0]['content']['diagram'] == new_code
```

#### 5.2 Integration Tests
**File:** `services/agents/project/tests/test_agent_integration.py`

Add to existing integration tests:

```python
class TestArchitectureDiagramFlow:
    @pytest.mark.asyncio
    async def test_full_regeneration_flow(self, user, project_with_architecture):
        """Test complete conversation flow for diagram regeneration."""
        # This would test the full agent flow with mocked AI responses
        pass  # Implementation depends on existing test patterns

    @pytest.mark.asyncio
    async def test_agent_extracts_project_id_from_context(self):
        """Test that agent uses project ID from conversation context."""
        pass  # Implementation depends on existing test patterns
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `services/agents/project/tools.py` | Add `RegenerateArchitectureDiagramInput` schema, `regenerate_architecture_diagram` tool, `_generate_mermaid_from_description()` helper, `_update_project_architecture()` helper |
| `services/agents/project/prompts.py` | Add tool documentation to capabilities, add workflow section, add example flows for project-context and global-chat scenarios |
| `services/agents/project/agent.py` | Add `'regenerate_architecture_diagram'` to `TOOLS_NEEDING_STATE` set |
| `services/agents/project/tests/test_regenerate_diagram.py` | **New file** - Unit tests for tool, generator, and updater functions |

## Dependencies

- `services.ai.provider.AIProvider` - For mermaid generation
- `core.integrations.base.parser.BaseParser` - For `_sanitize_mermaid_diagram()` and `_validate_mermaid_syntax()`
- `core.projects.models.Project` - Project model with JSONField content
- `core.analytics.usage.AIUsageTracker` - For tracking AI usage

## Open Questions

1. **Project ID in agent context**: The `conversation_id` pattern `project-{id}` is set in the frontend, but does the LangGraph agent have access to this in its state? May need to pass `project_id` through the state injection similar to `user_id`.

2. **Finding project by name**: If user says "my redis-wellness project" in global chat, how should the agent find the project ID? Options:
   - Add a `find_user_project` tool that searches by name/slug
   - Ask user to provide the project URL
   - Require chat to be opened from project page

3. **Multiple mermaid blocks**: If a project has multiple mermaid blocks (rare), the current implementation updates only the first one. Is this acceptable?

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI generates invalid mermaid | Retry up to 2 times with increasing temperature; validate with `BaseParser._validate_mermaid_syntax()` |
| User describes architecture poorly | Agent asks clarifying questions; prompt includes example descriptions |
| Wrong project updated | Verify ownership with `Project.objects.get(id=project_id, user=user)` |
| Performance (AI call latency) | Show "generating..." in chat; return preview in response |
| Project has no architecture section | Create new section automatically at end of sections list |

## Future Enhancements

1. **Preview before save**: Add a `preview_only: bool` parameter that generates but doesn't save, letting user approve first
2. **Iterative refinement**: Allow user to say "add a cache layer" or "make it left-to-right instead"
3. **Template suggestions**: Offer common architecture patterns (microservices, monolith, serverless) as starting points
4. **Diagram style options**: Support sequence diagrams, ER diagrams, etc. (not just flowcharts)
5. **Undo capability**: Store previous diagram in response so user can request revert

## Success Metrics

- Users can successfully regenerate diagrams via chat
- Generated diagrams render without errors (< 5% failure rate)
- Average conversation turns to complete: < 3
- User satisfaction with generated diagrams (measure via feedback or regeneration frequency)

## Implementation Checklist

- [ ] Add `RegenerateArchitectureDiagramInput` schema to `tools.py`
- [ ] Add `_generate_mermaid_from_description()` helper function
- [ ] Add `_update_project_architecture()` helper function
- [ ] Add `regenerate_architecture_diagram` tool function
- [ ] Add tool to `PROJECT_TOOLS` list
- [ ] Add tool name to `TOOLS_NEEDING_STATE` in `agent.py`
- [ ] Update `SYSTEM_PROMPT` in `prompts.py` with tool docs and examples
- [ ] Create `test_regenerate_diagram.py` with unit tests
- [ ] Test end-to-end flow manually
- [ ] Update any relevant documentation
