"""Management command to delete all battles and related data."""

from django.core.management.base import BaseCommand

from core.battles.models import (
    BattleInvitation,
    BattleMatchmakingQueue,
    BattleSubmission,
    BattleVote,
    PromptBattle,
)


class Command(BaseCommand):
    help = 'Delete all battles and related data (submissions, votes, invitations)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm deletion without prompting',
        )

    def handle(self, *args, **options):
        # Count before deletion
        battles_count = PromptBattle.objects.count()
        submissions_count = BattleSubmission.objects.count()
        votes_count = BattleVote.objects.count()
        invitations_count = BattleInvitation.objects.count()
        queue_count = BattleMatchmakingQueue.objects.count()

        self.stdout.write('Found:')
        self.stdout.write(f'  - {battles_count} battles')
        self.stdout.write(f'  - {submissions_count} submissions')
        self.stdout.write(f'  - {votes_count} votes')
        self.stdout.write(f'  - {invitations_count} invitations')
        self.stdout.write(f'  - {queue_count} queue entries')

        if not options['confirm']:
            confirm = input('\nAre you sure you want to delete all battles? (yes/no): ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.WARNING('Aborted.'))
                return

        # Delete in order (respecting foreign keys)
        self.stdout.write('Deleting...')

        votes_deleted, _ = BattleVote.objects.all().delete()
        self.stdout.write(f'  Deleted {votes_deleted} votes')

        submissions_deleted, _ = BattleSubmission.objects.all().delete()
        self.stdout.write(f'  Deleted {submissions_deleted} submissions')

        invitations_deleted, _ = BattleInvitation.objects.all().delete()
        self.stdout.write(f'  Deleted {invitations_deleted} invitations')

        queue_deleted, _ = BattleMatchmakingQueue.objects.all().delete()
        self.stdout.write(f'  Deleted {queue_deleted} queue entries')

        battles_deleted, _ = PromptBattle.objects.all().delete()
        self.stdout.write(f'  Deleted {battles_deleted} battles')

        self.stdout.write(self.style.SUCCESS('\nAll battles deleted successfully!'))
