# Echo Agent E2E Bugfixes

## Problem

The Echo agent (content brainstorming coach) has several integration bugs preventing it from working end-to-end:

1. **idea_suggested event field mismatch** - Frontend expects `data.output` but backend sends `data.idea`
2. **Content pillars/platforms not passed to agent** - UI tracks selection but never sends to WebSocket
3. **Conversation history not loaded** - Echo can't maintain context across messages
4. **Session ID regenerates on mount** - Loses conversation context on navigation

## Solution

Fix the integration bugs between frontend WebSocket hook, backend task routing, and Echo agent.

## User Stories

- As a creator, I want Echo to remember our conversation context so I don't have to repeat myself
- As a creator, I want my selected content pillar to influence Echo's suggestions
- As a creator, I want to save ideas that Echo suggests directly from the chat

## Scope

### In Scope

- Fix `idea_suggested` event field mapping in `useEchoChat.ts`
- Pass `activePillar` and `activePlatforms` through WebSocket message
- Load and pass conversation history to `stream_echo_response()`
- Persist session ID across navigation (optional - depends on desired UX)

### Out of Scope

- New Echo features or prompts
- Changes to the LangGraph agent structure
- Database schema changes
- New UI components

## Architecture

### Directory Structure

Files to modify:
- `frontend/src/hooks/useEchoChat.ts` - Fix event mapping, add context params
- `frontend/src/components/content-engine/chat/BrainstormChatPanel.tsx` - Pass pillar/platform context
- `core/agents/tasks.py` - Load and pass conversation history to Echo

### Patterns to Follow

- WebSocket messages use **snake_case** (bypass axios interceptor)
- Follow existing `_process_with_ava()` pattern for conversation history loading
- Match existing event handling patterns in `useEchoChat.ts`

### Do NOT Create

- No new files needed - all fixes are in existing files
- No new API endpoints
- No new models or migrations

## Technical Notes

### Event Field Mismatch

Backend (`tasks.py:994-1005`):
```python
await async_channel_layer.group_send(
    channel_name,
    {
        'event': 'idea_suggested',
        'idea': event.get('idea', {}),  # Uses 'idea'
    },
)
```

Frontend expects (`useEchoChat.ts:232`):
```typescript
if (data.output) {  // Expects 'output'
```

### WebSocket Message Format

Current message sent:
```json
{ "message": "Help me brainstorm content about RAG" }
```

Should include context:
```json
{
  "message": "Help me brainstorm content about RAG",
  "pillar_id": 123,
  "platforms": ["twitter", "linkedin"]
}
```

### Conversation History

`stream_echo_response()` already accepts `conversation_history` parameter but it's not being passed from `_process_with_echo()`.

## Open Questions

- Should session ID persist in localStorage or regenerate per visit?
- Should conversation history be loaded from Redis cache or database?
