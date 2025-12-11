#!/bin/bash

# Test Backend Service Connection
# This script verifies that the backend service is running and accessible

echo "=================================="
echo "Backend Service Connection Test"
echo "=================================="
echo ""

BACKEND_URL="http://localhost:8001"
HEALTH_ENDPOINT="$BACKEND_URL/health"
API_ENDPOINT="$BACKEND_URL/api/integrations/linkedin/status"

echo "Testing Backend Service at: $BACKEND_URL"
echo ""

# Check if backend process is running
echo "1. Checking if backend process is running..."
if ps aux | grep -v grep | grep "uvicorn.*backend-service" > /dev/null; then
    echo "   ✅ Backend process is running"
    PID=$(ps aux | grep -v grep | grep "uvicorn.*backend-service" | awk '{print $2}')
    echo "   Process ID: $PID"
else
    echo "   ❌ Backend process is NOT running"
    echo ""
    echo "   To start the backend service, run:"
    echo "   ./start-backend.sh"
    exit 1
fi
echo ""

# Check if port 8001 is listening
echo "2. Checking if port 8001 is listening..."
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   ✅ Port 8001 is listening"
else
    echo "   ❌ Port 8001 is NOT listening"
    echo ""
    echo "   The backend service may still be starting up."
    echo "   Wait a few seconds and try again."
    exit 1
fi
echo ""

# Test health endpoint
echo "3. Testing health endpoint: $HEALTH_ENDPOINT"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Health endpoint responded with 200 OK"
    RESPONSE=$(curl -s "$HEALTH_ENDPOINT")
    echo "   Response: $RESPONSE"
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️  Health endpoint returned 404 (endpoint may not exist)"
    echo "   HTTP Code: $HTTP_CODE"
    echo "   Backend is running but health endpoint is not configured."
elif [ -z "$HTTP_CODE" ]; then
    echo "   ❌ Could not connect to backend service"
    echo "   The service may not be responding on port 8001"
    exit 1
else
    echo "   ⚠️  Unexpected response code: $HTTP_CODE"
fi
echo ""

# Test CORS configuration
echo "4. Testing CORS configuration..."
CORS_RESPONSE=$(curl -s -I -X OPTIONS "$API_ENDPOINT" \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" 2>/dev/null | grep -i "access-control-allow-origin")

if [ -n "$CORS_RESPONSE" ]; then
    echo "   ✅ CORS is configured"
    echo "   $CORS_RESPONSE"
else
    echo "   ⚠️  CORS headers not detected"
    echo "   This may cause issues with frontend requests"
fi
echo ""

# Summary
echo "=================================="
echo "✅ Backend Service Test Complete"
echo "=================================="
echo ""
echo "Backend service is running and accessible at:"
echo "   $BACKEND_URL"
echo ""
echo "Next steps:"
echo "   1. Start the frontend: cd frontend && npm start"
echo "   2. Open browser to: http://localhost:3000"
echo "   3. Check browser console for API configuration messages"
echo "   4. Test LinkedIn authentication"
echo ""
