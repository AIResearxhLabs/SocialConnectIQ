#!/bin/bash

# Simplified Architecture Shutdown Script

echo "=================================="
echo "🛑 Stopping Simplified Architecture"
echo "=================================="
echo ""

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo "🛑 Stopping $service_name (PID: $pid)..."
            kill $pid
            sleep 2
            
            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                echo "⚠️  Force killing $service_name..."
                kill -9 $pid
            fi
            
            echo "✅ $service_name stopped"
        else
            echo "ℹ️  $service_name not running"
        fi
        rm -f "$pid_file"
    else
        echo "ℹ️  $service_name PID file not found"
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local service_name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        echo "🛑 Stopping $service_name on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null
        echo "✅ $service_name stopped"
    fi
}

# Stop services by PID files
echo "📋 Stopping services by PID files..."
stop_service "API Gateway" "api-gateway/pids/api-gateway.pid"
stop_service "Backend Service" "backend-service/pids/backend-service.pid"
echo ""

# Backup: Stop by ports
echo "🔍 Checking for any remaining processes on ports..."
kill_port 8000 "API Gateway"
kill_port 8001 "Backend Service"
echo ""

# Clean up any zombie uvicorn processes
echo "🧹 Cleaning up any zombie processes..."
pkill -f "uvicorn.*8000" 2>/dev/null
pkill -f "uvicorn.*8001" 2>/dev/null
echo ""

echo "=================================="
echo "✅ All Services Stopped"
echo "=================================="
echo ""
echo "📝 Logs preserved in:"
echo "  📄 logs/centralized.log"
echo "  🌐 logs/api-gateway.log"
echo "  🔵 logs/backend-service.log"
echo ""
