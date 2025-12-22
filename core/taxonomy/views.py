from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Taxonomy, UserInteraction, UserTag
from .serializers import (
    TaxonomySerializer,
    UserInteractionSerializer,
    UserPersonalizationSerializer,
    UserTagCreateSerializer,
    UserTagSerializer,
)


class TaxonomyViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for listing available taxonomies.

    Taxonomies are predefined categories that users can select for personalization.
    This endpoint is read-only as taxonomies are managed by admins.
    List endpoint is public for tool directory access.
    """

    serializer_class = TaxonomySerializer
    permission_classes = [AllowAny]

    def get_permissions(self):
        """Allow public access for list and retrieve, require auth for other actions."""
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Return only active taxonomies, optionally filtered by type."""
        queryset = Taxonomy.objects.filter(is_active=True)

        # Filter by taxonomy_type if provided in query params
        taxonomy_type = self.request.query_params.get('taxonomy_type')
        if taxonomy_type:
            queryset = queryset.filter(taxonomy_type=taxonomy_type)

        return queryset

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get taxonomies grouped by type (tool/topic)."""
        taxonomies = self.get_queryset()

        grouped = {}
        for taxonomy in taxonomies:
            taxonomy_type = taxonomy.taxonomy_type
            if taxonomy_type not in grouped:
                grouped[taxonomy_type] = []
            grouped[taxonomy_type].append(TaxonomySerializer(taxonomy).data)

        return Response(grouped)


class UserTagViewSet(viewsets.ModelViewSet):
    """ViewSet for managing user tags.

    Users can view all their tags (manual and auto-generated),
    create new manual tags, and delete tags.
    """

    serializer_class = UserTagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return only tags for the authenticated user."""
        return UserTag.objects.filter(user=self.request.user).select_related('taxonomy')

    def get_serializer_class(self):
        """Use different serializer for creation."""
        if self.action == 'create':
            return UserTagCreateSerializer
        return UserTagSerializer

    def perform_create(self, serializer):
        """Create a new manual user tag."""
        serializer.save()

    @action(detail=False, methods=['get'])
    def manual(self, request):
        """Get only manually selected tags."""
        tags = self.get_queryset().filter(source=UserTag.TagSource.MANUAL)
        serializer = self.get_serializer(tags, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def auto_generated(self, request):
        """Get only auto-generated tags."""
        tags = (
            self.get_queryset()
            .filter(
                Q(source=UserTag.TagSource.AUTO_PROJECT)
                | Q(source=UserTag.TagSource.AUTO_CONVERSATION)
                | Q(source=UserTag.TagSource.AUTO_ACTIVITY)
            )
            .order_by('-confidence_score', '-interaction_count')
        )
        serializer = self.get_serializer(tags, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple tags at once from taxonomy selections."""
        taxonomy_ids = request.data.get('taxonomy_ids', [])

        if not taxonomy_ids:
            return Response({'error': 'taxonomy_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

        taxonomies = Taxonomy.objects.filter(id__in=taxonomy_ids, is_active=True)
        created_tags = []

        for taxonomy in taxonomies:
            tag, created = UserTag.objects.get_or_create(
                user=request.user,
                name=taxonomy.name,
                defaults={
                    'taxonomy': taxonomy,
                    'source': UserTag.TagSource.MANUAL,
                    'confidence_score': 1.0,
                },
            )
            if created:
                created_tags.append(tag)

        serializer = UserTagSerializer(created_tags, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['delete'])
    def bulk_delete(self, request):
        """Delete multiple tags at once."""
        tag_ids = request.data.get('tag_ids', [])

        if not tag_ids:
            return Response({'error': 'tag_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

        deleted_count, _ = UserTag.objects.filter(user=request.user, id__in=tag_ids).delete()

        return Response({'deleted': deleted_count}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_personalization_overview(request):
    """Get a comprehensive overview of user's personalization data.

    Returns:
    - Manual tags (non-topic taxonomies)
    - Auto-generated tags
    - Available taxonomies (tools)
    - Available topics
    - Selected topics
    - Total interaction count
    """
    user = request.user

    # Manual tags excluding topics
    manual_tags = (
        UserTag.objects.filter(user=user, source=UserTag.TagSource.MANUAL)
        .exclude(taxonomy__taxonomy_type='topic')
        .select_related('taxonomy')
    )

    # Auto-generated tags
    auto_tags = (
        UserTag.objects.filter(user=user)
        .exclude(source=UserTag.TagSource.MANUAL)
        .select_related('taxonomy')
        .order_by('-confidence_score', '-interaction_count')
    )

    # Selected topics (user manual tags that are topics)
    selected_topic_tags = UserTag.objects.filter(
        user=user,
        source=UserTag.TagSource.MANUAL,
        taxonomy__taxonomy_type='topic',
    ).select_related('taxonomy')

    # Available taxonomies (tools only)
    available_taxonomies = Taxonomy.objects.filter(is_active=True, taxonomy_type='tool')

    # Available topics
    available_topics = Taxonomy.objects.filter(is_active=True, taxonomy_type='topic').order_by('name')

    total_interactions = UserInteraction.objects.filter(user=user).count()

    data = {
        'manual_tags': UserTagSerializer(manual_tags, many=True).data,
        'auto_generated_tags': UserTagSerializer(auto_tags, many=True).data,
        'available_taxonomies': TaxonomySerializer(available_taxonomies, many=True).data,
        'available_topics': TaxonomySerializer(available_topics, many=True).data,
        'selected_topics': TaxonomySerializer([t.taxonomy for t in selected_topic_tags if t.taxonomy], many=True).data,
        'total_interactions': total_interactions,
    }

    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def track_interaction(request):
    """Track a user interaction for auto-tagging purposes.

    This endpoint should be called when users perform significant actions
    that could be used for personalization (viewing projects, conversations, etc.).
    """
    interaction_type = request.data.get('interaction_type')
    metadata = request.data.get('metadata', {})
    extracted_keywords = request.data.get('extracted_keywords', [])

    if not interaction_type:
        return Response({'error': 'interaction_type is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate interaction type
    valid_types = [choice[0] for choice in UserInteraction.InteractionType.choices]
    if interaction_type not in valid_types:
        return Response(
            {'error': f'Invalid interaction_type. Must be one of: {", ".join(valid_types)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    interaction = UserInteraction.objects.create(
        user=request.user,
        interaction_type=interaction_type,
        metadata=metadata,
        extracted_keywords=extracted_keywords,
    )

    serializer = UserInteractionSerializer(interaction)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def topic_detail(request, slug):
    """Get topic definition and related projects.

    This endpoint returns a dictionary-style definition of the topic
    along with projects that are tagged with it. If the topic hasn't
    been seen before, an AI-generated definition is created and cached.

    Path Parameters:
        slug: Topic slug (e.g., "ai-agents", "machine-learning")

    Query Parameters:
        limit: Number of related projects to return (default: 10, max: 20)

    Returns:
        {
            "slug": "ai-agents",
            "displayName": "AI Agents",
            "description": "AI agents are autonomous software programs that...",
            "projects": [...],  // Related projects
            "projectCount": 42,
            "exploreUrl": "/explore?topics=ai-agents"
        }
    """
    from core.projects.serializers import ProjectCardSerializer

    from .topic_service import get_or_create_topic_definition, get_related_projects, normalize_topic_slug

    # Normalize the slug
    normalized_slug = normalize_topic_slug(slug)
    if not normalized_slug:
        return Response({'error': 'Invalid topic slug'}, status=status.HTTP_400_BAD_REQUEST)

    # Get or create the topic definition
    definition = get_or_create_topic_definition(normalized_slug, generate_if_missing=True)

    if not definition:
        return Response({'error': 'Topic not found'}, status=status.HTTP_404_NOT_FOUND)

    # Get related projects
    limit = min(int(request.query_params.get('limit', 10)), 20)
    projects = get_related_projects(normalized_slug, limit=limit)

    # Serialize the response
    project_serializer = ProjectCardSerializer(projects, many=True, context={'request': request})

    return Response(
        {
            'slug': definition.slug,
            'displayName': definition.display_name,
            'description': definition.description,
            'projects': project_serializer.data,
            'projectCount': definition.project_count,
            'exploreUrl': f'/explore?topics={definition.slug}',
        }
    )
