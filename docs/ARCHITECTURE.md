# 🏗️ SocialConnectIQ Architecture Documentation

**Version**: 1.0  
**Last Updated**: December 15, 2025  
**Status**: ✅ DEFINITIVE REFERENCE

---

## 📌 Purpose

This document defines the **authoritative architecture** for SocialConnectIQ. When in doubt about service responsibilities or communication patterns, **refer to this document**.

---

## 🎯 Core Architectural Principles

1. **Single Responsibility**: Each service has ONE clear purpose
2. **Loose Coupling**: Services communicate via well-defined APIs
3. **Agent Service = ONLY MCP Client**: No other service calls MCP directly
4. **Integration Service = OAuth Authority**: Owns all platform tokens
5. **Backend Service = Business Logic**: Orchestrates workflows, owns business data

---

## 🌐 Service Overview

### Port Assignments

| Port | Service | Purpose |
|------|---------|---------|
| **3000** | Frontend (React) | User interface |
| **8000** | API Gateway | Single entry point, intelligent router |
| **8001** | Backend Service | Business logic, orchestration, data management |
| **8002** | Integration Service | OAuth workflows, token management |
| **8006** | Agent Service | AI features, MCP client, platform execution |

---

## 📦 Service Responsibilities

### **Port 3000: Frontend (React)**

**Role**: User Interface

**Responsibilities:**
- ✅ Render UI components
- ✅ Handle user interactions
- ✅ Make API calls to API Gateway (ONLY)
- ✅ Manage local state (React state, context)
- ✅ Display data and feedback to users

**Never Does:**
- ❌ Call backend services directly (always through API Gateway)
- ❌ Store OAuth tokens (server-side only)
- ❌ Implement business logic

**Key Files:**
- `frontend/src/pages/` - Page components
- `frontend/src/api/social.ts` - API client
- `frontend/src/components/` - Reusable components

---

### **Port 8000: API Gateway**

**Role**: Single Entry Point & Intelligent Router

**Responsibilities:**
- ✅ Receive ALL requests from frontend
- ✅ Route to appropriate backend services
- ✅ Add correlation IDs for request tracking
- ✅ Handle CORS
- ✅ Log all requests/responses
- ✅ Return responses to frontend

**Never Does:**
- ❌ Implement business logic
- ❌ Store data
- ❌ Call external APIs directly

**Routing Rules:**
```
/api/integrations/*/auth        → Integration Service (8002)
/api/integrations/*/callback    → Integration Service (8002)
/api/integrations/*/status      → Integration Service (8002)
/api/integrations/*/disconnect  → Integration Service (8002)
/api/integrations/preview       → Backend Service (8001)
/api/integrations/content/*     → Agent Service (8006)
/api/users/*                    → Backend Service (8001)
/api/analytics/*                → Backend Service (8001)
```

**Key Files:**
- `api-gateway/app/main.py` - Main routing logic

---

### **Port 8001: Backend Service**

**Role**: Business Logic & Orchestration

**Responsibilities:**
- ✅ **User Management**: Profiles, preferences, settings
- ✅ **Content Management**: Drafts, scheduled posts, post history
- ✅ **Analytics**: Aggregate metrics, generate reports
- ✅ **Post Preview**: Generate platform-specific previews
- ✅ **Validation**: Business rules, data validation
- ✅ **Orchestration**: Coordinate between services
- ✅ **Token Retrieval**: Get OAuth tokens from Integration Service
- ✅ **Post Coordination**: Request posting from Agent Service

**Never Does:**
- ❌ Handle OAuth flows (Integration Service does this)
- ❌ Store OAuth tokens (Integration Service does this)
- ❌ Call MCP Server directly (Agent Service does this)
- ❌ Call platform APIs directly (Agent Service does this)

**Example Workflows:**

**Posting Content:**
```python
# Backend Service coordinates the workflow
1. Validate request
2. Get tokens from Integration Service: 
   tokens = await integration_service.get_tokens(user_id, platform)
3. Request posting from Agent Service:
   result = await agent_service.post_content(platform, content, tokens)
4. Save post record in database
5. Return success to frontend
```

**Key Files:**
- `backend-service/app/main.py` - Main service
- `backend-service/app/integrations/routes.py` - Preview endpoint

---

### **Port 8002: Integration Service**

**Role**: OAuth Workflows & Token Management

**Responsibilities:**
- ✅ **OAuth Workflows**: Initiate authentication, handle callbacks
- ✅ **Token Management**: Store, retrieve, refresh, validate tokens
- ✅ **OAuth State Management**: CSRF protection, state validation
- ✅ **Platform Connections**: LinkedIn, Twitter, Facebook OAuth
- ✅ **Token API**: Provide tokens to other services (Backend, Agent)
- ✅ **Disconnect**: Remove tokens and clean up OAuth states

**How it Works with MCP:**
```python
# Integration Service delegates MCP calls to Agent Service
async def initiate_linkedin_auth(user_id):
    # Step 1: Call Agent Service to get OAuth URL from MCP
    response = await agent_service.get_linkedin_auth_url(user_id)
    auth_url = response['auth_url']
    state = response['state']
    
    # Step 2: Save OAuth state in Firestore for validation
    await storage.save_oauth_state(state, user_id, 'linkedin')
    
    # Step 3: Return auth URL to frontend
    return auth_url

async def handle_linkedin_callback(code, state):
    # Step 1: Validate OAuth state
    state_data = await storage.validate_oauth_state(state)
    user_id = state_data['user_id']
    
    # Step 2: Call Agent Service to exchange code for tokens via MCP
    tokens = await agent_service.exchange_linkedin_code(code, user_id)
    
    # Step 3: Store tokens in Firestore
    await storage.save_tokens(user_id, 'linkedin', tokens)
    
    # Step 4: Redirect to frontend
    return RedirectResponse('/oauth-callback?status=success')
```

**Never Does:**
- ❌ Call MCP Server directly (Agent Service does this)
- ❌ Post content to platforms (Agent Service does this)
- ❌ Refine content with AI (Agent Service does this)
- ❌ Implement business logic (Backend Service does this)

**Key Files:**
- `services/integration-service/app/main.py` - OAuth endpoints
- `backend-service/app/integrations/storage.py` - Token storage (WILL MOVE)
- `backend-service/app/integrations/linkedin.py` - LinkedIn OAuth (WILL MOVE)
- `backend-service/app/integrations/twitter.py` - Twitter OAuth (WILL MOVE)

**⚠️ NOTE**: OAuth code currently in `backend-service/app/integrations/` should be moved to `services/integration-service/` for proper separation.

---

### **Port 8006: Agent Service**

**Role**: AI Features & MCP Communication

**Responsibilities:**
- ✅ **MCP Client**: ONLY service that communicates with MCP Server
- ✅ **OAuth Execution**: Get auth URLs, exchange codes (via MCP)
- ✅ **Platform Posting**: Post to LinkedIn, Twitter, Facebook (via MCP)
- ✅ **AI Features**: Content refinement using OpenAI GPT-4o
- ✅ **Intelligent Agents**: LinkedIn Agent, Twitter Agent, Content Agent
- ✅ **LangGraph**: Orchestrate complex AI workflows

**MCP Communication Pattern:**
```python
# Agent Service is the ONLY service with MCP Client
class AgentService:
    def __init__(self):
        self.mcp_client = MCPClient(mcp_server_url)
    
    # Called by Integration Service during OAuth
    async def get_linkedin_auth_url(self, user_id):
        result = await self.mcp_client.call_tool(
            "getLinkedInAuthUrl",
            {"userId": user_id}
        )
        return result
    
    # Called by Integration Service during OAuth callback
    async def exchange_linkedin_code(self, code, user_id):
        result = await self.mcp_client.call_tool(
            "exchangeLinkedInAuthCode",
            {"code": code, "userId": user_id}
        )
        return result
    
    # Called by Backend Service during posting
    async def post_to_linkedin(self, content, access_token, user_id):
        result = await self.mcp_client.call_tool(
            "postToLinkedIn",
            {
                "content": content,
                "accessToken": access_token,
                "userId": user_id
            }
        )
        return result
    
    # Called directly by API Gateway for content refinement
    async def refine_content(self, content, tone, platform):
        # This uses OpenAI, NOT MCP
        result = await self.content_agent.refine(content, tone, platform)
        return result
```

**Never Does:**
- ❌ Store OAuth tokens (Integration Service does this)
- ❌ Manage OAuth workflows (Integration Service does this)
- ❌ Implement business logic (Backend Service does this)

**Key Files:**
- `services/agent-service/app/main.py` - Main service
- `services/agent-service/app/mcp_client.py` - MCP Client (ONLY ONE)
- `services/agent-service/app/linkedin_agent.py` - LinkedIn Agent
- `services/agent-service/app/twitter_agent.py` - Twitter Agent
- `services/agent-service/app/content_agent.py` - Content Refinement Agent

---

## 🔄 Complete Request Flows

### **Flow 1: Connect LinkedIn Account**

```
┌─────────────┐
│  Frontend   │ User clicks "Connect LinkedIn"
└──────┬──────┘
       │ POST /api/integrations/linkedin/auth
       ↓
┌─────────────┐
│API Gateway  │ Routes to Integration Service
│  :8000      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│Integration  │ 1. Needs OAuth URL from MCP
│  Service    │ 2. Calls Agent Service
│  :8002      │
└──────┬──────┘
       │ "Get me LinkedIn auth URL"
       ↓
┌─────────────┐
│   Agent     │ 3. Calls MCP Client
│  Service    │ 4. LinkedIn Agent → MCP Client
│  :8006      │
└──────┬──────┘
       │ MCP request
       ↓
┌─────────────┐
│ MCP Server  │ 5. Generates OAuth URL
│   (AWS)     │ 6. Returns: {authUrl, state}
└──────┬──────┘
       │
       ↓ Response flows back
┌─────────────┐
│Integration  │ 7. Saves OAuth state to Firestore
│  Service    │ 8. Returns auth URL
│  :8002      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Frontend   │ 9. Opens OAuth popup
└─────────────┘ 10. User authenticates on LinkedIn
```

### **Flow 2: OAuth Callback (LinkedIn redirects back)**

```
LinkedIn redirects to:
/api/integrations/linkedin/callback?code=xxx&state=yyy
       │
       ↓
┌─────────────┐
│API Gateway  │ Routes to Integration Service
│  :8000      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│Integration  │ 1. Validates OAuth state
│  Service    │ 2. Calls Agent Service to exchange code
│  :8002      │
└──────┬──────┘
       │ "Exchange this code for tokens"
       ↓
┌─────────────┐
│   Agent     │ 3. LinkedIn Agent → MCP Client
│  Service    │ 4. Exchanges code via MCP
│  :8006      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ MCP Server  │ 5. Calls LinkedIn API
│   (AWS)     │ 6. Returns: {accessToken, refreshToken, expiresIn}
└──────┬──────┘
       │
       ↓ Response flows back
┌─────────────┐
│Integration  │ 7. Stores tokens in Firestore
│  Service    │ 8. Redirects to /oauth-callback.html?status=success
│  :8002      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Frontend   │ 9. Shows "Connected" status
└─────────────┘
```

### **Flow 3: Post to LinkedIn**

```
┌─────────────┐
│  Frontend   │ User clicks "Publish"
└──────┬──────┘
       │ POST /api/integrations/linkedin/post
       ↓
┌─────────────┐
│API Gateway  │ Routes to Backend Service
│  :8000      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Backend    │ 1. Validates request
│  Service    │ 2. Gets tokens from Integration Service
│  :8001      │ 3. Calls Agent Service to post
└──────┬──────┘
       │ "Post this content with these tokens"
       ↓
┌─────────────┐
│   Agent     │ 4. LinkedIn Agent → MCP Client
│  Service    │ 5. Posts via MCP (with tokens)
│  :8006      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ MCP Server  │ 6. Calls LinkedIn API
│   (AWS)     │ 7. Returns: {postId, url}
└──────┬──────┘
       │
       ↓ Response flows back
┌─────────────┐
│  Backend    │ 8. Saves post record in database
│  Service    │ 9. Returns success to frontend
│  :8001      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Frontend   │ 10. Shows "Posted successfully!"
└─────────────┘
```

### **Flow 4: Refine Content with AI**

```
┌─────────────┐
│  Frontend   │ User clicks "Enhance"
└──────┬──────┘
       │ POST /api/integrations/content/refine
       ↓
┌─────────────┐
│API Gateway  │ Routes DIRECTLY to Agent Service
│  :8000      │ (NOT through Backend)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│   Agent     │ 1. ContentRefinementAgent
│  Service    │ 2. Calls OpenAI GPT-4o (NOT MCP!)
│  :8006      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  OpenAI     │ 3. LLM refines content
│   GPT-4o    │ 4. Returns refined text + suggestions
└──────┬──────┘
       │
       ↓ Response flows back
┌─────────────┐
│  Frontend   │ 5. Displays refined content
└─────────────┘

Note: This does NOT use MCP Server at all!
```

### **Flow 5: Disconnect LinkedIn**

```
┌─────────────┐
│  Frontend   │ User clicks "Disconnect"
└──────┬──────┘
       │ DELETE /api/integrations/linkedin/disconnect
       ↓
┌─────────────┐
│API Gateway  │ Routes to Integration Service
│  :8000      │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│Integration  │ 1. Delete tokens from Firestore
│  Service    │ 2. Clean up OAuth states
│  :8002      │ 3. Returns success
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Frontend   │ 4. Shows "Not Connected"
└─────────────┘

Note: No MCP or Agent Service involved!
```

---

## 🗄️ Data Storage

### **Firestore Structure**

```
users/
  {user_id}/
    email: "user@example.com"
    integrations/
      linkedin/
        access_token: "encrypted_token"
        refresh_token: "encrypted_refresh"
        expires_at: 1234567890
        connected: true
        connected_at: "2025-12-15T12:00:00Z"
        platform_user_id: "linkedin_user_123"
      twitter/
        access_token: "encrypted_token"
        refresh_token: "encrypted_refresh"
        expires_at: 1234567890
        connected: true
        connected_at: "2025-12-15T12:00:00Z"
        platform_user_id: "twitter_user_456"

oauth_states/
  {random_state_string}/
    user_id: "user123"
    platform: "linkedin"
    created_at: "2025-12-15T12:00:00Z"
    expires_at: 1234567890

posts/ (Backend Service owns this)
  {post_id}/
    user_id: "user123"
    platform: "linkedin"
    content: "Post text"
    created_at: "2025-12-15T12:00:00Z"
    status: "published"
    platform_post_id: "linkedin_post_789"
```

### **Who Owns What Data**

| Data | Owner | Storage |
|------|-------|---------|
| OAuth tokens | Integration Service | Firestore `users/{id}/integrations` |
| OAuth states | Integration Service | Firestore `oauth_states` |
| User profiles | Backend Service | Firestore `users/{id}` (non-integration fields) |
| Post history | Backend Service | Firestore `posts` |
| Analytics | Backend Service | Firestore `analytics` |
| Drafts | Backend Service | Firestore `drafts` |

---

## 🔑 Key Decision Rules

### **When to call which service:**

| You Need To... | Call This Service | Which Then Calls... |
|----------------|-------------------|---------------------|
| Connect a platform | Integration Service | Agent Service → MCP Server |
| Disconnect a platform | Integration Service | (Nothing - just deletes tokens) |
| Check connection status | Integration Service | (Nothing - reads Firestore) |
| Post content | Backend Service | Integration Service (get tokens) → Agent Service (post) → MCP Server |
| Refine content | Agent Service | OpenAI GPT-4o (NOT MCP) |
| Generate preview | Backend Service | (Nothing - generates locally) |
| Get analytics | Backend Service | (Nothing - queries Firestore) |

### **Who calls MCP Server:**

| Service | Calls MCP? | Why / Why Not |
|---------|------------|---------------|
| Frontend | ❌ NO | Never calls backend services directly |
| API Gateway | ❌ NO | Only routes requests |
| Backend Service | ❌ NO | Orchestrates, but delegates execution |
| Integration Service | ❌ NO | Manages OAuth, but delegates MCP calls |
| **Agent Service** | ✅ **YES** | **ONLY service with MCP Client** |

---

## 🚫 Common Anti-Patterns to Avoid

### **❌ WRONG: Multiple MCP Clients**
```python
# DON'T DO THIS in Integration Service or Backend Service
mcp_client = MCPClient(url)  # ❌ WRONG!
result = await mcp_client.call_tool(...)
```

### **✅ CORRECT: Call Agent Service**
```python
# DO THIS in Integration Service or Backend Service
response = await agent_service.get_linkedin_auth_url(user_id)  # ✅ CORRECT!
```

### **❌ WRONG: Integration Service storing business data**
```python
# DON'T DO THIS in Integration Service
await storage.save_post_record(post_data)  # ❌ WRONG! Backend owns this
```

### **✅ CORRECT: Backend Service stores business data**
```python
# DO THIS in Backend Service
await post_repository.save(post_data)  # ✅ CORRECT!
```

### **❌ WRONG: Backend Service managing OAuth tokens**
```python
# DON'T DO THIS in Backend Service
await storage.save_tokens(user_id, platform, tokens)  # ❌ WRONG! Integration owns this
```

### **✅ CORRECT: Integration Service manages tokens**
```python
# DO THIS - Backend calls Integration Service
tokens = await integration_service.get_tokens(user_id, platform)  # ✅ CORRECT!
```

---

## 📋 Migration Checklist

### **Current State Issues:**

- [ ] OAuth code in `backend-service/app/integrations/` should be in `services/integration-service/`
- [ ] API Gateway routes LinkedIn to port 8002 but Twitter to port 8001 (inconsistent)
- [ ] Backend Service has integration logic that should be in Integration Service

### **Required Refactoring:**

1. **Move OAuth Code:**
   ```
   backend-service/app/integrations/linkedin.py 
   → services/integration-service/app/linkedin.py
   
   backend-service/app/integrations/twitter.py 
   → services/integration-service/app/twitter.py
   
   backend-service/app/integrations/storage.py 
   → services/integration-service/app/storage.py
   ```

2. **Update API Gateway Routing:**
   - ALL platform OAuth endpoints → Integration Service (8002)
   - Preview/business logic endpoints → Backend Service (8001)
   - AI/content refinement → Agent Service (8006)

3. **Update Service Communication:**
   - Integration Service calls Agent Service for MCP operations
   - Backend Service calls Integration Service for tokens
   - Backend Service calls Agent Service for posting (with tokens)

---

## 🎯 Quick Reference Card

**Print this and keep it visible:**

```
┌─────────────────────────────────────────────────────┐
│         SOCIALCONNECTIQ SERVICE CHEATSHEET          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend (3000)                                    │
│    → Always calls API Gateway                       │
│                                                     │
│  API Gateway (8000)                                 │
│    → Routes to appropriate service                  │
│                                                     │
│  Integration Service (8002)                         │
│    → OAuth workflows, token management              │
│    → Calls Agent Service for MCP operations         │
│                                                     │
│  Backend Service (8001)                             │
│    → Business logic, orchestration                  │
│    → Gets tokens from Integration Service           │
│    → Requests posting from Agent Service            │
│                                                     │
│  Agent Service (8006)                               │
│    → ONLY service with MCP Client                   │
│    → AI features (OpenAI, NOT MCP)                  │
│    → Executes platform operations                   │
│                                                     │
│  KEY RULE:                                          │
│  Agent Service = ONLY MCP Client                    │
│  Integration Service = OAuth Authority              │
│  Backend Service = Business Orchestrator            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📚 Related Documentation

- [CHANGELOG.md](CHANGELOG.md) - History of changes
- [linkedin-integration-guide.md](linkedin-integration-guide.md) - LinkedIn OAuth details
- [MCP_SETUP_GUIDE.md](MCP_SETUP_GUIDE.md) - MCP server setup
- [SERVICE_MANAGEMENT.md](SERVICE_MANAGEMENT.md) - Running services

---

## ✅ Agreement

**This architecture document represents our agreed-upon design.**

When implementing features or fixing bugs:
1. ✅ Read this document first
2. ✅ Follow the service responsibilities
3. ✅ Use the correct communication patterns
4. ✅ Update this document if architecture changes

**Last Reviewed**: December 15, 2025  
**Status**: ✅ ACTIVE AND BINDING

---

*This is a living document. Update it as the architecture evolves, but always maintain the core principles.*
