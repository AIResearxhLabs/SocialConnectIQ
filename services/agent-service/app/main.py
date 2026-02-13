"""
Agent Service - AI-powered social media management agent
Handles OAuth workflows and content generation using LangGraph and OpenAI
"""
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import sys
import os
from typing import Optional, List
from contextlib import asynccontextmanager
from datetime import datetime
import httpx
import firebase_admin
from firebase_admin import credentials, firestore
import traceback
import pytz

from .config import settings
from .mcp_client import MCPClient
from .linkedin_agent import LinkedInOAuthAgent
from .twitter_agent import TwitterOAuthAgent
from .facebook_agent import FacebookOAuthAgent
from .content_agent import ContentRefinementAgent
from .trending_agent import TrendingTopicsAgent

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger, generate_correlation_id

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Service Config
INTEGRATION_SERVICE_URL = os.getenv("INTEGRATION_SERVICE_URL", "http://localhost:8002")

# Service Config
INTEGRATION_SERVICE_URL = os.getenv("INTEGRATION_SERVICE_URL", "http://localhost:8002")

# Initialize correlation logger
# Use absolute path to project root logs directory
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
_log_file = os.path.join(_project_root, "logs", "agent-service.log")

correlation_logger = CorrelationLogger(
    service_name="AGENT-SERVICE",
    log_file=_log_file
)

# Global instances
mcp_client: Optional[MCPClient] = None
linkedin_agent: Optional[LinkedInOAuthAgent] = None
twitter_agent: Optional[TwitterOAuthAgent] = None
facebook_agent: Optional[FacebookOAuthAgent] = None
content_agent: Optional[ContentRefinementAgent] = None
trending_agent: Optional[TrendingTopicsAgent] = None

# Global Firebase DB client
db = None

# Robust Firebase Initialization
try:
    # Check if Firebase is already initialized
    firebase_admin.get_app()
    db = firestore.client()
    logger.info("✅ Firebase already initialized and connected")
except ValueError:
    # Initialize Firebase with credentials from environment
    try:
        # Check if we have required Firebase credentials
        firebase_project_id = os.getenv("FIREBASE_PROJECT_ID")
        firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").replace('\\n', '\n')
        firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
        
        logger.info("Initializing Firebase with environment credentials...")
        
        if firebase_project_id and firebase_private_key and firebase_client_email and len(firebase_private_key) > 50:
            if "your-project-id" in firebase_project_id or "your-client-email" in firebase_client_email:
                logger.warning("❌ CRITICAL: Firebase credentials are PLACEHOLDER values!")
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
                logger.info("✅ Firebase initialized successfully with real credentials")
        else:
            logger.warning("❌ CRITICAL: Firebase credentials are incomplete or missing!")
    except Exception as e:
        logger.error(f"❌ ERROR: Could not initialize Firebase: {e}")
        logger.error(traceback.format_exc())

# Helper to get platform tokens
def get_platform_token(user_id: str, platform: str) -> Optional[str]:
    """Retrieve OAuth access token for a user and platform from Firestore"""
    if db is None:
        logger.warning(f"Firestore not initialized, cannot get token for {platform}")
        return None
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return None
            
        user_data = user_doc.to_dict()
        integrations = user_data.get('integrations', {})
        platform_data = integrations.get(platform, {})
        return platform_data.get('access_token')
    except Exception as e:
        logger.error(f"Error fetching {platform} token: {e}")
        return None


def get_business_context(user_id: str) -> Optional[dict]:
    """Retrieve business profile context for a user from Firestore.
    Returns the business profile dict if user is a business user, else None.
    """
    if db is None:
        return None
    try:
        account_ref = db.document(f'users/{user_id}/profile/accountType')
        account_doc = account_ref.get()
        if account_doc.exists:
            data = account_doc.to_dict()
            if data.get('userType') == 'business' and data.get('businessProfile'):
                logger.info(f"✅ Business context found for user {user_id}: {data['businessProfile'].get('businessName', 'Unknown')}")
                return data['businessProfile']
        return None
    except Exception as e:
        logger.error(f"Error fetching business context for {user_id}: {e}")
        return None

# Helper to save post history
async def save_post_history(user_id: str, content: str, platforms: list, results: dict):
    """Save posted content to Firestore 'scheduled_posts' collection so it appears in Calendar"""
    if db is None:
        logger.warning("Firestore not initialized, cannot save post history")
        return
        
    try:
        # Filter strictly for successful platforms
        successful_platforms = [p for p in platforms if results.get(p, {}).get("success")]
        if not successful_platforms:
            logger.info("No successful platforms to save post history for")
            return

        # Prepare platform post IDs
        platform_post_ids = {}
        for platform in successful_platforms:
            res = results.get(platform, {}).get("result", {})
            # Extract ID based on platform patterns
            post_id = res.get("id") or res.get("urn") or res.get("post_id") or res.get("share_urn")
            if post_id:
                platform_post_ids[platform] = post_id

        # Use UTC now for consistency
        now = datetime.utcnow()
        
        post_doc = {
            "content": content,
            "platforms": successful_platforms,
            "scheduledTime": now,  # For immediate posts, scheduledTime = now
            "status": "posted",
            "createdAt": now,
            "postedAt": now,
            "aiGenerated": True,
            "platformPostIds": platform_post_ids if platform_post_ids else {}
        }
        
        # Add to 'scheduled_posts' collection so it appears in Calendar
        db.collection('users').document(user_id).collection('scheduled_posts').add(post_doc)
        logger.info(f"✅ Saved AI chat post to 'scheduled_posts' for calendar - user: {user_id}, platforms: {successful_platforms}")
        
    except Exception as e:
        logger.error(f"Failed to save post history: {e}")
        import traceback
        logger.error(traceback.format_exc())

# Rate limiting (in-memory)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the application"""
    global mcp_client, linkedin_agent, twitter_agent, facebook_agent, content_agent, trending_agent
    
    # Startup
    logger.info("Initializing Agent Service...")
    
    try:
        # Initialize MCP client
        mcp_client = MCPClient(settings.mcp_server.base_url)
        logger.info(f"MCP Client initialized with server: {settings.mcp_server.base_url}")
        
        # Discover available tools with force refresh to get latest from MCP server
        tools = await mcp_client.discover_tools(force_refresh=True)
        tool_names = [tool.get('name') for tool in tools.get('tools', [])]
        logger.info(f"Discovered {len(tools.get('tools', []))} MCP tools: {tool_names}")
        
        # Initialize LinkedIn agent
        linkedin_agent = LinkedInOAuthAgent(
            mcp_client=mcp_client,
            openai_api_key=settings.openai.api_key
        )
        logger.info("LinkedIn OAuth Agent initialized")
        
        # Initialize Twitter agent
        twitter_agent = TwitterOAuthAgent(
            mcp_client=mcp_client,
            openai_api_key=settings.openai.api_key
        )
        logger.info("Twitter OAuth Agent initialized")
        
        # Initialize Facebook agent
        facebook_agent = FacebookOAuthAgent(
            mcp_client=mcp_client,
            openai_api_key=settings.openai.api_key
        )
        logger.info("Facebook OAuth Agent initialized")
        
        # Initialize Content Refinement agent
        content_agent = ContentRefinementAgent(
            openai_api_key=settings.openai.api_key,
            model=settings.openai.model
        )
        logger.info("Content Refinement Agent initialized")
        
        # Initialize Trending Topics agent
        trending_agent = TrendingTopicsAgent(
            openai_api_key=settings.openai.api_key,
            model="gpt-4o" # High quality model requested by user
        )
        logger.info("Trending Topics Agent initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Agent Service...")
    if mcp_client:
        await mcp_client.close()


app = FastAPI(
    title="Agent Service",
    description="AI-powered agent for social media OAuth and content management",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Image Proxy Endpoint (Bypass CORS for external AI images) ---
import httpx
from fastapi.responses import Response

@app.get("/proxy-image")
async def proxy_image(url: str):
    """
    Proxy external images through our backend to bypass CORS restrictions.
    Used for fetching AI-generated images from services like Pollinations.ai.
    """
    logger.info(f"[PROXY-IMAGE] Fetching: {url[:100]}...")
    
    try:
        # Disable SSL verification for dev (Pollinations uses valid certs but Windows can have issues)
        async with httpx.AsyncClient(
            timeout=60.0,  # Longer timeout - image generation can be slow
            follow_redirects=True,
            verify=False  # Bypass SSL cert verification for development
        ) as client:
            response = await client.get(url)
            
            logger.info(f"[PROXY-IMAGE] Got response: {response.status_code}, size: {len(response.content)} bytes")
            
            if response.status_code != 200:
                logger.error(f"[PROXY-IMAGE] Upstream returned {response.status_code}")
                raise HTTPException(status_code=response.status_code, detail=f"Upstream returned {response.status_code}")
            
            if len(response.content) < 1000:
                logger.error(f"[PROXY-IMAGE] Response too small, likely an error page")
                raise HTTPException(status_code=502, detail="Image response too small")
            
            # Return the image with proper headers
            return Response(
                content=response.content,
                media_type=response.headers.get("content-type", "image/jpeg"),
                headers={
                    "Cache-Control": "no-cache",  # Don't cache so regenerate works
                    "Access-Control-Allow-Origin": "*"
                }
            )
    except httpx.RequestError as e:
        logger.error(f"[PROXY-IMAGE] Request error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Request failed: {str(e)}")
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        logger.error(f"[PROXY-IMAGE] Unexpected error: {type(e).__name__}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")


# Request/Response Models
class GetAuthUrlRequest(BaseModel):
    user_id: str


class GetAuthUrlResponse(BaseModel):
    success: bool
    auth_url: Optional[str] = None
    state: Optional[str] = None
    code_verifier: Optional[str] = None  # Required for Twitter PKCE
    codeVerifier: Optional[str] = None  # Alternate key for compatibility
    error: Optional[str] = None


class HandleCallbackRequest(BaseModel):
    code: str
    user_id: str
    code_verifier: Optional[str] = None  # Required for Twitter PKCE


class HandleCallbackResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None



class PostContentRequest(BaseModel):
    content: str
    access_token: str
    user_id: str
    page_id: Optional[str] = None


class PostContentResponse(BaseModel):
    success: bool
    result: Optional[dict] = None
    error: Optional[str] = None


class ToolsListResponse(BaseModel):
    tools: list


# Content Refinement Models
class RefineContentRequest(BaseModel):
    user_id: str
    original_content: str
    refinement_instructions: Optional[str] = None
    tone: Optional[str] = None  # professional, casual, humorous, enthusiastic, informative, neutral
    platform: Optional[str] = None  # linkedin, twitter, facebook
    generate_alternatives: bool = False


class RefineContentResponse(BaseModel):
    success: bool
    refined_content: Optional[str] = None
    suggestions: Optional[List[str]] = None
    alternatives: Optional[List[str]] = None
    metadata: Optional[dict] = None
    error: Optional[str] = None


# AI Chat Models for Composer 2.0
class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    user_id: str
    message: str
    current_content: Optional[str] = ""
    conversation_history: List[ChatMessage] = []
    selected_platforms: List[str] = []  # Platforms user has selected in UI
    connected_platforms: List[str] = []  # Platforms user has connected
    timezone: Optional[str] = "Asia/Kolkata"  # User's timezone for scheduling
    image_data: Optional[str] = None  # Base64 image data
    image_mime_type: Optional[str] = None  # MIME type for image


class ChatResponse(BaseModel):
    success: bool
    reply: str
    suggested_content: Optional[str] = None
    suggested_platforms: Optional[dict] = None  # Per-platform content: {"linkedin": "...", "twitter": "..."}
    action: Optional[str] = None  # "posted", "scheduled", None
    action_result: Optional[dict] = None  # Details of action taken
    error: Optional[str] = None


# Tool definitions for OpenAI function calling
CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "post_to_platforms",
            "description": "Post content to social media platforms immediately. Use this when the user asks to 'post', 'publish', or 'send' their content now.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "The content/caption to post"
                    },
                    "platforms": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["linkedin", "twitter", "facebook", "instagram"]},
                        "description": "List of platforms to post to"
                    }
                },
                "required": ["content", "platforms"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_post",
            "description": "Schedule content to be posted at a specific date and time. Use this when the user asks to 'schedule' their content for later.",
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "The content/caption to schedule"
                    },
                    "platforms": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["linkedin", "twitter", "facebook", "instagram"]},
                        "description": "List of platforms to schedule for"
                    },
                    "date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format"
                    },
                    "time": {
                        "type": "string",
                        "description": "Time in HH:MM format (24-hour)"
                    }
                },
                "required": ["content", "platforms", "date", "time"]
            }
        }
    }
]


# Middleware to add correlation ID
@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    """Add correlation ID to request state"""
    correlation_id = request.headers.get("x-correlation-id") or generate_correlation_id()
    request.state.correlation_id = correlation_id
    
    # Log request start
    correlation_logger.request_start(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        method=request.method,
        user_id=request.headers.get("x-user-id")
    )
    
    response = await call_next(request)
    
    # Log request end
    correlation_logger.request_end(
        correlation_id=correlation_id,
        endpoint=str(request.url.path),
        status_code=response.status_code,
        user_id=request.headers.get("x-user-id")
    )
    
    # Add correlation ID to response headers
    response.headers["X-Correlation-ID"] = correlation_id
    
    return response


# Health check
@app.get("/")
async def root(request: Request):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    correlation_logger.info(
        "Agent Service root endpoint accessed",
        correlation_id=correlation_id
    )
    
    return {
        "service": "agent-service",
        "status": "running",
        "mcp_server": settings.mcp_server.base_url
    }


@app.get("/health")
async def health_check(request: Request):
    """Health check endpoint"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        # Check MCP server connectivity
        if mcp_client:
            tools = await mcp_client.list_available_tools()
            
            correlation_logger.success(
                f"Health check passed - {len(tools)} MCP tools available",
                correlation_id=correlation_id,
                additional_data={
                    "mcp_server": settings.mcp_server.base_url,
                    "tools_count": len(tools)
                }
            )
            
            return {
                "status": "healthy",
                "mcp_server": settings.mcp_server.base_url,
                "available_tools": len(tools)
            }
        else:
            correlation_logger.warning(
                "Health check - MCP client not yet initialized",
                correlation_id=correlation_id
            )
            
            return {
                "status": "initializing",
                "mcp_server": settings.mcp_server.base_url
            }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        
        correlation_logger.error(
            f"Health check failed: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        
        return {
            "status": "unhealthy",
            "error": str(e)
        }


# MCP Tools Discovery
@app.get("/mcp/tools", response_model=ToolsListResponse)
async def get_mcp_tools(request: Request):
    """Get list of available MCP tools"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            correlation_logger.error(
                "MCP tools request failed - client not initialized",
                correlation_id=correlation_id
            )
            raise HTTPException(status_code=503, detail="MCP client not initialized")
        
        tools = await mcp_client.list_available_tools()
        
        correlation_logger.success(
            f"Retrieved {len(tools)} MCP tools",
            correlation_id=correlation_id,
            additional_data={"tools_count": len(tools), "tools": tools}
        )
        
        return {"tools": tools}
        
    except Exception as e:
        logger.error(f"Error fetching MCP tools: {str(e)}")
        
        correlation_logger.error(
            f"Error fetching MCP tools: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        
        raise HTTPException(status_code=500, detail=str(e))


# LinkedIn OAuth Endpoints
@app.post("/agent/linkedin/auth", response_model=GetAuthUrlResponse)
async def linkedin_auth(
    request: GetAuthUrlRequest,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    Unified LinkedIn OAuth endpoint via AI agent with LLM-driven MCP integration
    Handles get_auth_url, handle_callback, and post_content actions
    """
    correlation_id = x_correlation_id or "unknown"
    
    try:
        if not linkedin_agent:
            logger.error(
                f"Agent Service: LinkedIn agent not initialized | correlation_id={correlation_id}"
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        logger.info(
            f"Agent Service: Received LinkedIn auth request | "
            f"correlation_id={correlation_id} | user_id={request.user_id}"
        )
        
        # Execute agent workflow with LLM reasoning
        logger.info(
            f"Agent Service: Invoking LLM-based LinkedInOAuthAgent | "
            f"correlation_id={correlation_id}"
        )
        
        result = await linkedin_agent.execute({
            "user_id": request.user_id,
            "action": "get_auth_url",
            "correlation_id": correlation_id
        })
        
        logger.info(
            f"Agent Service: Agent execution completed | "
            f"correlation_id={correlation_id} | success={result['success']}"
        )
        
        return GetAuthUrlResponse(
            success=result["success"],
            auth_url=result.get("auth_url"),
            state=result.get("state"),
            code_verifier=result.get("code_verifier"),
            codeVerifier=result.get("codeVerifier"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(
            f"Agent Service: Error in linkedin_auth | "
            f"correlation_id={correlation_id} | error={str(e)}"
        )
        return GetAuthUrlResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/get-auth-url", response_model=GetAuthUrlResponse)
async def linkedin_get_auth_url(request: Request, auth_request: GetAuthUrlRequest):
    """
    Get LinkedIn OAuth authorization URL via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not linkedin_agent:
            correlation_logger.error(
                "LinkedIn agent not initialized",
                correlation_id=correlation_id,
                user_id=auth_request.user_id
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        correlation_logger.info(
            f"Getting LinkedIn auth URL for user",
            correlation_id=correlation_id,
            user_id=auth_request.user_id
        )
        
        # Execute agent workflow
        result = await linkedin_agent.execute({
            "user_id": auth_request.user_id,
            "action": "get_auth_url",
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"LinkedIn auth URL generated",
            correlation_id=correlation_id,
            user_id=auth_request.user_id,
            additional_data={"has_auth_url": bool(result.get("auth_url"))}
        )
        
        return GetAuthUrlResponse(
            success=result["success"],
            auth_url=result.get("auth_url"),
            state=result.get("state"),
            code_verifier=result.get("code_verifier"),
            codeVerifier=result.get("codeVerifier"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in get_auth_url: {str(e)}")
        
        correlation_logger.error(
            f"Error in get_auth_url: {str(e)}",
            correlation_id=correlation_id,
            user_id=auth_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return GetAuthUrlResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/handle-callback", response_model=HandleCallbackResponse)
async def linkedin_handle_callback(request: Request, callback_request: HandleCallbackRequest):
    """
    Handle LinkedIn OAuth callback via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not linkedin_agent:
            correlation_logger.error(
                "LinkedIn agent not initialized",
                correlation_id=correlation_id,
                user_id=callback_request.user_id
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        correlation_logger.info(
            f"Handling LinkedIn callback",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"has_code": bool(callback_request.code)}
        )
        
        # Execute agent workflow
        result = await linkedin_agent.execute({
            "user_id": callback_request.user_id,
            "action": "handle_callback",
            "code": callback_request.code,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"LinkedIn callback handled",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return HandleCallbackResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in handle_callback: {str(e)}")
        
        correlation_logger.error(
            f"Error in handle_callback: {str(e)}",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return HandleCallbackResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/facebook/post-content", response_model=PostContentResponse)
async def facebook_post_content(request: Request, post_request: PostContentRequest):
    """
    Post content to Facebook via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not facebook_agent:
            correlation_logger.error(
                "Facebook agent not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="Facebook agent not initialized")
        
        correlation_logger.info(
            f"Posting content to Facebook",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Execute agent workflow
        result = await facebook_agent.execute({
            "user_id": post_request.user_id,
            "action": "post_content",
            "content": post_request.content,
            "access_token": post_request.access_token,
            "page_id": post_request.page_id,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"Facebook post result",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return PostContentResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in facebook_post_content: {str(e)}")
        
        correlation_logger.error(
            f"Error in facebook_post_content: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/post-content", response_model=PostContentResponse)
async def linkedin_post_content(request: Request, post_request: PostContentRequest):
    """
    Post content to LinkedIn via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not linkedin_agent:
            correlation_logger.error(
                "LinkedIn agent not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="LinkedIn agent not initialized")
        
        correlation_logger.info(
            f"Posting content to LinkedIn",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Execute agent workflow
        result = await linkedin_agent.execute({
            "user_id": post_request.user_id,
            "action": "post_content",
            "content": post_request.content,
            "access_token": post_request.access_token,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"LinkedIn post completed",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return PostContentResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in post_content: {str(e)}")
        
        correlation_logger.error(
            f"Error in post_content: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/linkedin/post", response_model=PostContentResponse)
async def linkedin_post(request: Request, post_request: PostContentRequest):
    """
    Simplified endpoint for posting to LinkedIn via AI agent
    Routes to the main post-content endpoint
    """
    return await linkedin_post_content(request, post_request)


# Twitter OAuth Endpoints
@app.post("/agent/twitter/auth", response_model=GetAuthUrlResponse)
async def twitter_auth(
    request: GetAuthUrlRequest,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    Unified Twitter OAuth endpoint via AI agent with LLM-driven MCP integration
    """
    correlation_id = x_correlation_id or "unknown"
    
    try:
        if not twitter_agent:
            logger.error(
                f"Agent Service: Twitter agent not initialized | correlation_id={correlation_id}"
            )
            raise HTTPException(status_code=503, detail="Twitter agent not initialized")
        
        logger.info(
            f"Agent Service: Received Twitter auth request | "
            f"correlation_id={correlation_id} | user_id={request.user_id}"
        )
        
        # Execute agent workflow with LLM reasoning
        result = await twitter_agent.execute({
            "user_id": request.user_id,
            "action": "get_auth_url",
            "correlation_id": correlation_id
        })
        
        logger.info(
            f"Agent Service: Agent execution completed | "
            f"correlation_id={correlation_id} | success={result['success']} | "
            f"has_code_verifier={'code_verifier' in result or 'codeVerifier' in result}"
        )
        
        return GetAuthUrlResponse(
            success=result["success"],
            auth_url=result.get("auth_url"),
            state=result.get("state"),
            code_verifier=result.get("code_verifier"),
            codeVerifier=result.get("codeVerifier"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(
            f"Agent Service: Error in twitter_auth | "
            f"correlation_id={correlation_id} | error={str(e)}"
        )
        return GetAuthUrlResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/twitter/handle-callback", response_model=HandleCallbackResponse)
async def twitter_handle_callback(request: Request, callback_request: HandleCallbackRequest):
    """
    Handle Twitter OAuth callback via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not twitter_agent:
            correlation_logger.error(
                "Twitter agent not initialized",
                correlation_id=correlation_id,
                user_id=callback_request.user_id
            )
            raise HTTPException(status_code=503, detail="Twitter agent not initialized")
        
        correlation_logger.info(
            f"Handling Twitter callback",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"has_code": bool(callback_request.code)}
        )
        
        # Execute agent workflow (pass code_verifier for PKCE)
        result = await twitter_agent.execute({
            "user_id": callback_request.user_id,
            "action": "handle_callback",
            "code": callback_request.code,
            "code_verifier": callback_request.code_verifier,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"Twitter callback handled",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return HandleCallbackResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in handle_callback: {str(e)}")
        
        correlation_logger.error(
            f"Error in handle_callback: {str(e)}",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return HandleCallbackResponse(
            success=False,
            error=str(e)
        )


# Facebook OAuth Endpoints
@app.post("/agent/facebook/auth", response_model=GetAuthUrlResponse)
async def facebook_auth(
    request: GetAuthUrlRequest,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    Unified Facebook OAuth endpoint via AI agent with LLM-driven MCP integration
    """
    correlation_id = x_correlation_id or "unknown"
    
    try:
        if not facebook_agent:
            logger.error(
                f"Agent Service: Facebook agent not initialized | correlation_id={correlation_id}"
            )
            raise HTTPException(status_code=503, detail="Facebook agent not initialized")
        
        logger.info(
            f"Agent Service: Received Facebook auth request | "
            f"correlation_id={correlation_id} | user_id={request.user_id}"
        )
        
        # Execute agent workflow with LLM reasoning
        result = await facebook_agent.execute({
            "user_id": request.user_id,
            "action": "get_auth_url",
            "correlation_id": correlation_id
        })
        
        logger.info(
            f"Agent Service: Facebook agent execution completed | "
            f"correlation_id={correlation_id} | success={result['success']}"
        )
        
        return GetAuthUrlResponse(
            success=result["success"],
            auth_url=result.get("auth_url"),
            state=result.get("state"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(
            f"Agent Service: Error in facebook_auth | "
            f"correlation_id={correlation_id} | error={str(e)}"
        )
        return GetAuthUrlResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/facebook/handle-callback", response_model=HandleCallbackResponse)
async def facebook_handle_callback(request: Request, callback_request: HandleCallbackRequest):
    """
    Handle Facebook OAuth callback via AI agent
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not facebook_agent:
            correlation_logger.error(
                "Facebook agent not initialized",
                correlation_id=correlation_id,
                user_id=callback_request.user_id
            )
            raise HTTPException(status_code=503, detail="Facebook agent not initialized")
        
        correlation_logger.info(
            f"Handling Facebook callback",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"has_code": bool(callback_request.code)}
        )
        
        # Execute agent workflow
        result = await facebook_agent.execute({
            "user_id": callback_request.user_id,
            "action": "handle_callback",
            "code": callback_request.code,
            "correlation_id": correlation_id
        })
        
        correlation_logger.success(
            f"Facebook callback handled",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"success": result.get("success")}
        )
        
        return HandleCallbackResponse(
            success=result["success"],
            result=result.get("result"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in Facebook handle_callback: {str(e)}")
        
        correlation_logger.error(
            f"Error in Facebook handle_callback: {str(e)}",
            correlation_id=correlation_id,
            user_id=callback_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return HandleCallbackResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/facebook/post", response_model=PostContentResponse)
async def facebook_post(request: Request, post_request: PostContentRequest):
    """
    Post content to Facebook via MCP Client with LLM-powered tool discovery
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            correlation_logger.error(
                "MCP client not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="MCP client not initialized")
        
        correlation_logger.info(
            f"Posting content to Facebook",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Use MCP Client to invoke the postToFacebook tool
        result = await mcp_client.invoke_tool(
            tool_name="postToFacebook",
            parameters={
                "content": post_request.content,
                "accessToken": post_request.access_token,
                "userId": post_request.user_id
            },
            correlation_id=correlation_id,
            user_id=post_request.user_id
        )
        
        correlation_logger.success(
            f"Facebook post completed",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"result": result}
        )
        
        return PostContentResponse(
            success=True,
            result=result,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error posting to Facebook: {str(e)}")
        
        correlation_logger.error(
            f"Error posting to Facebook: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


@app.post("/agent/twitter/post", response_model=PostContentResponse)
async def twitter_post(request: Request, post_request: PostContentRequest):
    """
    Post content to Twitter via MCP Client with LLM-powered tool discovery
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            correlation_logger.error(
                "MCP client not initialized",
                correlation_id=correlation_id,
                user_id=post_request.user_id
            )
            raise HTTPException(status_code=503, detail="MCP client not initialized")
        
        correlation_logger.info(
            f"Posting content to Twitter",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"content_length": len(post_request.content)}
        )
        
        # Use MCP Client to invoke the postToTwitter tool
        result = await mcp_client.invoke_tool(
            tool_name="postToTwitter",
            parameters={
                "content": post_request.content,
                "accessToken": post_request.access_token,
                "userId": post_request.user_id
            },
            correlation_id=correlation_id,
            user_id=post_request.user_id
        )
        
        correlation_logger.success(
            f"Twitter post completed",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"result": result}
        )
        
        return PostContentResponse(
            success=True,
            result=result,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error posting to Twitter: {str(e)}")
        
        correlation_logger.error(
            f"Error posting to Twitter: {str(e)}",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return PostContentResponse(
            success=False,
            error=str(e)
        )


# Content Refinement Endpoint
@app.post("/agent/content/refine", response_model=RefineContentResponse)
async def refine_content(request: Request, refine_request: RefineContentRequest):
    """
    Refine content using AI-powered Content Refinement Agent
    Enhances clarity, engagement, and platform-specific optimization
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not content_agent:
            correlation_logger.error(
                "Content refinement agent not initialized",
                correlation_id=correlation_id,
                user_id=refine_request.user_id
            )
            raise HTTPException(status_code=503, detail="Content refinement agent not initialized")
        
        correlation_logger.info(
            f"Refining content",
            correlation_id=correlation_id,
            user_id=refine_request.user_id,
            additional_data={
                "original_length": len(refine_request.original_content),
                "tone": refine_request.tone,
                "platform": refine_request.platform,
                "has_instructions": bool(refine_request.refinement_instructions),
                "generate_alternatives": refine_request.generate_alternatives
            }
        )
        
        # Call content refinement agent
        result = await content_agent.refine_content(
            original_content=refine_request.original_content,
            user_id=refine_request.user_id,
            correlation_id=correlation_id,
            tone=refine_request.tone,
            platform=refine_request.platform,
            refinement_instructions=refine_request.refinement_instructions,
            generate_alternatives=refine_request.generate_alternatives
        )
        
        if result.get("success"):
            correlation_logger.success(
                f"Content refinement completed",
                correlation_id=correlation_id,
                user_id=refine_request.user_id,
                additional_data={
                    "refined_length": len(result.get("refined_content", "")),
                    "suggestions_count": len(result.get("suggestions", [])),
                    "alternatives_count": len(result.get("alternatives", []))
                }
            )
        else:
            correlation_logger.error(
                f"Content refinement failed: {result.get('error')}",
                correlation_id=correlation_id,
                user_id=refine_request.user_id
            )
        
        return RefineContentResponse(
            success=result.get("success", False),
            refined_content=result.get("refined_content"),
            suggestions=result.get("suggestions"),
            alternatives=result.get("alternatives"),
            metadata=result.get("metadata"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in content refinement: {str(e)}")
        
        correlation_logger.error(
            f"Error in content refinement: {str(e)}",
            correlation_id=correlation_id,
            user_id=refine_request.user_id,
            additional_data={"error": str(e)}
        )
        
        return RefineContentResponse(
            success=False,
            error=str(e)
        )


# Debug Endpoints
@app.get("/debug/mcp-logs")
async def get_mcp_logs(request: Request, lines: int = 50):
    """Get recent MCP interaction logs for debugging"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        import os
        mcp_log_file = "logs/mcp-interactions.log"
        
        if not os.path.exists(mcp_log_file):
            return {
                "error": "MCP log file not found",
                "file": mcp_log_file
            }
        
        # Read last N lines from the log file
        with open(mcp_log_file, 'r') as f:
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        correlation_logger.info(
            f"Debug endpoint: Retrieved {len(recent_lines)} lines from MCP logs",
            correlation_id=correlation_id,
            additional_data={"lines_requested": lines, "lines_returned": len(recent_lines)}
        )
        
        return {
            "total_lines": len(all_lines),
            "returned_lines": len(recent_lines),
            "logs": "".join(recent_lines)
        }
        
    except Exception as e:
        correlation_logger.error(
            f"Error reading MCP logs: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        return {"error": str(e)}


@app.get("/debug/last-request")
async def get_last_request(request: Request):
    """Get information about the last MCP request for debugging"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    correlation_logger.info(
        "Debug endpoint: Retrieving last request info",
        correlation_id=correlation_id
    )
    
    # This would need to be enhanced with actual request tracking
    # For now, just return a helpful message
    return {
        "message": "Check logs/mcp-interactions.log for detailed request/response logs",
        "centralized_log": "logs/centralized.log",
        "agent_service_log": "logs/agent-service.log",
        "mcp_interactions_log": "logs/mcp-interactions.log"
    }


@app.get("/debug/connection-test")
async def test_mcp_connection(request: Request):
    """Test MCP server connectivity"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            return {
                "status": "error",
                "message": "MCP client not initialized"
            }
        
        correlation_logger.info(
            "Debug endpoint: Testing MCP server connectivity",
            correlation_id=correlation_id,
            additional_data={"mcp_server": settings.mcp_server.base_url}
        )
        
        # Try to list tools as a connectivity test
        import time
        start_time = time.time()
        
        tools = await mcp_client.list_available_tools()
        
        elapsed = time.time() - start_time
        
        correlation_logger.success(
            f"Debug endpoint: MCP server connectivity test passed",
            correlation_id=correlation_id,
            additional_data={
                "mcp_server": settings.mcp_server.base_url,
                "response_time": f"{elapsed:.3f}s",
                "tools_count": len(tools)
            }
        )
        
        return {
            "status": "success",
            "mcp_server": settings.mcp_server.base_url,
            "response_time": f"{elapsed:.3f}s",
            "available_tools": tools
        }
        
    except Exception as e:
        correlation_logger.error(
            f"Debug endpoint: MCP connectivity test failed: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e), "mcp_server": settings.mcp_server.base_url}
        )
        
        return {
            "status": "error",
            "message": str(e),
            "mcp_server": settings.mcp_server.base_url
        }


@app.post("/debug/refresh-tools")
async def refresh_mcp_tools(request: Request):
    """Force refresh MCP tools cache from server"""
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    try:
        if not mcp_client:
            return {
                "status": "error",
                "message": "MCP client not initialized"
            }
        
        correlation_logger.info(
            "Debug endpoint: Force refreshing MCP tools cache",
            correlation_id=correlation_id,
            additional_data={"mcp_server": settings.mcp_server.base_url}
        )
        
        import time
        start_time = time.time()
        
        # Force refresh the tools cache
        tools_data = await mcp_client.refresh_tools_cache()
        tools = [tool.get('name') for tool in tools_data.get('tools', [])]
        
        elapsed = time.time() - start_time
        
        correlation_logger.success(
            f"Debug endpoint: MCP tools cache refreshed successfully",
            correlation_id=correlation_id,
            additional_data={
                "mcp_server": settings.mcp_server.base_url,
                "response_time": f"{elapsed:.3f}s",
                "tools_count": len(tools),
                "tools": tools
            }
        )
        
        return {
            "status": "success",
            "message": "Tools cache refreshed successfully",
            "mcp_server": settings.mcp_server.base_url,
            "response_time": f"{elapsed:.3f}s",
            "tools_count": len(tools),
            "available_tools": tools
        }
        
    except Exception as e:
        correlation_logger.error(
            f"Debug endpoint: Failed to refresh tools cache: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e), "mcp_server": settings.mcp_server.base_url}
        )
        
        return {
            "status": "error",
            "message": str(e),
            "mcp_server": settings.mcp_server.base_url
        }


# ============================================================
# AI CHAT ENDPOINT FOR COMPOSER 2.0 WITH TOOL CALLING
# ============================================================

async def execute_post_to_platforms(user_id: str, content: str, platforms: list, correlation_id: str, image_data: str = None, image_mime_type: str = None):
    """Execute posting to specified platforms via MCP using direct token access"""
    results = {}
    
    for platform in platforms:
        try:
            # Get token directly from DB
            token = get_platform_token(user_id, platform)
            
            if not token:
                results[platform] = {"success": False, "error": "Not authenticated. Please connect account first."}
                continue

            if platform == "linkedin":
                if image_data:
                    # Bypass MCP for LinkedIn image posts and call Integration Service directly
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{INTEGRATION_SERVICE_URL}/api/integrations/linkedin/post-with-image",
                            json={
                                "content": content,
                                "user_id": user_id,
                                "image_data": image_data,
                                "image_mime_type": image_mime_type or "image/jpeg"
                            },
                             timeout=60.0
                        )
                        if response.status_code == 200:
                             result = response.json()
                             results[platform] = {"success": True, "result": result}
                        else:
                             results[platform] = {"success": False, "error": f"Failed to upload image: {response.text}"}
                else: 
                     result = await mcp_client.invoke_tool(
                        tool_name="postToLinkedIn",
                        parameters={
                            "content": content, 
                            "accessToken": token,
                            "userId": user_id,
                            "imageData": image_data,
                            "imageMimeType": image_mime_type
                        },
                        correlation_id=correlation_id,
                        user_id=user_id
                    )
                     results[platform] = {"success": True, "result": result}
            elif platform == "twitter":
                result = await mcp_client.invoke_tool(
                    tool_name="postToTwitter",
                    parameters={
                        "content": content, 
                        "accessToken": token,
                        "userId": user_id,
                        "imageData": image_data,
                        "imageMimeType": image_mime_type
                    },
                    correlation_id=correlation_id,
                    user_id=user_id
                )
                results[platform] = {"success": True, "result": result}
            elif platform == "facebook":
                result = await mcp_client.invoke_tool(
                    tool_name="postToFacebook",
                    parameters={
                        "content": content, 
                        "accessToken": token,
                        "userId": user_id,
                        "imageData": image_data,
                        "imageMimeType": image_mime_type
                    },
                    correlation_id=correlation_id,
                    user_id=user_id
                )
                results[platform] = {"success": True, "result": result}
            else:
                results[platform] = {"success": False, "error": f"Platform {platform} not supported yet"}
        except Exception as e:
            results[platform] = {"success": False, "error": str(e)}
            logger.error(f"Failed to post to {platform}: {str(e)}")

    # Save history side-effect
    await save_post_history(user_id, content, platforms, results)
    
    return results


async def execute_schedule_post(user_id: str, content: str, platforms: list, date: str, time: str, timezone: str, correlation_id: str):
    """Schedule a post to Firestore for later execution"""
    try:
        import pytz
        
        # Parse the scheduled time in user's timezone
        tz = pytz.timezone(timezone)
        scheduled_dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        scheduled_dt = tz.localize(scheduled_dt)
        
        # Create scheduled post document
        scheduled_post = {
            "content": content,
            "platforms": platforms,
            "scheduledTime": scheduled_dt.isoformat(),
            "status": "pending",
            "createdAt": datetime.now(pytz.UTC).isoformat(),
            "userId": user_id
        }
        
        # Save to Firestore directly (Bypassing MCP tool to avoid dependency issues)
        if db is None:
            raise Exception("Database connection not initialized")

        # Convert ISO strings back to datetime objects for Firestore Timestamp compatibility
        # (Though Firestore client handles ISO strings, explicit datetime is safer for queries)
        scheduled_post["scheduledTime"] = scheduled_dt
        scheduled_post["createdAt"] = datetime.now(pytz.UTC)

        # Add to users/{userId}/scheduled_posts
        doc_ref = db.collection('users').document(user_id).collection('scheduled_posts').document()
        doc_ref.set(scheduled_post)
        
        result = {"id": doc_ref.id, "success": True}
        
        return {
            "success": True,
            "scheduled_time": scheduled_dt.strftime("%B %d, %Y at %I:%M %p"),
            "platforms": platforms,
            "result": result
        }
    except Exception as e:
        logger.error(f"Failed to schedule post: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/agent/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: Request,
    chat_request: ChatRequest,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    AI-powered chat endpoint for the Composer with tool-calling capabilities.
    Can post content, schedule posts, or just help write/refine content.
    """
    correlation_id = x_correlation_id or f"chat-{chat_request.user_id}-{id(request)}"
    
    correlation_logger.info(
        f"AI Chat request received",
        correlation_id=correlation_id,
        additional_data={
            "user_id": chat_request.user_id,
            "message_preview": chat_request.message[:100] if chat_request.message else "",
            "has_current_content": bool(chat_request.current_content),
            "history_length": len(chat_request.conversation_history),
            "selected_platforms": chat_request.selected_platforms,
            "connected_platforms": chat_request.connected_platforms
        }
    )
    
    try:
        # Build the enhanced system prompt with tool awareness
        connected_str = ", ".join(chat_request.connected_platforms) if chat_request.connected_platforms else "none"
        selected_str = ", ".join(chat_request.selected_platforms) if chat_request.selected_platforms else "none"
        
        system_prompt = f"""You are a professional social media content writer and assistant. 
Your job is to help users write engaging posts and manage their social media presence.

CURRENT CONTEXT:
- User's connected platforms: {connected_str}
- User's currently selected platforms: {selected_str}
- Current date/time: {datetime.now().strftime("%Y-%m-%d %H:%M")}
"""
        
        # Inject business context if the user is a business account
        biz_context = get_business_context(chat_request.user_id)
        if biz_context:
            biz_name = biz_context.get('businessName', '')
            biz_category = biz_context.get('category', '')
            biz_audience = biz_context.get('targetAudience', '')
            biz_website = biz_context.get('websiteUrl', '')
            
            system_prompt += f"""BUSINESS CONTEXT (this user is a business account):
- Business Name: {biz_name}
- Industry/Category: {biz_category}
- Target Audience: {biz_audience}
{f'- Website: {biz_website}' if biz_website else ''}

IMPORTANT: Tailor ALL content to this business's brand, industry, and target audience.
Use language and topics that resonate with their specific audience.
When writing posts, reflect the professional identity of {biz_name}.

"""
        
        system_prompt += f"""CAPABILITIES:
1. **Write Content**: Help write engaging posts for social media
2. **Post Now**: When user says "post this", "publish", or "send now" - use the post_to_platforms function
3. **Schedule**: When user says "schedule for..." - use the schedule_post function

GUIDELINES FOR WRITING:
- Be concise but impactful
- Use professional yet approachable tone
- Include relevant emojis sparingly
- Keep posts under 3000 characters

GUIDELINES FOR POSTING/SCHEDULING:
- Only post to platforms that are connected
- If user doesn't specify platforms, use the currently selected ones
- If no content is specified, use the current_content from context
- For scheduling, parse dates naturally (e.g., "tomorrow at 9am" → appropriate date/time)

FORMAT FOR CONTENT RESPONSES:
When the user asks you to write/generate content and MULTIPLE platforms are selected, you MUST return separate versions tailored to each platform using this exact format:

[Your message to the user]

---LINKEDIN---
[LinkedIn version - professional tone, longer, with hashtags]
---TWITTER---
[Twitter version - concise, under 280 chars, with 1-2 hashtags]
---FACEBOOK---
[Facebook version - engaging, storytelling, with emojis]
---INSTAGRAM---
[Instagram version - casual, visual language, with hashtags]
---END---

Only include sections for the platforms that are currently selected. If only ONE platform is selected, use the simpler format:
[Your message to the user]

---POST---
[The post content]
---END---

When executing actions (posting/scheduling), just respond naturally confirming what you did."""

        # Build conversation messages for OpenAI
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history
        for msg in chat_request.conversation_history[-10:]:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add context about current content if exists
        user_message = chat_request.message
        if chat_request.current_content:
            user_message = f"[Current post content in editor: \"{chat_request.current_content}\"]\n\nUser: {chat_request.message}"
        
        messages.append({"role": "user", "content": user_message})
        
        # Call OpenAI with function calling
        import openai
        client = openai.OpenAI()
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=CHAT_TOOLS,
            tool_choice="auto",
            max_tokens=1500,
            temperature=0.7
        )
        
        response_message = response.choices[0].message
        
        # Check if the model wants to call a function
        if response_message.tool_calls:
            tool_call = response_message.tool_calls[0]
            function_name = tool_call.function.name
            import json
            function_args = json.loads(tool_call.function.arguments)
            
            correlation_logger.info(
                f"AI requesting tool call: {function_name}",
                correlation_id=correlation_id,
                additional_data={"function_args": function_args}
            )
            
            # Execute the function
            if function_name == "post_to_platforms":
                content = function_args.get("content", chat_request.current_content)
                platforms = function_args.get("platforms", chat_request.selected_platforms)
                
                if not content:
                    return ChatResponse(
                        success=True,
                        reply="I don't see any content to post. Please write something first or tell me what you'd like to post!",
                        action=None
                    )
                
                if not platforms:
                    return ChatResponse(
                        success=True,
                        reply="Please select at least one platform to post to, or tell me which platforms you want to use.",
                        action=None
                    )
                
                # Execute posting
                post_results = await execute_post_to_platforms(
                    user_id=chat_request.user_id,
                    content=content,
                    platforms=platforms,
                    correlation_id=correlation_id,
                    image_data=chat_request.image_data,
                    image_mime_type=chat_request.image_mime_type
                )
                
                # Build response message
                success_platforms = [p for p, r in post_results.items() if r.get("success")]
                failed_platforms = [p for p, r in post_results.items() if not r.get("success")]
                
                if success_platforms and not failed_platforms:
                    reply = f"✅ **Posted successfully!**\n" + "\n".join([f"- {p.title()}: ✓ Posted" for p in success_platforms])
                    reply += "\n\nYour content is now live! 🎉"
                elif success_platforms and failed_platforms:
                    reply = f"⚠️ **Partially posted**\n"
                    reply += "\n".join([f"- {p.title()}: ✓ Posted" for p in success_platforms])
                    reply += "\n" + "\n".join([f"- {p.title()}: ✗ Failed ({post_results[p].get('error', 'Unknown error')})" for p in failed_platforms])
                else:
                    reply = f"❌ **Posting failed**\n"
                    reply += "\n".join([f"- {p.title()}: ✗ {post_results[p].get('error', 'Unknown error')}" for p in failed_platforms])
                
                if success_platforms:
                    action_type = "posted"
                else:
                    action_type = None

                return ChatResponse(
                    success=True,
                    reply=reply,
                    action=action_type,
                    action_result={
                        "platforms": platforms,
                        "results": post_results,
                        "content_preview": content[:100] + "..." if len(content) > 100 else content
                    }
                )
            
            elif function_name == "schedule_post":
                content = function_args.get("content", chat_request.current_content)
                platforms = function_args.get("platforms", chat_request.selected_platforms)
                date = function_args.get("date")
                time = function_args.get("time")
                
                if not content:
                    return ChatResponse(
                        success=True,
                        reply="I don't see any content to schedule. Please write something first!",
                        action=None
                    )
                
                if not platforms:
                    return ChatResponse(
                        success=True,
                        reply="Please select platforms to schedule for.",
                        action=None
                    )
                
                # Execute scheduling
                schedule_result = await execute_schedule_post(
                    user_id=chat_request.user_id,
                    content=content,
                    platforms=platforms,
                    date=date,
                    time=time,
                    timezone=chat_request.timezone or "Asia/Kolkata",
                    correlation_id=correlation_id
                )
                
                if schedule_result.get("success"):
                    platforms_str = ", ".join([p.title() for p in platforms])
                    reply = f"📅 **Scheduled successfully!**\n\n"
                    reply += f"Your post will be published to {platforms_str} on {schedule_result.get('scheduled_time')}.\n\n"
                    reply += "You can view and manage your scheduled posts in the Calendar."
                    
                    return ChatResponse(
                        success=True,
                        reply=reply,
                        action="scheduled",
                        action_result={
                            "platforms": platforms,
                            "scheduled_time": schedule_result.get("scheduled_time"),
                            "content_preview": content[:100] + "..." if len(content) > 100 else content
                        }
                    )
                else:
                    return ChatResponse(
                        success=True,
                        reply=f"❌ Failed to schedule: {schedule_result.get('error')}",
                        action=None
                    )
        
        # No tool call - regular content response
        ai_response = response_message.content or ""
        
        # Parse the response to extract suggested content
        suggested_content = None
        reply = ai_response
        
        if "---POST---" in ai_response and "---END---" in ai_response:
            parts = ai_response.split("---POST---")
            reply = parts[0].strip()
            content_part = parts[1].split("---END---")[0].strip()
            if content_part:
                suggested_content = content_part
        
        # Check for per-platform format (---LINKEDIN---, ---TWITTER---, etc.)
        platform_markers = ['LINKEDIN', 'TWITTER', 'FACEBOOK', 'INSTAGRAM']
        has_platform_format = any(f"---{p}---" in ai_response for p in platform_markers)
        
        suggested_platforms = None
        if has_platform_format:
            suggested_platforms = {}
            # Extract the reply (text before first platform marker)
            first_marker_pos = len(ai_response)
            for p in platform_markers:
                marker = f"---{p}---"
                pos = ai_response.find(marker)
                if pos != -1 and pos < first_marker_pos:
                    first_marker_pos = pos
            reply = ai_response[:first_marker_pos].strip()
            
            # Extract each platform's content
            for p in platform_markers:
                marker = f"---{p}---"
                if marker in ai_response:
                    start = ai_response.find(marker) + len(marker)
                    # Find next marker or ---END---
                    end = len(ai_response)
                    for next_p in platform_markers:
                        next_marker = f"---{next_p}---"
                        if next_marker != marker:
                            next_pos = ai_response.find(next_marker, start)
                            if next_pos != -1 and next_pos < end:
                                end = next_pos
                    end_pos = ai_response.find("---END---", start)
                    if end_pos != -1 and end_pos < end:
                        end = end_pos
                    platform_content = ai_response[start:end].strip()
                    if platform_content:
                        suggested_platforms[p.lower()] = platform_content
            
            # Also set suggested_content to first platform's content for backward compat
            if suggested_platforms:
                suggested_content = next(iter(suggested_platforms.values()))
                logger.info(f"Parsed per-platform content for: {list(suggested_platforms.keys())}")
        
        correlation_logger.success(
            f"AI Chat response generated",
            correlation_id=correlation_id,
            additional_data={
                "reply_length": len(reply),
                "has_suggested_content": suggested_content is not None,
                "used_tools": False
            }
        )
        
        return ChatResponse(
            success=True,
            reply=reply,
            suggested_content=suggested_content,
            suggested_platforms=suggested_platforms
        )
        
    except Exception as e:
        correlation_logger.error(
            f"AI Chat error: {str(e)}",
            correlation_id=correlation_id,
            additional_data={"error": str(e)}
        )
        return ChatResponse(
            success=False,
            reply=f"Sorry, I encountered an error: {str(e)}",
            error=str(e)
        )


# ============================================================
# REFINE TONE ENDPOINT
# ============================================================

class RefineToneRequest(BaseModel):
    user_id: str
    content: str
    platform: str   # linkedin, twitter, facebook, instagram
    tone: str       # professional, casual, humorous, enthusiastic, informative, neutral


class RefineToneResponse(BaseModel):
    success: bool
    refined_content: Optional[str] = None
    error: Optional[str] = None


@app.post("/agent/refine-tone", response_model=RefineToneResponse)
async def refine_tone(
    request: Request,
    req: RefineToneRequest,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    Refine content for a specific platform with a specific tone.
    Used by the per-platform Composer tone controls.
    """
    correlation_id = x_correlation_id or f"refine-{req.user_id}-{id(request)}"
    
    correlation_logger.info(
        f"Refine tone request",
        correlation_id=correlation_id,
        additional_data={
            "user_id": req.user_id,
            "platform": req.platform,
            "tone": req.tone,
            "content_length": len(req.content)
        }
    )
    
    try:
        if not content_agent:
            raise HTTPException(status_code=503, detail="Content agent not initialized")
        
        # Fetch business context for business users
        biz_context = get_business_context(req.user_id)
        
        result = await content_agent.refine_content(
            original_content=req.content,
            user_id=req.user_id,
            correlation_id=correlation_id,
            tone=req.tone,
            platform=req.platform,
            business_context=biz_context
        )
        
        if result.get("success"):
            correlation_logger.success(
                f"Tone refinement complete",
                correlation_id=correlation_id,
                additional_data={"platform": req.platform, "tone": req.tone}
            )
            return RefineToneResponse(
                success=True,
                refined_content=result.get("refined_content")
            )
        else:
            return RefineToneResponse(
                success=False,
                error=result.get("error", "Refinement failed")
            )
            
    except Exception as e:
        correlation_logger.error(
            f"Refine tone error: {str(e)}",
            correlation_id=correlation_id
        )
        return RefineToneResponse(
            success=False,
            error=str(e)
        )


# ============================================================
# TRENDING TOPICS ENDPOINTS
# ============================================================

class TrendingRequest(BaseModel):
    user_id: str
    force_refresh: bool = False
    count: int = 10


class TrendingTopic(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    platformId: str
    metrics: dict
    imageUrl: Optional[str] = None
    hashtags: List[str] = []


class TrendingResponse(BaseModel):
    success: bool
    topics: List[dict] = []
    cached: bool = False
    error: Optional[str] = None


@app.get("/trending/{user_id}")
async def get_trending_topics(
    user_id: str,
    force_refresh: bool = False,
    count: int = 10,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """
    Get personalized trending topics based on user's interests.
    Fetches interests from Firestore and generates AI-powered trending content.
    Results are cached for 30 minutes unless force_refresh=true.
    """
    correlation_id = x_correlation_id or generate_correlation_id()
    
    correlation_logger.info(
        f"Trending topics request for user {user_id}",
        correlation_id=correlation_id,
        additional_data={"force_refresh": force_refresh, "count": count}
    )
    
    if not trending_agent:
        return TrendingResponse(
            success=False,
            error="Trending agent not initialized"
        )
    
    if not db:
        return TrendingResponse(
            success=False,
            error="Database not initialized"
        )
    
    try:
        # Fetch user's interests from Firestore
        interests = []
        
        # Try to get interests from onboarding preferences
        onboarding_ref = db.document(f'users/{user_id}/preferences/onboarding')
        onboarding_doc = onboarding_ref.get()
        
        if onboarding_doc.exists:
            data = onboarding_doc.to_dict()
            # Check if personalization is enabled OR if interests exist (for backward compatibility)
            if data.get('personalizationEnabled', False) or data.get('selectedInterests'):
                interests = data.get('selectedInterests', [])
        
        if not interests:
            correlation_logger.warning(
                f"No interests found for user {user_id}",
                correlation_id=correlation_id
            )
            return TrendingResponse(
                success=False,
                error="No interests configured. Please enable personalization in Settings and select your interests.",
                topics=[]
            )
        
        correlation_logger.info(
            f"Found {len(interests)} interests for user",
            correlation_id=correlation_id,
            additional_data={"interests": interests}
        )
        
        # Generate trending topics
        result = await trending_agent.generate_trending_topics(
            user_id=user_id,
            interests=interests,
            correlation_id=correlation_id,
            force_refresh=force_refresh,
            count=count
        )
        
        if result.get("success"):
            correlation_logger.success(
                f"Generated {len(result.get('topics', []))} trending topics",
                correlation_id=correlation_id,
                additional_data={"cached": result.get("cached", False)}
            )
        
        return TrendingResponse(
            success=result.get("success", False),
            topics=result.get("topics", []),
            cached=result.get("cached", False),
            error=result.get("error")
        )
        
    except Exception as e:
        correlation_logger.error(
            f"Error fetching trending topics: {str(e)}",
            correlation_id=correlation_id
        )
        return TrendingResponse(
            success=False,
            error=str(e)
        )


@app.post("/trending/clear-cache")
async def clear_trending_cache(
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID")
):
    """Clear the trending topics cache"""
    correlation_id = x_correlation_id or generate_correlation_id()
    
    if trending_agent:
        trending_agent.clear_cache()
        correlation_logger.info("Trending cache cleared", correlation_id=correlation_id)
        return {"success": True, "message": "Cache cleared"}
    
    return {"success": False, "error": "Trending agent not initialized"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True
    )
