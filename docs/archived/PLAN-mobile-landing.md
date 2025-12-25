# Mobile Landing Page Plan

## Overview
Make the UnifiedLanding parallax page work well on mobile by:
1. **Disabling parallax** on mobile - use normal vertical scroll
2. **Stacking content vertically** - show chat/visuals below each section

## Implementation Steps

### 1. Add mobile detection hook
- Use `useMediaQuery` or window width check to detect mobile (`< lg` / 1024px)
- Store in a `isMobile` state variable

### 2. Disable parallax on mobile
**Changes to container:**
- Desktop: Keep `500vh` height with sticky container and transform
- Mobile: Use `auto` height with normal scroll (no sticky, no transform)

```tsx
// Desktop: parallax enabled
<div style={{ height: '500vh' }}>
  <div className="sticky top-0 h-screen">
    <motion.div style={{ y: transform }}>

// Mobile: normal scroll
<div style={{ height: 'auto' }}>
  <div> {/* no sticky */}
    <div> {/* no transform */}
```

### 3. Stack content vertically on mobile
**Current structure (desktop):**
```
[Left Content] [Right Panel]
     60%           40%
```

**New structure (mobile):**
```
[Hero Section]
[Icon Cloud] ← moved from right

[Learn Section]
[Chat Messages for Learn] ← moved from right

[Share Section]
[Chat Messages for Share] ← moved from right

[See Section]
[Chat Messages for See] ← moved from right

[Connect Section]
[Prompt Battle Promo] ← moved from right
```

### 4. Fix text sizes for mobile
- Hero H1: Add `text-4xl` base before `sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl`
- Feature H2: Add `text-3xl` base before `sm:text-4xl lg:text-5xl`
- Subtitle: Add `text-lg` base before `sm:text-xl lg:text-2xl`

### 5. Component changes needed

**HeroSection (mobile):**
- Smaller text
- Show icon cloud below the CTA button (not to the side)

**FeatureContent (mobile):**
- Full width
- Chat messages appear directly below the feature description
- No sticky behavior

**EmberChatPanel:**
- Create a simplified mobile version without the full panel chrome
- Just show the chat bubbles inline

**Right panel elements:**
- Icon cloud: Show after hero on mobile
- Chat messages: Show after each section on mobile
- Prompt battle promo: Show after connect section on mobile

### 6. Conditional rendering approach

```tsx
const isMobile = useMediaQuery('(max-width: 1023px)');

return (
  <div style={{ height: isMobile ? 'auto' : '500vh' }}>
    {isMobile ? (
      // Mobile layout - stacked, no parallax
      <MobileLayout />
    ) : (
      // Desktop layout - side by side, parallax
      <DesktopLayout />
    )}
  </div>
);
```

### 7. Mobile-specific sections

For each section on mobile, render:
1. The section content (icon, title, description, visuals)
2. The corresponding chat messages (simplified, no panel chrome)

### 8. Files to modify

1. **UnifiedLanding.tsx** - Main changes:
   - Add `isMobile` detection
   - Conditional container height
   - Conditional parallax behavior
   - Mobile layout variant

2. **New components to extract (optional but cleaner):**
   - `MobileLandingLayout.tsx` - mobile-specific layout
   - `MobileChatSection.tsx` - inline chat bubbles for mobile

### 9. Testing checklist
- [ ] iPhone SE (375px) - smallest common phone
- [ ] iPhone 12/13/14 (390px) - most common
- [ ] iPhone Plus/Max (428px) - larger phones
- [ ] iPad (768px) - tablet portrait
- [ ] iPad landscape (1024px) - breakpoint edge
- [ ] Desktop (1440px) - verify no regression

## Summary
- Mobile: Normal scroll, stacked layout, all content visible
- Desktop: Parallax scroll, side-by-side layout, interactive chat panel
