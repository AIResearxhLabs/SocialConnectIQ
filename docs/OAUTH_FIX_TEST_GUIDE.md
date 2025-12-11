# OAuth Popup Callback Fix - Testing Guide

## ✅ Changes Applied

The following files have been updated to fix the OAuth popup callback issue:

1. **frontend/public/oauth-callback.html** (NEW)
   - Dedicated callback page with auto-close functionality
   - PostMessage communication with parent window
   - Beautiful success/error UI

2. **services/integration-service/app/main.py**
   - Updated all 13 redirect URLs to use `oauth-callback.html`
   - LinkedIn: 11 redirects updated
   - Facebook: 2 redirects updated
   - Twitter: 2 redirects updated

3. **frontend/src/pages/IntegrationPage.tsx**
   - Added PostMessage listener for popup communication
   - Removed old URL parameter checking logic
   - Added security origin validation

## 🔄 Service Status

According to your terminal output:
- ✅ Backend services are running (started with `./start-backend.sh`)
- ✅ Integration Service: http://localhost:8002 (PID: 66352)
- ✅ Agent Service: http://localhost:8006 (PID: 66386)
- ✅ API Gateway: http://localhost:8000 (PID: 66420)

## 🧪 Testing Steps

### 1. Ensure Frontend is Running

```bash
cd frontend
npm start
```

The frontend should be accessible at: http://localhost:3000

### 2. Navigate to Integration Page

1. Open browser: http://localhost:3000
2. Sign in (if not already signed in)
3. Go to: Dashboard → Integrations

### 3. Test LinkedIn OAuth Flow

1. **Click "Connect LinkedIn"** button
2. **Expected behavior:**
   - ✅ Popup window opens with LinkedIn OAuth page
   - ✅ You authenticate on LinkedIn
   - ✅ LinkedIn redirects to callback
   - ✅ Popup shows success message (purple gradient background with checkmark)
   - ✅ Popup automatically closes after 1.5 seconds
   - ✅ Main dashboard updates to show "Connected" status with green chip
   - ✅ Success alert appears at top of page

### 4. What to Watch in Console

**Frontend Console (F12 → Console):**
```
🎯 [INTEGRATION-PAGE] User clicked "Connect LinkedIn"
🪟 [INTEGRATION-PAGE] Opening OAuth popup window
📩 [INTEGRATION-PAGE] Received message from popup
✅ [INTEGRATION-PAGE] OAuth success for linkedin
📊 [INTEGRATION-PAGE] Loading updated integration statuses...
```

**Popup Window Console (when it's open):**
```
🔄 [OAUTH-CALLBACK] OAuth callback page loaded
📋 [OAUTH-CALLBACK] URL Parameters: {status: 'success', platform: 'linkedin'}
👨‍👦 [OAUTH-CALLBACK] Parent window found, sending message
✅ [OAUTH-CALLBACK] Message sent to parent window
🚪 [OAUTH-CALLBACK] Closing popup window now
```

**Backend Logs (services/logs/integration-service.log):**
```
🔄 [INTEGRATION-SERVICE] LinkedIn Callback Received
✅ [INTEGRATION-SERVICE] Tokens saved successfully to Firestore!
🔙 [INTEGRATION-SERVICE] Redirecting to: http://localhost:3000/oauth-callback.html?status=success&platform=linkedin
```

## 🐛 Troubleshooting

### Issue: Popup doesn't close

**Check:**
1. Look at popup console - does it show "Parent window found"?
2. Check if PostMessage is being sent
3. Verify parent window is listening (check main console)

**Solution:**
- Refresh both main window and try again
- Clear browser cache
- Check browser console for errors

### Issue: Still redirecting to old URL

**Symptoms:**
- URL shows `/dashboard/integration?status=...` instead of `/oauth-callback.html?status=...`

**Solution:**
```bash
# Restart integration service
./stop-backend.sh
./start-backend.sh

# Or use the dedicated script
./scripts/restart-integration-service.sh
```

### Issue: "Connected" status not showing

**Check:**
1. Open browser dev tools → Network tab
2. Look for request to `/api/integrations/linkedin/status`
3. Check response - does it show `"connected": true`?

**Solution:**
- Check backend logs for Firestore errors
- Verify Firebase credentials in `.env`
- Check browser console for errors

### Issue: Popup blocked

**Symptoms:**
- Console shows "Popup window blocked!"

**Solution:**
1. Allow popups for localhost:3000
2. Look for popup blocker icon in browser address bar
3. Click and allow popups for this site

## 📊 Expected Results

### Before Fix
- ❌ Popup redirects to main dashboard page
- ❌ Popup stays open, user must close manually
- ❌ Dashboard doesn't update automatically
- ❌ User must refresh page to see "Connected" status

### After Fix
- ✅ Popup shows beautiful success page
- ✅ Popup closes automatically after 1.5 seconds
- ✅ Dashboard updates immediately
- ✅ "Connected" status shows with green chip
- ✅ Success alert appears

## 🔐 Security Notes

1. **Origin Validation:** The parent window validates message origin before processing
2. **State Token:** Backend validates state token against Firestore
3. **One-Time Use:** State tokens are deleted after use
4. **Expiration:** State tokens expire after 10 minutes

## 📝 Additional Tests

### Test Error Scenarios

1. **Invalid State:**
   - Manually open: `http://localhost:8002/api/integrations/linkedin/callback?code=test&state=invalid`
   - Expected: Popup shows error message
   - Expected: Popup closes after 3 seconds

2. **Network Error:**
   - Stop backend services
   - Try to connect LinkedIn
   - Expected: Error alert in main window

3. **Browser Compatibility:**
   - Test in Chrome ✅
   - Test in Firefox ✅
   - Test in Safari ⚠️ (may require manual close)
   - Test in Edge ✅

## 📞 Support

If issues persist:
1. Check `services/logs/integration-service.log`
2. Check browser console (F12)
3. Verify all services are running: `ps aux | grep uvicorn`
4. Review full documentation: `docs/OAUTH_POPUP_CALLBACK_FIX.md`

## ✨ Success Criteria

The fix is working correctly when:
- [ ] Popup opens with LinkedIn OAuth
- [ ] User authenticates successfully
- [ ] Popup shows success message
- [ ] Popup closes automatically
- [ ] Main dashboard shows "Connected" status
- [ ] Success alert appears
- [ ] No manual intervention required

---

**Ready to test!** Start the frontend and try connecting LinkedIn. 🚀
