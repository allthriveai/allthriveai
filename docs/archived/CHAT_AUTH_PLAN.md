# Chat-Based Authentication System Plan

## Overview

Transform the current separate login/signup pages into a single, conversational authentication experience that intelligently handles both new and returning users through a chat interface with OAuth integration.

---

## Goals

1. **Single unified page** (`/auth`) – one chat interface for all auth
2. **Chat-first interface** – inline fields appear as chat bubbles
3. **Email is the username** – no separate username field anywhere
4. **Interests step** – multi-select of goals on AllThrive
5. **Values agreement** – present core values and get explicit agreement
6. **OAuth integration** – Google and GitHub with same flow
7. **Minimal friction** – collect only what’s necessary when needed

---

## User Flows

### Flow 1: New User - Email Signup

```
1. Land on /auth
   └─ See welcome message + 3 buttons

2. Click "Continue with Email"
   └─ Chat asks: "What's your email address?"

3. User enters: john@example.com
   └─ Backend checks email → Not found (new user)

4. Chat responds: "Welcome! Let's create your account."
   └─ Ask for first name and last name (inline chat fields)

5. Chat asks: "Create a secure password"
   └─ Show password input field

6. Chat asks: "What are you looking to do on AllThrive? (select any)"
   └─ Multi-select buttons: Explore, Share my skills, Invest in AI projects, Mentor others

7. Chat presents: "AllThrive core values" (short bulleted list)
   └─ Asks for agreement → [Yes, I agree]

8. Submit signup
   └─ Create account (email is the username; role defaults to 'explorer')
   └─ Auto-login
   └─ Redirect to /dashboard
```

### Flow 2: Returning User - Email Login

```
1. Land on /auth
   └─ See welcome message + 3 buttons

2. Click "Continue with Email"
   └─ Chat asks: "What's your email address?"

3. User enters: john@example.com
   └─ Backend checks email → Found!

4. Chat responds: "Welcome back, John! 👋"
   └─ Show password input field

5. User enters password
   └─ Validate credentials

6. Login successful
   └─ Redirect to /dashboard
```

### Flow 3: New User - Google OAuth

```
1. Land on /auth
   └─ See welcome message + 3 buttons

2. Click "Continue with Google"
   └─ Redirect to Google OAuth

3. Authenticate with Google
   └─ Returns with: email, first_name, last_name, avatar

4. Backend creates user (no password needed; email is username)
   └─ Redirect to /auth?setup=true

5. Chat says: "Welcome, John! I got your info from Google."
   └─ Ask: "What are you looking to do on AllThrive? (select any)"
      Options: Explore, Share my skills, Invest in AI projects, Mentor others

6. Chat presents: "AllThrive core values" and asks for agreement → [Yes, I agree]

7. Complete profile (store interests, agreement)
   └─ Auto-login
   └─ Redirect to /dashboard
```

### Flow 4: Returning User - Google OAuth

```
1. Land on /auth
   └─ See welcome message + 3 buttons

2. Click "Continue with Google"
   └─ Redirect to Google OAuth

3. Authenticate with Google
   └─ User exists with complete profile

4. Chat says: "Welcome back, John! ✓ Logged in successfully!"
   └─ Redirect to /dashboard (instant)
```

### Flow 5: New User - GitHub OAuth

```
(Same as Flow 3, but with GitHub)
```

### Flow 6: Returning User - GitHub OAuth

```
(Same as Flow 4, but with GitHub)
```

---

## Architecture

### Frontend Structure

```
src/
├── pages/
│   └── AuthPage.tsx                 // Main unified auth page
│
├── components/
│   └── auth/
│       ├── ChatAuthInterface.tsx    // Chat container & state management
│       ├── WelcomeMessage.tsx       // Initial welcome + buttons
│       ├── MessageList.tsx          // Display chat messages
│       ├── ChatMessage.tsx          // Individual message component
│       ├── ChatInput.tsx            // Text input for user messages
│       ├── PasswordInput.tsx        // Secure password field
│       ├── RoleSelector.tsx         // Role selection buttons
│       └── OAuthButtons.tsx         // Google/GitHub buttons
│
├── hooks/
│   └── useAuthChat.ts               // Chat state machine logic
│
└── types/
    └── auth.ts                      // TypeScript interfaces
```

### Backend Structure

```
services/
├── auth_agent/
│   ├── __init__.py
│   ├── graph.py                     // LangGraph state machine
│   ├── nodes.py                     // Graph nodes (collect email, name, etc.)
│   ├── prompts.py                   // AI prompts (playful tone)
│   ├── checkpointer.py              // Redis checkpointer setup
│   └── validators.py                // Field validation

core/
├── auth_views.py                    // Existing auth views
├── auth_chat_views.py               // New chat endpoints with streaming
└── serializers.py                   // Data validation

# New endpoints to add:
POST /api/auth/chat/stream/          // SSE streaming chat endpoint
POST /api/auth/chat-signup/          // Complete signup from collected data
POST /api/auth/chat-login/           // Login from chat
POST /api/auth/complete-oauth/       // Complete OAuth profile
```

---

## Technical Implementation

### Phase 1: Backend - LangGraph Agent (Day 1-3)

#### 1.1 Setup LangGraph State Machine

**File**: `services/auth_agent/graph.py`

**State Definition**:
```python
from typing import TypedDict, Literal, List

class AuthState(TypedDict):
    messages: List[dict]  # Chat history
    step: Literal['welcome', 'email', 'name', 'password', 'interests', 'values', 'complete']
    mode: Literal['signup', 'login', 'oauth_setup']
    email: str | None
    first_name: str | None
    last_name: str | None
    password: str | None
    interests: List[str]
    agreed_to_values: bool
    user_exists: bool
```

**Graph Nodes**:
- `welcome_node` - Initial greeting
- `collect_email_node` - Ask for email, check if exists
- `collect_name_node` - Ask first/last name
- `collect_password_node` - Ask for password
- `collect_interests_node` - Multi-select interests
- `show_values_node` - Display values
- `get_agreement_node` - Confirm values agreement
- `complete_signup_node` - Create account
- `complete_login_node` - Authenticate user

**Redis Checkpointer**:
```python
from langgraph.checkpoint.redis import RedisSaver

checkpointer = RedisSaver(
    redis_url="redis://localhost:6379",
    ttl=1800  # 30 min session timeout
)
```

**Using AIProvider in LangGraph**:
```python
from services.ai_provider import AIProvider

# Initialize AI provider (uses settings DEFAULT_AI_PROVIDER)
ai = AIProvider()

# In graph nodes, use streaming
def welcome_node(state: AuthState):
    system_msg = "You are a playful, friendly AI helping users sign up. Use emojis!"
    prompt = "Welcome the user to AllThrive"

    # Stream response
    for chunk in ai.stream_complete(
        prompt=prompt,
        system_message=system_msg,
        temperature=0.8
    ):
        yield chunk
```

#### 1.2 Streaming Chat Endpoint

**Endpoint**: `POST /api/auth/chat/stream/`

**Request**:
```json
{
  "session_id": "uuid-v4",
  "message": "john@example.com",
  "type": "text"  // or "button_click" for interests/values
}
```

**Response**: Server-Sent Events (SSE) stream
```
data: {"type": "token", "content": "Awesome"}
data: {"type": "token", "content": "!"}
data: {"type": "token", "content": " Let's"}
data: {"type": "complete", "next_step": "collect_name", "show_fields": ["first_name", "last_name"]}
```

#### 1.3 Chat Signup Endpoint

**Endpoint**: `POST /api/auth/chat-signup/`

**Request**:
```json
{
  "email": "john@example.com",
  "password": "securepass123",
  "first_name": "John",
  "last_name": "Doe",
  "interests": ["explore", "mentor"],
  "agreed_to_values": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Account created successfully!",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "role": "explorer",
    "interests": ["explore", "mentor"],
    "agreed_to_values": true
  }
}
```

#### 1.3 Chat Login Endpoint

**Endpoint**: `POST /api/auth/chat-login/`

**Request**:
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Logged in successfully!",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "username": "johndoe",
    "first_name": "John",
    "role": "explorer"
  }
}
```

#### 1.4 Complete OAuth Profile

**Endpoint**: `POST /api/auth/complete-oauth/`

**Request**:
```json
{
  "interests": ["explore", "mentor"],
  "agreed_to_values": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile completed!",
  "user": {
    "id": 1,
    "email": "john@gmail.com",
    "role": "explorer",
    "interests": ["explore", "mentor"],
    "agreed_to_values": true
  }
}
```

#### 1.5 Update OAuth Callback Handler

Modify existing OAuth callback to:
1. Check if user is new or missing required fields (username, role)
2. If incomplete → redirect to `/auth?setup=true&provider=google`
3. If complete → redirect to `/dashboard`

**Code Location**: `core/auth_views.py` (existing OAuth handlers)

---

### Phase 2: Frontend Components (Day 3-4)

#### 2.1 AuthPage Component

**File**: `src/pages/AuthPage.tsx`

**Responsibilities**:
- Container for entire auth experience
- Handle URL params (`?setup=true`)
- Manage page-level state
- Handle redirects after success

**Key States**:
```typescript
interface AuthPageState {
  isSetup: boolean;        // From URL param
  provider?: string;       // OAuth provider if setup
  isAuthenticated: boolean;
}
```

#### 2.2 ChatAuthInterface Component

**File**: `src/components/auth/ChatAuthInterface.tsx`

**Responsibilities**:
- Main chat state machine
- Coordinate message flow
- Handle API calls
- Manage collected data

**Key States**:
```typescript
type ChatState =
  | 'welcome'
  | 'ask-email'
  | 'check-email'
  | 'ask-name'
  | 'ask-password'
  | 'ask-interests'
  | 'show-values'
  | 'ask-agreement'
  | 'signup-processing'
  | 'login-processing'
  | 'complete';

interface ChatData {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  interests?: ('explore' | 'share_skills' | 'invest' | 'mentor')[];
  agreedToValues?: boolean;
}
```

#### 2.3 Chat State Machine

**File**: `src/hooks/useAuthChat.ts`

**State Transitions**:
```typescript
welcome
  ├─ click OAuth → OAuth flow
  └─ click Email → ask-email

ask-email
  └─ submit email → check-email

check-email
  ├─ exists=true → ask-password (login)
  └─ exists=false → ask-name (signup)

ask-name
  └─ submit names → ask-password

ask-password (signup)
  └─ submit password → ask-interests

ask-interests
  └─ select one or more → show-values

show-values
  └─ display values → ask-agreement

ask-agreement
  └─ agree → signup-processing

ask-password (login)
  └─ submit password → login-processing

signup-processing / login-processing
  └─ success → complete → redirect
```

#### 2.4 Message Components

**WelcomeMessage.tsx**:
```typescript
- Display: "Welcome to AllThrive! 👋"
- Show: [Continue with Google]
- Show: [Continue with GitHub]
- Show: [Continue with Email]
```

**MessageList.tsx**:
```typescript
- Scroll container
- Display all chat messages
- Auto-scroll to bottom
- Loading indicators
```

**ChatMessage.tsx**:
```typescript
interface ChatMessageProps {
  role: 'ai' | 'user';
  content: string;
  timestamp?: Date;
}
```

**ChatInput.tsx**:
```typescript
- Text input field
- Send button
- Enter key handler
- Disabled during processing
```

**PasswordInput.tsx**:
```typescript
- Secure password field
- Show/hide toggle
- Strength indicator (optional)
- Submit button
```

**InterestsSelector.tsx**:
```typescript
- Multi-select pill buttons: Explore, Share my skills, Invest in AI projects, Mentor others
- Allow toggling selections
- Continue button becomes enabled when 1+ selected
```

**ValuesCard.tsx + AgreementButtons.tsx**:
```typescript
- Render core values as a short list
- [Yes, I agree] button (required to proceed)
- Optional [Read more] link to full values page
```

---

### Phase 3: Integration (Day 5)

#### 3.1 Connect Frontend to Backend

- Wire up API calls in `useAuthChat` hook
- Handle loading states
- Handle error states
- Display validation errors in chat

#### 3.2 OAuth Integration

**Google OAuth Button**:
```typescript
const handleGoogleLogin = () => {
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  window.location.href = `${backendUrl}/accounts/google/login/?process=login`;
};
```

**GitHub OAuth Button**:
```typescript
const handleGitHubLogin = () => {
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  window.location.href = `${backendUrl}/accounts/github/login/?process=login`;
};
```

**Handle OAuth Setup**:
```typescript
// In AuthPage.tsx
useEffect(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('setup') === 'true') {
    // After OAuth, collect interests and values agreement
    setChatState('ask-interests');
  }
}, [location.search]);
```

#### 3.3 Update Routing

**File**: `src/App.tsx` or routing config

```typescript
// Replace old routes
<Route path="/signup" element={<Navigate to="/auth" replace />} />
<Route path="/login" element={<Navigate to="/auth" replace />} />

// New unified route
<Route path="/auth" element={<AuthPage />} />
```

---

### Phase 4: Polish & Testing (Day 6-7)

#### 4.1 UI/UX Polish

- [ ] Smooth animations for message appearance
- [ ] Loading indicators during API calls
- [ ] Success animations
- [ ] Error handling with friendly messages
- [ ] Mobile responsive design
- [ ] Dark mode support
- [ ] Keyboard navigation
- [ ] Accessibility (ARIA labels)

#### 4.2 Error Handling

**Email Already Exists** (during signup):
```
[AI] "Hmm, looks like that email is already registered.
      Would you like to log in instead?"
[Button: Yes, log me in]
```

**Interests Not Selected**:
```
[AI] "Please select at least one interest so we can tailor your experience."
```

**Invalid Password** (during login):
```
[AI] "That password doesn't match. Try again or
      reset your password."
[Link: Forgot password?]
```

**Network Error**:
```
[AI] "Oops, connection issue. Let's try that again."
[Button: Retry]
```

#### 4.3 Testing Checklist

**New User Flows**:
- [ ] Email signup - full flow
- [ ] Email signup - email already exists
- [ ] Google OAuth - new user
- [ ] GitHub OAuth - new user
- [ ] Interests selection (multi-select)
- [ ] Values agreement required
- [ ] Password validation (too short, too weak)

**Returning User Flows**:
- [ ] Email login - successful
- [ ] Email login - wrong password
- [ ] Email login - email not found
- [ ] Google OAuth - returning user
- [ ] GitHub OAuth - returning user

**Edge Cases**:
- [ ] User refreshes page mid-flow
- [ ] User clicks back button
- [ ] User already authenticated (redirect)
- [ ] OAuth callback errors
- [ ] Network errors
- [ ] Timeout handling

**Cross-Browser**:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari
- [ ] Mobile Chrome

---

## Data Models

### Chat Message

```typescript
interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
  type?: 'text' | 'input' | 'button-group';
  metadata?: {
    inputType?: 'email' | 'text' | 'password';
    buttons?: Array<{
      label: string;
      value: string;
    }>;
  };
}
```

### Auth State

```typescript
interface AuthState {
  chatState: ChatState;
  messages: ChatMessage[];
  collectedData: ChatData;
  isProcessing: boolean;
  error: string | null;
  mode: 'signup' | 'login' | 'oauth-setup';
}
```

---

## API Validation Rules

### Email
- Required
- Valid email format
- Unique (email is the username / login identifier)

### Password
- Minimum 8 characters
- At least one letter
- At least one number
- Not common password

### Name
- First name: Required, 1-50 characters
- Last name: Required, 1-50 characters
- Letters, spaces, hyphens only

### Interests
- Optional in v1 (recommended)
- Array of: explore, share_skills, invest, mentor
- Up to 4 selections

### Values Agreement
- Required
- Must be true

### Role
- Optional (defaults to 'explorer' on backend)

---

## Security Considerations

### Password Handling
- Never log passwords
- Hash immediately on backend
- Use HTTPS only
- Password never sent to AI/analytics

### Session Management
- Use first-party cookies (per user rules)
- CSRF protection enabled
- Secure, HttpOnly cookies
- Session timeout: 30 minutes inactive

### Rate Limiting
- Email check: 10 requests/minute per IP
- Signup: 5 requests/hour per IP
- Login: 5 failed attempts → temp lock

### Data Privacy
- Don't expose whether email exists (for security)
- Sanitize error messages
- No PII in logs

---

## Environment Variables

### Frontend (.env)

```bash
VITE_API_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000/api
```

### Backend

```python
# Existing OAuth settings
SOCIALACCOUNT_PROVIDERS = {
    'google': {...},
    'github': {...}
}

# New: OAuth redirect for incomplete profiles
OAUTH_INCOMPLETE_REDIRECT = '/auth?setup=true'

# Email is the username (django-allauth)
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_UNIQUE_EMAIL = True
```

---

## Success Metrics

### User Experience
- **Time to signup**: Target < 60 seconds
- **Completion rate**: Target > 80%
- **Error rate**: Target < 5%

### Adoption
- **OAuth vs Email**: Track split
- **Drop-off points**: Identify where users abandon
- **Mobile vs Desktop**: Compare completion rates

### Technical
- **API response time**: < 200ms
- **Frontend load time**: < 2s
- **Error rate**: < 1%

---

## Future Enhancements

### Phase 2 Features
1. **Social profile import** - Use OAuth avatar and bio
2. **Username suggestions** - AI-generated alternatives
3. **Password strength meter** - Visual feedback
4. **"Skip for now"** - Allow partial signup
5. **Email verification** - Send confirmation email
6. **Password reset** - In-chat password recovery

### Phase 3 Features
1. **Multi-language support** - i18n for chat messages
2. **Voice input** - Speech-to-text for accessibility
3. **Smart defaults** - Suggest username from email
4. **Progress indicator** - Show steps completed
5. **Save and resume** - Continue signup later
6. **A/B testing** - Optimize conversion rates

---

## Technical Stack

### Backend AI Chat
- **LangChain + LangGraph** - Stateful conversation management
- **Redis checkpointer** - Persist conversation state (per user rules)
- **Streaming responses** - Stream AI messages token-by-token to frontend
- **AIProvider class** - Use existing `services/ai_provider.py` for LLM calls (supports Azure/OpenAI/Anthropic)

### AI Personality
- **Tone**: Playful, friendly, welcoming
- **Style**: Use emojis, casual language, encouraging
- **Examples**:
  - "Hey there! 👋 Welcome to AllThrive!"
  - "Awesome! Let's get you set up 🚀"
  - "Nice! What should we call you?"

### Backup Form
- **Escape hatch** - "I prefer a traditional form" button
- **Fallback** - Show standard signup form if user prefers
- **Always available** - Link visible throughout chat flow

---

## Questions & Decisions Needed

### Design
- [ ] Chat bubble style (minimal vs colorful)?
- [ ] Avatar for AI messages?
- [ ] Sound effects on message receive?
- [ ] Typing indicators?

### Functionality
- [ ] Allow editing previous answers?
- [ ] Show progress bar?
- [ ] Auto-save partial data?
- [ ] Add "I prefer a form" escape hatch?

### Content
- [x] AI personality: **Playful** - Use emojis, casual language, encouraging tone
- [ ] Role descriptions - short or detailed?
- [ ] Welcome message variations?
- [ ] Core values text - what to display?

---

## Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Backend** | 2 days | Email check, chat signup/login, OAuth updates |
| **Phase 2: Frontend** | 2 days | Components, state machine, UI |
| **Phase 3: Integration** | 1 day | Connect frontend/backend, OAuth flow |
| **Phase 4: Polish** | 2 days | Animations, error handling, testing |
| **Total** | **7 days** | |

---

## Resources

### Design References
- Intercom-style chat
- Linear onboarding
- Stripe checkout flow

### Technical References
- React useState for state machine
- CSS transitions for animations
- Axios for API calls

---

## Appendix: Complete Component Tree

```
AuthPage
└── ChatAuthInterface
    ├── MessageList
    │   └── ChatMessage (multiple)
    │       ├── Text content
    │       ├── Timestamp
    │       └── Avatar
    ├── WelcomeMessage
    │   └── OAuthButtons
    │       ├── GoogleButton
    │       └── GitHubButton
    ├── ChatInput (conditional)
    ├── PasswordInput (conditional)
    └── RoleSelector (conditional)
        └── RoleButton (4x)
```

---

## File Checklist

### Backend Files to Create/Modify
- [ ] `core/auth_chat_views.py` (new)
- [ ] `core/serializers.py` (add new serializers)
- [ ] `core/urls.py` (add new routes)
- [ ] `core/auth_views.py` (modify OAuth callbacks)

### Backend Files to Create/Modify
- [ ] `services/auth_agent/__init__.py` (new)
- [ ] `services/auth_agent/graph.py` (new - LangGraph state machine)
- [ ] `services/auth_agent/nodes.py` (new - graph nodes)
- [ ] `services/auth_agent/prompts.py` (new - playful AI prompts)
- [ ] `services/auth_agent/checkpointer.py` (new - Redis setup)
- [ ] `services/auth_agent/validators.py` (new - field validation)
- [ ] `core/auth_chat_views.py` (new - streaming endpoints)
- [ ] `core/serializers.py` (add new serializers)
- [ ] `core/urls.py` (add new routes)
- [ ] `core/auth_views.py` (modify OAuth callbacks)

### Frontend Files to Create/Modify
- [ ] `src/pages/AuthPage.tsx` (new)
- [ ] `src/pages/SignupFormPage.tsx` (new - backup form)
- [ ] `src/components/auth/ChatAuthInterface.tsx` (new)
- [ ] `src/components/auth/WelcomeMessage.tsx` (new)
- [ ] `src/components/auth/MessageList.tsx` (new)
- [ ] `src/components/auth/ChatMessage.tsx` (new - with streaming support)
- [ ] `src/components/auth/ChatInput.tsx` (new)
- [ ] `src/components/auth/PasswordInput.tsx` (new)
- [ ] `src/components/auth/InterestsSelector.tsx` (new)
- [ ] `src/components/auth/ValuesCard.tsx` (new)
- [ ] `src/components/auth/AgreementButtons.tsx` (new)
- [ ] `src/components/auth/OAuthButtons.tsx` (new)
- [ ] `src/hooks/useAuthChatStream.ts` (new - SSE streaming hook)
- [ ] `src/types/auth.ts` (modify)
- [ ] `src/App.tsx` (modify routes)

### Documentation
- [ ] Update `docs/AUTH_README.md`
- [ ] Update `docs/SIGNUP_FEATURE.md`
- [ ] Add `docs/CHAT_AUTH_PLAN.md` (this document)

---

**Last Updated**: 2025-11-13
**Status**: Planning Phase
**Next Steps**: Begin Phase 1 - Backend APIs
