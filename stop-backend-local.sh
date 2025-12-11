#!/bin/bash

# =============================================================================
# Backend Services Stop Script - LOCAL MCP MODE
# =============================================================================
# This script stops all backend microservices started with start-backend-local.sh

echo "🛑 Stopping Social Media Management Backend Services (LOCAL MCP MODE)..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $service_name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
            rm "$pid_file"
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️  $service_name not running (stale PID file)${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  No PID file for $service_name${NC}"
    fi
}

# Stop all services
stop_service "API Gateway" "api-gateway/pids/api-gateway.pid"
stop_service "Auth Service" "services/pids/auth-service.pid"
stop_service "Integration Service" "services/pids/integration-service.pid"
stop_service "Agent Service" "services/pids/agent-service.pid"
stop_service "Scheduling Service" "services/pids/scheduling-service.pid"
stop_service "Analytics Service" "services/pids/analytics-service.pid"
stop_service "Posting Service" "services/pids/posting-service.pid"

echo ""
echo "✅ All services stopped!"
echo ""
echo "💡 Note: Your local MCP Docker container is still running."
echo "   To stop it: docker stop mcpsocial"
echo ""
