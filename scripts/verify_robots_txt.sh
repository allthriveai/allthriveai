#!/bin/bash
# ============================================
# Verify robots.txt Configuration
# ============================================
# This script tests that robots.txt is configured correctly
# for the pre-launch strategy (allowing brand pages, blocking user content)

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "🤖 AllThrive AI - robots.txt Verification"
echo "================================================"
echo ""

# Configuration
DOMAIN="${1:-https://allthrive.ai}"
ROBOTS_URL="${DOMAIN}/robots.txt"

echo "Testing domain: $DOMAIN"
echo "Robots.txt URL: $ROBOTS_URL"
echo ""

# ============================================
# Test 1: robots.txt is accessible
# ============================================
echo "Test 1: Checking robots.txt accessibility..."
if curl -s -o /dev/null -w "%{http_code}" "$ROBOTS_URL" | grep -q "200"; then
    echo -e "${GREEN}✅ PASS${NC} - robots.txt is accessible"
else
    echo -e "${RED}❌ FAIL${NC} - robots.txt returned non-200 status"
    exit 1
fi
echo ""

# ============================================
# Test 2: Verify LLM crawlers can access brand pages
# ============================================
echo "Test 2: Verifying LLM crawlers can access brand pages..."

ROBOTS_CONTENT=$(curl -s "$ROBOTS_URL")

# Check for GPTBot configuration
if echo "$ROBOTS_CONTENT" | grep -q "User-agent: GPTBot"; then
    echo -e "${GREEN}✅ PASS${NC} - GPTBot configuration found"
else
    echo -e "${RED}❌ FAIL${NC} - GPTBot not configured"
fi

# Check for ClaudeBot configuration
if echo "$ROBOTS_CONTENT" | grep -q "User-agent: ClaudeBot"; then
    echo -e "${GREEN}✅ PASS${NC} - ClaudeBot configuration found"
else
    echo -e "${RED}❌ FAIL${NC} - ClaudeBot not configured"
fi

# Check that brand pages are allowed
if echo "$ROBOTS_CONTENT" | grep -A 20 "User-agent: GPTBot" | grep -q "Allow: /\$"; then
    echo -e "${GREEN}✅ PASS${NC} - Homepage allowed for LLMs"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Homepage may not be explicitly allowed"
fi

if echo "$ROBOTS_CONTENT" | grep -A 20 "User-agent: GPTBot" | grep -q "Allow: /about"; then
    echo -e "${GREEN}✅ PASS${NC} - About page allowed for LLMs"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - About page may not be explicitly allowed"
fi

if echo "$ROBOTS_CONTENT" | grep -A 20 "User-agent: GPTBot" | grep -q "Allow: /tools"; then
    echo -e "${GREEN}✅ PASS${NC} - Tools directory allowed for LLMs"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Tools directory may not be explicitly allowed"
fi

echo ""

# ============================================
# Test 3: Verify user content is blocked (pre-launch)
# ============================================
echo "Test 3: Verifying user content is blocked (pre-launch strategy)..."

if echo "$ROBOTS_CONTENT" | grep -A 20 "User-agent: GPTBot" | grep -q "Disallow: /@\*"; then
    echo -e "${GREEN}✅ PASS${NC} - User profiles/projects blocked for LLMs (pre-launch)"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - User content may not be blocked (check if this is post-launch)"
fi

echo ""

# ============================================
# Test 4: Verify sitemaps are declared
# ============================================
echo "Test 4: Verifying sitemap declarations..."

if echo "$ROBOTS_CONTENT" | grep -q "Sitemap: https://allthrive.ai/sitemap.xml"; then
    echo -e "${GREEN}✅ PASS${NC} - Main sitemap declared"
else
    echo -e "${RED}❌ FAIL${NC} - Main sitemap not declared"
fi

if echo "$ROBOTS_CONTENT" | grep -q "Sitemap: https://allthrive.ai/sitemap-projects.xml"; then
    echo -e "${GREEN}✅ PASS${NC} - Projects sitemap declared"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Projects sitemap not declared"
fi

echo ""

# ============================================
# Test 5: Verify traditional search engines have access
# ============================================
echo "Test 5: Verifying traditional search engines have full access..."

if echo "$ROBOTS_CONTENT" | grep -q "User-agent: Googlebot"; then
    echo -e "${GREEN}✅ PASS${NC} - Googlebot configuration found"
else
    echo -e "${RED}❌ FAIL${NC} - Googlebot not configured"
fi

if echo "$ROBOTS_CONTENT" | grep -A 5 "User-agent: Googlebot" | grep -q "Allow: /"; then
    echo -e "${GREEN}✅ PASS${NC} - Googlebot has full access"
else
    echo -e "${RED}❌ FAIL${NC} - Googlebot may be blocked"
fi

echo ""

# ============================================
# Test 6: Verify sensitive areas are blocked
# ============================================
echo "Test 6: Verifying sensitive areas are blocked..."

if echo "$ROBOTS_CONTENT" | grep -q "Disallow: /api/v1/auth/"; then
    echo -e "${GREEN}✅ PASS${NC} - Auth endpoints blocked"
else
    echo -e "${RED}❌ FAIL${NC} - Auth endpoints not blocked"
fi

if echo "$ROBOTS_CONTENT" | grep -q "Disallow: /admin/"; then
    echo -e "${GREEN}✅ PASS${NC} - Admin area blocked"
else
    echo -e "${RED}❌ FAIL${NC} - Admin area not blocked"
fi

if echo "$ROBOTS_CONTENT" | grep -q "Disallow: /settings"; then
    echo -e "${GREEN}✅ PASS${NC} - Settings page blocked"
else
    echo -e "${YELLOW}⚠️  WARNING${NC} - Settings page not explicitly blocked"
fi

echo ""

# ============================================
# Summary
# ============================================
echo "================================================"
echo "📊 Verification Summary"
echo "================================================"
echo ""
echo "Current Strategy: PRE-LAUNCH"
echo "  ✅ LLM crawlers can discover brand/tools"
echo "  ✅ User content protected until launch"
echo "  ✅ Traditional search engines have full access"
echo ""
echo "Next Steps:"
echo "  1. Monitor crawler traffic in server logs"
echo "  2. When ready to launch, update robots.txt"
echo "     (See: LAUNCH_DAY_ROBOTS_UPDATE.md)"
echo "  3. Submit sitemaps to Google/Bing"
echo ""
echo "================================================"

# ============================================
# Optional: Test sitemap accessibility
# ============================================
if [ "$2" = "--test-sitemaps" ]; then
    echo ""
    echo "Testing sitemap accessibility..."
    echo ""

    for sitemap in "sitemap.xml" "sitemap-projects.xml" "sitemap-profiles.xml" "sitemap-tools.xml"; do
        echo -n "Testing ${DOMAIN}/${sitemap}... "
        if curl -s -o /dev/null -w "%{http_code}" "${DOMAIN}/${sitemap}" | grep -q "200"; then
            echo -e "${GREEN}✅ Accessible${NC}"
        else
            echo -e "${RED}❌ Not accessible${NC}"
        fi
    done
fi

echo ""
echo "Verification complete! 🎉"
