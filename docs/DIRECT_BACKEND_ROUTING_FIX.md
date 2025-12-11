# Direct Backend Routing Fix

## Problem Summary

The LinkedIn authentication was failing with a **404 Not Found** error because:

1. **Frontend** was making requests to `/api/integrations/linkedin/auth`
2. **Frontend proxy** was routing ALL `/api/*` requests to the **API Gateway** (port 8000)
3. **API Gateway** did NOT have integration routes configured
4. **Backend Service** (port 8001) had the integration routes but was never reached

## Root Cause

The proxy configuration in `frontend/src/setupProxy.js` was routing all API requests to the API Gateway at `localhost:8000`, but the integration endpoints (LinkedIn, Facebook, Twitter OAuth) are actually implemented in the Backend Service at `localhost:8001`.

## Solution Implemented

### 1. Updated Frontend Proxy Configuration

**File**: `frontend/src/setupProxy.js`

Changed from:
- Single proxy: All `/api/*` → `localhost:8000` (API Gateway)

To:
- **Priority proxy**: `/api/integrations/*` → `localhost:8001` (Backend Service)
- **Fallback proxy**: `/api/*` → `localhost:8000` (API Gateway)

This ensures integration routes bypass the API Gateway and go directly to the Backend Service.

### 2. Fixed LinkedIn Redirect URI

**File**: `backend-service/app/config.py`

Changed:
```python
LINKEDIN_REDIRECT_URI = "http://localhost:8000/api/integrations/linkedin/callback"
```

To:
```python
LINKEDIN_REDIRECT_URI = "http://localhost:8001/api/integrations/linkedin/callback"
```

The OAuth callback must return to the Backend Service (port 8001) where the callback handler is implemented.

## Updated Request Flow

### Before (Broken)
```
Frontend (port 3000)
  ↓
  POST /api/integrations/linkedin/auth
  ↓
Proxy → API Gateway (port 8000) ❌ 404 Not Found
  ↓
Backend Service (port 8001) - Never reached!
```

### After (Fixed)
```
Frontend (port 3000)
  ↓
  POST /api/integrations/linkedin/auth
  ↓
Proxy → Backend Service (port 8001) ✅
  ↓
LinkedIn OAuth Flow
  ↓
Callback → Backend Service (port 8001) ✅
  ↓
Redirect → Frontend with success/error
```

## Service Architecture

```
┌─────────────────────────────────────────────────┐
│ Frontend (Port 3000)                            │
│ - React Application                             │
│ - Proxy Configuration in setupProxy.js         │
└─────────────────────────────────────────────────┘
                    │
                    ├─────────────────────────────────┐
                    │                                 │
         /api/integrations/*                  /api/* (other)
                    │                                 │
                    ↓                                 ↓
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Backend Service (Port 8001)  │    │ API Gateway (Port 8000)      │
│ - LinkedIn OAuth             │    │ - Future API routes          │
│ - Facebook OAuth             │    │ - Request routing            │
│ - Twitter OAuth              │    │ - Load balancing             │
│ - Social media posting       │    │                              │
│ - Token management           │    │                              │
└──────────────────────────────┘    └──────────────────────────────┘
```

## Files Modified

1. **frontend/src/setupProxy.js**
   - Added priority routing for `/api/integrations/*` to Backend Service
   - Kept fallback routing for other `/api/*` to API Gateway

2. **backend-service/app/config.py**
   - Updated `LINKEDIN_REDIRECT_URI` from port 8000 to 8001

3. **restart-services.sh** (Created)
   - New script to easily restart all services with updated configuration

## Testing the Fix

### 1. Verify Services are Running

```bash
# Check Backend Service
curl http://localhost:8001/health

# Check API Gateway
curl http://localhost:8000/health

# Check Frontend
curl http://localhost:3000
```

### 2. Test LinkedIn Authentication

1. Open the application at `http://localhost:3000`
2. Sign in with Firebase
3. Go to Integrations page
4. Click "Connect LinkedIn"
5. Should now successfully:
   - Make POST request to `/api/integrations/linkedin/auth`
   - Get routed to Backend Service (port 8001)
   - Receive LinkedIn OAuth URL
   - Open popup with LinkedIn login
   - Handle callback at `http://localhost:8001/api/integrations/linkedin/callback`
   - Redirect back to frontend with success

### 3. Monitor Logs

```bash
# View all logs
tail -f logs/centralized.log

# View Backend Service logs
tail -f logs/backend-service.log

# View Frontend logs
tail -f frontend/frontend.log
```

## Proxy Routing Rules

The frontend proxy now uses **route precedence**:

1. **Most Specific Match First**: `/api/integrations/*` → Backend Service (8001)
2. **General Match Second**: `/api/*` → API Gateway (8000)

Express.js processes middleware in order, so the more specific route is checked first.

## Expected Console Output

When clicking "Connect LinkedIn", you should see:

```
[FRONTEND] Starting LinkedIn Authentication
[FRONTEND] Correlation ID: 1731918441900-el9m2uua9
[FRONTEND] Fetching: /api/integrations/linkedin/auth
[Proxy-Integration] POST /api/integrations/linkedin/auth -> http://localhost:8001/api/integrations/linkedin/auth
[Proxy-Integration] Response: 200 for /api/integrations/linkedin/auth
[FRONTEND] Auth URL received: https://www.linkedin.com/oauth/v2/authorization...
[FRONTEND] Opening LinkedIn OAuth window...
```

## Environment Variables

No environment variable changes needed. The configuration uses default values:

```bash
BACKEND_SERVICE_PORT=8001  # Backend Service
API_GATEWAY_PORT=8000      # API Gateway (for future routes)
FRONTEND_PORT=3000         # React development server
```

## Benefits of This Approach

1. **Direct Communication**: Integration routes go directly to the service that handles them
2. **No 404 Errors**: Requests reach the correct service with the correct routes
3. **Scalable**: Easy to add more direct routes for other services in the future
4. **Flexible**: API Gateway can still be used for other purposes (authentication, rate limiting, etc.)
5. **Performance**: Removes unnecessary hop through API Gateway for integration routes

## Future Considerations

### Option 1: Keep Current Architecture (Recommended for Now)
- Frontend proxies directly to Backend Service for integrations
- Simple, works well for development
- Easy to understand and debug

### Option 2: Add Integration Routes to API Gateway
- Configure API Gateway to proxy `/api/integrations/*` to Backend Service
- Centralize all routing through API Gateway
- Requires additional configuration in API Gateway

### Option 3: Microservices with Service Discovery
- Use service mesh or API gateway with service discovery
- Each service registers itself
- Gateway automatically routes to correct service
- More complex, suitable for production with many services

## Troubleshooting

### If LinkedIn auth still fails with 404:

1. **Verify services are running**:
   ```bash
   lsof -i :8001  # Backend Service should be here
   lsof -i :3000  # Frontend should be here
   ```

2. **Check proxy configuration loaded**:
   - Look in `frontend/frontend.log` for:
   ```
   [setupProxy] Proxy middleware configured:
     - /api/integrations/* -> http://localhost:8001 (Backend Service)
   ```

3. **Restart frontend if proxy not loaded**:
   ```bash
   # Kill frontend process
   lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill
   
   # Restart
   cd frontend && npm start
   ```

4. **Check browser Network tab**:
   - Request URL should be: `http://localhost:3000/api/integrations/linkedin/auth`
   - Should return 200 with `auth_url` in response

5. **Verify backend has route**:
   ```bash
   curl -X POST http://localhost:8001/api/integrations/linkedin/auth \
     -H "X-User-ID: test" \
     -H "Content-Type: application/json"
   ```

## Conclusion

The fix establishes direct communication between the frontend and Backend Service for integration routes, bypassing the API Gateway for OAuth flows. This resolves the 404 errors and enables LinkedIn authentication to work correctly.

**Status**: ✅ **FIXED** - LinkedIn authentication now reaches the correct service endpoint.
