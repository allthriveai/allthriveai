# Plan: Convert All Navigation Pills to Load Content Inline

## Goal
Change all feeling pills that currently navigate away to instead load content inline in the chat. User stays on home page, content appears as Ava's response.

## Current Pills (8 total)

| Pill | Current Behavior | Change Needed |
|------|------------------|---------------|
| share | Sends message ✓ | None |
| **play** | Navigates to `/play/games` | → Send message, load game inline |
| **challenge** | Navigates to `/challenge` | → Send message, load challenge teaser inline |
| learn | Sends message ✓ | None |
| marketplace | Sends message ✓ | None |
| **explore** | Navigates to `/explore?tab=trending` | → Send message, load trending content inline |
| **connect** | Navigates to `/thrive-circle` | → Send message, load connections inline |
| personalize | Sends message ✓ | None |

## Implementation

### File to Modify
`/frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx`

### Changes to FEELING_OPTIONS array (lines 33-82)

**1. Play a game** - Change from `navigateTo` to `message`:
```typescript
{
  id: 'play',
  label: 'Play a game',
  signupFeatures: ['battles'],
  message: 'I want to play a game',  // Was: navigateTo: '/play/games'
}
```

**2. See this week's challenge** - Change from `navigateTo` to `message`:
```typescript
{
  id: 'challenge',
  label: "See this week's challenge",
  signupFeatures: ['challenges'],
  message: "Show me this week's challenge",  // Was: navigateTo: '/challenge'
}
```

**3. Explore what others are making** - Change from `navigateTo` to `message`:
```typescript
{
  id: 'explore',
  label: 'Explore what others are making',
  signupFeatures: ['community'],
  message: 'Show me what others are making',  // Was: navigateTo: '/explore?tab=trending'
}
```

**4. Connect with others** - Change from `navigateTo` to `message`:
```typescript
{
  id: 'connect',
  label: 'Connect with others',
  signupFeatures: ['community'],
  message: 'Help me connect with others in my Thrive Circle',  // Was: navigateTo: '/thrive-circle'
}
```

## How Each Will Work

### Play a game
- Ava uses `launch_inline_game` tool with `game_type: 'random'`
- `ChatGameCard` component renders inline (Context Snake or Quick Quiz)
- **Already working** - infrastructure exists

### Challenge (needs backend tool)
- Ava uses `get_weekly_challenge` tool (may need to create)
- Returns challenge data + "See all challenges" link
- Display with `CircleChallengeCard` component inline

### Explore (needs backend tool)
- Ava uses `get_trending_content` tool (may need to create)
- Returns 3-5 trending projects as `LearningTeaserCard` carousel
- Include "Explore more" link to `/explore`

### Connect (needs backend tool)
- Ava uses `get_circle_suggestions` tool (may need to create)
- Returns suggested connections or circle members
- Display with `CircleMemberCard` component inline

## Existing Infrastructure
- `ChatGameCard` - ✅ Ready for play
- `LearningTeaserCard` - ✅ Ready for explore/trending
- `CircleChallengeCard` - Available, needs message wrapper
- `CircleMemberCard` - Available, needs message wrapper

## Implementation Order
1. **Phase 1**: Change all 4 pills from `navigateTo` to `message` (frontend only)
2. **Phase 2**: Verify play/game works (already has backend support)
3. **Phase 3**: Add backend tools + message components for challenge, explore, connect

## Files to Modify
- `/frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx` - Change pill actions
- `/services/agents/` - Add tools for challenge, explore, connect (if needed)
- `/frontend/src/components/chat/messages/` - Add message wrappers for new content types
