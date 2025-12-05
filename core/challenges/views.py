"""API Views for Weekly Challenges."""

import logging

from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.challenges.leaderboard import ChallengeLeaderboardService
from core.challenges.models import (
    ChallengeStatus,
    ChallengeSubmission,
    ChallengeVote,
    WeeklyChallenge,
)
from core.challenges.serializers import (
    ChallengeSubmissionCreateSerializer,
    ChallengeSubmissionDetailSerializer,
    ChallengeSubmissionSerializer,
    ChallengeVoteSerializer,
    WeeklyChallengeDetailSerializer,
    WeeklyChallengeListSerializer,
)
from core.logging_utils import StructuredLogger
from core.users.models import User

logger = logging.getLogger(__name__)


class WeeklyChallengeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Weekly Challenges.

    Endpoints:
    - GET /api/challenges/ - List all challenges
    - GET /api/challenges/current/ - Get current active challenge
    - GET /api/challenges/{slug}/ - Get challenge details
    - GET /api/challenges/{slug}/submissions/ - List submissions
    - GET /api/challenges/{slug}/leaderboard/ - Get leaderboard
    - POST /api/challenges/{slug}/submit/ - Submit entry (authenticated)
    - POST /api/challenges/{slug}/vote/{submission_id}/ - Vote (authenticated)
    - GET /api/challenges/{slug}/my-submissions/ - User's submissions (authenticated)
    """

    permission_classes = [permissions.AllowAny]
    queryset = WeeklyChallenge.objects.filter(
        status__in=[
            ChallengeStatus.ACTIVE,
            ChallengeStatus.VOTING,
            ChallengeStatus.COMPLETED,
            ChallengeStatus.UPCOMING,
        ]
    ).select_related('sponsor')
    lookup_field = 'slug'

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WeeklyChallengeDetailSerializer
        return WeeklyChallengeListSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by featured
        featured = self.request.query_params.get('featured')
        if featured == 'true':
            queryset = queryset.filter(is_featured=True)

        return queryset

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get the current active challenge."""
        now = timezone.now()
        challenge = (
            WeeklyChallenge.objects.filter(
                status__in=[ChallengeStatus.ACTIVE, ChallengeStatus.VOTING],
                starts_at__lte=now,
                ends_at__gte=now,
            )
            .select_related('sponsor')
            .first()
        )

        if not challenge:
            # Try to get next upcoming
            challenge = (
                WeeklyChallenge.objects.filter(
                    status=ChallengeStatus.UPCOMING,
                    starts_at__gt=now,
                )
                .select_related('sponsor')
                .order_by('starts_at')
                .first()
            )

        if not challenge:
            return Response({'detail': 'No active challenge found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = WeeklyChallengeDetailSerializer(challenge, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def submissions(self, request, slug=None):
        """List submissions for a challenge."""
        challenge = self.get_object()
        submissions = (
            ChallengeSubmission.objects.filter(
                challenge=challenge,
                is_disqualified=False,
            )
            .select_related('user')
            .prefetch_related('votes')
        )

        # Sorting
        sort = request.query_params.get('sort', 'votes')
        if sort == 'votes':
            submissions = submissions.order_by('-vote_count', '-submitted_at')
        elif sort == 'recent':
            submissions = submissions.order_by('-submitted_at')
        elif sort == 'featured':
            submissions = submissions.order_by('-is_featured', '-vote_count')

        # Pagination
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size

        total = submissions.count()
        submissions = submissions[start:end]

        serializer = ChallengeSubmissionSerializer(submissions, many=True, context={'request': request})

        return Response(
            {
                'results': serializer.data,
                'count': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size,
            }
        )

    @action(detail=True, methods=['get'])
    def leaderboard(self, request, slug=None):
        """Get real-time leaderboard for a challenge."""
        challenge = self.get_object()

        # Get leaderboard from Redis
        limit = int(request.query_params.get('limit', 100))
        entries = ChallengeLeaderboardService.get_leaderboard(str(challenge.id), 0, limit - 1)

        # Get user details for each entry
        user_ids = [uid for uid, _ in entries]
        users = {u.id: u for u in User.objects.filter(id__in=user_ids)}

        leaderboard_entries = []
        for rank, (user_id, score) in enumerate(entries, 1):
            user = users.get(user_id)
            if user:
                leaderboard_entries.append(
                    {
                        'rank': rank,
                        'user_id': user_id,
                        'username': user.username,
                        'avatar_url': user.avatar_url if hasattr(user, 'avatar_url') else None,
                        'vote_count': int(score),
                        'is_current_user': request.user.is_authenticated and user_id == request.user.id,
                    }
                )

        # Get current user's entry if authenticated and not in top N
        user_entry = None
        if request.user.is_authenticated:
            user_rank = ChallengeLeaderboardService.get_user_rank(str(challenge.id), request.user.id)
            if user_rank and user_rank > limit:
                user_score = ChallengeLeaderboardService.get_user_score(str(challenge.id), request.user.id)
                user_entry = {
                    'rank': user_rank,
                    'user_id': request.user.id,
                    'username': request.user.username,
                    'avatar_url': getattr(request.user, 'avatar_url', None),
                    'vote_count': int(user_score),
                    'is_current_user': True,
                }

        return Response(
            {
                'entries': leaderboard_entries,
                'total_participants': ChallengeLeaderboardService.get_total_participants(str(challenge.id)),
                'user_entry': user_entry,
            }
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def submit(self, request, slug=None):
        """Submit an entry to the challenge."""
        try:
            challenge = self.get_object()

            serializer = ChallengeSubmissionCreateSerializer(
                data=request.data, context={'request': request, 'challenge': challenge}
            )
            serializer.is_valid(raise_exception=True)
            submission = serializer.save()

            StructuredLogger.log_service_operation(
                service_name='ChallengeService',
                operation='submit_entry',
                user=request.user,
                success=True,
                metadata={'challenge_slug': challenge.slug, 'submission_id': submission.id},
            )

            return Response(
                ChallengeSubmissionDetailSerializer(submission, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            StructuredLogger.log_error(
                message='Failed to submit challenge entry',
                error=e,
                user=request.user,
                extra={'challenge_slug': slug, 'endpoint': '/challenges/submit/'},
            )
            raise

    @action(
        detail=True,
        methods=['post'],
        url_path='vote/(?P<submission_id>[^/.]+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def vote(self, request, slug=None, submission_id=None):
        """Vote for a submission."""
        challenge = self.get_object()
        submission = get_object_or_404(
            ChallengeSubmission,
            id=submission_id,
            challenge=challenge,
            is_disqualified=False,
        )

        serializer = ChallengeVoteSerializer(data={}, context={'request': request, 'submission': submission})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        logger.info(f'User {request.user.username} voted for submission {submission_id} in challenge {challenge.slug}')

        return Response(
            {
                'success': True,
                'new_vote_count': submission.vote_count + 1,
            }
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path='unvote/(?P<submission_id>[^/.]+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def unvote(self, request, slug=None, submission_id=None):
        """Remove a vote from a submission."""
        challenge = self.get_object()
        submission = get_object_or_404(
            ChallengeSubmission,
            id=submission_id,
            challenge=challenge,
        )

        vote = ChallengeVote.objects.filter(
            submission=submission,
            voter=request.user,
        ).first()

        if not vote:
            return Response({'detail': 'You have not voted for this submission.'}, status=status.HTTP_400_BAD_REQUEST)

        # Remove vote from leaderboard
        ChallengeLeaderboardService.remove_vote(str(challenge.id), submission.user_id, vote.weight)

        # Delete vote
        vote.delete()

        # Update submission vote count
        submission.vote_count = submission.votes.aggregate(total=models.Sum('weight'))['total'] or 0
        submission.save(update_fields=['vote_count'])

        return Response(
            {
                'success': True,
                'new_vote_count': submission.vote_count,
            }
        )

    @action(detail=True, methods=['get'], url_path='my-submissions', permission_classes=[permissions.IsAuthenticated])
    def my_submissions(self, request, slug=None):
        """Get current user's submissions to this challenge."""
        challenge = self.get_object()
        submissions = ChallengeSubmission.objects.filter(
            challenge=challenge,
            user=request.user,
        ).order_by('-submitted_at')

        serializer = ChallengeSubmissionDetailSerializer(submissions, many=True, context={'request': request})
        return Response(serializer.data)


class ChallengeSubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for individual submissions."""

    queryset = ChallengeSubmission.objects.filter(is_disqualified=False).select_related('user', 'challenge', 'project')
    serializer_class = ChallengeSubmissionDetailSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def vote(self, request, pk=None):
        """Vote for this submission."""
        submission = self.get_object()

        serializer = ChallengeVoteSerializer(data={}, context={'request': request, 'submission': submission})
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                'success': True,
                'new_vote_count': submission.vote_count + 1,
            }
        )
