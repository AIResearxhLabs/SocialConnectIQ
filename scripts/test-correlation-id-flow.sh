#!/bin/bash

# Test script to verify correlation ID flow and MCP logging
# This script tests the complete request flow and verifies logging

echo "======================================================================================================"
echo "🧪 Correlation ID Flow & MCP Logging Test"
echo "======================================================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Check all services are running
echo "📋 Test 1: Checking Service Status"
echo "------------------------------------------------------------------------------------------------------"

services=(
    "8000:API Gateway"
    "8001:Backend Service"
    "8002:Integration Service"
    "8006:Agent Service"
)

all_running=true
for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service##*:}"
    
    if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name (port $port) - Running${NC}"
    else
        echo -e "${RED}❌ $name (port $port) - Not Running${NC}"
        all_running=false
    fi
done

if [ "$all_running" = false ]; then
    echo -e "\n${RED}❌ Not all services are running. Please start all services first.${NC}"
    exit 1
fi

echo ""

# Test 2: Generate a unique correlation ID and make a request
echo "📋 Test 2: Testing Correlation ID Propagation"
echo "------------------------------------------------------------------------------------------------------"

# Generate unique correlation ID
CORRELATION_ID="test-$(date +%s)-$(uuidgen | cut -d'-' -f1)"
USER_ID="test_user_$(date +%s)"

echo "🆔 Generated Correlation ID: $CORRELATION_ID"
echo "👤 Generated User ID: $USER_ID"
echo ""

# Make request to API Gateway
echo "📤 Sending request to API Gateway (http://localhost:8000)..."
RESPONSE=$(curl -s -w "\n%{http_code}\n%{header_json}" \
    -X POST "http://localhost:8000/api/integrations/linkedin/auth" \
    -H "Content-Type: application/json" \
    -H "X-User-ID: $USER_ID" \
    -H "X-Correlation-ID: $CORRELATION_ID" \
    2>&1)

HTTP_CODE=$(echo "$RESPONSE" | tail -2 | head -1)
HEADERS=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Request successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Request failed (HTTP $HTTP_CODE)${NC}"
fi

# Check if correlation ID is in response headers
RESPONSE_CORRELATION=$(echo "$HEADERS" | jq -r '.["x-correlation-id"] // .["X-Correlation-ID"] // "not-found"' 2>/dev/null)
if [ "$RESPONSE_CORRELATION" = "$CORRELATION_ID" ]; then
    echo -e "${GREEN}✅ Correlation ID returned in response headers${NC}"
else
    echo -e "${YELLOW}⚠️  Correlation ID in response: $RESPONSE_CORRELATION${NC}"
fi

echo ""

# Test 3: Wait for logs to be written
echo "📋 Test 3: Checking Log Files"
echo "------------------------------------------------------------------------------------------------------"
echo "⏳ Waiting 2 seconds for logs to be written..."
sleep 2

# Check centralized log
echo ""
echo "🔍 Searching centralized log for correlation ID..."
CENTRAL_LOG_ENTRIES=$(grep "$CORRELATION_ID" logs/centralized.log 2>/dev/null | wc -l | tr -d ' ')

if [ "$CENTRAL_LOG_ENTRIES" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $CENTRAL_LOG_ENTRIES entries in centralized.log${NC}"
    
    # Show which services logged
    echo ""
    echo "📊 Services that logged this request:"
    grep "$CORRELATION_ID" logs/centralized.log | jq -r '.service' 2>/dev/null | sort -u | while read service; do
        count=$(grep "$CORRELATION_ID" logs/centralized.log | jq -r "select(.service == \"$service\") | .service" 2>/dev/null | wc -l | tr -d ' ')
        echo -e "   ${GREEN}✓${NC} $service ($count log entries)"
    done
else
    echo -e "${RED}❌ No entries found in centralized.log${NC}"
fi

# Check MCP interactions log
echo ""
echo "🔍 Checking MCP interactions log..."
if [ -f "logs/mcp-interactions.log" ]; then
    MCP_LOG_ENTRIES=$(grep "$CORRELATION_ID" logs/mcp-interactions.log 2>/dev/null | wc -l | tr -d ' ')
    if [ "$MCP_LOG_ENTRIES" -gt 0 ]; then
        echo -e "${GREEN}✅ Found MCP interactions in logs/mcp-interactions.log${NC}"
        echo "   📊 Log entries: $MCP_LOG_ENTRIES"
    else
        echo -e "${YELLOW}⚠️  MCP interactions log exists but no entries for this correlation ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  MCP interactions log file not created yet${NC}"
    echo "   📝 This file is created on the first MCP tool invocation"
fi

# Check agent service log
echo ""
echo "🔍 Checking agent service log..."
if [ -f "logs/agent-service.log" ]; then
    AGENT_LOG_ENTRIES=$(grep "$CORRELATION_ID" logs/agent-service.log 2>/dev/null | wc -l | tr -d ' ')
    if [ "$AGENT_LOG_ENTRIES" -gt 0 ]; then
        echo -e "${GREEN}✅ Found $AGENT_LOG_ENTRIES entries in agent-service.log${NC}"
    else
        echo -e "${YELLOW}⚠️  Agent service log exists but no entries for this correlation ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Agent service log file not found${NC}"
fi

echo ""

# Test 4: Show sample log entries
echo "📋 Test 4: Sample Log Entries"
echo "------------------------------------------------------------------------------------------------------"

echo "📄 Centralized Log (last 5 entries for this correlation ID):"
echo ""
grep "$CORRELATION_ID" logs/centralized.log 2>/dev/null | tail -5 | jq -r '[.timestamp, .service, .level, .message] | @tsv' 2>/dev/null | while IFS=$'\t' read -r timestamp service level message; do
    case "$level" in
        "SUCCESS") emoji="✅";;
        "ERROR") emoji="❌";;
        "WARNING") emoji="⚠️";;
        *) emoji="ℹ️";;
    esac
    echo "   $emoji [$timestamp] [$service] $message"
done

echo ""

# Test 5: Debug endpoints
echo "📋 Test 5: Testing Debug Endpoints"
echo "------------------------------------------------------------------------------------------------------"

echo "🔍 Testing Agent Service debug endpoint..."
DEBUG_RESPONSE=$(curl -s "http://localhost:8006/debug/connection-test")
MCP_STATUS=$(echo "$DEBUG_RESPONSE" | jq -r '.status // "unknown"')

if [ "$MCP_STATUS" = "success" ]; then
    TOOLS_COUNT=$(echo "$DEBUG_RESPONSE" | jq -r '.available_tools | length')
    echo -e "${GREEN}✅ Agent Service can connect to MCP server${NC}"
    echo "   📊 Available MCP tools: $TOOLS_COUNT"
else
    echo -e "${RED}❌ Agent Service cannot connect to MCP server${NC}"
fi

echo ""

# Final Summary
echo "======================================================================================================"
echo "📊 Test Summary"
echo "======================================================================================================"
echo ""

if [ "$all_running" = true ] && [ "$HTTP_CODE" = "200" ] && [ "$CENTRAL_LOG_ENTRIES" -gt 0 ]; then
    echo -e "${GREEN}✅ CORRELATION ID FLOW: WORKING${NC}"
    echo ""
    echo "Summary:"
    echo "  ✅ All services running"
    echo "  ✅ Request successful"
    echo "  ✅ Correlation ID propagated"
    echo "  ✅ Centralized logging working"
    
    if [ -f "logs/mcp-interactions.log" ] && [ "$MCP_LOG_ENTRIES" -gt 0 ]; then
        echo "  ✅ MCP interactions logged"
    else
        echo -e "  ${YELLOW}⚠️  MCP interactions log not yet created${NC}"
        echo "     (Will be created on first MCP tool invocation)"
    fi
else
    echo -e "${YELLOW}⚠️  CORRELATION ID FLOW: PARTIAL${NC}"
    echo ""
    echo "Issues detected:"
    [ "$all_running" = false ] && echo "  ❌ Not all services running"
    [ "$HTTP_CODE" != "200" ] && echo "  ❌ Request failed (HTTP $HTTP_CODE)"
    [ "$CENTRAL_LOG_ENTRIES" -eq 0 ] && echo "  ❌ No centralized log entries"
fi

echo ""
echo "📚 Documentation:"
echo "  - Full Guide: docs/ENHANCED_LOGGING_GUIDE.md"
echo "  - Correlation ID: docs/CORRELATION_ID_IMPLEMENTATION_COMPLETE.md"
echo ""
echo "🔍 View logs:"
echo "  - Centralized: tail -f logs/centralized.log | jq ."
echo "  - MCP: tail -f logs/mcp-interactions.log"
echo "  - Search by ID: grep \"$CORRELATION_ID\" logs/centralized.log | jq ."
echo ""
echo "======================================================================================================"
