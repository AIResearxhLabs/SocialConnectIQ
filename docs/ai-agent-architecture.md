# 🤖 AI Agent Architecture Documentation

## Overview

This document describes the AI-powered agent architecture for LinkedIn OAuth integration using **LangGraph**, **OpenAI**, and **Model Context Protocol (MCP)**.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│              Integration Page with OAuth Popup               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway (:8000)                         │
│            Routes requests to microservices                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ↓                       ↓
┌───────────────────────────┐  ┌──────────────────────────────┐
│  Integration Service      │  │   Agent Service :8006        │
│        :8002              │←─┤  (AI Orchestrator)           │
│                           │  │                              │
│ - OAuth callback handling │  │ - LangGraph state machine    │
│ - Token storage (Firestore│  │ - OpenAI/GPT-4              │
│ - Token validation        │  │ - MCP client                 │
└───────────────┬───────────┘  │ - Tool discovery             │
                │                └──────────────┬───────────────┘
                │                              │
                │                              ↓
                │                    ┌──────────────────────┐
                │                    │   MCP Server (AWS)   │
                │                    │ http://3.141.18.225  │
                │                    │       :3001          │
                │                    │                      │
                │                    │ - LinkedIn OAuth     │
                │                    │ - Token exchange     │
                │                    │ - Post to LinkedIn   │
                │                    └──────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────┐
│                  Firestore Database                          │
│  - User OAuth tokens                                         │
│  - OAuth states                                              │
│  - Integration metadata                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. **Agent Service** (Port 8006)

The Agent Service is the AI-powered orchestrator that manages the LinkedIn OAuth workflow.

#### Technologies:
- **FastAPI**: Web framework for building APIs
- **LangGraph**: State machine for workflow orchestration
- **OpenAI GPT-4**: AI for intelligent decision-making
- **LangChain**: Framework for building LLM applications

#### Key Files:
- `services/agent-service/app/main.py`: FastAPI endpoints
- `services/agent-service/app/linkedin_agent.py`: LangGraph state machine
- `services/agent-service/app/mcp_client.py`: MCP protocol client
- `services/agent-service/app/config.py`: Configuration management

#### Endpoints:
- `POST /agent/linkedin/get-auth-url`: Get OAuth authorization URL
- `POST /agent/linkedin/handle-callback`: Handle OAuth callback
- `POST /agent/linkedin/post-content`: Post content to LinkedIn
- `GET /mcp/tools`: Discover available MCP tools

---

### 2. **LangGraph State Machine**

The LinkedIn OAuth workflow is implemented as a LangGraph state machine with the following states:

#### State Flow:

```
┌─────────────────┐
│ ANALYZE_REQUEST │ ←─ Entry Point
└────────┬────────┘
         │
         ↓
    [Route Action]
         │
    ┌────┼────┬──────────────┐
    │    │    │              │
    ↓    ↓    ↓              ↓
┌───────┐ ┌──────┐ ┌──────────┐ ┌────────┐
│GET    │ │HANDLE│ │POST      │ │ERROR   │
│AUTH   │ │CALL  │ │CONTENT   │ │        │
│URL    │ │BACK  │ │          │ │        │
└───┬───┘ └───┬──┘ └────┬─────┘ └───┬────┘
    │         │         │            │
    └─────────┴─────────┴────────────┘
                   │
                   ↓
            ┌──────────┐
            │ FINALIZE │
            └──────────┘
                   │
                   ↓
                 [END]
```

#### States:

1. **ANALYZE_REQUEST**
   - Uses OpenAI to validate request parameters
   - Determines which action to take
   - Sets up conversation context

2. **GET_AUTH_URL**
   - Calls MCP server via MCP client
   - Invokes `getLinkedInAuthUrl` tool
   - Returns OAuth authorization URL and state

3. **HANDLE_CALLBACK**
   - Exchanges authorization code for tokens
   - Invokes `handleLinkedInAuthCallback` tool
   - Returns access and refresh tokens

4. **POST_CONTENT**
   - Posts content to LinkedIn
   - Invokes `postToLinkedIn` tool
   - Returns post result

5. **FINALIZE**
   - Prepares final response
   - Logs completion status

---

### 3. **MCP Client**

The MCP (Model Context Protocol) client dynamically discovers and invokes tools from the MCP server.

#### Key Features:

- **Tool Discovery**: Automatically discovers available tools from `http://3.141.18.225:3001/mcp/tools`
- **Dynamic Invocation**: Invokes tools by name with parameters
- **Retry Logic**: Implements exponential backoff for reliability
- **Caching**: Caches discovered tools for performance

#### Methods:

```python
async def discover_tools() -> Dict[str, Any]
async def get_tool_schema(tool_name: str) -> Optional[Dict[str, Any]]
async def invoke_tool(tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]
async def get_linkedin_auth_url(user_id: str) -> Dict[str, Any]
async def handle_linkedin_callback(code: str, user_id: str) -> Dict[str, Any]
async def post_to_linkedin(content: str, access_token: str, user_id: str) -> Dict[str, Any]
```

---

### 4. **Integration Service** (Port 8002)

Manages OAuth state, token storage, and coordinates with the Agent Service.

#### Responsibilities:
- Store OAuth state in Firestore for validation
- Call Agent Service for OAuth operations
- Save tokens to Firestore
- Handle OAuth callbacks and redirects
- Validate tokens before operations

---

## OAuth Flow Sequence

### Complete LinkedIn Authentication Flow:

```
1. User clicks "Connect to LinkedIn" on IntegrationPage
   │
   ↓
2. Frontend → API Gateway → Integration Service
   POST /api/integrations/linkedin/auth
   Headers: X-User-ID: <user_id>
   │
   ↓
3. Integration Service → Agent Service
   POST /agent/linkedin/get-auth-url
   Body: {"user_id": "<user_id>"}
   │
   ↓
4. Agent Service (LangGraph State Machine)
   ANALYZE_REQUEST → GET_AUTH_URL → FINALIZE
   │
   ↓
5. Agent Service → MCP Server
   POST /tools/getLinkedInAuthUrl/run
   Body: {"userId": "<user_id>"}
   │
   ↓
6. MCP Server returns OAuth URL + state
   │
   ↓
7. Integration Service stores state in Firestore
   Collection: oauth_states
   Document: <state>
   Data: {user_id, platform: 'linkedin', created_at, expires_at}
   │
   ↓
8. Returns auth_url to Frontend
   │
   ↓
9. Frontend opens popup with LinkedIn login
   │
   ↓
10. User authenticates on LinkedIn
    │
    ↓
11. LinkedIn redirects to callback URL
    GET /api/integrations/linkedin/callback?code=<code>&state=<state>
    │
    ↓
12. Integration Service validates state from Firestore
    │
    ↓
13. Integration Service → Agent Service
    POST /agent/linkedin/handle-callback
    Body: {"code": "<code>", "user_id": "<user_id>"}
    │
    ↓
14. Agent Service (LangGraph State Machine)
    ANALYZE_REQUEST → HANDLE_CALLBACK → FINALIZE
    │
    ↓
15. Agent Service → MCP Server
    POST /tools/handleLinkedInAuthCallback/run
    Body: {"code": "<code>", "userId": "<user_id>"}
    │
    ↓
16. MCP Server exchanges code for tokens
    Returns: {access_token, refresh_token, expires_at, platform_user_id}
    │
    ↓
17. Integration Service saves tokens to Firestore
    Collection: users
    Document: <user_id>
    Path: integrations.linkedin
    Data: {access_token, refresh_token, expires_at, connected: true, connected_at, platform_user_id}
    │
    ↓
18. Redirect to frontend with success
    URL: http://localhost:3000/dashboard/integration?status=success&platform=linkedin
    │
    ↓
19. Frontend closes popup and reloads integration status
```

---

## Configuration

### Environment Variables

Add to `.env`:

```bash
# OpenAI for Agent Service
OPENAI_API_KEY=your_openai_api_key_here

# MCP Server
MCP_SERVER_URL=http://3.141.18.225:3001

# Agent Service
AGENT_SERVICE_URL=http://localhost:8006

# Firebase (for token storage)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
```

---

## Benefits of AI Agent Architecture

### 1. **Loose Coupling**
- Integration service doesn't need to know MCP tool details
- Agent service handles tool discovery dynamically
- Easy to add new social platforms

### 2. **Intelligent Decision Making**
- OpenAI validates requests before execution
- Can handle error recovery intelligently
- Learns from patterns over time

### 3. **Maintainability**
- Clear separation of concerns
- State machine makes workflow explicit
- Easy to debug and monitor

### 4. **Scalability**
- Agent service can be horizontally scaled
- MCP server handles platform-specific logic
- Firestore provides reliable token storage

### 5. **Extensibility**
- Add new OAuth platforms by extending state machine
- MCP server can expose new tools dynamically
- Agent learns to use new tools automatically

---

## Testing

### Local Testing:

1. **Start Backend Services:**
   ```bash
   ./start-backend.sh
   ```

2. **Verify Agent Service:**
   ```bash
   curl http://localhost:8006/health
   ```

3. **Test MCP Tool Discovery:**
   ```bash
   curl http://localhost:8006/mcp/tools
   ```

4. **Start Frontend:**
   ```bash
   cd frontend && npm start
   ```

5. **Test LinkedIn OAuth:**
   - Navigate to http://localhost:3000
   - Sign in with Google
   - Go to Integrations page
   - Click "Connect to LinkedIn"
   - Authenticate in popup
   - Verify success message

---

## Troubleshooting

### Common Issues:

1. **Agent Service Won't Start:**
   - Check OPENAI_API_KEY is set in .env
   - Verify Python dependencies: `cd services/agent-service && pip install -r requirements.txt`

2. **MCP Server Unreachable:**
   - Verify MCP_SERVER_URL is correct: http://3.141.18.225:3001
   - Test connectivity: `curl http://3.141.18.225:3001/mcp/tools`

3. **Tokens Not Saving:**
   - Check Firebase credentials in .env
   - Verify Firestore rules allow writes

4. **OAuth Popup Blocked:**
   - Allow popups in browser settings
   - Check browser console for errors

---

## Future Enhancements

1. **Token Refresh Logic**: Implement automatic token refresh when expired
2. **Facebook & Twitter**: Extend agent to support additional platforms
3. **Analytics Integration**: Track OAuth success rates and user patterns
4. **Error Recovery**: Add automatic retry with exponential backoff
5. **Monitoring**: Add Prometheus metrics for agent performance

---

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Model Context Protocol](https://github.com/anthropics/mcp)
- [LinkedIn OAuth 2.0](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)

---

**Last Updated:** 2025-01-17
**Version:** 1.0.0
