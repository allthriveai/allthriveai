"""
Management command to test embedding service configuration.

Usage:
    python manage.py test_embeddings                    # Test with default provider
    python manage.py test_embeddings --provider azure   # Test Azure specifically
    python manage.py test_embeddings --provider openai  # Test direct OpenAI
    python manage.py test_embeddings --list-deployments # List Azure deployments (if possible)
"""

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Test embedding service configuration and connectivity'

    def add_arguments(self, parser):
        parser.add_argument(
            '--provider',
            type=str,
            choices=['azure', 'openai', 'auto'],
            default='auto',
            help='AI provider to test (default: auto uses DEFAULT_AI_PROVIDER setting)',
        )
        parser.add_argument(
            '--deployment',
            type=str,
            help='Azure deployment name to test (overrides AZURE_OPENAI_EMBEDDING_DEPLOYMENT)',
        )
        parser.add_argument(
            '--list-deployments',
            action='store_true',
            help='Attempt to list available Azure OpenAI deployments',
        )

    def handle(self, *args, **options):
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('EMBEDDING SERVICE CONFIGURATION TEST')
        self.stdout.write('=' * 60 + '\n')

        # Show current configuration
        self._show_configuration(options)

        if options['list_deployments']:
            self._list_azure_deployments()
            return

        # Run the test
        self._test_embedding_generation(options)

    def _show_configuration(self, options):
        """Display current embedding configuration."""
        self.stdout.write(self.style.HTTP_INFO('Current Configuration:'))

        provider = options['provider']
        if provider == 'auto':
            provider = getattr(settings, 'DEFAULT_AI_PROVIDER', 'azure')
            self.stdout.write(f'  DEFAULT_AI_PROVIDER: {provider}')
        else:
            self.stdout.write(f'  Testing provider: {provider} (override)')

        if provider == 'azure':
            endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', '')
            api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', '')
            deployment = options.get('deployment') or getattr(
                settings, 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-small'
            )
            api_version = getattr(settings, 'AZURE_OPENAI_API_VERSION', '2024-02-15-preview')

            self.stdout.write(f'  AZURE_OPENAI_ENDPOINT: {endpoint or "(not set)"}')
            self.stdout.write(f'  AZURE_OPENAI_API_KEY: {"*" * 10 if api_key else "(not set)"}')
            self.stdout.write(f'  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: {deployment}')
            self.stdout.write(f'  AZURE_OPENAI_API_VERSION: {api_version}')

            if not endpoint or not api_key:
                self.stdout.write(self.style.ERROR('\n  ⚠️  Azure OpenAI credentials not fully configured!'))
                self.stdout.write('  Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY\n')

        else:
            api_key = getattr(settings, 'OPENAI_API_KEY', '')
            model = getattr(settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small')

            self.stdout.write(f'  OPENAI_API_KEY: {"*" * 10 if api_key else "(not set)"}')
            self.stdout.write(f'  WEAVIATE_EMBEDDING_MODEL: {model}')

            if not api_key:
                self.stdout.write(self.style.ERROR('\n  ⚠️  OpenAI API key not configured!'))
                self.stdout.write('  Please set OPENAI_API_KEY\n')

        self.stdout.write('')

    def _test_embedding_generation(self, options):
        """Test generating an embedding."""
        self.stdout.write(self.style.HTTP_INFO('Testing Embedding Generation:'))

        test_text = (
            'AI-powered project showcase for creative developers building with machine learning and automation tools.'
        )

        self.stdout.write(f'  Test text: "{test_text[:50]}..."')
        self.stdout.write('  Generating embedding...')

        provider = options['provider']
        if provider == 'auto':
            provider = getattr(settings, 'DEFAULT_AI_PROVIDER', 'azure')

        try:
            if provider == 'azure':
                embedding = self._test_azure_embedding(test_text, options.get('deployment'))
            else:
                embedding = self._test_openai_embedding(test_text)

            self.stdout.write(self.style.SUCCESS('\n  ✅ Embedding generated successfully!'))
            self.stdout.write(f'  Vector dimensions: {len(embedding)}')
            self.stdout.write(f'  First 5 values: {embedding[:5]}')
            self.stdout.write(f'  Last 5 values: {embedding[-5:]}')

            # Verify it's a valid embedding
            if len(embedding) < 100:
                self.stdout.write(
                    self.style.WARNING(
                        '\n  ⚠️  Embedding seems short - expected 1536+ dimensions for text-embedding-3-small'
                    )
                )
            else:
                self.stdout.write(self.style.SUCCESS('\n  ✅ Embedding service is working correctly!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n  ❌ Failed to generate embedding: {e}'))
            self._provide_troubleshooting_tips(provider, str(e))

    def _test_azure_embedding(self, text: str, deployment_override: str = None) -> list[float]:
        """Test embedding with Azure OpenAI."""
        from openai import AzureOpenAI

        endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', '')
        api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', '')
        api_version = getattr(settings, 'AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
        deployment = deployment_override or getattr(
            settings, 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-small'
        )

        client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version,
        )

        self.stdout.write(f'  Using Azure deployment: {deployment}')

        response = client.embeddings.create(
            model=deployment,
            input=text,
        )

        return response.data[0].embedding

    def _test_openai_embedding(self, text: str) -> list[float]:
        """Test embedding with direct OpenAI."""
        from openai import OpenAI

        api_key = getattr(settings, 'OPENAI_API_KEY', '')
        model = getattr(settings, 'WEAVIATE_EMBEDDING_MODEL', 'text-embedding-3-small')

        client = OpenAI(api_key=api_key)

        self.stdout.write(f'  Using OpenAI model: {model}')

        response = client.embeddings.create(
            model=model,
            input=text,
        )

        return response.data[0].embedding

    def _list_azure_deployments(self):
        """Attempt to list Azure OpenAI deployments."""
        self.stdout.write(self.style.HTTP_INFO('Attempting to list Azure OpenAI deployments:'))
        self.stdout.write('  Note: This requires Azure Management API access, which may not be available.\n')

        endpoint = getattr(settings, 'AZURE_OPENAI_ENDPOINT', '')
        api_key = getattr(settings, 'AZURE_OPENAI_API_KEY', '')

        if not endpoint or not api_key:
            self.stdout.write(self.style.ERROR('  Azure credentials not configured'))
            return

        # Extract resource name from endpoint
        import re

        match = re.search(r'https://([^.]+)\.openai\.azure\.com', endpoint)
        if match:
            resource_name = match.group(1)
            self.stdout.write(f'  Azure OpenAI Resource: {resource_name}')

        self.stdout.write('\n  To list your Azure OpenAI deployments:')
        self.stdout.write('  1. Go to Azure Portal > Azure OpenAI > Your Resource')
        self.stdout.write('  2. Click "Model deployments" in the left menu')
        self.stdout.write('  3. Note the deployment name for your embedding model')
        self.stdout.write('  4. Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT to that name\n')

        self.stdout.write('  Common embedding deployment names:')
        self.stdout.write('    - text-embedding-ada-002')
        self.stdout.write('    - text-embedding-3-small')
        self.stdout.write('    - text-embedding-3-large')
        self.stdout.write('    - embedding (custom name)')
        self.stdout.write('    - embeddings (custom name)\n')

        # Try common deployment names
        self.stdout.write('  Testing common deployment names...\n')
        common_names = [
            'text-embedding-3-small',
            'text-embedding-ada-002',
            'embedding',
            'embeddings',
            'text-embedding-3-large',
        ]

        for name in common_names:
            try:
                self._test_azure_embedding('test', name)
                self.stdout.write(self.style.SUCCESS(f'    ✅ {name} - AVAILABLE'))
            except Exception as e:
                error_msg = str(e)
                if '404' in error_msg or 'DeploymentNotFound' in error_msg:
                    self.stdout.write(f'    ❌ {name} - Not found')
                elif '401' in error_msg or 'Unauthorized' in error_msg:
                    self.stdout.write(self.style.ERROR(f'    ⚠️  {name} - Auth error'))
                    break  # Auth error means creds are wrong, no point testing others
                else:
                    self.stdout.write(f'    ❓ {name} - Error: {error_msg[:50]}')

    def _provide_troubleshooting_tips(self, provider: str, error: str):
        """Provide context-specific troubleshooting tips."""
        self.stdout.write('\nTroubleshooting Tips:')

        if '404' in error or 'DeploymentNotFound' in error:
            self.stdout.write(self.style.WARNING('  The specified deployment was not found.'))
            self.stdout.write('\n  To fix this:')
            self.stdout.write('  1. Go to Azure Portal > Azure OpenAI > Your Resource')
            self.stdout.write('  2. Go to "Model deployments"')
            self.stdout.write('  3. Create a new deployment with an embedding model')
            self.stdout.write('     (e.g., text-embedding-ada-002 or text-embedding-3-small)')
            self.stdout.write('  4. Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT to the deployment name')
            self.stdout.write('\n  Or run: python manage.py test_embeddings --list-deployments')

        elif '401' in error or 'Unauthorized' in error:
            self.stdout.write(self.style.WARNING('  Authentication failed.'))
            self.stdout.write('\n  To fix this:')
            self.stdout.write('  1. Verify AZURE_OPENAI_API_KEY is correct')
            self.stdout.write('  2. Check the key is for the correct Azure resource')
            self.stdout.write('  3. Ensure the key has not expired')

        elif 'rate' in error.lower() or '429' in error:
            self.stdout.write(self.style.WARNING('  Rate limit exceeded.'))
            self.stdout.write('  Wait a moment and try again, or check your quota.')

        elif provider == 'azure':
            self.stdout.write('  General Azure OpenAI troubleshooting:')
            self.stdout.write('  1. Verify AZURE_OPENAI_ENDPOINT format:')
            self.stdout.write('     https://YOUR-RESOURCE.openai.azure.com/')
            self.stdout.write('  2. Check AZURE_OPENAI_API_VERSION is supported')
            self.stdout.write('  3. Ensure your Azure subscription has OpenAI access')

        else:
            self.stdout.write('  General OpenAI troubleshooting:')
            self.stdout.write('  1. Verify OPENAI_API_KEY is valid')
            self.stdout.write('  2. Check your OpenAI account has credits')
            self.stdout.write('  3. Ensure the model name is correct')
