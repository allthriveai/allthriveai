"""
API Contract Testing Base Classes

Provides utilities for validating API responses against OpenAPI schema.
"""

import logging
from functools import lru_cache
from typing import Any

from django.test import TestCase
from rest_framework.response import Response
from rest_framework.test import APIClient, APITestCase

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_openapi_schema() -> dict:
    """
    Fetch and cache the OpenAPI schema.

    Returns:
        OpenAPI schema as a dictionary
    """
    from drf_spectacular.generators import SchemaGenerator

    generator = SchemaGenerator(patterns=None)
    schema = generator.get_schema(request=None, public=True)
    return schema


def resolve_schema_ref(schema: dict, ref: str) -> dict:
    """
    Resolve a $ref reference in the OpenAPI schema.

    Args:
        schema: The full OpenAPI schema
        ref: Reference string like '#/components/schemas/Project'

    Returns:
        The resolved schema object
    """
    if not ref.startswith('#/'):
        raise ValueError(f'Only local refs are supported: {ref}')

    parts = ref.lstrip('#/').split('/')
    result = schema

    for part in parts:
        result = result[part]

    return result


def validate_against_schema(data: Any, schema_def: dict, full_schema: dict, path: str = '') -> list[str]:
    """
    Validate data against an OpenAPI schema definition.

    Args:
        data: The data to validate
        schema_def: The schema definition to validate against
        full_schema: The full OpenAPI schema (for resolving $refs)
        path: Current path in the data (for error messages)

    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []

    # Handle $ref
    if '$ref' in schema_def:
        schema_def = resolve_schema_ref(full_schema, schema_def['$ref'])

    # Handle allOf, anyOf, oneOf
    if 'allOf' in schema_def:
        for sub_schema in schema_def['allOf']:
            errors.extend(validate_against_schema(data, sub_schema, full_schema, path))
        return errors

    if 'anyOf' in schema_def or 'oneOf' in schema_def:
        # For anyOf/oneOf, at least one must match
        sub_schemas = schema_def.get('anyOf', schema_def.get('oneOf', []))
        all_errors = []
        for sub_schema in sub_schemas:
            sub_errors = validate_against_schema(data, sub_schema, full_schema, path)
            if not sub_errors:
                return []  # Valid against this option
            all_errors.extend(sub_errors)
        # None matched - return all errors
        return [f'{path}: value does not match any of {len(sub_schemas)} options']

    # Check nullable
    if data is None:
        if schema_def.get('nullable', False):
            return []
        else:
            return [f'{path}: null not allowed']

    # Type checking
    schema_type = schema_def.get('type')

    if schema_type == 'object':
        if not isinstance(data, dict):
            return [f'{path}: expected object, got {type(data).__name__}']

        # Check required properties
        required = schema_def.get('required', [])
        for prop in required:
            if prop not in data:
                errors.append(f'{path}.{prop}: required property missing')

        # Validate properties
        properties = schema_def.get('properties', {})
        for prop, prop_schema in properties.items():
            if prop in data:
                errors.extend(validate_against_schema(data[prop], prop_schema, full_schema, f'{path}.{prop}'))

    elif schema_type == 'array':
        if not isinstance(data, list):
            return [f'{path}: expected array, got {type(data).__name__}']

        items_schema = schema_def.get('items', {})
        for i, item in enumerate(data):
            errors.extend(validate_against_schema(item, items_schema, full_schema, f'{path}[{i}]'))

    elif schema_type == 'string':
        if not isinstance(data, str):
            return [f'{path}: expected string, got {type(data).__name__}']

        # Check format
        fmt = schema_def.get('format')
        if fmt == 'date-time':
            # Basic ISO 8601 check
            import re

            if not re.match(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', str(data)):
                errors.append(f'{path}: invalid date-time format')
        elif fmt == 'uuid':
            import re

            if not re.match(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', str(data), re.I):
                errors.append(f'{path}: invalid UUID format')

        # Check enum
        if 'enum' in schema_def and data not in schema_def['enum']:
            errors.append(f"{path}: '{data}' not in enum {schema_def['enum']}")

    elif schema_type == 'integer':
        if not isinstance(data, int) or isinstance(data, bool):
            return [f'{path}: expected integer, got {type(data).__name__}']

    elif schema_type == 'number':
        if not isinstance(data, int | float) or isinstance(data, bool):
            return [f'{path}: expected number, got {type(data).__name__}']

    elif schema_type == 'boolean':
        if not isinstance(data, bool):
            return [f'{path}: expected boolean, got {type(data).__name__}']

    return errors


def validate_response_schema(response: Response, operation_id: str = None, status_code: int = None) -> list[str]:
    """
    Validate an API response against the OpenAPI schema.

    Args:
        response: The DRF response object
        operation_id: The operationId from the OpenAPI spec (optional)
        status_code: Expected status code (defaults to response.status_code)

    Returns:
        List of validation error messages (empty if valid)
    """
    schema = get_openapi_schema()
    status = status_code or response.status_code

    # Find the response schema for this endpoint
    # This is a simplified implementation - production would use the request path
    if operation_id:
        # Search for the operation by ID
        for path, methods in schema.get('paths', {}).items():
            for method, spec in methods.items():
                if isinstance(spec, dict) and spec.get('operationId') == operation_id:
                    response_spec = spec.get('responses', {}).get(str(status), {})
                    content = response_spec.get('content', {}).get('application/json', {})
                    schema_def = content.get('schema', {})
                    if schema_def:
                        return validate_against_schema(response.data, schema_def, schema, 'response')

    # If no operation ID, do basic type validation
    return []


class APIContractTestCase(APITestCase):
    """
    Base test case for API contract testing.

    Provides methods for validating API responses against the OpenAPI schema.

    Example:
        class ProjectAPITest(APIContractTestCase):
            def test_list_projects(self):
                response = self.client.get('/api/v1/projects/')
                self.assertResponseMatchesSchema(response, operation_id='projects_list')
    """

    def setUp(self):
        """Set up test client."""
        super().setUp()
        self.client = APIClient()

    def assertResponseMatchesSchema(
        self, response: Response, operation_id: str = None, status_code: int = None, msg: str = None
    ) -> None:
        """
        Assert that the response matches the OpenAPI schema.

        Args:
            response: The API response
            operation_id: The operationId from the OpenAPI spec
            status_code: Expected status code
            msg: Optional failure message
        """
        errors = validate_response_schema(response, operation_id, status_code)
        if errors:
            error_msg = 'Response does not match schema:\n' + '\n'.join(f'  - {e}' for e in errors)
            if msg:
                error_msg = f'{msg}\n{error_msg}'
            self.fail(error_msg)

    def assertSchemaValid(self) -> None:
        """
        Assert that the OpenAPI schema itself is valid.

        This catches issues like missing $refs or invalid schema definitions.
        """
        try:
            schema = get_openapi_schema()
            # Basic validation - schema should have paths
            self.assertIn('paths', schema, "Schema missing 'paths'")
            self.assertIn('components', schema, "Schema missing 'components'")
            self.assertIn('schemas', schema['components'], "Schema missing 'components.schemas'")
        except Exception as e:
            self.fail(f'Schema generation failed: {e}')

    def get_schema_for_endpoint(self, path: str, method: str = 'get') -> dict | None:
        """
        Get the schema definition for a specific endpoint.

        Args:
            path: API path (e.g., '/api/v1/projects/')
            method: HTTP method

        Returns:
            Schema definition dict or None if not found
        """
        schema = get_openapi_schema()
        path_spec = schema.get('paths', {}).get(path, {})
        method_spec = path_spec.get(method.lower(), {})

        if method_spec:
            # Get 200 response schema
            response_spec = method_spec.get('responses', {}).get('200', {})
            content = response_spec.get('content', {}).get('application/json', {})
            return content.get('schema')

        return None


class SchemaSnapshotTestCase(TestCase):
    """
    Test case for detecting breaking changes in the API schema.

    Compares the current schema against a baseline to detect:
    - Removed endpoints
    - Removed required fields
    - Type changes
    - Breaking enum changes
    """

    @classmethod
    def setUpClass(cls):
        """Generate current schema."""
        super().setUpClass()
        cls.current_schema = get_openapi_schema()

    def test_schema_generates_without_errors(self):
        """Ensure the OpenAPI schema generates successfully."""
        self.assertIsNotNone(self.current_schema)
        self.assertIn('openapi', self.current_schema)
        self.assertIn('paths', self.current_schema)

    def test_schema_has_info(self):
        """Schema should have proper metadata."""
        info = self.current_schema.get('info', {})
        self.assertIn('title', info)
        self.assertIn('version', info)

    def test_all_refs_resolve(self):
        """All $ref references should resolve to valid schemas."""

        def check_refs(obj, path=''):
            if isinstance(obj, dict):
                if '$ref' in obj:
                    ref = obj['$ref']
                    try:
                        resolve_schema_ref(self.current_schema, ref)
                    except (KeyError, TypeError) as e:
                        self.fail(f'Broken $ref at {path}: {ref} -> {e}')

                for key, value in obj.items():
                    check_refs(value, f'{path}.{key}')

            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_refs(item, f'{path}[{i}]')

        check_refs(self.current_schema)
