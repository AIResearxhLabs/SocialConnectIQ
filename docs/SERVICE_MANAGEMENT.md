# 🚀 Service Management Guide

This guide explains how to start, stop, and restart all services in the application across different operating systems.

## Quick Reference

### Cross-Platform (Recommended)

| Command | Purpose | Platforms |
|---------|---------|-----------|
| `python start-all-services.py` | Start all backend services | Windows, macOS, Linux |
| `python stop-all-services.py` | Stop all backend services | Windows, macOS, Linux |
| `./restart-services.sh` | Restart all backend services | macOS, Linux only |

### Unix/macOS Only (Legacy)

| Command | Purpose |
|---------|---------|
| `./start-all-services.sh` | Start all backend services |
| `./stop-all-services.sh` | Stop all backend services |

**Note:** Windows users must use the Python scripts (`.py` files), as shell scripts (`.sh` files) are not supported on Windows.

## Services Overview

The application consists of 4 backend services:

| Service | Port | Purpose |
|---------|------|---------|
| **API Gateway** | 8000 | Main entry point, routes requests to appropriate services |
| **Backend Service** | 8001 | Core business logic, handles most API endpoints |
| **Integration Service** | 8002 | OAuth flows, token storage, social media integrations |
| **Agent Service** | 8006 | AI/LLM integration, MCP server communication |

## Starting Services

### Prerequisites

**Install cross-platform dependencies:**
```bash
# On Windows
pip install -r requirements-scripts.txt

# On macOS/Linux
pip3 install -r requirements-scripts.txt
```

This installs:
- `psutil` - Cross-platform process management
- `colorama` - Colored terminal output on all platforms

### Start All Services (Cross-Platform)

**Windows:**
```bash
python start-all-services.py
```

**macOS/Linux:**
```bash
python3 start-all-services.py
```

This script will:
1. Detect your operating system automatically
2. Clean up any existing processes on ports 8000-8002, 8006
3. Create virtual environments if they don't exist
4. Install dependencies automatically
5. Start each service in sequence with health checks
6. Display service URLs and useful commands

**Expected Output:**
```
🚀 Starting All Services

🧹 Cleaning up existing processes...
📝 Clearing old logs...

🚀 Starting Backend Service (Port 8001)
📦 Installing dependencies from requirements.txt...
🚀 Launching Backend Service...
✅ Backend Service started (PID: 12345)
⏳ Waiting for Backend Service on port 8001...
✅ Backend Service is ready on port 8001!

[... similar output for other services ...]

✅ All Services Started Successfully!

📊 Service Status:
  • API Gateway              http://localhost:8000  (PID: 12348)
  • Backend Service          http://localhost:8001  (PID: 12345)
  • Integration Service      http://localhost:8002  (PID: 12346)
  • Agent Service            http://localhost:8006  (PID: 12347)
```

### Start All Services (Unix/macOS Shell Script)

```bash
./start-all-services.sh
```

**Note:** This only works on Unix-based systems (macOS, Linux). Windows users must use the Python script.

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

### Stop All Services (Cross-Platform)

**Windows:**
```bash
python stop-all-services.py
```

**macOS/Linux:**
```bash
python3 stop-all-services.py
```

This script will:
1. Detect your operating system automatically
2. Find all processes on the service ports
3. Attempt graceful termination first
4. Force kill if graceful shutdown times out
5. Report status for each service

**Expected Output:**
```
🛑 Stopping All Services

🛑 Stopping API Gateway on port 8000 (PID: 12348, Process: python)
✅ API Gateway stopped gracefully
🛑 Stopping Backend Service on port 8001 (PID: 12345, Process: python)
✅ Backend Service stopped gracefully
ℹ️  No process found on port 8002 for Integration Service
ℹ️  No process found on port 8006 for Agent Service

✅ All Services Stopped Successfully
```

### Stop All Services (Unix/macOS Shell Script)

```bash
./stop-all-services.sh
```

**Note:** This only works on Unix-based systems. Windows users must use the Python script.

### Stop Individual Services (Manual)

**Windows PowerShell:**
```powershell
# Find and kill process on specific port
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

**macOS/Linux:**
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

**Windows PowerShell:**
```powershell
# Check what's using the port
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**macOS/Linux:**
```bash
# Check what's using the port
lsof -i :8000  # Replace with your port number

# Kill the process
lsof -ti:8000 | xargs kill -9
```

**Or use the Python scripts which handle this automatically:**
```bash
python stop-all-services.py
python start-all-services.py
```

### Service Won't Start

1. Check the service log file for errors
2. Verify all dependencies are installed
3. Ensure virtual environment is activated
4. Check environment variables in `.env` file

### Missing Dependencies

**If script dependencies are missing:**
```bash
# Install cross-platform script dependencies
pip install -r requirements-scripts.txt
```

**If service dependencies are missing:**

The Python scripts automatically install dependencies, but if you need to do it manually:

**Windows:**
```bash
cd services\integration-service
venv\Scripts\activate
pip install -r requirements.txt
pip install pydantic-settings
```

**macOS/Linux:**
```bash
cd services/integration-service
source venv/bin/activate
pip install -r requirements.txt
pip install pydantic-settings
```

### Check Running Services

**Windows PowerShell:**
```powershell
# List all Python processes
Get-Process python

# Check specific ports
netstat -ano | findstr ":8000 :8001 :8002 :8006"
```

**macOS/Linux:**
```bash
# List all Python/uvicorn processes
ps aux | grep uvicorn

# List processes on specific ports
lsof -i :8000,8001,8002,8006
```

**Cross-Platform (using Python):**
```bash
python -c "import psutil; [print(f'Port {c.laddr.port}: PID {c.pid}') for c in psutil.net_connections() if c.laddr.port in [8000,8001,8002,8006] and c.status=='LISTEN']"
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

**Windows:**
```bash
python stop-all-services.py
del /Q logs\*.log
del /Q services\logs\*.log
python start-all-services.py
```

**macOS/Linux:**
```bash
python3 stop-all-services.py
rm -rf logs/*.log services/logs/*.log
python3 start-all-services.py
```

### After Code Changes

The services will auto-reload, but if you need a manual restart:

**Cross-Platform:**
```bash
python stop-all-services.py
python start-all-services.py
```

**Unix/macOS (Shell Script):**
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
