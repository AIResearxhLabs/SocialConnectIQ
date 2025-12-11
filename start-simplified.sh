#!/bin/bash

# Simplified Architecture Startup Script
# Starts: API Gateway (8000) + Backend Service (8001)

echo "=================================="
echo "🚀 Starting Simplified Architecture"
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
echo ""

# Create logs directory if it doesn't exist
mkdir -p logs
mkdir -p backend-service/pids

# Clear old logs
echo "📝 Clearing old logs..."
> logs/centralized.log
echo ""

# Start Backend Service (Port 8001)
echo "=================================="
echo "🔵 Starting Backend Service (Port 8001)"
echo "=================================="
cd backend-service
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3.10 -m venv venv
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

# Wait for Backend Service to be ready
echo "⏳ Waiting for Backend Service to be ready..."
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

# Wait for API Gateway to be ready
echo "⏳ Waiting for API Gateway to be ready..."
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
echo "  🌐 API Gateway:      http://localhost:8000  (PID: $GATEWAY_PID)"
echo "  🔵 Backend Service:  http://localhost:8001  (PID: $BACKEND_PID)"
echo ""
echo "📖 API Documentation:"
echo "  🌐 Gateway Docs:     http://localhost:8000/docs"
echo "  🔵 Backend Docs:     http://localhost:8001/docs"
echo ""
echo "🔍 Health Checks:"
echo "  🌐 Gateway Health:   http://localhost:8000/health"
echo "  🔵 Backend Health:   http://localhost:8001/health"
echo ""
echo "📝 Logs:"
echo "  📄 Centralized:      logs/centralized.log"
echo "  🌐 API Gateway:      logs/api-gateway.log"
echo "  🔵 Backend Service:  logs/backend-service.log"
echo ""
echo "🔧 Useful Commands:"
echo "  View logs:           tail -f logs/centralized.log"
echo "  Stop services:       ./stop-simplified.sh"
echo "  Check processes:     ps aux | grep uvicorn"
echo ""
echo "=================================="
