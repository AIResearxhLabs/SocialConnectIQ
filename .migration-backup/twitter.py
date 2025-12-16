"""
Twitter/X OAuth integration
"""
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import secrets
import httpx
from datetime import datetime
import sys
import os

from ..config import config
from .storage import token_storage

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger


class MCPClient:
    """Simple MCP client for backend service"""
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def handle_twitter_callback(
        self, 
        code: str, 
        user_id: str,
        correlation_id: str = "unknown"
    ) -> dict:
        """Handle Twitter OAuth callback"""
        logger.info(
            "Backend Service: Calling MCP server to exchange Twitter auth code",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"mcp_url": self.base_url}
        )
        
        response = await self.client.post(
            f"{self.base_url}/mcp/v1",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "exchangeTwitterAuthCode",
                    "arguments": {
                        "code": code,
                        "callbackUrl": os.getenv("TWITTER_REDIRECT_URI", "http://localhost:8000/api/integrations/twitter/callback")
                    }
                }
            }
        )
        response.raise_for_status()
        result = response.json()
        
        # Extract result from JSON-RPC response
        if "error" in result:
            raise Exception(f"MCP error: {result['error'].get('message', 'Unknown error')}")
        
        return result.get("result", {})
    
    async def post_to_twitter(
        self,
        content: str,
        access_token: str,
        user_id: str,
        correlation_id: str = "unknown",
        image_data: Optional[str] = None,
        image_mime_type: Optional[str] = None
    ) -> dict:
        """Post content to Twitter with optional image"""
        logger.info(
            "Backend Service: Calling MCP server to post to Twitter",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"has_image": bool(image_data)}
        )
        
        arguments = {
            "content": content,
            "accessToken": access_token,
            "userId": user_id
        }
        
        # Add image data if provided
        if image_data and image_mime_type:
            arguments["imageData"] = image_data
            arguments["imageMimeType"] = image_mime_type
        
        response = await self.client.post(
            f"{self.base_url}/mcp/v1",
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "postToTwitter",
                    "arguments": arguments
                }
            }
        )
        response.raise_for_status()
        result = response.json()
        
        # Extract result from JSON-RPC response
        if "error" in result:
            raise Exception(f"MCP error: {result['error'].get('message', 'Unknown error')}")
        
        return result.get("result", {})


logger = CorrelationLogger(
    service_name="BACKEND-SERVICE-TWITTER",
    log_file="logs/centralized.log"
)

# Initialize MCP client
mcp_client = MCPClient(os.getenv("MCP_SERVER_URL", "http://localhost:8007"))

router = APIRouter(prefix="/twitter", tags=["Twitter Integration"])


class PostRequest(BaseModel):
    content: str
    user_id: str
    image_data: Optional[str] = None
    image_mime_type: Optional[str] = None


@router.post("/auth")
async def initiate_auth(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """Initiate Twitter OAuth flow via AI Agent Service with LLM-driven MCP integration"""
    
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    logger.info(
        "Backend Service: Received Twitter auth request, delegating to Agent Service",
        correlation_id=correlation_id,
        user_id=user_id,
        additional_data={"agent_service_url": config.AGENT_SERVICE_URL}
    )
    
    try:
        # Delegate to Agent Service for LLM-driven MCP interaction
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(
                "Backend Service: Calling Agent Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"endpoint": f"{config.AGENT_SERVICE_URL}/agent/twitter/auth"}
            )
            
            response = await client.post(
                f"{config.AGENT_SERVICE_URL}/agent/twitter/auth",
                json={"user_id": user_id, "action": "get_auth_url"},
                headers={"X-Correlation-ID": correlation_id}
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(
                f"Backend Service: Agent Service responded successfully",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={
                    "status_code": response.status_code,
                    "success": result.get("success", False)
                }
            )
            
            # Extract auth_url from agent response
            if not result.get("success"):
                error_msg = result.get("error", "Unknown error from Agent Service")
                logger.error(
                    f"Backend Service: Agent Service returned error",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"error": error_msg}
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Agent Service error: {error_msg}"
                )
            
            auth_url = result.get("auth_url")
            state = result.get("state")
            
            if not auth_url:
                logger.error(
                    "Backend Service: No auth_url in Agent Service response",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"result": result}
                )
                raise HTTPException(
                    status_code=500,
                    detail="Failed to get Twitter auth URL from Agent Service"
                )
            
            # Extract state from URL if not provided separately
            if not state and auth_url:
                from urllib.parse import urlparse, parse_qs
                parsed_url = urlparse(auth_url)
                query_params = parse_qs(parsed_url.query)
                state = query_params.get('state', [None])[0]
            
            if not state:
                logger.error(
                    "Backend Service: No state parameter in auth URL",
                    correlation_id=correlation_id,
                    user_id=user_id,
                    additional_data={"auth_url": auth_url[:100]}
                )
                raise HTTPException(
                    status_code=500,
                    detail="Failed to extract state parameter from auth URL"
                )
            
            logger.info(
                "Backend Service: Saving OAuth state to Firestore",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={
                    "state_prefix": state[:12],
                    "state_suffix": state[-12:]
                }
            )
            
            # Save state to Firestore for validation during callback
            state_saved = await token_storage.save_oauth_state(
                state=state,
                user_id=user_id,
                platform="twitter",
                correlation_id=correlation_id
            )
            
            if not state_saved:
                logger.warning(
                    "Backend Service: Failed to save OAuth state to Firestore (continuing anyway)",
                    correlation_id=correlation_id,
                    user_id=user_id
                )
            else:
                logger.success(
                    "Backend Service: OAuth state saved successfully",
                    correlation_id=correlation_id,
                    user_id=user_id
                )
            
            logger.success(
                "Backend Service: Successfully obtained Twitter auth URL via Agent Service",
                correlation_id=correlation_id,
                user_id=user_id,
                additional_data={"has_state": bool(state)}
            )
            
            return {"auth_url": auth_url}
        
    except httpx.HTTPStatusError as e:
        logger.error(
            f"Backend Service: Agent Service HTTP error: {e.response.status_code}",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={
                "status_code": e.response.status_code,
                "response": e.response.text[:200]
            }
        )
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Agent Service error: {e.response.text}"
        )
    except httpx.RequestError as e:
        logger.error(
            f"Backend Service: Failed to connect to Agent Service: {str(e)}",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e), "agent_url": config.AGENT_SERVICE_URL}
        )
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Agent Service at {config.AGENT_SERVICE_URL}: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Backend Service: Unexpected error: {str(e)}",
            correlation_id=correlation_id,
            user_id=user_id,
            additional_data={"error": str(e)}
        )
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {str(e)}"
        )


@router.get("/callback")
async def handle_callback(request: Request, code: str, state: Optional[str] = None):
    """Handle Twitter OAuth callback using MCP container"""
    
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    logger.info(
        "Backend Service: Twitter callback received",
        correlation_id=correlation_id,
        additional_data={
            "has_code": bool(code),
            "has_state": bool(state),
            "state_preview": state[:20] if state else None
        }
    )
    
    try:
        # Validate state and get user_id
        if not state:
            logger.error(
                "Backend Service: Missing state parameter in callback",
                correlation_id=correlation_id
            )
            # Redirect to OAuth callback page with error
            return RedirectResponse(
                url=f"{config.FRONTEND_URL}/oauth-callback.html?status=error&platform=twitter&message=missing_state"
            )
        
        logger.info(
            "Backend Service: Validating OAuth state",
            correlation_id=correlation_id,
            additional_data={"state_prefix": state[:12], "state_suffix": state[-12:]}
        )
        
        state_data = await token_storage.validate_oauth_state(state, correlation_id)
        
        if not state_data:
            logger.error(
                "Backend Service: Invalid or expired OAuth state",
                correlation_id=correlation_id,
                additional_data={"state": state[:20]}
            )
            # Redirect to OAuth callback page with error
            return RedirectResponse(
                url=f"{config.FRONTEND_URL}/oauth-callback.html?status=error&platform=twitter&message=invalid_state"
            )
        
        user_id = state_data.get('user_id')
        
        logger.info(
            "Backend Service: OAuth state validated successfully",
            correlation_id=correlation_id,
            user_id=user_id
        )
        
        # Use MCP server to handle the callback and exchange code for tokens
        logger.info(
            "Backend Service: Exchanging OAuth code for tokens via MCP",
            correlation_id=correlation_id,
            user_id=user_id
        )
        
        result = await mcp_client.handle_twitter_callback(
            code=code,
            user_id=user_id,
            correlation_id=correlation_id
        )
        
        logger.info(
            "Backend Service: Token exchange successful",
            correlation_id=correlation_id,
            user_id=user_id
        )
        
        # Extract token data from MCP response
        access_token = result.get("accessToken") or result.get("access_token")
        refresh_token = result.get("refreshToken") or result.get("refresh_token", "")
        expires_in = result.get("expiresIn") or result.get("expires_in", 7200)  # Twitter tokens typically expire in 2 hours
        platform_user_id = result.get("platformUserId") or result.get("platform_user_id", "")
        
        if not access_token:
            raise HTTPException(
                status_code=500,
                detail="Failed to get access token from MCP container"
            )
        
        # Prepare token data for storage
        token_storage_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": datetime.utcnow().timestamp() + expires_in,
            "platform_user_id": platform_user_id,
        }
        
        # Save tokens to Firestore
        await token_storage.save_tokens(
            user_id=user_id,
            platform="twitter",
            token_data=token_storage_data,
            correlation_id=correlation_id
        )
        
        # Redirect to OAuth callback page with success message
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}/oauth-callback.html?status=success&platform=twitter"
        )
        
    except httpx.HTTPStatusError as e:
        # Redirect to OAuth callback page with error
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}/oauth-callback.html?status=error&platform=twitter&message=mcp_error"
        )
    except httpx.RequestError as e:
        # Redirect to OAuth callback page with error
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}/oauth-callback.html?status=error&platform=twitter&message=connection_error"
        )
    except Exception as e:
        # Redirect to OAuth callback page with error
        return RedirectResponse(
            url=f"{config.FRONTEND_URL}/oauth-callback.html?status=error&platform=twitter&message=unknown_error"
        )


@router.get("/status")
async def check_status(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """Check Twitter connection status for a user"""
    
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    tokens = await token_storage.get_tokens(
        user_id=user_id,
        platform="twitter",
        correlation_id=correlation_id
    )
    
    if tokens and tokens.get('connected'):
        return {
            "connected": True,
            "connected_at": tokens.get('connected_at'),
            "platform_user_id": tokens.get('platform_user_id', '')
        }
    
    return {"connected": False}


@router.post("/post")
async def post_content(request: Request, post_request: PostRequest):
    """Post content to Twitter using stored tokens"""
    
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    # Get user's Twitter tokens
    tokens = await token_storage.get_tokens(
        user_id=post_request.user_id,
        platform="twitter",
        correlation_id=correlation_id
    )
    
    if not tokens or not tokens.get('access_token'):
        raise HTTPException(
            status_code=401,
            detail="Twitter not connected. Please authenticate first."
        )
    
    try:
        logger.info(
            "Backend Service: Posting to Twitter via MCP",
            correlation_id=correlation_id,
            user_id=post_request.user_id,
            additional_data={
                "content_length": len(post_request.content),
                "has_image": bool(post_request.image_data)
            }
        )
        
        # Call MCP server to post to Twitter
        result = await mcp_client.post_to_twitter(
            content=post_request.content,
            access_token=tokens.get('access_token'),
            user_id=post_request.user_id,
            correlation_id=correlation_id,
            image_data=post_request.image_data,
            image_mime_type=post_request.image_mime_type
        )
        
        logger.success(
            "Backend Service: Twitter post successful",
            correlation_id=correlation_id,
            user_id=post_request.user_id
        )
        
        return result
        
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="Twitter token expired. Please re-authenticate."
            )
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Failed to post to Twitter: {e.response.text}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error connecting to MCP server: {str(e)}"
        )


@router.delete("/disconnect")
async def disconnect(request: Request, user_id: str = Header(..., alias="X-User-ID")):
    """Disconnect Twitter integration"""
    
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    
    success = await token_storage.disconnect_platform(
        user_id=user_id,
        platform="twitter",
        correlation_id=correlation_id
    )
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to disconnect Twitter"
        )
    
    return {"message": "Twitter disconnected successfully"}
