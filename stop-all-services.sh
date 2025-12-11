#!/bin/bash

# Stop All Services Script

echo "=================================="
echo "🛑 Stopping All Services"
echo "=================================="
echo ""

# Function to kill process on port
kill_port() {
    local port=$1
    local service_name=$2
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "🛑 Stopping $service_name on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
        sleep 1
        echo "✅ $service_name stopped"
    else
        echo "ℹ️  No process found on port $port for $service_name"
    fi
}

# Stop all services
kill_port 8000 "API Gateway"
kill_port 8001 "Backend Service"
kill_port 8002 "Integration Service"
kill_port 8006 "Agent Service"

echo ""
echo "=================================="
echo "✅ All Services Stopped"
echo "=================================="
