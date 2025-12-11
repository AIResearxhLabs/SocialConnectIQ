# 🚀 Quick Start Guide - Social Media Management Application

This guide will help you start the application in the correct order with clear steps.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- ✅ Python 3.8 or higher installed
- ✅ Node.js 14 or higher installed
- ✅ npm installed
- ✅ OpenAI API key
- ✅ Firebase credentials

---

## 🔧 Step 1: Configure Environment Variables

### Create/Update `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use any text editor
```

### Required variables in `.env`:

```bash
# OpenAI API Key (REQUIRED for AI Agent)
OPENAI_API_KEY=sk-proj-...

# MCP Server URL (REQUIRED)
MCP_SERVER_URL=http://3.141.18.225:3001

# Agent Service URL (REQUIRED)
AGENT_SERVICE_URL=http://localhost:8006

# Firebase Credentials (REQUIRED)
FIREBASE_PROJECT_ID=prjsyntheist
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@prjsyntheist.iam.gserviceaccount.com

# JWT Secret (REQUIRED)
JWT_SECRET=your-secret-key-here-change-in-production
```

---

## 🎯 Step 2: Start Backend Services

### Option A: Use the automated script (Recommended)

```bash
# Make the script executable
chmod +x start-backend.sh

# Run the startup script
./start-backend.sh
```

**This will:**
- ✅ Create virtual environments for each service
- ✅ Install all Python dependencies
- ✅ Start 7 microservices on different ports
- ✅ Create log files in `services/logs/`

**Wait for the message:** "✅ All services started!"

### Option B: Manual startup (if script fails)

See [MANUAL_STARTUP.md](./MANUAL_STARTUP.md) for manual instructions.

---

## ✅ Step 3: Verify Backend Services

Check that all services are running:

```bash
# Check all service ports
./scripts/check-services.sh
```

Or manually check each port:
```bash
lsof -i :8000  # API Gateway
lsof -i :8002  # Integration Service
lsof -i :8006  # Agent Service (AI)
```

**Test health endpoints:**
```bash
curl http://localhost:8000/health  # API Gateway
curl http://localhost:8006/health  # Agent Service
curl http://localhost:8002/health  # Integration Service
```

---

## 🌐 Step 4: Start Frontend

In a **new terminal window**:

```bash
cd frontend
npm install  # First time only
npm start
```

**Wait for the message:** "Compiled successfully!"

**Frontend will open at:** http://localhost:3000

---

## 🔗 Step 5: Test LinkedIn Integration

1. Open browser: http://localhost:3000
2. Sign in with Google
3. Navigate to: **Dashboard → Integrations**
4. Click: **"CONNECT LINKEDIN"**
5. A popup will open for LinkedIn authentication
6. Log in to LinkedIn and authorize
7. Popup will close and show success message

---

## 📊 Service Ports Reference

| Service | Port | Purpose |
|---------|------|---------|
| **Frontend** | 3000 | React UI |
| **API Gateway** | 8000 | Entry point for all API requests |
| **Auth Service** | 8001 | User authentication |
| **Integration Service** | 8002 | OAuth & token management |
| **Scheduling Service** | 8003 | Post scheduling |
| **Analytics Service** | 8005 | Analytics data |
| **Agent Service** | 8006 | **AI Agent (LangGraph + OpenAI)** |
| **Posting Service** | 8007 | Social media posting |

---

## 🛑 Stopping the Application

### Stop Backend Services:
```bash
./stop-backend.sh
```

### Stop Frontend:
Press `Ctrl+C` in the terminal running npm

---

## 📝 Viewing Logs

Backend service logs are stored in:
```bash
services/logs/api-gateway.log
services/logs/integration-service.log
services/logs/agent-service.log
# ... etc
```

**View logs:**
```bash
tail -f services/logs/agent-service.log
```

---

## 🐛 Troubleshooting

### Issue: "Backend services not running"
**Solution:** Run `./start-backend.sh`

### Issue: "Port already in use"
**Solution:** 
```bash
# Find what's using the port
lsof -i :8000
# Kill the process
kill -9 <PID>
```

### Issue: "OPENAI_API_KEY not found"
**Solution:** Check your `.env` file has the correct API key

### Issue: "MCP Server unreachable"
**Solution:** Verify MCP_SERVER_URL=http://3.141.18.225:3001 in `.env`

### Issue: "Agent service won't start"
**Solution:**
```bash
cd services/agent-service
source venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Firebase authentication failed"
**Solution:** Verify Firebase credentials in `.env`

---

## 🔍 Verify Installation

Run the verification script:
```bash
./scripts/verify-setup.sh
```

This checks:
- ✅ Python version
- ✅ Node.js version
- ✅ Environment variables
- ✅ Service connectivity
- ✅ MCP server reachability

---

## 📚 Additional Documentation

- [AI Agent Architecture](./docs/ai-agent-architecture.md) - Complete technical documentation
- [LinkedIn Integration Guide](./docs/linkedin-integration-guide.md) - OAuth flow details
- [API Documentation](http://localhost:8000/docs) - Swagger UI (when services running)

---

## ⚡ Quick Command Reference

```bash
# Start everything
./start-backend.sh && cd frontend && npm start

# Stop everything
./stop-backend.sh

# Check service status
./scripts/check-services.sh

# View logs
tail -f services/logs/*.log

# Restart a single service
kill -9 $(lsof -t -i:8006)  # Kill agent service
cd services/agent-service && source venv/bin/activate && uvicorn app.main:app --reload --port 8006
```

---

## 🎉 Success Indicators

You'll know everything is working when:
1. ✅ All 7 backend services show "healthy" status
2. ✅ Frontend loads without errors
3. ✅ You can sign in with Google
4. ✅ Dashboard shows metrics
5. ✅ Integration page shows LinkedIn/Facebook/Twitter cards
6. ✅ Clicking "CONNECT LINKEDIN" opens a popup
7. ✅ After LinkedIn auth, you see "Successfully connected to LinkedIn!"

---

**Need Help?** Check the troubleshooting section or review the logs in `services/logs/`

**Last Updated:** 2025-01-17
