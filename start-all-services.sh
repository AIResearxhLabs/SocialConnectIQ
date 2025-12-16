#!/bin/bash

# Complete Architecture Startup Script
# Starts: API Gateway + Backend Service + Integration Service + Agent Service

echo "=================================="
echo "🚀 Starting All Services"
echo "=================================="
echo ""

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "⚠️  Killing existing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
kill_port 8000  # API Gateway
kill_port 8001  # Backend Service
kill_port 8002  # Integration Service
kill_port 8006  # Agent Service
echo ""

# Create directories
mkdir -p logs
mkdir -p backend-service/pids
mkdir -p api-gateway/pids
mkdir -p services/pids

# Clear old logs
echo "📝 Clearing old logs..."
> logs/centralized.log
> logs/api-gateway.log
> logs/backend-service.log
> logs/integration-service.log
> logs/agent-service.log
echo ""

# Start Backend Service (Port 8001)
echo "=================================="
echo "🔵 Starting Backend Service (Port 8001)"
echo "=================================="
cd backend-service
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

echo "🚀 Launching Backend Service..."
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001 > ../logs/backend-service.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > pids/backend-service.pid
echo "✅ Backend Service started (PID: $BACKEND_PID)"
cd ..
echo ""

# Wait for Backend Service
echo "⏳ Waiting for Backend Service..."
for i in {1..30}; do
    if check_port 8001; then
        echo "✅ Backend Service is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend Service failed to start"
        exit 1
    fi
    sleep 1
done
echo ""

# Start Integration Service (Port 8002)
echo "=================================="
echo "🔗 Starting Integration Service (Port 8002)"
echo "=================================="
cd services/integration-service
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt
pip install -q pydantic-settings

echo "🚀 Launching Integration Service..."
nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload > ../logs/integration-service.log 2>&1 &
INTEGRATION_PID=$!
echo $INTEGRATION_PID > ../pids/integration-service.pid
echo "✅ Integration Service started (PID: $INTEGRATION_PID)"
cd ../..
echo ""

# Wait for Integration Service
echo "⏳ Waiting for Integration Service..."
for i in {1..30}; do
    if check_port 8002; then
        echo "✅ Integration Service is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Integration Service failed to start"
        exit 1
    fi
    sleep 1
done
echo ""

# Start Agent Service (Port 8006)
echo "=================================="
echo "🤖 Starting Agent Service (Port 8006)"
echo "=================================="
cd services/agent-service
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt
pip install -q pydantic-settings

echo "🚀 Launching Agent Service..."
nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8006 --reload > ../logs/agent-service.log 2>&1 &
AGENT_PID=$!
echo $AGENT_PID > ../pids/agent-service.pid
echo "✅ Agent Service started (PID: $AGENT_PID)"
cd ../..
echo ""

# Wait for Agent Service
echo "⏳ Waiting for Agent Service..."
for i in {1..30}; do
    if check_port 8006; then
        echo "✅ Agent Service is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Agent Service failed to start"
        exit 1
    fi
    sleep 1
done
echo ""

# Start API Gateway (Port 8000)
echo "=================================="
echo "🌐 Starting API Gateway (Port 8000)"
echo "=================================="
cd api-gateway
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

echo "🚀 Launching API Gateway..."
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../logs/api-gateway.log 2>&1 &
GATEWAY_PID=$!
echo $GATEWAY_PID > pids/api-gateway.pid
echo "✅ API Gateway started (PID: $GATEWAY_PID)"
cd ..
echo ""

# Wait for API Gateway
echo "⏳ Waiting for API Gateway..."
for i in {1..30}; do
    if check_port 8000; then
        echo "✅ API Gateway is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ API Gateway failed to start"
        exit 1
    fi
    sleep 1
done
echo ""

echo "=================================="
echo "✅ All Services Started Successfully!"
echo "=================================="
echo ""
echo "📊 Service Status:"
echo "  🌐 API Gateway:         http://localhost:8000  (PID: $GATEWAY_PID)"
echo "  🔵 Backend Service:     http://localhost:8001  (PID: $BACKEND_PID)"
echo "  🔗 Integration Service: http://localhost:8002  (PID: $INTEGRATION_PID)"
echo "  🤖 Agent Service:       http://localhost:8006  (PID: $AGENT_PID)"
echo ""
echo "📖 API Documentation:"
echo "  🌐 Gateway Docs:        http://localhost:8000/docs"
echo "  🔵 Backend Docs:        http://localhost:8001/docs"
echo "  🔗 Integration Docs:    http://localhost:8002/docs"
echo "  🤖 Agent Docs:          http://localhost:8006/docs"
echo ""
echo "🔍 Health Checks:"
echo "  🌐 Gateway:             http://localhost:8000/health"
echo "  🔵 Backend:             http://localhost:8001/health"
echo "  🔗 Integration:         http://localhost:8002/health"
echo "  🤖 Agent:               http://localhost:8006/health"
echo ""
echo "📝 Logs (Centralized in /logs):"
echo "  📄 Centralized:         logs/centralized.log"
echo "  🌐 API Gateway:         logs/api-gateway.log"
echo "  🔵 Backend Service:     logs/backend-service.log"
echo "  🔗 Integration Service: logs/integration-service.log"
echo "  🤖 Agent Service:       logs/agent-service.log"
echo ""
echo "🔧 Useful Commands:"
echo "  View centralized logs:  tail -f logs/centralized.log"
echo "  View all service logs:  tail -f logs/*.log"
echo "  Stop all services:      ./stop-all-services.sh"
echo "  Check processes:        ps aux | grep uvicorn"
echo ""
echo "=================================="
