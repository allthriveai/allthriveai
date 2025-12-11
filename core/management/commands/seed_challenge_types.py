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
    {
        'key': 'food_photography',
        'name': 'Food Photography',
        'description': 'Create mouthwatering dishes and culinary presentations that look delicious.',
        'category_slug': 'images-video',
        'templates': [
            'Create a stunning photo of {dish} with {style} plating',
            'Design a {cuisine} dish that looks absolutely irresistible',
            'Photograph a {meal_type} featuring {ingredient} as the star',
        ],
        'variables': {
            'dish': [
                'gourmet burger',
                'artisan pizza',
                'sushi platter',
                'chocolate dessert',
                'fresh pasta',
                'colorful salad',
            ],
            'style': ['rustic', 'minimalist', 'elegant fine-dining', 'street food', 'homestyle comfort'],
            'cuisine': ['Italian', 'Japanese', 'Mexican', 'French', 'Thai', 'American BBQ'],
            'meal_type': ['breakfast', 'brunch', 'dinner', 'dessert', 'appetizer'],
            'ingredient': ['avocado', 'truffle', 'fresh seafood', 'seasonal vegetables', 'artisan cheese'],
        },
        'judging_criteria': [
            {'name': 'Appetizing Appeal', 'weight': 35, 'description': 'Does it make you hungry?'},
            {'name': 'Presentation', 'weight': 25, 'description': 'How beautiful is the plating and styling?'},
            {'name': 'Creativity', 'weight': 20, 'description': 'How unique and creative is the concept?'},
            {'name': 'Realism', 'weight': 20, 'description': 'Does it look like real, edible food?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'easy',
    },
    {
        'key': 'pet_portraits',
        'name': 'Pet Portraits',
        'description': 'Create adorable, majestic, or hilarious pet photography and portraits.',
        'category_slug': 'images-video',
        'templates': [
            'Create a {style} portrait of a {pet} with {personality}',
            'Photograph a {pet} in a {setting} looking absolutely {mood}',
            'Design a {pet} portrait in the style of {art_style}',
        ],
        'variables': {
            'pet': ['golden retriever', 'tabby cat', 'french bulldog', 'parrot', 'bunny', 'corgi'],
            'style': ['professional studio', 'candid outdoor', 'artistic', 'funny costume', 'regal renaissance'],
            'personality': ['derpy energy', 'majestic dignity', 'playful chaos', 'sleepy vibes', 'curious expression'],
            'setting': ['cozy living room', 'sunny park', 'autumn leaves', 'beach', 'flower garden'],
            'mood': ['adorable', 'majestic', 'hilarious', 'peaceful', 'mischievous'],
            'art_style': ['Renaissance painting', 'pop art', 'watercolor', 'vintage photography'],
        },
        'judging_criteria': [
            {'name': 'Cuteness/Appeal', 'weight': 35, 'description': 'How adorable or appealing is the pet?'},
            {'name': 'Expression & Character', 'weight': 25, 'description': 'Does the pet have personality?'},
            {'name': 'Creativity', 'weight': 20, 'description': 'How creative is the concept?'},
            {'name': 'Technical Quality', 'weight': 20, 'description': 'Is it well-composed and realistic?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'easy',
    },
    {
        'key': 'material_texture',
        'name': 'Material & Texture',
        'description': 'Master describing materials like glass, metal, fabric, and water with precision.',
        'category_slug': 'images-video',
        'templates': [
            'Create an object made entirely of {material} with {lighting}',
            'Design a {object} that showcases the texture of {material}',
            'Render a scene where {material} and {material2} interact beautifully',
        ],
        'variables': {
            'material': [
                'polished chrome',
                'frosted glass',
                'worn leather',
                'liquid mercury',
                'cracked marble',
                'iridescent soap bubbles',
            ],
            'material2': ['velvet fabric', 'rough stone', 'smooth water', 'rusted metal', 'fresh ice'],
            'lighting': ['dramatic backlighting', 'soft diffused light', 'harsh sunlight', 'neon glow'],
            'object': ['sculpture', 'furniture piece', 'jewelry', 'architectural element', 'vessel'],
        },
        'judging_criteria': [
            {'name': 'Material Accuracy', 'weight': 35, 'description': 'Does the material look realistic?'},
            {'name': 'Texture Detail', 'weight': 30, 'description': 'How well are textures conveyed?'},
            {'name': 'Prompt Precision', 'weight': 20, 'description': 'Did the prompt achieve the desired result?'},
            {'name': 'Visual Appeal', 'weight': 15, 'description': 'Is it aesthetically pleasing?'},
        ],
        'default_duration_minutes': 4,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'hard',
    },
    {
        'key': 'historical_accuracy',
        'name': 'Historical Accuracy',
        'description': 'Recreate specific historical eras with authentic period details.',
        'category_slug': 'images-video',
        'templates': [
            'Create an authentic scene from {era} showing {activity}',
            'Design a {person} from {era} in their typical environment',
            'Recreate a {location} as it would have looked in {era}',
        ],
        'variables': {
            'era': [
                '1920s Art Deco',
                'Victorian England',
                'Ancient Egypt',
                '1980s neon',
                'Medieval Europe',
                'Renaissance Italy',
            ],
            'activity': ['a celebration', 'daily work', 'a market scene', 'a formal gathering', 'street life'],
            'person': ['merchant', 'noble', 'artisan', 'scholar', 'performer'],
            'location': ['city street', 'grand hall', 'marketplace', 'private home', 'public square'],
        },
        'judging_criteria': [
            {'name': 'Historical Accuracy', 'weight': 35, 'description': 'Are period details correct?'},
            {'name': 'Atmosphere', 'weight': 25, 'description': 'Does it feel authentic to the era?'},
            {'name': 'Detail Richness', 'weight': 25, 'description': 'How detailed is the scene?'},
            {'name': 'Creativity', 'weight': 15, 'description': 'How creative is the interpretation?'},
        ],
        'default_duration_minutes': 4,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'hard',
    },
    {
        'key': 'action_freeze',
        'name': 'Action Freeze',
        'description': 'Capture dynamic motion frozen mid-action with perfect timing.',
        'category_slug': 'images-video',
        'templates': [
            'Freeze the moment of {action} with {style} photography',
            'Capture a {subject} mid-{motion} with dramatic effect',
            'Create a split-second freeze frame of {scenario}',
        ],
        'variables': {
            'action': [
                'a splash of water',
                'an explosion of color',
                'a dancer leaping',
                'glass shattering',
                'a bird taking flight',
            ],
            'subject': ['athlete', 'animal', 'vehicle', 'liquid', 'performer'],
            'motion': ['jump', 'spin', 'dive', 'collision', 'transformation'],
            'style': ['high-speed', 'dramatic', 'artistic', 'sports', 'cinematic'],
            'scenario': ['paint being thrown', 'a skateboard trick', 'raindrops hitting water', 'a punch being thrown'],
        },
        'judging_criteria': [
            {'name': 'Motion Capture', 'weight': 35, 'description': 'Is the movement convincingly frozen?'},
            {'name': 'Dynamic Energy', 'weight': 25, 'description': 'Does it feel energetic and alive?'},
            {'name': 'Technical Execution', 'weight': 25, 'description': 'Is the image sharp and well-composed?'},
            {'name': 'Creativity', 'weight': 15, 'description': 'How creative is the action captured?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'medium',
    },
    {
        'key': 'lighting_master',
        'name': 'Lighting Master',
        'description': 'Master the art of describing lighting conditions for dramatic effect.',
        'category_slug': 'images-video',
        'templates': [
            'Create a portrait using only {lighting_type} lighting',
            'Design a {scene} illuminated by {light_source}',
            'Capture {subject} during {time_of_day} with {mood} atmosphere',
        ],
        'variables': {
            'lighting_type': [
                'golden hour',
                'harsh rim lighting',
                'soft diffused',
                'dramatic chiaroscuro',
                'neon-lit',
                'candlelit',
            ],
            'scene': ['cityscape', 'forest', 'interior room', 'portrait', 'still life'],
            'light_source': ['a single candle', 'moonlight', 'neon signs', 'firelight', 'studio softbox'],
            'subject': ['a person', 'an object', 'a landscape', 'an animal', 'architecture'],
            'time_of_day': ['blue hour', 'high noon', 'sunset', 'midnight', 'dawn'],
            'mood': ['mysterious', 'warm and inviting', 'cold and stark', 'romantic', 'eerie'],
        },
        'judging_criteria': [
            {'name': 'Lighting Quality', 'weight': 40, 'description': 'Is the lighting well-executed?'},
            {'name': 'Mood Creation', 'weight': 25, 'description': 'Does lighting create the right mood?'},
            {'name': 'Technical Skill', 'weight': 20, 'description': 'Shows understanding of light?'},
            {'name': 'Creativity', 'weight': 15, 'description': 'How creative is the lighting choice?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'medium',
    },
    {
        'key': 'street_style',
        'name': 'Street Style Fashion',
        'description': 'Design trendy streetwear outfits and fashion-forward looks.',
        'category_slug': 'images-video',
        'templates': [
            'Create a {style} streetwear look for {season}',
            'Design an outfit featuring {item} with {vibe} energy',
            'Style a {demographic} in {city} street fashion',
        ],
        'variables': {
            'style': ['hypebeast', 'minimalist', 'Y2K revival', 'techwear', 'vintage thrift', 'athleisure'],
            'season': ['summer festival', 'fall layering', 'winter urban', 'spring casual'],
            'item': ['statement sneakers', 'oversized jacket', 'designer bag', 'vintage denim', 'bold accessories'],
            'vibe': ['laid-back', 'edgy', 'colorful', 'monochromatic', 'retro'],
            'demographic': ['Gen-Z trendsetter', 'fashion influencer', 'skater', 'creative professional'],
            'city': ['Tokyo', 'New York', 'Paris', 'London', 'Seoul', 'Los Angeles'],
        },
        'judging_criteria': [
            {'name': 'Style & Trend', 'weight': 30, 'description': 'How fashionable and on-trend is it?'},
            {'name': 'Outfit Cohesion', 'weight': 25, 'description': 'Do the pieces work well together?'},
            {'name': 'Creativity', 'weight': 25, 'description': 'How unique and creative is the look?'},
            {'name': 'Wearability', 'weight': 20, 'description': 'Would someone actually wear this?'},
        ],
        'default_duration_minutes': 3,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'easy',
    },
    {
        'key': 'meme_generator',
        'name': 'Meme Generator',
        'description': 'Create hilarious, shareable meme images and reaction pics.',
        'category_slug': 'images-video',
        'templates': [
            'Create a meme about {topic} that would go viral',
            'Design a reaction image for when {situation}',
            'Make a hilarious meme featuring {subject} in {scenario}',
        ],
        'variables': {
            'topic': [
                'Monday mornings',
                'working from home',
                'online shopping',
                'group projects',
                'adulting struggles',
                'tech problems',
            ],
            'situation': [
                'your code finally works',
                "you realize it's only Tuesday",
                'the WiFi goes out',
                'you see your bank account',
                'someone says "quick meeting"',
            ],
            'subject': ['confused cat', 'dramatic dog', 'surprised person', 'disappointed celebrity', 'excited kid'],
            'scenario': ['an office setting', 'a kitchen disaster', 'a gym fail', 'a dating app moment'],
        },
        'judging_criteria': [
            {'name': 'Humor', 'weight': 40, 'description': 'How funny is it?'},
            {'name': 'Relatability', 'weight': 25, 'description': 'Do people connect with it?'},
            {'name': 'Shareability', 'weight': 20, 'description': 'Would people share this?'},
            {'name': 'Creativity', 'weight': 15, 'description': 'How original is the concept?'},
        ],
        'default_duration_minutes': 2,
        'winner_points': 50,
        'participation_points': 10,
        'difficulty': 'easy',
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
