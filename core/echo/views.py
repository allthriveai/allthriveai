"""API views for Echo Personal Assistant."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EchoProfile
from .serializers import EchoProfileSerializer


class EchoProfileView(APIView):
    """
    API view for Echo profile.

    GET: Returns the user's EchoProfile, creating one if it doesn't exist.
    PATCH: Updates the user's EchoProfile with partial data.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get or create the user's Echo profile."""
        profile, created = EchoProfile.objects.get_or_create(user=request.user)
        serializer = EchoProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def patch(self, request):
        """Update the user's Echo profile."""
        profile, _ = EchoProfile.objects.get_or_create(user=request.user)
        serializer = EchoProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
