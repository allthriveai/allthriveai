"""Management command to resend approval emails to approved invitation requests."""

from django.core.management.base import BaseCommand

from core.users.invitation_models import InvitationRequest
from core.users.invitation_views import send_approval_email


class Command(BaseCommand):
    help = 'Resend approval emails to approved invitation requests that may not have received them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Resend to a specific email address',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Resend to ALL approved requests (use with caution)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be sent without actually sending',
        )

    def handle(self, *args, **options):
        email = options.get('email')
        send_all = options.get('all')
        dry_run = options.get('dry_run')

        if not email and not send_all:
            self.stdout.write(self.style.ERROR('Please specify --email <address> or --all to resend approval emails'))
            self.stdout.write('\nApproved requests that can be resent:')
            approved = InvitationRequest.objects.filter(status=InvitationRequest.Status.APPROVED)
            for inv in approved:
                self.stdout.write(f'  - {inv.email} (approved {inv.reviewed_at})')
            return

        # Build queryset
        queryset = InvitationRequest.objects.filter(status=InvitationRequest.Status.APPROVED)

        if email:
            queryset = queryset.filter(email__iexact=email)
            if not queryset.exists():
                self.stdout.write(self.style.ERROR(f'No approved invitation found for: {email}'))
                return

        count = queryset.count()
        if count == 0:
            self.stdout.write(self.style.WARNING('No approved invitations found'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN - Would send {count} email(s):'))
            for inv in queryset:
                self.stdout.write(f'  - {inv.name} <{inv.email}>')
            return

        # Confirm if sending to all
        if send_all and count > 1:
            self.stdout.write(self.style.WARNING(f'About to send {count} approval emails.'))
            confirm = input('Type "yes" to confirm: ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.ERROR('Cancelled'))
                return

        # Send emails
        success_count = 0
        fail_count = 0

        for invitation in queryset:
            try:
                send_approval_email(invitation)
                self.stdout.write(self.style.SUCCESS(f'✓ Sent to {invitation.email}'))
                success_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'✗ Failed for {invitation.email}: {e}'))
                fail_count += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Successfully sent: {success_count}'))
        if fail_count:
            self.stdout.write(self.style.ERROR(f'Failed: {fail_count}'))
