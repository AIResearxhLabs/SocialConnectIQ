# SocialConnectIQ - Windows Setup Notes

## Changes Made

### 1. backend-service/requirements.txt
- Changed: `pydantic==2.6.0` → `pydantic>=2.0.0,<3.0.0`
- Reason: Strict version pin caused conflicts with other packages

### 2. api-gateway/app/main.py
- Added: `timeout=60.0` to 3 routes:
  - `/api/integrations/twitter/auth` (line ~350)
  - `/api/integrations/linkedin/auth` (line ~119)
  - `/api/integrations/linkedin/post` (line ~231)
- Reason: Cloud MCP server is slower, default timeout caused connection drops

## How to Run

### Start All Services (Windows PowerShell)
```powershell
$env:PYTHONUTF8="1"; python start-all-services.py
```

### Why PYTHONUTF8=1?
Windows uses cp1252 encoding by default. When Python runs in background mode,
emojis in print statements crash the service. PYTHONUTF8=1 forces UTF-8 encoding.

## Service URLs (after startup)
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- Backend Service: http://localhost:8001
- Integration Service: http://localhost:8002
- Agent Service: http://localhost:8006
