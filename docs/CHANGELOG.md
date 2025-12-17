# 📋 SocialConnectIQ Changelog

All notable changes, fixes, and updates to this project are documented here.

---

## [Unreleased]

## [2025-12-17] - Cross-Platform Service Management Scripts

### Added
- **Cross-Platform Python Scripts** for service management
  - `start-all-services.py` - Starts all services on Windows, macOS, and Linux
  - `stop-all-services.py` - Stops all services on Windows, macOS, and Linux
  - `scripts/service_manager.py` - Core utility module with OS-agnostic functions
  - `requirements-scripts.txt` - Script dependencies (psutil, colorama)
  
### Features
- **Automatic OS Detection**: Scripts detect Windows, macOS, or Linux automatically
- **Cross-Platform Port Management**: Uses `psutil` instead of OS-specific commands
- **Virtual Environment Management**: Creates and activates venvs on any platform
- **Graceful Process Termination**: Attempts graceful shutdown before force kill
- **Health Checks**: Waits for services to be ready before proceeding
- **Colored Output**: Uses `colorama` for consistent colored terminal output
- **Error Handling**: Detailed error messages and recovery options
- **Background Execution**: Platform-specific process spawning (works on Windows)

### Changed
- **README.md**: Updated with cross-platform script instructions as recommended method
- **docs/SERVICE_MANAGEMENT.md**: Complete rewrite with cross-platform examples
  - Added Windows PowerShell commands alongside Unix commands
  - Updated all workflows to show both Windows and Unix approaches
  - Marked shell scripts as "Unix/macOS only" with clear warnings

### Technical Details

**OS-Specific Implementations:**
- **Port Checking**: `psutil.net_connections()` instead of `lsof` (Unix) or `netstat` (Windows)
- **Process Termination**: `psutil.Process.terminate()` instead of `kill -9` (Unix) or `taskkill` (Windows)
- **Virtual Environment**: Handles `venv/Scripts/` (Windows) vs `venv/bin/` (Unix)
- **Background Processes**: Uses `CREATE_NEW_PROCESS_GROUP` on Windows, `os.setsid` on Unix

**Service Manager Module Functions:**
- `find_process_on_port()` - Cross-platform port checking
- `kill_process_on_port()` - Graceful process termination with timeout
- `check_port_available()` - Port availability checking
- `wait_for_port()` - Service readiness validation
- `create_virtualenv()` - OS-agnostic venv creation
- `install_requirements()` - Dependency installation
- `start_uvicorn_service()` - Service startup with health checks
- `print_service_info()` - Formatted service status display

### Benefits
- ✅ **True cross-platform compatibility** - Single codebase works everywhere
- ✅ **Better error handling** - Structured exceptions and recovery
- ✅ **Graceful shutdown** - Attempts clean termination before force kill
- ✅ **Automatic setup** - Creates venvs and installs dependencies automatically
- ✅ **Health validation** - Waits for services to be ready
- ✅ **Consistent behavior** - No shell differences between platforms
- ✅ **Easier maintenance** - Python is easier to update than shell scripts

### Backward Compatibility
- Shell scripts (`.sh` files) remain functional for Unix/macOS users
- Python scripts are now the **recommended method** for all platforms
- Both methods documented in README and SERVICE_MANAGEMENT guide

### Files Created
1. `start-all-services.py` - Cross-platform startup script
2. `stop-all-services.py` - Cross-platform shutdown script
3. `scripts/service_manager.py` - Core utility module (350+ lines)
4. `requirements-scripts.txt` - Script dependencies

### Files Modified
1. `README.md` - Updated Section 5.3 with cross-platform instructions
2. `docs/SERVICE_MANAGEMENT.md` - Complete rewrite with OS-specific commands
3. `docs/CHANGELOG.md` - This entry

### Migration Guide for Users

**Windows Users (New):**
```bash
# Install dependencies
pip install -r requirements-scripts.txt

# Start services
python start-all-services.py

# Stop services
python stop-all-services.py
```

**macOS/Linux Users (Recommended):**
```bash
# Install dependencies
pip3 install -r requirements-scripts.txt

# Start services (Python - recommended)
python3 start-all-services.py

# Or use shell scripts (legacy)
./start-all-services.sh
```

### Next Steps
- Consider creating Windows batch files (`.bat`) as alternative to Python scripts
- Add service restart functionality to Python scripts
- Consider adding service health check utility script
- Add automated tests for cross-platform functionality

---

## [2025-12-15] - Complete Architecture Migration to Integration Service

### Changed
- **OAuth Code Migration** - All OAuth logic moved to Integration Service (port 8002)
  - **Moved Files:**
    - `backend-service/app/integrations/linkedin.py` → Already in `services/integration-service/app/main.py`
    - `backend-service/app/integrations/twitter.py` → Already in `services/integration-service/app/main.py`
    - `backend-service/app/integrations/storage.py` → `services/integration-service/app/storage.py`
  - **Deleted from Backend Service:**
    - `backend-service/app/integrations/linkedin.py` ✓
    - `backend-service/app/integrations/twitter.py` ✓
    - `backend-service/app/integrations/storage.py` ✓
  - **Backups Created:** `.migration-backup/` directory with all deleted files

- **API Gateway Routing** - All platform integrations now route to Integration Service
  - **Before (Inconsistent):**
    ```
    LinkedIn → API Gateway → Backend Service (8001) ✗
    Twitter  → API Gateway → Backend Service (8001) ✗
    Facebook → API Gateway → Integration Service (8002) ✓
    ```
  - **After (Consistent - Matches ARCHITECTURE.md):**
    ```
    LinkedIn → API Gateway → Integration Service (8002) ✓
    Twitter  → API Gateway → Integration Service (8002) ✓
    Facebook → API Gateway → Integration Service (8002) ✓
    ```

### Added
- **Disconnect Endpoints in Integration Service**
  - `DELETE /api/integrations/linkedin/disconnect` with OAuth cleanup
  - `DELETE /api/integrations/twitter/disconnect` with OAuth cleanup
  - Both use enhanced `token_storage.disconnect_platform()` method
  
- **Migration Script** (`migrate-to-integration-service.sh`)
  - Automated backup creation
  - Safe deletion of old files
  - Architecture validation summary

### Architecture Alignment
**Integration Service (8002) Now Owns:**
- ✅ All LinkedIn OAuth (auth, callback, status, post, disconnect)
- ✅ All Twitter OAuth (auth, callback, status, post, disconnect)
- ✅ All Facebook OAuth (auth, callback, status, post)
- ✅ Token storage and management (`storage.py`)
- ✅ OAuth state management with PKCE support

**Backend Service (8001) Now Owns:**
- ✅ Post preview generation (`content.py`)
- ✅ Business logic and orchestration
- ✅ Analytics and reporting
- ✅ User management

**Agent Service (8006) Remains:**
- ✅ ONLY service with MCP Client
- ✅ AI content refinement (OpenAI GPT-4o)
- ✅ Platform posting execution via MCP
- ✅ OAuth execution via MCP (when called by Integration Service)

### Benefits
- ✅ **100% alignment with ARCHITECTURE.md**
- ✅ **Single OAuth authority** (Integration Service)
- ✅ **Consistent routing** across all platforms
- ✅ **Cleaner codebase** (removed duplicate OAuth code)
- ✅ **Easier maintenance** (OAuth in one place)
- ✅ **Scalable pattern** for adding new platforms

### Files Modified
1. `services/integration-service/app/storage.py` - Created (moved from backend)
2. `services/integration-service/app/main.py` - Added disconnect endpoints
3. `api-gateway/app/main.py` - Updated all routing to Integration Service
4. `migrate-to-integration-service.sh` - Created migration script
5. Backend Service OAuth files - Deleted (backed up)

---

## [2025-12-15] - Architecture Documentation & Service Responsibilities

### Added
- **ARCHITECTURE.md** - Definitive service architecture reference document
  - Clear service responsibilities and boundaries
  - Complete request flow diagrams for all major operations
  - MCP communication patterns explained
  - Data ownership and storage structure
  - Decision rules for service selection
  - Common anti-patterns to avoid
  - Quick reference cheatsheet
  - Migration checklist for current code misplacement

### Purpose
This document resolves ongoing confusion about:
- Which service should handle specific functionality
- Who calls MCP Server (Answer: Only Agent Service)
- When Integration Service calls Agent Service
- Where OAuth tokens should be stored
- How services should communicate

### Key Clarifications
1. **Agent Service (8006)** = ONLY service with MCP Client
2. **Integration Service (8002)** = OAuth workflows + Token management
3. **Backend Service (8001)** = Business logic + Orchestration
4. **API Gateway (8000)** = Single entry point + Routing only

### Agreement
This architecture document is now the **binding reference** for all development. When confused about service responsibilities, developers and AI assistants must consult ARCHITECTURE.md first.

---

## [2025-12-15] - Platform-Agnostic Disconnect Architecture Fix

### Fixed
- **Twitter Disconnect 404 Error**
  - Issue: Twitter disconnect button returned 404 Not Found when called
  - Cause: API Gateway routing inconsistency between LinkedIn and Twitter
  - Root Cause: 
    - LinkedIn routes went to `INTEGRATION_SERVICE_URL` (port 8002)
    - Twitter routes went to `BACKEND_SERVICE_URL` (port 8001)
    - Both LinkedIn and Twitter integrations exist in Backend Service (port 8001)
    - Inconsistent routing caused Twitter disconnect to fail
  - Solution: Made architecture platform-agnostic by routing ALL platform integrations (LinkedIn, Twitter, Facebook) to Backend Service consistently
  - Files Modified:
    - `api-gateway/app/main.py` - Changed all LinkedIn routes from port 8002 to port 8001
    - Now LinkedIn and Twitter both route to `BACKEND_SERVICE_URL` consistently
  - Impact: Platform-agnostic architecture ensures all current and future integrations work identically

- **LinkedIn Auto-Reconnect After Disconnect**
  - Issue: After disconnecting LinkedIn, clicking "Connect" would auto-connect without user interaction
  - Cause: Orphaned OAuth states remained in Firestore after disconnect
  - Root Cause: `disconnect_platform()` only deleted tokens but left OAuth state documents, causing automatic reconnection from stale callbacks
  - Solution: Enhanced disconnect to clean up both tokens AND OAuth states
  - Files Modified:
    - `backend-service/app/integrations/storage.py` - Enhanced `disconnect_platform()` with OAuth state cleanup
  - Impact: Clean disconnect prevents unintended auto-reconnections

### Changed
- **Platform-Agnostic Service Routing**
  - **Before (Inconsistent)**:
    ```
    LinkedIn → API Gateway (8000) → Integration Service (8002) ✗
    Twitter  → API Gateway (8000) → Backend Service (8001) ✗
    ```
  - **After (Consistent)**:
    ```
    LinkedIn → API Gateway (8000) → Backend Service (8001) ✓
    Twitter  → API Gateway (8000) → Backend Service (8001) ✓
    Facebook → API Gateway (8000) → Backend Service (8001) ✓
    ```
  - All platform integrations now use identical architecture
  - Easier to add new platforms (consistent pattern)
  - Single source for all OAuth and posting logic

- **Enhanced Disconnect Logic**
  - `disconnect_platform()` now performs two-step cleanup:
    1. Delete platform integration tokens from user document
    2. Clean up orphaned OAuth states for user+platform combination
  - OAuth state cleanup is non-blocking (won't fail disconnect if cleanup fails)
  - Detailed logging for each step with correlation ID tracking
  - Prevents stale OAuth callbacks from causing auto-reconnection

### Technical Details

**Architecture Simplification:**
- Integration Service (8002): No longer used for platform OAuth (reserved for future use)
- Backend Service (8001): Centralized location for ALL platform integrations
- API Gateway (8000): Consistent routing to Backend Service for all platforms

**Disconnect Flow (Enhanced):**
1. User clicks "Disconnect" button
2. Frontend calls `disconnectLinkedIn()` or `disconnectTwitter()`
3. DELETE request → API Gateway (8000) → Backend Service (8001)
4. Backend Service calls `token_storage.disconnect_platform(user_id, platform)`
5. **Step 1**: Delete `integrations.{platform}` field from Firestore user document
6. **Step 2**: Query and delete all OAuth states where `user_id == user` AND `platform == platform`
7. Return success to frontend
8. Frontend updates UI to show "Connect [Platform]" button

**OAuth State Cleanup Details:**
- Firestore collection: `oauth_states`
- Query: `.where('user_id', '==', user_id).where('platform', '==', platform)`
- Deletes all matching documents (typically 0-1, but handles edge cases)
- Logs count of deleted states for monitoring
- Non-critical: If cleanup fails, disconnect still succeeds (logged as warning)

### Benefits
- ✅ Consistent architecture across all platforms
- ✅ Twitter disconnect now returns 200 (not 404)
- ✅ LinkedIn disconnect prevents auto-reconnect
- ✅ Easy to add new platforms (follow same pattern)
- ✅ Single codebase for all platform OAuth flows
- ✅ Reduced maintenance complexity

---

## [2025-12-15] - Twitter Disconnect Fix & Critical Architecture Correction

### Fixed
- **Twitter Integration**: Twitter disconnect button not working (404 Not Found)
  - Issue: Clicking "Disconnect" button for Twitter returned 404 from `http://localhost:8002`
  - Cause: Three-part issue:
    1. Missing `disconnectTwitter` function in frontend API module
    2. Missing `/api/integrations/twitter/disconnect` route in API Gateway
    3. **CRITICAL**: Frontend configured to bypass API Gateway and call port 8002 directly
  - Root Cause: `frontend/.env.development` had `REACT_APP_API_BASE_URL=http://localhost:8002` which bypasses the API Gateway. Port 8002 is Integration Service (LinkedIn only), so Twitter requests failed.
  - Solution: 
    1. Added `disconnectTwitter` function to `frontend/src/api/social.ts`
    2. Imported `disconnectTwitter` in `frontend/src/pages/IntegrationPage.tsx`
    3. Added `DELETE /api/integrations/twitter/disconnect` route in API Gateway
    4. **CRITICAL FIX**: Changed `REACT_APP_API_BASE_URL` from port 8002 to port 8000 (API Gateway)
  - Files Modified:
    - `frontend/src/api/social.ts` - Added disconnectTwitter function
    - `frontend/src/pages/IntegrationPage.tsx` - Added disconnect handler
    - `api-gateway/app/main.py` - Added Twitter disconnect route
    - `frontend/.env.development` - **Changed base URL from 8002 to 8000**
  - Impact: **All frontend requests now correctly go through API Gateway**, which routes to appropriate services

### Architecture Fix
- **CRITICAL CHANGE**: Frontend now uses API Gateway as single entry point
  - **Before**: `REACT_APP_API_BASE_URL=http://localhost:8002` (Integration Service - bypassed gateway)
  - **After**: `REACT_APP_API_BASE_URL=http://localhost:8000` (API Gateway - proper architecture)
  - **Why This Matters**: 
    - Integration Service (8002) only has LinkedIn routes
    - Twitter routes are in Backend Service (8001)
    - API Gateway (8000) properly routes all requests to correct services
    - This was causing ALL new Twitter APIs to fail with 404
  - **Impact**: This fixes the recurring issue where "every time you implement new API same issue" - now all APIs will work correctly through the gateway

### Technical Details
**Disconnect Flow:**
1. User clicks "Disconnect" on Twitter card
2. Frontend calls `disconnectTwitter()` from social.ts
3. DELETE request sent to `api/integrations/twitter/disconnect` with auth headers
4. Backend Service removes tokens from Firestore
5. Frontend refreshes status and shows success message
6. Twitter card shows "Not connected" state

---

## [2025-12-15] - Twitter Post Routing Fix

### Fixed
- **Twitter Post Failing After Preview Implementation**
  - Issue: Twitter posts were failing silently after preview feature was added, no error shown in UI
  - Cause: API Gateway was routing all Twitter endpoints to Integration Service (port 8002) instead of Backend Service (port 8001)
  - Root Cause: Twitter integration exists in Backend Service, not Integration Service. The routing was incorrectly configured.
  - Solution: Updated API Gateway to route all Twitter endpoints (`/auth`, `/callback`, `/status`, `/post`) to Backend Service
  - Files Modified:
    - `api-gateway/app/main.py` - Changed all Twitter routes from `INTEGRATION_SERVICE_URL` to `BACKEND_SERVICE_URL`
  - Impact: Twitter posting now works correctly through the preview-first workflow

### Technical Details
**Service Architecture Clarification:**
- **Integration Service (Port 8002)**: Handles LinkedIn OAuth only
- **Backend Service (Port 8001)**: Handles Twitter OAuth and posting
- **API Gateway (Port 8000)**: Routes requests to appropriate services

**Twitter Request Flow (Corrected):**
1. Frontend → API Gateway (8000) → Backend Service (8001) → Agent Service (8006) → MCP Server
2. Preview works because it was already routed to Backend Service
3. Twitter auth/post now correctly routed to Backend Service

---

### Added
- **Image Attachment Feature for Posts**
  - Support for attaching images to LinkedIn and Twitter posts
  - Preview-first publishing workflow requiring explicit preview before posting
  - Single image upload (up to 5MB, formats: JPG, PNG, GIF, WEBP)
  - Image validation (format and size checking)
  - Platform-specific preview showing exactly what will be posted
  - Support for image-only posts (no text required)
  - Automatic image conversion to Base64 for API transmission
  
- **Preview Post Endpoint**
  - New `/api/integrations/preview` endpoint
  - Platform-specific content validation and warnings
  - Character limit warnings for Twitter (280) and LinkedIn (3000)
  - Image size warnings for platform limits
  - Non-editable preview summary before publishing
  
- **Enhanced Composer UI**
  - Image upload button with preview display
  - Image file information display (name, size)
  - Remove/clear image functionality
  - "Preview Post" button (always enabled)
  - "Publish" button (only enabled after preview)
  - Platform-specific preview cards showing content and image status
  - Preview updates automatically when content/image/platforms change

### Changed
- **Backend API Updates**
  - Updated `PostRequest` models in LinkedIn and Twitter handlers to include optional `image_data` and `image_mime_type` fields
  - Updated MCP client methods to pass image data to MCP server
  - Enhanced logging to track image attachment status throughout the flow
  
- **Frontend API Updates**
  - Updated `postToLinkedIn`, `postToTwitter`, and `postToFacebook` interfaces to support optional image parameters
  - Added `previewPost` function for generating post previews
  - Added detailed console logging for preview and image operations

### Technical Details
- **Preview-First Flow**: Users must click "Preview Post" to see what will be posted before the "Publish" button becomes enabled
- **Platform Validations**:
  - Twitter: 280 character limit, 5MB image size recommendation
  - LinkedIn: 3000 character limit, 10MB image size recommendation
  - Facebook: 63,206 character limit
- **Image Handling**: Images are converted to Base64 for transmission, then passed to MCP server for upload to respective platforms
- **State Management**: Preview data is automatically cleared when content, image, or selected platforms change

### Files Modified
- `frontend/src/pages/ComposerPage.tsx` - Added image upload UI and preview functionality
- `frontend/src/api/social.ts` - Added previewPost function and updated post interfaces
- `backend-service/app/integrations/routes.py` - Added preview endpoint
- `backend-service/app/integrations/linkedin.py` - Updated to support image data
- `backend-service/app/integrations/twitter.py` - Updated to support image data

### Next Steps
- MCP server implementation for LinkedIn image upload API
- MCP server implementation for Twitter media upload API
- Testing with actual platform APIs
- Support for multiple images (future enhancement)

---

## [2025-12-15] - Twitter OAuth PKCE Fix & Token Storage

### Fixed
- **Twitter OAuth Callback (404 Error)**
  - Issue: `/agent/twitter/handle-callback` endpoint missing in Agent Service
  - Cause: Endpoint was not implemented when Twitter integration was added
  - Solution: Added complete callback endpoint matching LinkedIn pattern
  - File: `services/agent-service/app/main.py`

- **Twitter PKCE (Code Verifier) Not Stored**
  - Issue: Twitter status shows "not connected" after successful OAuth
  - Cause: Twitter uses PKCE OAuth which requires `codeVerifier` to be stored during auth and retrieved during callback
  - Root Cause: Integration-service wasn't storing/retrieving `codeVerifier` from Firestore
  - Solution: 
    1. Integration-service now stores `codeVerifier` with state in Firestore
    2. Integration-service retrieves and passes `codeVerifier` during callback
    3. Agent service passes `codeVerifier` to Twitter agent
    4. Twitter agent passes `codeVerifier` to MCP client
    5. MCP client sends `codeVerifier` to MCP server for token exchange
  - Files Modified:
    - `services/integration-service/app/main.py` - Store/retrieve code_verifier
    - `services/agent-service/app/main.py` - Accept code_verifier in callback request
    - `services/agent-service/app/twitter_agent.py` - Store and pass code_verifier
    - `services/agent-service/app/mcp_client.py` - Require code_verifier for Twitter callback

### Technical Details
**Twitter OAuth PKCE Flow:**
1. **Auth Request**: MCP returns `{authorizationUrl, state, codeVerifier}`
2. **Storage**: Integration-service stores `codeVerifier` in Firestore with `state`
3. **Callback**: Integration-service retrieves `codeVerifier` by `state`
4. **Token Exchange**: `codeVerifier` passed through Agent → MCP for token validation
5. **Save Tokens**: Access token saved to Firestore under `integrations.twitter`

**Key Difference from LinkedIn:**
- LinkedIn: Standard OAuth (no code_verifier needed)
- Twitter: PKCE OAuth (code_verifier required for security)

---

## [2025-12-14] - Twitter/X OAuth Integration

### Added
- **Twitter/X OAuth Integration**
  - Complete Twitter OAuth 2.0 flow similar to LinkedIn
  - Backend integration module (`backend-service/app/integrations/twitter.py`)
  - Twitter OAuth agent with LangGraph (`services/agent-service/app/twitter_agent.py`)
  - MCP client methods for Twitter auth and posting
  - Agent service endpoints for Twitter authentication
  - Integration service routes for Twitter OAuth callback
  - Environment variable for Twitter redirect URI (`X_REDIRECT_URI`)

### Changed
- **Integration Routes** (`backend-service/app/integrations/routes.py`)
  - Added Twitter router to integration routes
- **Agent Service** (`services/agent-service/app/main.py`)
  - Added Twitter OAuth agent initialization
  - Added `/agent/twitter/auth` endpoint
  - Added Twitter agent to lifecycle management
- **MCP Client** (`services/agent-service/app/mcp_client.py`)
  - Added `get_twitter_auth_url()` method
  - Added `handle_twitter_callback()` method
  - Added `post_to_twitter()` method
- **Environment Configuration** (`.env`)
  - Added Twitter OAuth section with configuration notes
  - Renamed `X__REDIRECT_URI` to `X_REDIRECT_URI` for consistency
  - Added documentation about MCP server handling OAuth credentials

### Technical Details
- Twitter OAuth flow follows same pattern as LinkedIn
- All Twitter credentials managed by MCP server
- Token storage in Firestore with platform identifier
- Correlation ID tracking throughout the flow
- Error handling with user-friendly redirects

### Files Created
- `backend-service/app/integrations/twitter.py` - Twitter integration module
- `services/agent-service/app/twitter_agent.py` - AI-powered Twitter OAuth agent

### Files Modified
- `backend-service/app/integrations/routes.py` - Added Twitter routes
- `services/agent-service/app/main.py` - Added Twitter agent and endpoints
- `services/agent-service/app/mcp_client.py` - Added Twitter MCP methods
- `.env` - Added Twitter OAuth configuration

### Next Steps
- Frontend integration for Twitter authentication UI
- Testing with actual Twitter Developer credentials
- Update integration page to display Twitter connection status

---

## [2025-12-12] - Content Refinement 404 Fix & Log Consolidation

### Fixed
- **Content Refinement 404 Error**
  - Issue: `POST /api/integrations/content/refine` returning 404 Not Found
  - Cause: Frontend using `buildBackendUrl()` which pointed to Backend Service (port 8001) instead of API Gateway (port 8000)
  - Root Cause: Wrong helper function in `frontend/src/api/social.ts` - should use `buildGatewayUrl()` for all requests
  - Solution: Updated frontend to use `buildGatewayUrl()` which correctly routes through API Gateway (port 8000) → Agent Service (port 8006)
  - Files Changed:
    - `frontend/src/api/social.ts`: Changed from `buildBackendUrl()` to `buildGatewayUrl()` and added import
  - Impact: Content refinement now works end-to-end through proper API Gateway routing

### Changed
- **Centralized Logging Structure**
  - Consolidated all service logs to `/logs/` directory (project root)
  - Removed scattered log directories: `api-gateway/logs/`, `backend-service/logs/`, `services/logs/`
  - Updated Agent Service log configuration to use absolute path to centralized logs
  - Updated startup script (`start-all-services.sh`) to:
    - Write all logs to `/logs/*.log`
    - Remove creation of service-specific log folders
    - Update log path display to show centralized location
  - Benefits:
    - Single location for all logs
    - Easier monitoring: `tail -f logs/*.log`
    - Cleaner repository structure
    - Simpler Docker volume mounting

### Architecture Clarity
- **Port Assignments**:
  - Port 8000: API Gateway (single entry point for all frontend requests)
  - Port 8001: Backend Service
  - Port 8002: Integration Service  
  - Port 8006: Agent Service
- **Correct Request Flow**:
  - Frontend → API Gateway (8000) → Agent Service (8006) ✅
  - Frontend → Backend Service (8001) directly ❌ (was causing 404)

---

## [2025-12-12] - Content Refinement API Routing Fix

### Fixed
- **Content Refinement 404 Error**
  - Issue: API endpoint `/api/integrations/content/refine` returning 404
  - Cause: API Gateway was routing to Integration Service (Port 8002) instead of Agent Service (Port 8004)
  - Root Cause: Content refinement is a Composer feature handled by AI agents, not an integration activity
  - Solution: Updated API Gateway to route directly to Agent Service
  - Impact: Content refinement now works end-to-end with proper separation of concerns

### Changed
- **API Gateway Routing** (`api-gateway/app/main.py`)
  - Added `AGENT_SERVICE_URL = "http://localhost:8004"` configuration
  - Updated `/api/integrations/content/refine` endpoint to route to `{AGENT_SERVICE_URL}/agent/content/refine`
  - Request payload transformation to match Agent Service schema (added `user_id` field)
  - Updated error messages to reference Agent Service instead of Backend Service
  - Updated health check to include Agent Service URL

### Architecture Clarification
- **Integration Service (Port 8002)**: OAuth and platform integrations only
- **Agent Service (Port 8004)**: AI-powered features (content refinement, intelligent agents)
- **Backend Service**: General business logic and data management
- **API Gateway (Port 8000)**: Central routing with clear separation between integration and AI features

---

## [2025-12-12] - Content Refinement & Voice Input

### Added
- **ContentRefinementAgent** in Agent Service
  - AI-powered content enhancement using GPT-4o
  - Platform-specific optimization
  - Tone customization (6 options)
  - Smart suggestions and recommendations
- **Voice Input Components**
  - `useVoiceInput` hook for Web Speech API integration
  - `VoiceInputButton` component with animated recording indicator
  - Browser compatibility detection
  - Real-time transcript preview
- **Enhanced Composer Page**
  - Dual text area layout (always visible)
  - Voice input for original content
  - Voice input for refinement instructions
  - Tone selector dropdown
  - "Enhance/Refine" button
  - "Refine Again" for iterations
- **API Integration**
  - `/agent/content/refine` endpoint in Agent Service
  - `/api/integrations/content/refine` proxy in Backend Service
  - `/api/integrations/content/refine` route in API Gateway
  - Full correlation ID tracking
  - Comprehensive error handling
- **Testing & Documentation**
  - `scripts/test-content-refinement.sh` - Automated E2E test
  - Updated `linkedin-integration-guide.md` with content refinement section
  - Created `docs/README.md` - Documentation index
  - Created `docs/CHANGELOG.md` - This file

### Changed
- ComposerPage layout: Refined content section now always visible (not conditional)
- Documentation structure: Consolidated into core guides instead of separate fix documents

### Fixed
- **Voice Input Infinite Loop**
  - Issue: Maximum update depth exceeded error
  - Cause: Too many dependencies in useEffect hook
  - Fix: Removed unnecessary dependencies from effect
- **Refined Content Not Showing**
  - Issue: Right text area only appeared after refinement
  - Cause: Conditional rendering based on refinedContent state
  - Fix: Made both text areas always visible for better UX
- **404 on Content Refinement**
  - Issue: API Gateway missing content refinement route
  - Cause: Route not added to gateway after creating backend proxy
  - Fix: Added `/api/integrations/content/refine` route to API Gateway

---

## [2025-11-17] - LinkedIn OAuth Integration

### Added
- Complete LinkedIn OAuth 2.0 integration
- Token storage in Firebase Firestore
- OAuth state validation for security
- Real-time connection status checking
- Popup-based authentication flow
- Auto-refresh after authentication
- Token expiration handling

### Components
- Frontend: IntegrationPage.tsx with connection management UI
- Backend: Integration Service with OAuth flow handling
- Integration with MCP Server for LinkedIn API operations
- Firestore data structure for secure token storage

### Security
- CSRF protection with OAuth state validation
- Server-side token storage (never exposed to frontend)
- Firebase Authentication for user identity
- JWT token validation on all protected endpoints

---

## [2025-11-15] - Centralized Logging Implementation

### Added
- Centralized logging system with correlation IDs
- Request/response tracking across all services
- Structured JSON logging format
- Color-coded console output for better debugging
- Automatic correlation ID propagation through middleware

### Components
- `shared/logging_utils.py` - Centralized logger utility
- Correlation ID middleware in all services
- Log aggregation in `logs/centralized.log`

### Features
- Trace requests across microservices
- Debug complex issues with request flow visibility
- Performance monitoring with timing data
- Structured logs for easy parsing and analysis

---

## [2025-11-10] - MCP Integration

### Added
- Model Context Protocol (MCP) integration
- Connection to external MCP server on AWS
- AI agent for LinkedIn automation
- Tool discovery and execution
- Async communication with MCP server

### Components
- Agent Service (Port 8006) with MCP client
- LinkedInOAuthAgent for intelligent OAuth handling
- Connection to MCP server at http://3.135.209.100:3001

---

## [2025-11-05] - Initial Architecture

### Added
- Microservices architecture setup
- Frontend React application with Material-UI
- Backend service with FastAPI
- Firebase Authentication integration
- Service management scripts
- Docker support

### Services
- API Gateway (Port 8002)
- Backend Service (Port 8001)
- Agent Service (Port 8006)
- Frontend (Port 3000)

---

## Migration Notes

### Deprecated Documents (Consolidated)

The following documents have been consolidated into core documentation:

**Architecture Documents** → Merged into `ARCHITECTURE.md`:
- `ARCHITECTURE_FIX_MCP_ROUTING.md`
- `SIMPLIFIED_ARCHITECTURE.md`
- `ai-agent-architecture.md`

**Logging Documents** → Merged into `LOGGING_GUIDE.md`:
- `CENTRALIZED_LOGGING_GUIDE.md`
- `ENHANCED_LOGGING_GUIDE.md`
- `LOGGING_IMPLEMENTATION_SUMMARY.md`
- `CORRELATION_LOGGING_IMPLEMENTATION.md`
- `CORRELATION_ID_IMPLEMENTATION_COMPLETE.md`

**LinkedIn Integration** → Merged into `linkedin-integration-guide.md`:
- `LINKEDIN_AUTH_TESTING_GUIDE.md`
- `LINKEDIN_CONNECTION_DEBUGGING.md`
- `LINKEDIN_CONNECTION_DEBUGGING_ENHANCED.md`
- `LINKEDIN_CONNECTION_STATUS_FIX.md`
- `LINKEDIN_INTEGRATION_FIXES.md`
- `LINKEDIN_MCP_INTEGRATION_FIX.md`
- `LINKEDIN_REDIRECT_URI_FIX.md`
- `OAUTH_FIX_TEST_GUIDE.md`
- `OAUTH_POPUP_CALLBACK_FIX.md`
- `CONTENT_REFINEMENT_SETUP.md` (NEW)

**API & Routing** → Merged into `ARCHITECTURE.md` or relevant guides:
- `API_ROUTING_ABSOLUTE_URL_FIX.md`
- `DIRECT_BACKEND_ROUTING_FIX.md`
- `PROXY_CONFIGURATION_FIX.md`
- `PROXY_FIX_SUMMARY.md`

**Other Fixes** → Merged into `TROUBLESHOOTING.md`:
- `BROWSER_STORAGE_MANAGEMENT.md`
- `CONSOLE_ERRORS_FIX.md`
- `COMPOSER_ENHANCED_STATUS_TRACKING.md`
- `INTEGRATION_SERVICE_FIX.md`
- `OPENAI_API_KEY_CACHE_FIX.md`
- `MCP_CALLBACK_URL_FIX.md`
- `MCP_CONFIGURATION_CHANGES.md`

**Preserved Documents**:
- `functional-specification.md` - Core functional requirements
- `product-requirements.md` - Core product requirements
- `MCP_SETUP_GUIDE.md` - MCP integration guide
- `MCP_INTEGRATION_TEST_REPORT.md` - Test results
- `SERVICE_MANAGEMENT.md` - Service operations
- `SOLUTION_SUMMARY.md` - High-level solution overview

---

## Documentation Principles Going Forward

1. **Update, Don't Create**: Update existing documents rather than creating new fix documents
2. **Track Changes Here**: Use this CHANGELOG to document fixes and changes
3. **Consolidate**: Keep related information in comprehensive guides
4. **Single Source of Truth**: Each topic has one authoritative document
5. **Clear Structure**: Maintain consistent organization across all documentation

---

**Format**: [YYYY-MM-DD] - Title  
**Types**: Added, Changed, Deprecated, Removed, Fixed, Security
