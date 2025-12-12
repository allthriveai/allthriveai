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
            'You fell asleep on a {transport} and woke up in a world made entirely of {element}',
            "Your grandma's attic has a portal to a dimension where {concept}",
            'Design the vacation brochure for a resort where {weird_rule}',
        ],
        'variables': {
            'element': [
                'sentient jello',
                'forgotten birthday wishes',
                'library books that never got returned',
                'your childhood imaginary friends',
                'expired coupons',
                'awkward silences made solid',
            ],
            'transport': ['subway', 'dentist chair', 'IKEA shopping cart', 'elevator', 'grocery store checkout line'],
            'concept': [
                'pizza is the dominant life form',
                'everyone communicates through interpretive dance',
                'shadows have their own social media',
                'clouds are just sky sheep',
            ],
            'weird_rule': [
                'gravity only works on Tuesdays',
                'your reflection gives unsolicited advice',
                'trees gossip about tourists',
                'the sun sets upward',
            ],
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
            'Design a movie poster for "{title}" - a {genre} blockbuster',
            'Create the poster for a {genre} film where {ridiculous_plot}',
            'Design the sequel poster: "{sequel_title}"',
        ],
        'variables': {
            'genre': [
                'romantic comedy',
                'intense thriller',
                'family adventure',
                'indie drama',
                'action blockbuster',
                'mockumentary',
            ],
            'ridiculous_plot': [
                'a golden retriever becomes a divorce lawyer',
                "someone's GPS becomes sentient and passive-aggressive",
                'a grandma accidentally joins a biker gang',
                "an introvert must save the world but really doesn't want to",
                'two rival food trucks fall in love',
            ],
            'title': [
                'Oops, I Started a Cult',
                'My Uber Driver is a Vampire',
                'Brunch of the Dead',
                'The Accountant Who Knew Too Much',
                'Swipe Right for Doom',
            ],
            'sequel_title': [
                '2 Fast 2 Grandma',
                'Oops, I Started Another Cult',
                'Return of the Awkward Silence',
                'The Revenge of Gary from HR',
            ],
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
            'Design the creature that lives in {weird_habitat} and survives by {survival_method}',
            'Create the monster that haunts people who {relatable_crime}',
            'Design a creature that is half {animal1}, half {unexpected_thing}',
        ],
        'variables': {
            'weird_habitat': [
                'the back of your refrigerator',
                'unread email inboxes',
                'that drawer everyone has with random stuff',
                'the space between couch cushions',
                'abandoned shopping carts',
            ],
            'survival_method': [
                'eating lost socks',
                'feeding on WiFi signals',
                'absorbing unfinished to-do lists',
                'digesting forgotten passwords',
            ],
            'relatable_crime': [
                'leave one bite of food in the container',
                'say "we should hang out" but never follow up',
                'reply-all accidentally',
                'microwave fish at work',
            ],
            'animal1': ['corgi', 'axolotl', 'capybara', 'red panda', 'blob fish'],
            'unexpected_thing': [
                'a cozy sweater',
                'a thunderstorm',
                "someone's student loans",
                'a discontinued snack from the 90s',
                'elevator music',
            ],
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
            'Design the album cover for "{title}" by {band_name}',
            'Create cover art for the {genre} one-hit wonder "{song_title}"',
            'Design the comeback album for {band_name}: "{comeback_title}"',
        ],
        'variables': {
            'genre': ['yacht rock', 'bedroom pop', 'sad boi hours', 'hyperpop', 'existential jazz', 'chaotic folk'],
            'title': [
                'Songs to Cry in Target To',
                'Anxiety: The Musical',
                'I Googled My Symptoms',
                'Texts I Should Not Have Sent',
                'Unread Voicemails From Mom',
            ],
            'band_name': [
                'The Emotional Support Plants',
                'Crippling Self-Awareness',
                'Four Therapists and a Drummer',
                'The Introverts (Solo Project)',
            ],
            'song_title': [
                'Why Did I Say That',
                'WiFi Connection Issues',
                'Ghosted by My Houseplant',
                'The Last Slice',
            ],
            'comeback_title': [
                "We're Not Dead, Just Tired",
                'Sorry About the Last Album',
                'Our Therapists Said This Was a Good Idea',
            ],
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
            'Design the city where {weird_law} is mandatory for all citizens',
            "Create the skyline of {city_name}, the world's first city built entirely for {purpose}",
            'Imagine a metropolis where {problem} has been solved by {absurd_solution}',
        ],
        'variables': {
            'weird_law': [
                'napping twice daily',
                'wearing capes on Wednesdays',
                'talking to plants',
                'mandatory karaoke breaks',
                'apologizing to robots',
            ],
            'city_name': [
                'New New York',
                'Old Future Tokyo',
                'Definitely Not a Cult Village',
                'Introvertopia',
                'WiFi City',
            ],
            'purpose': [
                'competitive napping',
                'housing emotional support animals',
                'people who talk to themselves',
                'avoiding small talk',
            ],
            'problem': ['traffic', 'Mondays', 'running out of snacks', 'awkward elevator rides'],
            'absurd_solution': [
                'teleporting cats',
                'buildings that move out of your way',
                'mandatory rollerblades',
                'emotional support drones',
            ],
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
            'Create the signature dish at {restaurant_name}, a restaurant where {gimmick}',
            'Design a {meal_type} that would make {person} weep with joy',
            'Photograph the winning entry in the {competition} championship',
        ],
        'variables': {
            'restaurant_name': [
                'Chaos Kitchen',
                'The Hangry Hipster',
                "Grandma's Revenge",
                'Suspiciously Good',
                'The Last Bite',
            ],
            'gimmick': [
                'everything is on fire',
                'all dishes are served in shoes',
                'the chef is definitely three raccoons',
                'they only use foods that start with the letter Q',
                'you eat in complete darkness',
            ],
            'meal_type': [
                'breakfast',
                'midnight snack',
                '3am regret meal',
                'fancy brunch',
                'sad desk lunch (but make it gourmet)',
            ],
            'person': [
                'Gordon Ramsay',
                'your disapproving grandmother',
                "a food critic who's never happy",
                'a toddler who only eats beige foods',
            ],
            'competition': [
                'international grilled cheese',
                "world's most chaotic taco",
                'extreme dessert engineering',
                'competitive soup slurping',
            ],
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
            'Create a portrait of a {pet} who is clearly {secret_life}',
            'Photograph a {pet} who just {caught_doing}',
            'Design the LinkedIn profile photo for a {pet} who works as a {job}',
        ],
        'variables': {
            'pet': [
                'golden retriever',
                'suspicious cat',
                'judgy parrot',
                'existential hamster',
                'over-it chihuahua',
                'chaos goblin ferret',
            ],
            'secret_life': [
                'plotting world domination',
                'running a secret business',
                'writing a memoir about their trauma',
                'training for the Olympics',
                'having a quarter-life crisis',
            ],
            'caught_doing': [
                "ate something they shouldn't have and regrets nothing",
                'knocked something off the counter on purpose',
                'learned to open the treat drawer',
                'saw their reflection and challenged it to a fight',
            ],
            'job': [
                'CEO of a Fortune 500 company',
                'life coach',
                'professional judger',
                'chaos coordinator',
                'senior nap consultant',
            ],
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
        'name': 'Impossible Objects',
        'description': "Create objects made from materials that shouldn't exist together.",
        'category_slug': 'images-video',
        'templates': [
            'Design a {everyday_object} made entirely of {weird_material}',
            "Create {object} that's somehow made of {impossible_material}",
            'Show what happens when {material1} and {material2} have a baby',
        ],
        'variables': {
            'everyday_object': [
                'office chair',
                'toaster',
                'bicycle',
                'lamp',
                'coffee mug',
                'sneakers',
            ],
            'weird_material': [
                'frozen music',
                'crystallized memories',
                'solidified laughter',
                'woven moonlight',
                'compressed anxiety',
            ],
            'object': ['a house', 'a car', 'a phone', 'a couch', 'a piano'],
            'impossible_material': [
                'clouds that forgot to float',
                "yesterday's regrets",
                'the smell of rain',
                'a really good nap',
            ],
            'material1': ['fire', 'cotton candy', 'diamonds', 'water'],
            'material2': ['shadow', 'bubblegum', 'thunder', 'silk'],
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
        'name': 'Time Traveler Selfies',
        'description': 'Create scenes of modern people hilariously out of place in history.',
        'category_slug': 'images-video',
        'templates': [
            'A time traveler accidentally brings {modern_thing} to {era}',
            'Show {historical_figure} reacting to {modern_invention}',
            'Design a {modern_store} if it existed in {era}',
        ],
        'variables': {
            'modern_thing': [
                'AirPods',
                'a Roomba',
                'avocado toast',
                'a yoga mat',
                'a fidget spinner',
                'an influencer ring light',
            ],
            'era': [
                'Ancient Rome',
                'the Wild West',
                'Medieval times',
                'the Victorian era',
                'the Renaissance',
                'Ancient Egypt',
            ],
            'historical_figure': [
                'Cleopatra',
                'a Viking warrior',
                'Marie Antoinette',
                'a samurai',
                'Leonardo da Vinci',
            ],
            'modern_invention': [
                'TikTok',
                'a self-checkout machine',
                'cryptocurrency',
                'meal prep containers',
                'a smart home speaker',
            ],
            'modern_store': ['Starbucks', 'IKEA', 'an Apple Store', 'a gym with spin classes', 'a co-working space'],
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
        'name': 'Caught in the Act',
        'description': 'Capture the exact moment something hilarious or dramatic happens.',
        'category_slug': 'images-video',
        'templates': [
            'Freeze the exact moment a {subject} realizes {realization}',
            'Capture the split second before {disaster}',
            'The moment when {character} accidentally {mishap}',
        ],
        'variables': {
            'subject': [
                'wedding guest',
                'office worker',
                'chef',
                'cat',
                'toddler',
                'superhero',
            ],
            'realization': [
                "they're at the wrong wedding",
                'the email went to all-staff',
                "that wasn't sugar",
                "Monday isn't a holiday after all",
                "they've been on mute the whole meeting",
            ],
            'disaster': [
                'the birthday cake hits the floor',
                'the best man drops the ring',
                'the pigeon attacks',
                'the chair breaks',
                'the sprinklers go off',
            ],
            'character': ['a ninja', 'a grandma', 'a fancy waiter', 'an astronaut', 'a mall Santa'],
            'mishap': [
                'photobombed the proposal',
                'walked into a glass door',
                'sat in wet paint',
                'high-fived someone going for a handshake',
            ],
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
        'key': 'dramatic_lighting',
        'name': 'Dramatic Lighting',
        'description': 'Create moody, cinematic scenes with creative lighting.',
        'category_slug': 'images-video',
        'templates': [
            'Create the scene where {character} is illuminated only by {weird_light_source}',
            'Design the {genre} movie poster scene lit entirely by {dramatic_lighting}',
            'Show {mundane_activity} but make it look like a {movie_style} film',
        ],
        'variables': {
            'character': [
                'a detective',
                'someone eating cereal',
                'a villain giving a monologue',
                'a cat plotting revenge',
                "a toddler who won't go to bed",
            ],
            'weird_light_source': [
                'an open refrigerator',
                'a phone screen at 3am',
                'birthday candles',
                'a lava lamp',
                'the glow of a vending machine',
            ],
            'dramatic_lighting': [
                'lightning strikes',
                'a single streetlamp',
                'car headlights',
                'a disco ball',
                'the glow of the microwave',
            ],
            'mundane_activity': [
                'doing laundry',
                'waiting in line at the DMV',
                'assembling IKEA furniture',
                'looking for matching socks',
                'deciding what to watch on Netflix',
            ],
            'movie_style': ['film noir', 'horror', 'action thriller', 'dramatic Oscar-bait', 'superhero origin story'],
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
        'name': 'Fashion Disaster (On Purpose)',
        'description': 'Create intentionally weird, bold, or hilarious fashion looks.',
        'category_slug': 'images-video',
        'templates': [
            'Design the outfit for someone whose entire personality is {personality}',
            'Create the look that says "I\'m going to {event} but I don\'t care"',
            'Style the person who {fashion_crime} and is proud of it',
        ],
        'variables': {
            'personality': [
                'wearing crocs unironically',
                'they peaked in high school',
                'just discovered thrift stores',
                'I read one article about fashion',
                'main character energy',
                'corporate but make it quirky',
            ],
            'event': [
                'a first date',
                'a job interview',
                "meet my partner's parents",
                'court',
                'brunch with my enemies',
            ],
            'fashion_crime': [
                'matches their outfit to their pet',
                'only wears clothes with their own face on them',
                'dresses exclusively in things found in lost-and-found bins',
                'takes fashion advice from their 5-year-old',
                'lets their horoscope choose their outfit',
            ],
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
            'Create the reaction image for when {situation}',
            'Design the meme that perfectly captures {relatable_moment}',
            'Make a meme about {subject} discovering {discovery}',
        ],
        'variables': {
            'situation': [
                'you hear your own voice in a recording',
                "you wave back at someone who wasn't waving at you",
                'you pull a door that says push',
                'autocorrect betrays you in front of your boss',
                "you forget someone's name 0.2 seconds after they tell you",
                'you accidentally like a photo from 3 years ago while stalking',
            ],
            'relatable_moment': [
                'sending "haha" when you\'re actually dead inside',
                "pretending to text so you don't have to make small talk",
                'opening the fridge hoping new food has spawned',
                'saying "let\'s do this" before doing absolutely nothing',
                'practicing arguments in the shower',
            ],
            'subject': [
                'an overly confident pigeon',
                'a cat with one brain cell',
                'a dog who has seen too much',
                "someone's inner child",
                'the last brain cell',
            ],
            'discovery': [
                'what they actually look like in photos vs the mirror',
                "that adults also don't know what they're doing",
                'their screen time report',
                'how expensive cheese is',
            ],
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
