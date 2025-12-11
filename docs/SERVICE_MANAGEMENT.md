# 🚀 Service Management Guide

This guide explains how to start, stop, and restart all services in the application.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./start-all-services.sh` | Start all backend services |
| `./stop-all-services.sh` | Stop all backend services |
| `./restart-services.sh` | Restart all backend services |

## Services Overview

The application consists of 4 backend services:

| Service | Port | Purpose |
|---------|------|---------|
| **API Gateway** | 8000 | Main entry point, routes requests to appropriate services |
| **Backend Service** | 8001 | Core business logic, handles most API endpoints |
| **Integration Service** | 8002 | OAuth flows, token storage, social media integrations |
| **Agent Service** | 8006 | AI/LLM integration, MCP server communication |

## Starting Services

### Start All Services

```bash
./start-all-services.sh
```

This script will:
1. Clean up any existing processes on ports 8000-8002, 8006
2. Create necessary directories and clear old logs
3. Start each service in sequence with health checks
4. Display service URLs and useful commands

**Expected Output:**
```
✅ All Services Started Successfully!

📊 Service Status:
  🌐 API Gateway:         http://localhost:8000
  🔵 Backend Service:     http://localhost:8001
  🔗 Integration Service: http://localhost:8002
  🤖 Agent Service:       http://localhost:8006
```

### Start Individual Services

If you need to start a specific service:

```bash
# API Gateway
cd api-gateway && uvicorn app.main:app --host 0.0.0.0 --port 8000

# Backend Service
cd backend-service && uvicorn app.main:app --host 0.0.0.0 --port 8001

# Integration Service
cd services/integration-service && uvicorn app.main:app --host 127.0.0.1 --port 8002

# Agent Service
cd services/agent-service && uvicorn app.main:app --host 127.0.0.1 --port 8006
```

## Stopping Services

### Stop All Services

```bash
./stop-all-services.sh
```

This will gracefully stop all running services.

### Stop Individual Services

```bash
# Kill specific port
lsof -ti:8000 | xargs kill -9  # API Gateway
lsof -ti:8001 | xargs kill -9  # Backend Service
lsof -ti:8002 | xargs kill -9  # Integration Service
lsof -ti:8006 | xargs kill -9  # Agent Service
```

## Restarting Services

### Restart All Services

```bash
./restart-services.sh
```

This script:
1. Stops all services using `stop-all-services.sh`
2. Waits 2 seconds
3. Starts all services using `start-all-services.sh`

## Health Checks

Verify all services are running:

```bash
# Check API Gateway
curl http://localhost:8000/health

# Check Backend Service
curl http://localhost:8001/health

# Check Integration Service
curl http://localhost:8002/health

# Check Agent Service
curl http://localhost:8006/health
```

## Viewing Logs

### Real-time Log Viewing

```bash
# View centralized logs
tail -f logs/centralized.log

# View all service logs
tail -f logs/*.log services/logs/*.log

# View specific service logs
tail -f logs/api-gateway.log
tail -f logs/backend-service.log
tail -f services/logs/integration-service.log
tail -f services/logs/agent-service.log
```

### Log Locations

| Service | Log File |
|---------|----------|
| Centralized | `logs/centralized.log` |
| API Gateway | `logs/api-gateway.log` |
| Backend Service | `logs/backend-service.log` |
| Integration Service | `services/logs/integration-service.log` |
| Agent Service | `services/logs/agent-service.log` |

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

```bash
# Check what's using the port
lsof -i :8000  # Replace with your port number

# Kill the process
lsof -ti:8000 | xargs kill -9
```

### Service Won't Start

1. Check the service log file for errors
2. Verify all dependencies are installed
3. Ensure virtual environment is activated
4. Check environment variables in `.env` file

### Missing Dependencies

If a service fails due to missing dependencies:

```bash
# For Integration/Agent Service
cd services/integration-service  # or agent-service
source venv/bin/activate
pip install -r requirements.txt
pip install pydantic-settings  # Known required package
```

### Check Running Services

```bash
# List all Python/uvicorn processes
ps aux | grep uvicorn

# List processes on specific ports
lsof -i :8000,8001,8002,8006
```

## Development Tips

### Auto-reload on Code Changes

All services are started with `--reload` flag, so they automatically restart when code changes are detected.

### Debugging a Service

To run a service in the foreground for debugging:

```bash
cd services/integration-service
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload
# Ctrl+C to stop
```

### Environment Variables

All services load configuration from `.env` file in the project root. Key variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `MCP_SERVER_URL`
- `OPENAI_API_KEY`

## Common Workflows

### Fresh Start

```bash
./stop-all-services.sh
rm -rf logs/*.log services/logs/*.log  # Clear all logs
./start-all-services.sh
```

### After Code Changes

The services will auto-reload, but if you need a manual restart:

```bash
./restart-services.sh
```

### Before Testing OAuth Flow

Ensure all services are running:

```bash
# Quick health check
curl -s http://localhost:8000/health && \
curl -s http://localhost:8001/health && \
curl -s http://localhost:8002/health && \
curl -s http://localhost:8006/health && \
echo "✅ All services are running!"
