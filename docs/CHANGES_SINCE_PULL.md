# Changes Since Last Pull

**Date**: January 10, 2026  
**Contributors**: Mohit + Team  

---

## Summary

We added **2 new microservices** and made **bug fixes** to enable AI-powered scheduling and image posting.

---

## 🆕 New Services

### 1. Analytics Service (Port 8004)
**Location**: `services/analytics-service/`

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI endpoints for analytics |
| `app/models.py` | Pydantic models (EngagementMetrics, PlatformStats) |
| `app/mock_data.py` | Mock data generator for demo |
| `requirements.txt` | Dependencies |

**Endpoints Added**:
- `GET /analytics/overview` - Summary cards
- `GET /analytics/trends` - Chart data (30-day)
- `GET /analytics/platforms` - Per-platform breakdown

---

### 2. Scheduling Service (Port 8003)
**Location**: `services/scheduling-service/`

Used by Agent Service to persist scheduled posts to Firestore.

---

## 🔧 Modified Files

### Agent Service (`services/agent-service/`)

| File | Change |
|------|--------|
| `app/main.py` | Added `image_data` and `image_mime_type` to `ChatRequest` model |
| `app/main.py` | Added direct call to Integration Service for LinkedIn image posts (bypasses MCP) |
| `app/main.py` | Added `import httpx` for HTTP calls |

**Why**: MCP tool `postToLinkedIn` doesn't support images. We route image posts directly to Integration Service's existing `/post-with-image` endpoint.

---

### Frontend (`frontend/src/`)

| File | Change |
|------|--------|
| `App.jsx` | Converts regenerated images to Base64 and sends with chat |
| `App.jsx` | Updated success notifications for scheduled posts |
| `api/social.js` | `chatWithAI()` now accepts `imageData` and `imageMimeType` |
| `api/analytics.js` | 🆕 New file - API client for Analytics Service |
| `pages/AnalyticsPage.jsx` | 🆕 New page with charts (Recharts) |
| `config/api.config.js` | Added `ANALYTICS_SERVICE_URL` |
| `App.jsx` | Fixed race condition: Added loading guard to prevent saving settings before Firestore data loads |

---

### Startup Scripts

| File | Change |
|------|--------|
| `start-all-services.py` | Added Analytics Service to startup sequence |
| `start-all-services.py` | Added auto UTF-8 encoding for Windows (no more `$env:PYTHONUTF8` needed) |
| `stop-all-services.py` | Added Analytics Service (port 8004) to stop list |
| `scripts/service_manager.py` | Fixed port release by killing child processes (uvicorn workers) first |

---

## 🚀 Deployment Checklist

To deploy these changes to production:

1. **Deploy Analytics Service** to GCP (Port 8004 or Cloud Run)
2. **Deploy Scheduling Service** to GCP (Port 8003 or Cloud Run)  
3. **Redeploy Agent Service** with the image-posting fix
4. **Update Frontend** environment variables with new service URLs
5. **Rebuild Frontend** and deploy static files

---

## 🆕 Real Analytics Integration (January 10, 2026)

### Analytics Service (`services/analytics-service/`)

| File | Change |
|------|--------|
| `app/platform_analytics.py` | 🆕 New file - Fetches real data from LinkedIn/Twitter APIs |
| `app/main.py` | Modified to accept `X-User-ID` header and use real data with mock fallback |
| `requirements.txt` | Added `firebase-admin>=6.2.0` |

**How it works:**
1. Posts made through SocialConnectIQ are saved to Firestore `scheduled_posts`
2. Analytics service reads from this collection to show:
   - Total post count
   - Posts per platform
   - Recent posts list
3. Note: Impressions/likes require LinkedIn Community Management API (not available on current app)

## ⚡ Scheduler Optimization & Collection Separation (January 10, 2026)

### Scheduler Service (`services/scheduling-service/`)

| File | Change |
|------|--------|
| `app/main.py` | Replaced user-loop with `collection_group` query (1 query vs N+1) |
| `app/main.py` | Successful posts now move from `scheduled_posts` → `posts` |

### Agent Service (`services/agent-service/`)

| File | Change |
|------|--------|
| `app/main.py` | Immediate posts now save to `posts` collection |

### Analytics Service (`services/analytics-service/`)

| File | Change |
|------|--------|
| `app/platform_analytics.py` | Reads from `posts` collection |

**New Data Model:**
```
users/{userId}/posts              → Published posts (analytics)
users/{userId}/scheduled_posts    → Pending scheduled posts (scheduler)
```

---

## ⚠️ Notes

- MCP Server was **not modified** (we don't have access to it)
- We used the **existing** `/api/integrations/linkedin/post-with-image` endpoint in Integration Service
- All changes are backward-compatible with existing functionality
