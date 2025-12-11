#!/bin/bash

# =============================================================================
# Service Status Checker
# =============================================================================
# This script checks if all backend services are running

echo "🔍 Checking Backend Services Status..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is running on a specific port
check_service() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✅ $service_name (Port $port) - RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name (Port $port) - NOT RUNNING${NC}"
        return 1
    fi
}

# Check all services
all_running=true

check_service 8000 "API Gateway" || all_running=false
check_service 8001 "Auth Service" || all_running=false
check_service 8002 "Integration Service" || all_running=false
check_service 8003 "Scheduling Service" || all_running=false
check_service 8005 "Analytics Service" || all_running=false
check_service 8006 "Agent Service (AI)" || all_running=false
check_service 8007 "Posting Service" || all_running=false

echo ""
echo "─────────────────────────────────────────"

if [ "$all_running" = true ]; then
    echo -e "${GREEN}✅ All services are running!${NC}"
    echo ""
    echo "You can now:"
    echo "  1. Start the frontend: cd frontend && npm start"
    echo "  2. Access the app: http://localhost:3000"
    echo "  3. View API docs: http://localhost:8000/docs"
else
    echo -e "${RED}❌ Some services are not running!${NC}"
    echo ""
    echo "To start all services, run:"
    echo "  ./start-backend.sh"
fi

echo "─────────────────────────────────────────"
