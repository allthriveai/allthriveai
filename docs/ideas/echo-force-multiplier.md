# Echo: Social Media Coach & Content Visualizer

## Vision

Transform the Content Engine into **Echo's Workspace** - a chat-first creative hub where Echo is your social media coach and content strategist.

**Echo's role:**
- **Social Media Coach** - Strategic content partner (SAHR framework, hooks, platform expertise)
- **Content Visualizer** - Turn ideas into visual posts (future: Remotion integration)

**Core principles:**
- **Chat-first** - Everything flows through conversation with Echo
- **Minimal tools** - Few, powerful tools rather than many specialized ones
- **Content-focused** - Brainstorming, strategy, and creation
- **Platform expertise** - LinkedIn, Twitter, YouTube best practices

Echo remains a **separate agent from Ava** - positioned as a social media coaching companion.

---

## Implementation Status

### Completed
- [x] Phase 1: Echo Profile & Onboarding
  - `core/echo/models.py` - EchoProfile, EchoConversation, EchoMessage
  - Onboarding flow: intro → goals → platforms → topics → complete

- [x] Phase 2: Echo Agent Tools
  - `services/agents/echo/tools.py` - save_idea, strategy, manage_idea, get_context
  - `services/agents/echo/prompts.py` - SAHR coaching prompts

- [x] Phase 3: Echo Workspace UI
  - `frontend/src/pages/EchoWorkspace.tsx` - Main workspace
  - `frontend/src/components/echo/EchoChat.tsx` - Chat interface
  - `frontend/src/hooks/useEchoChat.ts` - WebSocket chat hook
  - `frontend/src/hooks/useEchoProfile.ts` - Profile management

### Pending
- [ ] Phase 4: Remotion Integration (future)
  - `create_post` tool - Generate LinkedIn post from idea
  - `render_post` tool - Remotion → MP4/GIF

---

## Echo's Tool Set

| Tool | Purpose |
|------|---------|
| `save_idea` | Save content ideas to idea bank |
| `manage_idea` | Update/archive existing ideas |
| `strategy` | Get/update content strategy |
| `get_context` | Fetch ideas, profile, brand voice |
| `save_onboarding_response` | Save onboarding choices |

### Future (Remotion)
| Tool | Purpose |
|------|---------|
| `create_post` | Generate LinkedIn post from idea |
| `render_post` | Remotion → MP4/GIF |

---

## Data Models

- **EchoProfile** - Onboarding state, goals, platforms, content pillars
- **EchoConversation** - Chat history persistence
- **EchoMessage** - Individual messages with quick_select and inline_cards

---

## Onboarding Flow (4 Steps)

1. **Intro** - What Echo can do
2. **Goals** - What are you trying to achieve
3. **Platforms** - Where do you create (Twitter, LinkedIn, YouTube)
4. **Topics** - Content pillars/themes

---

## Key Features

### SAHR Framework
Echo uses the SAHR brainstorming framework:
- **Scope** - Define topic, audience, outcome
- **Angle** - Find the unique perspective
- **Hook** - Create attention-grabbing openers
- **Resonate** - Expand into full content

### Platform Expertise
- **LinkedIn** - Storytelling, 1300 char optimal, Mon/Wed/Fri 8-9am
- **Twitter/X** - Punchy hooks, threads, high volume
- **YouTube** - SEO titles, retention hooks, thumbnail thinking

### Hook Types
- Pattern interrupt
- Curiosity gap
- Relatable pain
- Bold claim

---

## Architecture Note

Personal assistant functionality (tasks, Asana integration) will be handled by **Clawdbot** - a separate agent focused on productivity and task management.
