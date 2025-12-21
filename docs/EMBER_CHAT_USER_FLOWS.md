# Ember Chat User Flows

Complete documentation of all user interaction paths in the Ember chat interface.

---

## Overview

Ember chat has two layouts:

- **Embedded Chat (Home Page)** - Full-page chat with personalized "feeling pills"
- **Sidebar Chat** - Sliding panel with context-aware quick actions

---

## Greeting Messages

Time-based greeting prefix + randomized message:

| Time | Prefix |
|------|--------|
| Before 12pm | Good morning |
| 12pm - 6pm | Good afternoon |
| After 6pm | Good evening |

**Message variations:**
- "{greeting}, {name}! What's on your mind today?"
- "{greeting}, {name}! Ready to create something amazing?"
- "{greeting}, {name}! What would you like to explore?"
- "{greeting}, {name}! I'm here whenever you need me."
- "{greeting}, {name}! What can I help you with today?"
- "{greeting}, {name}! Let's make something happen."

---

## Onboarding Flow (New Users)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEW USER ONBOARDING                                │
└─────────────────────────────────────────────────────────────────────────────┘

User Opens Ember Chat (first time)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  "Hi, {name}! I'm Ember, your guide throughout your All Thrive journey."    │
│                                                                              │
│  "As you explore AI and our community, I'll be learning about you to give   │
│   you a more personalized experience."                                       │
│                                                                              │
│  "Let's start by creating your All Thrive Avatar."                          │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────────┐
        ▼                                  ▼
┌───────────────────┐            ┌─────────────────┐
│  Create My Avatar │            │  Skip for now   │
│    (Primary)      │            │    (Link)       │
└───────────────────┘            └─────────────────┘
        │                                  │
        ▼                                  │
  Avatar Creation Flow                     │
        │                                  │
        └──────────────────────────────────┘
                       │
                       ▼
               Main Chat Experience
```

---

## Feeling Pills (Home Page)

Up to 4 personalized pills shown at a time, based on user's signup interests and time of day.

### All Pills

| Pill | What Happens |
|------|-------------|
| **Share something I've been working on** | Shows Project Import Options (see below) |
| **Play a game** | Opens Game Picker Modal |
| **See this week's challenge** | Sends: "Show me this week's challenge" |
| **Learn something new** | Sends: "I want to learn something new about AI" |
| **Sell a product or service** | Sends: "I want to sell a product or service" |
| **Explore what others are making** | Sends: "Show me what others are making" |
| **Connect with others** | Sends: "Help me find people to connect with" |
| **Personalize my experience** | Sends: "Help me personalize my AllThrive experience" |
| **What's trending today?** | Sends: "Show me what's trending today" |
| **Give me a quick win** | Sends: "I want a quick win to start my day" |
| **Make my avatar** | Starts avatar creation (only shown if user has no avatar) |

---

## Project Import Options

Clicking "Share something I've been working on" triggers this flow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    "Share something I've been working on"                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│          Ember: "Great! I'd love to see what you've been creating."         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│ Connect to an     │   │ Paste in a URL    │   │ Upload a project  │
│ integration       │   │                   │   │                   │
│                   │   │ "Import from any  │   │ "Upload images,   │
│ "Pull from GitHub,│   │  website or       │   │  files, or        │
│  GitLab, Figma,   │   │  repository URL"  │   │  documents"       │
│  or YouTube"      │   │                   │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
 Integration Picker          AI handles URL           File picker opens
                              import flow
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION PICKER                                 │
├───────────────────┬───────────────────┬───────────────────┬───────────────┤
│      GitHub       │      GitLab       │      Figma        │    YouTube    │
│                   │                   │                   │               │
│  Connect account  │  Connect account  │  Connect account  │  Paste video  │
│  → Select repo    │  → Select project │  → Paste URL      │  URL          │
│  → Import         │  → Import         │  → Import         │  → Import     │
└───────────────────┴───────────────────┴───────────────────┴───────────────┘

        ┌───────────────────┐
        │ Chrome extension  │
        │    (4th option)   │
        │                   │
        │ "Install our      │
        │  extension to     │
        │  easily import    │
        │  from anywhere"   │
        │                   │
        │ → Coming Soon     │
        │   modal           │
        └───────────────────┘
```

---

## Games (Play a game)

Clicking "Play a game" opens a modal with these options:

- **Context Snake** - Classic snake game with AI twist
- **AI Trivia Quiz** - Test your AI knowledge
- **Ethics Defender** - Explore AI ethics scenarios
- **Prompt Battle** - Compete in prompt engineering

---

## Quick Actions (Sidebar Chat)

Context-aware actions that appear in the sidebar based on where the user opened the chat.

### Learn Context
- "Learn AI Basics" → "Teach me the basics of AI"
- "Quiz Me" → "Give me a quick quiz on what I've learned"
- "My Progress" → "Show me my learning progress"
- "What Next?" → "What should I learn next?"

### Explore Context
- "Trending Projects" → "Show me trending projects"
- "Find Projects" → "Help me find interesting projects"
- "Recommend For Me" → "Recommend projects based on my interests"
- "Similar Projects" → "Find projects similar to what I've liked"

### Project Context
- "Paste a URL" → "I want to import a project from a URL"
- "Make Infographic" → "Help me create an image or infographic"
- "From GitHub" → "I want to import a project from GitHub"
- "Upload Media" → "I want to upload media to create a project"

### Default Context
- "I need help" → "I need help with something"
- "I don't know what to do next" → "What can I do on AllThrive?"
- "I want to do something fun" → "Suggest something fun for me to do"

---

## Plus Menu (+)

Always available via the "+" button next to chat input.

### Primary Options
| Option | Icon | Action |
|--------|------|--------|
| Import from URL | Link | Sends: "I want to import a project from a URL" |
| Upload Image or Video | Cloud | Opens file picker |
| Ask for Help | ? | Sends: "I need help with something" |
| Clear Conversation | Trash | Clears chat, resets to greeting |

### More Integrations (expandable section)
| Option | Icon | Action |
|--------|------|--------|
| Create Image/Infographic | Banana | Sends: "Help me create an image or infographic" |
| Add from GitHub | GitHub | Starts GitHub OAuth flow |
| Add from GitLab | GitLab | Starts GitLab OAuth flow |
| Add from Figma | Figma | Starts Figma OAuth flow |
| Add from YouTube | YouTube | Sends: "I want to import a YouTube video as a project" |
| Describe Anything | Comment | Sends: "I want to describe a project to create" |
| Create Product | Shopping Bag | Coming Soon (creators/admins only) |

---

## Learning Goal Selection

For users setting up their learning preferences:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LEARNING GOAL SELECTION                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Ember: "Hey there! I'm Ember, your AI learning companion."                 │
│                                                                              │
│  "What brings you here today? This helps me personalize your learning path."│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Select a Goal                                     │
├───────────────────────────┬─────────────────────────────────────────────────┤
│  Build AI Projects        │  Get hands-on with tools like LangChain and    │
│  (Rocket icon)            │  build real applications.                       │
├───────────────────────────┼─────────────────────────────────────────────────┤
│  Understand AI Concepts   │  Learn the fundamentals of AI models,          │
│  (Lightbulb icon)         │  prompting, and workflows.                      │
├───────────────────────────┼─────────────────────────────────────────────────┤
│  Career Exploration       │  Discover how AI can boost your productivity   │
│  (Briefcase icon)         │  and career.                                    │
├───────────────────────────┼─────────────────────────────────────────────────┤
│  Just Exploring           │  I'm curious about AI and want to look around. │
│  (Compass icon)           │                                                 │
└───────────────────────────┴─────────────────────────────────────────────────┘
                                    │
                                    ▼
                    "Skip for now - I'll figure it out as I go"
```

---

## Complete Flow Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER OPENS EMBER CHAT                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │   NEW USER    │               │ RETURNING USER│
            └───────────────┘               └───────────────┘
                    │                               │
                    ▼                               │
            Onboarding Intro                        │
            (see above)                             │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │ EMBEDDED CHAT │               │ SIDEBAR CHAT  │
            │  (Home Page)  │               │   (Overlay)   │
            └───────────────┘               └───────────────┘
                    │                               │
                    ▼                               ▼
            Greeting Message                Context-Aware
            + Feeling Pills                 Quick Actions
                    │                               │
                    ▼                               │
        ┌───────────────────┐                       │
        │   FEELING PILLS   │                       │
        │   (max 4 shown)   │                       │
        └───────────────────┘                       │
                    │                               │
    ┌───────┬───────┼───────┬───────────────┐       │
    ▼       ▼       ▼       ▼               ▼       │
 Share   Play a   Learn   Other Pills   Make        │
 some-   game     some-   (send msg)    avatar      │
 thing            thing                             │
    │       │       │                               │
    ▼       ▼       ▼                               │
 Project  Game    AI conv                           │
 Import   Picker                                    │
 Options                                            │
    │                                               │
    ├── Connect integration                         │
    │      └── GitHub/GitLab/Figma/YouTube          │
    ├── Paste URL                                   │
    ├── Upload project                              │
    └── Chrome extension (coming soon)              │
                                                    │
                    ┌───────────────────────────────┘
                    │
                    ▼
            ┌───────────────┐
            │ QUICK ACTIONS │
            │ (by context)  │
            └───────────────┘
                    │
    ┌───────┬───────┼───────┬───────────────┐
    ▼       ▼       ▼       ▼
 Learn   Explore  Project  Default
 Context Context  Context  Context

─────────────────────────────────────────────────────────────────────────────

ALWAYS AVAILABLE:

┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Chat Input   │     │  Plus Menu    │     │  Drag & Drop  │
│  (free text)  │     │     (+)       │     │   (files)     │
└───────────────┘     └───────────────┘     └───────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      Primary Options                 More Integrations
      - Import URL                    - Create Image
      - Upload                        - GitHub
      - Help                          - GitLab
      - Clear                         - Figma
                                      - YouTube
                                      - Describe
                                      - Create Product
```

---

## Full Visual Map (All Options)

```
╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                            EMBER CHAT - COMPLETE USER FLOW MAP                                                         ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

                                                                    ┌─────────────────┐
                                                                    │  USER ARRIVES   │
                                                                    └────────┬────────┘
                                                                             │
                                              ┌──────────────────────────────┴──────────────────────────────┐
                                              ▼                                                             ▼
                                    ┌───────────────────┐                                         ┌───────────────────┐
                                    │     NEW USER      │                                         │  RETURNING USER   │
                                    └─────────┬─────────┘                                         └─────────┬─────────┘
                                              │                                                             │
                                              ▼                                                             │
                        ┌─────────────────────────────────────────┐                                         │
                        │           ONBOARDING SEQUENCE           │                                         │
                        │                                         │                                         │
                        │  "Hi! I'm Ember, your guide..."         │                                         │
                        │  "I'll be learning about you..."        │                                         │
                        │  "Let's create your avatar."            │                                         │
                        │                                         │                                         │
                        │  ┌─────────────┐   ┌─────────────┐      │                                         │
                        │  │Create Avatar│   │Skip for now │      │                                         │
                        │  └──────┬──────┘   └──────┬──────┘      │                                         │
                        │         │                 │             │                                         │
                        │         ▼                 │             │                                         │
                        │   Avatar Flow ────────────┘             │                                         │
                        └─────────────────────────────────────────┘                                         │
                                              │                                                             │
                                              └──────────────────────────────┬──────────────────────────────┘
                                                                             │
                              ┌──────────────────────────────────────────────┴──────────────────────────────────────────────┐
                              ▼                                                                                             ▼
              ┌───────────────────────────────────────────────────────────┐                     ┌───────────────────────────────────────────────────────────┐
              │                    EMBEDDED CHAT (Home Page)              │                     │                    SIDEBAR CHAT (Overlay)                 │
              │                                                           │                     │                                                           │
              │   "Good morning/afternoon/evening, {name}!"               │                     │          Opens with context-aware quick actions           │
              │   + one of 6 greeting variations                          │                     │                                                           │
              └─────────────────────────┬─────────────────────────────────┘                     └─────────────────────────┬─────────────────────────────────┘
                                        │                                                                                 │
                                        ▼                                                                                 │
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐                 │
│                                    FEELING PILLS (up to 4 shown)                                       │                 │
│                                                                                                        │                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  ┌─────────────────────────┐ │                 │
│  │ Share something I've been       │  │ Play a game                     │  │ See this week's         │ │                 │
│  │ working on                      │  │                                 │  │ challenge               │ │                 │
│  │              │                  │  │              │                  │  │            │            │ │                 │
│  │              ▼                  │  │              ▼                  │  │            ▼            │ │                 │
│  │     PROJECT IMPORT OPTIONS      │  │        GAME PICKER              │  │  → "Show me this        │ │                 │
│  │     (see detail below)          │  │        (see detail below)       │  │     week's challenge"   │ │                 │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  └─────────────────────────┘ │                 │
│                                                                                                        │                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  ┌─────────────────────────┐ │                 │
│  │ Learn something new             │  │ Sell a product or service       │  │ Explore what others     │ │                 │
│  │            │                    │  │            │                    │  │ are making              │ │                 │
│  │            ▼                    │  │            ▼                    │  │            │            │ │                 │
│  │  → "I want to learn something   │  │  → "I want to sell a product    │  │            ▼            │ │                 │
│  │     new about AI"               │  │     or service"                 │  │  → "Show me what others │ │                 │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │     are making"         │ │                 │
│                                                                            └─────────────────────────┘ │                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  ┌─────────────────────────┐ │                 │
│  │ Connect with others             │  │ Personalize my experience       │  │ What's trending today?  │ │                 │
│  │            │                    │  │            │                    │  │            │            │ │                 │
│  │            ▼                    │  │            ▼                    │  │            ▼            │ │                 │
│  │  → "Help me find people to      │  │  → "Help me personalize my      │  │  → "Show me what's      │ │                 │
│  │     connect with"               │  │     AllThrive experience"       │  │     trending today"     │ │                 │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  └─────────────────────────┘ │                 │
│                                                                                                        │                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐                              │                 │
│  │ Give me a quick win             │  │ Make my avatar                  │                              │                 │
│  │            │                    │  │ (only if no avatar)             │                              │                 │
│  │            ▼                    │  │            │                    │                              │                 │
│  │  → "I want a quick win to       │  │            ▼                    │                              │                 │
│  │     start my day"               │  │     Avatar Creation Flow        │                              │                 │
│  └─────────────────────────────────┘  └─────────────────────────────────┘                              │                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘                 │
                                                                                                                           │
                                                                                                                           │
                ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                    CONTEXT-AWARE QUICK ACTIONS (Sidebar)                                                               │
│                                                                                                                                                        │
│   ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐  ┌────────────────────────┐│
│   │         LEARN CONTEXT               │  │        EXPLORE CONTEXT              │  │        PROJECT CONTEXT              │  │    DEFAULT CONTEXT     ││
│   │                                     │  │                                     │  │                                     │  │                        ││
│   │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  ┌────────────────────┐││
│   │  │ Learn AI Basics             │    │  │  │ Trending Projects           │    │  │  │ Paste a URL                 │    │  │  │ I need help        │││
│   │  │ → "Teach me the basics      │    │  │  │ → "Show me trending         │    │  │  │ → "I want to import a       │    │  │  │ → "I need help     │││
│   │  │    of AI"                   │    │  │  │    projects"                 │    │  │  │    project from a URL"      │    │  │  │    with something" │││
│   │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  └────────────────────┘││
│   │                                     │  │                                     │  │                                     │  │                        ││
│   │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  ┌────────────────────┐││
│   │  │ Quiz Me                     │    │  │  │ Find Projects               │    │  │  │ Make Infographic            │    │  │  │ I don't know what  │││
│   │  │ → "Give me a quick quiz     │    │  │  │ → "Help me find interesting │    │  │  │ → "Help me create an image  │    │  │  │ to do next         │││
│   │  │    on what I've learned"    │    │  │  │    projects"                 │    │  │  │    or infographic"          │    │  │  │ → "What can I do   │││
│   │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  │    on AllThrive?"  │││
│   │                                     │  │                                     │  │                                     │  │  └────────────────────┘││
│   │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │                        ││
│   │  │ My Progress                 │    │  │  │ Recommend For Me            │    │  │  │ From GitHub                 │    │  │  ┌────────────────────┐││
│   │  │ → "Show me my learning      │    │  │  │ → "Recommend projects based │    │  │  │ → "I want to import a       │    │  │  │ I want to do       │││
│   │  │    progress"                │    │  │  │    on my interests"         │    │  │  │    project from GitHub"     │    │  │  │ something fun      │││
│   │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  │ → "Suggest some-   │││
│   │                                     │  │                                     │  │                                     │  │  │    thing fun for   │││
│   │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  ┌─────────────────────────────┐    │  │  │    me to do"       │││
│   │  │ What Next?                  │    │  │  │ Similar Projects            │    │  │  │ Upload Media                │    │  │  └────────────────────┘││
│   │  │ → "What should I learn      │    │  │  │ → "Find projects similar to │    │  │  │ → "I want to upload media   │    │  │                        ││
│   │  │    next?"                   │    │  │  │    what I've liked"         │    │  │  │    to create a project"     │    │  │                        ││
│   │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │  └─────────────────────────────┘    │  │                        ││
│   └─────────────────────────────────────┘  └─────────────────────────────────────┘  └─────────────────────────────────────┘  └────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                         PROJECT IMPORT OPTIONS (Detail)                                                                │
│                                                                                                                                                        │
│                                          Ember: "Great! I'd love to see what you've been creating."                                                    │
│                                                                                                                                                        │
│   ┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐               │
│   │      Connect to an integration          │  │           Paste in a URL                 │  │           Upload a project              │               │
│   │                                         │  │                                          │  │                                         │               │
│   │  "Pull from GitHub, GitLab,             │  │  "Import from any website or             │  │  "Upload images, files, or              │               │
│   │   Figma, or YouTube"                    │  │   repository URL"                        │  │   documents directly"                   │               │
│   │              │                          │  │              │                           │  │              │                          │               │
│   │              ▼                          │  │              ▼                           │  │              ▼                          │               │
│   │  ┌───────────────────────────────────┐  │  │  → "I want to import a project          │  │     Opens file picker dialog            │               │
│   │  │       INTEGRATION PICKER          │  │  │     from a URL"                         │  │                                         │               │
│   │  │                                   │  │  │                                          │  │                                         │               │
│   │  │  ┌────────┐ ┌────────┐            │  │  │     AI analyzes URL and imports         │  │     Supports images, videos,            │               │
│   │  │  │ GitHub │ │ GitLab │            │  │  │                                          │  │     documents                           │               │
│   │  │  │   │    │ │   │    │            │  │  └──────────────────────────────────────────┘  └─────────────────────────────────────────┘               │
│   │  │  │   ▼    │ │   ▼    │            │  │                                                                                                          │
│   │  │  │ OAuth  │ │ OAuth  │            │  │  ┌─────────────────────────────────────────┐                                                             │
│   │  │  │   │    │ │   │    │            │  │  │          Chrome extension               │                                                             │
│   │  │  │   ▼    │ │   ▼    │            │  │  │                                         │                                                             │
│   │  │  │ Select │ │ Select │            │  │  │  "Install our extension to easily       │                                                             │
│   │  │  │ repo   │ │project │            │  │  │   import from anywhere"                 │                                                             │
│   │  │  │   │    │ │   │    │            │  │  │              │                          │                                                             │
│   │  │  │   ▼    │ │   ▼    │            │  │  │              ▼                          │                                                             │
│   │  │  │Import  │ │Import  │            │  │  │       COMING SOON modal                 │                                                             │
│   │  │  └────────┘ └────────┘            │  │  └─────────────────────────────────────────┘                                                             │
│   │  │                                   │  │                                                                                                          │
│   │  │  ┌────────┐ ┌────────┐            │  │                                                                                                          │
│   │  │  │ Figma  │ │YouTube │            │  │                                                                                                          │
│   │  │  │   │    │ │   │    │            │  │                                                                                                          │
│   │  │  │   ▼    │ │   ▼    │            │  │                                                                                                          │
│   │  │  │ OAuth  │ │ Paste  │            │  │                                                                                                          │
│   │  │  │   │    │ │ video  │            │  │                                                                                                          │
│   │  │  │   ▼    │ │  URL   │            │  │                                                                                                          │
│   │  │  │Paste   │ │   │    │            │  │                                                                                                          │
│   │  │  │URL     │ │   ▼    │            │  │                                                                                                          │
│   │  │  │   │    │ │Import  │            │  │                                                                                                          │
│   │  │  │   ▼    │ └────────┘            │  │                                                                                                          │
│   │  │  │Import  │                       │  │                                                                                                          │
│   │  │  └────────┘                       │  │                                                                                                          │
│   │  └───────────────────────────────────┘  │                                                                                                          │
│   └─────────────────────────────────────────┘                                                                                                          │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                              GAME PICKER (Detail)                                                                      │
│                                                                                                                                                        │
│                                                  ┌─────────────────────────────────────────┐                                                           │
│                                                  │           GAME PICKER MODAL             │                                                           │
│                                                  │                                         │                                                           │
│                                                  │  ┌─────────────────┐ ┌─────────────────┐│                                                           │
│                                                  │  │  Context Snake  │ │  AI Trivia Quiz ││                                                           │
│                                                  │  │                 │ │                 ││                                                           │
│                                                  │  │  Classic snake  │ │  Test your AI   ││                                                           │
│                                                  │  │  with AI twist  │ │  knowledge      ││                                                           │
│                                                  │  └─────────────────┘ └─────────────────┘│                                                           │
│                                                  │                                         │                                                           │
│                                                  │  ┌─────────────────┐ ┌─────────────────┐│                                                           │
│                                                  │  │ Ethics Defender │ │  Prompt Battle  ││                                                           │
│                                                  │  │                 │ │                 ││                                                           │
│                                                  │  │  Explore AI     │ │  Compete in     ││                                                           │
│                                                  │  │  ethics         │ │  prompting      ││                                                           │
│                                                  │  └─────────────────┘ └─────────────────┘│                                                           │
│                                                  └─────────────────────────────────────────┘                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                      PLUS MENU (+) - Always Available                                                                  │
│                                                                                                                                                        │
│   ┌───────────────────────────────────────────────────────────────┐  ┌───────────────────────────────────────────────────────────────┐                 │
│   │                      PRIMARY OPTIONS                          │  │                    MORE INTEGRATIONS                          │                 │
│   │                                                               │  │                                                               │                 │
│   │  ┌─────────────────────────────────────────────────────────┐  │  │  ┌─────────────────────────────────────────────────────────┐  │                 │
│   │  │ Import from URL                                         │  │  │  │ Create Image/Infographic                                │  │                 │
│   │  │ → "I want to import a project from a URL"               │  │  │  │ → "Help me create an image or infographic"              │  │                 │
│   │  └─────────────────────────────────────────────────────────┘  │  │  └─────────────────────────────────────────────────────────┘  │                 │
│   │                                                               │  │                                                               │                 │
│   │  ┌─────────────────────────────────────────────────────────┐  │  │  ┌─────────────────────────────────────────────────────────┐  │                 │
│   │  │ Upload Image or Video                                   │  │  │  │ Add from GitHub                                         │  │                 │
│   │  │ → Opens file picker                                     │  │  │  │ → Starts GitHub OAuth flow                              │  │                 │
│   │  └─────────────────────────────────────────────────────────┘  │  │  └─────────────────────────────────────────────────────────┘  │                 │
│   │                                                               │  │                                                               │                 │
│   │  ┌─────────────────────────────────────────────────────────┐  │  │  ┌─────────────────────────────────────────────────────────┐  │                 │
│   │  │ Ask for Help                                            │  │  │  │ Add from GitLab                                         │  │                 │
│   │  │ → "I need help with something"                          │  │  │  │ → Starts GitLab OAuth flow                              │  │                 │
│   │  └─────────────────────────────────────────────────────────┘  │  │  └─────────────────────────────────────────────────────────┘  │                 │
│   │                                                               │  │                                                               │                 │
│   │  ┌─────────────────────────────────────────────────────────┐  │  │  ┌─────────────────────────────────────────────────────────┐  │                 │
│   │  │ Clear Conversation                                      │  │  │  │ Add from Figma                                          │  │                 │
│   │  │ → Clears chat, resets to greeting                       │  │  │  │ → Starts Figma OAuth flow                               │  │                 │
│   │  └─────────────────────────────────────────────────────────┘  │  │  └─────────────────────────────────────────────────────────┘  │                 │
│   │                                                               │  │                                                               │                 │
│   └───────────────────────────────────────────────────────────────┘  │  ┌─────────────────────────────────────────────────────────┐  │                 │
│                                                                      │  │ Add from YouTube                                        │  │                 │
│                                                                      │  │ → "I want to import a YouTube video as a project"       │  │                 │
│                                                                      │  └─────────────────────────────────────────────────────────┘  │                 │
│                                                                      │                                                               │                 │
│                                                                      │  ┌─────────────────────────────────────────────────────────┐  │                 │
│                                                                      │  │ Describe Anything                                       │  │                 │
│                                                                      │  │ → "I want to describe a project to create"              │  │                 │
│                                                                      │  └─────────────────────────────────────────────────────────┘  │                 │
│                                                                      │                                                               │                 │
│                                                                      │  ┌─────────────────────────────────────────────────────────┐  │                 │
│                                                                      │  │ Create Product (admins/creators only)                   │  │                 │
│                                                                      │  │ → Coming Soon                                           │  │                 │
│                                                                      │  └─────────────────────────────────────────────────────────┘  │                 │
│                                                                      │                                                               │                 │
│                                                                      └───────────────────────────────────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                         LEARNING GOAL SELECTION                                                                        │
│                                                                                                                                                        │
│                                          Ember: "Hey there! I'm Ember, your AI learning companion."                                                    │
│                                          "What brings you here today? This helps me personalize your learning path."                                   │
│                                                                                                                                                        │
│   ┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐                     │
│   │        Build AI Projects              │  │      Understand AI Concepts           │  │       Career Exploration              │                     │
│   │              🚀                        │  │              💡                        │  │              💼                        │                     │
│   │                                       │  │                                       │  │                                       │                     │
│   │  "Get hands-on with tools like        │  │  "Learn the fundamentals of AI        │  │  "Discover how AI can boost your      │                     │
│   │   LangChain and build real            │  │   models, prompting, and workflows."  │  │   productivity and career."           │                     │
│   │   applications."                      │  │                                       │  │                                       │                     │
│   └───────────────────────────────────────┘  └───────────────────────────────────────┘  └───────────────────────────────────────┘                     │
│                                                                                                                                                        │
│                                              ┌───────────────────────────────────────┐                                                                 │
│                                              │          Just Exploring               │                                                                 │
│                                              │              🧭                        │                                                                 │
│                                              │                                       │                                                                 │
│                                              │  "I'm curious about AI and want       │                                                                 │
│                                              │   to look around."                    │                                                                 │
│                                              └───────────────────────────────────────┘                                                                 │
│                                                                                                                                                        │
│                                              ┌───────────────────────────────────────┐                                                                 │
│                                              │  "Skip for now - I'll figure it out   │                                                                 │
│                                              │   as I go"                            │                                                                 │
│                                              └───────────────────────────────────────┘                                                                 │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                            ALWAYS AVAILABLE                                                                            │
│                                                                                                                                                        │
│   ┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐  ┌───────────────────────────────────────┐                     │
│   │           Chat Input                  │  │           Drag & Drop                 │  │          Slash Commands               │                     │
│   │                                       │  │                                       │  │                                       │                     │
│   │   Free-form text input                │  │   Drop files anywhere in chat         │  │   /clear - Clear conversation        │                     │
│   │   → Ember responds conversationally   │  │   → Triggers upload flow              │  │   → Resets to greeting                │                     │
│   └───────────────────────────────────────┘  └───────────────────────────────────────┘  └───────────────────────────────────────┘                     │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Slash Commands

Available in chat input:
- `/clear` - Clears conversation and resets to greeting

---

## File References

Frontend components:
- `frontend/src/components/chat/layouts/EmbeddedChatLayout.tsx` - Home page chat
- `frontend/src/components/chat/layouts/SidebarChatLayout.tsx` - Sidebar chat
- `frontend/src/components/chat/ChatPlusMenu.tsx` - Plus menu
- `frontend/src/components/chat/onboarding/OnboardingIntroMessage.tsx` - Onboarding
- `frontend/src/components/chat/onboarding/LearningGoalSelectionMessage.tsx` - Learning goals
- `frontend/src/components/chat/messages/ProjectImportOptionsMessage.tsx` - Import options

Backend:
- `services/agents/ember/agent.py` - Main Ember agent
- `services/agents/ember/prompts.py` - System prompts
- `services/agents/ember/tools.py` - Available tools
