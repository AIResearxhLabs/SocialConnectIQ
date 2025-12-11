#!/bin/bash

# Test script to verify LinkedIn OAuth fix
# Tests the complete flow from integration-service through agent-service to MCP server

set -e

echo "======================================================================"
echo "LinkedIn OAuth Fix - End-to-End Test"
echo "======================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INTEGRATION_SERVICE="http://localhost:8002"
AGENT_SERVICE="http://localhost:8006"
MCP_SERVER="http://localhost:3001"
TEST_USER_ID="test-user-$(date +%s)"

echo "Configuration:"
echo "  Integration Service: $INTEGRATION_SERVICE"
echo "  Agent Service: $AGENT_SERVICE"
echo "  MCP Server: $MCP_SERVER"
echo "  Test User ID: $TEST_USER_ID"
echo ""

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        exit 1
    fi
}

# Test 1: Check MCP Server is running and returns tools
echo "======================================================================"
echo "Test 1: Verify MCP Server Tools"
echo "======================================================================"
MCP_TOOLS_RESPONSE=$(curl -s "$MCP_SERVER/mcp/tools")
echo "$MCP_TOOLS_RESPONSE" | jq '.' > /dev/null 2>&1
print_result $? "MCP server tools endpoint returns valid JSON"

# Check if getLinkedInAuthUrl tool exists
echo "$MCP_TOOLS_RESPONSE" | jq -e '.[] | select(.name == "getLinkedInAuthUrl")' > /dev/null
print_result $? "getLinkedInAuthUrl tool exists in MCP server"

# Check if callbackUrl parameter exists in schema
echo "$MCP_TOOLS_RESPONSE" | jq -e '.[] | select(.name == "getLinkedInAuthUrl") | .inputSchema.properties.callbackUrl' > /dev/null
print_result $? "callbackUrl parameter exists in getLinkedInAuthUrl schema"

# Check if exchangeLinkedInAuthCode tool exists
echo "$MCP_TOOLS_RESPONSE" | jq -e '.[] | select(.name == "exchangeLinkedInAuthCode")' > /dev/null
print_result $? "exchangeLinkedInAuthCode tool exists in MCP server"

echo ""

# Test 2: Check Agent Service health
echo "======================================================================"
echo "Test 2: Verify Agent Service Health"
echo "======================================================================"
AGENT_HEALTH_RESPONSE=$(curl -s "$AGENT_SERVICE/health")
AGENT_STATUS=$(echo "$AGENT_HEALTH_RESPONSE" | jq -r '.status')
if [ "$AGENT_STATUS" == "healthy" ]; then
    print_result 0 "Agent Service is healthy"
else
    print_result 1 "Agent Service health check failed: $AGENT_STATUS"
fi

AVAILABLE_TOOLS=$(echo "$AGENT_HEALTH_RESPONSE" | jq -r '.available_tools')
echo "  Available MCP tools: $AVAILABLE_TOOLS"
echo ""

# Test 3: Check Integration Service health
echo "======================================================================"
echo "Test 3: Verify Integration Service Health"
echo "======================================================================"
INTEGRATION_HEALTH_RESPONSE=$(curl -s "$INTEGRATION_SERVICE/health")
INTEGRATION_STATUS=$(echo "$INTEGRATION_HEALTH_RESPONSE" | jq -r '.status')
if [ "$INTEGRATION_STATUS" == "healthy" ]; then
    print_result 0 "Integration Service is healthy"
else
    print_result 1 "Integration Service health check failed: $INTEGRATION_STATUS"
fi
echo ""

# Test 4: Test LinkedIn Auth URL Generation (Main Fix Test)
echo "======================================================================"
echo "Test 4: Test LinkedIn Auth URL Generation (Critical Test)"
echo "======================================================================"
echo "Sending POST request to /api/integrations/linkedin/auth..."
echo "User-ID: $TEST_USER_ID"
echo ""

AUTH_RESPONSE=$(curl -s -X POST "$INTEGRATION_SERVICE/api/integrations/linkedin/auth" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $TEST_USER_ID" \
    -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$AUTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
AUTH_BODY=$(echo "$AUTH_RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response Status: $HTTP_STATUS"
echo "Response Body:"
echo "$AUTH_BODY" | jq '.' 2>/dev/null || echo "$AUTH_BODY"
echo ""

if [ "$HTTP_STATUS" == "200" ]; then
    print_result 0 "HTTP request successful (200 OK)"
    
    # Check if auth_url exists
    AUTH_URL=$(echo "$AUTH_BODY" | jq -r '.auth_url // empty')
    if [ -n "$AUTH_URL" ]; then
        print_result 0 "auth_url returned in response"
        echo "  Auth URL: ${AUTH_URL:0:100}..."
        
        # Verify it's a LinkedIn URL
        if [[ "$AUTH_URL" == *"linkedin.com"* ]]; then
            print_result 0 "auth_url is a valid LinkedIn OAuth URL"
        else
            print_result 1 "auth_url does not appear to be a LinkedIn URL"
        fi
    else
        print_result 1 "auth_url missing from response"
    fi
    
    # Check if state exists
    STATE=$(echo "$AUTH_BODY" | jq -r '.state // empty')
    if [ -n "$STATE" ]; then
        print_result 0 "OAuth state parameter returned"
        echo "  State: ${STATE:0:20}..."
    else
        print_result 1 "OAuth state parameter missing"
    fi
else
    print_result 1 "HTTP request failed with status $HTTP_STATUS"
    echo "Error details:"
    echo "$AUTH_BODY" | jq '.detail' 2>/dev/null || echo "$AUTH_BODY"
    exit 1
fi

echo ""

# Test 5: Verify Agent Service Logs
echo "======================================================================"
echo "Test 5: Verify Logging and Correlation"
echo "======================================================================"
if [ -f "services/logs/agent-service.log" ]; then
    echo "Checking recent agent service logs..."
    RECENT_LOGS=$(tail -20 services/logs/agent-service.log | grep "getLinkedInAuthUrl" || echo "")
    if [ -n "$RECENT_LOGS" ]; then
        print_result 0 "Found getLinkedInAuthUrl entries in agent service logs"
        echo "Recent log entries:"
        echo "$RECENT_LOGS" | tail -5
    else
        echo -e "${YELLOW}⚠ WARNING${NC}: No recent getLinkedInAuthUrl entries found in logs"
    fi
else
    echo -e "${YELLOW}⚠ WARNING${NC}: Agent service log file not found"
fi

echo ""

# Summary
echo "======================================================================"
echo "Test Summary"
echo "======================================================================"
echo -e "${GREEN}All critical tests passed!${NC}"
echo ""
echo "✓ MCP server is accessible and has correct tool schemas"
echo "✓ Agent service is healthy and connected to MCP server"
echo "✓ Integration service is healthy"
echo "✓ LinkedIn OAuth URL generation works correctly"
echo "✓ Response includes valid auth_url and state parameters"
echo ""
echo "The MCP callback URL parameter fix has been successfully verified."
echo ""
echo "Next steps:"
echo "1. Test the complete OAuth flow in the browser"
echo "2. Verify token exchange works with the callback"
echo "3. Monitor logs for any issues during production use"
echo ""
echo "======================================================================"
