"""Custom permission classes for user profile and project security."""

from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """Permission that requires admin role.

    Uses the User model's is_admin_role property which checks
    role == 'admin' OR is_superuser.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_admin_role


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to allow read access to all,
    but only allow owners to edit their own objects.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request (GET, HEAD, OPTIONS)
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions only for the owner
        # Assumes obj has a 'user' attribute
        return obj.user == request.user


class IsProfileOwner(permissions.BasePermission):
    """
    Object-level permission to only allow users to view/edit their own profile.
    Admin users can view all profiles.
    """

    def has_object_permission(self, request, view, obj):
        # Admin users can access any profile
        if request.user.is_authenticated and request.user.is_admin_role:
            return True

        # Users can only access their own profile
        # obj is the User instance
        return obj == request.user


class IsProfileOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission for public profile viewing but owner-only editing.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions allowed to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated

        # Write permissions only for the profile owner or admin
        return obj == request.user or request.user.is_admin_role


class CanModifyRole(permissions.BasePermission):
    """
    Permission to prevent role escalation attacks.
    Only superusers can modify user roles.
    """

    def has_permission(self, request, view):
        # If the request is trying to modify the 'role' field
        if request.method in ['POST', 'PUT', 'PATCH']:
            if 'role' in request.data:
                return request.user.is_superuser
        return True
