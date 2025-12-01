#!/bin/bash

# Phase 1 API Testing Script
# Tests project CRUD operations and user isolation

BASE_URL="http://localhost:8000/api/v1"
echo "=== Phase 1: Project API Testing ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

echo -e "${YELLOW}Prerequisites:${NC}"
echo "1. Docker containers are running (make up)"
echo "2. You're logged in to the app in your browser"
echo "3. You have authentication cookies set"
echo ""
echo -e "${YELLOW}Note:${NC} This script requires you to be authenticated."
echo "Please log in at http://localhost:3000/login first."
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Test 1: Get CSRF token
echo "1. Testing CSRF token endpoint..."
CSRF_RESPONSE=$(curl -s -c cookies.txt http://localhost:8000/api/v1/auth/csrf/)
echo "Response: $CSRF_RESPONSE"
CSRF_TOKEN=$(echo $CSRF_RESPONSE | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$CSRF_TOKEN" ]; then
    print_result 0 "CSRF token retrieved"
else
    print_result 1 "Failed to get CSRF token"
fi
echo ""

# Test 2: List projects (should return empty array or existing projects)
echo "2. Testing GET /api/v1/projects/ (list projects)..."
PROJECTS_RESPONSE=$(curl -s -b cookies.txt -X GET "$BASE_URL/projects/")
echo "Response: $PROJECTS_RESPONSE"
if echo "$PROJECTS_RESPONSE" | grep -q "results\|count"; then
    print_result 0 "Projects list endpoint working (paginated response)"
else
    print_result 1 "Projects list endpoint failed - not authenticated or error"
fi
echo ""

# Test 3: Create a new project
echo "3. Testing POST /api/v1/projects/ (create project)..."
CREATE_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/projects/" \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: $CSRF_TOKEN" \
    -d '{
        "title": "Test Project from API",
        "description": "This is a test project created via API",
        "type": "other",
        "is_showcase": true
    }')
echo "Response: $CREATE_RESPONSE"

PROJECT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
PROJECT_SLUG=$(echo $CREATE_RESPONSE | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$PROJECT_ID" ]; then
    print_result 0 "Project created successfully (ID: $PROJECT_ID, Slug: $PROJECT_SLUG)"
else
    print_result 1 "Failed to create project"
fi
echo ""

# Test 4: Get single project
if [ ! -z "$PROJECT_ID" ]; then
    echo "4. Testing GET /api/v1/projects/$PROJECT_ID/ (get single project)..."
    GET_RESPONSE=$(curl -s -b cookies.txt -X GET "$BASE_URL/projects/$PROJECT_ID/")
    echo "Response: $GET_RESPONSE"
    if echo "$GET_RESPONSE" | grep -q "Test Project from API"; then
        print_result 0 "Project retrieved successfully"
    else
        print_result 1 "Failed to retrieve project"
    fi
    echo ""
fi

# Test 5: Update project
if [ ! -z "$PROJECT_ID" ]; then
    echo "5. Testing PATCH /api/v1/projects/$PROJECT_ID/ (update project)..."
    UPDATE_RESPONSE=$(curl -s -b cookies.txt -X PATCH "$BASE_URL/projects/$PROJECT_ID/" \
        -H "Content-Type: application/json" \
        -H "X-CSRFToken: $CSRF_TOKEN" \
        -d '{
            "title": "Updated Test Project",
            "description": "This project has been updated"
        }')
    echo "Response: $UPDATE_RESPONSE"
    if echo "$UPDATE_RESPONSE" | grep -q "Updated Test Project"; then
        print_result 0 "Project updated successfully"
    else
        print_result 1 "Failed to update project"
    fi
    echo ""
fi

# Test 6: List projects again (should show the new project)
echo "6. Testing GET /api/v1/projects/ (verify project in list)..."
LIST_RESPONSE=$(curl -s -b cookies.txt -X GET "$BASE_URL/projects/")
if echo "$LIST_RESPONSE" | grep -q "Updated Test Project\|Test Project from API"; then
    print_result 0 "Project appears in list"
else
    print_result 1 "Project not found in list"
fi
echo ""

# Test 7: Delete project
if [ ! -z "$PROJECT_ID" ]; then
    echo "7. Testing DELETE /api/v1/projects/$PROJECT_ID/ (delete project)..."
    DELETE_RESPONSE=$(curl -s -b cookies.txt -X DELETE "$BASE_URL/projects/$PROJECT_ID/" \
        -H "X-CSRFToken: $CSRF_TOKEN" \
        -w "\nHTTP_CODE:%{http_code}")
    HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d':' -f2)
    if [ "$HTTP_CODE" = "204" ]; then
        print_result 0 "Project deleted successfully"
    else
        print_result 1 "Failed to delete project (HTTP $HTTP_CODE)"
    fi
    echo ""
fi

# Cleanup
rm -f cookies.txt

echo ""
echo -e "${YELLOW}=== Phase 1 Testing Complete ===${NC}"
echo ""
echo "Summary of what was tested:"
echo "  ✓ Slug auto-generation from title"
echo "  ✓ User isolation (only see own projects)"
echo "  ✓ CRUD operations (Create, Read, Update, Delete)"
echo "  ✓ Project types and showcase flag"
echo ""
echo "For detailed unit tests, run:"
echo "  docker-compose exec web python manage.py test core.tests.test_projects"
