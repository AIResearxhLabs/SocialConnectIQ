# 🎯 Step-by-Step Startup Instructions

Follow these exact steps to start the Social Media Management Application with LinkedIn integration.

---

## 📍 Current Location
Make sure you're in the project root directory:
```bash
pwd
# Should show: /Users/I050232/Documents/airesearchlabsprivate/LoginAlternatives
```

---

## ✅ STEP 1: Verify Your Setup

Run the verification script:
```bash
./scripts/verify-setup.sh
```

**Expected Output:**
```
🔍 Verifying System Setup...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Checking Python...
✅ Python 3.x.x

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. Checking Node.js...
✅ Node.js vX.X.X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. Checking npm...
✅ npm X.X.X

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. Checking .env file...
✅ .env file exists
   ✅ OPENAI_API_KEY is set
   ✅ MCP_SERVER_URL: http://3.141.18.225:3001
   ✅ FIREBASE_PROJECT_ID is set

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
✅ All critical checks passed!
```

**If you see any ❌ errors:** Fix them before proceeding.

---

## ✅ STEP 2: Start Backend Services

```bash
./start-backend.sh
```

**What This Does:**
1. Creates Python virtual environments for each service
2. Installs all required dependencies (including LangGraph, OpenAI)
3. Starts 7 microservices:
   - API Gateway (port 8000)
   - Auth Service (port 8001)
   - Integration Service (port 8002)
   - Scheduling Service (port 8003)
   - Analytics Service (port 8005)
   - **Agent Service (port 8006)** ← AI Agent with LangGraph
   - Posting Service (port 8007)

**Expected Output (at the end):**
```
✅ All services started!

📊 Service Status:
  API Gateway:          http://localhost:8000 (Swagger: http://localhost:8000/docs)
  Auth Service:         http://localhost:8001
  Integration Service:  http://localhost:8002
  Scheduling Service:   http://localhost:8003
  Analytics Service:    http://localhost:8005
  Agent Service:        http://localhost:8006
  Posting Service:      http://localhost:8007

📝 Logs are available in: services/logs/
```

**⏱️ First Run:** This may take 2-3 minutes to install all dependencies.

**⚠️ If services fail to start:** Check the logs:
```bash
cat services/logs/agent-service.log
cat services/logs/integration-service.log
```

---

## ✅ STEP 3: Verify Services Are Running

```bash
./scripts/check-services.sh
```

**Expected Output:**
```
🔍 Checking Backend Services Status...

✅ API Gateway (Port 8000) - RUNNING
✅ Auth Service (Port 8001) - RUNNING
✅ Integration Service (Port 8002) - RUNNING
✅ Scheduling Service (Port 8003) - RUNNING
✅ Analytics Service (Port 8005) - RUNNING
✅ Agent Service (AI) (Port 8006) - RUNNING
✅ Posting Service (Port 8007) - RUNNING

─────────────────────────────────────────
✅ All services are running!
```

**If any service shows ❌ NOT RUNNING:** Check its log file:
```bash
cat services/logs/[service-name].log
```

---

## ✅ STEP 4: Test Backend Health

Test that services can communicate:

```bash
# Test API Gateway
curl http://localhost:8000/health

# Test Agent Service (AI)
curl http://localhost:8006/health

# Test Integration Service
curl http://localhost:8002/health
```

**Expected Response (for each):**
```json
{
  "status": "healthy",
  "service": "service-name"
}
```

---

## ✅ STEP 5: Start Frontend

**Open a NEW terminal window** and run:

```bash
cd frontend
npm start
```

**Expected Output:**
```
Compiled successfully!

You can now view the app in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

**Browser should automatically open at:** http://localhost:3000

---

## ✅ STEP 6: Test LinkedIn Integration

### 6.1. Sign In
1. Go to: http://localhost:3000
2. Click "Sign In with Google"
3. Authenticate with your Google account

### 6.2. Navigate to Integrations
1. After sign in, you'll see the Dashboard with metrics
2. Click "Manage Integrations" button
3. Or navigate directly to: http://localhost:3000/dashboard/integration

### 6.3. Connect LinkedIn
1. You'll see three cards: LinkedIn, Facebook, Twitter
2. Click the **"CONNECT LINKEDIN"** button
3. A popup window will open

### 6.4. Authenticate with LinkedIn
1. Log in to your LinkedIn account in the popup
2. Authorize the application
3. The popup will close automatically

### 6.5. Verify Success
You should see:
- ✅ Success message: "Successfully connected to LinkedIn!"
- ✅ LinkedIn card shows "Connected" status with green chip
- ✅ Connection timestamp displayed
- ✅ "Disconnect" button appears

---

## 🔍 What's Happening Behind the Scenes

When you click "CONNECT LINKEDIN":

```
1. Frontend sends request to API Gateway
   ↓
2. API Gateway routes to Integration Service
   ↓
3. Integration Service calls Agent Service (AI)
   ↓
4. Agent Service (LangGraph State Machine):
   - Uses OpenAI to validate request
   - Queries MCP Server for available tools
   - Invokes getLinkedInAuthUrl tool
   ↓
5. MCP Server (AWS) generates LinkedIn OAuth URL
   ↓
6. OAuth URL returned to Frontend
   ↓
7. Popup opens with LinkedIn login
   ↓
8. User authenticates on LinkedIn
   ↓
9. LinkedIn redirects with authorization code
   ↓
10. Agent Service exchanges code for tokens
    ↓
11. Tokens saved to Firestore
    ↓
12. Success! Connection established
```

---

## 📊 Monitoring & Logs

### View Real-Time Logs:
```bash
# Watch all logs
tail -f services/logs/*.log

# Watch specific service
tail -f services/logs/agent-service.log
```

### Check Service Status:
```bash
./scripts/check-services.sh
```

---

## 🛑 Stopping the Application

### Stop Backend:
```bash
./stop-backend.sh
```

### Stop Frontend:
In the terminal running npm, press: `Ctrl+C`

---

## 🐛 Common Issues & Solutions

### Issue 1: "Backend services not running"
**Symptom:** Browser shows "Proxy error" or 500 errors
**Solution:**
```bash
./start-backend.sh
```

### Issue 2: "Port already in use"
**Symptom:** Service fails to start, says port is in use
**Solution:**
```bash
# Find and kill the process
lsof -i :8006  # Check agent service
kill -9 <PID>  # Kill the process
./start-backend.sh  # Restart
```

### Issue 3: "OPENAI_API_KEY not found"
**Symptom:** Agent service log shows API key error
**Solution:**
1. Check `.env` file has: `OPENAI_API_KEY=sk-proj-...`
2. Restart services: `./stop-backend.sh && ./start-backend.sh`

### Issue 4: "Module 'langgraph' not found"
**Symptom:** Agent service fails to start
**Solution:**
```bash
cd services/agent-service
source venv/bin/activate
pip install langgraph==0.0.20
```

### Issue 5: "MCP Server unreachable"
**Symptom:** Agent service can't connect to MCP server
**Solution:**
```bash
# Test connectivity
curl http://3.141.18.225:3001/mcp/tools

# If fails, verify MCP_SERVER_URL in .env
```

### Issue 6: "Firebase authentication failed"
**Symptom:** Integration service crashes on startup
**Solution:**
1. Verify Firebase credentials in `.env`
2. Check FIREBASE_PRIVATE_KEY has proper newlines: `\n`
3. Restart: `./stop-backend.sh && ./start-backend.sh`

---

## 📞 Quick Commands

```bash
# Complete startup sequence
./scripts/verify-setup.sh      # Verify setup
./start-backend.sh             # Start backend
./scripts/check-services.sh    # Verify services
cd frontend && npm start        # Start frontend

# Check what's running
lsof -i :8000  # API Gateway
lsof -i :8006  # Agent Service

# View logs
tail -f services/logs/agent-service.log
tail -f services/logs/integration-service.log

# Stop everything
./stop-backend.sh
# Press Ctrl+C in frontend terminal
```

---

## ✅ Success Checklist

Mark each item as you complete it:

- [ ] Ran `./scripts/verify-setup.sh` - All checks passed
- [ ] Updated `.env` with OPENAI_API_KEY
- [ ] Ran `./start-backend.sh` - All services started
- [ ] Ran `./scripts/check-services.sh` - All services running
- [ ] Started frontend with `npm start`
- [ ] Accessed http://localhost:3000
- [ ] Signed in with Google
- [ ] Navigated to Integrations page
- [ ] Clicked "CONNECT LINKEDIN"
- [ ] Popup opened successfully
- [ ] Authenticated with LinkedIn
- [ ] Saw success message
- [ ] LinkedIn shows as "Connected"

---

## 🎓 Next Steps After Successful Setup

1. **Test posting to LinkedIn** from the Composer page
2. **Explore the Dashboard** to see metrics
3. **Connect other platforms** (Facebook, Twitter will follow same pattern)
4. **Review architecture** in `docs/ai-agent-architecture.md`

---

**Questions?** Check [START_HERE.md](./START_HERE.md) or review logs in `services/logs/`

**Last Updated:** 2025-01-17
