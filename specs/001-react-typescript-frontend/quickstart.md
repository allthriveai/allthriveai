# Quickstart: React TypeScript Frontend Skeleton

**Feature**: 001-react-typescript-frontend
**Date**: 2025-11-10
**Purpose**: Developer setup guide for frontend development

## Prerequisites

Before starting, ensure you have:

- **Node.js**: Version 18.x or higher ([Download](https://nodejs.org/))
- **npm/yarn/pnpm**: Package manager (npm comes with Node.js)
- **Git**: For version control
- **Code Editor**: VS Code recommended with extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Tailwind CSS IntelliSense

### Verify Installation

```bash
node --version  # Should be v18.x or higher
npm --version   # Should be 8.x or higher
```

## Backend Setup

The frontend requires the Django backend to be running.

### Start Django Backend

```bash
# From project root
cd /path/to/allthriveai

# Activate virtual environment
source .venv/bin/activate  # On Mac/Linux
# or
.venv\Scripts\activate  # On Windows

# Start Django server
python manage.py runserver
```

Django should be running at: http://localhost:8000

### Verify Backend

```bash
curl http://localhost:8000/api/auth/me/
# Should return 401 (expected, not authenticated)
```

## Frontend Setup

### 1. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (choose one)
npm install
# or
yarn install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000/api

# Application
VITE_APP_NAME=AllThrive AI
VITE_APP_VERSION=1.0.0

# Environment
VITE_ENV=development
```

### 3. Start Development Server

```bash
# Start Vite dev server
npm run dev
# or
yarn dev
# or
pnpm dev
```

Frontend should be running at: http://localhost:5173

### 4. Verify Setup

Open browser and navigate to:
- http://localhost:5173 (Homepage - should load)
- http://localhost:5173/about (About page - should load)
- http://localhost:5173/dashboard (Should redirect to login)

## Project Structure

```
frontend/
├── src/
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── services/      # API services
│   ├── hooks/         # Custom hooks
│   ├── context/       # React context
│   ├── types/         # TypeScript types
│   ├── utils/         # Utility functions
│   ├── routes/        # Route configuration
│   ├── App.tsx        # Root component
│   └── main.tsx       # Entry point
├── tests/             # Test files
├── public/            # Static assets
├── .env               # Environment variables
├── vite.config.ts     # Vite configuration
├── tsconfig.json      # TypeScript config
└── package.json       # Dependencies
```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run E2E tests (requires backend running)
npm run test:e2e
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

Build output goes to `frontend/dist/`

## Common Tasks

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `src/routes/index.tsx`
3. Update navigation if needed
4. Write tests in `tests/unit/pages/`

Example:
```tsx
// src/pages/NewPage.tsx
export default function NewPage() {
  return <div>New Page</div>;
}

// src/routes/index.tsx
import NewPage from '@/pages/NewPage';

const routes = [
  // ...
  { path: '/new', element: NewPage, requiresAuth: true, title: 'New Page' },
];
```

### Adding a New API Endpoint

1. Define TypeScript types in `src/types/api.ts`
2. Create service function in `src/services/`
3. Use TanStack Query for data fetching
4. Write tests

Example:
```typescript
// src/services/user.ts
import { api } from './api';
import type { User } from '@/types/models';

export async function getUser(id: number): Promise<User> {
  const response = await api.get(`/users/${id}/`);
  return response.data.data;
}

// In component
import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/services/user';

function UserProfile({ userId }: { userId: number }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>{user.fullName}</div>;
}
```

### Debugging

#### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src"
    }
  ]
}
```

#### Browser DevTools

- **React DevTools**: Install browser extension
- **Network Tab**: Monitor API calls
- **Console**: Check for errors and logs

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5173
# Mac/Linux:
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### CORS Errors

Ensure Django CORS is configured:

```python
# backend/config/settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
CORS_ALLOW_CREDENTIALS = True
```

### Type Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

## Environment-Specific Configuration

### Development

- Hot Module Replacement (HMR) enabled
- Source maps enabled
- API calls proxied to Django
- Detailed error messages

### Production

- Minified code
- Optimized bundles
- No source maps (optional)
- Error tracking enabled

## Testing Strategy

### Unit Tests

Test individual components, hooks, and utilities:

```bash
npm test src/components/Button.test.tsx
```

### Integration Tests

Test component interactions and flows:

```bash
npm test src/pages/__tests__/LoginPage.integration.test.tsx
```

### E2E Tests

Test complete user journeys with Playwright:

```bash
# Start backend and frontend first
npm run test:e2e
```

## Performance

### Development

- Vite provides fast HMR (~50ms updates)
- Lazy loading for route components
- React DevTools Profiler for performance analysis

### Production

- Code splitting by route
- Asset optimization (images, fonts)
- Bundle size analysis:

```bash
npm run build -- --report
```

## Security Checklist

- [ ] No API keys in code (use environment variables)
- [ ] CSRF tokens on state-changing requests
- [ ] httpOnly cookies for auth tokens
- [ ] Input validation on all forms
- [ ] Content Security Policy configured
- [ ] HTTPS in production

## Deployment

### Option A: Django Static Files

```bash
# Build frontend
cd frontend
npm run build

# Configure Django to serve frontend/dist/
# Update settings.py STATICFILES_DIRS
```

### Option B: Separate Hosting

```bash
# Build frontend
npm run build

# Deploy dist/ to:
# - Vercel
# - Netlify
# - AWS S3 + CloudFront
# - Nginx server
```

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TanStack Query](https://tanstack.com/query/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Testing Library](https://testing-library.com/)

## Getting Help

- Check console for error messages
- Review browser Network tab for API issues
- Check Django logs for backend errors
- Consult [spec.md](./spec.md) for feature requirements
- Review [data-model.md](./data-model.md) for type definitions

## Next Steps

After setup complete:

1. Run `/speckit.tasks` to generate implementation tasks
2. Review tasks in `specs/001-react-typescript-frontend/tasks.md`
3. Start with Phase 1 (Setup) tasks
4. Follow TDD: write tests first, then implement
5. Commit frequently with descriptive messages
