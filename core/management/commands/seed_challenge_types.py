"""Seed initial challenge types for Prompt Battles."""

from django.core.management.base import BaseCommand

from core.battles.models import ChallengeType
from core.taxonomy.models import Taxonomy

CHALLENGE_TYPES = [
    {
        'key': 'dreamscape',
        'name': 'Dreamscape Design',
        'description': 'Create surreal, dreamlike landscapes and environments using AI image generation.',
        'category_slug': 'images-video',
        'templates': [
            'Design a dreamscape featuring {element} in a {style} world',
            'Create a surreal landscape where {concept} comes to life',
            'Imagine a dream world with {element} and {atmosphere} atmosphere',
        ],
        'variables': {
            'element': [
                'nano banana',
                'floating islands',
                'crystal trees',
                'liquid metal rivers',
                'impossible staircases',
                'melting clocks',
            ],
            'style': ['ethereal', 'cosmic', 'underwater', 'steampunk', 'bioluminescent', 'ancient ruins'],
            'concept': ['time flows backwards', 'gravity is optional', 'colors have sounds', 'memories become visible'],
            'atmosphere': ['mystical', 'haunting', 'peaceful', 'chaotic', 'nostalgic'],
        },
        'judging_criteria': [
            {'name': 'Creativity', 'weight': 30, 'description': 'How original and imaginative is the vision?'},
            {'name': 'Visual Impact', 'weight': 25, 'description': 'How striking and memorable is the image?'},
            {'name': 'Challenge Relevance', 'weight': 25, 'description': 'How well does it address the prompt?'},
            {'name': 'Artistic Cohesion', 'weight': 20, 'description': 'How well do elements work together?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'medium',
    },
    {
        'key': 'movie_poster',
        'name': 'Movie Poster Challenge',
        'description': 'Design compelling movie posters for imaginary films.',
        'category_slug': 'images-video',
        'templates': [
            'Design a movie poster for a {genre} film about {concept}',
            'Create the theatrical poster for "{title}" - a {genre} movie',
            'Design a minimalist movie poster capturing the essence of {theme}',
        ],
        'variables': {
            'genre': ['sci-fi', 'horror', 'romantic comedy', 'action thriller', 'documentary', 'animated'],
            'concept': [
                'AI gaining consciousness',
                'a time loop in Tokyo',
                'parallel universes colliding',
                'the last library on Earth',
            ],
            'title': ['The Last Algorithm', 'Dreams of Electric Sheep', 'Beyond the Singularity', 'The Color of Time'],
            'theme': ['loneliness in a connected world', 'hope after apocalypse', 'love across dimensions'],
        },
        'judging_criteria': [
            {
                'name': 'Poster Appeal',
                'weight': 30,
                'description': 'Would you want to see this movie based on the poster?',
            },
            {'name': 'Genre Fit', 'weight': 25, 'description': 'Does it capture the genre effectively?'},
            {'name': 'Creativity', 'weight': 25, 'description': 'How original is the design approach?'},
            {'name': 'Technical Quality', 'weight': 20, 'description': 'Is the composition and design well-executed?'},
        ],
        'default_duration_minutes': 4,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'medium',
    },
    {
        'key': 'creature_design',
        'name': 'Creature Design',
        'description': 'Design unique creatures, monsters, or fantastical beings.',
        'category_slug': 'images-video',
        'templates': [
            'Design a {type} creature that lives in {habitat}',
            'Create a {mood} being that embodies the concept of {concept}',
            'Design a hybrid creature combining {animal1} and {animal2} traits',
        ],
        'variables': {
            'type': ['friendly', 'terrifying', 'majestic', 'ancient', 'mechanical', 'ethereal'],
            'habitat': [
                'deep ocean trenches',
                'volcanic caves',
                'cloud cities',
                'crystal forests',
                'abandoned space stations',
            ],
            'mood': ['peaceful', 'menacing', 'playful', 'wise', 'mysterious'],
            'concept': ['time', 'chaos', 'nature', 'technology', 'dreams'],
            'animal1': ['dragon', 'wolf', 'octopus', 'phoenix', 'butterfly'],
            'animal2': ['jellyfish', 'tiger', 'owl', 'serpent', 'moth'],
        },
        'judging_criteria': [
            {'name': 'Originality', 'weight': 30, 'description': 'How unique and creative is the design?'},
            {'name': 'Visual Design', 'weight': 25, 'description': 'Is it visually compelling and well-designed?'},
            {'name': 'Concept Clarity', 'weight': 25, 'description': "Is the creature's nature clearly conveyed?"},
            {'name': 'Detail & Coherence', 'weight': 20, 'description': 'Are the details consistent and believable?'},
        ],
        'default_duration_minutes': 4,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'medium',
    },
    {
        'key': 'album_cover',
        'name': 'Album Cover Art',
        'description': 'Design album cover artwork for imaginary music releases.',
        'category_slug': 'images-video',
        'templates': [
            'Design an album cover for a {genre} album called "{title}"',
            'Create cover art for a {mood} {genre} EP',
            'Design vinyl artwork for an experimental {genre} release about {theme}',
        ],
        'variables': {
            'genre': ['synthwave', 'lo-fi hip hop', 'ambient', 'indie rock', 'jazz fusion', 'electronic'],
            'title': ['Midnight Protocol', 'Echoes of Tomorrow', 'Digital Dreams', 'The Last Sunset', 'Neon Memories'],
            'mood': ['melancholic', 'euphoric', 'mysterious', 'energetic', 'contemplative'],
            'theme': ['urban isolation', 'cosmic exploration', 'digital love', 'late night drives'],
        },
        'judging_criteria': [
            {
                'name': 'Mood & Atmosphere',
                'weight': 30,
                'description': 'Does it evoke the right feeling for the music?',
            },
            {'name': 'Visual Creativity', 'weight': 25, 'description': 'How creative and striking is the design?'},
            {'name': 'Genre Fit', 'weight': 25, 'description': 'Does it fit the musical genre?'},
            {'name': 'Album Cover Quality', 'weight': 20, 'description': 'Would this work as actual album art?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'easy',
    },
    {
        'key': 'future_city',
        'name': 'Future City Vision',
        'description': 'Design cityscapes and urban environments of the future.',
        'category_slug': 'images-video',
        'templates': [
            'Design a {style} city in the year {year}',
            'Create a futuristic {district} district with {technology}',
            'Imagine a city built around {concept} as its core principle',
        ],
        'variables': {
            'style': ['utopian', 'dystopian', 'solarpunk', 'cyberpunk', 'bio-organic', 'neo-classical'],
            'year': ['2100', '2250', '3000', '2500'],
            'district': ['residential', 'entertainment', 'industrial', 'cultural', 'transportation'],
            'technology': ['vertical gardens', 'floating platforms', 'AI integration', 'renewable energy towers'],
            'concept': ['sustainability', 'vertical living', 'human-AI coexistence', 'post-scarcity'],
        },
        'judging_criteria': [
            {
                'name': 'World-Building',
                'weight': 30,
                'description': 'How believable and detailed is the future vision?',
            },
            {'name': 'Visual Impact', 'weight': 25, 'description': 'How striking is the cityscape?'},
            {'name': 'Creativity', 'weight': 25, 'description': 'How original are the ideas?'},
            {'name': 'Technical Execution', 'weight': 20, 'description': 'How well is it rendered?'},
        ],
        'default_duration_minutes': 4,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'medium',
    },
]


class Command(BaseCommand):
    help = 'Seed initial challenge types for Prompt Battles'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing challenge types before seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = ChallengeType.objects.count()
            ChallengeType.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {count} existing challenge types'))

        created_count = 0
        updated_count = 0

        for data in CHALLENGE_TYPES:
            # Get category if specified
            category = None
            if data.get('category_slug'):
                try:
                    category = Taxonomy.objects.get(
                        slug=data['category_slug'], taxonomy_type='category', is_active=True
                    )
                except Taxonomy.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(f"Category '{data['category_slug']}' not found for {data['key']}")
                    )

            challenge_type, created = ChallengeType.objects.update_or_create(
                key=data['key'],
                defaults={
                    'name': data['name'],
                    'description': data['description'],
                    'category': category,
                    'templates': data['templates'],
                    'variables': data['variables'],
                    'judging_criteria': data['judging_criteria'],
                    'default_duration_minutes': data.get('default_duration_minutes', 3),
                    'winner_points': data.get('winner_points', 50),
                    'participation_points': data.get('participation_points', 10),
                    'difficulty': data.get('difficulty', 'medium'),
                    'is_active': True,
                    'order': CHALLENGE_TYPES.index(data),
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {challenge_type.name}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'Updated: {challenge_type.name}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Done! Created: {created_count}, Updated: {updated_count}'))
        self.stdout.write(f'Total challenge types: {ChallengeType.objects.count()}')
