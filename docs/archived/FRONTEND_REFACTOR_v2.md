# Frontend Refactor Plan: Neon Glass Redesign

**Status**: Phase 1 Complete (Foundation Established)
**Objective**: Refactor the entire application frontend to match the "Neon Glass" aesthetic: dark futuristic theme, neon accents, and glassmorphism.

## 🏗 Phase 1: Foundation (Completed)
- [x] **Tailwind Configuration**: Updated `tailwind.config.js` with:
  - Brand colors: `cyan`, `teal`, `neon-bright`, `pink-accent`.
  - Box shadows: `neon`, `glass`, `glow-teal`.
  - Animations: `float`, `pulse-slow`.
- [x] **Global CSS**: Updated `index.css` with:
  - Dark mode defaults.
  - Base typography (Inter).
  - Utility classes (`.glass-panel`, `.neon-border`, `.text-gradient`).
- [x] **Live Styleguide**: Updated `/styleguide` (StyleguideDemo.tsx) to showcase the new system.

## 🎨 Phase 2: Core Application Shell
**Goal**: Apply the new look to the main layout so navigation feels immersive immediately.
- [ ] **AppLayout Component**:
  - Apply deep navy background `#020617`.
  - Add ambient radial glows (fixed position).
  - Update background grid pattern.
- [ ] **Sidebar Navigation**:
  - Convert to `.glass-subtle`.
  - Update active states to use neon borders/glows.
  - Update icons to use stroke widths consistent with the "futuristic" vibe.
- [ ] **Top Header**:
  - Remove solid fills, replace with transparent/glass header.
  - Add "Luminous Dot" status indicators.

## 🧩 Phase 3: UI Component Library Refactor
**Goal**: ensure all reusable small components match the spec.
- [ ] **Buttons**: Replace all instances of old buttons with `.btn-primary` (neon gradient) and `.btn-secondary` (glass).
- [ ] **Inputs & Forms**:
  - Update all text inputs to `.input-glass` (no white backgrounds).
  - Add focus states with `shadow-neon`.
- [ ] **Cards & Containers**:
  - Refactor all content containers to use `.glass-card`.
  - Ensure padding is consistent (32-40px).
- [ ] **Modals**:
  - Update backdrop to dark blur.
  - Update modal content to `.glass-strong`.

## 📄 Phase 4: Page-by-Page Migration
**Goal**: Rollover specific feature pages.
1. **Auth Pages (Login/Signup)**
   - Add "Circuit Connector" accents.
   - Center glass card layout.
2. **Dashboard / Home**
   - Update stats cards to use "Neon Active" borders for emphasis.
   - Use radial gradients behind charts/graphs.
3. **Chat Interface**
   - Message bubbles: Glass for assistant, Neon Gradient for user.
   - Input area: Floating glass bar at bottom.

## 💅 Phase 5: Polish & Animations
- [ ] **Transitions**: Ensure page transitions use `fade-in` and `slide-in`.
- [ ] **Data Visualization**: Update chart colors to match Neon palette (Cyan/Teal/Pink).
- [ ] **Mobile Responsiveness**: Check glass blurs on mobile (simplify if performance drops).

## 📝 Design Tokens Reference
See `docs/NEON_GLASS_SPEC.md` for copy-pasteable classes and color codes.
