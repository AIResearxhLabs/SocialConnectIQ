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

from .config import settings
from .mcp_client import MCPClient
from .linkedin_agent import LinkedInOAuthAgent
from .twitter_agent import TwitterOAuthAgent
from .content_agent import ContentRefinementAgent

# Add parent directory to path for shared utilities
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
from shared.logging_utils import CorrelationLogger, generate_correlation_id

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
content_agent: Optional[ContentRefinementAgent] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the application"""
    global mcp_client, linkedin_agent, twitter_agent, content_agent
    
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
        
        # Initialize Content Refinement agent
        content_agent = ContentRefinementAgent(
            openai_api_key=settings.openai.api_key,
            model=settings.openai.model
        )
        logger.info("Content Refinement Agent initialized")
        
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True
    )
