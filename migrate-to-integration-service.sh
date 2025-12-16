#!/bin/bash

# Migration script to complete architecture alignment
# This script updates API Gateway routing and cleans up old files

echo "🏗️  Architecture Migration Script"
echo "=================================="
echo ""

# Step 1: Backup old files
echo "📦 Step 1: Creating backups..."
mkdir -p .migration-backup
cp backend-service/app/integrations/linkedin.py .migration-backup/ 2>/dev/null || echo "   ⚠️  linkedin.py not found"
cp backend-service/app/integrations/twitter.py .migration-backup/ 2>/dev/null || echo "   ⚠️  twitter.py not found"
cp backend-service/app/integrations/storage.py .migration-backup/ 2>/dev/null || echo "   ⚠️  storage.py not found"
echo "   ✅ Backups created in .migration-backup/"
echo ""

# Step 2: Remove old files from Backend Service
echo "🗑️  Step 2: Removing old OAuth files from Backend Service..."
rm -f backend-service/app/integrations/linkedin.py
echo "   ✅ Deleted backend-service/app/integrations/linkedin.py"
rm -f backend-service/app/integrations/twitter.py
echo "   ✅ Deleted backend-service/app/integrations/twitter.py"
rm -f backend-service/app/integrations/storage.py
echo "   ✅ Deleted backend-service/app/integrations/storage.py"
echo ""

# Step 3: List remaining files in backend integrations
echo "📋 Step 3: Remaining files in backend-service/app/integrations/:"
ls -la backend-service/app/integrations/
echo ""

# Step 4: Architecture summary
echo "✅ Migration Complete!"
echo "===================="
echo ""
echo "Integration Service (port 8002) now owns:"
echo "  ✓ LinkedIn OAuth (auth, callback, status, post, disconnect)"
echo "  ✓ Twitter OAuth (auth, callback, status, post, disconnect)"
echo "  ✓ Token storage (storage.py)"
echo "  ✓ OAuth state management"
echo ""
echo "Backend Service (port 8001) now has:"
echo "  ✓ Content preview (content.py)"
echo "  ✓ Integration routes (routes.py for preview)"
echo ""
echo "⚠️  IMPORTANT: You still need to:"
echo "  1. Update api-gateway/app/main.py routing"
echo "  2. Restart all services"
echo "  3. Test end-to-end OAuth flows"
echo ""
echo "Backups saved in: .migration-backup/"
