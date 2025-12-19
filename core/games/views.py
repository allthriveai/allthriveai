"""Views for the games app."""

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.games.models import GameScore
from core.games.serializers import GameScoreSerializer, SubmitScoreSerializer

logger = logging.getLogger(__name__)

# Points configuration per game
GAME_POINTS_CONFIG = {
    'context_snake': {
        'base_points': 10,  # Points for playing
        'bonus_per_tokens': 5,  # Every N tokens collected = 1 bonus point
        'max_bonus': 50,  # Cap on bonus points
    },
    'ethics_defender': {
        'base_points': 10,
        'bonus_per_score': 100,  # Every N score = 1 bonus point
        'max_bonus': 50,
    },
}


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
def submit_score(request):
    """Submit a game score and award points."""
    serializer = SubmitScoreSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    game = serializer.validated_data['game']
    score_value = serializer.validated_data['score']

    # Create the score record
    score = GameScore.objects.create(
        user=request.user,
        game=game,
        score=score_value,
        metadata=serializer.validated_data.get('metadata', {}),
    )

    # Calculate and award points
    base_points, bonus_points = calculate_game_points(game, score_value)
    total_points = base_points + bonus_points

    points_awarded = {
        'base': base_points,
        'bonus': bonus_points,
        'total': total_points,
    }

    # Award base points for playing
    if base_points > 0:
        request.user.add_points(
            base_points,
            f'{game}_play',
            f'Played {game.replace("_", " ").title()}',
        )

    # Award bonus points for performance
    if bonus_points > 0:
        request.user.add_points(
            bonus_points,
            f'{game}_bonus',
            f'Score bonus: {score_value} tokens',
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
