# Gemini "Nano Banana" Implementation Plan

## Executive Summary

This document outlines the plan to implement the "Nano Banana" agent for the "Build Something New" feature, powered by **Google's Gemini 3 Pro** (or latest available equivalent) and **Image Generation** capabilities. The goal is to allow users to creatively brainstorm and structure new projects with AI assistance.

## 1. Architecture Updates

### 1.1 Backend Dependencies
To support Google's ecosystem, we will need to update `requirements.txt`:
-   `langchain-google-genai`: For LangChain integration.
-   `google-generativeai`: The core Google GenAI SDK.

### 1.2 AI Provider Service (`services/ai_provider.py`)
We will extend the `AIProvider` class to support a new `GOOGLE` provider type.

-   **Configuration**:
    -   `GOOGLE_API_KEY`: API credential.
    -   `GOOGLE_MODEL_NAME`: Configurable, targeting `gemini-1.5-pro` (or `gemini-3-pro` if available/released).
-   **Image Generation**:
    -   Add a `generate_image(prompt)` method to `AIProvider`.
    -   Implement using Google's **Imagen 3** (via Vertex AI or Gemini API image capability).

## 2. "Nano Banana" Agent Design

### 2.1 Agent Persona & Logic
-   **Name**: Nano Banana 🍌
-   **Role**: Creative Architect & Builder.
-   **Location**: `services/nano_banana_agent/`

### 2.2 LangGraph Workflow
The agent will use a state graph to manage the creative process:

1.  **Initialization**:
    -   User clicks "Build Something New".
    -   Agent greets with a creative, banana-themed opening.
2.  **Brainstorming Node**:
    -   **Input**: User's vague idea (e.g., "I want a fitness app").
    -   **Process**: Agent uses **Gemini Pro** to generate 3 distinct concepts.
    -   **Output**: Options presented to user.
3.  **Detailing Node**:
    -   User selects a concept.
    -   Agent fleshes out details: Title, Tagline, Description, Core Features.
4.  **Visualization Node (Image Gen)**:
    -   **Action**: Agent creates a visual prompt based on the concept.
    -   **Scope**: Visuals must be **Flow Charts**, **Infographics**, or illustrative **Images**.
    -   **Tool**: Calls `generate_image` (using Imagen 3).
    -   **Result**: A unique project thumbnail/banner.
5.  **Finalization Node**:
    -   Agent compiles everything into a JSON structure.
    -   Calls `create_project` tool to save it to the database.

### 2.3 System Prompt Requirements
The system prompt must explicitly define the valid project types the user can create to ensure data consistency.

**Valid Project Types:**
1.  **GitHub Repository** (`github_repo`): For software projects hosted on GitHub.
2.  **Figma Design** (`figma_design`): For UI/UX designs.
3.  **Image Collection** (`image_collection`): For visual portfolios or photography.
4.  **Prompt / Conversation** (`prompt`): For AI interactions or prompt engineering.
5.  **Other** (`other`): For general projects or ideas not fitting the above.

The agent should guide the user to categorize their new project into one of these buckets during the "Finalization" phase.

## 3. Frontend Implementation

### 3.1 Add Project Panel (`RightAddProjectChat.tsx`)
-   **Build Option**: Wire the "Build Something New" button to initiate the Nano Banana chat.
-   **Streaming**: Ensure the chat interface supports streaming text from Gemini.
-   **Image Display**: Render the generated project thumbnail in the chat for user approval before saving.

### 3.2 Chat UI
-   Use a specific "Nano Banana" avatar.
-   Support markdown rendering for rich project descriptions.

## 4. Configuration

**Environment Variables (`.env`):**
```bash
DEFAULT_AI_PROVIDER=google
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL_NAME=gemini-1.5-pro-002  # Using latest Pro model
GOOGLE_IMAGE_MODEL=imagen-3.0-generate-001
```

## 5. Step-by-Step Execution Plan

1.  **Setup**: Install Google SDKs and configure `AIProvider`.
2.  **Agent Core**: Build the `NanoBanana` LangGraph using Gemini Pro for text.
3.  **Image Tool**: Implement the image generation tool using Imagen.
4.  **API**: Create the endpoint to expose this agent.
5.  **UI**: Connect the frontend "Build" button to this new flow.
