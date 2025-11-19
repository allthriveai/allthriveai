"""Standardized response helpers for consistent API responses."""
from typing import Any, Dict, Optional

from rest_framework import status
from rest_framework.response import Response


def error_response(message: str, status_code: int = status.HTTP_400_BAD_REQUEST, **extra: Any) -> Response:
    """Create a standardized error response.

    Args:
        message: Human-readable error message
        status_code: HTTP status code (default: 400)
        **extra: Additional fields to include in response

    Returns:
        Response object with error data

    Example:
        return error_response('Invalid input', field='email')
    """
    data: Dict[str, Any] = {"error": message}
    data.update(extra)
    return Response(data, status=status_code)


def validation_error(field: str, message: str, **extra: Any) -> Response:
    """Create a standardized validation error response.

    Args:
        field: Field name that failed validation
        message: Validation error message
        **extra: Additional fields to include in response

    Returns:
        Response object with validation error

    Example:
        return validation_error('email', 'Invalid email format')
    """
    return error_response(
        message=f"Validation error: {message}", field=field, status_code=status.HTTP_400_BAD_REQUEST, **extra
    )


def success_response(
    message: Optional[str] = None, data: Optional[Dict[str, Any]] = None, status_code: int = status.HTTP_200_OK
) -> Response:
    """Create a standardized success response.

    Args:
        message: Optional success message
        data: Response data
        status_code: HTTP status code (default: 200)

    Returns:
        Response object with success data

    Example:
        return success_response('Project deleted', data={'deleted_count': 5})
    """
    response_data = data or {}
    if message:
        response_data["message"] = message
    return Response(response_data, status=status_code)


def created_response(data: Dict[str, Any], message: str = "Created successfully") -> Response:
    """Create a standardized 201 Created response.

    Args:
        data: Created resource data
        message: Success message

    Returns:
        Response object with 201 status
    """
    return success_response(message=message, data=data, status_code=status.HTTP_201_CREATED)


def no_content_response() -> Response:
    """Create a standardized 204 No Content response.

    Returns:
        Empty Response with 204 status
    """
    return Response(status=status.HTTP_204_NO_CONTENT)


def not_found_error(resource: str, identifier: Optional[str] = None) -> Response:
    """Create a standardized 404 Not Found response.

    Args:
        resource: Type of resource (e.g., 'Project', 'User')
        identifier: Optional resource identifier

    Returns:
        Response object with 404 status

    Example:
        return not_found_error('Project', '123')
    """
    message = f"{resource} not found"
    if identifier:
        message = f"{resource} '{identifier}' not found"
    return error_response(message, status_code=status.HTTP_404_NOT_FOUND, resource=resource)


def permission_denied_error(message: str = "Permission denied") -> Response:
    """Create a standardized 403 Forbidden response.

    Args:
        message: Permission error message

    Returns:
        Response object with 403 status
    """
    return error_response(message, status_code=status.HTTP_403_FORBIDDEN)


def unauthorized_error(message: str = "Authentication required") -> Response:
    """Create a standardized 401 Unauthorized response.

    Args:
        message: Authentication error message

    Returns:
        Response object with 401 status
    """
    return error_response(message, status_code=status.HTTP_401_UNAUTHORIZED)
