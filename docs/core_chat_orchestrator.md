# Core Chat Orchestrator: LangGraph + LangChain

## Purpose

This document describes the design for the **core chat orchestrator** that powers the right-sidebar chat. The goal is to provide a single entrypoint where users can talk to many specialized AI agents (support, profile, projects, navigation, etc.) while the system uses **LangGraph + LangChain** to orchestrate tools and workflows behind the scenes.

The orchestrator should feel similar to Figma Make: users can ask it to "do things" in the product (configure profile, create projects, navigate to pages) instead of only answering questions.

---

## High-Level Goals

1. **Single universal chat entrypoint**  
   All user conversations with AI agents happen through the right-sidebar chat.

2. **Multi-agent orchestration**  
   The system routes each request to one or more domain-specific AI agents: Support, Profile, Projects, Navigation, etc.

3. **Tool-rich and product-aware**  
   AI agents can call tools that:
   - Read and update user profiles
   - Create and manage projects
   - Search documentation and support content
   - Trigger navigation and UI actions

4. **Safe, predictable UX**  
   The orchestrator must be deterministic enough to embed in the UI: bounded per-turn execution, guardrails for destructive actions, and explicit confirmation flows.

5. **Observable and debuggable**  
   Each step of the orchestration should be transparent: which agent handled a request, which tools were called, and what actions were sent back to the UI.

---

## Why LangGraph + LangChain

We choose **LangGraph** (built on **LangChain**) as the core orchestration framework.

### Reasons

- **Explicit graph model**  
  We can represent the system as a graph of nodes (AI agents, control logic, aggregators) and edges (routing rules). This makes it easy to see and control the flow of a single chat turn.

- **Fits existing LangChain usage**  
  Tools, retrievers, and model configuration are already based on LangChain patterns. LangGraph lets us reuse those building blocks instead of adopting a parallel agent framework.

- **Strong control over state**  
  LangGraph state allows us to track per-user and per-conversation context (page route, selected project, profile progress, active flows), which is essential for a UI-integrated chat.

- **Tool- and agent-centric**  
  Each node can be an AI agent with a focused tool set. The orchestrator can route among many AI agents and tools without exposing a single flat tool soup.

- **Streaming-friendly**  
  LangGraph supports streaming outputs, which is required for responsive chat in the right sidebar.

### Relationship to CrewAI

CrewAI is also designed for many agents and tools, but its sweet spot is autonomous or semi-autonomous crews that collaborate to finish tasks, often in the background.

The right-sidebar chat, by contrast, is:

- Turn-based and UI-driven (one user message → bounded graph run → text + UI actions).
- Strongly constrained by application state and navigation.
- Focused on safely driving the product, not only autonomous task completion.

LangGraph’s explicit graph and state model are a better fit for this UI-embedded orchestrator. CrewAI can still be integrated in the future as a specialized backend workflow engine if needed.

---

## Architectural Overview

### Core components

1. **Orchestrator Graph (LangGraph)**  
   The main entrypoint for the right-sidebar chat. It:
   - Receives user messages and current app context
   - Routes to domain-specific AI agents
   - Aggregates outputs
   - Emits both text responses and structured UI actions

2. **Domain AI Agents (Graph Nodes)**  
   Each domain is modeled as an AI agent node with a focused tool set:
   - `SupportAgent` – product questions, troubleshooting, docs search
   - `ProfileAgent` – reading/updating user profiles, guiding profile completion
   - `ProjectsAgent` – creating and managing projects
   - `NavigationAgent` – emitting navigation and UI actions
   - `PlannerAgent` (optional) – decomposing complex multi-step user requests

3. **Tool Layer (LangChain Tools)**  
   Each AI agent exposes a limited set of tools that wrap existing backend functionality (Django services, APIs, database operations). Examples:
   - `get_user_profile`, `update_user_profile`
   - `list_projects`, `create_project`, `update_project`
   - `search_docs`, `create_support_ticket`
   - `navigate_to`, `open_modal`, `focus_entity`

4. **State Store**  
   LangGraph state holds per-conversation and per-user context, such as:
   - User id and auth context
   - Active route and page-level context
   - Selected project, profile completeness, and active flows
   - Short- and long-term chat memory

5. **Frontend Integration Layer**  
   A backend endpoint (e.g. `POST /api/v1/agent-chat/stream`) serves as the bridge between the right-sidebar chat and the orchestrator graph. It:
   - Receives `{ message, user_id, route, ui_context }`
   - Starts a LangGraph run
   - Streams back:
     - Chat deltas (for text)
     - Structured actions (for navigation and UI changes)

---

## AI Agents and Responsibilities

Below is a first-pass design for core AI agents.

### 1. OrchestratorAgent

**Role:** Entrypoint and router for every user message.

**Responsibilities:**

- Interpret the current user message in the context of:
  - Conversation history
  - Current route/page
  - User profile and project context
- Decide whether the request is:
  - Support / help
  - Profile-related
  - Project-related
  - Pure navigation / layout
  - Multi-step (needing planning)
- Route the request to appropriate downstream nodes:
  - Single agent (simple case)
  - Sequence of agents (multi-step flows)
- Provide a high-level summary/plan when the request is complex.

### 2. SupportAgent

**Role:** Answer product questions and troubleshoot issues.

**Typical tools:**

- `search_docs(query)` – search internal docs and knowledge base.
- `get_known_issues(context)` – look up known issues based on product context.
- `create_support_ticket(payload)` – file a support ticket when needed.

**Behavior:**

- Answer “how do I…” and “why is this broken…” types of questions.
- When necessary, call `create_support_ticket` and then hand off to NavigationAgent to open the ticket details page or related view in the UI.

### 3. ProfileAgent

**Role:** Help users create and maintain rich profiles.

**Typical tools:**

- `get_user_profile(user_id)`
- `update_user_profile(user_id, fields)`
- `suggest_profile_improvements(user_id)`

**Behavior:**

- Run guided flows like “let’s finish your profile step by step.”
- Ask targeted questions to fill missing profile fields.
- Coordinate with NavigationAgent to open profile-related pages and surface context to the user.

### 4. ProjectsAgent

**Role:** Create and manage projects.

**Typical tools:**

- `list_projects(user_id)`
- `create_project(user_id, name, config)`
- `update_project(project_id, fields)`
- `archive_project(project_id)` (with confirmation)

**Behavior:**

- Implement natural-language commands like:
  - “Create a new project for my marketing team.”
  - “Rename my latest project and enable feature X.”
- Trigger NavigationAgent to:
  - Open the new or updated project
  - Highlight relevant tabs or sections

### 5. NavigationAgent

**Role:** Bridge between chat and UI.

**Typical tools (returning structured UI actions):**

- `navigate_to(route_name, params)` – e.g. `/projects/{id}`, `/settings/profile`
- `open_modal(modal_name, params)` – e.g. project creation, collaborator invites
- `focus_entity(entity_type, entity_id)` – highlight or focus a specific entity in the page

**Behavior:**

- Translate high-level language (“take me to my new project”, “open profile settings”) into concrete actions the frontend can execute.
- Ensure that navigation remains predictable and reversible.

### 6. PlannerAgent (Optional)

**Role:** Handle complex, multi-step user requests.

**Behavior:**

- Given a high-level goal (“Set up a new project for my team, invite Alice and Bob, and update my role to Founder”), produce a step-by-step plan.
- Invoke other agents (ProfileAgent, ProjectsAgent, NavigationAgent) in sequence.
- Track progress in graph state so that partial work can be resumed or rolled back.

---

## Tool Design Principles

- **Domain-scoped tool sets**  
  Each AI agent only sees tools relevant to its domain. This prevents confusion and tool overload.

- **Typed, JSON-based interfaces**  
  Tool inputs and outputs should be defined with clear schemas. This helps with reliability and allows validation before executing real side effects.

- **Separation from core business logic**  
  Tools should wrap existing services or APIs rather than duplicate logic. For example:
  - `update_user_profile` calls a backend service method or API endpoint.
  - `create_project` delegates to an existing project service.

- **Side-effect boundaries**  
  Potentially destructive tools (e.g., archiving or deleting data) should:
  - Require explicit user confirmation steps.
  - Be gated by policy checks in code, not only by model instructions.

---

## State Model

LangGraph state will include at least:

- **User & auth context:** user id, permissions, relevant flags.
- **Conversation context:** history summary, last agent, last intent.
- **UI context:** current route, selected entities (project id, etc.), open modals.
- **Active flows:** any ongoing multi-step processes (e.g., profile completion, onboarding, configuration wizards).

A simplified example state shape:

```json
{
  "user_id": "...",
  "conversation_id": "...",
  "route": "/projects/123",
  "ui_context": {
    "selected_project_id": "123",
    "panel": "details"
  },
  "profile_snapshot": {
    "role": "Founder",
    "setup_completed": false
  },
  "active_flows": [
    {
      "id": "profile_setup_1",
      "type": "profile_completion",
      "status": "in_progress",
      "pending_questions": ["company_size", "industry"]
    }
  ]
}
```

State can be stored in Redis or another backing store, with LangGraph reading and writing it for each run.

---

## Request / Response Shape

### Request from frontend to orchestrator

The right-sidebar chat sends a request similar to:

```json
{
  "message": "Create a new project for my growth team and update my role to Founder.",
  "user_id": "user_123",
  "conversation_id": "conv_456",
  "route": "/projects",
  "ui_context": {
    "selected_project_id": null
  }
}
```

### Streaming response from orchestrator

The orchestrator streams back events that the frontend interprets:

```json
{
  "type": "message_delta",
  "content": "Got it — I’ll set up a new project for your growth team and update your profile."
}
```

```json
{
  "type": "action",
  "action": {
    "type": "NAVIGATE",
    "route": "/projects/789",
    "params": {"tab": "settings"}
  }
}
```

```json
{
  "type": "message_delta",
  "content": "I’ve created your project and updated your role to Founder. You’re now viewing the new project."
}
```

The frontend chat component renders `message_delta` events as user-visible messages and passes `action` events to an application-level handler that updates the UI.

---

## Control Flow per Chat Turn

At a high level, a single user turn proceeds as follows:

1. **Frontend → Backend**  
   Right-sidebar chat sends the message + context to the orchestrator endpoint.

2. **Router Node (OrchestratorAgent)**  
   - Interprets intent.
   - Chooses target agent(s) and overall strategy (simple route vs multi-step plan).

3. **Domain Agent Node(s)**  
   One or more domain agents run:
   - Call their tools via LangChain.
   - Modify graph state as needed.
   - Emit natural-language partial responses and/or structured actions.

4. **NavigationAgent (if applicable)**  
   - Converts navigation requests into structured actions.

5. **Aggregator Node**  
   - Merges outputs into a consistent stream for the frontend.

6. **Backend → Frontend**  
   - Streams back messages and actions until the turn is complete.

---

## Safety, Guardrails, and Observability

- **Guardrails**  
  - Confirmation for destructive actions (e.g., archiving or deleting data).
  - Policy checks inside tools (not only in prompts).

- **Observability**  
  - Logging per graph run: which agents ran, which tools were called, durations, and errors.
  - Metrics around success/failure rates per intent and per agent.

- **Testing**  
  - Unit tests for tools.
  - Scenario tests for orchestrator flows (e.g., full profile setup via chat, new project creation, navigation flows).

---

## Phased Rollout Plan

1. **Phase 1: Minimal Orchestrator**  
   - Implement OrchestratorAgent, SupportAgent, and ProjectsAgent.
   - Add a small set of safe tools (e.g., `list_projects`, `search_docs`).
   - Wire up right-sidebar chat to the orchestrator with streaming text responses only.

2. **Phase 2: Navigation Integration**  
   - Add NavigationAgent and navigation tools.
   - Extend streaming protocol to include structured `action` events.
   - Implement UI handlers for navigation and modal actions.

3. **Phase 3: Profile and Onboarding Flows**  
   - Add ProfileAgent and basic profile-completion flows.
   - Ensure flows are resumable using LangGraph state.

4. **Phase 4: Planner and Complex Workflows**  
   - Introduce PlannerAgent to decompose complex, multi-step requests.
   - Add more tools and flows as needed.

5. **Phase 5: Optimization and Hardening**  
   - Add safeguards, better observability, and scenario tests.
   - Tune routing, prompts, and tool design based on real usage.

---

This design makes the right-sidebar chat the central orchestrator of many specialized AI agents and tools, using LangGraph + LangChain as the backbone for stateful, product-aware, and testable multi-agent behavior.