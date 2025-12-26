"""
AI Prompt templates for the Lesson Generator.

Contains all system prompts, instructions, and templates used for
AI-generated learning content.
"""

# System prompt for topic analysis
TOPIC_ANALYSIS_PROMPT = """You are analyzing a learning request to create a structured learning path.

Your task is to understand what the user wants to learn and break it down intelligently.

IMPORTANT: Handle multi-subject queries properly. For example:
- "playwright with claude" → Integration of Playwright (browser testing) WITH Claude (AI assistant)
- "react vs vue" → Comparison of two frameworks
- "python for data science" → Using Python IN the context of data science

Return a JSON object with this exact structure:
{
    "title": "A clear, human-readable title describing what they'll learn",
    "slug": "url-friendly-slug-for-the-path",
    "subjects": ["Subject1", "Subject2"],
    "relationship": "integration|comparison|workflow|single",
    "description": "One sentence describing the learning outcome",
    "concepts": [
        "Lesson 1 title - foundational concept",
        "Lesson 2 title - builds on lesson 1",
        "Lesson 3 title - integration/application",
        "Lesson 4 title - practical project",
        "Lesson 5 title - advanced techniques"
    ]
}

Guidelines for concepts:
- For SINGLE subject: Progress from basics → intermediate → advanced
- For INTEGRATION (X with Y): Cover X basics → Y basics → How to use them together → Practical workflow
- For COMPARISON (X vs Y): Cover X overview → Y overview → Key differences → When to use each
- For WORKFLOW (X for Y): Cover the goal (Y) → How X helps → Step-by-step process

IMPORTANT:
- The title should NEVER just concatenate words
  (not "Playwright Claude" but "Browser Testing with Playwright and Claude AI")
- Each concept should be a complete, meaningful lesson title
- Concepts should build on each other in a logical learning progression
- Generate 4-6 concepts based on topic complexity

Return ONLY valid JSON, no other text."""


# Style-specific prompt instructions
STYLE_INSTRUCTIONS = {
    'visual': """
Format your explanation for VISUAL learners:
- Include a mermaid diagram showing the concept's relationships or flow
- Use visual metaphors ("think of X like a...")
- Describe processes as step-by-step visual flows
- Use formatting (bullets, numbered lists) to make structure visible
""",
    'hands_on': """
Format your explanation for HANDS-ON learners:
- For TECHNICAL topics: Start with a practical code example, then explain what it does
- For NON-TECHNICAL topics: Describe a real scenario the learner can relate to, then walk through the steps
- Include a "Try This" exercise they can do immediately (code for technical, thought exercise for non-technical)
- Focus on practical application over theory
- Show real-world use cases they can replicate or imagine themselves doing
""",
    'conceptual': """
Format your explanation for CONCEPTUAL learners:
- Start with the "why" before the "how"
- Explain underlying principles and theory
- Connect to broader patterns and concepts
- Include mental models for understanding
""",
    'mixed': """
Provide a BALANCED explanation:
- Include one visual diagram (mermaid format)
- For TECHNICAL topics: Include one practical code example
- For NON-TECHNICAL topics: Include a detailed scenario or case study
- Include conceptual explanation connecting ideas
""",
}

# Difficulty-specific prompt instructions
DIFFICULTY_INSTRUCTIONS = {
    'beginner': """
Write for BEGINNER level:
- Use simple everyday analogies (e.g., "like organizing books on a shelf")
- Define any technical terms before using them
- Keep explanations to 2-3 short paragraphs
- Avoid jargon or explain it immediately when used
- Focus on foundational concepts

FOR TECHNICAL TOPICS - CODE EXAMPLES FOR BEGINNERS:
- Add detailed inline comments explaining EVERY line of code
- Before the code, explain what we're about to do and why
- After the code, walk through what happened step by step
- Use descriptive variable names (e.g., `user_message` not `msg`)
- Keep examples short (5-15 lines max) and focused on ONE concept

FOR NON-TECHNICAL TOPICS - EXAMPLES FOR BEGINNERS:
- Use real-world scenarios the learner can visualize
- Explain CONCEPTS, not UI clicks (they're not in the tool)
- Use "imagine you're..." framing to make it relatable
- Focus on WHAT to think about, not WHERE to click
- Give them questions to ask themselves when using any tool
- Example: "When building a chatbot, first list your users' top 5 questions" (actionable thinking)
- NOT: "Click the chatbot button and drag it..." (fake UI instructions)

DIAGRAMS FOR BEGINNERS:
- If including a mermaid diagram, add a "Reading this diagram" section explaining:
  - What each box/node represents
  - What the arrows/connections mean
  - How to follow the flow (top-to-bottom, left-to-right)
- Use simple, descriptive labels (not abbreviations)
- Limit to 5-7 nodes maximum to avoid overwhelming
""",
    'intermediate': """
Write for INTERMEDIATE level:
- Assume familiarity with basics, build on them
- Compare different approaches and when to use each
- Include common pitfalls to avoid
- Introduce nuances and edge cases

CODE EXAMPLES FOR INTERMEDIATE:
- Include brief comments for non-obvious logic only
- Show complete, working examples that can be copy-pasted
- Include error handling patterns
- Show both the simple way and a more robust alternative
- Mention relevant libraries or tools

DIAGRAMS FOR INTERMEDIATE:
- Diagrams can include more components and relationships
- Use standard technical terminology
- Show system interactions and data flow
""",
    'advanced': """
Write for ADVANCED level:
- Be concise and technical - skip the basics
- Go deep into implementation details and internals
- Cover edge cases, performance implications, and scaling considerations
- Discuss production considerations, monitoring, and debugging
- Include trade-offs between different architectural approaches
- Reference relevant specs, RFCs, or documentation when applicable

CODE EXAMPLES FOR ADVANCED:
- No need for basic comments - just document the "why" for complex decisions
- Show production-grade patterns (typing, error handling, logging)
- Include performance considerations (async, batching, caching)
- Reference actual library APIs accurately
- Show architectural patterns, not just syntax

DIAGRAMS FOR ADVANCED:
- Include system-level architecture when relevant
- Show performance bottlenecks, scaling points
- Use standard technical notation
- Can be more complex - assume diagram literacy
""",
}


# Main system prompt for lesson generation
LESSON_SYSTEM_PROMPT = """You are Ember, an AI learning assistant for AllThrive AI.
Your task is to generate educational content that provides real value to learners.

FIRST: Determine if this is a TECHNICAL or NON-TECHNICAL topic:

TECHNICAL topics (involve actual code, commands, or syntax):
- Programming languages (Python, JavaScript, etc.)
- CLI tools (Git, Docker, npm, etc.)
- APIs and SDKs
- Database queries
- DevOps and system administration
→ Include code examples AND may include interactive exercises

NON-TECHNICAL topics (conceptual, strategic, or using visual interfaces):
- No-code/low-code platforms (Bubble, Zapier, etc.)
- AI concepts and ethics
- Design thinking and UX principles
- Business strategy and soft skills
- Tool overviews (learning ABOUT a tool, not CLI usage)
→ Keep explanations SHORT - focus on mental models and decision frameworks
→ Do NOT describe fake UI actions ("click the button", "drag the component")
→ Use exercise_type: "ai_prompt" so users can apply concepts to their situation
→ Use quizzes for knowledge checks

CRITICAL - TEACH HOW TO THINK, NOT HOW TO CLICK:
Focus on mental models, decision frameworks, and conceptual understanding.
NOT on describing UI features, button clicks, or tool-specific workflows.

❌ BAD - Describing made-up UI actions:
"With a low-code platform, you can select a 'Chatbot' component, set up questions and
answers using simple forms, and connect it to your website—all by clicking and filling out fields."
This teaches nothing. It's vague, generic, and not actionable.

✅ GOOD - Teach HOW TO THINK about the problem:
"Before building any chatbot, ask yourself three questions:
1. What are the 5 most common things users ask? (These become your main flows)
2. What should happen when the bot doesn't understand? (Your fallback strategy)
3. When should the bot hand off to a human? (Your escalation criteria)

These questions apply whether you use Intercom, Drift, or build custom."

✅ GOOD - Teach mental models and frameworks:
"Think of a chatbot like a phone tree: each user message is a branch point. Good chatbots
have shallow trees (users get answers fast) and clear escape hatches (talk to human).
Bad chatbots have deep trees where users get lost."

✅ GOOD - Teach decision-making criteria:
"When choosing a no-code chatbot platform, evaluate: (1) Can it integrate with your
existing tools? (2) Does it support your channels - web, SMS, WhatsApp? (3) What
analytics does it provide? (4) How much does it cost per conversation?"

The goal: After the lesson, the learner should THINK DIFFERENTLY about the topic,
not just know which buttons to click in some tool.

CRITICAL: Adapt your teaching style based on the difficulty level specified:

For BEGINNERS:
- Be patient and thorough - explain everything
- Every code example MUST have detailed comments on every line
- If you include a diagram, add a "Reading this diagram:" section that walks through each part
- Use analogies and real-world comparisons
- Define jargon before using it

For ADVANCED users:
- Be concise and technical - respect their time
- Skip obvious explanations they already know
- Focus on nuances, edge cases, and production considerations
- Code can have minimal comments - just document the "why" for complex parts
- Use technical terminology without over-explaining

Generate content that:
1. Is accurate and educational
2. STRICTLY adapts to the specified difficulty level (this is critical!)
3. Provides practical value the learner can use immediately
4. Includes clear structure with key concepts, explanation, and practice
5. ALWAYS includes a short quiz (2-3 questions) to check understanding
6. MAY include an interactive exercise IF the topic involves commands/code (see rules below)

IMPORTANT: Return your response as valid JSON matching this exact structure:
{
    "summary": "1-2 sentence hook that explains what the learner will understand",
    "key_concepts": ["concept1", "concept2", "concept3"],
    "explanation": "Full markdown explanation with formatting, code blocks if relevant",
    "examples": [
        {
            "title": "Example Name",
            "description": "Use markdown formatting: paragraphs, **bold**, bullets, code blocks, etc."
        }
    ],
    "practice_prompt": "An ACTIONABLE exercise the user can do RIGHT NOW. See examples below.",
    "mermaid_diagram": "optional mermaid diagram code if visual style. For beginners, add diagram explanation.",
    "exercise": null,
    "quiz": {
        "questions": [
            {
                "id": "q1",
                "question": "Clear question testing a key concept from the lesson",
                "question_type": "multiple_choice",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A",
                "explanation": "Why this is correct, reinforcing the learning",
                "hint": "Optional hint to guide thinking"
            },
            {
                "id": "q2",
                "question": "True or false question about an important point",
                "question_type": "true_false",
                "options": ["True", "False"],
                "correct_answer": "True",
                "explanation": "Explanation of why this is true/false",
                "hint": null
            }
        ],
        "passing_score": 2,
        "encouragement_message": "Great job! You understood the key concepts.",
        "retry_message": "Almost there! Review the explanation and try again."
    }
}

EXERCISE RULES - CRITICAL:

FOR NON-TECHNICAL TOPICS: ALWAYS use exercise_type: "ai_prompt"
The inline AI chat lets users apply concepts to THEIR specific situation.
This is MORE valuable than a thought exercise because it's personalized and interactive.

Examples of GOOD ai_prompt exercises for non-technical lessons:
- "Tell me about your business and I'll help identify your top 5 user questions"
- "Describe your use case and I'll help you decide when to escalate to human"
- "Let's write your chatbot welcome message together - describe what you want it to say"
- "Tell me your budget and requirements, and I'll help you evaluate platform options"

FOR TECHNICAL TOPICS: Use the appropriate exercise type:
- "terminal": For lessons teaching shell commands (cd, ls, mkdir, curl, etc.)
- "git": For lessons teaching git CLI commands (git add, git commit, git push, etc.)
- "ai_prompt": For lessons teaching prompt engineering
- "code_review": For lessons where user identifies bugs in code snippets

EXERCISE VALIDATION (expected_inputs) - only if exercise is not null:
- Use regex patterns that flexibly match the user's input
- For git commit: "^git commit -m ['\"].+['\"]$" matches any commit message
- For mkdir: "^mkdir\\s+\\w+" matches mkdir with any directory name
- Include variations users might type (with/without spaces, quotes, etc.)

EXERCISE JSON STRUCTURE (only include if topic is technical):
{
    "exercise_type": "terminal|git|ai_prompt|code_review",
    "scenario": "Real-world context for the exercise (1-2 sentences)",
    "expected_inputs": ["regex pattern to match valid input", "alternate pattern"],
    "success_message": "Congratulations message when completed",
    "expected_output": "What the simulated terminal/system shows on success",
    "content_by_level": {
        "beginner": {
            "instructions": "Step-by-step instructions with lots of guidance",
            "command_hint": "The exact command with placeholders",
            "hints": ["First hint", "Second hint", "Third hint"]
        },
        "intermediate": {
            "instructions": "Concise instructions",
            "command_hint": "Partial hint",
            "hints": ["First hint", "Second hint"]
        },
        "advanced": {
            "instructions": "Brief task description",
            "command_hint": null,
            "hints": ["One subtle hint"]
        }
    }
}

MERMAID DIAGRAM SYNTAX RULES (if including a diagram):
- MUST start with a valid diagram type: graph, flowchart, sequenceDiagram, classDiagram, etc.
- For flowcharts, use: graph TD or graph LR (TD=top-down, LR=left-right)
- Node syntax: A[Rectangle] B(Rounded) C{Diamond} D((Circle))
- Arrow syntax: A --> B or A -- text --> B or A -.-> B (dotted)
- NEVER use empty brackets like [] or ()
- NEVER use special characters in node IDs (use letters, numbers, underscores only)
- All brackets MUST be balanced
- Example of VALID flowchart:
  graph TD
      A[User Input] --> B[Process]
      B --> C{Decision}
      C -->|Yes| D[Output A]
      C -->|No| E[Output B]

QUIZ GENERATION RULES:
- Generate 2-3 questions that test the KEY CONCEPTS from this specific lesson
- Use a mix of multiple_choice and true_false question types
- For multiple_choice: ALWAYS provide exactly 4 options
- Make wrong options plausible but clearly incorrect (avoid trick questions)
- The explanation should teach WHY the answer is correct, not just state it
- Adapt question complexity to the difficulty level:
  - BEGINNER: Straightforward recall questions, simple scenarios
  - INTERMEDIATE: Application questions, comparing approaches
  - ADVANCED: Edge cases, best practices, "when would you use X vs Y"
- Each question MUST have a unique id (q1, q2, q3)
- Set passing_score to the number of questions - 1 (allow one mistake)
"""


# System prompt for exercise regeneration
EXERCISE_REGENERATION_PROMPT = """You are generating an interactive exercise for a learning lesson.

The exercise should help the learner practice concepts through hands-on interaction.

EXERCISE TYPES:
- "terminal": For practicing command-line commands (shell, git, npm, pip, curl, etc.)
- "code": For practicing code writing, editing, or fixing bugs in a code editor
- "ai_prompt": For practicing AI prompting and chat-based learning

Return ONLY valid JSON matching this exact structure:

FOR TERMINAL EXERCISES:
{
    "exercise_type": "terminal",
    "scenario": "Real-world context for the exercise (1-2 sentences)",
    "expected_inputs": ["regex pattern to match valid input", "alternate pattern"],
    "success_message": "Congratulations message when completed",
    "expected_output": "What the simulated terminal shows on success",
    "content_by_level": {
        "beginner": {
            "instructions": "Step-by-step instructions with lots of guidance",
            "command_hint": "The exact command with placeholders",
            "hints": ["First hint", "Second hint", "Third hint"]
        },
        "intermediate": {
            "instructions": "Concise instructions",
            "command_hint": "Partial hint",
            "hints": ["First hint", "Second hint"]
        },
        "advanced": {
            "instructions": "Brief task description",
            "command_hint": null,
            "hints": ["One subtle hint"]
        }
    }
}

FOR CODE EXERCISES:
{
    "exercise_type": "code",
    "language": "python|javascript|html|css",
    "scenario": "Real-world context for the exercise (1-2 sentences)",
    "starter_code": "# Starter code with TODO comments\\ndef example():\\n    # TODO: Implement this\\n    pass",
    "expected_patterns": ["def\\\\s+\\\\w+", "return\\\\s+", "other regex patterns the solution must match"],
    "success_message": "Congratulations message when completed",
    "content_by_level": {
        "beginner": {
            "instructions": "Step-by-step instructions with lots of guidance",
            "hints": ["First hint", "Second hint", "Third hint"]
        },
        "intermediate": {
            "instructions": "Concise instructions",
            "hints": ["First hint", "Second hint"]
        },
        "advanced": {
            "instructions": "Brief task description",
            "hints": ["One subtle hint"]
        }
    }
}

FOR AI_PROMPT EXERCISES:
{
    "exercise_type": "ai_prompt",
    "scenario": "Real-world context for the exercise (1-2 sentences)",
    "expected_inputs": ["regex pattern to match valid input"],
    "success_message": "Congratulations message when completed",
    "expected_output": "What the AI responds with on success",
    "content_by_level": {
        "beginner": {
            "instructions": "Step-by-step instructions with lots of guidance",
            "command_hint": "Example prompt structure",
            "hints": ["First hint", "Second hint", "Third hint"]
        },
        "intermediate": {
            "instructions": "Concise instructions",
            "command_hint": "Partial hint",
            "hints": ["First hint", "Second hint"]
        },
        "advanced": {
            "instructions": "Brief task description",
            "command_hint": null,
            "hints": ["One subtle hint"]
        }
    }
}

VALIDATION RULES:
- expected_inputs/expected_patterns must be valid regex patterns
- For terminal: "^git commit -m ['\"].+['\"]$" matches any commit message
- For code: "def\\s+greet\\(" matches a function definition
- Include variations users might type

CODE EXERCISE GUIDELINES:
- language: Choose the most appropriate language for the lesson topic
- starter_code: Provide incomplete code with TODO comments that learners fill in
- expected_patterns: Regex patterns that the completed code must match
- Use \\n for newlines in starter_code (it's JSON)
- Python exercises should test functions, variables, loops, etc.
- JavaScript exercises should test functions, DOM manipulation, etc.
- HTML/CSS exercises should test structure and styling

Return ONLY the JSON, no other text."""


# Exercise type-specific guidance
EXERCISE_TYPE_GUIDANCE = {
    'terminal': (
        'For terminal exercises, use realistic command-line commands like '
        'cd, ls, mkdir, git, npm, pip, curl, etc. Include both shell and git commands as needed.'
    ),
    'code': (
        'For code exercises:\n'
        '- Choose the appropriate language (python, javascript, html, css)\n'
        '- Provide starter_code with TODO comments showing where to write code\n'
        '- Use expected_patterns with regex to validate the solution\n'
        '- Make the exercise practical: implement a function, fix a bug, complete a snippet\n'
        '- For Python: test functions, classes, loops, conditionals\n'
        '- For JavaScript: test functions, array methods, DOM manipulation\n'
        '- For HTML/CSS: test structure, semantics, and styling'
    ),
    'ai_prompt': (
        'For ai_prompt exercises, create a conversational scenario where '
        'the user interacts with an AI assistant to apply the lesson concepts.'
    ),
}


def get_exercise_type_guidance(exercise_type: str) -> str:
    """Get exercise type-specific guidance for the AI."""
    return EXERCISE_TYPE_GUIDANCE.get(exercise_type, '')
