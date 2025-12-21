"""
Management command to sync a user's projects from local to AWS production.

Two-step process because RDS is in a private VPC:
1. Export: Run locally to export user's projects to JSON and upload to S3
2. Import: Run on AWS ECS to import projects from S3

Usage:
    # Step 1: Export locally (from Docker) - dry run first
    make sync-user-projects USERNAME=midjourney-reddit-agent DRY_RUN=1

    # Step 1: Export locally (actual)
    make sync-user-projects USERNAME=midjourney-reddit-agent

    # Step 2: Import on AWS (via make aws-run-command)
    make aws-run-command CMD="sync_user_projects_to_prod --username midjourney-reddit-agent --import"

Requirements:
    - AWS credentials configured (for S3 access)
    - User must exist on both local and production with same username
"""

import json
import logging
from datetime import datetime

import boto3
from django.core.management.base import BaseCommand, CommandError

from core.projects.models import Project
from core.users.models import User

logger = logging.getLogger(__name__)

S3_BUCKET = 'allthrive-media-production-953072364000'
S3_PREFIX = 'sync-exports'


class Command(BaseCommand):
    help = "Sync a user's projects from local database to AWS production (add-only mode)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            required=True,
            help='Username to sync projects for',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be exported without uploading to S3',
        )
        parser.add_argument(
            '--import',
            dest='do_import',
            action='store_true',
            help='Import mode: download from S3 and import to local database (run on AWS)',
        )
        parser.add_argument(
            '--aws-region',
            type=str,
            default='us-east-1',
            help='AWS region (default: us-east-1)',
        )
        parser.add_argument(
            '--update-existing',
            action='store_true',
            help='Update existing projects (add missing RedditThread records)',
        )

    def get_s3_key(self, username):
        """Get S3 key for user's export file."""
        return f'{S3_PREFIX}/{username}/projects.json'

    def serialize_project(self, project):
        """Serialize a project to a dict for JSON export."""
        data = {
            'slug': project.slug,
            'title': project.title,
            'description': project.description or '',
            'type': project.type,
            'is_showcased': project.is_showcased,
            'is_highlighted': project.is_highlighted,
            'is_private': project.is_private,
            'is_archived': project.is_archived,
            'is_product': project.is_product,
            'is_promoted': project.is_promoted,
            'banner_url': project.banner_url or '',
            'featured_image_url': project.featured_image_url or '',
            'external_url': project.external_url or '',
            'tools_order': project.tools_order or [],
            'hide_categories': project.hide_categories,
            'topics': list(project.topics.values_list('name', flat=True)),
            'content': project.content or {},
            'tags_manually_edited': project.tags_manually_edited,
            'difficulty_level': project.difficulty_level or '',
            'engagement_velocity': project.engagement_velocity,
            'view_count': project.view_count,
            'published_date': project.published_date.isoformat() if project.published_date else None,
            # M2M relations - store slugs for matching on import
            'tool_slugs': [t.slug for t in project.tools.all()],
            'category_slugs': [c.slug for c in project.categories.all()],
        }

        # Include RedditThread data for reddit_thread projects
        if project.type == 'reddit_thread':
            try:
                rt = project.reddit_thread
                data['reddit_thread'] = {
                    'reddit_post_id': rt.reddit_post_id,
                    'subreddit': rt.subreddit,
                    'author': rt.author,
                    'permalink': rt.permalink,
                    'score': rt.score,
                    'num_comments': rt.num_comments,
                    'thumbnail_url': rt.thumbnail_url or '',
                    'created_utc': rt.created_utc.isoformat() if rt.created_utc else None,
                    'reddit_metadata': rt.reddit_metadata or {},
                    # Store agent username to look up on import
                    'agent_username': rt.agent.agent_user.username if rt.agent else None,
                }
            except Exception:
                data['reddit_thread'] = None

        return data

    def export_projects(self, username, dry_run, aws_region):
        """Export user's projects to S3."""
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('  Export User Projects to S3')
        self.stdout.write(f'  Username: {username}')
        self.stdout.write(f'  Mode: {"DRY RUN" if dry_run else "LIVE"}')
        self.stdout.write('=' * 60)
        self.stdout.write('')

        # Step 1: Get local user and projects
        self.stdout.write('1. Fetching local projects...')
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as err:
            raise CommandError(f'User "{username}" not found in local database') from err

        projects = Project.objects.filter(user=user).prefetch_related('tools', 'categories')
        project_list = list(projects)
        self.stdout.write(f'   Found {len(project_list)} local projects')

        if not project_list:
            self.stdout.write(self.style.WARNING('   No projects to export'))
            return

        # Step 2: Serialize projects
        self.stdout.write('')
        self.stdout.write('2. Serializing projects...')
        export_data = {
            'username': username,
            'exported_at': datetime.utcnow().isoformat(),
            'project_count': len(project_list),
            'projects': [self.serialize_project(p) for p in project_list],
        }

        self.stdout.write(f'   Serialized {len(project_list)} projects')
        self.stdout.write('')
        self.stdout.write('   Projects to export:')
        for p in project_list:
            tools_str = ', '.join(t.slug for t in p.tools.all()[:3])
            if p.tools.count() > 3:
                tools_str += '...'
            self.stdout.write(f'     + {p.slug} ({p.type}) [{tools_str}]')

        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('DRY RUN - No upload to S3'))
            self.stdout.write(f'Would upload to: s3://{S3_BUCKET}/{self.get_s3_key(username)}')
            return

        # Step 3: Upload to S3
        self.stdout.write('')
        self.stdout.write('3. Uploading to S3...')
        s3_key = self.get_s3_key(username)

        try:
            s3 = boto3.client('s3', region_name=aws_region)
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=s3_key,
                Body=json.dumps(export_data, indent=2, default=str),
                ContentType='application/json',
            )
            self.stdout.write(self.style.SUCCESS(f'   Uploaded to s3://{S3_BUCKET}/{s3_key}'))
        except Exception as e:
            raise CommandError(f'Failed to upload to S3: {e}') from e

        # Summary
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS(f'  Exported {len(project_list)} projects'))
        self.stdout.write('')
        self.stdout.write('  Next step: Run import on AWS:')
        self.stdout.write(f'  make aws-run-command CMD="sync_user_projects_to_prod --username {username} --import"')
        self.stdout.write('=' * 60)

    def import_projects(self, username, aws_region, update_existing=False):
        """Import user's projects from S3 (run on AWS)."""
        from core.taxonomy.models import Taxonomy
        from core.tools.models import Tool

        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write('  Import User Projects from S3')
        self.stdout.write(f'  Username: {username}')
        if update_existing:
            self.stdout.write('  Mode: UPDATE EXISTING (add missing RedditThread records)')
        self.stdout.write('=' * 60)
        self.stdout.write('')

        # Step 1: Get user
        self.stdout.write('1. Looking up user...')
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist as err:
            raise CommandError(f'User "{username}" not found in database') from err
        self.stdout.write(f'   Found user ID: {user.id}')

        # Step 2: Download from S3
        self.stdout.write('')
        self.stdout.write('2. Downloading from S3...')
        s3_key = self.get_s3_key(username)

        try:
            s3 = boto3.client('s3', region_name=aws_region)
            response = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
            export_data = json.loads(response['Body'].read().decode('utf-8'))
        except s3.exceptions.NoSuchKey as err:
            raise CommandError(f'No export found at s3://{S3_BUCKET}/{s3_key}. Run export first.') from err
        except Exception as e:
            raise CommandError(f'Failed to download from S3: {e}') from e

        self.stdout.write(f'   Downloaded {export_data["project_count"]} projects')
        self.stdout.write(f'   Exported at: {export_data["exported_at"]}')

        # Step 3: Get existing slugs
        self.stdout.write('')
        self.stdout.write('3. Checking existing projects...')
        existing_slugs = set(Project.objects.filter(user=user).values_list('slug', flat=True))
        self.stdout.write(f'   Found {len(existing_slugs)} existing projects')

        # Step 4: Filter to new projects only
        projects_to_import = [p for p in export_data['projects'] if p['slug'] not in existing_slugs]
        projects_skipped = [p for p in export_data['projects'] if p['slug'] in existing_slugs]

        self.stdout.write('')
        self.stdout.write('4. Import plan:')
        self.stdout.write(f'   Projects to ADD: {len(projects_to_import)}')
        self.stdout.write(f'   Projects to SKIP (already exist): {len(projects_skipped)}')

        if projects_skipped:
            self.stdout.write('')
            self.stdout.write('   Skipping (already exist):')
            for p in projects_skipped[:5]:
                self.stdout.write(f'     - {p["slug"]}')
            if len(projects_skipped) > 5:
                self.stdout.write(f'     ... and {len(projects_skipped) - 5} more')

        if not projects_to_import and not update_existing:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS('All projects already exist. Nothing to import.'))
            self.stdout.write(self.style.WARNING('Tip: Use --update-existing to add missing RedditThread records'))
            return

        # Step 5: Build tool and category mappings
        self.stdout.write('')
        self.stdout.write('5. Loading tool/category mappings...')
        tool_map = {t.slug: t for t in Tool.objects.all()}
        category_map = {c.slug: c for c in Taxonomy.objects.filter(taxonomy_type='category')}
        self.stdout.write(f'   Found {len(tool_map)} tools, {len(category_map)} categories')

        # Step 6: Import projects
        self.stdout.write('')
        self.stdout.write('6. Importing projects...')
        imported_count = 0
        for project_data in projects_to_import:
            try:
                # Parse published_date if present
                published_date = None
                if project_data.get('published_date'):
                    from django.utils.dateparse import parse_datetime

                    published_date = parse_datetime(project_data['published_date'])

                # Create project
                project = Project.objects.create(
                    user=user,
                    slug=project_data['slug'],
                    title=project_data['title'],
                    description=project_data['description'],
                    type=project_data['type'],
                    is_showcased=project_data['is_showcased'],
                    is_highlighted=False,  # Don't highlight on import
                    is_private=project_data['is_private'],
                    is_archived=project_data['is_archived'],
                    is_product=project_data['is_product'],
                    is_promoted=False,  # Don't promote on import
                    banner_url=project_data['banner_url'],
                    featured_image_url=project_data['featured_image_url'],
                    external_url=project_data['external_url'],
                    tools_order=project_data['tools_order'],
                    hide_categories=project_data['hide_categories'],
                    topics=project_data['topics'],
                    content=project_data['content'],
                    tags_manually_edited=project_data['tags_manually_edited'],
                    difficulty_level=project_data['difficulty_level'],
                    engagement_velocity=0,  # Reset engagement on import
                    view_count=0,  # Reset views on import
                    published_date=published_date,
                )

                # Add tools
                tools_to_add = [tool_map[slug] for slug in project_data.get('tool_slugs', []) if slug in tool_map]
                if tools_to_add:
                    project.tools.set(tools_to_add)

                # Add categories
                cats_to_add = [
                    category_map[slug] for slug in project_data.get('category_slugs', []) if slug in category_map
                ]
                if cats_to_add:
                    project.categories.set(cats_to_add)

                # Create RedditThread for reddit_thread projects
                if project_data['type'] == 'reddit_thread' and project_data.get('reddit_thread'):
                    from core.integrations.models import RedditCommunityAgent, RedditThread

                    rt_data = project_data['reddit_thread']
                    created_utc = None
                    if rt_data.get('created_utc'):
                        from django.utils.dateparse import parse_datetime

                        created_utc = parse_datetime(rt_data['created_utc'])

                    # Look up the agent by username
                    agent = None
                    agent_username = rt_data.get('agent_username')
                    if agent_username:
                        try:
                            agent_user = User.objects.get(username=agent_username)
                            agent = RedditCommunityAgent.objects.get(agent_user=agent_user)
                        except (User.DoesNotExist, RedditCommunityAgent.DoesNotExist):
                            self.stdout.write(
                                self.style.WARNING(f'     Agent {agent_username} not found, skipping RedditThread')
                            )

                    if agent:
                        RedditThread.objects.create(
                            project=project,
                            agent=agent,
                            reddit_post_id=rt_data['reddit_post_id'],
                            subreddit=rt_data['subreddit'],
                            author=rt_data['author'],
                            permalink=rt_data['permalink'],
                            score=rt_data.get('score', 0),
                            num_comments=rt_data.get('num_comments', 0),
                            thumbnail_url=rt_data.get('thumbnail_url', ''),
                            created_utc=created_utc,
                            reddit_metadata=rt_data.get('reddit_metadata', {}),
                        )

                imported_count += 1
                self.stdout.write(self.style.SUCCESS(f'   + {project.slug} (ID: {project.id})'))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'   x {project_data["slug"]} FAILED: {e}'))

        # Summary for new imports
        if projects_to_import:
            self.stdout.write('')
            self.stdout.write(self.style.SUCCESS(f'  Imported {imported_count}/{len(projects_to_import)} new projects'))

        # Step 7: Update existing projects (add missing RedditThread records)
        if update_existing and projects_skipped:
            from core.integrations.models import RedditCommunityAgent, RedditThread

            self.stdout.write('')
            self.stdout.write('7. Updating existing projects (adding missing RedditThread records)...')

            updated_count = 0
            for project_data in projects_skipped:
                if project_data['type'] != 'reddit_thread' or not project_data.get('reddit_thread'):
                    continue

                try:
                    # Find the existing project
                    project = Project.objects.get(user=user, slug=project_data['slug'])

                    # Check if RedditThread already exists
                    try:
                        _ = project.reddit_thread  # noqa: F841
                        # Already has RedditThread, skip
                        continue
                    except RedditThread.DoesNotExist:
                        pass

                    rt_data = project_data['reddit_thread']
                    created_utc = None
                    if rt_data.get('created_utc'):
                        from django.utils.dateparse import parse_datetime

                        created_utc = parse_datetime(rt_data['created_utc'])

                    # Look up the agent by username
                    agent = None
                    agent_username = rt_data.get('agent_username')
                    if agent_username:
                        try:
                            agent_user = User.objects.get(username=agent_username)
                            agent = RedditCommunityAgent.objects.get(agent_user=agent_user)
                        except (User.DoesNotExist, RedditCommunityAgent.DoesNotExist):
                            self.stdout.write(
                                self.style.WARNING(f'     Agent {agent_username} not found for {project.slug}')
                            )
                            continue

                    if agent:
                        RedditThread.objects.create(
                            project=project,
                            agent=agent,
                            reddit_post_id=rt_data['reddit_post_id'],
                            subreddit=rt_data['subreddit'],
                            author=rt_data['author'],
                            permalink=rt_data['permalink'],
                            score=rt_data.get('score', 0),
                            num_comments=rt_data.get('num_comments', 0),
                            thumbnail_url=rt_data.get('thumbnail_url', ''),
                            created_utc=created_utc,
                            reddit_metadata=rt_data.get('reddit_metadata', {}),
                        )
                        updated_count += 1
                        self.stdout.write(self.style.SUCCESS(f'   ~ {project.slug} (added RedditThread)'))

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'   x {project_data["slug"]} FAILED: {e}'))

            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS(f'  Updated {updated_count} existing projects with RedditThread records')
            )

        # Final summary
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS('  Sync complete!'))
        self.stdout.write('=' * 60)

    def handle(self, *args, **options):
        username = options['username']
        dry_run = options['dry_run']
        do_import = options['do_import']
        aws_region = options['aws_region']
        update_existing = options['update_existing']

        if do_import:
            self.import_projects(username, aws_region, update_existing)
        else:
            self.export_projects(username, dry_run, aws_region)
