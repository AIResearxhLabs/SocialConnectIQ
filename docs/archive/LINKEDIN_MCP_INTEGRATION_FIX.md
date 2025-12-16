# LinkedIn MCP Integration Fix

## Problem Identified

The LinkedIn authentication was using a **hardcoded, incorrect APP_ID** (`78v112zg0kgjeb`) that was set as a default value in the backend configuration. This APP_ID belonged to a different project configuration (possibly from the MCP social container's internal setup).

### Root Cause

1. **Hardcoded Default in Config**: The file `backend-service/app/config.py` had the wrong LinkedIn APP_ID hardcoded as a fallback default
2. **Manual URL Construction**: The LinkedIn integration was manually constructing the OAuth URL instead of using the MCP container
3. **Duplicate Configuration**: LinkedIn credentials were stored in multiple places, violating the Single Source of Truth principle

## Solution Implemented

### Architecture Change

**Before**: Backend service manually constructed LinkedIn OAuth URLs using hardcoded credentials
```
Frontend → Backend Service → LinkedIn (using wrong APP_ID: 78v112zg0kgjeb)
```

**After**: Backend service delegates OAuth URL generation to MCP container
```
Frontend → Backend Service → MCP Container (localhost:3001) → LinkedIn (using correct APP_ID: 77yvmo0lqui9yg)
```

### Files Modified

#### 1. `backend-service/app/integrations/linkedin.py`

**Changes to `/auth` endpoint:**
- ✅ Replaced manual OAuth URL construction with `mcp_client.get_linkedin_auth_url()`
- ✅ Removed dependency on `config.LINKEDIN_CLIENT_ID`, `config.LINKEDIN_REDIRECT_URI`
- ✅ Added proper error handling for MCP container communication

**Changes to `/callback` endpoint:**
- ✅ Replaced manual token exchange with `mcp_client.handle_linkedin_callback()`
- ✅ MCP container now handles the OAuth code exchange and returns token data
- ✅ Backend service only stores the tokens in Firestore for its own use
- ✅ Improved error messages for better debugging

#### 2. `backend-service/app/config.py`

**Removed:**
```python
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "78v112zg0kgjeb")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "...")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI", "...")
```

**Kept:**
- `MCP_SERVER_URL` - For connecting to the MCP container
- `MCP_SERVER_TIMEOUT` - For timeout configuration

## Benefits

1. ✅ **Single Source of Truth**: LinkedIn APP_ID is configured only in the MCP container
2. ✅ **Correct Credentials**: Uses the correct APP_ID `77yvmo0lqui9yg` from MCP tools
3. ✅ **No Duplication**: Credentials aren't scattered across multiple services
4. ✅ **Maintainable**: Changes to OAuth config only need to happen in the MCP container
5. ✅ **Centralized**: All social platform OAuth flows now consistently use the MCP container

## MCP Container Configuration

The MCP container at `localhost:3001` is configured with the correct LinkedIn credentials:
- **APP_ID**: `77yvmo0lqui9yg`
- **Redirect URI**: Configured in MCP container
- **Scopes**: `openid profile email w_member_social`

## Testing the Fix

### Prerequisites
1. Ensure MCP container is running at `localhost:3001`
2. Verify MCP container has the correct LinkedIn APP_ID configured
3. Backend service must be restarted to load the changes

### Test Steps

1. **Start the services:**
   ```bash
   ./restart-services.sh
   ```

2. **Navigate to Integration Page:**
   - Open `http://localhost:3000/dashboard/integration`
   - Click "Connect LinkedIn"

3. **Verify OAuth URL:**
   - Check browser console logs for the auth URL
   - The URL should contain `client_id=77yvmo0lqui9yg`
   - The popup should open LinkedIn's OAuth page

4. **Complete Authentication:**
   - Login to LinkedIn
   - Authorize the application
   - Verify successful redirect back to the application

### Debugging

If authentication fails, check:

1. **MCP Container Logs:**
   ```bash
   docker logs <mcp-container-name>
   ```

2. **Backend Service Logs:**
   ```bash
   tail -f logs/centralized.log | grep linkedin
   ```

3. **Browser Console:**
   - Check for correlation IDs
   - Look for error messages from the backend

4. **Verify MCP Container:**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/tools
   ```

## API Flow

### Authentication Flow

1. **Frontend → Backend**: `POST /api/integrations/linkedin/auth`
2. **Backend → MCP**: `POST /tools/getLinkedInAuthUrl/run`
3. **MCP → Backend**: Returns auth URL with correct APP_ID
4. **Backend → Frontend**: Returns auth URL
5. **Frontend**: Opens OAuth popup with LinkedIn
6. **User**: Authorizes application
7. **LinkedIn → Backend**: `GET /api/integrations/linkedin/callback?code=...&state=...`
8. **Backend → MCP**: `POST /tools/handleLinkedInAuthCallback/run`
9. **MCP → Backend**: Returns access token and user info
10. **Backend**: Saves tokens to Firestore
11. **Backend → Frontend**: Redirects to success page

### MCP Tools Used

| Tool Name | Purpose | Parameters |
|-----------|---------|------------|
| `getLinkedInAuthUrl` | Generate OAuth authorization URL | `{userId: string}` |
| `handleLinkedInAuthCallback` | Exchange code for tokens | `{code: string, userId: string}` |
| `postToLinkedIn` | Post content to LinkedIn | `{content: string, accessToken: string, userId: string}` |

## Environment Variables

### Required in `.env`
```bash
# MCP Server Configuration
MCP_SERVER_URL=http://localhost:3001
MCP_SERVER_TIMEOUT=30

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000
```

### No Longer Required
```bash
# These are NOT needed anymore (handled by MCP container)
# LINKEDIN_CLIENT_ID=...
# LINKEDIN_CLIENT_SECRET=...
# LINKEDIN_REDIRECT_URI=...
```

## Rollback Plan

If issues occur, you can temporarily revert to manual OAuth URL construction:

1. Restore the hardcoded credentials in `config.py`
2. Restore manual URL construction in `linkedin.py`
3. Restart backend service

However, this should only be done as a temporary measure while debugging the MCP container.

## Future Considerations

### Other Social Platforms

Consider migrating Facebook and Twitter integrations to use the same MCP-based approach:
- Consistent architecture across all platforms
- Single source of truth for all OAuth credentials
- Easier to manage and maintain

### State Management

The current implementation still uses local state management for CSRF protection. Consider:
- Moving state management to MCP container
- Using a shared Redis instance for state storage
- Implementing state expiration and cleanup

---

**Date**: 2025-01-18  
**Author**: Cline AI Assistant  
**Status**: ✅ Implemented and Ready for Testing
