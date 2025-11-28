#!/bin/bash
# Local test runner script
# Usage: ./run_tests.sh [test_path]
# Example: ./run_tests.sh core.integrations.tests.test_views
# Example: ./run_tests.sh  (runs all tests)

set -e

# Activate virtual environment
source .venv/bin/activate

# Set local environment variables
export DATABASE_URL=postgresql://allthrive:allthrive@localhost:5432/allthrive_ai
export REDIS_URL=redis://localhost:6379/1
export CACHE_URL=redis://localhost:6379/2
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Run tests
if [ -z "$1" ]; then
    echo "Running all tests..."
    python manage.py test --verbosity=2
else
    echo "Running tests: $@"
    python manage.py test "$@" --verbosity=2
fi
