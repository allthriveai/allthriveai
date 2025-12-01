from django.core.management.base import BaseCommand

from core.tools.models import Company, Tool


class Command(BaseCommand):
    help = 'Seed companies and link them to existing tools'

    def handle(self, *args, **options):
        companies_data = [
            # AI Companies
            {
                'name': 'Anthropic',
                'tagline': 'AI safety company building reliable AI systems',
                'description': (
                    'Anthropic is an AI safety company working to build reliable, interpretable, '
                    'and steerable AI systems. Founded by former OpenAI researchers.'
                ),
                'website_url': 'https://anthropic.com',
                'logo_url': 'https://mintlify.s3-us-west-1.amazonaws.com/anthropic/logo/light.svg',
                'founded_year': 2021,
                'headquarters': 'San Francisco, CA',
                'twitter_handle': 'AnthropicAI',
                'tools': ['Claude'],  # Tool names to link
            },
            {
                'name': 'OpenAI',
                'tagline': 'Creating safe AGI that benefits all of humanity',
                'description': (
                    'OpenAI is an AI research and deployment company. '
                    'Known for GPT models, ChatGPT, DALL-E, and the OpenAI API.'
                ),
                'website_url': 'https://openai.com',
                'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
                'founded_year': 2015,
                'headquarters': 'San Francisco, CA',
                'twitter_handle': 'OpenAI',
                'tools': ['ChatGPT'],
            },
            {
                'name': 'Google',
                'tagline': "Organizing the world's information",
                'description': (
                    'Google is a multinational technology company specializing in Internet-related '
                    'services including search, cloud computing, AI, and software.'
                ),
                'website_url': 'https://google.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg',
                'founded_year': 1998,
                'headquarters': 'Mountain View, CA',
                'twitter_handle': 'Google',
                'tools': ['Google Cloud'],
            },
            {
                'name': 'Meta',
                'tagline': 'Building technology that helps people connect',
                'description': (
                    'Meta Platforms (formerly Facebook) develops technologies for social connection, '
                    'VR/AR, and open-source AI research including PyTorch and Llama.'
                ),
                'website_url': 'https://meta.com',
                'logo_url': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg',
                'founded_year': 2004,
                'headquarters': 'Menlo Park, CA',
                'twitter_handle': 'Meta',
                'github_url': 'https://github.com/facebook',
                'tools': ['React'],
            },
            {
                'name': 'Microsoft',
                'tagline': 'Empowering every person and organization on the planet',
                'description': (
                    'Microsoft develops software, cloud services, and AI tools. '
                    'Known for Windows, Azure, GitHub, and TypeScript.'
                ),
                'website_url': 'https://microsoft.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/azure/azure-original.svg',
                'founded_year': 1975,
                'headquarters': 'Redmond, WA',
                'twitter_handle': 'Microsoft',
                'github_url': 'https://github.com/microsoft',
                'tools': ['TypeScript', 'GitHub Copilot'],
            },
            {
                'name': 'Vercel',
                'tagline': 'Develop. Preview. Ship.',
                'description': (
                    'Vercel is the platform for frontend developers, providing the speed and reliability '
                    'innovators need to create at the moment of inspiration.'
                ),
                'website_url': 'https://vercel.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg',
                'founded_year': 2015,
                'headquarters': 'San Francisco, CA',
                'twitter_handle': 'vercel',
                'github_url': 'https://github.com/vercel',
                'tools': ['Vercel', 'Next.js'],
            },
            {
                'name': 'Redis',
                'tagline': 'The real-time data platform',
                'description': (
                    'Redis Ltd. develops the Redis in-memory data store. '
                    'Provides caching, messaging, and real-time data solutions.'
                ),
                'website_url': 'https://redis.io',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg',
                'founded_year': 2011,
                'headquarters': 'Mountain View, CA',
                'twitter_handle': 'Redisinc',
                'github_url': 'https://github.com/redis',
                'tools': ['Redis'],
            },
            {
                'name': 'MongoDB',
                'tagline': 'Build faster. Build smarter.',
                'description': (
                    'MongoDB, Inc. develops the MongoDB document database and Atlas cloud platform. '
                    'Known for flexible schemas and developer productivity.'
                ),
                'website_url': 'https://mongodb.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg',
                'founded_year': 2007,
                'headquarters': 'New York, NY',
                'twitter_handle': 'MongoDB',
                'github_url': 'https://github.com/mongodb',
                'tools': ['MongoDB'],
            },
            {
                'name': 'Docker',
                'tagline': 'Accelerate how you build, share, and run applications',
                'description': (
                    'Docker, Inc. develops container technology that enables developers to package '
                    'and deploy applications consistently across any environment.'
                ),
                'website_url': 'https://docker.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',
                'founded_year': 2013,
                'headquarters': 'Palo Alto, CA',
                'twitter_handle': 'Docker',
                'github_url': 'https://github.com/docker',
                'tools': ['Docker'],
            },
            {
                'name': 'HashiCorp',
                'tagline': 'Consistent workflows to provision, secure, connect, and run any infrastructure',
                'description': (
                    'HashiCorp provides infrastructure automation software including Terraform, '
                    'Vault, Consul, and Nomad for cloud infrastructure management.'
                ),
                'website_url': 'https://hashicorp.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg',
                'founded_year': 2012,
                'headquarters': 'San Francisco, CA',
                'twitter_handle': 'HashiCorp',
                'github_url': 'https://github.com/hashicorp',
                'tools': ['Terraform'],
            },
            {
                'name': 'Amazon',
                'tagline': 'Work hard. Have fun. Make history.',
                'description': (
                    'Amazon Web Services (AWS) provides on-demand cloud computing platforms '
                    "and APIs. The world's largest cloud provider."
                ),
                'website_url': 'https://aws.amazon.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original-wordmark.svg',
                'founded_year': 2006,
                'headquarters': 'Seattle, WA',
                'twitter_handle': 'awscloud',
                'github_url': 'https://github.com/aws',
                'tools': ['AWS'],
            },
            {
                'name': 'Evan You',
                'tagline': 'Independent open source developer',
                'description': (
                    'Evan You is the creator of Vue.js and Vite. ' 'An independent developer building frontend tooling.'
                ),
                'website_url': 'https://evanyou.me',
                'founded_year': 2014,
                'headquarters': 'Global',
                'twitter_handle': 'youyuxi',
                'github_url': 'https://github.com/yyx990803',
                'tools': ['Vue.js', 'Vite'],
            },
        ]

        created_count = 0
        linked_count = 0

        for data in companies_data:
            tool_names = data.pop('tools', [])

            company, created = Company.objects.get_or_create(
                name=data['name'],
                defaults={
                    'tagline': data.get('tagline', ''),
                    'description': data.get('description', ''),
                    'website_url': data.get('website_url', ''),
                    'logo_url': data.get('logo_url', ''),
                    'founded_year': data.get('founded_year'),
                    'headquarters': data.get('headquarters', ''),
                    'twitter_handle': data.get('twitter_handle', ''),
                    'github_url': data.get('github_url', ''),
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created company: {company.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Company exists: {company.name}'))

            # Link tools to company
            for tool_name in tool_names:
                tool = Tool.objects.filter(name__iexact=tool_name).first()
                if tool:
                    if tool.company != company:
                        tool.company = company
                        tool.save(update_fields=['company'])
                        linked_count += 1
                        self.stdout.write(f'  Linked {tool.name} to {company.name}')
                else:
                    self.stdout.write(self.style.NOTICE(f'  Tool not found: {tool_name}'))

        self.stdout.write(
            self.style.SUCCESS(f'\nCompanies seeded! Created: {created_count}, Tools linked: {linked_count}')
        )
