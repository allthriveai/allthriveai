# Neon Glass Design System Specification

**Version**: 2.0
**Theme**: Dark, Futuristic, Translucent
**Key Traits**: High Contrast, Glassmorphism, Neon Accents, Geometric

## 🎨 Color Palette

### Backgrounds
| Name | Value | Usage |
|------|-------|-------|
| Deep Navy | `#020617` | Main Body Background |
| Glass Fill | `rgba(255, 255, 255, 0.08)` | Panels, Cards |
| Glass Strong | `rgba(255, 255, 255, 0.12)` | Modals, Popovers |

### Neon Accents
| Name | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Cyan | `#0EA5E9` | `text-cyan-500` | Primary Brand |
| Bright Teal | `#22D3EE` | `text-cyan-400` | Highlights, Glows |
| Neon Bright | `#4ADEE7` | `text-cyan-bright` | Active States, Borders |
| Pink Accent | `#FB37FF` | `text-pink-accent` | Secondary Actions, Alerts |

## 💎 UI Components & Classes

### Surfaces

**Glass Panel**
- **Class**: `.glass-panel`
- **Properties**: `backdrop-blur-xl`, `rounded-3xl`, `border-white/10`
- **Usage**: Main layout containers.

**Glass Card**
- **Class**: `.glass-card`
- **Properties**: Adds hover effects + padding (32px-40px)
- **Usage**: Content items, dashboard widgets.

### Typography

**Headers**
- **Font**: Inter (Bold/SemiBold)
- **Color**: White
- **Accents**: `.text-gradient-cyan` (Cyan -> Bright Teal gradient)

**Body**
- **Font**: Inter (Regular)
- **Color**: `#94a3b8` (Slate-400)

### Buttons

**Primary (Neon)**
- **Class**: `.btn-primary`
- **Style**: Gradient background (Cyan -> Bright), Text Dark
- **Hover**: Scale 1.02, Neon Shadow

**Secondary (Glass)**
- **Class**: `.btn-secondary`
- **Style**: Transparent, White Border (10%), White Text
- **Hover**: White background (10%), Cyan Text

### Inputs

**Glass Input**
- **Class**: `.input-glass`
- **Style**: White/5 background, No border (until focus)
- **Focus**: Neon Border + Glow

## ✨ Special Effects

### Glows
- `.glow-teal`: Large radial shadow behind objects.
- `.shadow-neon`: Sharp cyan glow for active borders.

### Accents
- `.luminous-dot`: 8px circle with cyan glow.
- `.circuit-connector`: 1px gradient line for visual dividers.

## 📦 Tailwind Configuration (Reference)

```js
colors: {
  background: '#020617',
  cyan: {
    DEFAULT: '#0EA5E9',
    bright: '#22D3EE',
    neon: '#4ADEE7',
  },
  pink: {
    accent: '#FB37FF',
  }
}
```
