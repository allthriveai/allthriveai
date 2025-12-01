#!/bin/bash
# Manual Docker Sync Helper
# Use this script when Docker volume mounts aren't syncing automatically

set -e

BACKEND_CONTAINER="allthriveai_web_1"
FRONTEND_CONTAINER="allthriveai-frontend-1"
CELERY_CONTAINER="allthriveai-celery-1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

sync_backend() {
    echo -e "${YELLOW}Syncing backend files...${NC}"

    # Core Django app
    if [ -d "./core" ]; then
        echo "  - Copying core/"
        docker cp ./core "$BACKEND_CONTAINER:/app/"
    fi

    # Services
    if [ -d "./services" ]; then
        echo "  - Copying services/"
        docker cp ./services "$BACKEND_CONTAINER:/app/"
    fi

    # Config
    if [ -d "./config" ]; then
        echo "  - Copying config/"
        docker cp ./config "$BACKEND_CONTAINER:/app/"
    fi

    # Templates
    if [ -d "./templates" ]; then
        echo "  - Copying templates/"
        docker cp ./templates "$BACKEND_CONTAINER:/app/"
    fi

    # Restart backend services
    echo -e "${YELLOW}Restarting backend services...${NC}"
    docker-compose restart web celery

    echo -e "${GREEN}✓ Backend synced and restarted${NC}"
}

sync_frontend() {
    echo -e "${YELLOW}Syncing frontend files...${NC}"

    # Source files
    if [ -d "./frontend/src" ]; then
        echo "  - Copying frontend/src/"
        docker cp ./frontend/src "$FRONTEND_CONTAINER:/app/"
    fi

    # Public files
    if [ -d "./frontend/public" ]; then
        echo "  - Copying frontend/public/"
        docker cp ./frontend/public "$FRONTEND_CONTAINER:/app/"
    fi

    # Config files
    for file in vite.config.ts tsconfig.json index.html; do
        if [ -f "./frontend/$file" ]; then
            echo "  - Copying frontend/$file"
            docker cp "./frontend/$file" "$FRONTEND_CONTAINER:/app/"
        fi
    done

    echo -e "${GREEN}✓ Frontend synced (hot-reload should pick up changes)${NC}"
}

sync_file() {
    local file_path="$1"

    if [ ! -f "$file_path" ]; then
        echo -e "${RED}Error: File not found: $file_path${NC}"
        exit 1
    fi

    # Determine if it's a frontend or backend file
    if [[ "$file_path" == frontend/* ]]; then
        local container_path="/app/${file_path#frontend/}"
        echo -e "${YELLOW}Copying $file_path to frontend container...${NC}"
        docker cp "$file_path" "$FRONTEND_CONTAINER:$container_path"
        echo -e "${GREEN}✓ File synced to frontend${NC}"
    else
        local container_path="/app/$file_path"
        echo -e "${YELLOW}Copying $file_path to backend container...${NC}"
        docker cp "$file_path" "$BACKEND_CONTAINER:$container_path"
        docker-compose restart web
        echo -e "${GREEN}✓ File synced to backend and restarted${NC}"
    fi
}

sync_directory() {
    local dir_path="$1"

    if [ ! -d "$dir_path" ]; then
        echo -e "${RED}Error: Directory not found: $dir_path${NC}"
        exit 1
    fi

    # Determine if it's a frontend or backend directory
    if [[ "$dir_path" == frontend/* ]]; then
        local container_path="/app/${dir_path#frontend/}"
        echo -e "${YELLOW}Copying $dir_path to frontend container...${NC}"
        docker cp "$dir_path" "$FRONTEND_CONTAINER:$container_path"
        echo -e "${GREEN}✓ Directory synced to frontend${NC}"
    else
        local container_path="/app/$dir_path"
        echo -e "${YELLOW}Copying $dir_path to backend container...${NC}"
        docker cp "$dir_path" "$BACKEND_CONTAINER:$container_path"
        docker-compose restart web
        echo -e "${GREEN}✓ Directory synced to backend and restarted${NC}"
    fi
}

show_usage() {
    echo "Usage: $0 {backend|frontend|all|file <path>|dir <path>}"
    echo ""
    echo "Commands:"
    echo "  backend          - Sync all backend files (core, services, config, templates)"
    echo "  frontend         - Sync all frontend files (src, public, configs)"
    echo "  all              - Sync both backend and frontend"
    echo "  file <path>      - Sync a specific file"
    echo "  dir <path>       - Sync a specific directory"
    echo ""
    echo "Examples:"
    echo "  $0 backend"
    echo "  $0 file core/models.py"
    echo "  $0 file frontend/src/App.tsx"
    echo "  $0 dir services/ai_provider"
}

# Main script logic
case "$1" in
    backend)
        sync_backend
        ;;
    frontend)
        sync_frontend
        ;;
    all)
        sync_backend
        sync_frontend
        ;;
    file)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: No file path provided${NC}"
            show_usage
            exit 1
        fi
        sync_file "$2"
        ;;
    dir)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: No directory path provided${NC}"
            show_usage
            exit 1
        fi
        sync_directory "$2"
        ;;
    -h|--help|help)
        show_usage
        ;;
    *)
        echo -e "${RED}Error: Invalid command${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
