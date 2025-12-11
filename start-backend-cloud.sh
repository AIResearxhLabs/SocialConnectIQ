#!/bin/bash

# =============================================================================
# Backend Services Startup Script - CLOUD MCP MODE
# =============================================================================
# This script starts all backend microservices configured for CLOUD MCP
# MCP Server: http://3.141.18.225:3001

set -e

echo "🚀 Starting Social Media Management Backend Services (CLOUD MCP MODE)..."
echo ""

# Export CLOUD MCP configuration
export MCP_HOST_TYPE=cloud
export MCP_SERVER_URL=http://3.141.18.225:3001
export MCP_LOCAL_URL=http://3.141.18.225:3001  # Fallback

echo "☁️  MCP Configuration: CLOUD (AWS Hosted)"
echo "   MCP URL: ${MCP_SERVER_URL}"
echo ""

# Load other environment variables from .env (excluding MCP_HOST_TYPE)
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^MCP_HOST_TYPE' | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "⚠️  Warning: .env file not found. Using defaults."
fi

# =============================================================================
# MCP Server Detection
# =============================================================================
echo ""
echo "🔍 Checking Cloud MCP Server..."

if command -v curl &> /dev/null; then
    if curl -s --connect-timeout 5 "${MCP_SERVER_URL}/health" > /dev/null 2>&1 || \
       curl -s --connect-timeout 5 "${MCP_SERVER_URL}/mcp/tools" > /dev/null 2>&1; then
        echo "   ✅ Cloud MCP server is accessible"
    else
        echo "   ⚠️  WARNING: Cannot reach cloud MCP server at ${MCP_SERVER_URL}"
        echo ""
        echo "   Possible issues:"
        echo "   • Check your network connection"
        echo "   • Verify cloud server is running"
        echo "   • Check firewall/security group settings"
        echo ""
        read -p "   Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "   Startup cancelled. Please check cloud MCP server status."
            exit 1
        fi
    fi
fi

echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Port $1 is already in use${NC}"
        return 1
    else
        return 0
    fi
}

# Function to setup virtual environment and install dependencies
setup_service() {
    local service_path=$1
    local service_name=$2
    
    echo -e "${GREEN}Setting up $service_name...${NC}"
    
    cd "$service_path"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "  Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    source venv/bin/activate
    
    if [ -f "requirements.txt" ]; then
        echo "  Installing dependencies..."
        pip install -q -r requirements.txt
    fi
    
    cd - > /dev/null
    echo -e "${GREEN}✅ $service_name setup complete${NC}"
}

# Function to start a service
start_service() {
    local service_path=$1
    local service_name=$2
    local port=$3
    
    echo -e "${GREEN}Starting $service_name on port $port...${NC}"
    
    cd "$service_path"
    source venv/bin/activate
    
    # Determine log and pid directories based on service path
    if [[ "$service_path" == "api-gateway" ]]; then
        local log_dir="logs"
        local pid_dir="pids"
    else
        local log_dir="../logs"
        local pid_dir="../pids"
    fi
    
    # Export MCP configuration for the service
    export MCP_HOST_TYPE=cloud
    export MCP_SERVER_URL=http://3.141.18.225:3001
    
    # Start the service in the background
    PYTHONPATH=. uvicorn app.main:app --reload --port $port --log-level info > "${log_dir}/${service_name}.log" 2>&1 &
    
    echo $! > "${pid_dir}/${service_name}.pid"
    
    cd - > /dev/null
    
    # Read PID file with correct path
    if [[ "$service_path" == "api-gateway" ]]; then
        echo -e "${GREEN}✅ $service_name started (PID: $(cat "api-gateway/pids/${service_name}.pid"))${NC}"
    else
        echo -e "${GREEN}✅ $service_name started (PID: $(cat "services/pids/${service_name}.pid"))${NC}"
    fi
}

# Create directories for logs and PIDs
mkdir -p services/logs services/pids api-gateway/logs api-gateway/pids

echo ""
echo "📦 Setting up services..."
echo ""

# Setup all services
setup_service "services/auth-service" "Auth Service"
setup_service "services/integration-service" "Integration Service"
setup_service "services/agent-service" "Agent Service"
setup_service "services/scheduling-service" "Scheduling Service"
setup_service "services/analytics-service" "Analytics Service"
setup_service "services/posting-service" "Posting Service"
setup_service "api-gateway" "API Gateway"

echo ""
echo "🚀 Starting services..."
echo ""

# Check ports before starting
echo "Checking port availability..."
check_port 8000 || echo "  API Gateway port 8000 in use"
check_port 8001 || echo "  Auth Service port 8001 in use"
check_port 8002 || echo "  Integration Service port 8002 in use"
check_port 8003 || echo "  Scheduling Service port 8003 in use"
check_port 8005 || echo "  Analytics Service port 8005 in use"
check_port 8006 || echo "  Agent Service port 8006 in use"
check_port 8007 || echo "  Posting Service port 8007 in use"

echo ""

# Start all services
start_service "services/auth-service" "auth-service" 8001
sleep 2
start_service "services/integration-service" "integration-service" 8002
sleep 2
start_service "services/agent-service" "agent-service" 8006
sleep 2
start_service "services/scheduling-service" "scheduling-service" 8003
sleep 2
start_service "services/analytics-service" "analytics-service" 8005
sleep 2
start_service "services/posting-service" "posting-service" 8007
sleep 2
start_service "api-gateway" "api-gateway" 8000

echo ""
echo "✅ All services started in CLOUD MCP MODE!"
echo ""
echo "📊 Service Status:"
echo "  API Gateway:          http://localhost:8000 (Swagger: http://localhost:8000/docs)"
echo "  Auth Service:         http://localhost:8001"
echo "  Integration Service:  http://localhost:8002"
echo "  Scheduling Service:   http://localhost:8003"
echo "  Analytics Service:    http://localhost:8005"
echo "  Agent Service:        http://localhost:8006"
echo "  Posting Service:      http://localhost:8007"
echo ""
echo "☁️  MCP Server:          http://3.141.18.225:3001 (CLOUD AWS)"
echo ""
echo "📝 Logs are available in: services/logs/"
echo "🛑 To stop services, run: ./stop-backend-cloud.sh"
echo ""
