# LLM-Driven MCP Integration Implementation Guide

## 🎯 Overview

This document describes the implementation of the **LLM-driven Model Context Protocol (MCP) integration** for LinkedIn authentication. The system now uses OpenAI's GPT-4o to intelligently interact with the MCP server, ensuring proper AI-agent-based decision making.

---

## 🏗️ Architecture

### Request Flow with LLM Integration

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Complete Request Flow                              │
└──────────────────────────────────────────────────────────────────────┘

Frontend (localhost:3000)
    │ User clicks "Connect LinkedIn"
    │ correlation_id: generated UUID
    ↓
API Gateway (localhost:8000)
    │ Routes to /api/integrations/linkedin/auth
    │ Forwards correlation_id
    ↓
Backend Service (localhost:8001)
    │ linkedin.py: initiate_auth()
    │ [LOG] "Backend Service: Received LinkedIn auth request"
    │ [LOG] "Backend Service: Delegating to Agent Service"
    ↓
Agent Service (localhost:8006) ← NEW INTEGRATION POINT
    │ main.py: linkedin_auth()
    │ [LOG] "Agent Service: Received LinkedIn auth request"
    │ [LOG] "Agent Service: Invoking LLM-based LinkedInOAuthAgent"
    ↓
OpenAI GPT-4o (LLM)
    │ linkedin_agent.py: LinkedInOAuthAgent
    │ [LOG] "LinkedInAgent: Analyzing request with AI"
    │ LLM decides: "User needs LinkedIn OAuth URL"
    │ [LOG] "LinkedInAgent: Executing get_auth_url node"
    ↓
MCP Client
    │ mcp_client.py: get_linkedin_auth_url()
    │ [LOG] "MCP Client: Calling getLinkedInAuthUrl tool"
    ↓
MCP Server (localhost:3001)
    │ Executes tool: getLinkedInAuthUrl
    │ Uses correct LinkedIn APP_ID: 77yvmo0lqui9yg
    │ Returns: { auth_url: "https://linkedin.com/oauth/...", state: "..." }
    ↓
[Response flows back through the chain]
    │ Each service logs with same correlation_id
    ↓
Frontend receives auth_url and opens popup
```

---

## 📋 Implementation Details

### 1. Backend Service Changes

**File**: `backend-service/app/integrations/linkedin.py`

**Key Changes**:
- Removed direct MCP client calls
- Added Agent Service client integration
- Comprehensive logging with correlation_id
- Error handling at service boundaries

```python
@router.post("/auth")
async def initiate_auth(request: Request, user_id: str = Header(...)):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    # Delegate to Agent Service (not MCP directly)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{config.AGENT_SERVICE_URL}/agent/linkedin/auth",
            json={"user_id": user_id, "action": "get_auth_url"},
            headers={"X-Correlation-ID": correlation_id}
        )
```

### 2. Agent Service Integration

**File**: `services/agent-service/app/main.py`

**Key Changes**:
- New endpoint: `/agent/linkedin/auth`
- Accepts correlation_id via header
- Invokes LinkedInOAuthAgent with LLM reasoning
- Returns structured response

```python
@app.post("/agent/linkedin/auth")
async def linkedin_auth(
    request: GetAuthUrlRequest,
    x_correlation_id: Optional[str] = Header(None)
):
    correlation_id = x_correlation_id or "unknown"
    
    # Execute agent workflow with LLM reasoning
    result = await linkedin_agent.execute({
        "user_id": request.user_id,
        "action": "get_auth_url",
        "correlation_id": correlation_id
    })
```

### 3. MCP Client Enhancement

**File**: `services/agent-service/app/mcp_client.py`

**Key Changes**:
- Added correlation_id parameter
- Timing metrics for each call
- Detailed logging before/after MCP interactions

```python
async def get_linkedin_auth_url(self, user_id: str, correlation_id: str = "unknown"):
    start_time = time.time()
    
    logger.info(
        f"MCP Client: Calling getLinkedInAuthUrl | "
        f"correlation_id={correlation_id}"
    )
    
    result = await self.invoke_tool(...)
    
    elapsed = time.time() - start_time
    logger.info(f"MCP Client: Completed in {elapsed:.2f}s")
```

### 4. LinkedIn Agent Enhancement

**File**: `services/agent-service/app/linkedin_agent.py`

**Key Changes**:
- Passes correlation_id through agent state
- Logs at each LangGraph node execution
- LLM analyzes request before tool invocation

```python
async def _get_auth_url(self, state: LinkedInAgentState):
    correlation_id = state.get("correlation_id", "unknown")
    
    logger.info(
        f"LinkedInAgent: Executing get_auth_url node | "
        f"correlation_id={correlation_id}"
    )
    
    result = await self.mcp_client.get_linkedin_auth_url(
        state["user_id"],
        correlation_id
    )
```

---

## 🔍 Debugging & Tracing

### Centralized Logging

All services log to `logs/centralized.log` with correlation_id:

```bash
# Trace a specific request
grep "correlation_id=abc-123" logs/centralized.log
```

**Example Log Output**:
```
[16:30:01.123] BACKEND-SERVICE-LINKEDIN | INFO | correlation_id=abc-123 | Backend Service: Received LinkedIn auth request
[16:30:01.234] BACKEND-SERVICE-LINKEDIN | INFO | correlation_id=abc-123 | Backend Service: Calling Agent Service
[16:30:01.345] Agent Service | INFO | correlation_id=abc-123 | Agent Service: Received LinkedIn auth request
[16:30:01.456] Agent Service | INFO | correlation_id=abc-123 | Agent Service: Invoking LLM-based LinkedInOAuthAgent
[16:30:02.567] Agent Service | INFO | correlation_id=abc-123 | LinkedInAgent: Executing get_auth_url node
[16:30:02.678] Agent Service | INFO | correlation_id=abc-123 | MCP Client: Calling getLinkedInAuthUrl tool
[16:30:02.789] Agent Service | INFO | correlation_id=abc-123 | MCP Client: Completed in 0.11s
[16:30:02.890] Agent Service | INFO | correlation_id=abc-123 | LinkedInAgent: Auth URL obtained successfully
[16:30:02.991] BACKEND-SERVICE-LINKEDIN | INFO | correlation_id=abc-123 | Backend Service: Successfully obtained auth URL
```

### Testing the Integration

#### Test 1: Service Connectivity
```bash
# Check each service is running
curl http://localhost:8001/health  # Backend Service
curl http://localhost:8006/health  # Agent Service
curl http://localhost:3001/health  # MCP Server
```

#### Test 2: End-to-End LinkedIn Auth
```bash
# Generate correlation ID for tracking
CORR_ID=$(uuidgen)

# Make auth request
curl -X POST http://localhost:8002/api/integrations/linkedin/auth \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user-123" \
  -H "X-Correlation-ID: $CORR_ID"

# Trace the request through all services
grep $CORR_ID logs/centralized.log
```

#### Test 3: Verify LLM Invocation
```bash
# Check that OpenAI is being called
grep "LLM analyzing" logs/centralized.log | tail -5
grep "LinkedInAgent: Executing" logs/centralized.log | tail -5
```

---

## 🚨 Troubleshooting

### Issue: "Failed to connect to Agent Service"

**Log Indicator**: `Backend Service: Failed to connect to Agent Service`

**Solutions**:
1. Check Agent Service is running: `curl http://localhost:8006/health`
2. Verify `AGENT_SERVICE_URL` in `.env`: should be `http://localhost:8006`
3. Check agent service logs: `tail -f services/logs/agent-service.log`

### Issue: "MCP Client: Tool call failed"

**Log Indicator**: `MCP Client: getLinkedInAuthUrl failed`

**Solutions**:
1. Check MCP Server is running: `curl http://localhost:3001/health`
2. Verify MCP Server has correct APP_ID configured
3. Check MCP_SERVER_URL matches MCP_HOST_TYPE setting

### Issue: "LLM analysis failed"

**Log Indicator**: `Error in AI analysis`

**Solutions**:
1. Verify `OPENAI_API_KEY` is set in `.env`
2. Check OpenAI API quota/limits
3. Verify internet connectivity for OpenAI API

### Issue: "No auth_url in response"

**Log Indicator**: `Backend Service: No auth_url in Agent Service response`

**Solutions**:
1. Check MCP Server returned valid response
2. Verify LinkedIn APP_ID in MCP Server
3. Check MCP tool implementation: `curl http://localhost:3001/mcp/tools`

---

## 📊 Monitoring

### Key Metrics to Track

| Metric | Description | How to Check |
|--------|-------------|--------------|
| **Request Duration** | Time from Frontend to LinkedIn URL | Check timing logs with correlation_id |
| **LLM Response Time** | OpenAI GPT-4o processing time | Look for "LinkedInAgent: Analyzing" logs |
| **MCP Call Duration** | Time for MCP tool execution | Check "MCP Client: Completed in X.XXs" |
| **Success Rate** | Percentage of successful auth URL requests | Count "Successfully obtained auth URL" vs errors |

### Health Check Endpoints

```bash
# Overall system health
curl http://localhost:8000/health  # API Gateway
curl http://localhost:8001/health  # Backend Service
curl http://localhost:8006/health  # Agent Service
curl http://localhost:3001/health  # MCP Server
```

---

## ✅ Verification Checklist

- [ ] Backend Service delegates to Agent Service (not MCP directly)
- [ ] Agent Service uses OpenAI LLM for request analysis
- [ ] LinkedInOAuthAgent executes with LangGraph workflow
- [ ] MCP Client calls include correlation_id and timing
- [ ] All services log with same correlation_id
- [ ] End-to-end request can be traced in logs
- [ ] LinkedIn auth URL contains correct APP_ID (77yvmo0lqui9yg)
- [ ] Error messages are descriptive and include service context

---

## 🔧 Configuration

### Required Environment Variables

```bash
# Agent Service URL (Backend needs this)
AGENT_SERVICE_URL=http://localhost:8006

# OpenAI API (Agent Service needs this)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o

# MCP Server (Agent Service needs this)
MCP_HOST_TYPE=local
MCP_LOCAL_URL=http://localhost:3001
```

---

## 📝 Summary

The system now properly implements **Model Context Protocol with LLM integration**:

1. **Frontend** → **Backend Service** → **Agent Service** (NEW)
2. **Agent Service** uses **OpenAI LLM** to analyze requests
3. **LLM** decides which **MCP tools** to invoke
4. **MCP Client** executes tools on **MCP Server**
5. **Full tracing** via correlation_id through all services

This ensures that the MCP integration follows the **AI-agent pattern** where the LLM reasons about tool selection and execution, rather than just being a simple REST API proxy.
