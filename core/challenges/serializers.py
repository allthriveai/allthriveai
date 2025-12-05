"""Serializers for Weekly Challenges API."""

from django.db import models
from rest_framework import serializers

from core.challenges.leaderboard import ChallengeLeaderboardService
from core.challenges.models import (
    ChallengeParticipant,
    ChallengeSponsor,
    ChallengeSubmission,
    ChallengeVote,
    WeeklyChallenge,
)
from core.users.serializers import UserMinimalSerializer


class ChallengeSponsorSerializer(serializers.ModelSerializer):
    """Serializer for challenge sponsors."""

    class Meta:
        model = ChallengeSponsor
        fields = [
            'id',
            'name',
            'slug',
            'logo_url',
            'website_url',
            'description',
            'is_verified',
        ]


class WeeklyChallengeListSerializer(serializers.ModelSerializer):
    """Serializer for challenge list views."""

    sponsor = ChallengeSponsorSerializer(read_only=True)
    time_remaining_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WeeklyChallenge
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'status',
            'status_display',
            'starts_at',
            'submission_deadline',
            'ends_at',
            'is_featured',
            'hero_image_url',
            'theme_color',
            'sponsor',
            'submission_count',
            'participant_count',
            'time_remaining_display',
        ]

    def get_time_remaining_display(self, obj):
        """Format time remaining for display."""
        delta = obj.time_remaining
        if not delta:
            return None

        days = delta.days
        hours, remainder = divmod(delta.seconds, 3600)
        minutes = remainder // 60

        if days > 0:
            return f'{days}d {hours}h'
        elif hours > 0:
            return f'{hours}h {minutes}m'
        else:
            return f'{minutes}m'


class WeeklyChallengeDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for challenge detail views."""

    sponsor = ChallengeSponsorSerializer(read_only=True)
    time_remaining_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_submit = serializers.BooleanField(read_only=True)
    can_vote = serializers.BooleanField(read_only=True)
    user_status = serializers.SerializerMethodField()
    top_submissions = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyChallenge
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'prompt',
            'status',
            'status_display',
            'week_number',
            'year',
            'starts_at',
            'submission_deadline',
            'voting_deadline',
            'ends_at',
            'is_featured',
            'max_submissions_per_user',
            'allow_voting',
            'require_project_link',
            'allow_external_submissions',
            'hero_image_url',
            'theme_color',
            'sponsor',
            'prizes',
            'points_config',
            'suggested_tools',
            'submission_count',
            'participant_count',
            'total_votes',
            'can_submit',
            'can_vote',
            'time_remaining_display',
            'user_status',
            'top_submissions',
        ]

    def get_time_remaining_display(self, obj):
        """Format time remaining for display."""
        delta = obj.time_remaining
        if not delta:
            return None

        days = delta.days
        hours, remainder = divmod(delta.seconds, 3600)
        minutes = remainder // 60

        if days > 0:
            return f'{days}d {hours}h remaining'
        elif hours > 0:
            return f'{hours}h {minutes}m remaining'
        else:
            return f'{minutes}m remaining'

    def get_user_status(self, obj):
        """Get current user's participation status."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        user = request.user

        # Get submission count
        submission_count = ChallengeLeaderboardService.get_user_submission_count(str(obj.id), user.id)

        # Get votes cast
        votes_cast = ChallengeVote.objects.filter(submission__challenge=obj, voter=user).count()

        # Check vote limits
        can_vote_today, votes_remaining = ChallengeLeaderboardService.check_daily_vote_limit(str(obj.id), user.id)

        # Get user's rank if they have submissions
        rank = ChallengeLeaderboardService.get_user_rank(str(obj.id), user.id)
        score = ChallengeLeaderboardService.get_user_score(str(obj.id), user.id)

        return {
            'has_submitted': submission_count > 0,
            'submission_count': submission_count,
            'can_submit_more': submission_count < obj.max_submissions_per_user,
            'votes_cast': votes_cast,
            'can_vote_today': can_vote_today,
            'votes_remaining_today': votes_remaining,
            'rank': rank,
            'total_votes': int(score),
        }

    def get_top_submissions(self, obj):
        """Get preview of top submissions."""
        submissions = obj.submissions.filter(is_disqualified=False)[:4]
        return ChallengeSubmissionSerializer(submissions, many=True, context=self.context).data


class ChallengeSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for challenge submissions."""

    user = UserMinimalSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()

    class Meta:
        model = ChallengeSubmission
        fields = [
            'id',
            'user',
            'title',
            'description',
            'image_url',
            'external_url',
            'ai_tool_used',
            'vote_count',
            'is_featured',
            'is_early_bird',
            'final_rank',
            'submitted_at',
            'has_voted',
        ]

    def get_image_url(self, obj):
        return obj.get_image_url()

    def get_has_voted(self, obj):
        """Check if current user has voted for this submission."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.votes.filter(voter=request.user).exists()


class ChallengeSubmissionDetailSerializer(ChallengeSubmissionSerializer):
    """Detailed serializer for submission detail view."""

    challenge = WeeklyChallengeListSerializer(read_only=True)
    project_id = serializers.UUIDField(source='project.id', read_only=True, allow_null=True)
    project_title = serializers.CharField(source='project.title', read_only=True, allow_null=True)

    class Meta(ChallengeSubmissionSerializer.Meta):
        fields = ChallengeSubmissionSerializer.Meta.fields + [
            'challenge',
            'project_id',
            'project_title',
            'participation_points',
            'bonus_points',
            'prize_points',
        ]


class ChallengeSubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating submissions."""

    project_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = ChallengeSubmission
        fields = [
            'title',
            'description',
            'image_url',
            'external_url',
            'ai_tool_used',
            'project_id',
        ]

    def validate(self, data):
        """Validate submission data."""
        challenge = self.context['challenge']
        user = self.context['request'].user

        # Check if challenge accepts submissions
        if not challenge.can_submit:
            raise serializers.ValidationError('This challenge is not currently accepting submissions.')

        # Check submission limit
        current_count = ChallengeLeaderboardService.get_user_submission_count(str(challenge.id), user.id)
        if current_count >= challenge.max_submissions_per_user:
            raise serializers.ValidationError(
                f'You have reached the maximum of {challenge.max_submissions_per_user} submissions.'
            )

        # Validate project if provided
        if data.get('project_id'):
            from core.projects.models import Project

            try:
                project = Project.objects.get(id=data['project_id'], user=user)
                data['project'] = project
            except Project.DoesNotExist:
                raise serializers.ValidationError({'project_id': 'Invalid project ID.'})

        # Require image or project
        if not data.get('image_url') and not data.get('project_id') and not data.get('external_url'):
            raise serializers.ValidationError('Please provide an image URL, external URL, or link to a project.')

        return data

    def create(self, validated_data):
        """Create submission and award points."""
        validated_data.pop('project_id', None)
        challenge = self.context['challenge']
        user = self.context['request'].user

        submission = ChallengeSubmission.objects.create(challenge=challenge, user=user, **validated_data)

        # Track in leaderboard
        ChallengeLeaderboardService.add_submission(str(challenge.id), user.id, str(submission.id))

        # Track weekly participation
        ChallengeLeaderboardService.track_weekly_participation(challenge.year, challenge.week_number, user.id)

        # Award participation points
        submission.award_participation_points()

        # Update challenge stats
        challenge.update_stats()

        # Create or update participant record
        ChallengeParticipant.objects.update_or_create(
            challenge=challenge, user=user, defaults={'submission_count': models.F('submission_count') + 1}
        )

        return submission


class ChallengeVoteSerializer(serializers.Serializer):
    """Serializer for casting votes."""

    def validate(self, data):
        """Validate vote."""
        submission = self.context['submission']
        user = self.context['request'].user

        # Can't vote for own submission
        if submission.user == user:
            raise serializers.ValidationError('You cannot vote for your own submission.')

        # Check if already voted
        if ChallengeVote.objects.filter(submission=submission, voter=user).exists():
            raise serializers.ValidationError('You have already voted for this submission.')

        # Check daily limit
        can_vote, remaining = ChallengeLeaderboardService.check_daily_vote_limit(str(submission.challenge_id), user.id)
        if not can_vote:
            raise serializers.ValidationError('You have reached your daily vote limit for this challenge.')

        # Check if challenge allows voting
        if not submission.challenge.can_vote:
            raise serializers.ValidationError('Voting is not currently available for this challenge.')

        return data

    def create(self, validated_data):
        """Create vote and update leaderboard."""
        submission = self.context['submission']
        user = self.context['request'].user

        vote = ChallengeVote.objects.create(
            submission=submission,
            voter=user,
        )

        # Update leaderboard
        ChallengeLeaderboardService.add_vote(str(submission.challenge_id), submission.user_id, 1.0)

        # Record daily vote
        ChallengeLeaderboardService.record_daily_vote(str(submission.challenge_id), user.id)

        return vote


class LeaderboardEntrySerializer(serializers.Serializer):
    """Serializer for leaderboard entries."""

    rank = serializers.IntegerField()
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)
    vote_count = serializers.IntegerField()
    is_current_user = serializers.BooleanField()
    submission_count = serializers.IntegerField(required=False)


class LeaderboardSerializer(serializers.Serializer):
    """Serializer for full leaderboard response."""

    entries = LeaderboardEntrySerializer(many=True)
    total_participants = serializers.IntegerField()
    user_entry = LeaderboardEntrySerializer(allow_null=True)
