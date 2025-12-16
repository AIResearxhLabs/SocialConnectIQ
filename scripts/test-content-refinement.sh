#!/bin/bash

# Test Content Refinement Flow
# This script tests the complete content refinement pipeline

echo "======================================================================"
echo "🧪 Testing Content Refinement Flow"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Generate correlation ID
CORR_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)")

echo "🆔 Correlation ID: $CORR_ID"
echo ""

# Test data
TEST_CONTENT="I think we should focus on improving customer service and making our product more user friendly"
TEST_USER_ID="test-user-123"
TEST_TONE="professional"

echo "📝 Test Content: $TEST_CONTENT"
echo "🎭 Tone: $TEST_TONE"
echo ""

# Step 1: Check Agent Service Health
echo "======================================================================"
echo "Step 1: Checking Agent Service Health"
echo "======================================================================"

AGENT_HEALTH=$(curl -s http://localhost:8006/health)
AGENT_STATUS=$(echo $AGENT_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$AGENT_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ Agent Service is healthy${NC}"
    echo "Response: $AGENT_HEALTH"
else
    echo -e "${RED}✗ Agent Service is not healthy${NC}"
    echo "Response: $AGENT_HEALTH"
    echo ""
    echo "⚠️  Please start Agent Service: cd services/agent-service && python -m app.main"
    exit 1
fi

echo ""

# Step 2: Check Backend Service Health
echo "======================================================================"
echo "Step 2: Checking Backend Service Health"
echo "======================================================================"

BACKEND_HEALTH=$(curl -s http://localhost:8001/health)
BACKEND_STATUS=$(echo $BACKEND_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$BACKEND_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ Backend Service is healthy${NC}"
    echo "Response: $BACKEND_HEALTH"
else
    echo -e "${YELLOW}⚠ Backend Service status: $BACKEND_STATUS${NC}"
    echo "Response: $BACKEND_HEALTH"
fi

echo ""

# Step 3: Check API Gateway Health
echo "======================================================================"
echo "Step 3: Checking API Gateway Health"
echo "======================================================================"

GATEWAY_HEALTH=$(curl -s http://localhost:8002/health)
GATEWAY_STATUS=$(echo $GATEWAY_HEALTH | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$GATEWAY_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ API Gateway is healthy${NC}"
    echo "Response: $GATEWAY_HEALTH"
else
    echo -e "${RED}✗ API Gateway is not healthy${NC}"
    echo "Response: $GATEWAY_HEALTH"
    echo ""
    echo "⚠️  Please start API Gateway: cd api-gateway && python -m app.main"
    exit 1
fi

echo ""

# Step 4: Test Content Refinement via Agent Service directly
echo "======================================================================"
echo "Step 4: Testing Agent Service Content Refinement (Direct)"
echo "======================================================================"

AGENT_RESPONSE=$(curl -s -X POST http://localhost:8006/agent/content/refine \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: $CORR_ID" \
  -d "{
    \"user_id\": \"$TEST_USER_ID\",
    \"original_content\": \"$TEST_CONTENT\",
    \"tone\": \"$TEST_TONE\"
  }")

AGENT_SUCCESS=$(echo $AGENT_RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)

if [ "$AGENT_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Agent Service refinement successful${NC}"
    echo ""
    echo "Response Preview:"
    echo "$AGENT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$AGENT_RESPONSE"
else
    echo -e "${RED}✗ Agent Service refinement failed${NC}"
    echo "Response: $AGENT_RESPONSE"
fi

echo ""

# Step 5: Test Content Refinement via Backend Service
echo "======================================================================"
echo "Step 5: Testing Backend Service Content Refinement (Proxy)"
echo "======================================================================"

BACKEND_RESPONSE=$(curl -s -X POST http://localhost:8001/api/integrations/content/refine \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $TEST_USER_ID" \
  -H "X-Correlation-ID: $CORR_ID" \
  -d "{
    \"original_content\": \"$TEST_CONTENT\",
    \"tone\": \"$TEST_TONE\"
  }")

BACKEND_SUCCESS=$(echo $BACKEND_RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)

if [ "$BACKEND_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Backend Service refinement successful${NC}"
    echo ""
    echo "Response Preview:"
    echo "$BACKEND_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BACKEND_RESPONSE"
else
    echo -e "${RED}✗ Backend Service refinement failed${NC}"
    echo "Response: $BACKEND_RESPONSE"
fi

echo ""

# Step 6: Test Content Refinement via API Gateway (Full Flow)
echo "======================================================================"
echo "Step 6: Testing API Gateway Content Refinement (Full E2E Flow)"
echo "======================================================================"

GATEWAY_RESPONSE=$(curl -s -X POST http://localhost:8002/api/integrations/content/refine \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $TEST_USER_ID" \
  -H "X-Correlation-ID: $CORR_ID" \
  -d "{
    \"original_content\": \"$TEST_CONTENT\",
    \"tone\": \"$TEST_TONE\"
  }")

GATEWAY_SUCCESS=$(echo $GATEWAY_RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)

if [ "$GATEWAY_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ API Gateway refinement successful${NC}"
    echo ""
    echo "Response Preview:"
    echo "$GATEWAY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$GATEWAY_RESPONSE"
    echo ""
    echo -e "${GREEN}======================================================================"
    echo "✅ ALL TESTS PASSED! Content Refinement is working end-to-end!"
    echo -e "======================================================================${NC}"
else
    echo -e "${RED}✗ API Gateway refinement failed${NC}"
    echo "Response: $GATEWAY_RESPONSE"
    echo ""
    echo -e "${RED}======================================================================"
    echo "❌ END-TO-END TEST FAILED"
    echo -e "======================================================================${NC}"
fi

echo ""
echo "📊 Summary:"
echo "   - Agent Service: $([ "$AGENT_SUCCESS" = "true" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
echo "   - Backend Service: $([ "$BACKEND_SUCCESS" = "true" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
echo "   - API Gateway: $([ "$GATEWAY_SUCCESS" = "true" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗${NC}")"
echo ""

# Step 7: Check logs for correlation ID
echo "======================================================================"
echo "Step 7: Checking Logs for Correlation ID: $CORR_ID"
echo "======================================================================"
echo ""

if [ -f "logs/centralized.log" ]; then
    echo "Recent log entries with correlation ID:"
    grep "$CORR_ID" logs/centralized.log | tail -20
else
    echo "⚠️  Centralized log file not found"
fi

echo ""
echo "======================================================================"
echo "🏁 Test Complete"
echo "======================================================================"
