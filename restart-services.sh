#!/bin/bash

echo "=========================================="
echo "🔄 Restarting All Services"
echo "=========================================="

# Stop all services
echo ""
echo "🛑 Stopping all services..."
./stop-all-services.sh

# Wait a moment
sleep 2

# Start all services
echo ""
echo "🚀 Starting all services..."
./start-all-services.sh

echo ""
echo "=========================================="
echo "✅ All Services Restarted!"
echo "=========================================="
echo ""
echo "📍 Service URLs:"
echo "   - Frontend:             http://localhost:3000"
echo "   - API Gateway:          http://localhost:8000"
echo "   - Backend Service:      http://localhost:8001"
echo "   - Integration Service:  http://localhost:8002"
echo "   - Agent Service:        http://localhost:8006"
echo ""
echo "🔍 Use './stop-all-services.sh' to stop all services"
echo "🔍 Use './start-all-services.sh' to start all services"
echo ""
