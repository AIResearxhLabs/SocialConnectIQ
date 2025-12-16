#!/bin/bash

# Script to restart Agent Service and refresh MCP tools cache
# This is useful when the MCP server has been updated with new tools

echo "=========================================="
echo "Refreshing Agent Service & MCP Tools Cache"
echo "=========================================="
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Stop the Agent Service
echo "1. Stopping Agent Service..."
AGENT_PID=$(cat services/pids/agent-service.pid 2>/dev/null)
if [ -n "$AGENT_PID" ]; then
    kill $AGENT_PID 2>/dev/null
    echo "   ✓ Agent Service stopped (PID: $AGENT_PID)"
    rm -f services/pids/agent-service.pid
else
    echo "   ⚠ Agent Service not running"
fi

# Wait a moment for clean shutdown
sleep 2

# Start the Agent Service
echo ""
echo "2. Starting Agent Service with fresh MCP tools cache..."
cd services/agent-service
source ../../.venv/bin/activate 2>/dev/null || echo "   Note: Virtual environment not found, using system Python"

# Start the service in the background
nohup python -m app.main > ../../logs/agent-service.log 2>&1 &
AGENT_PID=$!
echo $AGENT_PID > ../pids/agent-service.pid

echo "   ✓ Agent Service started (PID: $AGENT_PID)"
echo "   📁 Logs: logs/agent-service.log"

# Wait for service to initialize
echo ""
echo "3. Waiting for Agent Service to initialize..."
sleep 5

# Test the service health
echo ""
echo "4. Testing Agent Service health..."
HEALTH_RESPONSE=$(curl -s http://localhost:8006/health)

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✓ Agent Service is healthy"
    
    # Get tools count from response
    TOOLS_COUNT=$(echo "$HEALTH_RESPONSE" | grep -o '"available_tools":[0-9]*' | grep -o '[0-9]*')
    if [ -n "$TOOLS_COUNT" ]; then
        echo "   ✓ Discovered $TOOLS_COUNT MCP tools"
    fi
else
    echo "   ⚠ Agent Service health check failed"
    echo "   Response: $HEALTH_RESPONSE"
fi

# Optional: Call the refresh endpoint to explicitly refresh tools
echo ""
echo "5. Explicitly refreshing MCP tools cache..."
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:8006/debug/refresh-tools)

if echo "$REFRESH_RESPONSE" | grep -q "success"; then
    TOOLS_LIST=$(echo "$REFRESH_RESPONSE" | grep -o '"available_tools":\[[^]]*\]' | sed 's/"available_tools"://')
    TOOLS_COUNT=$(echo "$REFRESH_RESPONSE" | grep -o '"tools_count":[0-9]*' | grep -o '[0-9]*')
    
    echo "   ✓ Tools cache refreshed successfully"
    echo "   ✓ Available tools ($TOOLS_COUNT): $TOOLS_LIST"
else
    echo "   ⚠ Tools refresh failed"
    echo "   Response: $REFRESH_RESPONSE"
fi

echo ""
echo "=========================================="
echo "✓ Agent Service refresh complete!"
echo "=========================================="
echo ""
echo "Service Status:"
echo "  • Agent Service: http://localhost:8006"
echo "  • Health Check: http://localhost:8006/health"
echo "  • MCP Tools: http://localhost:8006/mcp/tools"
echo "  • Refresh Tools: POST http://localhost:8006/debug/refresh-tools"
echo ""
echo "View logs:"
echo "  tail -f logs/agent-service.log"
echo ""
