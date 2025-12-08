#!/bin/bash
set -e

cd "$(dirname "$0")/frontend"

echo "🏗️  Building frontend..."
npm run build

echo "📊 Build output:"
ls -lah dist/ | head -10

echo ""
echo "✅ Build successful!"
echo ""
echo "📦 Next: Deploy to S3"
echo "aws s3 sync dist/ s3://allthrive-frontend-production-953072364000/ --delete"
echo ""
echo "Then invalidate CloudFront:"
echo "aws cloudfront create-invalidation --distribution-id EKZ5JJZGFJQ33 --paths '/*'"
echo ""
echo "Visit: https://d3act4flifl35n.cloudfront.net"
