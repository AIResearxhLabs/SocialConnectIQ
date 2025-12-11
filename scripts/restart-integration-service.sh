#!/bin/bash

echo "🔄 Restarting Integration Service to apply OAuth callback fixes..."
echo ""

# Find and kill the integration service process
INTEGRATION_PID=$(cat services/pids/integration-service.pid 2>/dev/null)

if [ -n "$INTEGRATION_PID" ]; then
    echo "🛑 Stopping Integration Service (PID: $INTEGRATION_PID)..."
    kill $INTEGRATION_PID 2>/dev/null
    sleep 2
    
    # Force kill if still running
    if ps -p $INTEGRATION_PID > /dev/null 2>&1; then
        echo "⚠️  Force stopping Integration Service..."
        kill -9 $INTEGRATION_PID 2>/dev/null
    fi
    
    echo "✅ Integration Service stopped"
else
    echo "⚠️  No Integration Service PID found, may not be running"
fi

echo ""
echo "🚀 Starting Integration Service..."

# Start the integration service
cd services/integration-service

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start the service in the background
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8005 > ../logs/integration-service.log 2>&1 &
NEW_PID=$!

# Save the new PID
echo $NEW_PID > ../pids/integration-service.pid

echo "✅ Integration Service started (PID: $NEW_PID)"
echo ""
echo "📋 Checking service status..."
sleep 3

# Check if service is running
if ps -p $NEW_PID > /dev/null 2>&1; then
    echo "✅ Service is running successfully!"
    echo ""
    echo "🔍 Testing health endpoint..."
    curl -s http://localhost:8005/health | python3 -m json.tool || echo "❌ Health check failed"
else
    echo "❌ Service failed to start. Check logs:"
    echo "   tail -f services/logs/integration-service.log"
    exit 1
fi

echo ""
echo "✅ Integration Service restart complete!"
echo ""
echo "📖 Next steps:"
echo "1. Make sure frontend is running: cd frontend && npm start"
echo "2. Test OAuth flow: Go to Dashboard → Integrations"
echo "3. Click 'Connect LinkedIn' and authenticate"
echo "4. Popup should auto-close and dashboard should update!"
