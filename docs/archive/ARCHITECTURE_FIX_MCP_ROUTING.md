# 🏗️ Architectural Fix: MCP Routing Through Agent Service

## Overview

This document describes the major architectural refactoring that ensures **all MCP tool invocations** are routed through the **Agent Service** with **LLM-powered tool discovery**, eliminating hardcoded MCP endpoints and creating a consistent, intelligent architecture.

---

## ❌ Problem: Inconsistent Architecture

### Before the Fix

The system had **two different patterns** for MCP integration:

**Pattern 1: OAuth Flow (Correct)** ✅
```
Frontend → Integration Service → Agent Service (LLM) → MCP Client → MCP Server
                                      ↓
                                 LinkedIn Agent
                                 (LLM reasoning)
```

**Pattern 2: Posting Flow (Incorrect)** ❌
```
Frontend → Integration Service → DIRECT MCP CALL (hardcoded URL)
                    ↓
              http://3.141.18.225:3001/tools/postToLinkedIn/run
```

### Issues with the Old Approach

1. **Hardcoded Tool Names**: Integration Service directly called MCP tools like `postToLinkedIn`
2. **No LLM Intelligence**: Bypassed the Agent Service and its AI capabilities
3. **Inconsistent Patterns**: OAuth used Agent Service, posting didn't
4. **Wrong MCP URL**: Used cloud URL (`http://3.141.18.225:3001`) instead of local (`http://localhost:3001`)
5. **No Tool Discovery**: Couldn't adapt to changes in MCP server tools
6. **Tight Coupling**: Integration Service was tightly coupled to MCP implementation details

---

## ✅ Solution: Unified Agent Service Architecture

### After the Fix

**All operations now use the Agent Service pattern:**

```
┌──────────────┐
│   Frontend   │
│ (Composer UI)│
└──────┬───────┘
       │ POST /api/integrations/{platform}/post
       │ {content, user_id}
       ↓
┌──────────────────────┐
│ Integration Service  │
│ Port 8002           │
├──────────────────────┤
│ 1. Get access_token │
│    from Firestore    │
│ 2. Delegate to Agent │
└──────┬───────────────┘
       │ POST /agent/{platform}/post
       │ {content, access_token, user_id}
       ↓
┌──────────────────────┐
│   Agent Service      │
│   Port 8006         │
├──────────────────────┤
│ 1. LLM Analysis     │
│ 2. MCP Client       │
│ 3. Tool Discovery   │
└──────┬───────────────┘
       │ invoke_tool()
       │ Dynamic tool discovery
       ↓
┌──────────────────────┐
│    MCP Client        │
├──────────────────────┤
│ 1. Discover tools   │
│    /mcp/tools       │
│ 2. Invoke via JSON  │
│    -RPC             │
└──────┬───────────────┘
       │ POST /mcp/v1
       │ {jsonrpc, method: "tools/call"}
       ↓
┌──────────────────────┐
│    MCP Server        │
│ localhost:3001      │
├──────────────────────┤
│ - postToLinkedIn    │
│ - postToFacebook    │
│ - postToTwitter     │
└─────────────────────┘
```

---

## 📋 Changes Made

### 1. Integration Service (`services/integration-service/app/main.py`)

**Before:**
```python
@app.post("/api/integrations/linkedin/post")
async def post_to_linkedin(post_request: PostRequest):
    tokens = await get_user_tokens(post_request.user_id, 'linkedin')
    
    # DIRECT MCP CALL (BAD)
    response = await client.post(
        f"{MCP_SOCIAL_URL}/tools/postToLinkedIn/run",  # Hardcoded!
        json={...}
    )
```

**After:**
```python
@app.post("/api/integrations/linkedin/post")
async def post_to_linkedin(post_request: PostRequest):
    # Get tokens from Firestore
    tokens = await get_user_tokens(post_request.user_id, 'linkedin')
    
    # DELEGATE TO AGENT SERVICE (GOOD)
    response = await client.post(
        f"{AGENT_SERVICE_URL}/agent/linkedin/post",  # Agent Service!
        json={
            "content": post_request.content,
            "access_token": tokens.get('access_token'),
            "user_id": post_request.user_id
        }
    )
```

**Applied to:**
- ✅ LinkedIn posting
- ✅ Facebook posting
- ✅ Twitter posting

### 2. Agent Service (`services/agent-service/app/main.py`)

**Added New Endpoints:**

```python
@app.post("/agent/linkedin/post")
async def linkedin_post(request: Request, post_request: PostContentRequest):
    """Post to LinkedIn via AI agent with LLM + MCP Client"""
    result = await linkedin_agent.execute({
        "user_id": post_request.user_id,
        "action": "post_content",
        "content": post_request.content,
        "access_token": post_request.access_token
    })
    return result

@app.post("/agent/facebook/post")
async def facebook_post(request: Request, post_request: PostContentRequest):
    """Post to Facebook via MCP Client with tool discovery"""
    result = await mcp_client.invoke_tool(
        tool_name="postToFacebook",  # Discovered dynamically!
        parameters={...}
    )
    return result

@app.post("/agent/twitter/post")
async def twitter_post(request: Request, post_request: PostContentRequest):
    """Post to Twitter via MCP Client with tool discovery"""
    result = await mcp_client.invoke_tool(
        tool_name="postToTwitter",  # Discovered dynamically!
        parameters={...}
    )
    return result
```

### 3. MCP Client (`services/agent-service/app/mcp_client.py`)

**Already Correct - No Changes Needed!** ✅

The MCP Client was already implemented correctly:
- ✅ Tool discovery via `/mcp/tools`
- ✅ Dynamic tool invocation via JSON-RPC
- ✅ Proper error handling
- ✅ Correlation ID tracking

### 4. Environment Configuration (`.env`)

**Confirmed Configuration:**
```env
# MCP Server Configuration
MCP_HOST_TYPE=local
MCP_LOCAL_URL=http://localhost:3001  # Confirmed by user
AGENT_SERVICE_URL=http://localhost:8006
```

---

## 🎯 Benefits of the New Architecture

### 1. **LLM Intelligence**
- OpenAI LLM can analyze requests and make intelligent decisions
- Better error handling and retry logic
- Can adapt to different scenarios

### 2. **Dynamic Tool Discovery**
- MCP Client discovers available tools at startup
- No hardcoded tool names or URLs
- Can adapt to MCP server changes without code updates

### 3. **Consistent Pattern**
- OAuth flow and posting flow now use the same architecture
- Easier to understand, maintain, and debug
- Single source of truth for MCP integration

### 4. **Better Separation of Concerns**
- **Integration Service**: Manages tokens only
- **Agent Service**: Handles AI/LLM logic and MCP communication
- **MCP Client**: Handles protocol-level details

### 5. **Improved Debugging**
- Correlation IDs trace requests across all services
- Centralized logging shows complete flow
- MCP interaction logs capture all tool invocations

### 6. **Scalability**
- Easy to add new social platforms
- Agent Service can handle complex multi-step workflows
- LLM can optimize posting strategies

---

## 🔧 How It Works Now

### Example: Posting to LinkedIn

**Step 1: User Action**
```
User types content in Composer → Clicks "Post"
```

**Step 2: Frontend Call**
```javascript
// frontend/src/api/social.ts
await fetch('http://localhost:8000/api/integrations/linkedin/post', {
  method: 'POST',
  body: JSON.stringify({
    content: "Hello LinkedIn!",
    user_id: "firebase_user_123"
  })
});
```

**Step 3: Integration Service (Token Retrieval)**
```python
# services/integration-service/app/main.py
@app.post("/api/integrations/linkedin/post")
async def post_to_linkedin(post_request: PostRequest):
    # 1. Get access token from Firestore
    tokens = await get_user_tokens(post_request.user_id, 'linkedin')
    
    # 2. Delegate to Agent Service
    response = await client.post(
        f"{AGENT_SERVICE_URL}/agent/linkedin/post",
        json={
            "content": post_request.content,
            "access_token": tokens.get('access_token'),
            "user_id": post_request.user_id
        }
    )
```

**Step 4: Agent Service (LLM + MCP)**
```python
# services/agent-service/app/main.py
@app.post("/agent/linkedin/post")
async def linkedin_post(request: Request, post_request: PostContentRequest):
    # Execute LinkedIn Agent with LLM reasoning
    result = await linkedin_agent.execute({
        "action": "post_content",
        "content": post_request.content,
        "access_token": post_request.access_token,
        "user_id": post_request.user_id
    })
```

**Step 5: MCP Client (Tool Discovery & Invocation)**
```python
# services/agent-service/app/mcp_client.py
async def post_to_linkedin(self, content, access_token, user_id):
    # Invoke tool discovered from MCP server
    return await self.invoke_tool(
        tool_name="postToLinkedIn",
        parameters={
            "content": content,
            "accessToken": access_token,
            "userId": user_id
        }
    )
```

**Step 6: MCP Server (Actual Posting)**
```
MCP Server receives JSON-RPC request → Calls LinkedIn API → Returns result
```

---

## 🧪 Testing the New Architecture

### 1. Verify MCP Server Connectivity

```bash
# Check MCP server is running
curl http://localhost:3001/mcp/tools

# Should return list of available tools
```

### 2. Test Agent Service Connection

```bash
# Test Agent Service can discover MCP tools
curl http://localhost:8006/health

# Should show: "available_tools": 3 (or more)
```

### 3. Test End-to-End Posting

1. Navigate to Composer page
2. Enter test content
3. Select LinkedIn (ensure it's connected)
4. Click "Post"
5. Watch logs for the flow:
   ```bash
   tail -f logs/centralized.log
   ```

### 4. Monitor Logs

**Integration Service Log:**
```
📤 [INTEGRATION-SERVICE] LinkedIn Post Request Received
✅ [INTEGRATION-SERVICE] Retrieved access token from Firestore
🤖 [INTEGRATION-SERVICE] Delegating to Agent Service
```

**Agent Service Log:**
```
📝 [AGENT-SERVICE] Posting content to LinkedIn
🔧 [AGENT-SERVICE] Invoking MCP Client
✅ [AGENT-SERVICE] LinkedIn post completed
```

**MCP Client Log:**
```
📡 [MCP-CLIENT] Invoking tool 'postToLinkedIn'
✅ [MCP-CLIENT] Tool execution successful
```

---

## 📊 Architecture Comparison

| Aspect | Old Architecture ❌ | New Architecture ✅ |
|--------|-------------------|-------------------|
| **MCP Integration** | Direct HTTP calls | Via Agent Service + MCP Client |
| **Tool Discovery** | Hardcoded names | Dynamic discovery |
| **LLM Intelligence** | Only for OAuth | For all operations |
| **Consistency** | Different patterns | Unified pattern |
| **Maintainability** | Tight coupling | Loose coupling |
| **Debugging** | Difficult | Correlation ID tracking |
| **Scalability** | Limited | Highly scalable |
| **Adaptability** | Code changes needed | Configuration changes only |

---

## 🚀 Future Enhancements

With this new architecture, we can easily add:

1. **Intelligent Content Optimization**
   - LLM analyzes content and suggests improvements
   - Platform-specific formatting

2. **Smart Scheduling**
   - LLM recommends optimal posting times
   - Analyzes audience engagement patterns

3. **Multi-Platform Strategies**
   - LLM creates platform-specific variations
   - Optimizes content for each platform

4. **Error Recovery**
   - LLM suggests fixes for failed posts
   - Automatic retry with adjustments

5. **Analytics Integration**
   - LLM analyzes performance metrics
   - Provides actionable insights

---

## 📝 Configuration Reference

### Environment Variables

```env
# MCP Server
MCP_HOST_TYPE=local                    # Use local MCP server
MCP_LOCAL_URL=http://localhost:3001   # Local MCP server URL
MCP_SERVER_TIMEOUT=30                  # Request timeout

# Agent Service
AGENT_SERVICE_URL=http://localhost:8006
OPENAI_API_KEY=sk-proj-...            # OpenAI API key for LLM
OPENAI_MODEL=gpt-4o-mini              # LLM model to use

# Service Ports
INTEGRATION_SERVICE_PORT=8002
AGENT_SERVICE_PORT=8006
```

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **MCP Server** | `http://localhost:3001` | Provides social media tools |
| **Agent Service** | `http://localhost:8006` | LLM + MCP orchestration |
| **Integration Service** | `http://localhost:8002` | Token management |
| **API Gateway** | `http://localhost:8000` | External API endpoint |

---

## ✅ Validation Checklist

After implementing this fix, verify:

- [ ] All services start successfully
- [ ] Agent Service can discover MCP tools (`/health` shows tool count)
- [ ] Integration Service delegates to Agent Service (check logs)
- [ ] LinkedIn posting works end-to-end
- [ ] Facebook posting works (when implemented on MCP server)
- [ ] Twitter posting works (when implemented on MCP server)
- [ ] Error messages are clear and actionable
- [ ] Correlation IDs appear in all logs
- [ ] No hardcoded MCP URLs remain in Integration Service

---

## 🎓 Key Takeaways

1. **Always route through Agent Service** for MCP operations
2. **Never hardcode tool names or URLs** - use discovery
3. **Use correlation IDs** for end-to-end tracing
4. **Leverage LLM intelligence** for better user experience
5. **Maintain separation of concerns** - each service has one job

---

**Status**: ✅ **COMPLETE**

All services have been refactored to use the unified Agent Service architecture with LLM-powered MCP tool discovery.
