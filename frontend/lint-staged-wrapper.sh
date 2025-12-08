#!/bin/bash
# Wrapper script for ESLint to work with pre-commit hooks
# Takes files as arguments and runs ESLint on them

cd "$(dirname "$0")" || exit 1

# Get files relative to frontend directory
files=()
for file in "$@"; do
    # Remove 'frontend/' prefix if present
    relative_file="${file#frontend/}"
    files+=("$relative_file")
done

# Run ESLint on the specific files (only fail on errors, not warnings)
npx eslint --fix "${files[@]}"
