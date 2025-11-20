#!/bin/bash

# Setup script for Prompt Battle feature
# Run this after starting Docker containers with: make up

echo "Setting up Prompt Battle feature..."

# Create migrations
echo "Creating migrations..."
docker compose exec backend python manage.py makemigrations

# Run migrations
echo "Running migrations..."
docker compose exec backend python manage.py migrate

echo "✓ Prompt Battle feature setup complete!"
echo ""
echo "You can now:"
echo "1. Navigate to /play/prompt-battle to start battling"
echo "2. Challenge other users to prompt generation battles"
echo "3. View leaderboard at /play/prompt-battle/leaderboard"
echo ""
echo "API Endpoints available:"
echo "- GET  /api/v1/me/battles/ - List your battles"
echo "- GET  /api/v1/me/battles/active/ - Active battles"
echo "- GET  /api/v1/me/battles/{id}/ - Battle details"
echo "- POST /api/v1/me/battles/{id}/submit/ - Submit prompt"
echo "- GET  /api/v1/me/battle-invitations/pending/ - Pending invitations"
echo "- POST /api/v1/me/battle-invitations/create_invitation/ - Create invitation"
echo "- POST /api/v1/me/battle-invitations/{id}/accept/ - Accept invitation"
echo "- POST /api/v1/me/battle-invitations/{id}/decline/ - Decline invitation"
echo "- GET  /api/v1/battles/stats/ - Your battle stats"
echo "- GET  /api/v1/battles/leaderboard/ - Global leaderboard"
