# Ava Guided Platform Walkthrough - Implementation Plan

## Overview

Add a **4th adventure option** to the Ava onboarding "Choose Your Adventure" modal: a **Guided Platform Walkthrough** where Ava navigates users through actual platform pages with modal overlays explaining each feature.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Reusable tour system | Extensible for future tours, maintainable |
| Navigation | Navigate to actual pages | More engaging, users see real platform |
| UI | Modal overlay on each page | Consistent with Ava patterns, lets personality shine |
| Completion | Counts as 1 of 4 adventures | Integrated with existing quest system |
| Persistence | localStorage with resume | Users can continue if they leave mid-tour |
| Skip | Always visible | User can exit anytime |

## Tour Content (8 Steps)

| Step | Page | Ava Dialogue Theme |
|------|------|---------------------|
| 1 | Current | Welcome, let me show you around! |
| 2 | `/:username` | Your profile - your AI portfolio home base |
| 3 | `/:username` | Projects showcase your AI creations |
| 4 | `/explore` | Discover tools, projects, and creators |
| 5 | `/battles` | Test your prompting skills competitively |
| 6 | Current + panel | Your AI assistant for help anytime |
| 7 | `/onboarding` | Quest Board to track your progress |
| 8 | Current | Tour complete! Ready to thrive |

## Architecture

### New Files to Create

```
frontend/src/
├── tours/
│   ├── types.ts                    # Tour type definitions
│   ├── platformWalkthrough.ts      # Tour step definitions + Ava dialogue
│   └── index.ts                    # Export tours by ID
├── hooks/
│   └── useTour.ts                  # Tour state management + persistence
├── context/
│   └── TourContext.tsx             # Global tour provider
└── components/
    └── tour/
        ├── TourProvider.tsx        # Provider + modal rendering
        ├── TourModal.tsx           # Modal overlay with Ava
        ├── TourProgress.tsx        # Progress indicator (dots/bar)
        └── index.ts                # Exports
```

### Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/hooks/useAvaOnboarding.ts` | Add `'platform_tour'` to `AdventureId` type |
| `frontend/src/components/onboarding/AvaOnboardingModal.tsx` | Add 4th adventure option, trigger tour on selection |
| `frontend/src/components/onboarding/AvaAdventureBanner.tsx` | Add platform_tour to banner adventures |
| `frontend/src/components/layouts/DashboardLayout.tsx` | Wrap with `TourProvider` |
| `frontend/src/App.tsx` or router | Potentially add tour provider at app level |

## Implementation Phases

### Phase 1: Foundation (Types & Definitions)

**1.1 Create tour types** (`/frontend/src/tours/types.ts`)
```typescript
export type TourId = 'platform_walkthrough';

export interface TourStep {
  id: string;
  targetPath?: string;        // Page to navigate to
  title: string;
  dialogue: string | string[]; // Ava's words (typewriter)
  features?: string[];         // Bullet points to show
  showDelay?: number;          // Wait after nav (ms)
}

export interface TourDefinition {
  id: TourId;
  title: string;
  description: string;
  steps: TourStep[];
  adventureId: AdventureId;    // Links to onboarding system
}

export interface TourState {
  tourId: TourId | null;
  currentStepIndex: number;
  isActive: boolean;
  completedTours: TourId[];
}
```

**1.2 Create platform walkthrough definition** (`/frontend/src/tours/platformWalkthrough.ts`)
- Define all 8 steps with targetPath, dialogue, features
- Write Ava's personality-driven dialogue for each step

### Phase 2: Tour Engine (State & Logic)

**2.1 Create useTour hook** (`/frontend/src/hooks/useTour.ts`)
- State: `isActive`, `currentStep`, `currentStepIndex`, `progress`
- Actions: `startTour()`, `nextStep()`, `previousStep()`, `skipTour()`, `completeTour()`
- localStorage persistence keyed by userId (follow `useAvaOnboarding` pattern)
- Navigate via `useNavigate()` when step has `targetPath`

**2.2 Create TourContext** (`/frontend/src/context/TourContext.tsx`)
- Follow `TopicTrayContext.tsx` pattern
- Provider wraps children + renders TourModal
- Safe hook for optional access: `useTourContextSafe()`

### Phase 3: Tour UI Components

**3.1 Create TourModal** (`/frontend/src/components/tour/TourModal.tsx`)
- Full-screen semi-transparent overlay
- Glass card modal (follow `AvaOnboardingModal` styling)
- Ava avatar with dialogue bubble (typewriter effect)
- Step content: title, features list
- Navigation: Back / Next buttons
- Skip button always visible (top-right)
- Progress indicator

**3.2 Create TourProgress** (`/frontend/src/components/tour/TourProgress.tsx`)
- Dot indicators or progress bar
- "Step X of Y" text

**3.3 Create TourProvider** (`/frontend/src/components/tour/TourProvider.tsx`)
- Combines context provider with TourModal rendering
- Handles tour completion → marks adventure complete

### Phase 4: Integration

**4.1 Update adventure types** (`useAvaOnboarding.ts`)
```typescript
export type AdventureId = 'battle_pip' | 'add_project' | 'explore' | 'personalize' | 'platform_tour';
```

**4.2 Add 4th adventure to modal** (`AvaOnboardingModal.tsx`)
```typescript
{
  id: 'platform_tour',
  title: 'Platform Tour',
  description: "Let Ava show you around AllThrive.",
  icon: faMap,
  gradient: 'from-emerald-500 to-teal-500',
  path: '', // Special handling - starts tour
}
```
- In `handleSelectAdventure`: if `platform_tour`, call `startTour('platform_walkthrough')` instead of navigating

**4.3 Add to banner** (`AvaAdventureBanner.tsx`)
- Add platform_tour adventure option to banner array

**4.4 Add TourProvider to layout** (`DashboardLayout.tsx`)
- Import TourProvider
- Wrap layout content (similar to how AvaOnboardingProvider is used)

### Phase 5: Polish & Edge Cases

- Page load timing: Add `showDelay` to steps after navigation
- Handle tour completion: Call `completeAdventure('platform_tour')` from onboarding hook
- Mobile responsiveness: Ensure modal works on small screens
- Accessibility: Keyboard navigation, focus management
- Analytics: Track tour start, completion, and drop-off points

## Critical Files to Read Before Implementation

1. `/frontend/src/hooks/useAvaOnboarding.ts` - Pattern for state + localStorage
2. `/frontend/src/components/onboarding/AvaOnboardingModal.tsx` - Modal styling, adventure structure
3. `/frontend/src/context/TopicTrayContext.tsx` - Context provider pattern
4. `/frontend/src/hooks/useTypewriter.ts` - Typewriter effect for Ava dialogue
5. `/frontend/src/components/onboarding/AvaAdventureBanner.tsx` - Banner integration

## State Flow

```
User selects "Platform Tour" in Step 2
    ↓
startTour('platform_walkthrough') called
    ↓
TourContext sets isActive=true, step=0
    ↓
TourModal renders over current page
    ↓
User clicks "Next" → nextStep()
    ↓
If step has targetPath → navigate() then show modal
    ↓
Repeat until final step
    ↓
completeTour() → marks 'platform_tour' adventure complete
    ↓
Tour closes, user continues exploring
```

## Ava Dialogue Guidelines

- **Personality**: Friendly, enthusiastic, slightly playful dragon guide
- **Length**: 1-3 sentences per step, concise but warm
- **Typewriter effect**: Makes dialogue feel conversational
- **Examples**:
  - "This is your profile - your AI portfolio home base! Show off what you've built."
  - "Prompt Battles are my favorite! Compete against others and see who can craft the best prompts."
  - "That's the tour! You're officially ready to start thriving. I'm always here if you need me!"
