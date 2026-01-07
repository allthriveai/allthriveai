"""
Clip templates and default configurations.
"""

# Available icons for visuals
AVAILABLE_ICONS = [
    'robot',
    'brain',
    'bolt',
    'lightbulb',
    'rocket',
    'code',
    'database',
    'cloud',
    'magic',
    'chart',
    'gears',
    'shield',
    'arrow',
]

# Animation types
ANIMATION_TYPES = ['fade', 'slide', 'zoom', 'bounce', 'pulse', 'float']

# Scene type durations (milliseconds)
SCENE_DURATIONS = {
    'hook': 4500,
    'point': 10000,
    'example': 10000,
    'cta': 4500,
    'comparison_a': 6000,
    'comparison_b': 6000,
    'winner': 5000,
}


def get_default_style() -> dict:
    """Get the default neon glass style."""
    return {
        'primaryColor': '#22D3EE',  # Cyan
        'accentColor': '#10B981',  # Green
    }


# Template definitions with suggested scene structures
CLIP_TEMPLATES = {
    'quick_tip': {
        'description': 'Single actionable tip',
        'suggested_scenes': ['hook', 'point', 'cta'],
        'duration_range': (15000, 25000),  # 15-25 seconds
    },
    'explainer': {
        'description': 'Educational content explaining a concept',
        'suggested_scenes': ['hook', 'point', 'point', 'point', 'cta'],
        'duration_range': (30000, 45000),  # 30-45 seconds
    },
    'how_to': {
        'description': 'Step-by-step guide',
        'suggested_scenes': ['hook', 'point', 'point', 'point', 'point', 'cta'],
        'duration_range': (35000, 50000),  # 35-50 seconds
    },
    'comparison': {
        'description': 'Compare two things',
        'suggested_scenes': ['hook', 'comparison_a', 'comparison_b', 'winner', 'cta'],
        'duration_range': (25000, 40000),  # 25-40 seconds
    },
}


# Example clips for reference
EXAMPLE_CLIPS = {
    'rag_explainer': {
        'template': 'explainer',
        'scenes': [
            {
                'id': 'hook-1',
                'type': 'hook',
                'content': {
                    'headline': 'Your chatbot is lying to users',
                    'body': 'RAG fixes this.',
                    'visual': {
                        'type': 'icon',
                        'icon': 'robot',
                        'size': 'large',
                        'animation': 'bounce',
                    },
                },
            },
            {
                'id': 'point-1',
                'type': 'point',
                'content': {
                    'headline': 'What is RAG?',
                    'body': 'Retrieval-Augmented Generation connects your AI to real data sources.',
                    'bullets': ['Vector databases', 'Semantic search', 'Contextual responses'],
                    'visual': {
                        'type': 'icon',
                        'icon': 'database',
                        'size': 'medium',
                        'animation': 'fade',
                    },
                },
            },
            {
                'id': 'point-2',
                'type': 'point',
                'content': {
                    'headline': 'How it works',
                    'visual': {
                        'type': 'icon',
                        'icon': 'gears',
                        'size': 'medium',
                        'animation': 'pulse',
                    },
                    'code': (
                        'query = "How do I reset my password?"\n'
                        'docs = vector_db.search(query, k=3)\n'
                        'context = "\\n".join(docs)\n'
                        'response = llm.generate(query, context)'
                    ),
                    'codeLanguage': 'python',
                },
            },
            {
                'id': 'point-3',
                'type': 'point',
                'content': {
                    'headline': 'Why it matters',
                    'body': 'Your AI becomes accurate, up-to-date, and trustworthy.',
                    'visual': {
                        'type': 'icon',
                        'icon': 'shield',
                        'size': 'medium',
                        'animation': 'zoom',
                    },
                    'bullets': ['No more hallucinations', 'Real-time data', 'Source citations'],
                },
            },
            {
                'id': 'cta-1',
                'type': 'cta',
                'content': {
                    'headline': 'Follow for more AI tips',
                    'body': 'allthriveai.com',
                },
            },
        ],
        'style': get_default_style(),
    },
}


def get_template_info(template_name: str) -> dict | None:
    """Get information about a template."""
    return CLIP_TEMPLATES.get(template_name)


def get_example_clip(name: str) -> dict | None:
    """Get an example clip by name."""
    return EXAMPLE_CLIPS.get(name)
