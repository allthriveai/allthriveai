# All Thrive AI - Styleguide Reference

> Complete reference for using the All Thrive AI design system with glassmorphism, light/dark themes, and global CSS classes.

---

## 🎨 Design Philosophy

All Thrive AI uses a **glassmorphism-first** approach inspired by modern AI tools like Devin.ai and Synapse AI. The interface feels like floating in space with layered glass panels that create depth and sophistication.

### Key Principles
- **Glassmorphism as Foundation**: Semi-transparent panels with backdrop blur
- **Depth Through Layers**: Multiple glass panels stack with progressive opacity
- **Light as Air, Dark as Deep Space**: Seamless theme switching
- **Subtle Not Loud**: Muted, sophisticated colors
- **AI-Native Aesthetics**: Clean, minimal, intelligent

---

## 🌓 Theme System

### Enabling Dark Mode

The design system uses Tailwind's `class` strategy for dark mode. Add the `dark` class to the root element:

```typescript
// Example: Dark mode toggle
const [isDark, setIsDark] = useState(false);

useEffect(() => {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, [isDark]);
```

### Theme Colors

#### Primary (Indigo)
- **Light mode**: `primary-500` (#6366f1)
- **Dark mode**: `primary-400` (brighter)
- **Usage**: CTAs, links, active states

#### Accent (Purple)
- **Range**: `accent-500` to `accent-600`
- **Usage**: Gradients, highlights

#### Semantic Colors
- **Success**: `success-500` (Emerald #10b981)
- **Warning**: `warning-500` (Amber #f59e0b)
- **Error**: `error-500` (Rose #f43f5e)
- **Info**: `info-500` (Sky #0ea5e9)

---

## 🔮 Glassmorphism Classes

### Three Levels of Glass

#### Level 1: Subtle Glass (`.glass-subtle`)
**Use for**: Navigation sidebars, background trays
- **Opacity**: 50-60%
- **Blur**: 8px
- **Best for**: Elements that need to be present but not dominant

```tsx
<nav className="glass-subtle w-64 p-6">
  <ul>
    <li className="nav-link">Home</li>
    <li className="nav-link-active">Dashboard</li>
  </ul>
</nav>
```

#### Level 2: Standard Glass (`.glass`)
**Use for**: Content cards, modals, main UI elements
- **Opacity**: 70%
- **Blur**: 12px
- **Best for**: Primary content containers

```tsx
<div className="card">
  <h3>Project Card</h3>
  <p className="text-muted">Description here</p>
</div>
```

#### Level 3: Strong Glass (`.glass-strong`)
**Use for**: Overlays, chat panels, dropdowns, tooltips
- **Opacity**: 85-90%
- **Blur**: 16px
- **Best for**: Elements that need to stand out and be highly readable

```tsx
<aside className="context-tray">
  <div className="glass-strong p-6">
    <h4>AI Assistant</h4>
    {/* Chat interface */}
  </div>
</aside>
```

### Glass Hover Effect (`.glass-hover`)

Adds enhanced glass effect on hover with lift animation:

```tsx
<div className="card glass-hover">
  <h3>Hoverable Card</h3>
</div>
```

---

## 📦 Layout Components

### Navigation Sidebar (`.nav-sidebar`)
**Fixed left sidebar with subtle glass**
- Width: 240-280px (w-60 to w-72)
- Height: 100vh
- Position: Fixed left
- Z-index: 40

```tsx
<nav className="nav-sidebar p-6">
  <div className="space-y-2">
    <a href="/" className="nav-link">
      <HomeIcon className="w-5 h-5" />
      <span>Home</span>
    </a>
    <a href="/explore" className="nav-link-active">
      <ExploreIcon className="w-5 h-5" />
      <span>Explore</span>
    </a>
  </div>
</nav>
```

### Context Tray (`.context-tray`)
**Floating right panel for AI chat/help**
- Width: 320-400px (w-80 to w-96)
- Height: 100vh
- Position: Fixed right
- Z-index: 50
- Animation: Slides in from right

```tsx
<aside className="context-tray p-6">
  <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
  {/* Chat interface */}
</aside>
```

### Content Container (`.content-container`)
**Main content area with max-width and centering**

```tsx
<main className="content-container">
  <h1>Page Title</h1>
  <div className="grid grid-cols-3 gap-6">
    {/* Content cards */}
  </div>
</main>
```

---

## 🎴 Cards

### Standard Card (`.card`)
Glass card with standard opacity:

```tsx
<div className="card">
  <h3 className="text-xl font-semibold mb-2">Card Title</h3>
  <p className="text-muted">Card content goes here</p>
</div>
```

### Hoverable Card (`.card-hover`)
Card with hover lift and enhanced glass:

```tsx
<div className="card-hover">
  <h3>Interactive Card</h3>
  <p>Lifts on hover</p>
</div>
```

### Solid Card (`.card-solid`)
For text-heavy content where readability is critical:

```tsx
<article className="card-solid">
  <h2>Blog Post Title</h2>
  <p>Long-form content with solid background for better readability...</p>
</article>
```

---

## 🔘 Buttons

### Primary Button (`.btn-primary`)
Main call-to-action with brand color:

```tsx
<button className="btn-primary">
  Get Started
</button>

<button className="btn-primary btn-lg">
  <PlusIcon className="w-5 h-5" />
  Create Project
</button>
```

### Secondary Button (`.btn-secondary`)
Glass-styled secondary action:

```tsx
<button className="btn-secondary">
  Learn More
</button>
```

### Outline Button (`.btn-outline`)
Transparent with border:

```tsx
<button className="btn-outline">
  Cancel
</button>
```

### Ghost Button (`.btn-ghost`)
Minimal button for tertiary actions:

```tsx
<button className="btn-ghost btn-sm">
  <SettingsIcon className="w-4 h-4" />
  Settings
</button>
```

---

## 📝 Forms

### Input Field (`.input`)
Solid background for readability:

```tsx
<div>
  <label className="label">Email Address</label>
  <input 
    type="email" 
    className="input" 
    placeholder="you@example.com"
  />
</div>
```

### Input States

```tsx
{/* Error state */}
<input className="input input-error" />

{/* Success state */}
<input className="input input-success" />
```

### Textarea (`.textarea`)

```tsx
<textarea 
  className="textarea" 
  rows={4}
  placeholder="Enter your message..."
/>
```

---

## 🏷️ Badges

```tsx
<span className="badge-primary">Active</span>
<span className="badge-success">Completed</span>
<span className="badge-warning">Pending</span>
<span className="badge-error">Failed</span>
<span className="badge-info">New</span>
```

---

## 📱 Navigation Links

### Standard Nav Link (`.nav-link`)

```tsx
<a href="/dashboard" className="nav-link">
  <DashboardIcon className="w-5 h-5" />
  <span>Dashboard</span>
</a>
```

### Active Nav Link (`.nav-link-active`)

```tsx
<a href="/profile" className="nav-link-active">
  <UserIcon className="w-5 h-5" />
  <span>Profile</span>
</a>
```

---

## 🎭 Modals & Overlays

### Modal with Backdrop

```tsx
{/* Backdrop */}
<div className="backdrop" onClick={onClose} />

{/* Modal */}
<div className="modal">
  <h2 className="text-2xl font-semibold mb-4">Modal Title</h2>
  <p className="text-muted mb-6">Modal content goes here</p>
  <div className="flex gap-3 justify-end">
    <button className="btn-ghost" onClick={onClose}>Cancel</button>
    <button className="btn-primary">Confirm</button>
  </div>
</div>
```

---

## ✨ Typography

### Gradient Text (`.text-gradient`)

```tsx
<h1 className="text-gradient">
  AI-Powered Platform
</h1>
```

### Muted Text (`.text-muted`)

```tsx
<p className="text-muted">
  Secondary information or captions
</p>
```

### Body Text (`.text-body`)

```tsx
<p className="text-body">
  Optimal line height and color for body content
</p>
```

### Links (`.link`)

```tsx
<a href="/docs" className="link">
  Read the documentation
</a>
```

---

## 🔄 Loading States

### Spinner (`.spinner`)

```tsx
<div className="spinner" />
```

### Skeleton Loader (`.skeleton`)

```tsx
<div className="skeleton h-8 w-64 mb-4" />
<div className="skeleton h-4 w-full mb-2" />
<div className="skeleton h-4 w-3/4" />
```

---

## ✂️ Utilities

### Animation Delays

```tsx
<div className="animate-fade-in animation-delay-100">Item 1</div>
<div className="animate-fade-in animation-delay-200">Item 2</div>
<div className="animate-fade-in animation-delay-300">Item 3</div>
```

### Staggered Children

```tsx
<ul className="stagger-children">
  <li>First item (0ms)</li>
  <li>Second item (50ms)</li>
  <li>Third item (100ms)</li>
  <li>Fourth item (150ms)</li>
</ul>
```

### Custom Scrollbar (`.scrollbar-thin`)

```tsx
<div className="h-96 overflow-y-auto scrollbar-thin">
  {/* Long content */}
</div>
```

---

## 🎬 Animations

### Built-in Animations

- **fade-in**: `animate-fade-in` - Fades in (300ms)
- **slide-in-right**: `animate-slide-in-right` - Slides from right (300ms)
- **slide-in-left**: `animate-slide-in-left` - Slides from left (250ms)
- **scale-in**: `animate-scale-in` - Scales up with fade (200ms)

```tsx
<div className="animate-fade-in">Fades in</div>
<aside className="animate-slide-in-right">Slides from right</aside>
<div className="animate-scale-in">Scales up</div>
```

---

## 📐 Z-Index Hierarchy

- **Modal/Dialog**: 100
- **Right Chat Tray**: 50
- **Left Navigation**: 40
- **Floating Actions**: 30
- **Cards/Content**: 10
- **Background**: 0

Use Tailwind's z-index utilities:
```tsx
<div className="z-100">Modal</div>
<aside className="z-50">Chat tray</aside>
<nav className="z-40">Navigation</nav>
```

---

## 🎯 Usage Examples

### Complete Card Example

```tsx
<div className="card-hover">
  <div className="flex items-start gap-4">
    <img 
      src="/avatar.jpg" 
      alt="User" 
      className="w-12 h-12 rounded-full"
    />
    <div className="flex-1">
      <h3 className="text-lg font-semibold">Project Title</h3>
      <p className="text-muted text-sm mb-3">
        Created 2 hours ago by John Doe
      </p>
      <div className="flex gap-2">
        <span className="badge-primary">AI</span>
        <span className="badge-success">Active</span>
      </div>
    </div>
  </div>
</div>
```

### Form Example

```tsx
<form className="card-solid max-w-md">
  <h2 className="text-2xl font-semibold mb-6">Sign In</h2>
  
  <div className="mb-4">
    <label className="label">Email</label>
    <input 
      type="email" 
      className="input" 
      placeholder="you@example.com"
    />
  </div>
  
  <div className="mb-6">
    <label className="label">Password</label>
    <input 
      type="password" 
      className="input" 
      placeholder="••••••••"
    />
  </div>
  
  <button className="btn-primary w-full">
    Sign In
  </button>
  
  <p className="text-center text-muted text-sm mt-4">
    Don't have an account? <a href="/signup" className="link">Sign up</a>
  </p>
</form>
```

### Dashboard Layout Example

```tsx
<div className="min-h-screen">
  {/* Left Navigation */}
  <nav className="nav-sidebar p-6">
    <h1 className="text-xl font-bold mb-8">All Thrive AI</h1>
    <div className="space-y-2">
      <a href="/" className="nav-link-active">Home</a>
      <a href="/explore" className="nav-link">Explore</a>
      <a href="/projects" className="nav-link">Projects</a>
    </div>
  </nav>
  
  {/* Main Content */}
  <main className="ml-72 mr-96 content-container">
    <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
    <p className="text-muted mb-8">Welcome back!</p>
    
    <div className="grid grid-cols-2 gap-6">
      <div className="card">
        <h3 className="text-xl font-semibold mb-2">Active Projects</h3>
        <p className="text-3xl font-bold text-primary-500">12</p>
      </div>
      <div className="card">
        <h3 className="text-xl font-semibold mb-2">Team Members</h3>
        <p className="text-3xl font-bold text-accent-500">48</p>
      </div>
    </div>
  </main>
  
  {/* Right Context Tray */}
  <aside className="context-tray p-6">
    <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
    <div className="space-y-4">
      {/* Chat messages */}
    </div>
  </aside>
</div>
```

---

## 🎨 Color Reference

### Light Mode
- **Background**: `bg-gradient-to-br from-white via-slate-50 to-slate-100`
- **Text**: `text-slate-900`
- **Muted**: `text-slate-600`
- **Borders**: `border-slate-200`

### Dark Mode
- **Background**: `bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950`
- **Text**: `text-slate-100`
- **Muted**: `text-slate-400`
- **Borders**: `border-slate-700`

---

## ♿ Accessibility

### Motion Preferences
The system respects `prefers-reduced-motion` automatically. All animations are disabled for users who prefer reduced motion.

### Color Contrast
All text colors meet WCAG AA standards:
- Light mode: slate-900 on white
- Dark mode: slate-100 on slate-900

### Focus States
All interactive elements have visible focus rings using `focus:ring-2`.

---

## 📦 Quick Start

1. **Import the CSS**: Already included via `index.css`
2. **Enable dark mode**: Add `dark` class to `<html>` or `<body>`
3. **Use global classes**: All classes listed above are available globally
4. **Combine with Tailwind**: Mix with Tailwind utilities for flexibility

```tsx
// Example: Custom card with mixed classes
<div className="card flex items-center gap-4 hover:scale-105">
  <Icon className="w-8 h-8 text-primary-500" />
  <div>
    <h3 className="font-semibold">Title</h3>
    <p className="text-muted text-sm">Description</p>
  </div>
</div>
```

---

**Version**: 1.0  
**Last Updated**: November 2025  
**Maintained By**: All Thrive AI Collective
