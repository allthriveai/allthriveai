"""
Tool Recommendation Service

Provides intelligent tool recommendations based on user quiz answers.
Matches user needs to tool categories, features, pricing, and use cases.
"""

from typing import Any

from django.db.models import Case, F, Q, Value, When
from django.db.models.functions import Coalesce

from .models import Tool

# Quiz questions for tool recommendation
RECOMMENDATION_QUESTIONS = [
    {
        'id': 'primary_goal',
        'question': 'What do you primarily want to create or accomplish with AI?',
        'type': 'single_choice',
        'options': [
            {'value': 'writing', 'label': 'Write content (blogs, emails, copy)', 'icon': 'pencil'},
            {'value': 'code', 'label': 'Write or debug code', 'icon': 'code'},
            {'value': 'images', 'label': 'Generate images or art', 'icon': 'photo'},
            {'value': 'video', 'label': 'Create or edit videos', 'icon': 'video'},
            {'value': 'audio', 'label': 'Generate audio or music', 'icon': 'musical-note'},
            {'value': 'research', 'label': 'Research and find information', 'icon': 'magnifying-glass'},
            {'value': 'productivity', 'label': 'Automate tasks and boost productivity', 'icon': 'bolt'},
            {'value': 'chat', 'label': 'Have conversations and get answers', 'icon': 'chat-bubble'},
        ],
    },
    {
        'id': 'experience_level',
        'question': 'How experienced are you with AI tools?',
        'type': 'single_choice',
        'options': [
            {'value': 'beginner', 'label': "I'm just getting started", 'icon': 'academic-cap'},
            {'value': 'intermediate', 'label': "I've used a few AI tools", 'icon': 'chart-bar'},
            {'value': 'advanced', 'label': 'I use AI tools regularly', 'icon': 'rocket-launch'},
        ],
    },
    {
        'id': 'budget',
        'question': "What's your budget for AI tools?",
        'type': 'single_choice',
        'options': [
            {'value': 'free', 'label': 'Free only', 'icon': 'gift'},
            {'value': 'freemium', 'label': 'Free with optional upgrades', 'icon': 'sparkles'},
            {'value': 'paid', 'label': 'Willing to pay for the right tool', 'icon': 'credit-card'},
        ],
    },
    {
        'id': 'use_frequency',
        'question': 'How often do you plan to use AI tools?',
        'type': 'single_choice',
        'options': [
            {'value': 'occasional', 'label': 'Occasionally (a few times a month)', 'icon': 'calendar'},
            {'value': 'regular', 'label': 'Regularly (weekly)', 'icon': 'arrow-path'},
            {'value': 'daily', 'label': 'Daily for work or projects', 'icon': 'fire'},
        ],
    },
    {
        'id': 'important_features',
        'question': 'What features matter most to you? (Select up to 3)',
        'type': 'multi_choice',
        'max_selections': 3,
        'options': [
            {'value': 'ease_of_use', 'label': 'Easy to use', 'icon': 'hand-thumb-up'},
            {'value': 'quality', 'label': 'High quality output', 'icon': 'star'},
            {'value': 'speed', 'label': 'Fast results', 'icon': 'bolt'},
            {'value': 'customization', 'label': 'Customization options', 'icon': 'adjustments-horizontal'},
            {'value': 'api_access', 'label': 'API access for developers', 'icon': 'code-bracket'},
            {'value': 'integrations', 'label': 'Integrations with other tools', 'icon': 'puzzle-piece'},
            {'value': 'privacy', 'label': 'Privacy and data security', 'icon': 'shield-check'},
            {'value': 'collaboration', 'label': 'Team collaboration', 'icon': 'user-group'},
        ],
    },
    {
        'id': 'specific_needs',
        'question': 'Any specific needs or preferences?',
        'type': 'multi_choice',
        'max_selections': 2,
        'options': [
            {'value': 'mobile', 'label': 'Mobile app available', 'icon': 'device-phone-mobile'},
            {'value': 'browser', 'label': 'Works in browser', 'icon': 'globe-alt'},
            {'value': 'offline', 'label': 'Works offline', 'icon': 'cloud-arrow-down'},
            {'value': 'open_source', 'label': 'Open source', 'icon': 'lock-open'},
            {'value': 'enterprise', 'label': 'Enterprise features', 'icon': 'building-office'},
            {'value': 'none', 'label': 'No specific preferences', 'icon': 'minus-circle'},
        ],
    },
]


# Mapping from quiz answers to tool categories
GOAL_TO_CATEGORY = {
    'writing': ['writing', 'chat'],
    'code': ['code', 'chat'],
    'images': ['image', 'design'],
    'video': ['video'],
    'audio': ['audio'],
    'research': ['research', 'chat'],
    'productivity': ['productivity', 'chat'],
    'chat': ['chat'],
}

# Mapping from quiz answers to pricing preferences
BUDGET_TO_PRICING = {
    'free': ['free', 'open_source'],
    'freemium': ['freemium', 'free', 'open_source'],
    'paid': ['subscription', 'freemium', 'pay_per_use', 'enterprise'],
}


class ToolRecommendationService:
    """Service for recommending AI tools based on user quiz answers."""

    def __init__(self):
        self.questions = RECOMMENDATION_QUESTIONS

    def get_questions(self) -> list[dict]:
        """Return the quiz questions."""
        return self.questions

    def get_recommendations(
        self,
        answers: dict[str, Any],
        limit: int = 5,
    ) -> list[dict]:
        """
        Get tool recommendations based on user answers.

        Args:
            answers: Dict of question_id -> answer value(s)
            limit: Maximum number of recommendations to return

        Returns:
            List of tool recommendations with match scores and reasons
        """
        # Start with active AI tools only
        queryset = Tool.objects.filter(
            is_active=True,
            tool_type='ai_tool',
        )

        # Build scoring criteria

        # 1. Primary goal matching (40% weight)
        primary_goal = answers.get('primary_goal')
        if primary_goal:
            categories = GOAL_TO_CATEGORY.get(primary_goal, [])
            queryset = queryset.filter(category__in=categories)

        # 2. Budget matching (20% weight)
        budget = answers.get('budget')
        if budget:
            pricing_models = BUDGET_TO_PRICING.get(budget, [])
            if budget == 'free':
                queryset = queryset.filter(Q(pricing_model__in=pricing_models) | Q(has_free_tier=True))

        # Annotate with scoring
        queryset = queryset.annotate(
            # Base score from popularity and featured status
            base_score=Coalesce(F('popularity_score'), Value(0.0)),
            # Boost for featured tools
            featured_boost=Case(
                When(is_featured=True, then=Value(10.0)),
                default=Value(0.0),
            ),
            # Boost for verified tools
            verified_boost=Case(
                When(is_verified=True, then=Value(5.0)),
                default=Value(0.0),
            ),
            # Boost for free tier (if user wants free)
            free_boost=Case(
                When(has_free_tier=True, then=Value(5.0))
                if budget == 'free'
                else When(pk__isnull=True, then=Value(0.0)),
                default=Value(0.0),
            ),
            # Total score
            total_score=F('base_score') + F('featured_boost') + F('verified_boost') + F('free_boost'),
        )

        # Order by score and get top results
        tools = queryset.order_by('-total_score', '-is_featured', 'name')[:limit]

        # Build recommendations with match reasons
        recommendations = []
        for tool in tools:
            match_score = self._calculate_match_score(tool, answers)
            reasons = self._get_match_reasons(tool, answers)

            recommendations.append(
                {
                    'tool': {
                        'id': tool.id,
                        'name': tool.name,
                        'slug': tool.slug,
                        'tagline': tool.tagline,
                        'description': tool.description[:200] + '...'
                        if len(tool.description) > 200
                        else tool.description,
                        'logo_url': tool.logo_url,
                        'category': tool.category,
                        'category_display': tool.get_category_display(),
                        'pricing_model': tool.pricing_model,
                        'pricing_display': tool.get_pricing_model_display(),
                        'has_free_tier': tool.has_free_tier,
                        'starting_price': tool.starting_price,
                        'website_url': tool.website_url,
                        'is_featured': tool.is_featured,
                        'is_verified': tool.is_verified,
                    },
                    'match_score': match_score,
                    'match_reasons': reasons,
                }
            )

        # Sort by match score
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)

        return recommendations

    def _calculate_match_score(self, tool: Tool, answers: dict) -> int:
        """Calculate a match score from 0-100 based on how well the tool matches answers."""
        score = 50  # Base score

        # Primary goal match (+30)
        primary_goal = answers.get('primary_goal')
        if primary_goal:
            categories = GOAL_TO_CATEGORY.get(primary_goal, [])
            if tool.category in categories:
                score += 30
                # Exact category match bonus
                if tool.category == primary_goal or (primary_goal == 'images' and tool.category == 'image'):
                    score += 5

        # Budget match (+15)
        budget = answers.get('budget')
        if budget:
            pricing_models = BUDGET_TO_PRICING.get(budget, [])
            if tool.pricing_model in pricing_models:
                score += 10
            if budget == 'free' and tool.has_free_tier:
                score += 5

        # Experience level consideration (+5)
        experience = answers.get('experience_level')
        if experience == 'beginner' and tool.is_featured:
            score += 5  # Featured tools are usually more beginner-friendly
        elif experience == 'advanced' and tool.api_available:
            score += 5  # Advanced users value API access

        # Important features match (+10)
        features = answers.get('important_features', [])
        if isinstance(features, str):
            features = [features]
        if 'api_access' in features and tool.api_available:
            score += 5
        if 'quality' in features and tool.is_verified:
            score += 5

        # Specific needs match (+5)
        needs = answers.get('specific_needs', [])
        if isinstance(needs, str):
            needs = [needs]
        if 'open_source' in needs and tool.pricing_model == 'open_source':
            score += 5

        # Popularity boost (+5)
        if tool.is_featured:
            score += 3
        if tool.is_verified:
            score += 2

        return min(score, 100)

    def _get_match_reasons(self, tool: Tool, answers: dict) -> list[str]:
        """Generate human-readable reasons why this tool matches."""
        reasons = []

        # Primary goal match
        primary_goal = answers.get('primary_goal')
        if primary_goal:
            goal_labels = {
                'writing': 'writing and content creation',
                'code': 'coding and development',
                'images': 'image generation',
                'video': 'video creation',
                'audio': 'audio and music',
                'research': 'research and information',
                'productivity': 'productivity and automation',
                'chat': 'conversations and Q&A',
            }
            if tool.category in GOAL_TO_CATEGORY.get(primary_goal, []):
                reasons.append(f'Great for {goal_labels.get(primary_goal, primary_goal)}')

        # Budget match
        budget = answers.get('budget')
        if budget == 'free' and tool.has_free_tier:
            reasons.append('Has a free tier')
        elif budget == 'free' and tool.pricing_model in ['free', 'open_source']:
            reasons.append('Completely free to use')

        # Features
        if tool.is_verified:
            reasons.append('Verified by our team')
        if tool.is_featured:
            reasons.append('Popular choice')
        if tool.api_available and 'api_access' in answers.get('important_features', []):
            reasons.append('API access available')

        # Ensure at least one reason
        if not reasons:
            reasons.append(f'Specialized for {tool.get_category_display()}')

        return reasons[:3]  # Limit to 3 reasons


def get_recommendation_questions() -> list[dict]:
    """Get the tool recommendation quiz questions."""
    return RECOMMENDATION_QUESTIONS


def get_tool_recommendations(answers: dict, limit: int = 5) -> list[dict]:
    """Get tool recommendations based on quiz answers."""
    service = ToolRecommendationService()
    return service.get_recommendations(answers, limit)
