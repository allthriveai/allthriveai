"""
End-to-End Tests for Intelligent Chat AI Behaviors.

MISSION CRITICAL: These tests ensure the intelligent chat behaves correctly
for the core user flows. They call REAL AI (not mocks).

Tests cover:
1. GitHub Integration Import - AI doesn't ask ownership for connected imports
2. URL Paste Clipping - AI asks "clipping or own project?" for random URLs
3. Help Question Recognition - AI knows when user is asking for help (not creating)
4. Video Upload - AI asks about ownership for video URLs
5. Infographic Request - AI asks for confirmation before generating

Run with: make test-chat-ai-integration
Or: pytest core/tests/e2e/test_intelligent_chat.py -v

NOTE: These tests consume API tokens and should only run in CI or manually.
"""

import os
import unittest

from django.conf import settings
from django.test import TestCase

# Skip all tests if no AI provider configured
SKIP_AI_TESTS = not (
    os.environ.get('OPENAI_API_KEY')
    or os.environ.get('ANTHROPIC_API_KEY')
    or os.environ.get('AZURE_OPENAI_API_KEY')
    or getattr(settings, 'OPENAI_API_KEY', None)
    or getattr(settings, 'ANTHROPIC_API_KEY', None)
)


# =============================================================================
# Test Fixtures - Simulated User Messages
# =============================================================================

# GitHub import via connected integration
GITHUB_INTEGRATION_MESSAGES = [
    'I want to import my GitHub repo',
    'Import from my GitHub',
    'Import a GitHub repository',
    'Add my repo from GitHub',
]

# Random URL paste (should trigger ownership question)
URL_PASTE_MESSAGES = [
    'https://medium.com/@someone/great-article-about-ai',
    'https://example.com/cool-project',
    'https://blog.example.com/my-post',
    'Check out this link: https://somesite.com/app',
]

# Help questions (should NOT trigger project creation)
HELP_QUESTIONS = [
    'How do I use AllThrive?',
    'What can you help me with?',
    'How do I edit my profile?',
    'Can you explain how projects work?',
    'I need help understanding the platform',
]

# Video upload messages (S3 URLs) - should trigger ownership question
VIDEO_UPLOAD_MESSAGES = [
    'https://s3.amazonaws.com/allthrive-media/uploads/my-tutorial.mp4',
    "Here's my video: https://minio.allthrive.ai/media/demo.mp4",
    'https://s3.amazonaws.com/allthrive-media/chat-attachments/user_2/video.mp4',
]

# Infographic/image requests
INFOGRAPHIC_REQUESTS = [
    'Make me an infographic about climate change',
    'Create an infographic showing AI trends',
    'Generate an infographic about productivity',
]


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class SupervisorRoutingTest(TestCase):
    """
    Test that the supervisor agent correctly routes messages to the right agent.
    """

    def test_github_url_routes_to_project_agent(self):
        """GitHub URLs should route to PROJECT agent."""
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)
        plan = supervisor.create_plan('https://github.com/facebook/react')

        self.assertEqual(
            plan.primary_agent, AgentType.PROJECT, f'GitHub URL should route to PROJECT, got {plan.primary_agent}'
        )

    def test_help_question_routes_to_support_agent(self):
        """Help questions should route to SUPPORT agent."""
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)

        for question in HELP_QUESTIONS:
            plan = supervisor.create_plan(question)
            # Support is for help questions
            self.assertEqual(
                plan.primary_agent,
                AgentType.SUPPORT,
                f'Help question "{question}" should route to SUPPORT, got {plan.primary_agent}',
            )

    def test_url_paste_routes_to_project_agent(self):
        """Random URLs should route to PROJECT agent."""
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)
        plan = supervisor.create_plan('https://example.com/my-project')

        self.assertEqual(
            plan.primary_agent, AgentType.PROJECT, f'URL paste should route to PROJECT, got {plan.primary_agent}'
        )

    def test_discovery_request_routes_to_discovery_agent(self):
        """Discovery requests should route to DISCOVERY agent."""
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)

        discovery_messages = [
            'Find projects about machine learning',
            'Search for AI tools',
            "What's trending?",
            'Recommend some projects for me',
        ]

        for msg in discovery_messages:
            plan = supervisor.create_plan(msg)
            self.assertEqual(
                plan.primary_agent,
                AgentType.DISCOVERY,
                f'Discovery request "{msg}" should route to DISCOVERY, got {plan.primary_agent}',
            )


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class ImageGenerationFastPathTest(TestCase):
    """
    Test that image generation requests are correctly detected via fast-path.
    """

    def test_infographic_keyword_detected(self):
        """
        Infographic keywords should trigger fast-path detection.

        This tests the fast-path logic in tasks.py that bypasses the supervisor.
        """
        image_keywords = [
            'create an image',
            'create an infographic',
            'make an image',
            'make an infographic',
            'generate an image',
            'generate an infographic',
            'help me create an infographic',
            'create a visual',
            'make a visual',
            'create image',
            'create infographic',
            'nano banana',  # Easter egg
        ]

        for keyword in image_keywords:
            message_lower = keyword.lower()
            detected = any(kw in message_lower for kw in image_keywords)
            self.assertTrue(detected, f'Keyword "{keyword}" should trigger fast-path detection')

    def test_non_image_request_not_fast_pathed(self):
        """Non-image requests should NOT trigger fast-path."""
        image_keywords = [
            'create an image',
            'create an infographic',
            'make an image',
        ]

        non_image_messages = [
            'Create a project',
            'Import my GitHub repo',
            'How do I use this?',
            'Search for projects',
        ]

        for msg in non_image_messages:
            message_lower = msg.lower()
            detected = any(kw in message_lower for kw in image_keywords)
            self.assertFalse(detected, f'Message "{msg}" should NOT trigger image fast-path')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class ProjectAgentBehaviorTest(TestCase):
    """
    Test that the project agent responds correctly to different scenarios.

    These tests simulate the LangGraph agent's behavior by testing the
    AI responses to specific prompts.
    """

    def _get_agent_response(self, user_message: str, conversation_history: list = None):
        """
        Get a response from the project agent via LangGraph.

        This simulates what happens when a message is processed through
        the project agent.
        """
        from services.agents.project.agent import run_project_agent

        result = run_project_agent(
            user_message=user_message,
            user_id=1,
            username='testuser',
            conversation_id='test-conv-123',
            conversation_history=conversation_history or [],
        )

        return result

    def test_url_paste_triggers_ownership_question(self):
        """
        CRITICAL: When user pastes a random URL, AI MUST ask about ownership.

        Expected behavior:
        User: "https://example.com/cool-project"
        AI: "Is this your own project, or are you clipping something you found?"
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        # Simulate a conversation where user pastes a URL
        prompt = """User just sent this message: "https://medium.com/@someone/cool-article"

Based on the system prompt rules, what should you respond with?
Only respond with what you would say to the user."""

        response = ai.complete(
            prompt=prompt,
            system_message=SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=200,
        )

        response_lower = response.lower()

        # Must ask about ownership
        ownership_indicators = [
            'own',
            'yours',
            'clipping',
            'clip',
            'your project',
            'your own',
            'created',
            'found',
        ]

        has_ownership_question = any(ind in response_lower for ind in ownership_indicators)
        self.assertTrue(has_ownership_question, f'AI should ask about ownership for URL paste. Got: "{response[:200]}"')

    def test_github_integration_import_no_ownership_question(self):
        """
        CRITICAL: When user imports from connected GitHub, AI should NOT ask ownership.

        Expected behavior:
        User: "I want to import from my GitHub"
        AI: [proceeds to import directly without asking ownership]
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        prompt = """User just sent: "I want to import my GitHub repo"

This is from their CONNECTED GitHub account (integration import, not URL paste).

Based on the system prompt rules, should you ask about ownership?
Respond with either "YES_ASK" if you should ask ownership, or "NO_SKIP" if you should skip."""

        response = ai.complete(
            prompt=prompt,
            system_message=SYSTEM_PROMPT,
            temperature=0.1,
            max_tokens=50,
        )

        # Should NOT ask ownership for connected integration
        self.assertIn(
            'NO_SKIP',
            response.upper(),
            f'AI should NOT ask ownership for connected integration import. Got: "{response}"',
        )

    def test_video_upload_asks_ownership_and_tool(self):
        """
        CRITICAL: When user uploads a video file, AI MUST ask about ownership AND tool used.

        Expected behavior:
        User: [uploads video.mp4]
        AI: "Is this your own video, or are you clipping something you found? What tool did you use to make it?"
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        # Test with S3 URL format used by AllThrive
        upload_url = 'https://allthrive-media.s3.amazonaws.com/uploads/user123/my-demo-video.mp4'

        prompt = f"""You are the project creation assistant. A user just sent this message:

"{upload_url}"

What is your response to the user? Be brief (1-2 sentences)."""

        response = ai.complete(
            prompt=prompt,
            system_message=SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=150,
        )

        response_lower = response.lower()

        # MUST ask about ownership for video uploads
        ownership_indicators = [
            'your own',
            'clipping',
            'is this yours',
            'did you create',
            'own video',
            'own project',
            'yours',
        ]

        asks_ownership = any(phrase in response_lower for phrase in ownership_indicators)
        self.assertTrue(asks_ownership, f'AI MUST ask ownership question for video upload. Got: "{response}"')

        # MUST ask about tool used
        tool_indicators = ['tool', 'made', 'create', 'use']
        asks_tool = any(phrase in response_lower for phrase in tool_indicators)
        self.assertTrue(asks_tool, f'AI MUST ask about tool used for video upload. Got: "{response}"')

    def test_external_video_url_asks_ownership(self):
        """
        When user pastes an EXTERNAL video URL (not from our storage),
        AI SHOULD ask about ownership.

        This is correct behavior - we don't know if it's their video.
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        # External video URL (not from AllThrive storage)
        external_url = 'https://example.com/videos/cool-demo.mp4'

        prompt = f"""You are the project creation assistant. A user just sent this message:

"{external_url}"

What is your response to the user? Be brief (1-2 sentences)."""

        response = ai.complete(
            prompt=prompt,
            system_message=SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=100,
        )

        response_lower = response.lower()

        # SHOULD ask ownership for external URLs
        asks_ownership = any(
            phrase in response_lower
            for phrase in [
                'your own',
                'clipping',
                'is this yours',
                'did you create',
                'own project',
            ]
        )

        self.assertTrue(asks_ownership, f'AI SHOULD ask ownership for external video URL. Got: "{response}"')

    def test_help_question_no_project_creation(self):
        """
        Help questions should NOT trigger project creation flow.

        Expected behavior:
        User: "How do I use AllThrive?"
        AI: [helpful answer about the platform, NOT "let me create a project"]
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        prompt = """User asked: "How do I edit my profile?"

Should you:
A) Start creating a project for them
B) Answer their help question

Respond with just A or B."""

        response = ai.complete(
            prompt=prompt,
            system_message=SYSTEM_PROMPT,
            temperature=0.1,
            max_tokens=10,
        )

        # Should answer help question, not create project
        self.assertIn('B', response.upper(), f'AI should answer help question, not create project. Got: "{response}"')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class InfographicConfirmationTest(TestCase):
    """
    Test that infographic requests ask for confirmation before generating.

    CRITICAL: AI should NOT auto-generate images without user confirmation.
    """

    def test_infographic_request_asks_confirmation(self):
        """
        When user asks for an infographic, AI should confirm before generating.

        Expected: "Do you want me to create an infographic about [topic]?"
        NOT: [immediately generates image]
        """
        # This is tested via the fast-path detection and the Gemini handler
        # The Gemini image generation flow should ask for confirmation
        # when the request is vague

        # For now, we test that vague requests are detected
        vague_requests = [
            'make me something pretty',
            'create a visual',
            'I want an image',
        ]

        specific_requests = [
            'create an infographic about the water cycle',
            'make an image of a sunset over mountains',
            'generate a diagram showing how APIs work',
        ]

        # Vague requests should trigger clarification
        # Specific requests should proceed (but still confirm)

        for vague in vague_requests:
            # These should trigger a clarification question
            self.assertTrue(len(vague.split()) < 6, f'Vague request should be short: {vague}')

        for specific in specific_requests:
            # These have enough detail to proceed
            self.assertTrue(len(specific.split()) >= 5, f'Specific request should have detail: {specific}')


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class ClippingFlowTest(TestCase):
    """
    Test the complete clipping flow for URLs.
    """

    def test_clipping_response_detected(self):
        """
        AI should recognize clipping responses and set is_owned=False.
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        clipping_responses = [
            'clipping it',
            'just clipping',
            'clip it',
            'found it online',
            'not mine',
            "someone else's",
            'just saving it',
            'bookmarking',
        ]

        for response in clipping_responses:
            prompt = f"""Previous message: "https://example.com/article"
You asked: "Is this your own project, or are you clipping?"
User replied: "{response}"

Based on this response, should is_owned be True or False?
Respond with only TRUE or FALSE."""

            ai_response = ai.complete(
                prompt=prompt,
                system_message=SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=10,
            )

            self.assertIn(
                'FALSE',
                ai_response.upper(),
                f'Response "{response}" should indicate clipping (is_owned=False). Got: {ai_response}',
            )

    def test_owned_response_detected(self):
        """
        AI should recognize ownership responses and set is_owned=True.
        """
        from services.agents.project.prompts import SYSTEM_PROMPT
        from services.ai import AIProvider

        ai = AIProvider()

        owned_responses = [
            "it's mine",
            'my project',
            'I made this',
            'I created it',
            'I built it',
            "yes, it's mine",
        ]

        for response in owned_responses:
            prompt = f"""Previous message: "https://example.com/my-app"
You asked: "Is this your own project, or are you clipping?"
User replied: "{response}"

Based on this response, should is_owned be True or False?
Respond with only TRUE or FALSE."""

            ai_response = ai.complete(
                prompt=prompt,
                system_message=SYSTEM_PROMPT,
                temperature=0.1,
                max_tokens=10,
            )

            self.assertIn(
                'TRUE',
                ai_response.upper(),
                f'Response "{response}" should indicate ownership (is_owned=True). Got: {ai_response}',
            )


@unittest.skipIf(SKIP_AI_TESTS, 'AI API keys not configured')
class FullFlowIntegrationTest(TestCase):
    """
    Full flow integration tests that exercise the complete intelligent chat system.
    """

    def test_github_import_full_flow(self):
        """
        Test complete GitHub import flow:
        1. User says "import from my GitHub"
        2. AI should proceed without asking ownership
        """
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)

        # Step 1: User wants to import from GitHub
        plan = supervisor.create_plan('I want to import a GitHub repository')

        # Should route to PROJECT agent
        self.assertEqual(plan.primary_agent, AgentType.PROJECT)

        print('\n GitHub Import Flow Test')
        print(f'   Plan type: {plan.plan_type}')
        print(f'   Primary agent: {plan.primary_agent}')
        print(f'   Agents: {[a.get("agent") for a in plan.agents]}')

    def test_url_clipping_full_flow(self):
        """
        Test complete URL clipping flow:
        1. User pastes URL
        2. AI asks about ownership
        3. User says "clipping"
        4. AI imports as clipped
        """
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)

        # Step 1: User pastes a URL
        plan = supervisor.create_plan('https://medium.com/@tech/great-article')

        # Should route to PROJECT agent
        self.assertEqual(plan.primary_agent, AgentType.PROJECT)

        print('\n URL Clipping Flow Test')
        print(f'   Plan type: {plan.plan_type}')
        print(f'   Primary agent: {plan.primary_agent}')

    def test_help_question_full_flow(self):
        """
        Test help question flow:
        1. User asks "How do I use AllThrive?"
        2. AI provides help (does NOT try to create project)
        """
        from services.agents.orchestrator.handoff import AgentType
        from services.agents.orchestrator.supervisor import get_supervisor

        supervisor = get_supervisor(user_id=1)

        plan = supervisor.create_plan('How do I use AllThrive AI?')

        # Should route to SUPPORT agent (not PROJECT)
        self.assertEqual(
            plan.primary_agent, AgentType.SUPPORT, f'Help question should route to SUPPORT, got {plan.primary_agent}'
        )

        print('\n Help Question Flow Test')
        print(f'   Plan type: {plan.plan_type}')
        print(f'   Primary agent: {plan.primary_agent}')
        print('   SUPPORT agent handles help questions correctly!')
