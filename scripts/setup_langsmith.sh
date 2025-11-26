#!/bin/bash
# LangSmith Integration Setup Script
# Run this after getting your LANGSMITH_API_KEY from https://smith.langchain.com

set -e

echo "🚀 AllThrive AI Gateway - LangSmith Setup"
echo "==========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Please copy .env.example to .env first:"
    echo "   cp .env.example .env"
    exit 1
fi

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  Virtual environment not activated"
    echo "   Activating .venv..."
    if [ -f .venv/bin/activate ]; then
        source .venv/bin/activate
    else
        echo "❌ .venv not found. Create it first:"
        echo "   python -m venv .venv"
        echo "   source .venv/bin/activate"
        exit 1
    fi
fi

echo "📦 Installing LangSmith dependencies..."
pip install langsmith>=0.1.0 langchain-anthropic>=0.1.0 --quiet

echo "✅ Dependencies installed"
echo ""

# Check if LANGSMITH_API_KEY is set
if grep -q "^LANGSMITH_API_KEY=lsv2_pt_" .env 2>/dev/null; then
    echo "✅ LANGSMITH_API_KEY found in .env"
else
    echo "⚠️  LANGSMITH_API_KEY not configured"
    echo ""
    echo "To complete setup:"
    echo "1. Sign up at https://smith.langchain.com"
    echo "2. Create a project named 'allthrive-ai-gateway'"
    echo "3. Get your API key from Settings > API Keys"
    echo "4. Add to .env:"
    echo "   LANGSMITH_API_KEY=lsv2_pt_your_key_here"
    echo "   LANGSMITH_TRACING_ENABLED=true"
    echo ""
fi

# Check if Redis is running
echo "🔍 Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis not responding. Start it with:"
        echo "   redis-server"
        echo "   or"
        echo "   docker-compose up -d redis"
    fi
else
    echo "⚠️  redis-cli not found. Install Redis or use Docker"
fi

echo ""
echo "📋 Configuration checklist:"
echo ""
echo "Environment variables in .env:"
if grep -q "^LANGSMITH_API_KEY=" .env && ! grep -q "^LANGSMITH_API_KEY=$" .env && ! grep -q "^LANGSMITH_API_KEY=lsv2_pt_your_api_key_here" .env; then
    echo "  ✅ LANGSMITH_API_KEY"
else
    echo "  ❌ LANGSMITH_API_KEY (missing or placeholder)"
fi

if grep -q "^LANGSMITH_TRACING_ENABLED=true" .env; then
    echo "  ✅ LANGSMITH_TRACING_ENABLED"
else
    echo "  ⚠️  LANGSMITH_TRACING_ENABLED (not set to 'true')"
fi

if grep -q "^AI_COST_TRACKING_ENABLED=true" .env; then
    echo "  ✅ AI_COST_TRACKING_ENABLED"
else
    echo "  ⚠️  AI_COST_TRACKING_ENABLED (not set to 'true')"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Set LANGSMITH_API_KEY in .env (if not done)"
echo "2. Restart Django:"
echo "   python manage.py runserver"
echo "   or"
echo "   docker-compose restart backend"
echo ""
echo "3. Test the integration:"
echo "   curl http://localhost:8000/api/v1/ai/analytics/langsmith/health/ \\"
echo "        -H 'Authorization: Bearer YOUR_ADMIN_TOKEN'"
echo ""
echo "4. View traces at: https://smith.langchain.com"
echo ""
echo "📖 Full documentation:"
echo "   docs/LANGSMITH_INTEGRATION.md"
echo "   docs/AI_GATEWAY_SUMMARY.md"
echo ""
echo "✨ Setup complete! Happy tracing!"
