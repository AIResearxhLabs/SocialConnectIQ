# 🔗 LinkedIn OAuth Integration Guide

## Overview

This guide explains the complete LinkedIn OAuth integration implementation, including how authentication works, token storage in Firestore, and how to use the stored tokens for posting.

---

## Architecture

### Flow Diagram

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Frontend  │         │ Integration      │         │ MCP Server  │
│   (React)   │◄────────┤   Service        │◄────────┤ (AWS)       │
└──────┬──────┘         └────────┬─────────┘         └─────────────┘
       │                         │
       │                         │
       │                    ┌────▼─────┐
       │                    │ Firestore│
       │                    │  (Tokens)│
       └────────────────────┤          │
                            └──────────┘
```

### Components

1. **Frontend (IntegrationPage.tsx)**: User interface for connecting/disconnecting accounts
2. **Integration Service**: Handles OAuth flow and token management
3. **MCP Server**: External service providing LinkedIn API integration
4. **Firestore**: Secure storage for OAuth tokens

---

## Implementation Details

### 1. Frontend Integration

#### File: `frontend/src/pages/IntegrationPage.tsx`

**Key Features:**
- Real-time connection status checking
- OAuth popup window management
- Success/error handling with user feedback
- Auto-refresh after authentication

**User Flow:**
1. User clicks "Connect LinkedIn"
2. OAuth popup window opens
3. User authenticates on LinkedIn
4. Popup closes automatically
5. Connection status updates

**Code Example:**
```typescript
const handleAuthentication = async (platform: PlatformConfig) => {
  const authUrl = await platform.authenticateFn();
  
  const popup = window.open(
    authUrl,
    'LinkedIn Authentication',
    'width=600,height=700,...'
  );
  
  // Monitor popup closure
  const checkPopupClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkPopupClosed);
      loadIntegrationStatuses(); // Refresh connection status
    }
  }, 500);
};
```

---

### 2. API Client

#### File: `frontend/src/api/social.ts`

**Authentication Headers:**
- Uses Firebase Authentication for user identity
- Passes user ID in `X-User-ID` header
- Includes JWT token in `Authorization` header

**Available Functions:**

| Function | Purpose | Parameters |
|----------|---------|------------|
| `authenticateLinkedIn()` | Initiate OAuth flow | None |
| `getLinkedInStatus()` | Check connection status | None |
| `disconnectLinkedIn()` | Remove connection | None |
| `postToLinkedIn(params)` | Post content | `{ content: string }` |

**Code Example:**
```typescript
// Authenticate
const authUrl = await authenticateLinkedIn();

// Check status
const status = await getLinkedInStatus();
// Returns: { connected: boolean, connected_at: timestamp }

// Post content
await postToLinkedIn({ content: "Hello LinkedIn!" });
```

---

### 3. Backend Service

#### File: `services/integration-service/app/main.py`

**OAuth Flow:**

1. **Initiate Auth** (`POST /api/integrations/linkedin/auth`)
   - Receives user ID from header
   - Calls MCP server to get auth URL
   - Stores OAuth state in Firestore for validation
   - Returns auth URL to frontend

2. **Handle Callback** (`GET /api/integrations/linkedin/callback`)
   - Validates OAuth state
   - Exchanges authorization code for tokens via MCP server
   - Stores tokens in Firestore
   - Redirects to frontend with success/error status

3. **Store Tokens in Firestore**
   ```python
   user_ref.set({
       'integrations': {
           'linkedin': {
               'access_token': token_data.get('access_token'),
               'refresh_token': token_data.get('refresh_token'),
               'expires_at': token_data.get('expires_at'),
               'connected': True,
               'connected_at': firestore.SERVER_TIMESTAMP,
               'platform_user_id': token_data.get('platform_user_id', ''),
           }
       }
   }, merge=True)
   ```

---

### 4. Firestore Data Structure

```json
{
  "users": {
    "[user_id]": {
      "email": "user@example.com",
      "integrations": {
        "linkedin": {
          "access_token": "encrypted_token",
          "refresh_token": "encrypted_refresh_token",
          "expires_at": 1234567890,
          "connected": true,
          "connected_at": "2025-11-17T12:00:00Z",
          "platform_user_id": "linkedin_user_id"
        },
        "facebook": { ... },
        "twitter": { ... }
      }
    }
  },
  "oauth_states": {
    "[state_string]": {
      "user_id": "user123",
      "platform": "linkedin",
      "created_at": "2025-11-17T12:00:00Z",
      "expires_at": 1234567890
    }
  }
}
```

---

### 5. Security Implementation

**OAuth State Validation:**
- Random state string generated for each auth request
- Stored in Firestore with 10-minute expiration
- Validated on callback to prevent CSRF attacks
- Automatically deleted after use

**Token Security:**
- Tokens stored in Firestore (server-side only)
- Never exposed to frontend
- Passed to MCP server for API calls
- User-specific access control via Firebase Auth

**Headers Required:**
```javascript
{
  'Authorization': 'Bearer <firebase-jwt-token>',
  'X-User-ID': '<firebase-user-id>',
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### LinkedIn Endpoints

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/integrations/linkedin/auth` | POST | Get OAuth URL | Yes |
| `/api/integrations/linkedin/callback` | GET | Handle OAuth callback | No |
| `/api/integrations/linkedin/status` | GET | Check connection | Yes |
| `/api/integrations/linkedin/post` | POST | Post content | Yes |
| `/api/integrations/linkedin/disconnect` | DELETE | Remove connection | Yes |

---

## Usage Examples

### 1. Connect LinkedIn Account

```typescript
// Frontend code
import { authenticateLinkedIn } from '../api/social';

// Initiate OAuth
const authUrl = await authenticateLinkedIn();

// Open popup
window.open(authUrl, 'LinkedIn Auth', 'width=600,height=700');
```

### 2. Check Connection Status

```typescript
import { getLinkedInStatus } from '../api/social';

const status = await getLinkedInStatus();

if (status.connected) {
  console.log('LinkedIn connected since:', status.connected_at);
} else {
  console.log('LinkedIn not connected');
}
```

### 3. Post to LinkedIn

```typescript
import { postToLinkedIn } from '../api/social';

try {
  const result = await postToLinkedIn({
    content: 'Exciting AI developments in 2025!'
  });
  console.log('Posted successfully:', result);
} catch (error) {
  if (error.message.includes('token expired')) {
    // Prompt user to re-authenticate
  }
}
```

### 4. Disconnect Account

```typescript
import { disconnectLinkedIn } from '../api/social';

await disconnectLinkedIn();
console.log('LinkedIn disconnected');
```

---

## Environment Configuration

### Required Environment Variables

```bash
# .env file
FIREBASE_PROJECT_ID=prjsyntheist
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@prjsyntheist.iam.gserviceaccount.com

MCP_SERVER_URL=http://3.135.209.100:3001
```

---

## Testing

### Manual Testing Steps

1. **Start Services:**
   ```bash
   # Frontend
   cd frontend && npm start
   
   # Integration Service
   cd services/integration-service
   source venv/bin/activate
   uvicorn app.main:app --reload --port 8002
   ```

2. **Test OAuth Flow:**
   - Navigate to http://localhost:3000/integrations
   - Click "Connect LinkedIn"
   - Complete authentication in popup
   - Verify "Connected" status appears

3. **Test Posting:**
   - Use the Composer page
   - Select LinkedIn as target
   - Post content
   - Verify post appears on LinkedIn

4. **Test Disconnect:**
   - Click "Disconnect" button
   - Verify status changes to "Not Connected"
   - Check Firestore to confirm token removal

---

## Troubleshooting

### Common Issues

**1. "User not authenticated" Error**
- Ensure user is logged in to Firebase
- Check that Firebase JWT token is valid
- Verify `X-User-ID` header is present

**2. "Token expired" Error**
- User needs to re-authenticate
- Direct them to the Integrations page
- Click "Connect LinkedIn" again

**3. OAuth Popup Blocked**
- Check browser popup blocker settings
- Ensure user initiated the action (not auto-triggered)

**4. "Invalid or expired state" Error**
- OAuth state expired (10-minute limit)
- Start authentication process again
- Check Firestore for state cleanup

**5. MCP Server Connection Failed**
- Verify MCP_SERVER_URL in .env
- Check network connectivity
- Confirm MCP server is running

---

## Future Enhancements

1. **Token Refresh**: Implement automatic token refresh before expiration
2. **Webhook Support**: Real-time updates for post engagement metrics
3. **Multi-Account**: Support multiple LinkedIn accounts per user
4. **Analytics**: Track OAuth success rates and common failure points
5. **Rate Limiting**: Implement per-user rate limiting for API calls

---

## References

- [LinkedIn OAuth 2.0 Documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

*Last Updated: November 17, 2025*
