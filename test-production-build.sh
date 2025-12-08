#!/bin/bash
set -e

cd "$(dirname "$0")/frontend"

echo "🧹 Cleaning previous build..."
rm -rf dist

echo ""
echo "🏗️  Building with PRODUCTION settings..."
echo ""

# Build with production-like settings
# Change VITE_API_URL to your actual backend URL when you know it
VITE_API_URL="${VITE_API_URL:-}" \
VITE_STRIPE_PUBLISHABLE_KEY="${VITE_STRIPE_PUBLISHABLE_KEY:-pk_test_51SRHayBnAbDWmrzEEFXhnahaxEpUqImZcMmz6yCIVORqh1xgr58HI01jIzHndsXcIwWu27Tb32H5mdF3sF23f7SD00BQLvTjLE}" \
VITE_POSTHOG_KEY="${VITE_POSTHOG_KEY:-phc_ryUlcqRl3zDmGYzwAVZNcVhEokNBUbl0yY7maxSyAZL}" \
VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
VITE_SENTRY_ENVIRONMENT="production" \
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build output:"
ls -lah dist/ | head -15
echo ""
echo "📦 Total size:"
du -sh dist/
echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "To deploy to S3:"
echo "  aws s3 sync dist/ s3://allthrive-frontend-production-953072364000/ --delete"
echo ""
echo "To invalidate CloudFront:"
echo "  aws cloudfront create-invalidation --distribution-id EKZ5JJZGFJQ33 --paths '/*'"
echo ""
echo "Then visit: https://d3act4flifl35n.cloudfront.net"
