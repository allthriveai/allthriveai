"""
Management command to setup GitHub OAuth social application.
Run with: python manage.py setup_github_oauth
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp


class Command(BaseCommand):
    help = 'Setup GitHub OAuth social application'

    def handle(self, *args, **options):
        # Get the current site
        site = Site.objects.get(id=1)
        self.stdout.write(f'Using site: {site.domain}')

        # Get credentials from environment
        github_client_id = os.environ.get('GITHUB_CLIENT_ID')
        github_client_secret = os.environ.get('GITHUB_CLIENT_SECRET')

        if not github_client_id or not github_client_secret:
            self.stdout.write(
                self.style.ERROR(
                    'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set in environment'
                )
            )
            return

        # Create or update GitHub social app
        github_app, created = SocialApp.objects.get_or_create(
            provider='github',
            defaults={
                'name': 'GitHub OAuth',
                'client_id': github_client_id,
                'secret': github_client_secret,
            }
        )

        if not created:
            # Update existing app
            github_app.client_id = github_client_id
            github_app.secret = github_client_secret
            github_app.save()
            self.stdout.write(self.style.SUCCESS('✅ Updated existing GitHub OAuth app'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ Created new GitHub OAuth app'))

        # Add site to the social app if not already added
        if site not in github_app.sites.all():
            github_app.sites.add(site)
            self.stdout.write(self.style.SUCCESS(f'✅ Added site {site.domain} to GitHub OAuth app'))
        else:
            self.stdout.write(f'✅ Site {site.domain} already linked to GitHub OAuth app')

        self.stdout.write(self.style.SUCCESS('\n🎉 GitHub OAuth setup complete!'))
        self.stdout.write(f'\nCallback URL: http://{site.domain}/accounts/github/login/callback/')
        self.stdout.write('\nMake sure this URL is added in your GitHub OAuth App settings:')
        self.stdout.write('https://github.com/settings/developers\n')
