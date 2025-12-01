# Style Guide 2.0: Neon Cyberpunk Thriving

This document outlines the design system for the "Neon Cyberpunk Thriving" aesthetic. The goal is to merge high-tech futuristic visuals (neon, holographic, glassmorphism) with organic, community-centric vibes (greens, teals, thriving).

## Core Aesthetic Philosophy

*   **Visual Theme**: "Organic Cyberpunk" / "Bio-Digital"
*   **Key Emotions**: Thriving, Futuristic, Connected, Energetic.
*   **Metaphor**: The digital world growing like a lush, neon jungle. Inorganic structures (glass, holograms) infused with organic life (flowing gradients, teal/green hues).

## Color Palette

### Primary Neons (The "Thriving" Glow)
These colors are used for text, borders, icons, and glow effects. They should feel luminous against dark backgrounds.

*   **Neon Teal**: `#00FFA3` (Primary accent, high energy)
*   **Cyber Cyan**: `#00F0FF` (Secondary accent, cool tech)
*   **Bio Green**: `#39FF14` (Organic growth, energetic)
*   **Electric Purple**: `#BC13FE` (Holographic accent, use sparingly)

### Backgrounds (The "Void" & "Glass")
*   **Deep Void**: `#05070A` (Darker than current brand.dark, nearly black)
*   **Obsidian**: `#0F1115` (Card backgrounds)
*   **Glass Dark**: `rgba(8, 11, 18, 0.7)` (Backdrop for glassmorphism in dark mode)
*   **Glass Light**: `rgba(255, 255, 255, 0.1)` (Highlight layers)

### Holographic Gradients
Iridescent gradients to mimic holograms.
*   **Holo Surface**: `linear-gradient(135deg, rgba(0, 240, 255, 0.1), rgba(188, 19, 254, 0.1), rgba(0, 255, 163, 0.1))`
*   **Neon Flow**: `linear-gradient(to right, #00FFA3, #00F0FF)`

## Design Elements

### 1. Advanced Glassmorphism ("Hyper-Glass")
Unlike standard glassmorphism, Cyberpunk Glass features:
*   **Neon Borders**: 1px solid borders with reduced opacity or gradient borders.
*   **Inner Glow**: Subtle inner shadow to give depth.
*   **Blur**: Heavy backdrop blur (`backdrop-filter: blur(16px)`).
*   **Noise**: Subtle grain texture overlay to feel tactile/retro-futuristic.

**CSS Concept:**
```css
.hyper-glass {
  background: rgba(15, 17, 21, 0.6);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 255, 163, 0.2); /* Neon Teal Border */
  box-shadow: 
    0 4px 30px rgba(0, 0, 0, 0.5),
    inset 0 0 20px rgba(0, 255, 163, 0.05); /* Inner Glow */
}
```

### 2. Neon Glow Effects
Objects should feel like they emit light.
*   **Text Glow**: `text-shadow: 0 0 10px rgba(0, 255, 163, 0.5)`
*   **Box Glow**: `box-shadow: 0 0 20px rgba(0, 240, 255, 0.3)`

### 3. Holographic UI Components
*   **Cards**: Dark glass with a subtle holographic sheen that shifts on hover.
*   **Buttons**: "Laser" borders or filled neon gradients.

### 4. Organic/Inorganic Melding
*   **Mesh Gradients**: Backgrounds should feature slow-moving, organic blobs of green/teal mixing with deep blues/purples.
*   **Data Visualizations**: Graphs and charts that look like biological readings or futuristic HUDs.

## Light & Dark Mode Strategy

The aesthetic must work in both, but "Neon Cyberpunk" naturally shines in dark mode.

*   **Dark Mode (Default)**: Deep backgrounds, bright neon accents. The "True" cyberpunk experience.
*   **Light Mode**: "Clean Future" aesthetic.
    *   Backgrounds: Very pale teal/grey (`#F0F4F8`).
    *   Glass: White frosted glass with teal borders.
    *   Accents: Darker teal/green for readability (`#008A9F`), keeping neon only for subtle highlights.

## Typography
*   **Headings**: Bold, sans-serif, wide tracking. Optional: glitch effects on hover.
*   **Body**: Clean, high-legibility sans-serif (Inter or similar).
*   **Data/Code**: Monospaced font (JetBrains Mono or similar) in cyan/green.

## Implementation Plan

1.  **Update Tailwind Config**:
    *   Add new neon color palette.
    *   Add custom `box-shadow` utilities for glows.
    *   Add `backgroundImage` utilities for holographic gradients.
2.  **Create Base Components**:
    *   `NeonCard`: The standard container.
    *   `HoloButton`: Primary action button.
    *   `GlowingText`: For headings.
3.  **Global Styles**:
    *   Add noise texture overlay (optional).
    *   Set up mesh gradient background animation.

## Example Usage

```tsx
// A thriving community card
<div className="hyper-glass rounded-xl p-6 hover:border-brand-teal/50 transition-all duration-300 group">
  <h3 className="text-xl font-bold text-white group-hover:text-brand-neon-teal drop-shadow-glow">
    Community Growth
  </h3>
  <div className="mt-4 h-2 bg-brand-dark rounded-full overflow-hidden">
    <div className="h-full w-3/4 bg-gradient-to-r from-brand-teal to-brand-neon-green shadow-[0_0_10px_rgba(0,255,163,0.5)]" />
  </div>
</div>
```
