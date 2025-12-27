"""
API Contract Testing

This module provides tools for validating API responses against the OpenAPI schema.
Contract tests ensure that API responses match their documented format, preventing
breaking changes from shipping to production.

Usage:
    from core.tests.contracts import APIContractTestCase

    class ProjectAPIContractTest(APIContractTestCase):
        def test_list_projects_matches_schema(self):
            response = self.client.get('/api/v1/projects/')
            self.assertMatchesSchema(response, 'ProjectList')
"""

from .base import APIContractTestCase, validate_response_schema

__all__ = ['APIContractTestCase', 'validate_response_schema']
