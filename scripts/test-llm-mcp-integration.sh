#!/bin/bash

# Test script for LLM-driven MCP Integration
# Tests the complete flow from Frontend → Backend → Agent Service → MCP Server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   LLM-Driven MCP Integration Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Generate unique correlation ID for this test run
CORRELATION_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "test-$(date +%s)")
TEST_USER_ID="test-user-$(date +%s)"

echo -e "${YELLOW}Test Configuration:${NC}"
echo -e "  Correlation ID: ${CORRELATION_ID}"
echo -e "  Test User ID: ${TEST_USER_ID}"
echo ""

# Test 1: Service Health Checks
echo -e "${BLUE}[TEST 1] Checking Service Health...${NC}"

check_service() {
    local name=$1
    local url=$2
    
    if curl -s -f "${url}" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} ${name} is healthy (${url})"
        return 0
    else
        echo -e "  ${RED}✗${NC} ${name} is not responding (${url})"
        return 1
    fi
}

SERVICES_OK=true

check_service "Backend Service" "http://localhost:8001/health" || SERVICES_OK=false
check_service "Agent Service" "http://localhost:8006/health" || SERVICES_OK=false
check_service "MCP Server" "http://localhost:3001/health" || SERVICES_OK=false

if [ "$SERVICES_OK" = false ]; then
    echo -e "${RED}✗ Some services are not running. Please start all services first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All services are healthy${NC}"
echo ""

# Test 2: Verify MCP Tools Available
echo -e "${BLUE}[TEST 2] Verifying MCP Tools...${NC}"

MCP_TOOLS=$(curl -s http://localhost:3001/mcp/tools 2>/dev/null || echo "{}")

if echo "$MCP_TOOLS" | grep -q "getLinkedInAuthUrl"; then
    echo -e "  ${GREEN}✓${NC} getLinkedInAuthUrl tool is available"
else
    echo -e "  ${YELLOW}⚠${NC}  getLinkedInAuthUrl tool may not be available"
fi

echo ""

# Test 3: Agent Service Direct Test
echo -e "${BLUE}[TEST 3] Testing Agent Service Directly...${NC}"

AGENT_RESPONSE=$(curl -s -X POST http://localhost:8006/agent/linkedin/auth \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: ${CORRELATION_ID}-direct" \
  -d "{\"user_id\": \"${TEST_USER_ID}\"}" 2>/dev/null || echo "{\"success\": false, \"error\": \"Connection failed\"}")

echo "  Response: $AGENT_RESPONSE" | head -c 150
echo ""

if echo "$AGENT_RESPONSE" | grep -q '"success": *true'; then
    echo -e "  ${GREEN}✓${NC} Agent Service responded successfully"
    
    if echo "$AGENT_RESPONSE" | grep -q '"auth_url"'; then
        echo -e "  ${GREEN}✓${NC} Response contains auth_url"
    else
        echo -e "  ${YELLOW}⚠${NC}  Response missing auth_url"
    fi
else
    echo -e "  ${RED}✗${NC} Agent Service test failed"
    echo "  Error: $(echo $AGENT_RESPONSE | grep -o '"error":"[^"]*"' || echo 'Unknown error')"
fi

echo ""

# Test 4: Backend Service Integration Test
echo -e "${BLUE}[TEST 4] Testing Backend → Agent Service Integration...${NC}"

BACKEND_RESPONSE=$(curl -s -X POST http://localhost:8001/api/integrations/linkedin/auth \
  -H "Content-Type: application/json" \
  -H "X-User-ID: ${TEST_USER_ID}" \
  -H "X-Correlation-ID: ${CORRELATION_ID}-backend" 2>/dev/null || echo "{\"detail\": \"Connection failed\"}")

echo "  Response: $BACKEND_RESPONSE" | head -c 150
echo ""

if echo "$BACKEND_RESPONSE" | grep -q '"auth_url"'; then
    echo -e "  ${GREEN}✓${NC} Backend Service returned auth_url"
    
    AUTH_URL=$(echo "$BACKEND_RESPONSE" | grep -o '"auth_url":"[^"]*"' | cut -d'"' -f4)
    
    if echo "$AUTH_URL" | grep -q "linkedin.com"; then
        echo -e "  ${GREEN}✓${NC} Auth URL points to LinkedIn"
    else
        echo -e "  ${YELLOW}⚠${NC}  Auth URL may not be valid LinkedIn URL"
    fi
    
    if echo "$AUTH_URL" | grep -q "77yvmo0lqui9yg"; then
        echo -e "  ${GREEN}✓${NC} Auth URL contains correct APP_ID (77yvmo0lqui9yg)"
    else
        echo -e "  ${RED}✗${NC} Auth URL does NOT contain correct APP_ID"
        echo "  URL: $AUTH_URL"
    fi
else
    echo -e "  ${RED}✗${NC} Backend Service test failed"
    echo "  Error: $(echo $BACKEND_RESPONSE | grep -o '"detail":"[^"]*"' || echo 'Unknown error')"
fi

echo ""

# Test 5: Log Correlation Verification
echo -e "${BLUE}[TEST 5] Verifying Request Tracing in Logs...${NC}"

if [ -f "logs/centralized.log" ]; then
    # Check for direct agent test correlation ID
    DIRECT_LOGS=$(grep "${CORRELATION_ID}-direct" logs/centralized.log 2>/dev/null | wc -l || echo "0")
    
    # Check for backend test correlation ID
    BACKEND_LOGS=$(grep "${CORRELATION_ID}-backend" logs/centralized.log 2>/dev/null | wc -l || echo "0")
    
    echo "  Log entries with direct test ID: ${DIRECT_LOGS}"
    echo "  Log entries with backend test ID: ${BACKEND_LOGS}"
    
    if [ "$DIRECT_LOGS" -gt 0 ] || [ "$BACKEND_LOGS" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} Correlation IDs found in logs"
        
        # Check for key log messages
        if grep -q "Backend Service: Delegating to Agent Service" logs/centralized.log 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Found Backend→Agent delegation log"
        fi
        
        if grep -q "Agent Service: Invoking LLM-based" logs/centralized.log 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Found LLM invocation log"
        fi
        
        if grep -q "MCP Client: Calling getLinkedInAuthUrl" logs/centralized.log 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Found MCP client call log"
        fi
        
        if grep -q "LinkedInAgent: Executing get_auth_url" logs/centralized.log 2>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Found LinkedInAgent execution log"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC}  No correlation IDs found in logs (logs may not be configured)"
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  Centralized log file not found at logs/centralized.log"
fi

echo ""

# Test 6: LLM Integration Verification
echo -e "${BLUE}[TEST 6] Verifying LLM Integration...${NC}"

if [ -f "logs/centralized.log" ]; then
    # Check for LLM-related log entries
    LLM_LOGS=$(grep -c "LLM analyzing\|AI Analysis\|LinkedInAgent" logs/centralized.log 2>/dev/null || echo "0")
    
    if [ "$LLM_LOGS" -gt 0 ]; then
        echo -e "  ${GREEN}✓${NC} Found ${LLM_LOGS} LLM-related log entries"
    else
        echo -e "  ${YELLOW}⚠${NC}  No LLM integration logs found (may need recent test)"
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  Cannot verify LLM integration without logs"
fi

echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Correlation ID for tracing: ${YELLOW}${CORRELATION_ID}${NC}"
echo ""
echo "To view detailed logs for this test run:"
echo -e "  ${YELLOW}grep \"${CORRELATION_ID}\" logs/centralized.log${NC}"
echo ""
echo "To test manually in the frontend:"
echo "  1. Open http://localhost:3000"
echo "  2. Go to Integrations page"
echo "  3. Click 'Connect LinkedIn'"
echo "  4. Check browser console and backend logs"
echo ""
echo -e "${GREEN}✓ Test suite completed${NC}"
