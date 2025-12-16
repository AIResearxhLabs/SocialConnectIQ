from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from dotenv import load_dotenv
import sys

# Load environment variables
load_dotenv()

# Add parent directory to path to import shared utilities
# Go up from app/ -> integration-service/ -> services/ -> project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger, get_correlation_id_from_headers, generate_correlation_id

# Initialize centralized logger
logger = CorrelationLogger(
    service_name="INTEGRATION-SERVICE",
    log_file="../../logs/centralized.log"
)

app = FastAPI(
    title="Integration Service",
    description="Manages OAuth handshakes, stores encrypted API keys/tokens, and handles token refresh logic.",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Correlation ID Middleware
@app.middleware("http")
async def add_correlation_id_middleware(request: Request, call_next):
    """Add or extract correlation ID and add to request state and response headers"""
    # Extract or generate correlation ID
    correlation_id = get_correlation_id_from_headers(dict(request.headers)) or generate_correlation_id()
    
    # Store in request state for easy access
    request.state.correlation_id = correlation_id
    
    # Log request start
    user_id = request.headers.get('x-user-id', 'unknown')
    logger.request_start(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        method=request.method,
        user_id=user_id
    )
    
    # Process request
    response = await call_next(request)
    
    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id
    
    # Log request end
    logger.request_end(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        status_code=response.status_code,
        user_id=user_id
    )
    
    return response

# Initialize Firebase Admin SDK
db = None
firebase_initialized = False

try:
    # Check if Firebase is already initialized
    firebase_admin.get_app()
    db = firestore.client()
    firebase_initialized = True
    print("✅ Firebase already initialized and connected")
except ValueError:
    # Initialize Firebase with credentials from environment
    try:
        # Check if we have required Firebase credentials
        firebase_project_id = os.getenv("FIREBASE_PROJECT_ID")
        firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
        firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
        
        print("\n" + "="*80)
        print("🔥 FIREBASE INITIALIZATION")
        print("="*80)
        print(f"Project ID: {firebase_project_id if firebase_project_id != 'your-project-id' else '❌ NOT SET (using placeholder)'}")
        print(f"Client Email: {firebase_client_email if firebase_client_email != 'your-client-email@project.iam.gserviceaccount.com' else '❌ NOT SET (using placeholder)'}")
        print(f"Private Key Length: {len(firebase_private_key)} chars")
        
        if firebase_project_id and firebase_private_key and firebase_client_email and len(firebase_private_key) > 50:
            # Check if credentials are still placeholders
            if firebase_project_id == "your-project-id" or "your-client-email" in firebase_client_email or "your-private-key" in firebase_private_key:
                print("❌ CRITICAL: Firebase credentials are PLACEHOLDER values!")
                print("   └─ Update FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in .env")
                print("   └─ Token persistence will NOT work until real credentials are provided")
                print("="*80 + "\n")
            else:
                cred = credentials.Certificate({
                    "type": "service_account",
                    "project_id": firebase_project_id,
                    "private_key": firebase_private_key,
                    "client_email": firebase_client_email,
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                })
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                firebase_initialized = True
                print("✅ Firebase initialized successfully with real credentials")
                print("="*80 + "\n")
        else:
            print("❌ CRITICAL: Firebase credentials are incomplete or missing!")
            print("   └─ Required: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY (>50 chars), FIREBASE_CLIENT_EMAIL")
            print("   └─ Token persistence will NOT work until credentials are provided")
            print("="*80 + "\n")
    except Exception as e:
        print(f"❌ ERROR: Could not initialize Firebase: {e}")
        print("   └─ Service will run but token persistence will NOT work")
        print("="*80 + "\n")
        import traceback
        print(traceback.format_exc())

@app.get("/")
async def root():
    return {"message": "Integration Service is running"}

# Service URLs
MCP_SOCIAL_URL = os.getenv("MCP_SERVER_URL", "http://3.141.18.225:3001")
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8006")

class PostRequest(BaseModel):
    content: str
    user_id: str

class AuthUrlResponse(BaseModel):
    auth_url: str

# Helper function to get user from Firestore
async def get_user_tokens(user_id: str, platform: str):
    """Retrieve OAuth tokens for a user and platform from Firestore"""
    if db is None:
        print("Warning: Firestore not initialized")
        return None
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return None
            
        user_data = user_doc.to_dict()
        integrations = user_data.get('integrations', {})
        
        return integrations.get(platform, {})
    except Exception as e:
        print(f"Error fetching user tokens: {e}")
        return None

# Helper function to save tokens to Firestore
async def save_user_tokens(user_id: str, platform: str, token_data: dict):
    """Save OAuth tokens for a user and platform to Firestore"""
    if db is None:
        error_msg = "Firestore not initialized - cannot save tokens. Check Firebase credentials in .env"
        print(f"❌ [INTEGRATION-SERVICE] {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
    
    try:
        user_ref = db.collection('users').document(user_id)
        
        # Update the integrations field with the new token data
        user_ref.set({
            'integrations': {
                platform: {
                    'access_token': token_data.get('access_token'),
                    'refresh_token': token_data.get('refresh_token'),
                    'expires_at': token_data.get('expires_at'),
                    'connected': True,
                    'status': 'Connected',  # Explicit status field
                    'connected_at': firestore.SERVER_TIMESTAMP,
                    'platform_user_id': token_data.get('platform_user_id', ''),
                }
            }
        }, merge=True)
        
        print(f"✅ [INTEGRATION-SERVICE] Tokens saved to Firestore for user {user_id}")
        return True
        
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Error saving tokens to Firestore: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return False

# LinkedIn OAuth Endpoints
@app.post("/api/integrations/linkedin/auth")
async def linkedin_auth(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """
    Initiate LinkedIn OAuth flow via Agent Service (LLM + MCP integration)
    This endpoint delegates to the Agent Service which uses OpenAI LLM to query MCP tools
    """
    # Extract or generate correlation ID
    correlation_id = get_correlation_id_from_headers(dict(request.headers)) or generate_correlation_id()
    
    print("\n" + "="*100)
    print("🔵 [INTEGRATION-SERVICE] LinkedIn Auth Request Received")
    print("="*100)
    
    # Log request start
    logger.request_start(
        correlation_id=correlation_id,
        endpoint="/api/integrations/linkedin/auth",
        method="POST",
        user_id=user_id
    )
    
    print(f"🆔 [INTEGRATION-SERVICE] Correlation ID: {correlation_id}")
    print(f"👤 [INTEGRATION-SERVICE] User ID: {user_id}")
    print(f"🤖 [INTEGRATION-SERVICE] Delegating to Agent Service for LLM + MCP workflow")
    
    try:
        # Delegate to Agent Service which uses LLM to query MCP server
        async with httpx.AsyncClient(timeout=30.0) as client:
            print(f"📡 [INTEGRATION-SERVICE] Calling Agent Service at {AGENT_SERVICE_URL}")
            
            agent_response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/linkedin/auth",
                json={"user_id": user_id},
                headers={"X-Correlation-ID": correlation_id}
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {agent_response.status_code}")
            
            if agent_response.status_code != 200:
                print(f"❌ [INTEGRATION-SERVICE] Agent Service returned error: {agent_response.text}")
                logger.error(
                    f"Agent Service error",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"status": agent_response.status_code, "response": agent_response.text}
                )
                raise HTTPException(
                    status_code=agent_response.status_code,
                    detail=f"Agent Service error: {agent_response.text}"
                )
            
            agent_data = agent_response.json()
            
            if not agent_data.get("success"):
                error_msg = agent_data.get("error", "Unknown error from Agent Service")
                print(f"❌ [INTEGRATION-SERVICE] Agent Service returned failure: {error_msg}")
                logger.error(
                    f"Agent Service workflow failed",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"error": error_msg}
                )
                raise HTTPException(status_code=500, detail=error_msg)
            
            # MCP server returns authorizationUrl, not auth_url
            auth_url = agent_data.get("auth_url") or agent_data.get("authUrl") or agent_data.get("authorizationUrl")
            state = agent_data.get("state")

            print(f"✅ [INTEGRATION-SERVICE] Received auth_url from Agent Service (via LLM + MCP)")
            if auth_url:
                print(f"   └─ URL: {auth_url[:120]}...")
            else:
                print(f"   └─ URL: None (field not found in response)")
            print(f"   └─ State: {state[:12]}...{state[-12:] if state else 'N/A'}")
            
            # Store state in Firestore for callback validation
            if state and db is not None:
                try:
                    state_data = {
                        'user_id': user_id,
                        'platform': 'linkedin',
                        'created_at': firestore.SERVER_TIMESTAMP,
                        'expires_at': datetime.utcnow().timestamp() + 600  # 10 minutes
                    }
                    db.collection('oauth_states').document(state).set(state_data)
                    print(f"💾 [INTEGRATION-SERVICE] State stored in Firestore for validation")
                    logger.success(
                        "State stored in Firestore",
                        correlation_id=correlation_id,
                        user_id=user_id
                    )
                except Exception as e:
                    print(f"⚠️  [INTEGRATION-SERVICE] Warning: Could not store state: {str(e)}")
                    logger.warning(
                        f"Could not store OAuth state: {str(e)}",
                        correlation_id=correlation_id,
                        user_id=user_id
                    )
            
            logger.success(
                "LinkedIn auth URL obtained via Agent Service (LLM + MCP)",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"auth_url_prefix": auth_url[:80] if auth_url else None}
            )
            
            # Log request end
            logger.request_end(
                correlation_id=correlation_id,
                endpoint="/api/integrations/linkedin/auth",
                status_code=200,
                user_id=user_id
            )
            
            print(f"✅ [INTEGRATION-SERVICE] Returning auth_url to client")
            print("="*100 + "\n")
            
            return {"auth_url": auth_url, "state": state}
            
    except httpx.RequestError as e:
        print(f"❌ [INTEGRATION-SERVICE] Failed to connect to Agent Service: {str(e)}")
        logger.error(
            f"Connection to Agent Service failed",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to Agent Service: {str(e)}"
        )
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Unexpected error: {str(e)}")
        logger.error(
            f"Unexpected error in linkedin_auth",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/integrations/linkedin/callback")
async def linkedin_callback(code: str, state: Optional[str] = None):
    """Handle LinkedIn OAuth callback via Agent Service and MCP Server"""
    print("\n" + "="*100)
    print("🔄 [INTEGRATION-SERVICE] LinkedIn Callback Received")
    print("="*100)
    print(f"📥 [INTEGRATION-SERVICE] Authorization Code: {code[:20]}...{code[-10:] if len(code) > 30 else code}")
    print(f"🎲 [INTEGRATION-SERVICE] State Parameter: {state[:12]}...{state[-12:] if state and len(state) > 24 else state}")
    
    try:
        # 1. Validate state and get user_id
        user_id = None
        print(f"🔍 [INTEGRATION-SERVICE] Validating state token...")
        print(f"💾 [INTEGRATION-SERVICE] Firestore DB: {'Available' if db is not None else 'NOT AVAILABLE'}")
        
        if state and db is not None:
            print(f"🔍 [INTEGRATION-SERVICE] Looking up state in Firestore: {state[:12]}...{state[-12:]}")
            state_doc = db.collection('oauth_states').document(state).get()
            
            if state_doc.exists:
                state_data = state_doc.to_dict()
                user_id = state_data.get('user_id')
                print(f"✅ [INTEGRATION-SERVICE] State found! User ID: {user_id}")
                print(f"   ├─ Platform: {state_data.get('platform')}")
                print(f"   ├─ Created: {state_data.get('created_at')}")
                print(f"   └─ Expires: {state_data.get('expires_at')}")
                
                # DON'T delete state yet - wait until tokens are successfully saved
                # This prevents issues if LinkedIn makes multiple callback requests
            else:
                print(f"❌ [INTEGRATION-SERVICE] State document NOT FOUND in Firestore!")
                print(f"   └─ This could mean: expired, never created, or already used")
        else:
            if not state:
                print(f"❌ [INTEGRATION-SERVICE] No state parameter provided!")
            if db is None:
                print(f"❌ [INTEGRATION-SERVICE] Firestore not initialized!")
        
        if not user_id:
            print(f"❌ [INTEGRATION-SERVICE] VALIDATION FAILED: Could not determine user_id")
            print(f"🔙 [INTEGRATION-SERVICE] Redirecting to frontend with error...")
            print("="*100 + "\n")
            return RedirectResponse(
                url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=invalid_state"
            )
        
        # 2. Route to Agent Service (which calls MCP Server)
        print(f"📡 [INTEGRATION-SERVICE] Routing callback to Agent Service...")
        print(f"   └─ Endpoint: {AGENT_SERVICE_URL}/agent/linkedin/handle-callback")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            agent_response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/linkedin/handle-callback",
                json={
                    "code": code,
                    "user_id": user_id
                }
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {agent_response.status_code}")
            
            if agent_response.status_code != 200:
                print(f"❌ [INTEGRATION-SERVICE] Agent Service error: {agent_response.text}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=agent_error"
                )
            
            agent_data = agent_response.json()
            
            if not agent_data.get("success"):
                error = agent_data.get("error", "Unknown error")
                print(f"❌ [INTEGRATION-SERVICE] Agent Service failed: {error}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=callback_failed"
                )
            
            # 3. Extract token data from MCP response
            result = agent_data.get("result", {})
            access_token = result.get("access_token") or result.get("accessToken")
            refresh_token = result.get("refresh_token") or result.get("refreshToken")
            expires_in = result.get("expires_in") or result.get("expiresIn", 5184000)
            platform_user_id = result.get("platform_user_id") or result.get("sub") or result.get("userId", "")
            
            if not access_token:
                print(f"❌ [INTEGRATION-SERVICE] No access token in MCP response")
                print(f"   └─ Response: {result}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=no_token"
                )
            
            print(f"✅ [INTEGRATION-SERVICE] Tokens received from MCP Server via Agent Service")
            print(f"   ├─ Access Token: {access_token[:20]}...")
            print(f"   ├─ Refresh Token: {'Present' if refresh_token else 'Not provided'}")
            print(f"   ├─ Expires In: {expires_in} seconds")
            print(f"   └─ Platform User ID: {platform_user_id}")
            
            # 4. Prepare token data for Firestore
            token_storage_data = {
                "access_token": access_token,
                "refresh_token": refresh_token or "",
                "expires_at": datetime.utcnow().timestamp() + expires_in,
                "platform_user_id": platform_user_id,
            }
            
            # 5. Save to Firestore with error handling
            print(f"💾 [INTEGRATION-SERVICE] Saving tokens to Firestore...")
            print(f"   ├─ User ID: {user_id}")
            print(f"   ├─ Platform: linkedin")
            print(f"   └─ Platform User ID: {platform_user_id}")
            
            if db is None:
                print(f"❌ [INTEGRATION-SERVICE] CRITICAL: Firestore not initialized!")
                print(f"   └─ Check Firebase credentials in .env file")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=firestore_not_configured"
                )
            
            try:
                save_result = await save_user_tokens(user_id, 'linkedin', token_storage_data)
                
                if not save_result:
                    print(f"❌ [INTEGRATION-SERVICE] Failed to save tokens to Firestore")
                    return RedirectResponse(
                        url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=save_failed"
                    )
                
                print(f"✅ [INTEGRATION-SERVICE] Tokens saved successfully to Firestore!")
                print(f"   └─ Status marked as 'Connected'")
                
                # Delete state token now that everything succeeded
                if state and db is not None:
                    try:
                        print(f"🗑️  [INTEGRATION-SERVICE] Deleting used state token...")
                        db.collection('oauth_states').document(state).delete()
                        print(f"✅ [INTEGRATION-SERVICE] State deleted successfully")
                    except Exception as e:
                        print(f"⚠️  [INTEGRATION-SERVICE] Warning: Could not delete state: {str(e)}")
                
                # 6. Return success page (to oauth-callback.html in popup)
                # Add timestamp to prevent caching and ensure static file is loaded
                import time
                cache_bust = int(time.time() * 1000)
                redirect_url = f"http://localhost:3000/oauth-callback.html?status=success&platform=linkedin&_t={cache_bust}"
                print(f"🔙 [INTEGRATION-SERVICE] Redirecting to: {redirect_url}")
                print("="*100 + "\n")
                
                return RedirectResponse(url=redirect_url)
                
            except HTTPException as save_error:
                print(f"❌ [INTEGRATION-SERVICE] HTTPException saving tokens: {save_error.detail}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=firestore_error"
                )
            except Exception as save_error:
                print(f"❌ [INTEGRATION-SERVICE] Exception saving tokens: {str(save_error)}")
                import traceback
                print(traceback.format_exc())
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=exception"
                )
            
    except httpx.RequestError as e:
        print(f"❌ [INTEGRATION-SERVICE] Connection error to Agent Service: {str(e)}")
        return RedirectResponse(
            url=f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=connection_error"
        )
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Unexpected error in LinkedIn callback:")
        print(f"   ├─ Type: {type(e).__name__}")
        print(f"   └─ Message: {str(e)}")
        
        import traceback
        print(f"📋 [INTEGRATION-SERVICE] Full traceback:")
        print(traceback.format_exc())
        
        # Redirect to frontend with error (to oauth-callback.html in popup)
        redirect_url = f"http://localhost:3000/oauth-callback.html?status=error&platform=linkedin&message=unexpected_error"
        print(f"🔙 [INTEGRATION-SERVICE] Redirecting to: {redirect_url}")
        print("="*100 + "\n")
        
        return RedirectResponse(url=redirect_url)

@app.get("/api/integrations/linkedin/status")
async def linkedin_status(user_id: str = Header(..., alias="X-User-ID")):
    """Check LinkedIn connection status for a user"""
    tokens = await get_user_tokens(user_id, 'linkedin')
    
    if tokens and tokens.get('connected'):
        # Check if token is expired
        expires_at = tokens.get('expires_at', 0)
        current_time = datetime.utcnow().timestamp()
        
        if current_time >= expires_at:
            # Token expired, mark as disconnected
            print(f"⚠️  [INTEGRATION-SERVICE] LinkedIn token expired for user {user_id}")
            return {
                "connected": False,
                "error": "token_expired",
                "message": "Your LinkedIn session has expired. Please reconnect."
            }
        
        # Token is still valid
        time_until_expiry = int(expires_at - current_time)
        return {
            "connected": True,
            "connected_at": tokens.get('connected_at'),
            "platform_user_id": tokens.get('platform_user_id', ''),
            "expires_in": time_until_expiry  # Seconds until expiration
        }
    
    return {"connected": False}

@app.post("/api/integrations/linkedin/post")
async def post_to_linkedin(post_request: PostRequest):
    """Post content to LinkedIn using stored tokens via Agent Service"""
    print("\n" + "="*100)
    print("📤 [INTEGRATION-SERVICE] LinkedIn Post Request Received")
    print("="*100)
    print(f"👤 [INTEGRATION-SERVICE] User ID: {post_request.user_id}")
    print(f"📝 [INTEGRATION-SERVICE] Content length: {len(post_request.content)} chars")
    
    # Get user's LinkedIn tokens from Firestore
    tokens = await get_user_tokens(post_request.user_id, 'linkedin')
    
    if not tokens or not tokens.get('access_token'):
        print(f"❌ [INTEGRATION-SERVICE] No LinkedIn tokens found for user {post_request.user_id}")
        raise HTTPException(status_code=401, detail="LinkedIn not connected. Please authenticate first.")
    
    print(f"✅ [INTEGRATION-SERVICE] Retrieved access token from Firestore")
    print(f"🤖 [INTEGRATION-SERVICE] Delegating to Agent Service for LLM-powered posting")
    
    # Delegate to Agent Service (which uses LLM + MCP Client)
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/linkedin/post",
                json={
                    "content": post_request.content,
                    "access_token": tokens.get('access_token'),
                    "user_id": post_request.user_id
                }
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {response.status_code}")
            
            if response.status_code == 401:
                print(f"❌ [INTEGRATION-SERVICE] Token expired")
                raise HTTPException(
                    status_code=401, 
                    detail="LinkedIn token expired. Please re-authenticate."
                )
            
            response.raise_for_status()
            result = response.json()
            
            print(f"✅ [INTEGRATION-SERVICE] Post successful!")
            print("="*100 + "\n")
            
            return result
            
        except httpx.HTTPStatusError as exc:
            print(f"❌ [INTEGRATION-SERVICE] HTTP error from Agent Service: {exc.response.status_code}")
            if exc.response.status_code == 401:
                raise HTTPException(
                    status_code=401, 
                    detail="LinkedIn token expired. Please re-authenticate."
                )
            raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
        except httpx.RequestError as exc:
            print(f"❌ [INTEGRATION-SERVICE] Connection error to Agent Service: {str(exc)}")
            raise HTTPException(status_code=503, detail=f"Error connecting to Agent Service: {exc}")

@app.delete("/api/integrations/linkedin/disconnect")
async def disconnect_linkedin(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """Disconnect LinkedIn integration and clean up OAuth states"""
    from .storage import token_storage
    
    correlation_id = get_correlation_id_from_headers(dict(request.headers)) or generate_correlation_id()
    
    print("\n" + "="*100)
    print("🔴 [INTEGRATION-SERVICE] LinkedIn Disconnect Request")
    print("="*100)
    print(f"🆔 [INTEGRATION-SERVICE] Correlation ID: {correlation_id}")
    print(f"👤 [INTEGRATION-SERVICE] User ID: {user_id}")
    
    try:
        success = await token_storage.disconnect_platform(user_id, 'linkedin', correlation_id)
        
        if not success:
            print(f"❌ [INTEGRATION-SERVICE] Disconnect failed")
            print("="*100 + "\n")
            raise HTTPException(status_code=500, detail="Failed to disconnect LinkedIn")
        
        print(f"✅ [INTEGRATION-SERVICE] LinkedIn disconnected successfully")
        print("="*100 + "\n")
        
        return {"message": "LinkedIn disconnected successfully", "platform": "linkedin"}
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Exception: {str(e)}")
        print("="*100 + "\n")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect LinkedIn: {e}")

# Facebook OAuth Endpoints
@app.post("/api/integrations/facebook/auth")
async def facebook_auth(user_id: str = Header(..., alias="X-User-ID")):
    """Initiate Facebook OAuth flow"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{MCP_SOCIAL_URL}/tools/getFacebookAuthUrl/run",
                json={"userId": user_id}
            )
            response.raise_for_status()
            data = response.json()
            
            # Store state for validation
            state = data.get('state', '')
            if state and db is not None:
                db.collection('oauth_states').document(state).set({
                    'user_id': user_id,
                    'platform': 'facebook',
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'expires_at': datetime.utcnow().timestamp() + 600
                })
            
            return {"auth_url": data.get('auth_url', data.get('authUrl', ''))}
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to get Facebook auth URL: {e}")

@app.get("/api/integrations/facebook/callback")
async def facebook_callback(code: str, state: Optional[str] = None):
    """Handle Facebook OAuth callback"""
    try:
        user_id = None
        if state and db is not None:
            state_doc = db.collection('oauth_states').document(state).get()
            if state_doc.exists:
                state_data = state_doc.to_dict()
                user_id = state_data.get('user_id')
                db.collection('oauth_states').document(state).delete()
        
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired state")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{MCP_SOCIAL_URL}/tools/handleFacebookAuthCallback/run",
                json={"code": code, "userId": user_id}
            )
            response.raise_for_status()
            token_data = response.json()
            
            await save_user_tokens(user_id, 'facebook', token_data)
            
            return RedirectResponse(url=f"http://localhost:3000/oauth-callback.html?status=success&platform=facebook")
            
    except Exception:
        return RedirectResponse(url=f"http://localhost:3000/oauth-callback.html?status=error&platform=facebook")

@app.get("/api/integrations/facebook/status")
async def facebook_status(user_id: str = Header(..., alias="X-User-ID")):
    """Check Facebook connection status"""
    tokens = await get_user_tokens(user_id, 'facebook')
    
    if tokens and tokens.get('connected'):
        return {"connected": True, "connected_at": tokens.get('connected_at')}
    
    return {"connected": False}

@app.post("/api/integrations/facebook/post")
async def post_to_facebook(post_request: PostRequest):
    """Post content to Facebook using stored tokens via Agent Service"""
    print("\n" + "="*100)
    print("📤 [INTEGRATION-SERVICE] Facebook Post Request Received")
    print("="*100)
    print(f"👤 [INTEGRATION-SERVICE] User ID: {post_request.user_id}")
    print(f"📝 [INTEGRATION-SERVICE] Content length: {len(post_request.content)} chars")
    
    # Get user's Facebook tokens from Firestore
    tokens = await get_user_tokens(post_request.user_id, 'facebook')
    
    if not tokens or not tokens.get('access_token'):
        print(f"❌ [INTEGRATION-SERVICE] No Facebook tokens found for user {post_request.user_id}")
        raise HTTPException(status_code=401, detail="Facebook not connected. Please authenticate first.")
    
    print(f"✅ [INTEGRATION-SERVICE] Retrieved access token from Firestore")
    print(f"🤖 [INTEGRATION-SERVICE] Delegating to Agent Service for LLM-powered posting")
    
    # Delegate to Agent Service (which uses LLM + MCP Client)
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/facebook/post",
                json={
                    "content": post_request.content,
                    "access_token": tokens.get('access_token'),
                    "user_id": post_request.user_id
                }
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {response.status_code}")
            
            if response.status_code == 401:
                print(f"❌ [INTEGRATION-SERVICE] Token expired")
                raise HTTPException(status_code=401, detail="Facebook token expired. Please re-authenticate.")
            
            response.raise_for_status()
            result = response.json()
            
            print(f"✅ [INTEGRATION-SERVICE] Post successful!")
            print("="*100 + "\n")
            
            return result
            
        except httpx.HTTPStatusError as exc:
            print(f"❌ [INTEGRATION-SERVICE] HTTP error from Agent Service: {exc.response.status_code}")
            if exc.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Facebook token expired. Please re-authenticate.")
            raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
        except httpx.RequestError as exc:
            print(f"❌ [INTEGRATION-SERVICE] Connection error to Agent Service: {str(exc)}")
            raise HTTPException(status_code=503, detail=f"Error connecting to Agent Service: {exc}")

# Twitter OAuth Endpoints
@app.post("/api/integrations/twitter/auth")
async def twitter_auth(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """
    Initiate Twitter OAuth flow via Agent Service (LLM + MCP integration)
    This endpoint delegates to the Agent Service which uses OpenAI LLM to query MCP tools
    """
    # Extract or generate correlation ID
    correlation_id = get_correlation_id_from_headers(dict(request.headers)) or generate_correlation_id()
    
    print("\n" + "="*100)
    print("🔵 [INTEGRATION-SERVICE] Twitter Auth Request Received")
    print("="*100)
    
    # Log request start
    logger.request_start(
        correlation_id=correlation_id,
        endpoint="/api/integrations/twitter/auth",
        method="POST",
        user_id=user_id
    )
    
    print(f"🆔 [INTEGRATION-SERVICE] Correlation ID: {correlation_id}")
    print(f"👤 [INTEGRATION-SERVICE] User ID: {user_id}")
    print(f"🤖 [INTEGRATION-SERVICE] Delegating to Agent Service for LLM + MCP workflow")
    
    try:
        # Delegate to Agent Service which uses LLM to query MCP server
        async with httpx.AsyncClient(timeout=30.0) as client:
            print(f"📡 [INTEGRATION-SERVICE] Calling Agent Service at {AGENT_SERVICE_URL}")
            
            agent_response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/twitter/auth",
                json={"user_id": user_id},
                headers={"X-Correlation-ID": correlation_id}
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {agent_response.status_code}")
            
            if agent_response.status_code != 200:
                print(f"❌ [INTEGRATION-SERVICE] Agent Service returned error: {agent_response.text}")
                logger.error(
                    f"Agent Service error",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"status": agent_response.status_code, "response": agent_response.text}
                )
                raise HTTPException(
                    status_code=agent_response.status_code,
                    detail=f"Agent Service error: {agent_response.text}"
                )
            
            agent_data = agent_response.json()
            
            if not agent_data.get("success"):
                error_msg = agent_data.get("error", "Unknown error from Agent Service")
                print(f"❌ [INTEGRATION-SERVICE] Agent Service returned failure: {error_msg}")
                logger.error(
                    f"Agent Service workflow failed",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"error": error_msg}
                )
                raise HTTPException(status_code=500, detail=error_msg)
            
            # Get auth_url and state from response
            auth_url = agent_data.get("auth_url")
            state = agent_data.get("state")

            print(f"✅ [INTEGRATION-SERVICE] Received auth_url from Agent Service (via LLM + MCP)")
            if auth_url:
                print(f"   └─ URL: {auth_url[:120]}...")
            else:
                print(f"   └─ URL: None (field not found in response)")
            print(f"   └─ State: {state[:12]}...{state[-12:] if state else 'N/A'}")
            
            # Store state AND codeVerifier in Firestore for callback validation
            # Twitter uses PKCE which requires the codeVerifier during token exchange
            code_verifier = agent_data.get("codeVerifier") or agent_data.get("code_verifier")
            
            if state and db is not None:
                try:
                    # Debug: Check what we received from agent
                    print(f"🔍 [INTEGRATION-SERVICE] Preparing to store state...")
                    print(f"   ├─ State: {state[:12]}...{state[-12:]}")
                    print(f"   ├─ User ID: {user_id}")
                    print(f"   ├─ Code verifier type: {type(code_verifier)}")
                    print(f"   └─ Code verifier value: {code_verifier}")
                    
                    if not code_verifier:
                        print(f"⚠️  [INTEGRATION-SERVICE] WARNING: code_verifier is None or empty!")
                        print(f"   └─ Agent response keys: {list(agent_data.keys())}")
                        print(f"   └─ Checking for alternate keys...")
                    
                    state_data = {
                        'user_id': user_id,
                        'platform': 'twitter',
                        'code_verifier': code_verifier,  # ← CRITICAL: Store for PKCE
                        'created_at': firestore.SERVER_TIMESTAMP,
                        'expires_at': datetime.utcnow().timestamp() + 600  # 10 minutes
                    }
                    db.collection('oauth_states').document(state).set(state_data)
                    
                    print(f"💾 [INTEGRATION-SERVICE] State + code_verifier stored in Firestore")
                    if code_verifier:
                        print(f"   └─ Code verifier: {code_verifier[:12]}...{code_verifier[-12:]}")
                    else:
                        print(f"   └─ Code verifier: None (THIS WILL CAUSE CALLBACK TO FAIL!)")
                    
                    logger.success(
                        "State and code_verifier stored in Firestore",
                        correlation_id=correlation_id,
                        user_id=user_id
                    )
                except Exception as e:
                    print(f"⚠️  [INTEGRATION-SERVICE] Warning: Could not store state: {str(e)}")
                    print(f"   └─ Error type: {type(e).__name__}")
                    import traceback
                    print(traceback.format_exc())
                    logger.warning(
                        f"Could not store OAuth state: {str(e)}",
                        correlation_id=correlation_id,
                        user_id=user_id
                    )
            
            logger.success(
                "Twitter auth URL obtained via Agent Service (LLM + MCP)",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"auth_url_prefix": auth_url[:80] if auth_url else None}
            )
            
            # Log request end
            logger.request_end(
                correlation_id=correlation_id,
                endpoint="/api/integrations/twitter/auth",
                status_code=200,
                user_id=user_id
            )
            
            print(f"✅ [INTEGRATION-SERVICE] Returning auth_url to client")
            print("="*100 + "\n")
            
            return {"auth_url": auth_url, "state": state}
            
    except httpx.RequestError as e:
        print(f"❌ [INTEGRATION-SERVICE] Failed to connect to Agent Service: {str(e)}")
        logger.error(
            f"Connection to Agent Service failed",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to Agent Service: {str(e)}"
        )
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Unexpected error: {str(e)}")
        logger.error(
            f"Unexpected error in twitter_auth",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/integrations/twitter/callback")
async def twitter_callback(code: str, state: Optional[str] = None):
    """Handle Twitter OAuth callback via Agent Service and MCP Server"""
    print("\n" + "="*100)
    print("🔄 [INTEGRATION-SERVICE] Twitter Callback Received")
    print("="*100)
    print(f"📥 [INTEGRATION-SERVICE] Authorization Code: {code[:20]}...{code[-10:] if len(code) > 30 else code}")
    print(f"🎲 [INTEGRATION-SERVICE] State Parameter: {state[:12]}...{state[-12:] if state and len(state) > 24 else state}")
    
    try:
        # 1. Validate state and get user_id
        user_id = None
        state_data = None
        code_verifier = None
        
        print(f"🔍 [INTEGRATION-SERVICE] Validating state token...")
        print(f"💾 [INTEGRATION-SERVICE] Firestore DB: {'Available' if db is not None else 'NOT AVAILABLE'}")
        
        if state and db is not None:
            print(f"🔍 [INTEGRATION-SERVICE] Looking up state in Firestore: {state[:12]}...{state[-12:]}")
            state_doc = db.collection('oauth_states').document(state).get()
            
            if state_doc.exists:
                state_data = state_doc.to_dict()
                user_id = state_data.get('user_id')
                code_verifier = state_data.get('code_verifier')
                
                print(f"✅ [INTEGRATION-SERVICE] State found! User ID: {user_id}")
                print(f"   ├─ Platform: {state_data.get('platform')}")
                print(f"   ├─ Created: {state_data.get('created_at')}")
                print(f"   ├─ Expires: {state_data.get('expires_at')}")
                print(f"   └─ Code Verifier: {code_verifier[:12]}...{code_verifier[-12:] if code_verifier else 'NOT FOUND'}")
            else:
                print(f"❌ [INTEGRATION-SERVICE] State document NOT FOUND in Firestore!")
                print(f"   └─ This could mean: expired, never created, or already used")
        else:
            if not state:
                print(f"❌ [INTEGRATION-SERVICE] No state parameter provided!")
            if db is None:
                print(f"❌ [INTEGRATION-SERVICE] Firestore not initialized!")
        
        if not user_id:
            print(f"❌ [INTEGRATION-SERVICE] VALIDATION FAILED: Could not determine user_id")
            print(f"🔙 [INTEGRATION-SERVICE] Redirecting to frontend with error...")
            print("="*100 + "\n")
            return RedirectResponse(
                url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=invalid_state"
            )
        
        # 2. Verify code_verifier is available (needed for PKCE)
        if not code_verifier:
            print(f"❌ [INTEGRATION-SERVICE] CRITICAL: code_verifier not found in state data!")
            print(f"   ├─ State data exists: {state_data is not None}")
            print(f"   ├─ State data keys: {list(state_data.keys()) if state_data else 'N/A'}")
            print(f"   └─ Twitter OAuth requires PKCE code_verifier for token exchange")
            return RedirectResponse(
                url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=missing_code_verifier"
            )
        
        print(f"✅ [INTEGRATION-SERVICE] Code verifier retrieved successfully")
        
        # 3. Route to Agent Service (which calls MCP Server)
        print(f"📡 [INTEGRATION-SERVICE] Routing callback to Agent Service...")
        print(f"   └─ Endpoint: {AGENT_SERVICE_URL}/agent/twitter/handle-callback")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            agent_response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/twitter/handle-callback",
                json={
                    "code": code,
                    "user_id": user_id,
                    "code_verifier": code_verifier  # ← Pass code_verifier for PKCE
                }
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {agent_response.status_code}")
            
            if agent_response.status_code != 200:
                print(f"❌ [INTEGRATION-SERVICE] Agent Service error: {agent_response.text}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=agent_error"
                )
            
            agent_data = agent_response.json()
            
            if not agent_data.get("success"):
                error = agent_data.get("error", "Unknown error")
                print(f"❌ [INTEGRATION-SERVICE] Agent Service failed: {error}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=callback_failed"
                )
            
            # 4. Extract token data from MCP response
            result = agent_data.get("result", {})
            access_token = result.get("access_token") or result.get("accessToken")
            refresh_token = result.get("refresh_token") or result.get("refreshToken")
            expires_in = result.get("expires_in") or result.get("expiresIn", 7200)  # Twitter tokens typically 2 hours
            platform_user_id = result.get("platform_user_id") or result.get("sub") or result.get("userId", "")
            
            if not access_token:
                print(f"❌ [INTEGRATION-SERVICE] No access token in MCP response")
                print(f"   └─ Response: {result}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=no_token"
                )
            
            print(f"✅ [INTEGRATION-SERVICE] Tokens received from MCP Server via Agent Service")
            print(f"   ├─ Access Token: {access_token[:20]}...")
            print(f"   ├─ Refresh Token: {'Present' if refresh_token else 'Not provided'}")
            print(f"   ├─ Expires In: {expires_in} seconds")
            print(f"   └─ Platform User ID: {platform_user_id}")
            
            # 5. Prepare token data for Firestore
            token_storage_data = {
                "access_token": access_token,
                "refresh_token": refresh_token or "",
                "expires_at": datetime.utcnow().timestamp() + expires_in,
                "platform_user_id": platform_user_id,
            }
            
            # 6. Save to Firestore with error handling
            print(f"💾 [INTEGRATION-SERVICE] Saving tokens to Firestore...")
            print(f"   ├─ User ID: {user_id}")
            print(f"   ├─ Platform: twitter")
            print(f"   └─ Platform User ID: {platform_user_id}")
            
            if db is None:
                print(f"❌ [INTEGRATION-SERVICE] CRITICAL: Firestore not initialized!")
                print(f"   └─ Check Firebase credentials in .env file")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=firestore_not_configured"
                )
            
            try:
                save_result = await save_user_tokens(user_id, 'twitter', token_storage_data)
                
                if not save_result:
                    print(f"❌ [INTEGRATION-SERVICE] Failed to save tokens to Firestore")
                    return RedirectResponse(
                        url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=save_failed"
                    )
                
                print(f"✅ [INTEGRATION-SERVICE] Tokens saved successfully to Firestore!")
                print(f"   └─ Status marked as 'Connected'")
                
                # Delete state token now that everything succeeded
                if state and db is not None:
                    try:
                        print(f"🗑️  [INTEGRATION-SERVICE] Deleting used state token...")
                        db.collection('oauth_states').document(state).delete()
                        print(f"✅ [INTEGRATION-SERVICE] State deleted successfully")
                    except Exception as e:
                        print(f"⚠️  [INTEGRATION-SERVICE] Warning: Could not delete state: {str(e)}")
                
                # 7. Return success page (to oauth-callback.html in popup)
                import time
                cache_bust = int(time.time() * 1000)
                redirect_url = f"http://localhost:3000/oauth-callback.html?status=success&platform=twitter&_t={cache_bust}"
                print(f"🔙 [INTEGRATION-SERVICE] Redirecting to: {redirect_url}")
                print("="*100 + "\n")
                
                return RedirectResponse(url=redirect_url)
                
            except HTTPException as save_error:
                print(f"❌ [INTEGRATION-SERVICE] HTTPException saving tokens: {save_error.detail}")
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=firestore_error"
                )
            except Exception as save_error:
                print(f"❌ [INTEGRATION-SERVICE] Exception saving tokens: {str(save_error)}")
                import traceback
                print(traceback.format_exc())
                return RedirectResponse(
                    url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=exception"
                )
            
    except httpx.RequestError as e:
        print(f"❌ [INTEGRATION-SERVICE] Connection error to Agent Service: {str(e)}")
        return RedirectResponse(
            url=f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=connection_error"
        )
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Unexpected error in Twitter callback:")
        print(f"   ├─ Type: {type(e).__name__}")
        print(f"   └─ Message: {str(e)}")
        
        import traceback
        print(f"📋 [INTEGRATION-SERVICE] Full traceback:")
        print(traceback.format_exc())
        
        redirect_url = f"http://localhost:3000/oauth-callback.html?status=error&platform=twitter&message=unexpected_error"
        print(f"🔙 [INTEGRATION-SERVICE] Redirecting to: {redirect_url}")
        print("="*100 + "\n")
        
        return RedirectResponse(url=redirect_url)

@app.get("/api/integrations/twitter/status")
async def twitter_status(user_id: str = Header(..., alias="X-User-ID")):
    """Check Twitter connection status"""
    tokens = await get_user_tokens(user_id, 'twitter')
    
    if tokens and tokens.get('connected'):
        # Check if token is expired
        expires_at = tokens.get('expires_at', 0)
        current_time = datetime.utcnow().timestamp()
        
        if current_time >= expires_at:
            print(f"⚠️  [INTEGRATION-SERVICE] Twitter token expired for user {user_id}")
            return {
                "connected": False,
                "error": "token_expired",
                "message": "Your Twitter session has expired. Please reconnect."
            }
        
        time_until_expiry = int(expires_at - current_time)
        return {
            "connected": True,
            "connected_at": tokens.get('connected_at'),
            "platform_user_id": tokens.get('platform_user_id', ''),
            "expires_in": time_until_expiry
        }
    
    return {"connected": False}

@app.delete("/api/integrations/twitter/disconnect")
async def disconnect_twitter(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """Disconnect Twitter integration and clean up OAuth states"""
    from .storage import token_storage
    
    correlation_id = get_correlation_id_from_headers(dict(request.headers)) or generate_correlation_id()
    
    print("\n" + "="*100)
    print("🔴 [INTEGRATION-SERVICE] Twitter Disconnect Request")
    print("="*100)
    print(f"🆔 [INTEGRATION-SERVICE] Correlation ID: {correlation_id}")
    print(f"👤 [INTEGRATION-SERVICE] User ID: {user_id}")
    
    try:
        success = await token_storage.disconnect_platform(user_id, 'twitter', correlation_id)
        
        if not success:
            print(f"❌ [INTEGRATION-SERVICE] Disconnect failed")
            print("="*100 + "\n")
            raise HTTPException(status_code=500, detail="Failed to disconnect Twitter")
        
        print(f"✅ [INTEGRATION-SERVICE] Twitter disconnected successfully")
        print("="*100 + "\n")
        
        return {"message": "Twitter disconnected successfully", "platform": "twitter"}
    except Exception as e:
        print(f"❌ [INTEGRATION-SERVICE] Exception: {str(e)}")
        print("="*100 + "\n")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect Twitter: {e}")

@app.post("/api/integrations/twitter/post")
async def post_to_twitter(post_request: PostRequest):
    """Post content to Twitter using stored tokens via Agent Service"""
    print("\n" + "="*100)
    print("📤 [INTEGRATION-SERVICE] Twitter Post Request Received")
    print("="*100)
    print(f"👤 [INTEGRATION-SERVICE] User ID: {post_request.user_id}")
    print(f"📝 [INTEGRATION-SERVICE] Content length: {len(post_request.content)} chars")
    
    # Get user's Twitter tokens from Firestore
    tokens = await get_user_tokens(post_request.user_id, 'twitter')
    
    if not tokens or not tokens.get('access_token'):
        print(f"❌ [INTEGRATION-SERVICE] No Twitter tokens found for user {post_request.user_id}")
        raise HTTPException(status_code=401, detail="Twitter not connected. Please authenticate first.")
    
    print(f"✅ [INTEGRATION-SERVICE] Retrieved access token from Firestore")
    print(f"🤖 [INTEGRATION-SERVICE] Delegating to Agent Service for LLM-powered posting")
    
    # Delegate to Agent Service (which uses LLM + MCP Client)
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{AGENT_SERVICE_URL}/agent/twitter/post",
                json={
                    "content": post_request.content,
                    "access_token": tokens.get('access_token'),
                    "user_id": post_request.user_id
                }
            )
            
            print(f"📥 [INTEGRATION-SERVICE] Agent Service Response Status: {response.status_code}")
            
            if response.status_code == 401:
                print(f"❌ [INTEGRATION-SERVICE] Token expired")
                raise HTTPException(status_code=401, detail="Twitter token expired. Please re-authenticate.")
            
            response.raise_for_status()
            result = response.json()
            
            print(f"✅ [INTEGRATION-SERVICE] Post successful!")
            print("="*100 + "\n")
            
            return result
            
        except httpx.HTTPStatusError as exc:
            print(f"❌ [INTEGRATION-SERVICE] HTTP error from Agent Service: {exc.response.status_code}")
            if exc.response.status_code == 401:
                raise HTTPException(status_code=401, detail="Twitter token expired. Please re-authenticate.")
            raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
        except httpx.RequestError as exc:
            print(f"❌ [INTEGRATION-SERVICE] Connection error to Agent Service: {str(exc)}")
            raise HTTPException(status_code=503, detail=f"Error connecting to Agent Service: {exc}")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "integration-service",
        "mcp_server": MCP_SOCIAL_URL
    }
