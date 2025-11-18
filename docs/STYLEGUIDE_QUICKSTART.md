# Styleguide Implementation - Quick Start

## 🎉 What Was Built

A complete glassmorphism design system inspired by Devin.ai and Synapse AI with:
- ✅ Global CSS classes for light/dark themes
- ✅ 3 levels of glassmorphism effects
- ✅ Comprehensive component library
- ✅ Full TypeScript support
- ✅ Accessibility features built-in
- ✅ Animation system
- ✅ Responsive layout system

---

## 📁 Files Created/Updated

### Updated Files
1. **`/frontend/tailwind.config.js`**
   - Added `darkMode: 'class'` configuration
   - New color palette (Primary Indigo, Accent Purple)
   - Glassmorphism shadows and backdrop-blur utilities
   - Animation keyframes (fade-in, slide-in, scale-in)
   - Custom z-index values

2. **`/frontend/src/index.css`**
   - Complete glassmorphism component library
   - Global CSS classes for all UI elements
   - Light/dark theme support via `.dark` class
   - Typography system with Inter font
   - Layout components (nav-sidebar, context-tray, content-container)
   - All component classes (buttons, cards, forms, badges, etc.)

### New Files
1. **`/docs/STYLEGUIDE.md`**
   - Complete documentation of all classes
   - Usage examples for every component
   - Code snippets in TypeScript/React
   - Color reference guide
   - Accessibility guidelines

2. **`/frontend/src/components/StyleguideDemo.tsx`**
   - Interactive demo component
   - Shows all design system elements
   - Live light/dark theme toggle
   - Copy-paste ready examples

---

## 🚀 How to Use

### 1. Enable Dark Mode

```typescript
// Add 'dark' class to enable dark mode
document.documentElement.classList.add('dark');

// Remove to switch back to light mode
document.documentElement.classList.remove('dark');
```

### 2. Use Global Classes

All classes are available globally. Just add them to your components:

```tsx
// Glassmorphism card
<div className="card">
  <h3>Title</h3>
  <p className="text-muted">Description</p>
</div>

// Primary button
<button className="btn-primary">
  Click Me
</button>

// Navigation link
<a href="/dashboard" className="nav-link-active">
  Dashboard
</a>
```

### 3. View the Demo

Import and use the demo component:

```tsx
import StyleguideDemo from './components/StyleguideDemo';

function App() {
  return <StyleguideDemo />;
}
```

---

## 🎨 Key Classes Reference

### Glassmorphism
- `.glass-subtle` - 50-60% opacity (navigation, background)
- `.glass` - 70% opacity (content cards, modals)
- `.glass-strong` - 85-90% opacity (overlays, chat panels)
- `.glass-hover` - Enhanced glass on hover with lift

### Layout
- `.nav-sidebar` - Fixed left navigation (240-280px)
- `.context-tray` - Fixed right chat panel (320-400px)
- `.content-container` - Main content area (max-w-7xl)

### Cards
- `.card` - Standard glass card
- `.card-hover` - Card with hover effect
- `.card-solid` - Solid card for text-heavy content

### Buttons
- `.btn-primary` - Main CTA (indigo)
- `.btn-secondary` - Glass secondary button
- `.btn-outline` - Transparent with border
- `.btn-ghost` - Minimal button
- `.btn-sm` / `.btn-lg` - Size variants

### Forms
- `.input` - Standard input field
- `.textarea` - Text area
- `.label` - Form label
- `.input-error` / `.input-success` - State modifiers

### Typography
- `.text-gradient` - Primary to accent gradient
- `.text-muted` - Secondary text color
- `.text-body` - Optimal body text
- `.link` - Styled link

### Navigation
- `.nav-link` - Standard nav item
- `.nav-link-active` - Active nav item

### Badges
- `.badge-primary`, `.badge-success`, `.badge-warning`, `.badge-error`, `.badge-info`

### Loading
- `.spinner` - Animated loading spinner
- `.skeleton` - Skeleton loader

### Modals
- `.backdrop` - Modal backdrop overlay
- `.modal` - Modal container

---

## 🌈 Color System

### Primary Colors
- **Light mode**: `primary-500` (#6366f1)
- **Dark mode**: `primary-400` (brighter for contrast)

### Theme Colors
```tsx
// Primary (Indigo)
className="bg-primary-500 text-primary-600"

// Accent (Purple)
className="bg-accent-500 text-accent-600"

// Semantic
className="bg-success-500" // Emerald
className="bg-warning-500" // Amber
className="bg-error-500"   // Rose
className="bg-info-500"    // Sky
```

---

## 🎭 Theme Toggle Implementation

```typescript
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check system preference on mount
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <button onClick={toggleTheme} className="btn-ghost">
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
```

---

## 📐 Layout Example

```tsx
<div className="min-h-screen">
  {/* Left Navigation */}
  <nav className="nav-sidebar p-6">
    <h1 className="text-xl font-bold mb-8">All Thrive AI</h1>
    <div className="space-y-2">
      <a href="/" className="nav-link-active">Home</a>
      <a href="/explore" className="nav-link">Explore</a>
    </div>
  </nav>
  
  {/* Main Content */}
  <main className="ml-72 content-container">
    <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
    <div className="grid grid-cols-3 gap-6">
      <div className="card-hover">
        <h3>Project 1</h3>
      </div>
    </div>
  </main>
  
  {/* Right Chat Tray */}
  <aside className="context-tray p-6">
    <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
    {/* Chat interface */}
  </aside>
</div>
```

---

## ✨ Animations

All animations respect `prefers-reduced-motion`:

```tsx
// Fade in
<div className="animate-fade-in">Content</div>

// Slide from right
<aside className="animate-slide-in-right">Panel</aside>

// Scale in
<div className="animate-scale-in">Modal</div>

// Stagger children
<ul className="stagger-children">
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>
```

---

## 📱 Responsive Behavior

The system is mobile-first and fully responsive:

- **Desktop (1280px+)**: All 3 columns visible
- **Tablet (768-1280px)**: Left nav collapses to icons, right tray is overlay
- **Mobile (<768px)**: Both sidebars hidden, accessible via menu/chat buttons

Use Tailwind's responsive prefixes:
```tsx
<div className="hidden lg:block">Desktop only</div>
<div className="block lg:hidden">Mobile only</div>
```

---

## 🔧 Customization

### Override Theme Colors

Edit `/frontend/tailwind.config.js`:

```javascript
colors: {
  primary: {
    500: '#YOUR_COLOR', // Change primary color
  },
  // ... other customizations
}
```

### Add Custom Glass Effect

Edit `/frontend/src/index.css`:

```css
.glass-custom {
  @apply bg-white/60 backdrop-blur-md;
  @apply border border-white/25;
  @apply shadow-lg;
}
```

---

## 📚 Full Documentation

See [`/docs/STYLEGUIDE.md`](./STYLEGUIDE.md) for:
- Detailed class documentation
- Complete usage examples
- Color reference
- Accessibility guidelines
- Best practices

---

## 🎯 Next Steps

1. **View the demo**: Import `StyleguideDemo` component
2. **Test dark mode**: Toggle and verify all components work
3. **Build components**: Use global classes to build your UI
4. **Customize**: Adjust colors/spacing in Tailwind config
5. **Scale**: All classes are production-ready

---

## 🤝 Contributing

When adding new components:
1. Follow glassmorphism principles from the design doc
2. Ensure light/dark theme support
3. Add responsive behavior
4. Include hover/focus states
5. Document in STYLEGUIDE.md

---

**Built with**: Tailwind CSS, TypeScript, React  
**Inspired by**: Devin.ai, Synapse AI, Linear, Cursor  
**Version**: 1.0
