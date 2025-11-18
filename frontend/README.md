# AllThrive AI - Frontend

Modern React + TypeScript frontend for the AllThrive AI platform.

## Tech Stack

- **React 19** - UI library
- **TypeScript 5.9** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **TanStack Query** - Server state management

## Features

- 🔐 Secure authentication with first-party cookies and CSRF protection
- 🎨 Dark mode support with system preference detection
- 💬 Modular chat system with pluggable AI agents
- 📱 Responsive design for mobile and desktop
- ⚡ Fast refresh and HMR
- 🧪 Testing setup with Vitest and Playwright

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running (see main repository)

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_API_URL=http://localhost:8000
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

### Testing

```bash
# Run unit tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Linting & Type Checking

```bash
# Run ESLint
npm run lint

# Type check
npm run type-check
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── auth/         # Authentication-related components
│   ├── chat/         # Chat interface components
│   ├── common/       # Common/shared components
│   ├── layouts/      # Layout components
│   ├── navigation/   # Navigation components
│   ├── profile/      # Profile-related components
│   └── ui/           # UI primitives
├── context/          # React context providers
├── hooks/            # Custom React hooks
├── pages/            # Page components (routes)
├── routes/           # Route definitions
├── services/         # API and business logic
│   └── agents/       # AI agent implementations
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Documentation

See the `docs/` folder for detailed documentation:

- [Chat System Architecture](./docs/CHAT_SYSTEM.md)
- [Chat Architecture Review](./docs/CHAT_ARCHITECTURE_REVIEW.md)
- [Chat Quick Start](./docs/CHAT_QUICK_START.md)

## Key Features

### Authentication

- First-party cookie-based auth (no localStorage tokens)
- CSRF protection
- OAuth2 integration (Google, GitHub)
- Protected routes

### Chat System

- Modular AI agent architecture
- Pluggable agents for different use cases
- Real-time streaming responses
- Context-aware conversations

### Styling

- Tailwind CSS for utility-first styling
- Dark mode with system preference detection
- Responsive design patterns
- Custom glass morphism effects
