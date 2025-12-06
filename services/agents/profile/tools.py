"""
LangChain tools for profile generation agent.

These tools gather user data and generate/save profile sections.

PROFILE TEMPLATES (auto-selected based on user type):
- explorer: New users, learners - About, Learning Goals, Links
- builder: Developers, makers - About, Featured Projects, Skills, Links
- creator: Content creators - About, Storefront, Featured Work, Links
- curation: AI curators - About, Featured Content, Links
- battle_bot: Battle bots (Pip) - About, Battle Stats, Recent Battles

Showcase tab is full-width and fully customizable.
Other tabs (Playground, Learning, Activity) use sidebar layout.
"""

import logging
import uuid
from typing import Literal

from langchain.tools import tool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Profile Templates
ProfileTemplate = Literal['explorer', 'builder', 'creator', 'curation', 'battle_bot']

PROFILE_TEMPLATES = {
    'explorer': {
        'name': 'Explorer',
        'description': 'Perfect for learners and newcomers.',
        'sections': ['about', 'learning_goals', 'links'],
    },
    'builder': {
        'name': 'Builder',
        'description': 'Showcase your projects and technical skills.',
        'sections': ['about', 'featured_projects', 'skills', 'links'],
    },
    'creator': {
        'name': 'Creator',
        'description': 'Feature your products and services.',
        'sections': ['about', 'storefront', 'featured_projects', 'links'],
    },
    'curation': {
        'name': 'Curator',
        'description': 'Highlight curated content and discoveries.',
        'sections': ['about', 'featured_content', 'links'],
    },
    'battle_bot': {
        'name': 'Battle Bot',
        'description': 'Show off battle stats and history.',
        'sections': ['about', 'battle_stats', 'recent_battles'],
    },
}

# Valid section types
VALID_SECTION_TYPES = {
    'about',
    'links',
    'skills',
    'learning_goals',
    'featured_projects',
    'storefront',
    'featured_content',
    'battle_stats',
    'recent_battles',
    'custom',
}


# =============================================================================
# Input Schemas
# =============================================================================


class GatherUserDataInput(BaseModel):
    """Input for gather_user_data tool."""

    include_projects: bool = Field(default=True, description='Whether to include project details')
    include_achievements: bool = Field(default=True, description='Whether to include achievement data')
    include_interests: bool = Field(default=True, description='Whether to include interests/tags')


class GenerateProfileSectionsInput(BaseModel):
    """Input for generate_profile_sections tool."""

    template: str = Field(
        default='',
        description=(
            'Profile template to use (explorer, builder, creator, curation, battle_bot). Auto-selects if empty.'
        ),
    )
    sections_to_generate: list[str] = Field(
        default=[], description='Which sections to generate. Uses template defaults if empty.'
    )
    user_data: dict = Field(description='User data from gather_user_data tool')
    focus_areas: list[str] = Field(default=[], description='Specific areas the user wants to highlight')


class SaveProfileSectionsInput(BaseModel):
    """Input for save_profile_sections tool."""

    sections: list[dict] = Field(description='Profile sections to save')


# =============================================================================
# Tools
# =============================================================================


@tool(args_schema=GatherUserDataInput)
def gather_user_data(
    include_projects: bool = True,
    include_achievements: bool = True,
    include_interests: bool = True,
    state: dict | None = None,
) -> dict:
    """
    Gather comprehensive user data for profile generation.

    Fetches the user's:
    - Basic profile info (name, bio, tagline, location, social links)
    - Projects (if include_projects=True)
    - Achievements and gamification stats (if include_achievements=True)
    - Interests and skills from UserTags (if include_interests=True)

    Returns:
        Dictionary with all gathered user data
    """
    from django.contrib.auth import get_user_model

    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    logger.info(f'Gathering data for user {user.username}')

    # Basic profile info
    data = {
        'success': True,
        'basic_info': {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name or '',
            'last_name': user.last_name or '',
            'full_name': user.get_full_name() or user.username,
            'email': user.email,
            'avatar_url': user.avatar_url or '',
            'bio': user.bio or '',
            'tagline': user.tagline or '',
            'location': user.location or '',
            'pronouns': user.pronouns or '',
            'current_status': user.current_status or '',
            'role': getattr(user, 'role', '') or '',
        },
        'social_links': {
            'website_url': user.website_url or '',
            'linkedin_url': user.linkedin_url or '',
            'twitter_url': user.twitter_url or '',
            'github_url': user.github_url or '',
            'youtube_url': user.youtube_url or '',
            'instagram_url': user.instagram_url or '',
            'calendar_url': getattr(user, 'calendar_url', '') or '',
        },
        'gamification': {
            'total_points': user.total_points or 0,
            'level': user.level or 1,
            'tier': user.tier or 'seedling',
            'current_streak_days': user.current_streak_days or 0,
            'longest_streak_days': user.longest_streak_days or 0,
            'total_achievements_unlocked': user.total_achievements_unlocked or 0,
            'lifetime_quizzes_completed': getattr(user, 'lifetime_quizzes_completed', 0) or 0,
            'lifetime_projects_created': getattr(user, 'lifetime_projects_created', 0) or 0,
            'lifetime_comments_posted': getattr(user, 'lifetime_comments_posted', 0) or 0,
            'weekly_goals_completed': getattr(user, 'weekly_goals_completed', 0) or 0,
        },
    }

    # Fetch projects
    if include_projects:
        from core.projects.models import Project

        projects = Project.objects.filter(
            user=user,
            is_archived=False,
        ).order_by('-created_at')[:20]  # Last 20 projects

        data['projects'] = [
            {
                'id': p.id,
                'title': p.title,
                'slug': p.slug,
                'description': p.description or '',
                'type': p.type,
                'is_showcased': p.is_showcased,
                'external_url': p.external_url or '',
                'topics': p.topics or [],
                'hero_image_url': p.featured_image_url or '',
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'tools': [{'name': t.name, 'slug': t.slug} for t in (p.tools.all()[:5] if hasattr(p, 'tools') else [])],
            }
            for p in projects
        ]
        data['project_count'] = projects.count()

    # Fetch achievements
    if include_achievements:
        from core.achievements.models import UserAchievement

        achievements = (
            UserAchievement.objects.filter(user=user).select_related('achievement').order_by('-earned_at')[:10]
        )

        data['achievements'] = [
            {
                'name': ua.achievement.name,
                'description': ua.achievement.description,
                'category': ua.achievement.category,
                'rarity': ua.achievement.rarity,
                'earned_at': ua.earned_at.isoformat() if ua.earned_at else None,
            }
            for ua in achievements
        ]

    # Fetch interests/skills from UserTags
    if include_interests:
        from core.taxonomy.models import UserTag

        tags = UserTag.objects.filter(user=user).order_by('-interaction_count')[:30]

        data['interests'] = [
            {
                'name': tag.name,
                'source': tag.source,
                'confidence': float(tag.confidence_score) if tag.confidence_score else 1.0,
                'interaction_count': tag.interaction_count or 0,
            }
            for tag in tags
        ]

    logger.info(
        f'Gathered data for {user.username}: {len(data.get("projects", []))} projects, '
        f'{len(data.get("achievements", []))} achievements, {len(data.get("interests", []))} interests'
    )

    return data


def select_template_for_user(
    username: str,
    tier: str,
    role: str,
    project_count: int,
) -> str:
    """
    Auto-select the best profile template based on user characteristics.
    """
    # Battle bot check (Pip)
    if tier == 'curation' and username.lower() == 'pip':
        return 'battle_bot'

    # Curation tier
    if tier == 'curation':
        return 'curation'

    # Creator role
    if role == 'creator':
        return 'creator'

    # Has projects = builder
    if project_count > 0:
        return 'builder'

    # Default to explorer
    return 'explorer'


@tool(args_schema=GenerateProfileSectionsInput)
def generate_profile_sections(
    user_data: dict,
    template: str = '',
    sections_to_generate: list[str] | None = None,
    focus_areas: list[str] | None = None,
    state: dict | None = None,
) -> dict:
    """
    Generate profile section content based on user data and template.

    This tool uses the gathered user data to create personalized content
    for each profile section. If no template is specified, it auto-selects
    based on user characteristics (tier, role, projects).

    Templates:
    - explorer: New users, learners
    - builder: Developers, makers
    - creator: Content creators
    - curation: AI curators
    - battle_bot: Battle bots (Pip)

    Returns:
        Dictionary with generated section content
    """
    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    if not user_data or not user_data.get('success'):
        return {'success': False, 'error': 'Invalid user data provided'}

    basic = user_data.get('basic_info', {})
    social = user_data.get('social_links', {})
    gamification = user_data.get('gamification', {})
    projects = user_data.get('projects', [])
    achievements = user_data.get('achievements', [])
    interests = user_data.get('interests', [])

    # Auto-select template if not provided
    if not template or template not in PROFILE_TEMPLATES:
        template = select_template_for_user(
            username=basic.get('username', ''),
            tier=gamification.get('tier', 'seedling'),
            role=basic.get('role', ''),
            project_count=user_data.get('project_count', len(projects)),
        )

    # Get sections from template if not explicitly provided
    sections_to_generate = sections_to_generate or PROFILE_TEMPLATES[template]['sections']
    focus_areas = focus_areas or []

    generated_sections = []

    # Generate each requested section
    for idx, section_type in enumerate(sections_to_generate):
        section = _generate_section(
            section_type=section_type,
            order=idx,
            basic=basic,
            social=social,
            gamification=gamification,
            projects=projects,
            achievements=achievements,
            interests=interests,
            focus_areas=focus_areas,
        )
        if section:
            generated_sections.append(section)

    return {
        'success': True,
        'template': template,
        'sections': generated_sections,
        'message': f'Generated {len(generated_sections)} profile sections using {template} template',
    }


def _generate_section(
    section_type: str,
    order: int,
    basic: dict,
    social: dict,
    gamification: dict,
    projects: list,
    achievements: list,
    interests: list,
    focus_areas: list,
) -> dict | None:
    """
    Generate a single profile section based on type.

    Supports all section types:
    - about: Bio/story
    - links: Social & external links
    - skills: Skill badges
    - learning_goals: What they're learning
    - featured_projects: Curated project selection
    - storefront: Products/services for creators
    - featured_content: Curated content for curation bots
    - battle_stats: Battle record for battle bots
    - recent_battles: Battle history for battle bots
    - custom: Free-form content blocks
    """

    section_id = f'profile-section-{section_type}-{uuid.uuid4().hex[:9]}'

    if section_type == 'about':
        return {
            'id': section_id,
            'type': 'about',
            'visible': True,
            'order': order,
            'content': {
                'bio': basic.get('bio', ''),
                'showLocation': bool(basic.get('location')),
                'showPronouns': bool(basic.get('pronouns')),
                'showStatus': bool(basic.get('current_status')),
            },
        }

    elif section_type == 'links':
        # Build links from social URLs
        links = []
        if social.get('website_url'):
            links.append({'label': 'Website', 'url': social['website_url'], 'icon': 'globe'})
        if social.get('linkedin_url'):
            links.append({'label': 'LinkedIn', 'url': social['linkedin_url'], 'icon': 'linkedin'})
        if social.get('github_url'):
            links.append({'label': 'GitHub', 'url': social['github_url'], 'icon': 'github'})
        if social.get('twitter_url'):
            links.append({'label': 'Twitter', 'url': social['twitter_url'], 'icon': 'twitter'})
        if social.get('youtube_url'):
            links.append({'label': 'YouTube', 'url': social['youtube_url'], 'icon': 'youtube'})
        if social.get('instagram_url'):
            links.append({'label': 'Instagram', 'url': social['instagram_url'], 'icon': 'instagram'})
        if social.get('calendar_url'):
            links.append(
                {'label': 'Book a Meeting', 'url': social['calendar_url'], 'icon': 'calendar', 'isPrimary': True}
            )

        return {
            'id': section_id,
            'type': 'links',
            'visible': True,
            'order': order,
            'content': {
                'links': links,
                'layout': 'grid',
            },
        }

    elif section_type == 'featured_projects':
        # Select best projects for featured
        # Prioritize: showcased, has image, has description
        sorted_projects = sorted(
            projects,
            key=lambda p: (
                p.get('is_showcased', False),
                bool(p.get('hero_image_url')),
                bool(p.get('description')),
            ),
            reverse=True,
        )

        featured_ids = [p['id'] for p in sorted_projects[:6]]

        return {
            'id': section_id,
            'type': 'featured_projects',
            'visible': True,
            'order': order,
            'content': {
                'projectIds': featured_ids,
                'maxProjects': 6,
                'layout': 'masonry',
                'showDescription': True,
            },
        }

    elif section_type == 'skills':
        # Generate skills from interests and project tools
        skills = []

        # Add skills from interests (manual tags first)
        manual_tags = [i for i in interests if i.get('source') == 'manual']
        auto_tags = [i for i in interests if i.get('source') != 'manual']

        for tag in manual_tags[:10]:
            skills.append(
                {
                    'name': tag['name'],
                    'category': 'core',
                    'level': 'proficient',
                }
            )

        # Add from auto-detected tags
        for tag in auto_tags[:5]:
            if tag.get('confidence', 0) > 0.5:
                skills.append(
                    {
                        'name': tag['name'],
                        'category': 'learning',
                        'level': 'learning',
                    }
                )

        # Add skills from project tools
        seen = set(s['name'].lower() for s in skills)
        for project in projects[:10]:
            for tool in project.get('tools', []):
                if tool['name'].lower() not in seen:
                    skills.append(
                        {
                            'name': tool['name'],
                            'category': 'tools',
                            'level': 'proficient',
                        }
                    )
                    seen.add(tool['name'].lower())

        return {
            'id': section_id,
            'type': 'skills',
            'visible': True,
            'order': order,
            'content': {
                'skills': skills[:15],  # Limit to 15 skills
                'showCategories': True,
                'showLevels': False,
                'layout': 'tags',
            },
        }

    elif section_type == 'learning_goals':
        # Generate learning goals from interests tagged as learning
        goals = []
        learning_tags = [i for i in interests if i.get('source') == 'learning' or 'learn' in i.get('name', '').lower()]

        for tag in learning_tags[:5]:
            goals.append(
                {
                    'topic': tag['name'],
                    'description': '',
                    'progress': 0,
                }
            )

        return {
            'id': section_id,
            'type': 'learning_goals',
            'visible': True,
            'order': order,
            'content': {
                'goals': goals,
                'showProgress': True,
                'title': 'Currently Learning',
            },
        }

    elif section_type == 'storefront':
        # Empty storefront for creators to fill in
        return {
            'id': section_id,
            'type': 'storefront',
            'visible': True,
            'order': order,
            'content': {
                'items': [],
                'title': 'Shop',
                'layout': 'grid',
            },
        }

    elif section_type == 'featured_content':
        # For curation bots - show their curated projects
        sorted_projects = sorted(
            projects,
            key=lambda p: p.get('created_at', ''),
            reverse=True,
        )
        featured_ids = [p['id'] for p in sorted_projects[:6]]

        return {
            'id': section_id,
            'type': 'featured_content',
            'visible': True,
            'order': order,
            'content': {
                'projectIds': featured_ids,
                'maxItems': 6,
                'title': 'Curated Picks',
                'layout': 'masonry',
            },
        }

    elif section_type == 'battle_stats':
        # For battle bots - stats loaded dynamically
        return {
            'id': section_id,
            'type': 'battle_stats',
            'visible': True,
            'order': order,
            'content': {
                'showWinRate': True,
                'showStreak': True,
                'showTotalBattles': True,
                'showRanking': False,
            },
        }

    elif section_type == 'recent_battles':
        # For battle bots - battles loaded dynamically
        return {
            'id': section_id,
            'type': 'recent_battles',
            'visible': True,
            'order': order,
            'content': {
                'maxBattles': 6,
                'showOutcome': True,
                'showChallenge': True,
                'layout': 'grid',
            },
        }

    elif section_type == 'custom':
        # Custom section with placeholder content
        return {
            'id': section_id,
            'type': 'custom',
            'visible': True,
            'order': order,
            'title': 'Custom Section',
            'content': {
                'title': 'Custom Section',
                'blocks': [],
            },
        }

    return None


@tool(args_schema=SaveProfileSectionsInput)
def save_profile_sections(
    sections: list[dict],
    state: dict | None = None,
) -> dict:
    """
    Save generated profile sections to the user's profile.

    This tool persists the profile sections to the database.
    The sections should be validated and approved by the user first.

    Returns:
        Dictionary with success status
    """
    from django.contrib.auth import get_user_model

    if not state or 'user_id' not in state:
        return {'success': False, 'error': 'User not authenticated'}

    user_id = state['user_id']
    User = get_user_model()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return {'success': False, 'error': 'User not found'}

    # Validate sections structure using all valid section types
    for section in sections:
        if not isinstance(section, dict):
            return {'success': False, 'error': 'Invalid section format'}
        if section.get('type') not in VALID_SECTION_TYPES:
            return {'success': False, 'error': f'Invalid section type: {section.get("type")}'}

    # Save sections
    user.profile_sections = sections
    user.save(update_fields=['profile_sections'])

    logger.info(f'Saved {len(sections)} profile sections for user {user.username}')

    return {
        'success': True,
        'sections_saved': len(sections),
        'message': f'Successfully saved {len(sections)} profile sections',
    }


# Tool list for agent
PROFILE_TOOLS = [gather_user_data, generate_profile_sections, save_profile_sections]
