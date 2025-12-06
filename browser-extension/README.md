# AllThrive Web Clipper

A Chrome extension for capturing AI projects from websites like ChatGPT, Claude, Midjourney, and more.

## Features

- **One-click capture** - Save AI conversations and images directly to your AllThrive profile
- **Smart extraction** - Automatically detects and formats content from popular AI platforms
- **Platform-specific scrapers** - Optimized extraction for ChatGPT, Claude, Midjourney, and Gemini
- **Keyboard shortcuts** - Quick clip with Alt+Shift+S
- **Right-click context menu** - Clip selected text or images

## Supported Platforms

- ChatGPT / OpenAI
- Claude (Anthropic)
- Midjourney
- Google Gemini
- Any webpage (generic extraction)

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd browser-extension
npm install
```

### Build

```bash
# Development build (with source maps)
npm run build:dev

# Production build
npm run build
```

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `browser-extension/dist` folder

### Watch mode

```bash
npm run watch
```

This will automatically rebuild when files change.

## Project Structure

```
browser-extension/
├── public/
│   ├── manifest.json      # Extension manifest (V3)
│   └── icons/             # Extension icons
├── src/
│   ├── popup/             # Popup UI (React)
│   │   ├── index.tsx      # Entry point
│   │   ├── App.tsx        # Main component
│   │   └── styles.css     # Tailwind styles
│   ├── content/           # Content scripts
│   │   ├── index.ts       # Main content script
│   │   └── extractors/    # Platform-specific extractors
│   ├── background/        # Service worker
│   │   └── index.ts       # Background script
│   └── types/             # TypeScript types
│       └── index.ts       # Shared types
├── package.json
├── tsconfig.json
├── webpack.config.js
└── tailwind.config.js
```

## API Endpoints

The extension communicates with the AllThrive backend:

- `GET /api/v1/extension/auth/` - Authentication flow
- `GET /api/v1/extension/verify/` - Verify token
- `POST /api/v1/extension/clip/` - Create project from clip
- `GET /api/v1/extension/me/` - Get user info

## Building for Production

```bash
npm run build
```

The built extension will be in the `dist/` folder. You can zip this folder for distribution.

## License

Proprietary - AllThrive AI
