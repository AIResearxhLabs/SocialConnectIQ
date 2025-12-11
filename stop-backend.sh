#!/bin/bash

# =============================================================================
# Backend Services Stop Script
# =============================================================================
# This script stops all running backend microservices

echo "🛑 Stopping Social Media Management Backend Services..."
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to stop a service
stop_service() {
    local service_name=$1
    local pid_file="services/pids/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${GREEN}Stopping $service_name (PID: $pid)...${NC}"
            kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null
            rm "$pid_file"
            echo -e "${GREEN}✅ $service_name stopped${NC}"
        else
            echo -e "${RED}⚠️  $service_name process not found (PID: $pid)${NC}"
            rm "$pid_file"
        fi
    else
        echo -e "${RED}⚠️  No PID file found for $service_name${NC}"
    fi
}

# Stop all services
stop_service "api-gateway"
stop_service "auth-service"
stop_service "integration-service"
stop_service "agent-service"
stop_service "scheduling-service"
stop_service "analytics-service"
stop_service "posting-service"

# Also kill any uvicorn processes that might still be running on these ports
echo ""
echo "Checking for remaining uvicorn processes..."
for port in 8000 8001 8002 8003 8004 8005 8006; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${GREEN}Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null
    fi
done

echo ""
echo "✅ All backend services stopped!"
echo ""
