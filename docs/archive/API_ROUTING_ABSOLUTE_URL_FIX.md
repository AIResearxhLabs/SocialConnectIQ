# API Routing Fix: Absolute URL Implementation

## Problem Analysis

### Root Cause
The frontend was using **relative API paths** (e.g., `/api/integrations/linkedin/auth`) which caused the browser to make requests to the React dev server (`http://localhost:3000`) instead of the backend service (`http://localhost:8001`).

**Error Observed:**
```
GET http://localhost:3000/api/integrations/linkedin/auth 404 (Not Found)
```

### Why This Happened
1. **Relative URLs in fetch()**: Using paths like `/api/...` makes the browser resolve them relative to the current origin (React dev server)
2. **Proxy Configuration Issues**: The `setupProxy.js` configuration was in place but:
   - May not have been loaded properly by the React dev server
   - Created unnecessary complexity and indirection
   - Made debugging difficult

## Solution: Absolute URL Construction

### Approach
Instead of relying on proxy middleware, we now use **absolute URLs** constructed from environment variables.

### Implementation Components

#### 1. Environment Configuration (`frontend/.env.development`)
```env
REACT_APP_API_BASE_URL=http://localhost:8001
REACT_APP_GATEWAY_URL=http://localhost:8000
REACT_APP_DEBUG=true
```

#### 2. API Configuration Module (`frontend/src/config/api.config.ts`)
- Centralizes URL construction logic
- Provides helper functions: `buildBackendUrl()` and `buildGatewayUrl()`
- Supports environment-based configuration
- Includes debug logging

#### 3. Updated API Client (`frontend/src/api/social.ts`)
- All API calls now use absolute URLs via `buildBackendUrl()`
- Example:
  ```typescript
  // Before (Relative - WRONG)
  const response = await fetch('/api/integrations/linkedin/auth', {...});
  
  // After (Absolute - CORRECT)
  const url = buildBackendUrl('api/integrations/linkedin/auth');
  const response = await fetch(url, {...});
  // Results in: http://localhost:8001/api/integrations/linkedin/auth
  ```

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React @ localhost:3000)                              │
│                                                                  │
│  Component calls:                                                │
│  authenticateLinkedIn()                                          │
│         │                                                        │
│         ▼                                                        │
│  buildBackendUrl('api/integrations/linkedin/auth')               │
│         │                                                        │
│         ▼                                                        │
│  Returns: "http://localhost:8001/api/integrations/linkedin/auth"│
│         │                                                        │
│         ▼                                                        │
│  fetch(url, {method: 'POST', headers: {...}})                   │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Direct HTTP Request
                  │ (NO PROXY INVOLVED)
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend Service (FastAPI @ localhost:8001)                     │
│                                                                  │
│  Receives: POST /api/integrations/linkedin/auth                 │
│  Headers: Authorization, X-User-ID, X-Correlation-ID            │
│                                                                  │
│  Routes to: integrations/routes.py                              │
│         │                                                        │
│         ▼                                                        │
│  Processes authentication request                               │
│         │                                                        │
│         ▼                                                        │
│  Returns: { "auth_url": "https://linkedin.com/oauth/..." }     │
└─────────────────────────────────────────────────────────────────┘
```

## Benefits of This Approach

1. **✅ Clarity**: URLs are explicit and traceable in browser DevTools
2. **✅ Debugging**: Easy to see exactly where requests are going
3. **✅ Environment Flexibility**: Different URLs for dev/staging/prod via env vars
4. **✅ No Proxy Dependencies**: Eliminates complexity and potential proxy failures
5. **✅ CORS Handling**: Backend service already has proper CORS configuration
6. **✅ Performance**: Direct connection, no proxy overhead

## Configuration for Different Environments

### Development (Local)
```env
REACT_APP_API_BASE_URL=http://localhost:8001
```

### Staging
```env
REACT_APP_API_BASE_URL=https://api-staging.yourdomain.com
```

### Production
```env
REACT_APP_API_BASE_URL=https://api.yourdomain.com
```

## Testing the Fix

### 1. Verify Environment Variables
```bash
cd frontend
cat .env.development
```

### 2. Restart Frontend with Clean Build
```bash
# Stop the frontend
# Clear build cache
rm -rf node_modules/.cache

# Restart
npm start
```

### 3. Check Browser Console
You should see:
```
🔧 API Configuration Loaded:
   Backend Service: http://localhost:8001
   API Gateway:     http://localhost:8000
   Debug Mode:      true
```

### 4. Test LinkedIn Authentication
Click "Connect LinkedIn" and check browser DevTools Network tab:
- Request URL should be: `http://localhost:8001/api/integrations/linkedin/auth`
- NOT: `http://localhost:3000/api/integrations/linkedin/auth`

## Verification Checklist

- [x] Environment file created: `frontend/.env.development`
- [x] API config module created: `frontend/src/config/api.config.ts`
- [x] All API calls updated in: `frontend/src/api/social.ts`
- [ ] Backend service is running on port 8001
- [ ] Frontend can reach backend (no CORS errors)
- [ ] LinkedIn auth flow completes successfully
- [ ] MCP client-server communication works

## Troubleshooting

### Issue: Still getting 404 errors
**Solution**: Ensure backend service is running:
```bash
# Check if backend is running
ps aux | grep "uvicorn"

# Or check the PID file
cat backend-service/pids/backend-service.pid

# Restart if needed
./restart-services.sh
```

### Issue: CORS errors
**Solution**: Verify backend CORS configuration in `backend-service/app/config.py`:
```python
CORS_ORIGINS = ["http://localhost:3000", "http://localhost:8000"]
```

### Issue: Environment variables not loading
**Solution**: 
1. Restart the React dev server completely
2. Clear browser cache
3. Check that `.env.development` is in the `frontend/` directory

## Next Steps

1. **Test the complete flow**: Frontend → Backend → MCP Server → Backend → Frontend
2. **Monitor logs**: Check both frontend console and backend logs for correlation IDs
3. **Verify MCP communication**: Ensure backend can reach MCP server at configured URL
4. **Add error handling**: Implement retry logic and better error messages for network failures

## Related Files

- `frontend/.env.development` - Environment configuration
- `frontend/src/config/api.config.ts` - URL construction utilities
- `frontend/src/api/social.ts` - API client functions
- `backend-service/app/config.py` - Backend configuration
- `backend-service/app/integrations/routes.py` - Integration API routes
