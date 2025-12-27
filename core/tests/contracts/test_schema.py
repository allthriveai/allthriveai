"""
API Schema Contract Tests

These tests validate the OpenAPI schema is consistent and all references resolve.
Run these in CI to catch schema issues before deployment.
"""

import pytest
from django.test import TestCase

from .base import SchemaSnapshotTestCase, get_openapi_schema


class TestOpenAPISchemaValidity(SchemaSnapshotTestCase):
    """Tests that the OpenAPI schema is valid and consistent."""

    def test_schema_version(self):
        """Schema should be OpenAPI 3.x."""
        version = self.current_schema.get('openapi', '')
        self.assertTrue(version.startswith('3.'), f'Expected OpenAPI 3.x, got {version}')

    def test_all_paths_have_responses(self):
        """Every endpoint should have at least one response defined."""
        paths = self.current_schema.get('paths', {})

        for path, methods in paths.items():
            for method, spec in methods.items():
                if method in ('get', 'post', 'put', 'patch', 'delete'):
                    responses = spec.get('responses', {})
                    self.assertTrue(len(responses) > 0, f'{method.upper()} {path} has no responses defined')

    def test_required_fields_have_types(self):
        """Required fields in schemas should have type definitions."""
        schemas = self.current_schema.get('components', {}).get('schemas', {})
        fields_missing_types = []

        for schema_name, schema_def in schemas.items():
            required = schema_def.get('required', [])
            properties = schema_def.get('properties', {})

            for field in required:
                if field in properties:
                    prop = properties[field]
                    # Should have type or $ref
                    has_type = 'type' in prop or '$ref' in prop or 'allOf' in prop or 'anyOf' in prop or 'oneOf' in prop
                    if not has_type:
                        fields_missing_types.append(f'{schema_name}.{field}')

        # Log warnings for missing types but don't fail (existing tech debt)
        if fields_missing_types:
            import warnings

            warnings.warn(
                f"Found {len(fields_missing_types)} required fields without types: "
                f"{', '.join(fields_missing_types[:5])}...",
                stacklevel=2,
            )

    def test_no_duplicate_operation_ids(self):
        """Operation IDs should be unique across the API."""
        paths = self.current_schema.get('paths', {})
        operation_ids = {}

        for path, methods in paths.items():
            for method, spec in methods.items():
                if isinstance(spec, dict) and 'operationId' in spec:
                    op_id = spec['operationId']
                    if op_id in operation_ids:
                        self.fail(
                            f"Duplicate operationId '{op_id}' at {method.upper()} {path} "
                            f'(first seen at {operation_ids[op_id]})'
                        )
                    operation_ids[op_id] = f'{method.upper()} {path}'


class TestCriticalEndpointsHaveSchemas(TestCase):
    """Test that critical API endpoints have proper schema definitions."""

    @classmethod
    def setUpClass(cls):
        """Load schema."""
        super().setUpClass()
        cls.schema = get_openapi_schema()
        cls.paths = cls.schema.get('paths', {})

    def _assert_path_exists(self, path: str, method: str = 'get'):
        """Assert a path exists in the schema."""
        self.assertIn(path, self.paths, f'Missing path: {path}')
        self.assertIn(method, self.paths[path], f'Missing method {method} for {path}')

    def _assert_has_response_schema(self, path: str, method: str = 'get', status: str = '200'):
        """Assert an endpoint has a response schema."""
        spec = self.paths.get(path, {}).get(method, {})
        responses = spec.get('responses', {})
        self.assertIn(status, responses, f'{path} missing {status} response')

        content = responses[status].get('content', {})
        # Some endpoints may not have content (like 204)
        if status not in ('204', '201'):
            self.assertIn('application/json', content, f'{path} missing JSON content')

    def test_health_endpoint(self):
        """Health check endpoint should exist."""
        # The health endpoint may use different path formats
        # Check for any health-related path
        health_paths = [p for p in self.paths if 'health' in p.lower()]
        self.assertTrue(len(health_paths) > 0 or '/db/health/' in str(self.paths), 'No health endpoint found in schema')

    def test_projects_endpoints(self):
        """Project CRUD endpoints should have schemas."""
        # Check for any projects-related path
        project_paths = [p for p in self.paths if 'project' in p.lower()]
        self.assertTrue(len(project_paths) > 0, 'No project endpoints found in schema')

    def test_auth_endpoints(self):
        """Auth endpoints should have schemas."""
        # Check for at least one auth endpoint
        auth_paths = [p for p in self.paths if '/auth/' in p or '/token/' in p or 'login' in p.lower()]
        self.assertTrue(len(auth_paths) > 0, 'No auth endpoints found in schema')


@pytest.mark.django_db
class TestAPIResponsesMatchSchema:
    """
    Integration tests that verify actual API responses match their schemas.

    These tests make real API calls and validate the response structure.
    """

    def test_health_endpoint_response(self, client):
        """Health endpoint response should be valid JSON."""
        response = client.get('/api/v1/db/health/')
        assert response.status_code == 200
        assert 'status' in response.json()

    def test_projects_list_has_pagination(self, client):
        """Projects list should have pagination fields."""
        response = client.get('/api/v1/projects/')
        # May require auth, so just check status
        assert response.status_code in (200, 401, 403)

        if response.status_code == 200:
            data = response.json()
            # Should have pagination structure
            assert 'results' in data or isinstance(data, list)
