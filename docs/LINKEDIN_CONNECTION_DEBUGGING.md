# LinkedIn Connection Debugging Guide

## Issue Resolution Summary

**Problem:** LinkedIn "Connect" button was failing with a 404 error:
```
POST http://localhost:3000/api/integrations/linkedin/auth 404 (Not Found)
```

**Root Cause:** The services were running but needed to reload the updated code with comprehensive logging.

**Solution:** 
1. Added extensive console logging throughout the entire request flow
2. Restarted both API Gateway and Integration Service to pick up changes
3. Verified all endpoints are working correctly

---

## Comprehensive Logging Implementation

### 1. Frontend Logging (`frontend/src/api/social.ts`)

The `authenticateLinkedIn` function now logs:
- 🔵 Request initiation
- 🔑 Headers (with sensitive data masked)
- 📍 URL and method being called
- 📦 Response status and data
- ❌ Detailed error information

**Example Console Output:**
```
================================================================================
🔵 [FRONTEND] Starting LinkedIn Authentication
================================================================================
🔑 [FRONTEND] Headers created: { Content-Type: 'application/json', Authorization: '[PRESENT]', X-User-ID: 'user123' }
📍 [FRONTEND] Fetching: /api/integrations/linkedin/auth
📍 [FRONTEND] Method: POST
📦 [FRONTEND] Response Status: 200 OK
📦 [FRONTEND] Response OK: true
✅ [FRONTEND] Auth URL received: https://www.linkedin.com/oauth/v2/authorization...
✅ [FRONTEND] Opening LinkedIn OAuth window...
```

### 2. API Gateway Logging (`api-gateway/app/main.py`)

The LinkedIn auth route now logs:
- 🔵 Incoming request details
- 📍 Request URL, method, and headers
- 🔄 Headers being forwarded
- ✅ Response from Integration Service
- ❌ Detailed error information

**Example Console Output:**
```
================================================================================
🔵 [API GATEWAY] LinkedIn Auth Request Received
📍 Request URL: http://localhost:8000/api/integrations/linkedin/auth
📍 Request Method: POST
📍 Request Headers: {...}
📍 Forwarding to: http://localhost:8002/api/integrations/linkedin/auth
================================================================================

🔄 [API GATEWAY] Forwarding headers: {...}
✅ [API GATEWAY] Integration Service Response: 200
📦 [API GATEWAY] Response Body: {"auth_url":"..."}
```

### 3. Integration Service Logging (`services/integration-service/app/main.py`)

The LinkedIn auth endpoint now logs:
- 🟢 Endpoint hit confirmation
- 👤 User ID received
- 🔑 LinkedIn Client ID and Redirect URI
- 🎲 Generated OAuth state
- ⚠️ Firestore status
- 🌐 Generated auth URL
- ✅ Success confirmation

**Example Console Output:**
```
================================================================================
🟢 [INTEGRATION SERVICE] LinkedIn Auth Endpoint Hit!
👤 User ID: test-user-123
================================================================================

🔑 LinkedIn Client ID: 78v112zg0kgjeb
🔗 Redirect URI: http://localhost:8000/api/integrations/linkedin/callback
🎲 Generated State: OCfcNoHLAPkRlebE_zpL...
⚠️ Firestore not initialized - state not persisted
🌐 Generated Auth URL: https://www.linkedin.com/oauth/v2/authorization...
✅ [INTEGRATION SERVICE] Returning auth URL to client
```

---

## Request Flow Visualization

```
┌─────────────┐
│   Browser   │ (User clicks "Connect LinkedIn")
└──────┬──────┘
       │ 🔵 [FRONTEND] authenticateLinkedIn()
       │
       ▼
┌─────────────────────┐
│ Frontend (React)    │ POST /api/integrations/linkedin/auth
│ localhost:3000      │ Headers: { X-User-ID, Authorization }
└──────┬──────────────┘
       │ Proxy via setupProxy.js
       │
       ▼
┌─────────────────────┐
│ API Gateway         │ 🔵 Route: /api/integrations/linkedin/auth
│ localhost:8000      │ 🔄 Forward to Integration Service
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Integration Service │ 🟢 Handle LinkedIn Auth
│ localhost:8002      │ 🔑 Generate OAuth URL
└──────┬──────────────┘ 🎲 Create state token
       │                 💾 Store in Firestore
       │
       ▼
┌─────────────────────┐
│   Response          │ ✅ Return auth_url
│   { auth_url: ... } │
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│   Browser           │ 🌐 Open LinkedIn OAuth page
│   Redirects to      │
│   LinkedIn.com      │
└─────────────────────┘
```

---

## Debugging Checklist

When troubleshooting LinkedIn connection issues, check these in order:

### 1. ✅ Services Running
```bash
ps aux | grep -E "(uvicorn|python.*main.py)" | grep -v grep
```
Should show:
- API Gateway on port 8000
- Integration Service on port 8002

### 2. ✅ Health Checks
```bash
curl http://localhost:8000/health
curl http://localhost:8002/health
```
Both should return `{"status": "healthy", ...}`

### 3. ✅ Direct Endpoint Test
```bash
curl -X POST http://localhost:8000/api/integrations/linkedin/auth \
  -H "X-User-ID: test-user-123" \
  -H "Content-Type: application/json"
```
Should return: `{"auth_url": "https://www.linkedin.com/oauth/v2/authorization?..."}`

### 4. ✅ Browser Console
Open browser DevTools (F12) and check:
- Network tab for the actual request/response
- Console tab for our detailed logging
- Look for the colored emoji logs (🔵, 🔄, ✅, ❌)

### 5. ✅ Backend Logs
```bash
# API Gateway logs
tail -f api-gateway/logs/api-gateway.log

# Integration Service logs
tail -f services/logs/integration-service.log
```

---

## Common Issues and Solutions

### Issue 1: 404 Not Found
**Symptoms:** `POST http://localhost:3000/api/integrations/linkedin/auth 404`

**Causes:**
- Services not running
- Services running but on wrong ports
- Proxy configuration issue

**Solution:**
```bash
# Check services
ps aux | grep uvicorn

# Restart if needed
./stop-backend.sh
./start-backend-local.sh

# Verify
curl http://localhost:8000/health
```

### Issue 2: CORS Errors
**Symptoms:** Browser console shows CORS policy error

**Causes:**
- API Gateway CORS not configured for frontend origin
- Missing headers in proxy

**Solution:**
- Verify `api-gateway/app/main.py` has `allow_origins=["http://localhost:3000"]`
- Check `frontend/src/setupProxy.js` is properly configured

### Issue 3: Missing Headers
**Symptoms:** Backend logs show `X-User-ID` is missing or undefined

**Causes:**
- User not authenticated in frontend
- Headers not being passed through proxy

**Solution:**
- Ensure user is signed in (check `AuthContext`)
- Verify `createHeaders()` function includes `X-User-ID`
- Check proxy is not filtering out custom headers

### Issue 4: Firestore Warning
**Symptoms:** `⚠️ Firestore not initialized - state not persisted`

**Impact:** OAuth state won't be validated on callback (security risk)

**Solution:**
- Add Firebase credentials to `.env`:
  ```
  FIREBASE_PROJECT_ID=your-project-id
  FIREBASE_PRIVATE_KEY=your-private-key
  FIREBASE_CLIENT_EMAIL=your-client-email
  ```
- Restart Integration Service

---

## Testing the Complete Flow

### Manual Test Procedure

1. **Start all services:**
   ```bash
   ./start-backend-local.sh
   cd frontend && npm start
   ```

2. **Open browser with DevTools (F12)**
   - Navigate to `http://localhost:3000`
   - Sign in with your test account

3. **Go to Integration page**
   - Click "Settings" or "Integration" in the menu
   - Find the LinkedIn section

4. **Click "Connect LinkedIn"**
   - Watch the console for colored logs
   - Should see logs from FRONTEND → PROXY → API GATEWAY → INTEGRATION SERVICE

5. **Verify OAuth redirect**
   - Browser should redirect to `linkedin.com/oauth/v2/authorization`
   - After authentication, should return to your app

6. **Check backend logs:**
   ```bash
   # Terminal 1: API Gateway
   tail -f api-gateway/logs/api-gateway.log
   
   # Terminal 2: Integration Service
   tail -f services/logs/integration-service.log
   ```

### Expected Log Sequence

```
[FRONTEND] 🔵 Starting LinkedIn Authentication
[FRONTEND] 📍 Fetching: /api/integrations/linkedin/auth
[PROXY] Proxying POST /api/integrations/linkedin/auth -> http://localhost:8000
[API GATEWAY] 🔵 LinkedIn Auth Request Received
[API GATEWAY] 🔄 Forwarding headers
[INTEGRATION SERVICE] 🟢 LinkedIn Auth Endpoint Hit!
[INTEGRATION SERVICE] 🔑 LinkedIn Client ID: 78v112zg0kgjeb
[INTEGRATION SERVICE] ✅ Returning auth URL to client
[API GATEWAY] ✅ Integration Service Response: 200
[FRONTEND] ✅ Auth URL received
[FRONTEND] ✅ Opening LinkedIn OAuth window...
```

---

## Environment Variables Reference

### Required for LinkedIn Integration

```bash
# .env file
LINKEDIN_CLIENT_ID=78v112zg0kgjeb
LINKEDIN_CLIENT_SECRET=WPL_AP1.0YmGU4kPL8dIiRQR.N3YxMg==
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/integrations/linkedin/callback

# Optional but recommended for production
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

---

## Service Restart Commands

```bash
# Stop all services
./stop-backend-local.sh

# Start all services
./start-backend-local.sh

# Restart individual services
cd api-gateway
kill $(cat pids/api-gateway.pid)
nohup venv/bin/uvicorn app.main:app --reload --port 8000 --log-level info > logs/api-gateway.log 2>&1 &
echo $! > pids/api-gateway.pid

cd services/integration-service
kill $(cat ../../services/pids/integration-service.pid)
nohup venv/bin/uvicorn app.main:app --reload --port 8002 --log-level info > ../../services/logs/integration-service.log 2>&1 &
echo $! > ../../services/pids/integration-service.pid
```

---

## Success Criteria

✅ All services show as "healthy"  
✅ curl test returns valid auth_url  
✅ Browser console shows complete log sequence  
✅ No 404 or CORS errors  
✅ LinkedIn OAuth page loads successfully  
✅ Callback redirects back to app with success status  

---

## Additional Resources

- [LinkedIn OAuth Documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [FastAPI CORS Configuration](https://fastapi.tiangolo.com/tutorial/cors/)
- [React Proxy Configuration](https://create-react-app.dev/docs/proxying-api-requests-in-development/)
