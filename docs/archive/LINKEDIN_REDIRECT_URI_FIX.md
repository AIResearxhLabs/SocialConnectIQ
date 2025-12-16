# LinkedIn Redirect URI Configuration Fix

**Issue:** LinkedIn OAuth callback goes to MCP Server (`localhost:3001`) showing JSON response instead of redirecting back to the application.

---

## 🔴 Problem

When authenticating with LinkedIn, the callback URL is:
```
http://localhost:3001/api/auth/linkedin/callback?code=...&state=...
```

This returns a JSON response:
```json
{
  "message": "Successfully authenticated with LinkedIn!",
  "accessToken": "AQWsqr2O7tJjOMBx...",
  "expiresIn": 5183999
}
```

**But the popup doesn't close and doesn't redirect back to the frontend.**

## ✅ Solution

The LinkedIn redirect URI must point to the **Integration Service**, not the MCP Server.

### Step 1: Update LinkedIn App Configuration

Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) and update your app:

1. Click on your app (using Client ID: `78v112zg0kgjeb`)
2. Go to **Auth** tab
3. Under **Redirect URLs**, add/update:
   ```
   http://localhost:8000/api/integrations/linkedin/callback
   ```
4. **Remove** any redirect URLs pointing to `localhost:3001`
5. Click **Update**

### Step 2: Verify .env Configuration

The `.env` file has been updated with:
```bash
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/integrations/linkedin/callback
```

This ensures the Integration Service uses the correct redirect URI when generating the auth URL.

### Step 3: Understanding the Flow

**Correct Flow:**
```
1. User clicks "Connect LinkedIn" in Frontend
2. Frontend → API Gateway (port 8000) → Integration Service (port 8002)
3. Integration Service → Agent Service → MCP Server (generates auth URL)
4. Auth URL uses redirect_uri=http://localhost:8000/api/integrations/linkedin/callback
5. User authenticates with LinkedIn
6. LinkedIn redirects to: http://localhost:8000/api/integrations/linkedin/callback
7. API Gateway routes to Integration Service callback handler
8. Integration Service → Agent Service → MCP Server (exchanges code for token)
9. Integration Service saves to Firestore
10. Integration Service redirects to: http://localhost:3000/dashboard/integration?status=success
11. Popup closes, frontend shows "Connected"
```

**Why Port 8000?**
- API Gateway runs on port 8000
- Integration Service runs on port 8002
- API Gateway proxies `/api/integrations/*` to Integration Service
- LinkedIn must redirect to API Gateway (8000), which then routes internally to Integration Service (8002)

### Step 4: Verify API Gateway Routing

Check that API Gateway (`api-gateway/app/main.py`) properly routes Integration Service endpoints:

```python
# Should have a route like:
@app.api_route("/api/integrations/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def integration_service_proxy(request: Request, path: str):
    # Proxy to Integration Service
    ...
```

### Step 5: Test the Complete Flow

1. **Restart services** (important after .env changes):
   ```bash
   ./stop-backend.sh
   ./start-backend.sh
   ```

2. **Test LinkedIn OAuth**:
   - Open frontend: `http://localhost:3000`
   - Click "Connect LinkedIn"
   - Authenticate with LinkedIn
   - LinkedIn should redirect to `http://localhost:8000/api/integrations/linkedin/callback`
   - You should be redirected back to `http://localhost:3000/dashboard/integration?status=success`
   - Frontend should show "Connected" status

3. **Check logs** if it doesn't work:
   ```bash
   tail -f logs/api-gateway.log
   tail -f services/logs/integration-service.log
   ```

---

## 🔍 Troubleshooting

### Issue: Still redirecting to localhost:3001

**Cause:** LinkedIn app still has old redirect URI configured.

**Fix:** 
1. Go to LinkedIn Developer Portal
2. Remove all redirect URLs with `localhost:3001`
3. Add `http://localhost:8000/api/integrations/linkedin/callback`
4. Save changes
5. Wait 5 minutes for LinkedIn to propagate changes

### Issue: 404 Not Found on callback

**Cause:** API Gateway not routing correctly.

**Fix:**
1. Check API Gateway is running: `curl http://localhost:8000/health`
2. Check Integration Service is running: `curl http://localhost:8002/health`
3. Verify API Gateway routes in `api-gateway/app/main.py`

### Issue: Popup shows JSON instead of redirecting

**Cause:** MCP Server is handling the callback directly.

**Fix:**
1. The auth URL generation must use the correct redirect URI
2. Check Agent Service is passing the correct redirect URI to MCP Server
3. MCP Server might need to be configured to use Integration Service redirect URI

---

## 📝 Summary

**Key Changes:**
1. ✅ Added `LINKEDIN_REDIRECT_URI=http://localhost:8000/api/integrations/linkedin/callback` to `.env`
2. ⏳ **You must update LinkedIn Developer Portal** with the new redirect URI
3. ✅ Restart services after .env changes

**Critical:** The redirect URI in **LinkedIn Developer Portal** must exactly match `http://localhost:8000/api/integrations/linkedin/callback`.

**Next Steps:**
1. Update LinkedIn app redirect URI in Developer Portal
2. Restart backend services
3. Test the complete OAuth flow
4. Verify popup closes gracefully and shows success message
