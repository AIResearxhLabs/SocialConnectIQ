# 🚀 Quick Start Guide

## Application Status

### ✅ Currently Running
- **Frontend (React)**: Running at http://localhost:3000
  - Status: ACTIVE
  - Started via: `npm start` in frontend directory

### ⏸️ Not Yet Started
- **Backend Services**: Not running
  - 7 microservices need to be started
  - Startup script created and ready to use

---

## Next Steps to Complete Setup

### 1. Configure Required Credentials (IMPORTANT)

Edit the `.env` file in the root directory and replace placeholder values:

```bash
# CRITICAL: Update these before starting backend services
OPENAI_API_KEY=sk-proj-your-actual-key-here
FIREBASE_PROJECT_ID=your-actual-project-id
FIREBASE_PRIVATE_KEY=your-actual-private-key
FIREBASE_CLIENT_EMAIL=your-actual-client-email@project.iam.gserviceaccount.com
```

### 2. Start Backend Services

Run the automated startup script:

```bash
./start-backend.sh
```

This script will:
- Create virtual environments for each service
- Install Python dependencies automatically
- Start all 7 microservices on their respective ports
- Create log files in `services/logs/`

**Services that will start:**
- API Gateway (Port 8000) - Main entry point
- Auth Service (Port 8001) - Authentication
- Integration Service (Port 8002) - Social media OAuth
- Scheduling Service (Port 8003) - Post scheduling
- Agent Service (Port 8004) - AI Agent with GPT-4o
- Analytics Service (Port 8005) - Metrics & insights
- Posting Service (Port 8006) - Social media posting

### 3. Verify Everything is Running

Once the backend starts, check:

1. **Frontend**: http://localhost:3000
2. **API Gateway**: http://localhost:8000
3. **API Documentation**: http://localhost:8000/docs (Swagger UI)

### 4. Stop Services

When you're done:

```bash
# Stop backend services
./stop-backend.sh

# Stop frontend (in the terminal where it's running)
Ctrl+C
```

---

## Current Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│                  (http://localhost:3000)                     │
│                       ✅ RUNNING                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (8000)                        │
│                      ⏸️  NOT RUNNING                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬───────────────┐
        ▼             ▼             ▼               ▼
   ┌─────────┐  ┌─────────┐  ┌──────────┐   ┌──────────┐
   │  Auth   │  │Integration│ │ Agent   │   │ Posting  │
   │ (8001)  │  │  (8002)  │  │ (8004)  │   │ (8006)   │
   └─────────┘  └─────────┘  └──────────┘   └──────────┘
   ⏸️ NOT      ⏸️ NOT       ⏸️ NOT        ⏸️ NOT
   RUNNING     RUNNING       RUNNING       RUNNING
```

---

## Troubleshooting

### Port Already in Use
If you see "port already in use" errors:

```bash
# Check what's using the port (example for port 8000)
lsof -i :8000

# Kill the process if needed
kill -9 <PID>
```

### Dependencies Installation Issues
If pip install fails:

```bash
# Upgrade pip first
pip install --upgrade pip

# Then try again
cd services/auth-service
source venv/bin/activate
pip install -r requirements.txt
```

### OpenAI API Key Not Set
The AI Agent (Port 8004) requires a valid OpenAI API key. Without it:
- The agent service will start but won't function
- You'll see errors in `services/logs/agent-service.log`

**Solution**: Get an API key from https://platform.openai.com/api-keys

### Firebase Authentication Not Configured
The Auth Service (Port 8001) requires Firebase credentials. Without them:
- User authentication will fail
- Sign-in/Sign-up won't work

**Solution**: Get credentials from your Firebase Console

---

## Development Workflow

### Making Changes

**Frontend Changes:**
- Edit files in `frontend/src/`
- Hot reload is enabled - changes appear automatically
- Check browser console for errors

**Backend Changes:**
- Edit files in `services/[service-name]/app/`
- Services auto-reload on file changes (uvicorn --reload)
- Check logs in `services/logs/[service-name].log`

### Viewing Logs

```bash
# View all logs in real-time
tail -f services/logs/*.log

# View specific service log
tail -f services/logs/api-gateway.log
```

### Testing the API

```bash
# Test API Gateway health
curl http://localhost:8000/health

# View API documentation
open http://localhost:8000/docs
```

---

## What You Can Do Right Now

### ✅ Accessible (Frontend Running)
- View the homepage at http://localhost:3000
- See the UI layout and design
- Navigate between pages (without functionality)

### ⏸️ Not Yet Accessible (Backend Not Running)
- User authentication (sign in/sign up)
- Social media integrations
- AI agent chat interface
- Post scheduling
- Analytics dashboard
- Actual social media posting

**To unlock full functionality**: Start the backend services with `./start-backend.sh`

---

## Resource Requirements

### Minimum Requirements:
- **RAM**: 4GB (8GB recommended)
- **CPU**: 2 cores (4 cores recommended)
- **Disk**: 2GB free space
- **Network**: Internet connection for API calls

### Running Processes:
- 1 Node.js process (Frontend)
- 7 Python processes (Backend services)
- Total: ~8 concurrent processes

---

## Additional Information

- **Documentation**: See `README.md` for full details
- **Product Requirements**: See `docs/product-requirements.md`
- **API Specification**: See `docs/functional-specification.md`
- **Configuration**: See `.env` file and `config/config.yaml`

---

*Last Updated: November 17, 2025*
