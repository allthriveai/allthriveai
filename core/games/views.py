"""Views for the games app."""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from core.games.models import GameScore
from core.games.serializers import GameScoreSerializer, SubmitScoreSerializer

logger = logging.getLogger(__name__)


class GameScoreThrottle(UserRateThrottle):
    """Rate limit game score submissions to prevent abuse."""

    rate = '10/minute'  # Max 10 score submissions per minute per user


# Points configuration per game
GAME_POINTS_CONFIG = {
    'context_snake': {
        'base_points': 10,  # Points for playing
        'bonus_per_tokens': 5,  # Every N tokens collected = 1 bonus point
        'max_bonus': 50,  # Cap on bonus points
        'max_score': 225,  # 15x15 grid = max possible tokens
    },
    'ethics_defender': {
        'base_points': 10,
        'bonus_per_score': 100,  # Every N score = 1 bonus point
        'max_bonus': 50,
        'max_score': 10000,  # Reasonable max for ethics defender
    },
}

# Default max score for unknown games
DEFAULT_MAX_SCORE = 1000


def calculate_game_points(game: str, score: int) -> tuple[int, int]:
    """
    Calculate base and bonus points for a game score.

    Returns:
        tuple: (base_points, bonus_points)
    """
    config = GAME_POINTS_CONFIG.get(game, {'base_points': 10, 'max_bonus': 50})
    base_points = config.get('base_points', 10)

    # Calculate bonus based on game type
    if game == 'context_snake':
        # Bonus for tokens collected (score = token count)
        bonus_per = config.get('bonus_per_tokens', 5)
        bonus_points = score // bonus_per
    else:
        # Generic bonus calculation
        bonus_per = config.get('bonus_per_score', 100)
        bonus_points = score // bonus_per

    # Cap bonus points
    max_bonus = config.get('max_bonus', 50)
    bonus_points = min(bonus_points, max_bonus)

    return base_points, bonus_points


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([GameScoreThrottle])
def submit_score(request):
    """Submit a game score and award points."""
    serializer = SubmitScoreSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    game = serializer.validated_data['game']
    score_value = serializer.validated_data['score']

    # Validate score is within reasonable bounds to prevent cheating
    config = GAME_POINTS_CONFIG.get(game, {})
    max_score = config.get('max_score', DEFAULT_MAX_SCORE)
    if score_value > max_score:
        logger.warning(
            'Suspicious game score rejected',
            extra={
                'user_id': request.user.id,
                'game': game,
                'score': score_value,
                'max_allowed': max_score,
            },
        )
        return Response(
            {'error': f'Score exceeds maximum allowed value of {max_score}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create the score record
    score = GameScore.objects.create(
        user=request.user,
        game=game,
        score=score_value,
        metadata=serializer.validated_data.get('metadata', {}),
    )

    # Invalidate leaderboard cache if this might be a top score
    # Only invalidate if score is potentially in top 100
    GameScore.invalidate_leaderboard_cache(game)

    # Calculate and award points in a single transaction
    base_points, bonus_points = calculate_game_points(game, score_value)
    total_points = base_points + bonus_points

    points_awarded = {
        'base': base_points,
        'bonus': bonus_points,
        'total': total_points,
    }

    # Award all points in a single call to avoid partial updates
    if total_points > 0:
        game_name = game.replace('_', ' ').title()
        request.user.add_points(
            total_points,
            f'{game}_score',
            f'{game_name}: {score_value} tokens (+{base_points} play, +{bonus_points} bonus)',
        )

    logger.info(
        'Game score submitted with points',
        extra={
            'user_id': request.user.id,
            'game': game,
            'score': score_value,
            'points_awarded': total_points,
        },
    )

    # Return score with points info
    response_data = GameScoreSerializer(score).data
    response_data['points_awarded'] = points_awarded

    return Response(response_data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_high_score(request, game):
    """Get the current user's high score for a game."""
    high_score = GameScore.get_high_score(request.user, game)
    if high_score:
        return Response(GameScoreSerializer(high_score).data)
    return Response({'score': None})


@api_view(['GET'])
def leaderboard(request, game):
    """Get the leaderboard for a game."""
    limit = int(request.query_params.get('limit', 10))
    limit = min(limit, 100)  # Cap at 100

    scores = GameScore.get_leaderboard(game, limit=limit)
    return Response(GameScoreSerializer(scores, many=True).data)
