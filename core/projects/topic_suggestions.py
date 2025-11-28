"""Topic suggestions for autocomplete."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_topic_suggestions(request):
    """Get popular topics for autocomplete suggestions.

    Returns topics sorted by usage count, with optional search filtering.

    Query parameters:
        - q: Search query to filter topics
        - limit: Max number of suggestions (default: 20)
    """
    search_query = request.GET.get('q', '').lower().strip()
    limit = int(request.GET.get('limit', 20))

    # Get all topics from published projects
    projects = Project.objects.filter(is_published=True, is_archived=False).exclude(topics=[])

    # Flatten all topics and count occurrences
    topic_counts = {}
    for project in projects:
        for topic in project.topics:
            topic_lower = topic.lower()
            # Filter by search query if provided
            if not search_query or search_query in topic_lower:
                if topic not in topic_counts:
                    topic_counts[topic] = 0
                topic_counts[topic] += 1

    # Sort by count (descending) and return top results
    sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)[:limit]

    # Return just the topic names
    suggestions = [topic for topic, count in sorted_topics]

    return Response({'suggestions': suggestions})
