"""Backfill user profile data from OAuth social accounts.

This command updates users who signed up with OAuth (Google, GitHub, LinkedIn)
but whose profile fields weren't properly populated.

Fields populated by provider:
- Google: first_name, last_name, avatar_url (from given_name, family_name, picture)
- GitHub: first_name, last_name, avatar_url, bio, location, github_url (from name, avatar_url, bio, location, html_url)
- LinkedIn: first_name, last_name, linkedin_url (from localizedFirstName, localizedLastName)

Usage:
    python manage.py backfill_oauth_profiles
    python manage.py backfill_oauth_profiles --dry-run
    python manage.py backfill_oauth_profiles --user=username
    python manage.py backfill_oauth_profiles --provider=github
"""

from allauth.socialaccount.models import SocialAccount
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Backfill user profile data from OAuth social accounts (Google, GitHub, LinkedIn)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--user',
            type=str,
            help='Only update a specific username',
        )
        parser.add_argument(
            '--provider',
            type=str,
            choices=['google', 'github', 'linkedin', 'linkedin_oauth2', 'openid_connect'],
            help='Only process a specific provider (openid_connect for LinkedIn OIDC)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        target_user = options.get('user')
        target_provider = options.get('provider')

        # Find social accounts
        # Note: LinkedIn can appear as 'linkedin', 'linkedin_oauth2' (legacy), or 'openid_connect' (OIDC)
        providers = ['google', 'github', 'linkedin', 'linkedin_oauth2', 'openid_connect']
        if target_provider:
            providers = [target_provider]

        queryset = SocialAccount.objects.filter(provider__in=providers).select_related('user')

        if target_user:
            queryset = queryset.filter(user__username=target_user)

        self.stdout.write(f'Found {queryset.count()} social accounts to process')

        updated_count = 0
        for social_account in queryset:
            user = social_account.user
            provider = social_account.provider
            extra_data = social_account.extra_data or {}
            fields_to_update = []

            self.stdout.write(f'\nProcessing user: {user.username} (id={user.id}) - {provider}')

            # Extract first_name based on provider
            first_name = (
                extra_data.get('given_name')  # Google
                or extra_data.get('localizedFirstName')  # LinkedIn
                or ''
            )
            last_name = (
                extra_data.get('family_name')  # Google
                or extra_data.get('localizedLastName')  # LinkedIn
                or ''
            )

            # Fallback: parse 'name' field (GitHub, GitLab)
            if not first_name and not last_name and extra_data.get('name'):
                name_parts = extra_data['name'].split()
                if name_parts:
                    first_name = name_parts[0]
                    if len(name_parts) > 1:
                        last_name = ' '.join(name_parts[1:])

            # Avatar: Google uses 'picture', GitHub uses 'avatar_url'
            avatar = extra_data.get('picture') or extra_data.get('avatar_url', '')

            # Check what needs updating
            if first_name and not user.first_name:
                self.stdout.write(f'  first_name: "" -> "{first_name}"')
                if not dry_run:
                    user.first_name = first_name
                fields_to_update.append('first_name')

            if last_name and not user.last_name:
                self.stdout.write(f'  last_name: "" -> "{last_name}"')
                if not dry_run:
                    user.last_name = last_name
                fields_to_update.append('last_name')

            if avatar and not user.avatar_url:
                self.stdout.write(f'  avatar_url: None -> "{avatar[:50]}..."')
                if not dry_run:
                    user.avatar_url = avatar
                fields_to_update.append('avatar_url')

            # GitHub-specific fields
            if provider == 'github':
                github_url = extra_data.get('html_url', '')
                bio = extra_data.get('bio', '')
                location = extra_data.get('location', '')

                if github_url and not user.github_url:
                    self.stdout.write(f'  github_url: None -> "{github_url}"')
                    if not dry_run:
                        user.github_url = github_url
                    fields_to_update.append('github_url')

                if bio and not user.bio:
                    self.stdout.write(f'  bio: "" -> "{bio[:50]}..."')
                    if not dry_run:
                        user.bio = bio
                    fields_to_update.append('bio')

                if location and not user.location:
                    self.stdout.write(f'  location: "" -> "{location}"')
                    if not dry_run:
                        user.location = location
                    fields_to_update.append('location')

            # LinkedIn-specific fields (includes OIDC provider)
            if provider in ('linkedin', 'linkedin_oauth2', 'openid_connect'):
                # LinkedIn doesn't provide profile URL in basic scope
                # but we can construct it if we have vanityName
                vanity_name = extra_data.get('vanityName', '')
                if vanity_name and not user.linkedin_url:
                    linkedin_url = f'https://www.linkedin.com/in/{vanity_name}'
                    self.stdout.write(f'  linkedin_url: None -> "{linkedin_url}"')
                    if not dry_run:
                        user.linkedin_url = linkedin_url
                    fields_to_update.append('linkedin_url')

            if fields_to_update:
                if not dry_run:
                    user.save(update_fields=fields_to_update)
                    self.stdout.write(self.style.SUCCESS(f'  Updated {len(fields_to_update)} field(s)'))
                else:
                    self.stdout.write(self.style.WARNING(f'  Would update {len(fields_to_update)} field(s) (dry-run)'))
                updated_count += 1
            else:
                self.stdout.write('  No updates needed (all fields already populated)')

        self.stdout.write('')
        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN: Would have updated {updated_count} user(s)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Updated {updated_count} user(s)'))
