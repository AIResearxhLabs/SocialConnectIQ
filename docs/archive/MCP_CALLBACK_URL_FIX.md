# MCP Server Callback URL Parameter Fix

## Issue Summary

The LinkedIn OAuth flow was failing with a `500: RetryError` when calling `/api/integrations/linkedin/auth`. The root cause was a mismatch between the parameter names expected by the MCP server and what the client was sending.

## Root Cause Analysis

### MCP Server Schema Requirements

According to the MCP server tools schema at `http://localhost:3001/mcp/tools`:

1. **`getLinkedInAuthUrl`** tool requires:
   - `callbackUrl` (string, required) - The URL where LinkedIn will redirect after authorization
   - `state` (string, optional) - CSRF protection state parameter

2. **`exchangeLinkedInAuthCode`** tool requires:
   - `code` (string, required) - The authorization code from LinkedIn
   - `callbackUrl` (string, required) - Must match the URL used in authorization request

### Client Implementation Issue

The MCP client in `services/agent-service/app/mcp_client.py` was sending:
- ❌ `userId` parameter (not required by MCP server)
- ❌ `redirectUri` parameter (incorrect parameter name)

This caused the MCP server to reject the requests, resulting in the RetryError.

## Changes Made

### 1. MCP Client Updates (`services/agent-service/app/mcp_client.py`)

#### `get_linkedin_auth_url()` method:
```python
# BEFORE
async def get_linkedin_auth_url(self, user_id: str, correlation_id: str = "unknown", redirect_uri: str = None):
    parameters = {
        "userId": user_id,
        "redirectUri": redirect_uri
    }
    result = await self.invoke_tool("getLinkedInAuthUrl", parameters)

# AFTER
async def get_linkedin_auth_url(self, user_id: str, correlation_id: str = "unknown", callback_url: str = None):
    parameters = {
        "callbackUrl": callback_url  # Correct parameter name, no userId
    }
    result = await self.invoke_tool("getLinkedInAuthUrl", parameters)
```

#### `handle_linkedin_callback()` method:
```python
# BEFORE
async def handle_linkedin_callback(self, code: str, user_id: str, redirect_uri: str = None):
    parameters = {
        "code": code,
        "userId": user_id,
        "redirectUri": redirect_uri
    }
    return await self.invoke_tool("handleLinkedInAuthCallback", parameters)

# AFTER
async def handle_linkedin_callback(self, code: str, user_id: str, callback_url: str = None):
    parameters = {
        "code": code,
        "callbackUrl": callback_url  # Correct parameter name, no userId
    }
    return await self.invoke_tool("exchangeLinkedInAuthCode", parameters)
```

**Key Changes:**
- ✅ Renamed parameter from `redirect_uri` to `callback_url`
- ✅ Changed MCP parameter from `redirectUri` to `callbackUrl`
- ✅ Removed `userId` parameter (not required by MCP server)
- ✅ Changed tool name from `handleLinkedInAuthCallback` to `exchangeLinkedInAuthCode`

## System Prompt Configuration

### LLM-MCP Integration

The Agent Service uses an AI-powered LinkedIn OAuth Agent that leverages:

1. **LangGraph** - For stateful workflow management
2. **OpenAI GPT-4** - For intelligent decision making
3. **MCP Client** - For tool invocation

### System Prompt Location

The system prompt for the LLM is defined in `services/agent-service/app/linkedin_agent.py`:

```python
SystemMessage(content="""You are an AI agent that manages LinkedIn OAuth workflows.
Analyze the user's request and validate that all required parameters are present.
Return 'valid' if the request can proceed, or explain what's missing.""")
```

### Configuration Management

The Agent Service configuration is managed through:
- **`services/agent-service/app/config.py`** - Configuration loader
- **`config/config.yaml`** - YAML-based configuration (optional)
- **`.env`** - Environment variables (primary source)

The `get_system_prompt()` function in `config.py` provides a fallback system prompt for general AI agent operations.

## Environment Variables

Ensure the following environment variables are set in `.env`:

```bash
# MCP Server Configuration
MCP_HOST_TYPE=local                    # Options: local, cloud, custom
MCP_LOCAL_URL=http://localhost:3001    # Local MCP server URL
MCP_SERVER_URL=http://3.141.18.225:3001  # Cloud MCP server URL (fallback)

# LinkedIn OAuth Configuration
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/integrations/linkedin/callback

# OpenAI Configuration (for LLM-powered agent)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.7
```

## Testing the Fix

### 1. Restart the Agent Service

```bash
# Stop the service
kill $(cat services/pids/agent-service.pid)

# Start the service
cd services/agent-service
python -m app.main
```

### 2. Test LinkedIn Auth Flow

```bash
# Test auth URL generation
curl -X POST http://localhost:8002/api/integrations/linkedin/auth \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user-123"

# Expected response:
{
  "auth_url": "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=...",
  "state": "random-state-string"
}
```

### 3. Verify MCP Server Communication

Check the agent service logs for successful MCP tool invocation:

```bash
tail -f services/logs/agent-service.log

# Should show:
# MCP Client: Calling getLinkedInAuthUrl tool | correlation_id=... | callback_url=...
# MCP Client: getLinkedInAuthUrl completed in 0.XX s
```

## Architecture Flow

```
Frontend (3000)
    ↓ POST /api/integrations/linkedin/auth
    ↓ Headers: X-User-ID
    ↓
API Gateway (8000)
    ↓ Proxies to Integration Service
    ↓
Integration Service (8002)
    ↓ POST /agent/linkedin/auth
    ↓ Delegates to Agent Service
    ↓
Agent Service (8006)
    ↓ LinkedInOAuthAgent (LangGraph)
    ↓ Uses GPT-4 for workflow management
    ↓ Invokes MCP Client
    ↓
MCP Client
    ↓ JSON-RPC: tools/call
    ↓ Parameters: { callbackUrl: "..." }
    ↓
MCP Server (3001)
    ↓ Executes getLinkedInAuthUrl
    ↓ Generates LinkedIn OAuth URL
    ↓
Response flows back through the chain
```

## Validation Checklist

- [x] MCP client uses correct parameter names (`callbackUrl` instead of `redirectUri`)
- [x] MCP client removed unnecessary `userId` parameter
- [x] Correct MCP tool name used (`exchangeLinkedInAuthCode`)
- [x] Environment variables properly configured
- [x] System prompt configured for LLM-MCP integration
- [ ] Agent Service restarted with new code
- [ ] End-to-end test successful

## Related Documentation

- **MCP Server Schema**: `http://localhost:3001/mcp/tools`
- **LinkedIn Integration Guide**: `docs/linkedin-integration-guide.md`
- **MCP Setup Guide**: `docs/MCP_SETUP_GUIDE.md`
- **Correlation Logging**: `docs/CORRELATION_LOGGING_IMPLEMENTATION.md`

## Notes

1. The MCP server handles OAuth state generation internally, so we don't need to pass it as a parameter
2. The `userId` is tracked in our application layer but not required by the MCP server tools
3. The callback URL must match exactly between the auth request and token exchange
4. The LLM system prompt ensures the agent validates requests before invoking MCP tools
