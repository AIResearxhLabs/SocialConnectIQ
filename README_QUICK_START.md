# ⚡ Quick Start - LinkedIn Integration

## 🎯 Your Next Steps (In Order):

### 1️⃣ Verify Setup (30 seconds)
```bash
./scripts/verify-setup.sh
```
**Wait for:** "✅ All critical checks passed!"

---

### 2️⃣ Start Backend Services (2-3 minutes first time)
```bash
./start-backend.sh
```
**Wait for:** "✅ All services started!"

**What's Starting:**
- 🌐 API Gateway (port 8000)
- 🔐 Auth Service (port 8001)  
- 🔗 Integration Service (port 8002)
- 📅 Scheduling Service (port 8003)
- 📊 Analytics Service (port 8005)
- 🤖 **Agent Service - AI with LangGraph** (port 8006)
- 📤 Posting Service (port 8007)

---

### 3️⃣ Verify Services Running (5 seconds)
```bash
./scripts/check-services.sh
```
**Wait for:** "✅ All services are running!"

---

### 4️⃣ Start Frontend (30 seconds)
**Open a NEW terminal window:**
```bash
cd frontend
npm start
```
**Wait for:** "Compiled successfully!"

**Browser opens at:** http://localhost:3000

---

### 5️⃣ Test LinkedIn Integration (1 minute)

1. **Sign In:** Click "Sign In with Google"
2. **Go to Integrations:** Dashboard → "Manage Integrations"
3. **Connect LinkedIn:** Click "CONNECT LINKEDIN" button
4. **Authenticate:** Login in the popup window
5. **Success!** See "Successfully connected to LinkedIn!"

---

## ✅ Configuration Already Done:

Your `.env` file is configured with:
- ✅ **OPENAI_API_KEY** - Your OpenAI key is set
- ✅ **MCP_HOST_TYPE** - Set to 'local' (Docker) or 'cloud' (AWS)
- ✅ **MCP_SERVER_URL** - http://3.141.18.225:3001 (cloud)
- ✅ **MCP_LOCAL_URL** - http://localhost:3001 (local Docker)
- ✅ **AGENT_SERVICE_URL** - http://localhost:8006

**💡 MCP Server Options:**
- Local Docker: Set `MCP_HOST_TYPE=local` (requires Docker container running)
- Cloud: Set `MCP_HOST_TYPE=cloud` (connects to AWS-hosted MCP)
- See [MCP Setup Guide](./docs/MCP_SETUP_GUIDE.md) for details

---

## 🆘 If Something Goes Wrong:

### "Proxy error" in browser?
**→ Backend not running:** Run `./start-backend.sh`

### Service won't start?
**→ Check logs:**
```bash
cat services/logs/agent-service.log
cat services/logs/integration-service.log
```

### Port already in use?
**→ Kill and restart:**
```bash
lsof -i :8006  # Find process
kill -9 <PID>  # Kill it
./start-backend.sh  # Restart
```

---

## 📚 Need More Help?

- **MCP Setup Guide:** [docs/MCP_SETUP_GUIDE.md](./docs/MCP_SETUP_GUIDE.md) - Local vs Cloud MCP configuration
- **Detailed Instructions:** [STARTUP_INSTRUCTIONS.md](./STARTUP_INSTRUCTIONS.md)
- **Architecture Guide:** [docs/ai-agent-architecture.md](./docs/ai-agent-architecture.md)
- **Full Documentation:** [START_HERE.md](./START_HERE.md)

---

## 🎉 That's It!

Follow the 5 steps above and your LinkedIn integration will be working!

**Time to complete:** ~5 minutes (first time)

---

**Last Updated:** 2025-01-17
