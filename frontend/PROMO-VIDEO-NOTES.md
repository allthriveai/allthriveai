# Promo Video Development Notes

## Overview
Creating a 30-second promotional video for AllThrive AI in 9:16 portrait aspect ratio (Instagram/TikTok format).

## Current Scene Structure

| Scene | Timing | Description |
|-------|--------|-------------|
| Hook | 0-4s | "Overwhelmed by AI tools?" → AllThrive logo |
| Battle | 4-12s | Shows how prompt battles work |
| Portfolio | 12-19s | Portfolio building features |
| Community | 19-25s | Community features |
| CTA | 25-30s | Sign up call to action |

## Files Modified

### Main Components
- `/frontend/src/components/promo/PromoVideo.tsx` - Main orchestrator
- `/frontend/src/components/promo/scenes/HookScene.tsx` - Opening hook
- `/frontend/src/components/promo/scenes/BattleScene.tsx` - Battle demo
- `/frontend/src/components/promo/scenes/PortfolioScene.tsx`
- `/frontend/src/components/promo/scenes/CommunityScene.tsx`
- `/frontend/src/components/promo/scenes/CTAScene.tsx`

## Completed Work

### HookScene (0-4s)
1. **3D rotating globe** of AI tool icons (using `react-icon-cloud` from homepage)
   - Memoized with `memo()` to prevent re-renders from parent elapsed updates
   - Slowed rotation speed: `maxSpeed: 0.03, minSpeed: 0.02`

2. **Fade-in words effect** instead of typewriter:
   ```
   Line 1: "Overwhelmed by how many"
   Line 2: "AI tools"
   Line 3: "are out there?"
   ```
   - Words fade in starting at 0.5s
   - Each word has 150ms delay between them

3. **Logo reveal timing**:
   - Globe starts converging at 2.4s
   - Logo appears at 3.0s, fully visible by 3.5s
   - "LET'S MAKE IT FUN" text appears above logo
   - Uses `/all-thrvie-logo.png` (not the blue version)

### PromoVideo.tsx
1. **Audio timing**: Music starts at 8 seconds into `promo.mp3`
2. **Click to play**: Timer doesn't start until user clicks play button
   - `isPlaying` starts as `false`
   - Needed for browser autoplay policy

### BattleScene (4-12s)
**Current timing:**
```typescript
const TIMING = {
  textBattle: 0,        // "BECOME A BETTER" appears
  textToLearn: 500,     // "PROMPT ENGINEER" slides in
  subtext: 1000,        // "through player vs player battles"
  player1: 1500,        // Player 1 avatar slides in
  vsBadge: 2000,        // VS badge slams in
  player2: 2500,        // Player 2 avatar slides in
  showPrompt: 3000,     // Challenge/prompt card appears
  showImages: 4500,     // Generated images appear
  winner: 6000,         // Winner revealed with crown
  xpReward: 7000,       // XP reward badge flies up
};
```

**Flow order** (user requested):
1. Two circle avatars in VS layout
2. Prompt/challenge description card
3. THEN show the generated images
4. Winner announcement

**Images used:**
- Player avatars: Currently using promo images (NEEDS FIX - see pending)
- Generated images: `/promo-nanobanana.png` and `/promo-nanobanana-2.png`

## Pending Work

### HIGH PRIORITY: Battle Avatar Bug
**Problem**: The avatar circles in the battle VS screen are showing AI-generated images instead of user profile photos.

**Screenshot shows**: The circles contain landscape/nature images instead of faces.

**Solution needed**:
- Add placeholder avatar images for fake users
- Options:
  1. Use pravatar.cc: `https://i.pravatar.cc/150?u=player1`
  2. Add local images: `/public/avatar-1.png`, `/public/avatar-2.png`
- Update BattleScene.tsx to use these for avatars

### Marketing Strategy Discussion (Paused)
User expressed uncertainty about marketing approach. Key questions raised:

1. **Who is the target audience?**
   - People who use AI tools and want to improve?
   - People curious about AI but haven't started?
   - People who like games/competition?

2. **What emotion to convey?**
   - "This looks fun, I want to play"
   - "This will help me get ahead"
   - "My friends are doing this"

3. **Current concern**: Video may be too information-focused, not enough feeling/hook
   - Currently explains mechanics (how battles work)
   - Might need more energy/emotion to drive signups

4. **Alternative approaches discussed**:
   - **Option A: Pure Energy** - Fast cuts, wins, celebrations, no explanation
   - **Option B: Social Proof** - Show "real" users reacting, winning
   - **Option C: Single Story** - Follow one battle emotionally

## How to Preview
1. Start frontend: `cd frontend && npm run dev -- --port 3000`
2. Navigate to: `http://localhost:3000/promo`
3. Click play button to start

## Dev Controls
- Play/Pause button at bottom
- Timer shows `{seconds}s / {scene_name}`
- Restart button to replay from beginning

## Technical Notes

### Preventing Canvas Re-renders
The 3D globe uses canvas which was flickering during playback. Fixed by:
```tsx
const MemoizedIconCloud = memo(function MemoizedIconCloud({ iconData }) {
  // Component code
});
```
And using CSS transforms instead of React state for scale/opacity changes.

### Scene Timing Architecture
- Each scene has `TIMING` constants for internal breakpoints
- `elapsed` prop = time since scene started (not total video time)
- `progress` prop = 0-1 progress through scene (sometimes unused)

## Next Steps
1. Fix avatar images in BattleScene (use placeholder faces)
2. Decide on marketing direction (energy vs information)
3. Review Portfolio, Community, CTA scenes
4. Final timing adjustments
5. Export/record final video
