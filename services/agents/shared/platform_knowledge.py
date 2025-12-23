"""
Shared Platform Knowledge for All AI Agents.

This module contains platform help information that all AI agents (Ember, Haven, Pip, Sage)
can access. It provides a single source of truth for:
- Platform features and capabilities
- Navigation (available pages)
- URL formatting rules
- Common user questions and answers

Usage:
    from services.agents.shared import PLATFORM_HELP, format_platform_knowledge

    # Get formatted knowledge for injection into system prompt
    knowledge = format_platform_knowledge(include_navigation=True, include_features=True)
"""

# =============================================================================
# Platform Navigation - Available Pages
# =============================================================================

PLATFORM_NAVIGATION = """
## Platform Navigation

### Main Pages
- `/explore` - Discover trending projects and content
- `/learn` - Learning hub with paths and courses
- `/quizzes` - Interactive AI knowledge quizzes
- `/tools` - AI tool directory (500+ tools)
- `/marketplace` - Courses, prompts, and digital products
- `/games` - Mini games (Context Snake, Ethics Defender)

### Community & Social
- `/community/lounge` - The Lounge forum (community discussions)
- `/community/messages` - Direct messages
- `/battles` - Prompt battle lobby and arenas
- `/challenges` - Weekly community challenges
- `/thrive-circle` - Weekly circles, challenges, and kudos

### Gamification
- `/play/side-quests` - Side quests with rewards
- `/achievements` - View earned achievements

### User Pages
- `/{username}` - User profiles (e.g., /allierays)
- `/{username}/{project-slug}` - Individual projects
- `/dashboard` - Personal dashboard
- `/account/settings` - Account settings and preferences
- `/perks` - Subscription benefits

### Creator Pages
- `/creator/dashboard` - Creator analytics and earnings
- `/creator/products` - Manage marketplace products

**URL Formatting Rules:**
- ALWAYS use relative URLs starting with `/` - NEVER include domain names
- Use exact URLs returned by tools (e.g., `/username/project-slug`)
- Format as markdown links: `[Project Title](/username/project-slug)`

Correct: `[Explore Projects](/explore)`
Wrong: `https://allthriveai.com/explore` (never use absolute URLs!)
"""

# =============================================================================
# Platform Features - What Users Can Do
# =============================================================================

PLATFORM_FEATURES = """
## Platform Features

### Projects & Creation
- **Import projects** from GitHub, YouTube, Figma, GitLab, and any URL
- **Create projects** to showcase AI work (apps, art, videos, prompts)
- **AI-generated content** - create images and videos with AI tools
- **Architecture diagrams** - auto-generated for code projects
- **Browser extension** - clip and save content from anywhere on the web

### Learning & Growth
- **Learning paths** - personalized curricula on AI topics with micro-lessons
- **Quizzes** - test knowledge with interactive quizzes
- **Micro-lessons** - bite-sized AI lessons with AI chat support
- **XP & streaks** - gamified learning progress
- **Concept mastery** - track skills with spaced repetition
- **Skill progression** - Beginner → Intermediate → Advanced → Expert per topic

### The Lounge (Community Forum)
- **Community rooms** for discussions:
  - General - public discussion and introductions
  - Announcements - official platform updates
  - Showcase - share projects and get feedback
  - Help & Support - community Q&A
  - Learning Together - share resources and tutorials
  - Tools & Tech - discuss AI tools and features
  - Off Topic - casual conversations
  - Feedback & Ideas - feature requests and suggestions
- **Threading** - reply to messages, pin important threads
- **Reactions** - emoji reactions on messages
- **Moderation** - community-driven with trust levels

### Thrive Circles (Weekly Micro-Groups)
- **Weekly circles** - small groups (~20-30 members) matched by tier
- **Circle challenges** - collaborative goals with shared progress
  - Create projects together
  - Give feedback to each other
  - Complete quests as a group
  - Earn points together
  - Maintain streaks
- **Kudos system** - recognize fellow circle members:
  - Great Project, Helpful, Inspiring, Creative, Supportive, Welcome
- **Bonus points** for completing circle challenges together

### Side Quests & Achievements
- **Quest categories**:
  - Community: Comment, give feedback, react to projects, follow users
  - Learning: Complete quizzes, quiz streaks, perfect scores, explore topics
  - Creative: Create projects, generate images, import from GitHub
  - Exploration: Visit pages, explore profiles, use search
  - Daily: Daily login, daily activity, daily engagement
  - Special: Streak milestones, level up, category completion
- **Quest difficulty**: Easy, Medium, Hard, Epic
- **Achievements** with rarity: Common, Rare, Epic, Legendary
- **Points**: 10-100+ points per quest completion

### Prompt Battles
- **Battle modes**: Real-time (synchronous) or turn-based (asynchronous)
- **Battle types**: Text prompts, image prompts, or mixed
- **Match sources**: Direct challenge, random match, AI opponent (Pip), SMS invite
- **Judging**: AI judging, community votes, or judge panel
- **Guest mode** - invite friends via SMS even if they don't have an account

### Marketplace (Creator Economy)
- **Product types**: Courses, Prompt Packs, Templates, E-Books
- **Creator accounts** with Stripe payouts
- **Sell your AI expertise** - create and monetize content
- **Purchase access** - lifetime or time-limited

### Discovery & Search
- **Explore feed** - discover trending projects
- **Tool directory** - 500+ AI tools with guides and tutorials
- **Semantic search** - find projects, users, and content
- **Personalized recommendations** based on interests

### Integrations
- **GitHub** - import repositories and code projects
- **YouTube** - import videos and create from channels
- **Figma** - import design files
- **GitLab** - import repositories
- **LinkedIn** - connect profile and import experience
- **RSS feeds** - follow content sources
- **Browser extension** - save content from any website

### Membership Tiers
- **Seedling** (free) - Basic access to explore and learn
- **Sprout** - More quests, circles, and features
- **Blossom** - Full learning paths and marketplace access
- **Bloom** - Creator tools and advanced features
- **Evergreen** - Premium benefits and priority support

### Trust System
- Users earn **trust** through positive community participation
- Higher trust unlocks posting in certain rooms (like Announcements)
- Trust is earned by creating quality content, helping others, and engagement

### Roles
- **Explorer** - New users discovering the platform
- **Learner** - Focused on learning AI concepts
- **Creator** - Building and sharing AI projects
- **Mentor** - Helping others learn
- **Expert** - Recognized expertise in AI topics
"""

# =============================================================================
# Common Help Topics - FAQs
# =============================================================================

PLATFORM_HELP = """
## Common Questions & Help

### Getting Started
- **New to All Thrive?** Start by exploring trending projects or taking a quiz
- **Want to showcase work?** Import a project from GitHub or upload media
- **Looking to learn?** Ask for a learning path on any AI topic
- **Want to connect?** Join The Lounge and introduce yourself in General

### Projects
- **How to import?** Share a URL (GitHub, YouTube, Figma) and it auto-imports
- **What can I share?** AI apps, tools, art, videos, prompts, tutorials
- **Visibility?** Projects can be public (shared) or private (just for you)
- **Browser extension?** Install it to clip and save content from any website

### Learning
- **Learning paths** are personalized curricula created just for you
- **Quizzes** test your knowledge and help identify areas to improve
- **XP and streaks** track your progress and keep you motivated
- **Skill levels** progress from Beginner to Expert per topic

### Community
- **The Lounge** - main community forum with topic-based rooms
- **Prompt battles** - compete against others in creative AI challenges
- **Thrive Circles** - weekly small groups with collaborative challenges
- **Kudos** - recognize and appreciate fellow community members
- **Side quests** - complete tasks to earn points and achievements

### Gamification
- **Points** - earn XP through learning, creating, and community participation
- **Achievements** - unlock badges for milestones and accomplishments
- **Streaks** - maintain daily activity for bonus rewards
- **Weekly goals** - rotating challenges for extra points
- **Circle challenges** - collaborative goals with your weekly group

### Marketplace
- **Buy** - courses, prompt packs, templates, and e-books from creators
- **Sell** - become a creator and monetize your AI expertise
- **Creator account** - set up Stripe to receive payouts

### Account & Settings
- **Profile** - customize your bio, avatar, and showcase projects
- **Preferences** - set learning style, interests, and notifications
- **Integrations** - connect GitHub, YouTube, LinkedIn, Figma
- **Subscription** - upgrade your tier for more benefits

### Getting Help
- **Haven** - community support, feedback, concerns (that's me!)
- **Ember** - platform guide, learning, project creation
- **Pip** - prompt battles and playful challenges
- **Sage** - deep learning explanations and teaching
- **Help room** - ask the community in The Lounge → Help & Support
"""

# =============================================================================
# Agent-Specific Context
# =============================================================================

AGENT_CAPABILITIES = {
    'ember': """
### Ember's Capabilities
- Help you get started on All Thrive
- Create learning paths on any AI topic
- Import projects from URLs (GitHub, YouTube, Figma, etc.)
- Guide you through platform features
- Answer questions about AI concepts
- Play learning games and quizzes
- Help with project creation and showcasing
- Navigate you to the right pages and features
""",
    'haven': """
### Haven's Capabilities
- Answer questions about All Thrive features
- Help with account or platform issues
- Explain how features work (quests, circles, battles, etc.)
- Listen to feedback and concerns
- Connect you with the right resources
- Guide you to the right community spaces
- Escalate issues when needed
- Make sure you feel heard and supported
""",
    'pip': """
### Pip's Capabilities
- Challenge you to prompt battles
- Teach prompt engineering techniques
- Playful competition and encouragement
- Creative AI challenges
- Help improve your prompting skills
- Random match battles anytime
""",
    'sage': """
### Sage's Capabilities
- Deep explanations of AI concepts
- Socratic teaching approach
- Help with complex learning topics
- Guide through difficult concepts
- Spaced repetition learning support
- Advanced topic mastery guidance
""",
}


# =============================================================================
# Formatting Functions
# =============================================================================


def format_platform_knowledge(
    include_navigation: bool = True,
    include_features: bool = True,
    include_help: bool = True,
    agent_name: str | None = None,
) -> str:
    """
    Format platform knowledge for injection into an agent's system prompt.

    Args:
        include_navigation: Include navigation/URL guidance
        include_features: Include platform features overview
        include_help: Include common help topics
        agent_name: Optional agent name to include their specific capabilities

    Returns:
        Formatted string for system prompt injection
    """
    sections = []

    sections.append('# All Thrive Platform Knowledge')
    sections.append('')
    sections.append(
        'This is your knowledge base about the All Thrive platform. '
        'Use this information to help users navigate and understand the platform.'
    )

    if include_features:
        sections.append(PLATFORM_FEATURES)

    if include_navigation:
        sections.append(PLATFORM_NAVIGATION)

    if include_help:
        sections.append(PLATFORM_HELP)

    if agent_name and agent_name.lower() in AGENT_CAPABILITIES:
        sections.append(AGENT_CAPABILITIES[agent_name.lower()])

    return '\n'.join(sections)


def get_agent_knowledge(agent_name: str) -> str:
    """
    Get platform knowledge formatted for a specific agent.

    Args:
        agent_name: The agent's name (ember, haven, pip, sage)

    Returns:
        Formatted platform knowledge string
    """
    return format_platform_knowledge(
        include_navigation=True,
        include_features=True,
        include_help=True,
        agent_name=agent_name,
    )
